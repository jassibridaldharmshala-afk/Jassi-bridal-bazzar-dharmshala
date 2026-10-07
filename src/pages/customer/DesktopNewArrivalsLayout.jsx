import ProductListingPage from '../../components/products/ProductListingPage';
import { storefrontPath } from '../../utils/routing';

export default function DesktopNewArrivalsLayout({
  navigate,
  storeSlug,
  route,
  routeQuery,
  collectionLabel,
  loading,
  error,
  onRetry,
  visibleProducts,
  totalProducts,
  categories,
  filters,
  updateParam,
  updateParams,
  clearFilterParams,
  allProducts,
  dynamicFacets,
  facets,
  hasMore,
  loadingMore,
  onLoadMore,
  loadMoreRef,
  onBeforeProductOpen,
}) {
  const breadcrumbs = buildBreadcrumbs(route, routeQuery, collectionLabel)
    .map((item) => ({ ...item, path: storefrontPath(item.path, storeSlug) }));
  const title = collectionLabel || 'Products';
  const subtitle = loading ? 'Loading styles...' : `${totalProducts} styles available`;

  return (
    <ProductListingPage
      navigate={navigate}
      title={title}
      subtitle={subtitle}
      breadcrumbs={breadcrumbs}
      products={visibleProducts}
      loading={loading}
      error={error}
      onRetry={onRetry}
      categories={categories}
      filters={filters}
      sortValue={filters.sort}
      onSortChange={(value) => updateParam('sort', value)}
      onFilterChange={updateParam}
      onFiltersChange={updateParams}
      onClearFilters={clearFilterParams}
      allProducts={allProducts}
      dynamicFacets={dynamicFacets}
      facetsOverride={facets}
      hasMore={hasMore}
      loadingMore={loadingMore}
      onLoadMore={onLoadMore}
      loadMoreRef={loadMoreRef}
      totalProducts={totalProducts}
      onBeforeProductOpen={onBeforeProductOpen}
    />
  );
}

function buildBreadcrumbs(route, routeQuery, collectionLabel) {
  const routePath = String(route || '').split('?')[0];
  const collection = String(routeQuery?.get('collection') || '').toLowerCase();
  if (routePath === '/search' || routeQuery?.get('search')) {
    return [
      { label: 'Home', path: '/' },
      { label: 'Search', path: '/search', active: false },
      { label: collectionLabel || 'Search Results', path: '/search', active: true },
    ];
  }

  if (collection === 'new-arrivals' || routeQuery?.get('newArrival') === 'true') {
    return [
      { label: 'Home', path: '/' },
      { label: 'New In', path: '/products?newArrival=true', active: false },
      { label: collectionLabel || 'New Arrivals', path: '/products?newArrival=true', active: true },
    ];
  }

  return [
    { label: 'Home', path: '/' },
    { label: 'Products', path: '/products', active: false },
    { label: collectionLabel || 'Products', path: '/products', active: true },
  ];
}
