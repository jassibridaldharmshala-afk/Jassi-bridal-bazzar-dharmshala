import { matchesCatalogFilters, normalizeCatalogQuery } from '../store/catalogSlice';

export const DISCOUNT_FILTERS = [50, 40, 30, 20, 10];
export const RATING_FILTERS = [4, 3, 2];

const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'FREE SIZE'];

export function buildCatalogFacets(products = [], categories = [], filters = {}) {
  const source = Array.isArray(products) ? products.filter(Boolean) : [];
  const normalizedFilters = normalizeCatalogQuery(filters);
  const productsFor = (...ignoredKeys) => source.filter((product) => (
    matchesCatalogFilters(product, normalizedFilters, categories, ignoredKeys)
  ));

  const categoryProducts = productsFor('category');
  const sizeProducts = productsFor('size');
  const colorProducts = productsFor('color');
  const fabricProducts = productsFor('fabric');
  const occasionProducts = productsFor('occasion');
  const priceProducts = productsFor('minPrice', 'maxPrice');
  const discountProducts = productsFor('discount');
  const ratingProducts = productsFor('rating');
  const stockProducts = productsFor('stock');

  return {
    categories: (categories || []).map((category) => ({
      label: category?.name || category?.title || 'Category',
      value: String(category?._id || category?.id || category?.slug || category?.name || ''),
      count: categoryProducts.filter((product) => productMatchesCategory(product, category)).length,
    })).filter((option) => option.value),
    sizes: buildValueOptions(source, sizeProducts, 'size', sortSizes),
    colors: buildValueOptions(source, colorProducts, 'color'),
    fabrics: buildValueOptions(source, fabricProducts, 'fabric'),
    occasions: buildValueOptions(source, occasionProducts, 'occasion'),
    prices: buildPriceBuckets(source, priceProducts),
    discounts: DISCOUNT_FILTERS.map((value) => ({
      value: String(value),
      label: `${value}% and above`,
      count: discountProducts.filter((product) => Number(product?.discountPercentage || 0) >= value).length,
    })),
    ratings: RATING_FILTERS.map((value) => ({
      value: String(value),
      label: `${value}★ & above`,
      count: ratingProducts.filter((product) => Number(product?.rating || 0) >= value).length,
    })),
    availability: [
      {
        value: 'in',
        label: 'In stock',
        count: stockProducts.filter((product) => Number(product?.stock || 0) > 0).length,
      },
      {
        value: 'out',
        label: 'Out of stock',
        count: stockProducts.filter((product) => Number(product?.stock || 0) <= 0).length,
      },
    ],
  };
}

export function getColorSwatch(value) {
  const color = String(value || '').trim().toLowerCase();
  const knownColors = {
    beige: '#e7d6bf',
    black: '#17161a',
    blue: '#2563a9',
    brown: '#795548',
    cream: '#f5eddc',
    gold: '#c49a3a',
    gray: '#8b8b8b',
    grey: '#8b8b8b',
    green: '#4e8356',
    ivory: '#f4efe3',
    lavender: '#aa93d5',
    maroon: '#741d33',
    mustard: '#c89522',
    navy: '#17345d',
    orange: '#dc7428',
    pink: '#ef8eae',
    purple: '#754a9e',
    red: '#cf334e',
    sage: '#91a48b',
    silver: '#b9bec4',
    teal: '#157b78',
    white: '#ffffff',
    wine: '#7d1738',
    yellow: '#e6bc32',
  };

  const matchedName = Object.keys(knownColors).find((name) => color.includes(name));
  return matchedName ? knownColors[matchedName] : '#d9d1ca';
}

function buildValueOptions(allProducts, countProducts, type, sortFn) {
  const values = uniqueValues(allProducts.flatMap((product) => getProductValues(product, type)));
  const options = values.map((value) => ({
    label: value,
    value,
    count: countProducts.filter((product) => hasValue(getProductValues(product, type), value)).length,
  }));

  return options.sort(sortFn || ((a, b) => a.label.localeCompare(b.label)));
}

function getProductValues(product, type) {
  if (type === 'size' || type === 'color') {
    const pluralKey = type === 'size' ? 'sizes' : 'colors';
    return [
      ...(Array.isArray(product?.[pluralKey]) ? product[pluralKey] : []),
      ...(Array.isArray(product?.variants) ? product.variants.map((variant) => variant?.[type]) : []),
    ].filter(Boolean);
  }

  const value = product?.[type];
  const values = (Array.isArray(value) ? value : [value]).filter(Boolean);
  if (type === 'occasion') {
    return values.flatMap((item) => String(item).split(/[,;|]/).map((part) => part.trim()).filter(Boolean));
  }
  return values;
}

function uniqueValues(values) {
  const seen = new Set();
  return values.reduce((result, value) => {
    const displayValue = String(value || '').trim();
    const key = normalizeKey(displayValue);
    if (!key || seen.has(key)) return result;
    seen.add(key);
    result.push(displayValue);
    return result;
  }, []);
}

function hasValue(values, selectedValue) {
  const selected = normalizeKey(selectedValue);
  return values.some((value) => normalizeKey(value) === selected);
}

function sortSizes(a, b) {
  const aIndex = SIZE_ORDER.indexOf(a.label.toUpperCase());
  const bIndex = SIZE_ORDER.indexOf(b.label.toUpperCase());
  if (aIndex !== -1 || bIndex !== -1) {
    return (aIndex === -1 ? SIZE_ORDER.length : aIndex) - (bIndex === -1 ? SIZE_ORDER.length : bIndex);
  }
  return a.label.localeCompare(b.label, undefined, { numeric: true });
}

function productMatchesCategory(product, category) {
  const categoryAliases = [category?._id, category?.id, category?.slug, category?.name]
    .map(normalizeKey)
    .filter(Boolean);
  const productAliases = [product?.categoryId, product?.category, product?.subCategory]
    .map(normalizeKey)
    .filter(Boolean);
  return categoryAliases.some((alias) => productAliases.includes(alias));
}

function buildPriceBuckets(allProducts, countProducts) {
  const prices = allProducts.map((product) => Number(product?.price)).filter((price) => Number.isFinite(price) && price >= 0);
  if (!prices.length) return [];

  const minimum = Math.min(...prices);
  const maximum = Math.max(...prices);
  if (minimum === maximum) {
    return [{
      min: minimum,
      max: maximum,
      value: `${minimum}:${maximum}`,
      label: `₹${formatIndian(minimum)}`,
      count: countProducts.filter((product) => Number(product?.price) === minimum).length,
    }];
  }

  const step = getNiceStep((maximum - minimum + 1) / 4);
  const first = Math.floor(minimum / step) * step;
  const buckets = [];

  for (let from = first; from <= maximum && buckets.length < 6; from += step) {
    const to = Math.min(maximum, from + step - 1);
    buckets.push({
      min: from,
      max: to,
      value: `${from}:${to}`,
      label: `₹${formatIndian(from)} – ₹${formatIndian(to)}`,
      count: countProducts.filter((product) => {
        const price = Number(product?.price);
        return Number.isFinite(price) && price >= from && price <= to;
      }).length,
    });
  }

  return buckets;
}

function getNiceStep(rawStep) {
  const power = 10 ** Math.floor(Math.log10(Math.max(rawStep, 1)));
  const normalized = rawStep / power;
  if (normalized <= 1) return power;
  if (normalized <= 2) return 2 * power;
  if (normalized <= 5) return 5 * power;
  return 10 * power;
}

function formatIndian(value) {
  return Number(value || 0).toLocaleString('en-IN');
}

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase();
}
