import RentalStorefrontLink from '../../components/rentals/RentalStorefrontLink';
import { forwardRef, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import ProductGrid from '../../components/product/ProductGrid';
import StorefrontSkeleton from '../../components/ui/StorefrontSkeleton';
import MobileFilterSheet from '../../components/product/MobileFilterSheet';
import Icon from '../../components/layout/Icon';
import DesktopNewArrivalsLayout from './DesktopNewArrivalsLayout';
import { normalizeProducts } from '../../services/normalize';
import {
  clearCatalogFilters,
  createCatalogSearchParams,
  normalizeCatalogQuery,
  replaceCatalogFilters,
  selectCatalogFilters,
  splitFilterValues,
  toggleFilterValue,
} from '../../store/catalogSlice';
import { useGetBannersQuery, useGetCategoriesQuery, useGetProductsQuery } from '../../store/apiSlice';
import { trackEvent } from '../../utils/analytics';
import { useStorefront } from '../../context/StorefrontContext';
import { storefrontPath } from '../../utils/routing';
import SeoHead from '../../components/seo/SeoHead';
import api from '../../services/api';
import StorefrontBannerSlot from '../../components/banners/StorefrontBannerSlot';
import { buildCatalogFacets } from '../../utils/catalogFacets';

const PAGE_SIZE = 24;
const CATALOG_RETURN_KEY = 'samira_catalog_return';

export default function Products({ navigate, route = '/products' }) {
  const dispatch = useDispatch();
  const { storeSlug } = useStorefront();
  const [openFilters, setOpenFilters] = useState(false);
  const [catalogStructure, setCatalogStructure] = useState(null);
  const [page, setPage] = useState(1);
  const [catalogState, setCatalogState] = useState({ key: '', items: [], total: 0, totalPages: 1, facets: null });
  const desktopLoadMoreRef = useRef(null);
  const mobileLoadMoreRef = useRef(null);
  const restoredScrollKey = useRef('');
  const routePath = route.split('?')[0];
  const basePath = storefrontPath(routePath.endsWith('/search') ? '/search' : '/products', storeSlug);
  const routeQuery = useMemo(() => new URLSearchParams(route.split('?')[1] || ''), [route]);
  const filters = useSelector(selectCatalogFilters);
  const params = useMemo(() => createCatalogSearchParams(filters), [filters]);
  const requestKey = `${storeSlug || 'default'}?${params.toString()}`;
  const requestPage = catalogState.key === requestKey ? page : 1;
  const requestParams = useMemo(() => ({
    ...Object.fromEntries(params.entries()),
    store: storeSlug,
    page: requestPage,
    limit: PAGE_SIZE,
    ...(requestPage === 1 ? { includeFacets: 'true' } : {}),
    ...(requestPage > 1 ? { silent: true } : {}),
  }), [params, requestPage, storeSlug]);
  const { data: categories = [] } = useGetCategoriesQuery({ store: storeSlug });
  const { data: banners = [] } = useGetBannersQuery({ store: storeSlug });
  const { currentData: productData, isLoading, isFetching, error, refetch } = useGetProductsQuery(requestParams);

  useEffect(() => {
    setPage(1);
    setCatalogState({ key: requestKey, items: [], total: 0, totalPages: 1, facets: null });
  }, [requestKey]);

  useEffect(() => {
    if (!productData) return;
    const nextItems = normalizeProducts(Array.isArray(productData) ? productData : productData.items || []);
    const responsePage = Number(productData.page || requestPage);
    setCatalogState((current) => {
      const starting = responsePage === 1 || current.key !== requestKey;
      const merged = starting ? nextItems : mergeProducts(current.items, nextItems);
      return {
        key: requestKey,
        items: merged,
        total: Array.isArray(productData) ? merged.length : Number(productData.total || 0),
        totalPages: Array.isArray(productData) ? 1 : Number(productData.totalPages || 1),
        facets: productData.facets || (starting ? null : current.facets),
      };
    });
  }, [productData, requestKey, requestPage]);

  const catalog = useMemo(
    () => (catalogState.key === requestKey ? catalogState.items : []),
    [catalogState.items, catalogState.key, requestKey],
  );
  const totalProducts = catalogState.key === requestKey ? catalogState.total : 0;
  const totalPages = catalogState.key === requestKey ? catalogState.totalPages : 1;
  const loading = page === 1 && !catalog.length && (isLoading || isFetching || catalogState.key !== requestKey);
  const loadingMore = page > 1 && isFetching;
  const hasMore = page < totalPages && catalog.length < totalProducts;
  useEffect(() => {
    let active = true;
    api.get(`/catalog-configuration${storeSlug ? `?store=${encodeURIComponent(storeSlug)}` : ''}`, { cacheFirst: true }).then((value) => { if (active) setCatalogStructure(value); }).catch(() => { if (active) setCatalogStructure(null); });
    return () => { active = false; };
  }, [storeSlug]);
  const fallbackDynamicFacets = useMemo(() => buildDynamicFacets(catalogStructure, catalog), [catalog, catalogStructure]);
  const fallbackFacets = useMemo(() => buildCatalogFacets(catalog, categories, filters), [catalog, categories, filters]);
  const facets = useMemo(() => normalizeServerFacets(catalogState.facets, categories) || fallbackFacets, [catalogState.facets, categories, fallbackFacets]);
  const dynamicFacets = catalogState.facets?.dynamicFacets || fallbackDynamicFacets;
  const visibleProducts = catalog;
  const collectionLabel = useMemo(() => getCollectionLabel(routeQuery, filters), [routeQuery, filters]);
  const categorySeo = useMemo(() => {
    const selected = splitFilterValues(filters.category);
    if (selected.length !== 1) return null;
    const category = categories.find(item => selected.includes(String(item._id)) || selected.includes(item.slug) || selected.includes(item.name));
    if (!category) return null;
    return {
      title: category.metaTitle || category.name,
      description: category.metaDescription || category.description || '',
      image: category.socialImage || category.image || '',
    };
  }, [categories, filters.category]);

  useLayoutEffect(() => {
    dispatch(replaceCatalogFilters(normalizeCatalogQuery(routeQuery)));
  }, [dispatch, routeQuery]);

  useEffect(() => {
    if (filters.search) trackEvent('SEARCH', { searchQuery: filters.search });
  }, [filters.search]);

  useEffect(() => {
    const nodes = [desktopLoadMoreRef.current, mobileLoadMoreRef.current].filter(Boolean);
    if (!nodes.length || !hasMore || loadingMore || error) return undefined;
    if (!('IntersectionObserver' in window)) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setPage((current) => Math.min(totalPages, current + 1));
    }, { rootMargin: '500px 0px' });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [error, hasMore, loadingMore, totalPages]);

  useEffect(() => {
    if (loading || !catalog.length || restoredScrollKey.current === requestKey) return;
    restoredScrollKey.current = requestKey;
    try {
      const saved = JSON.parse(sessionStorage.getItem(CATALOG_RETURN_KEY) || 'null');
      if (saved?.route === route && Number(saved.scrollY) >= 0) {
        requestAnimationFrame(() => window.scrollTo({ top: Number(saved.scrollY), behavior: 'auto' }));
      }
    } catch { /* Ignore unavailable session storage. */ }
  }, [catalog.length, loading, requestKey, route]);

  const rememberCatalogPosition = useCallback(() => {
    try { sessionStorage.setItem(CATALOG_RETURN_KEY, JSON.stringify({ route, scrollY: window.scrollY, savedAt: Date.now() })); } catch { /* Ignore unavailable session storage. */ }
  }, [route]);

  const syncCatalogRoute = (nextFilters) => {
    const nextParams = createCatalogSearchParams(nextFilters);
    const collection = routeQuery.get('collection');
    if (collection) nextParams.set('collection', collection);
    navigate(`${basePath}${nextParams.toString() ? `?${nextParams}` : ''}`);
  };

  const updateParams = (values) => {
    const nextFilters = normalizeCatalogQuery({ ...filters, ...values });
    dispatch(replaceCatalogFilters(nextFilters));
    syncCatalogRoute(nextFilters);
    Object.entries(values).forEach(([key, value]) => {
      if (key !== 'search' && value) trackEvent('FILTER_USED', { metadata: { key, value: String(value).slice(0, 80) } });
    });
  };

  const updateParam = (key, value) => updateParams({ [key]: value });

  const clearFilterParams = () => {
    const nextFilters = {
      ...clearCatalogFilters(filters),
      ...getPinnedCollectionFilters(routeQuery),
    };
    dispatch(replaceCatalogFilters(nextFilters));
    syncCatalogRoute(nextFilters);
  };

  const applyDraftFilters = (draft) => {
    const nextFilters = normalizeCatalogQuery({
      ...filters,
      ...draft,
      ...getPinnedCollectionFilters(routeQuery),
    });
    dispatch(replaceCatalogFilters(nextFilters));
    syncCatalogRoute(nextFilters);
  };

  const appliedMobileFilters = useMemo(() => buildMobileFilterChips(filters, categories, dynamicFacets), [categories, dynamicFacets, filters]);
  const showCatalogBanner = !filters.search && !appliedMobileFilters.length && page === 1;

  return (
    <section className="min-h-screen bg-ivory px-3 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-3 md:p-0 lg:bg-white">
      <SeoHead route={route} page={categorySeo || undefined} />
      <div className="mx-auto my-3 max-w-[1500px]"><RentalStorefrontLink className="rental-button" navigate={navigate}>Plan dates, rent an outfit or jewellery →</RentalStorefrontLink></div><nav className="rental-mode-tabs mx-auto my-3 max-w-[1500px]" aria-label="Shop by purchase mode">{[['', 'All'], ['buy', 'Buy'], ['rent', 'Rent']].map(([value, label]) => <button type="button" key={label} aria-pressed={(filters.mode || '') === value} className={(filters.mode || '') === value ? 'is-selected' : ''} onClick={() => updateParam('mode', value)}>{label}</button>)}</nav>
      {showCatalogBanner && <StorefrontBannerSlot banners={banners} position="Category - Featured" navigate={navigate} compact className="max-w-[1500px] px-0 md:px-6" />}
      {(
        <DesktopNewArrivalsLayout
          navigate={navigate}
          storeSlug={storeSlug}
          route={route}
          routeQuery={routeQuery}
          collectionLabel={collectionLabel}
          loading={loading}
          error={error}
          onRetry={refetch}
          visibleProducts={visibleProducts}
          totalProducts={totalProducts}
          categories={categories}
          filters={filters}
          updateParam={updateParam}
          updateParams={updateParams}
          clearFilterParams={clearFilterParams}
          allProducts={catalog}
          dynamicFacets={dynamicFacets}
          facets={facets}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onLoadMore={() => setPage((current) => Math.min(totalPages, current + 1))}
          loadMoreRef={desktopLoadMoreRef}
          onBeforeProductOpen={rememberCatalogPosition}
        />
      )}
      <div className="sticky top-14 z-30 -mx-3 mb-3 border-b border-slate-100 bg-white/95 px-3 pb-3 pt-2 backdrop-blur lg:hidden">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[13px] font-bold text-charcoal">{collectionLabel}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">{loading ? 'Loading styles…' : `${totalProducts} styles available`}</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="sc-field-shell flex h-9 items-center gap-1 rounded-full border border-theme-border bg-white px-3 text-[11px] font-medium text-slate-600 shadow-sm">
            <span>Sort</span>
            <select value={filters.sort} onChange={(event) => updateParam('sort', event.target.value)} className="appearance-none bg-transparent pr-1 text-[11px] font-semibold text-charcoal outline-none">
              <option value="newest">Latest</option>
              <option value="bestSeller">Popular</option>
              <option value="priceLowHigh">Low-High</option>
              <option value="priceHighLow">High-Low</option>
              <option value="discount">Discount</option>
              <option value="rating">Rating</option>
            </select>
          </label>
          <button type="button" onClick={() => setOpenFilters(true)} className="flex h-9 items-center gap-1 rounded-full border border-theme-border bg-white px-3 text-[11px] font-semibold text-charcoal shadow-sm">
            <Icon name="filter" className="h-3.5 w-3.5" /> Filter{appliedMobileFilters.length ? ` (${appliedMobileFilters.length})` : ''}
          </button>
        </div>
      </div>
      <div className="hide-scrollbar mt-3 flex gap-2 overflow-x-auto lg:hidden">
        <button
          type="button"
          onClick={() => {
            const preservedFilters = { ...filters, category: '' };
            dispatch(replaceCatalogFilters(preservedFilters));
            syncCatalogRoute(preservedFilters);
          }}
          className={`min-w-max rounded-full px-3 py-1.5 text-[11px] font-semibold shadow-sm ${!filters.category ? 'bg-wine text-white' : 'bg-white text-charcoal'}`}
        >
          All
        </button>
        {categories.map((category) => {
          const categoryValue = category._id || category.id || category.slug || category.name;
          const active = splitFilterValues(filters.category).includes(String(categoryValue));
          return (
            <button
              key={categoryValue}
              onClick={() => updateParam('category', toggleFilterValue(filters.category, categoryValue))}
              className={`min-w-max rounded-full px-3 py-1.5 text-[11px] font-semibold shadow-sm ${active ? 'bg-wine text-white' : 'bg-white text-charcoal'}`}
            >
              {category.name}
            </button>
          );
        })}
      </div>
      {appliedMobileFilters.length ? <div className="hide-scrollbar mt-2 flex gap-2 overflow-x-auto" aria-label="Applied filters">{appliedMobileFilters.map((item) => <button key={`${item.key}-${item.value}`} type="button" onClick={() => removeMobileFilter(item, filters, updateParams)} className="inline-flex min-w-max items-center gap-1 rounded-full bg-blush px-3 py-1.5 text-[10px] font-bold text-wine" aria-label={`Remove ${item.label} filter`}>{item.label}<span aria-hidden="true">×</span></button>)}</div> : null}
      </div>
      <div className="lg:hidden">
        {error && page === 1 && !catalog.length ? <div className="rounded-2xl bg-white p-8 text-center font-bold text-rose"><p>Store data service is temporarily unavailable.</p><button type="button" className="mt-4 h-11 rounded-xl bg-wine px-5 text-sm font-black text-white" onClick={refetch}>Try again</button></div> : loading ? <StorefrontSkeleton hero={false} /> : <ProductGrid products={visibleProducts} navigate={navigate} onBeforeProductOpen={rememberCatalogPosition} priorityCount={4} />}
        {error && page === 1 && catalog.length > 0 && <div role="status" className="mt-4 rounded-xl bg-amber-50 p-4 text-sm"><p>The collection could not be refreshed. Showing the last loaded products.</p><button type="button" className="mt-2 min-h-11 font-bold text-wine" onClick={refetch}>Try again</button></div>}
        {!loading && !error && <CatalogLoadMore ref={mobileLoadMoreRef} hasMore={hasMore} loading={loadingMore} shown={catalog.length} total={totalProducts} onLoadMore={() => setPage((current) => Math.min(totalPages, current + 1))} />}
        {error && page > 1 ? <div className="mt-5 rounded-xl bg-red-50 p-4 text-center text-xs font-semibold text-red-700"><p>More products could not be loaded.</p><button type="button" onClick={refetch} className="mt-2 rounded-lg bg-white px-4 py-2 text-wine">Try again</button></div> : null}
      </div>
      <MobileFilterSheet
        open={openFilters}
        onClose={() => setOpenFilters(false)}
        categories={categories}
        params={params}
        updateParam={updateParam}
        clearFilters={clearFilterParams}
        applyDraftFilters={applyDraftFilters}
        dynamicFacets={dynamicFacets}
        facets={facets}
        totalResults={totalProducts}
      />
    </section>
  );
}

function buildDynamicFacets(structure, products) {
  const configured = new Set((structure?.filters || []).filter((item) => item.enabled !== false).map((item) => item.key));
  const definitions = new Map((structure?.attributes || []).map((attribute) => [attribute.key, attribute]));
  (structure?.categoryDefinitions || []).forEach((category) => (category.attributes || []).forEach((attribute) => {
    if (typeof attribute === 'object' && attribute.key) definitions.set(attribute.key, { ...(definitions.get(attribute.key) || {}), ...attribute });
  }));
  return Array.from(definitions.values()).filter((attribute) => attribute.filterable && (configured.has(attribute.key) || (structure?.categoryDefinitions || []).some((category) => (category.filters || []).includes(attribute.key))) && !['size', 'colour', 'color', 'fabric', 'occasion'].includes(attribute.key)).map((attribute) => {
    const counts = new Map();
    products.forEach((product) => {
      const source = product.attributeValues || {};
      const raw = source[attribute.key];
      (Array.isArray(raw) ? raw : String(raw || '').split(',')).map((value) => String(value || '').trim()).filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
    });
    const configuredOptions = attribute.options || [];
    const values = configuredOptions.length ? configuredOptions : Array.from(counts.keys()).sort((a, b) => a.localeCompare(b));
    return { key: attribute.key, label: attribute.label, type: attribute.type, options: values.map((value) => ({ value, label: value, count: counts.get(value) || 0 })) };
  }).filter((facet) => facet.options.some((option) => option.count > 0));
}

function getCollectionLabel(routeQuery, filters) {
  const collection = String(routeQuery.get('collection') || '').toLowerCase();
  if (collection === 'best-sellers' || filters.bestSeller === 'true') return 'Best Sellers';
  if (collection === 'new-arrivals' || filters.newArrival === 'true') return 'New Arrivals';
  if (collection === 'trending-now' || filters.trending === 'true') return 'Trending Now';
  if (collection === 'featured' || filters.featured === 'true') return 'Featured Products';
  if (filters.search) return 'Search Results';
  return 'Products';
}

function getPinnedCollectionFilters(routeQuery) {
  const collection = String(routeQuery.get('collection') || '').toLowerCase();
  return {
    featured: collection === 'featured' ? 'true' : '',
    newArrival: collection === 'new-arrivals' ? 'true' : '',
    bestSeller: collection === 'best-sellers' ? 'true' : '',
    trending: collection === 'trending-now' ? 'true' : '',
  };
}

function mergeProducts(current, incoming) {
  const byId = new Map();
  [...current, ...incoming].forEach((product) => {
    const key = String(product?._id || product?.id || product?.slug || '');
    if (key) byId.set(key, product);
  });
  return Array.from(byId.values());
}

function normalizeServerFacets(serverFacets, categories) {
  if (!serverFacets) return null;
  const categoryCounts = new Map((serverFacets.categories || []).map((item) => [String(item.value), Number(item.count || 0)]));
  return {
    ...serverFacets,
    categories: (categories || []).map((category) => {
      const value = String(category._id || category.id || category.slug || category.name || '');
      return { value, label: category.name || category.title || 'Category', count: categoryCounts.get(value) || 0 };
    }).filter((item) => item.value),
  };
}

function buildMobileFilterChips(filters, categories, dynamicFacets) {
  const categoryLabels = new Map((categories || []).flatMap((category) => {
    const label = category.name || category.title || 'Category';
    return [category._id, category.id, category.slug, category.name].filter(Boolean).map((value) => [String(value).toLowerCase(), label]);
  }));
  const dynamicLabels = new Map((dynamicFacets || []).map((facet) => [`attr_${facet.key}`, facet.label]));
  const chips = [];
  const multi = ['category', 'size', 'color', 'fabric', 'occasion', ...dynamicLabels.keys()];
  multi.forEach((key) => splitFilterValues(filters[key]).forEach((value) => chips.push({
    key,
    value,
    label: key === 'category' ? categoryLabels.get(String(value).toLowerCase()) || value : `${dynamicLabels.get(key) ? `${dynamicLabels.get(key)}: ` : ''}${value}`,
  })));
  if (filters.search) chips.push({ key: 'search', value: filters.search, label: `“${filters.search}”` });
  if (filters.minPrice || filters.maxPrice) chips.push({ key: 'price', value: '', label: `₹${filters.minPrice || '0'}–₹${filters.maxPrice || 'Any'}` });
  if (filters.discount) chips.push({ key: 'discount', value: filters.discount, label: `${filters.discount}%+ off` });
  if (filters.rating) chips.push({ key: 'rating', value: filters.rating, label: `${filters.rating}★ & above` });
  if (filters.stock) chips.push({ key: 'stock', value: filters.stock, label: filters.stock === 'in' ? 'In stock' : 'Out of stock' });
  if (filters.featured === 'true') chips.push({ key: 'featured', value: 'true', label: 'Featured' });
  if (filters.newArrival === 'true') chips.push({ key: 'newArrival', value: 'true', label: 'New arrivals' });
  if (filters.bestSeller === 'true') chips.push({ key: 'bestSeller', value: 'true', label: 'Best sellers' });
  if (filters.trending === 'true') chips.push({ key: 'trending', value: 'true', label: 'Trending' });
  return chips;
}

function removeMobileFilter(item, filters, updateParams) {
  if (item.key === 'price') { updateParams({ minPrice: '', maxPrice: '' }); return; }
  if (['category', 'size', 'color', 'fabric', 'occasion'].includes(item.key) || item.key.startsWith('attr_')) {
    updateParams({ [item.key]: toggleFilterValue(filters[item.key], item.value) });
    return;
  }
  updateParams({ [item.key]: '' });
}

const CatalogLoadMore = forwardRef(function CatalogLoadMore({ hasMore, loading, shown, total, onLoadMore }, ref) {
  if (!total) return null;
  return <div ref={ref} className="py-6 text-center" aria-live="polite">
    <p className="text-[11px] font-semibold text-slate-500">Showing {shown} of {total} styles</p>
    {hasMore ? <button type="button" disabled={loading} onClick={onLoadMore} className="mt-3 min-h-11 rounded-xl border border-[#e5d7dc] bg-white px-6 text-xs font-bold text-wine disabled:opacity-50">{loading ? 'Loading more…' : 'Load more'}</button> : <p className="mt-2 text-[10px] uppercase tracking-[.12em] text-slate-400">You have seen every style</p>}
  </div>;
});
