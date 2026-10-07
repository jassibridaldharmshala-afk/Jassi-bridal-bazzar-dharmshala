import { getApiBaseUrl } from '../store/apiBaseUrl';

export function normalizeProduct(product) {
  const images = normalizeImageEntries(product.images);
  const videos = normalizeVideoEntries(product.videos);
  const sellingPrice = Number(product.sellingPrice ?? product.price ?? 0);
  const originalPrice = Math.max(sellingPrice, Number(product.originalPrice ?? sellingPrice));
  return {
    ...product,
    images,
    videos,
    id: product._id || product.id,
    category: product.category?.name || product.category || 'Collection',
    categoryId: product.category?._id || product.category,
    rating: product.rating || 0,
    numReviews: product.numReviews || 0,
    colors: product.colors?.length ? product.colors : [],
    originalPrice,
    discountPercentage: originalPrice > sellingPrice ? Math.round((originalPrice - sellingPrice) / originalPrice * 100) : 0,
    primaryImageUrl: getPrimaryImageUrl(images),
    variantGroupId: product.variantGroupId || product.variantGroup?.id || product.variantGroup,
    variantName: product.variantName || '',
    variantColor: product.variantColor || '',
    variantSize: product.variantSize || '',
  };
}

export function normalizeProducts(products = []) {
  return products.map(normalizeProduct);
}

export function normalizeImageUrl(url) {
  if (!url || isKnownMissingImage(url)) return '';

  if (isInaccessibleImageUrl(url) && isRemoteClient()) {
    const uploadsPath = extractUploadsPath(url);
    return uploadsPath ? `${getApiRootUrl()}${uploadsPath}` : '';
  }

  if (url.startsWith('http') || url.startsWith('data:')) return url;

  const apiRoot = getApiRootUrl();
  return `${apiRoot}${url.startsWith('/') ? url : `/${url}`}`;
}

export function isUsableImageUrl(url) {
  if (!url || isKnownMissingImage(url)) return false;
  if (isInaccessibleImageUrl(url) && isRemoteClient()) return false;
  return true;
}

function getApiRootUrl() {
  return getApiBaseUrl().replace(/\/api\/?$/, '');
}

function extractUploadsPath(url = '') {
  const match = String(url).match(/\/uploads\/[^?#\s]+/i);
  return match ? match[0] : '';
}

function isInaccessibleImageUrl(url) {
  return /https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(String(url || ''));
}

function isRemoteClient() {
  if (typeof window === 'undefined') return false;
  return !['localhost', '127.0.0.1'].includes(window.location.hostname);
}

export function normalizeImageEntries(images = []) {
  return (Array.isArray(images) ? images : [])
    .map((image) => {
      if (!image) return null;
      const url = typeof image === 'string' ? image : image.url;
      if (!url) return null;
      return {
        ...(typeof image === 'object' ? image : {}),
        url: normalizeImageUrl(url),
        primary: Boolean(typeof image === 'object' && image.primary),
      };
    })
    .filter((image) => Boolean(image?.url));
}

export function normalizeVideoEntries(videos = []) {
  return (Array.isArray(videos) ? videos : [])
    .map((video) => {
      if (!video) return null;
      const url = typeof video === 'string' ? video : video.url;
      if (!url) return null;
      return {
        ...(typeof video === 'object' ? video : {}), 
        url: normalizeImageUrl(url),
      };
    })
    .filter((video) => Boolean(video?.url));
}

export function getPrimaryImageUrl(images = []) {
  const normalized = normalizeImageEntries(images);
  return normalized.find((image) => image.primary)?.url || normalized[0]?.url || '';
}

export function getPrimaryImageIndex(images = []) {
  const normalized = normalizeImageEntries(images);
  const primaryIndex = normalized.findIndex((image) => image.primary);
  return primaryIndex >= 0 ? primaryIndex : (normalized.length ? 0 : -1);
}

function isKnownMissingImage(url) {
  return /(^|\/)placeholder\.jpe?g($|\?)/i.test(String(url || ''));
}
