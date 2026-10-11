import ProductListingPage from '../../components/products/ProductListingPage';

export default function DesktopNewArrivalsLayout({
  navigate,
  shoppingMode,
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
  const title = collectionLabel || 'Products';
  const subtitle = loading ? 'Loading…' : `${totalProducts} products`;

  return (
    <ProductListingPage
      navigate={navigate}
      shoppingMode={shoppingMode}
      title={title}
      subtitle={subtitle}
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
