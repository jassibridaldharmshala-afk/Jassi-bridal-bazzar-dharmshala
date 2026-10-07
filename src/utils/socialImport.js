import { getSizeChartValidation } from './productSizing';
export const SOCIAL_IMPORT_RUNNING = ['queued', 'reading', 'media', 'analyzing'];
export const SOCIAL_IMPORT_STATUS = { queued: 'Queued', reading: 'Reading post', media: 'Importing media', analyzing: 'Preparing details', ready: 'Ready to review', failed: 'Needs attention', cancelled: 'Cancelled' };
export function socialUrlError(value) {
  let url;
  try { url = new URL(String(value).trim()); } catch { return 'Paste a complete Instagram or Facebook link starting with https://.'; }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port
    || !['instagram.com', 'www.instagram.com', 'm.instagram.com', 'facebook.com', 'www.facebook.com', 'm.facebook.com', 'web.facebook.com', 'fb.watch'].includes(url.hostname)) return 'Use an Instagram or Facebook post, photo or reel link.';
  return '';
}
export function socialReviewForm(job) {
  const value = job.savedReview || job.suggestion || {};
  const list = (key) => Array.isArray(value[key]) ? value[key].join(', ') : value[key] || '';
  const selected = (job.images || []).filter((image) => image.recommended !== false);
  const primary = selected.find((image) => image.recommendedCover) || selected[0];
  return { name: value.name || '', category: value.category || '', subCategory: value.subCategory || '',
    price: value.price ?? '', originalPrice: value.originalPrice ?? '', stock: job.savedReview ? value.stock ?? '' : '', description: value.description || '',
    shortDescription: value.shortDescription || '', fabric: value.fabric || '', occasion: value.occasion || '',
    colors: list('colors'), sizes: list('sizes'), tags: list('tags'), highlights: list('highlights'), sizingMode: value.sizingMode || 'auto',
    sizeChart: value.sizeChart || { unit: 'in', columns: [], rows: [] }, sizeChartProfile: value.sizeChartProfile || 'auto', attributeValues: value.attributeValues || {}, draftUpdatedAt: value.draftUpdatedAt,
    imageIds: value.imageIds || selected.map((image) => image.id), primaryImageId: value.primaryImageId || primary?.id || '',
    viewTypes: value.viewTypes || Object.fromEntries((job.images || []).map((image) => [image.id, image.viewType || 'unknown'])), includeVideo: value.includeVideo ?? Boolean(job.videos?.length) };
}
export function socialReviewError(form) {
  if (form.name.trim().length < 3) return 'Enter a product name with at least 3 characters.';
  if (!form.imageIds.length) return 'Select at least one product photo.';
  for (const key of ['price', 'originalPrice', 'stock']) if (form[key] !== '') {
    const number = Number(form[key]);
    if (!Number.isFinite(number) || number < 0 || (key === 'stock' && !Number.isInteger(number))) return `Enter a valid ${key === 'stock' ? 'whole-number stock quantity' : key}.`;
  }
  if (form.price !== '' && form.originalPrice !== '' && Number(form.originalPrice) < Number(form.price)) return 'MRP cannot be lower than the selling price.';
  return '';
}

export function importSizingProduct(form, categories = [], structure) {
  return { ...form, category: categories.find((item) => String(item._id) === String(form.category))?.name || '',
    sizes: Array.isArray(form.sizes) ? form.sizes : String(form.sizes || '').split(',').map((size) => size.trim()).filter(Boolean),
    ...(structure?.features?.sizing === false ? { sizingMode: 'free-size', sizeChartProfile: 'free-size' } : {}) };
}

export function socialPublishMissing(form, categories = [], structure) {
  const missing = [];
  if (String(form.name || '').trim().length < 3) missing.push('Product name');
  if (!categories.some((item) => String(item._id) === String(form.category))) missing.push('Category');
  if (!Number.isFinite(Number(form.price)) || Number(form.price) <= 0) missing.push('Selling price');
  if (form.stock === '' || form.stock == null || !Number.isInteger(Number(form.stock)) || Number(form.stock) < 0) missing.push('Stock quantity');
  if (!form.imageIds?.length) missing.push('Product photos');
  const sizing = getSizeChartValidation(importSizingProduct(form, categories, structure));
  if (!sizing.valid) missing.push('Available sizes and measurements');
  for (const item of structure?.attributes || []) if (item.required && !String(form.attributeValues?.[item.key] || '').trim()) missing.push(item.label);
  return missing;
}
