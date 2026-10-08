import { generateSku, generateSlug } from './productAssistant';
import { normalizeImageEntries } from '../services/normalize';

// Defaults match the existing Add Product form flags and inventory behavior.
const QUICK_ADD_DEFAULTS = {
  brand: 'Jassi General Store',
  slug: '',
  shortDescription: '',
  description: '',
  subCategory: '',
  videos: [],
  lowStockAlert: 5,
  tags: [],
  fabric: '',
  occasion: '',
  highlights: [],
  careInstructions: '',
  returnPolicy: '',
  metaTitle: '',
  metaDescription: '',
  metaKeywords: '',
  isFeatured: false,
  isNewArrival: false,
  isBestSeller: false,
  showOnHomepage: false,
  showInTrending: false,
  showInFestive: false,
  isActive: true,
  trackVariants: false,
  variants: [],
  sizes: [],
  colors: [],
};

export function emptyQuickAddForm() {
  return {
    images: [],
    name: '',
    category: '',
    categoryName: '',
    price: '',
    stock: '',
    originalPrice: '',
    brand: QUICK_ADD_DEFAULTS.brand,
    subCategory: '',
    sizes: '',
    colors: '',
    fabric: '',
    occasion: '',
    tags: '',
    shortDescription: '',
    description: '',
  };
}

export function suggestProductName(images = [], fallback = '') {
  const file = images.find((image) => image?.originalName || image?.name);
  const raw = String(file?.originalName || file?.name || '');
  const stem = raw
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (stem.length >= 3 && !/^(img|dsc|dscn|photo|image|screenshot|whatsapp|copy|untitled)(\s*\d+)*$/i.test(stem)) {
    return stem.replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
  return String(fallback || '').trim();
}

function clip(value, max) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function joinList(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => clip(item, 40))
    .filter(Boolean)
    .slice(0, 8)
    .join(', ');
}

export function matchSuggestionCategory(categories = [], suggestion = {}) {
  if (suggestion.categoryId && categories.some((item) => String(item._id) === String(suggestion.categoryId))) {
    return categories.find((item) => String(item._id) === String(suggestion.categoryId)) || null;
  }
  const needle = clip(suggestion.categoryName, 80).toLowerCase();
  if (!needle) return null;
  return categories.find((item) => clip(item.name, 80).toLowerCase() === needle)
    || categories.find((item) => {
      const name = clip(item.name, 80).toLowerCase();
      return name.length >= 4 && (needle.includes(name) || name.includes(needle));
    })
    || null;
}

export function applyVisionSuggestion(form, suggestion = {}, locks = {}, categories = []) {
  if (!suggestion || typeof suggestion !== 'object') return form;
  const next = { ...form };
  const matched = matchSuggestionCategory(categories, suggestion);
  if (!locks.name && suggestion.name) next.name = clip(suggestion.name, 120);
  if (!locks.category && matched?._id) {
    next.category = String(matched._id);
    next.categoryName = clip(matched.name, 80);
  }
  const categoryCompatible = !matched || String(next.category) === String(matched._id);
  if (categoryCompatible && !String(next.subCategory || '').trim() && suggestion.subCategory) {
    next.subCategory = clip(suggestion.subCategory, 80);
  }
  if (!locks.copy) {
    if (suggestion.shortDescription) next.shortDescription = clip(suggestion.shortDescription, 200);
    if (suggestion.description) next.description = clip(suggestion.description, 800);
  }
  if (!String(next.fabric || '').trim() && suggestion.fabric) next.fabric = clip(suggestion.fabric, 80);
  if (!String(next.occasion || '').trim() && suggestion.occasion) next.occasion = clip(suggestion.occasion, 80);
  if (!String(next.colors || '').trim() && suggestion.colors?.length) next.colors = joinList(suggestion.colors);
  if (!locks.copy && suggestion.tags?.length) next.tags = joinList(suggestion.tags);
  else if (!String(next.tags || '').trim() && suggestion.tags?.length) next.tags = joinList(suggestion.tags);
  for (const key of ['highlights', 'careInstructions', 'metaTitle', 'metaDescription', 'metaKeywords']) {
    if (!String(next[key] || '').trim() && suggestion[key]) next[key] = Array.isArray(suggestion[key]) ? suggestion[key].join(', ') : suggestion[key];
  }
  next.attributeValues = { ...next.attributeValues };
  if (categoryCompatible) for (const [key, value] of Object.entries(suggestion.attributeValues || {})) if (!String(next.attributeValues[key] || '').trim()) next.attributeValues[key] = value;
  if (!next.metaTitle && next.name) next.metaTitle = next.name.slice(0, 60);
  if (!next.metaDescription) next.metaDescription = (next.shortDescription || next.description || '').slice(0, 160);
  if (!next.metaKeywords) next.metaKeywords = next.tags || '';
  if (suggestion.sizingMode === 'free-size' && !next.sizes) next.sizingMode = 'free-size';
  return next;
}

export function suggestListingCopy({ name = '', categoryName = '' } = {}) {
  const title = String(name || '').trim();
  const category = String(categoryName || '').trim();
  if (!title && !category) {
    return { shortDescription: '', description: '', tags: '' };
  }
  const shortDescription = [title, category].filter(Boolean).join(' · ');
  const description = category
    ? `${title || 'This product'} is listed in ${category}.`
    : `${title}.`;
  return {
    shortDescription,
    description,
    tags: category.toLowerCase(),
  };
}

export function validateQuickAdd(form) {
  const errors = {};
  if (String(form.name || '').trim().length < 3) errors.name = 'Product name must be at least 3 characters.';
  if (!form.category) errors.category = 'Category is required.';
  if (!Number(form.price)) errors.price = 'Selling price is required.';
  if (Number(form.price) < 0) errors.price = 'Selling price cannot be negative.';
  if (form.originalPrice !== '' && form.originalPrice != null && Number(form.originalPrice) > 0 && Number(form.price) > Number(form.originalPrice)) {
    errors.price = 'Selling price cannot exceed original price.';
  }
  if (form.stock === '' || form.stock == null) errors.stock = 'Stock is required.';
  else if (!Number.isFinite(Number(form.stock))) errors.stock = 'Stock must be a number.';
  else if (Number(form.stock) < 0) errors.stock = 'Stock cannot be negative.';
  if (!Array.isArray(form.images) || !form.images.length) errors.images = 'Upload at least one product image.';
  return errors;
}

export function makeQuickAddSku({ categoryName = '', name = '' } = {}) {
  const base = generateSku({ categoryName: categoryName || name || 'PRD' });
  const unique = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`.toUpperCase();
  return `${base}-${unique}`;
}

function splitList(value) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function prepareImages(images) {
  const normalized = normalizeImageEntries(images);
  if (!normalized.length) return [];
  if (!normalized.some((image) => image.primary)) {
    normalized[0] = { ...normalized[0], primary: true };
  }
  return normalized.map((image) => ({
    url: image.url,
    publicId: image.publicId,
      ...(image.background ? { background: image.background } : {}),
    primary: Boolean(image.primary),
  }));
}

// Quick Add uses the existing createProduct flow.
// Do not introduce a separate product creation endpoint here.
export function buildQuickAddPayload(form) {
  const price = Number(form.price);
  const originalPrice = Number(form.originalPrice || form.price);
  const name = String(form.name || '').trim();
  const categoryName = String(form.categoryName || '').trim();

  return {
    ...QUICK_ADD_DEFAULTS,
    name,
    slug: generateSlug(name),
    sku: makeQuickAddSku({ categoryName, name }),
    brand: String(form.brand || QUICK_ADD_DEFAULTS.brand).trim() || QUICK_ADD_DEFAULTS.brand,
    category: form.category,
    subCategory: String(form.subCategory || '').trim(),
    price,
    originalPrice,
    discountPercentage: originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0,
    stock: Number(form.stock),
    images: prepareImages(form.images),
    sizes: splitList(form.sizes),
    colors: splitList(form.colors),
    fabric: String(form.fabric || '').trim(),
    occasion: String(form.occasion || '').trim(),
    tags: splitList(form.tags),
    shortDescription: String(form.shortDescription || '').trim(),
    description: String(form.description || '').trim(),
    highlights: splitList(form.highlights),
    careInstructions: String(form.careInstructions || '').trim(),
    metaTitle: String(form.metaTitle || '').trim(),
    metaDescription: String(form.metaDescription || '').trim(),
    metaKeywords: String(form.metaKeywords || '').trim(),
    attributeValues: form.attributeValues || {},
  };
}
