export const SMART_FIELDS = {
  name: 'Product name', sku: 'SKU (generated product code)', category: 'Category', subCategory: 'Subcategory', shortDescription: 'Short description',
  description: 'Description', price: 'Selling price', originalPrice: 'Original price / MRP', colors: 'Colours', fabric: 'Fabric',
  occasion: 'Occasion', tags: 'Tags', highlights: 'Highlights', sizes: 'Available sizes', sizingMode: 'Sizing',
  metaTitle: 'SEO title', metaDescription: 'SEO description', metaKeywords: 'SEO keywords',
};
export const sameValue = (a, b) => JSON.stringify(a ?? '') === JSON.stringify(b ?? '');
const id = value => value?._id || value || '';
const inventoryFields = ['sizes', 'sizingMode', 'colors', 'category', 'subCategory', 'name'];
function generatedProductCode() {
  const suffix = typeof window !== 'undefined' && window.crypto?.getRandomValues
    ? Array.from(window.crypto.getRandomValues(new Uint8Array(6)), byte => byte.toString(16).padStart(2, '0')).join('')
    : Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  // An internal catalog identifier, not an authentication token. The existing
  // product endpoint still checks SKU uniqueness when the user saves.
  return 'SC-' + suffix.toUpperCase();
}
export const fieldValue = (form, key) => key.startsWith('attributeValues.') ? form.attributeValues?.[key.split('.')[1]] : key === 'category' ? id(form.category) : form[key];
const empty = (value, key) => value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)
  || (typeof value === 'string' && !value.trim()) || (key === 'sizingMode' && value === 'auto')
  || (['price', 'sellingPrice', 'originalPrice'].includes(key) && Number(value) === 0);
export const snapshotForm = form => JSON.parse(JSON.stringify(form));

export function smartPhotos(form) {
  return [...new Set([form.image, ...(form.images || []).map(image => typeof image === 'string' ? image : image?.url)].filter(value => typeof value === 'string' && value && !/placeholder/i.test(value)))].slice(0, 12);
}

export function smartRequest(form, notes, imageUrls) {
  const fields = ['name', 'category', 'subCategory', 'fabric', 'colors', 'sizes', 'occasion', 'description', 'attributeValues'];
  return { notes, imageUrls, existing: Object.fromEntries(fields.map(key => [key, key === 'category' ? id(form.category) : form[key]])) };
}

export function suggestionRows(result, baseline, { categories = [], structure, priceField = 'price', seo = true } = {}) {
  const data = { ...result.suggestion };
  delete data.sku;
  if (seo) {
    if (data.name && !baseline.sku) data.sku = generatedProductCode();
    if (data.name) data.metaTitle = data.name.slice(0, 60);
    if (data.shortDescription || data.description) data.metaDescription = (data.shortDescription || data.description).slice(0, 160);
    if (data.tags?.length) data.metaKeywords = data.tags.join(', ');
  }
  const variants = baseline.trackVariants || baseline.variants?.length > 0;
  const rows = [];
  for (const [field, label] of Object.entries(SMART_FIELDS)) {
    if ((!seo && (field.startsWith('meta') || field === 'sku')) || (field === 'sizingMode' && data[field] === 'auto')) continue;
    // Changing option matrices requires deliberate inventory editing.
    if (variants && inventoryFields.includes(field)) continue;
    if (structure?.features?.sizing === false && ['sizes', 'sizingMode'].includes(field)) continue;
    let value = data[field];
    if (empty(value, field)) continue;
    if (field === 'category' && !categories.some(category => String(category._id) === String(value))) continue;
    if (['price', 'originalPrice'].includes(field) && (!result.fieldSources?.[field] || !Number.isFinite(value) || value <= 0)) continue;
    const key = field === 'price' ? priceField : field;
    const before = fieldValue(baseline, key);
    if (Array.isArray(value) && !Array.isArray(before)) value = value.join(', ');
    if (['price', 'originalPrice'].includes(field)) value = String(value);
    if (sameValue(before, value)) continue;
    rows.push({ key, field, label, value, before, empty: empty(before, key), evidence: result.fieldSources?.[field], categoryBefore: id(baseline.category), ...(key === 'category' ? { subCategoryBefore: baseline.subCategory } : {}) });
  }
  for (const attribute of structure?.attributes || []) {
    const value = data.attributeValues?.[attribute.key];
    const key = 'attributeValues.' + attribute.key;
    if (typeof value !== 'string' || !value.trim()) continue;
    const before = fieldValue(baseline, key);
    if (!sameValue(value, before)) rows.push({ key, field: key, label: attribute.label, value, before, empty: empty(before, key), evidence: result.fieldSources?.['attribute.' + attribute.key] });
  }
  return rows;
}

export function selectedSmartPatch(rows, selected, form, replace = false) {
  let patch = rows.filter(row => selected.includes(row.key) && (row.empty || replace) && sameValue(fieldValue(form, row.key), row.before));
  if (form.trackVariants || form.variants?.length) patch = patch.filter(row => !inventoryFields.includes(row.key));
  patch = patch.filter(row => !['subCategory', 'sizes', 'sizingMode'].includes(row.key) || sameValue(id(form.category), row.categoryBefore));
  // Never retain a subcategory from a different parent category.
  const category = patch.find(row => row.key === 'category');
  if (category && !sameValue(form.subCategory, category.subCategoryBefore)) patch = patch.filter(row => !['category', 'subCategory'].includes(row.key));
  else if (category && form.subCategory && !patch.some(row => row.key === 'subCategory')) {
    patch = [...patch, { key: 'subCategory', before: form.subCategory, value: '' }];
  }
  const proposed = applySmartPatch(form, patch);
  const price = Number(proposed.sellingPrice ?? proposed.price);
  const mrp = Number(proposed.originalPrice);
  if (price > 0 && mrp > 0 && mrp < price) patch = patch.filter(row => !['price', 'sellingPrice', 'originalPrice'].includes(row.key));
  return patch;
}

export function applySmartPatch(form, patch, undo = false) {
  const next = { ...form };
  for (const row of patch) {
    if ((form.trackVariants || form.variants?.length) && inventoryFields.includes(row.key)) continue;
    const expected = undo ? row.value : row.before;
    if (!sameValue(fieldValue(next, row.key), expected)) continue;
    const value = undo ? row.before : row.value;
    if (row.key.startsWith('attributeValues.')) next.attributeValues = { ...next.attributeValues, [row.key.split('.')[1]]: value ?? '' };
    else next[row.key] = value ?? '';
  }
  return next;
}

export function displaySmartValue(value, key, categories = []) {
  if (key === 'category') return categories.find(category => String(category._id) === String(id(value)))?.name || String(id(value));
  if (key === 'sizingMode') return value === 'free-size' ? 'No size selection / free size' : value === 'sized' ? 'Selectable sizes' : 'Automatic';
  if (['price', 'sellingPrice', 'originalPrice'].includes(key)) return Number(value) > 0 ? '\u20b9' + Number(value).toLocaleString('en-IN') : 'Not added';
  return Array.isArray(value) ? value.join(', ') : String(value ?? '');
}
