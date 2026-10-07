import { useMemo } from 'react';
import ProductCard from './ProductCard';
import ProductFilterSidebar from './ProductFilterSidebar';
import { buildCatalogFacets } from '../../utils/catalogFacets';
import './ProductListingPage.css';

export default function ProductListingPage({
  navigate,
  title,
  subtitle,
  breadcrumbs = [],
  products = [],
  categories = [],
  filters,
  sortValue,
  onSortChange,
  onFilterChange,
  onFiltersChange,
  onClearFilters,
  allProducts = [],
  loading = false,
  error,
  onRetry,
  dynamicFacets = [],
  facetsOverride,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  loadMoreRef,
  totalProducts = 0,
  onBeforeProductOpen,
}) {
  const facetProducts = allProducts.length ? allProducts : products;
  const derivedFacets = useMemo(
    () => buildCatalogFacets(facetProducts, categories, filters),
    [facetProducts, categories, filters],
  );
  const facets = facetsOverride || derivedFacets;

  return (
    <section className="sc-plp">
      <div className="sc-plp__shell">
        <div className="sc-plp__panel">
          <div className="sc-plp__breadcrumb" aria-label="Breadcrumb">
            {breadcrumbs.map((item, index) => (
              <span key={item.label} className="flex items-center gap-2">
                <button type="button" className={item.active ? 'is-active' : ''} disabled={item.active} aria-current={item.active ? 'page' : undefined} onClick={() => navigate(item.path)}>
                  {item.label}
                </button>
                {index < breadcrumbs.length - 1 ? <span className="text-[#cdb7a5]">/</span> : null}
              </span>
            ))}
          </div>

          <div className="sc-plp__header">
            <div className="min-w-0">
              <h1 className="sc-plp__title">{title}</h1>
              <p className="sc-plp__subtitle">{subtitle}</p>
            </div>
            <div className="sc-plp__sort">
              <label htmlFor="sc-plp-sort">Sort by</label>
              <select id="sc-plp-sort" value={sortValue} onChange={(event) => onSortChange?.(event.target.value)}>
                <option value="newest">Latest arrivals</option>
                <option value="bestSeller">Popularity</option>
                <option value="priceLowHigh">Price: Low to High</option>
                <option value="priceHighLow">Price: High to Low</option>
                <option value="discount">Better Discount</option>
                <option value="rating">Customer Rating</option>
              </select>
            </div>
          </div>

          <div className="sc-plp__divider" aria-hidden="true" />

          <div className="sc-plp__content">
            <ProductFilterSidebar
              facets={facets}
              filters={filters}
              onFilterChange={onFilterChange}
              onFiltersChange={onFiltersChange}
              onClearAll={onClearFilters}
              dynamicFacets={dynamicFacets}
            />

            <div className="sc-plp__grid">
              {error && !products.length ? <div className="col-span-full rounded-2xl bg-white p-8 text-center" role="alert"><p>Store data service is temporarily unavailable.</p><button type="button" onClick={onRetry} className="mt-4 rounded-xl bg-wine px-5 py-3 text-sm font-bold text-white">Try again</button></div>
                : loading ? Array.from({ length: 8 }, (_, index) => <ProductSkeleton key={index} />)
                : products.length ? products.map((product, index) => (
                <ProductCard key={product.id || product._id || product.slug} product={product} navigate={navigate} onBeforeOpen={onBeforeProductOpen} imagePriority={index < 4} />
              )) : (
                <div className="col-span-full rounded-2xl border border-theme-border bg-white p-8 text-center text-sm font-semibold text-[#6f625c]">
                  <p>No products match these filters.</p>
                  <button type="button" onClick={onClearFilters} className="mt-4 min-h-11 rounded-lg border border-wine px-5 font-bold text-wine">Clear filters</button>
                </div>
              )}
              {!loading && products.length ? <div ref={loadMoreRef} className="col-span-full py-5 text-center" aria-live="polite"><p className="text-xs text-slate-500">Showing {products.length} of {totalProducts} styles</p>{hasMore ? <button type="button" disabled={loadingMore} onClick={onLoadMore} className="mt-3 min-h-11 rounded-lg border border-wine bg-white px-6 text-xs font-bold text-wine disabled:opacity-50">{loadingMore ? 'Loading more…' : 'Load more styles'}</button> : <p className="mt-2 text-[10px] uppercase tracking-[.12em] text-slate-400">Every style is shown</p>}{error ? <button type="button" onClick={onRetry} className="ml-3 mt-3 min-h-11 rounded-lg bg-wine px-6 text-xs font-bold text-white">Retry</button> : null}</div> : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProductSkeleton() {
  return <div className="overflow-hidden rounded-lg border border-slate-100 bg-white" role="status" aria-label="Loading product">
    <div className="aspect-[4/5] animate-pulse bg-slate-100" />
    <div className="space-y-2 p-3"><span className="block h-3 w-4/5 animate-pulse rounded bg-slate-100" /><span className="block h-3 w-2/5 animate-pulse rounded bg-slate-100" /><span className="block h-9 w-full animate-pulse rounded bg-slate-100" /></div>
  </div>;
}
