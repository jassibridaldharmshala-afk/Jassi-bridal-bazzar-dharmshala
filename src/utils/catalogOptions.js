import { sizeAttribute, usesGarmentSizing } from './productSizing';

export function productAttributeDefinitions(structure, categories = [], product = {}) {
  const category = categories.find(item => String(item._id) === String(product.category?._id || product.category));
  let definition = structure?.categoryDefinitions?.find(item => item.key === category?.definitionKey || item.name === category?.name);
  const definitions = new Map((structure?.attributes || []).map(item => [item.key, item]));
  const chain = [], visited = new Set();
  while (definition && !visited.has(definition.key)) {
    visited.add(definition.key); chain.unshift(definition);
    const parentKey = definition.parentKey;
    definition = structure.categoryDefinitions.find(item => item.key === parentKey);
  }
  for (const item of [...chain.flatMap(layer => layer.attributes || []), ...(category?.attributeOverrides || [])]) if (item && typeof item === 'object' && item.key) definitions.set(item.key, { ...definitions.get(item.key), ...item });
  return [...definitions.values()].filter(item => item.active !== false && (usesGarmentSizing(structure, product) || !sizeAttribute(item.key)));
}

export function asCatalogList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

export function uniqueSubcategories(products = []) {
  const seen = new Set();
  return asCatalogList(products)
    .map((product) => String(product?.subCategory || '').trim())
    .filter((value) => {
      const key = value.toLowerCase();
      if (!value || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.localeCompare(b));
}

export async function fetchCategories(api, apiPrefix = '/admin', storeId = '') {
  const storeQuery = apiPrefix === '/admin' && storeId
    ? `&storeId=${encodeURIComponent(storeId)}`
    : '';
  const paths = apiPrefix === '/admin'
    ? [`/admin/categories?admin=true${storeQuery}`]
    : [`${apiPrefix}/categories`];

  for (const path of paths) {
    try {
      const list = asCatalogList(await api.get(path));
      if (list.length) return list;
    } catch {
      // Try the next categories endpoint.
    }
  }
  return [];
}

const subcategoryCache = new Map();

export async function fetchSubcategories(api, categoryId, apiPrefix = '/admin') {
  if (!categoryId) return [];
  const key = `${apiPrefix}:${categoryId}`;
  if (subcategoryCache.has(key)) return subcategoryCache.get(key);
  const path = `${apiPrefix}/products?admin=true&category=${encodeURIComponent(categoryId)}`;
  try {
    const list = uniqueSubcategories(await api.get(path));
    subcategoryCache.set(key, list);
    return list;
  } catch {
    return [];
  }
}
