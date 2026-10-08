import { createSelector, createSlice } from '@reduxjs/toolkit';

const sortOptions = ['newest', 'bestSeller', 'priceLowHigh', 'priceHighLow', 'discount', 'rating'];
export const clearableCatalogFilterKeys = ['mode', 'search', 'category', 'size', 'color', 'fabric', 'occasion', 'discount', 'rating', 'stock', 'minPrice', 'maxPrice', 'featured', 'newArrival', 'bestSeller', 'trending'];

const initialState = {
  mode: '',
  search: '',
  sort: 'newest',
  category: '',
  size: '',
  color: '',
  fabric: '',
  occasion: '',
  discount: '',
  rating: '',
  stock: '',
  minPrice: '',
  maxPrice: '',
  featured: '',
  newArrival: '',
  bestSeller: '',
  trending: '',
};

const catalogSlice = createSlice({
  name: 'catalog',
  initialState,
  reducers: {
    replaceCatalogFilters(_state, action) {
      return normalizeCatalogQuery(action.payload);
    },
  },
});

export const { replaceCatalogFilters } = catalogSlice.actions;
export default catalogSlice.reducer;

export const selectCatalogFilters = (state) => state.catalog;

export const selectVisibleProducts = createSelector(
  [
    selectCatalogFilters,
    (_state, products = []) => products,
    (_state, _products, categories = []) => categories,
  ],
  (filters, products, categories) => sortProducts(
    products.filter((product) => matchesCatalogFilters(product, filters, categories)),
    filters.sort,
  ),
);

export function normalizeCatalogQuery(query = {}) {
  const source = query instanceof URLSearchParams ? Object.fromEntries(query.entries()) : query;
  const normalized = {
    mode: ['buy', 'rent'].includes(source.mode) ? source.mode : '',
    search: normalizeText(source.search),
    sort: normalizeSort(source.sort),
    category: normalizeText(source.category),
    size: normalizeText(source.size),
    color: normalizeText(source.color),
    fabric: normalizeText(source.fabric),
    occasion: normalizeText(source.occasion),
    discount: normalizeNumberValue(source.discount),
    rating: normalizeNumberValue(source.rating),
    stock: normalizeStock(source.stock),
    minPrice: normalizeNumberValue(source.minPrice),
    maxPrice: normalizeNumberValue(source.maxPrice),
    featured: normalizeToggle(source.featured),
    newArrival: normalizeToggle(source.newArrival),
    bestSeller: normalizeToggle(source.bestSeller),
    trending: normalizeToggle(source.trending),
  };
  Object.entries(source).forEach(([key, value]) => {
    if (/^attr_[a-z0-9_]{1,40}$/.test(key)) normalized[key] = normalizeText(value);
  });
  return normalized;
}

export function createCatalogSearchParams(filters = initialState) {
  const normalized = normalizeCatalogQuery(filters);
  const params = new URLSearchParams();

  Object.entries(normalized).forEach(([key, value]) => {
    if (!value || (key === 'sort' && value === initialState.sort)) return;
    params.set(key, value);
  });

  return params;
}

export function setCatalogFilterValue(filters, key, value) {
  return normalizeCatalogQuery({
    ...normalizeCatalogQuery(filters),
    [key]: value,
  });
}

export function clearCatalogFilters(filters) {
  const next = normalizeCatalogQuery(filters);
  clearableCatalogFilterKeys.forEach((key) => {
    next[key] = initialState[key];
  });
  Object.keys(next).filter((key) => key.startsWith('attr_')).forEach((key) => { next[key] = ''; });
  return next;
}

export function matchesCatalogFilters(product, filters, categories, ignoredKeys = []) {
  const ignored = ignoredKeys instanceof Set ? ignoredKeys : new Set(ignoredKeys);
  if (filters.mode === 'buy' && (product.commerceMode === 'RENTAL_ONLY' || product.purchaseEnabled === false)) return false;
  if (filters.mode === 'rent' && !['RENTAL_ONLY', 'SALE_AND_RENTAL'].includes(product.commerceMode)) return false;
  if (!ignored.has('search') && !matchesSearch(product, filters.search)) return false;
  if (!ignored.has('category') && !matchesCategory(product, filters.category, categories)) return false;
  if (!ignored.has('size') && !matchesArrayValue(getProductOptionValues(product, 'size'), filters.size)) return false;
  if (!ignored.has('color') && !matchesArrayValue(getProductOptionValues(product, 'color'), filters.color)) return false;
  if (!ignored.has('fabric') && !matchesTextValue(product.fabric, filters.fabric)) return false;
  if (!ignored.has('occasion') && !matchesDelimitedTextValue(product.occasion, filters.occasion)) return false;
  if (!ignored.has('discount') && !matchesMinimumValue(product.discountPercentage, filters.discount)) return false;
  if (!ignored.has('rating') && !matchesMinimumValue(product.rating, filters.rating)) return false;
  if (!ignored.has('stock') && !matchesStock(product.stock, filters.stock)) return false;
  if (!ignored.has('minPrice') && !matchesMinimumValue(product.price, filters.minPrice)) return false;
  if (!ignored.has('maxPrice') && !matchesMaximumValue(product.price, filters.maxPrice)) return false;
  if (!ignored.has('featured') && filters.featured === 'true' && !product.isFeatured) return false;
  if (!ignored.has('newArrival') && filters.newArrival === 'true' && !product.isNewArrival) return false;
  if (!ignored.has('bestSeller') && filters.bestSeller === 'true' && !product.isBestSeller) return false;
  if (!ignored.has('trending') && filters.trending === 'true' && !product.showInTrending) return false;
  for (const [filterKey, activeValue] of Object.entries(filters)) {
    if (!filterKey.startsWith('attr_') || !activeValue || ignored.has(filterKey)) continue;
    const attributeKey = filterKey.slice(5);
    const source = product.attributeValues instanceof Map ? Object.fromEntries(product.attributeValues) : (product.attributeValues || {});
    if (!matchesDelimitedTextValue(source[attributeKey], activeValue)) return false;
  }
  return true;
}

function matchesSearch(product, search) {
  if (!search) return true;
  const haystack = [
    product.name,
    product.brand,
    getSearchableText(product.category),
    product.fabric,
    product.occasion,
    product.sku,
    product.description,
    ...Object.values(product.attributeValues || {}),
    ...(product.tags || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return String(search)
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => getSearchTermVariants(term).some((variant) => haystack.includes(variant)));
}

function getSearchableText(value) {
  if (!value || typeof value !== 'object') return value;
  return [value.name, value.title, value.slug].filter(Boolean).join(' ');
}

function getSearchTermVariants(term) {
  if (term === 'accessory') return ['accessory', 'accessories'];
  if (term === 'accessories') return ['accessories', 'accessory'];
  return [term];
}

function matchesCategory(product, category, categories) {
  if (!category) return true;
  const productAliases = new Set([
    normalizeKey(product.categoryId),
    normalizeKey(product.category),
    normalizeKey(product.subCategory),
  ].filter(Boolean));

  return splitFilterValues(category).some((selected) => {
    const categoryAliases = resolveCategoryAliases(normalizeKey(selected), categories);
    return Array.from(categoryAliases).some((alias) => productAliases.has(alias));
  });
}

export function splitFilterValues(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function toggleFilterValue(activeValue, value) {
  const nextValue = String(value || '').trim();
  if (!nextValue) return normalizeText(activeValue);
  const selected = splitFilterValues(activeValue);
  const nextKey = normalizeKey(nextValue);
  const exists = selected.some((item) => normalizeKey(item) === nextKey);
  return (exists ? selected.filter((item) => normalizeKey(item) !== nextKey) : [...selected, nextValue]).join(',');
}

function resolveCategoryAliases(value, categories) {
  const aliases = new Set([value]);
  (categories || []).forEach((category) => {
    const categoryValues = [
      normalizeKey(category?._id),
      normalizeKey(category?.id),
      normalizeKey(category?.slug),
      normalizeKey(category?.name),
    ].filter(Boolean);

    if (categoryValues.includes(value)) {
      categoryValues.forEach((item) => aliases.add(item));
    }
  });
  return aliases;
}

function matchesArrayValue(values, activeValue) {
  if (!activeValue) return true;
  const selectedValues = splitFilterValues(activeValue).map(normalizeKey);
  return selectedValues.some((selected) => (
    (values || []).some((value) => normalizeKey(value) === selected)
  ));
}

function matchesTextValue(value, activeValue) {
  if (!activeValue) return true;
  const productValues = Array.isArray(value) ? value : [value];
  const selectedValues = splitFilterValues(activeValue).map(normalizeKey);
  return selectedValues.some((selected) => (
    productValues.some((item) => normalizeKey(item) === selected)
  ));
}

function matchesDelimitedTextValue(value, activeValue) {
  if (!activeValue) return true;
  const productValues = (Array.isArray(value) ? value : [value])
    .flatMap((item) => String(item || '').split(/[,;|]/))
    .map(normalizeKey)
    .filter(Boolean);
  const selectedValues = splitFilterValues(activeValue).map(normalizeKey);
  return selectedValues.some((selected) => productValues.some(value => value.replace(/\s+/g, ' ') === selected.replace(/\s+/g, ' ')));
}

function getProductOptionValues(product, type) {
  const key = type === 'size' ? 'sizes' : 'colors';
  const variantKey = type === 'size' ? 'size' : 'color';
  return [
    ...(Array.isArray(product?.[key]) ? product[key] : []),
    ...(Array.isArray(product?.variants) ? product.variants.map((variant) => variant?.[variantKey]) : []),
  ].filter(Boolean);
}

function matchesMinimumValue(value, minimum) {
  if (isEmptyValue(minimum)) return true;
  return Number(value || 0) >= Number(minimum);
}

function matchesMaximumValue(value, maximum) {
  if (isEmptyValue(maximum)) return true;
  return Number(value || 0) <= Number(maximum);
}

function matchesStock(stock, activeStock) {
  if (!activeStock) return true;
  return activeStock === 'in' ? Number(stock || 0) > 0 : Number(stock || 0) <= 0;
}

function sortProducts(products, sort) {
  const items = [...products];
  if (sort === 'priceLowHigh') return items.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
  if (sort === 'priceHighLow') return items.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
  if (sort === 'discount') return items.sort((a, b) => Number(b.discountPercentage || 0) - Number(a.discountPercentage || 0));
  if (sort === 'rating') return items.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
  if (sort === 'bestSeller') {
    return items.sort((a, b) => (
      Number(Boolean(b.isBestSeller)) - Number(Boolean(a.isBestSeller))
      || Number(b.rating || 0) - Number(a.rating || 0)
      || Number(b.numReviews || 0) - Number(a.numReviews || 0)
    ));
  }
  return items.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

function normalizeSort(value) {
  if (isEmptyValue(value)) return initialState.sort;
  return sortOptions.includes(value) ? value : initialState.sort;
}

function normalizeStock(value) {
  return value === 'in' || value === 'out' ? value : '';
}

function normalizeToggle(value) {
  return value === 'true' ? 'true' : '';
}

function normalizeText(value) {
  return isEmptyValue(value) ? '' : String(value).trim();
}

function normalizeNumberValue(value) {
  return isEmptyValue(value) ? '' : String(value).trim();
}

function normalizeKey(value) {
  return normalizeText(value).toLowerCase();
}

function isEmptyValue(value) {
  return value === undefined || value === null || value === '';
}
