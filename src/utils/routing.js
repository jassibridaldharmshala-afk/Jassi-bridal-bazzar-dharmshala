export const RESERVED_PATHS = new Set([
  'products', 'product', 'category', 'search', 'wishlist', 'cart', 'checkout',
  'login', 'register', 'profile', 'orders', 'order-detail', 'order-success',
  'rentals', 'rental-book',
  'payment-failed', 'contact', 'privacy-policy', 'terms', 'return-policy',
  'shipping-policy', 'cancellation-policy', 'size-guide', 'faqs', 'our-story',
  'returns', 'notifications', 'seller', 'admin', 'master', 'store', 'share', 'api', 'health', 'uploads',
  'robots.txt', 'sitemap.xml', 'website-preview',
]);

export const ROUTE_CHANGE_EVENT = 'samira:routechange';
export const BEFORE_ROUTE_CHANGE_EVENT = 'samira:before-routechange';

export function notifyRouteChange() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(ROUTE_CHANGE_EVENT));
}

export function consumeLegacyHash() {
  if (typeof window === 'undefined') return;
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return;
  const next = hash.startsWith('/') ? hash : `/${hash}`;
  window.history.replaceState(null, '', next);
  notifyRouteChange();
}

function normalizePathname(pathname = '/') {
  const cleaned = String(pathname || '/').replace(/\/{2,}/g, '/');
  return cleaned || '/';
}

export function readAppRoute() {
  consumeLegacyHash();
  const path = normalizePathname(window.location.pathname);
  const search = window.location.search || '';
  return `${path}${search}` || '/';
}

export function pushAppRoute(path) {
  const [rawPath, rawSearch = ''] = String(path || '/').split('?');
  const pathname = normalizePathname(rawPath.startsWith('/') ? rawPath : `/${rawPath}`);
  const next = rawSearch ? `${pathname}?${rawSearch}` : pathname;
  const current = `${normalizePathname(window.location.pathname)}${window.location.search}` || '/';
  if (current === next) return;
  if (!window.dispatchEvent(new CustomEvent(BEFORE_ROUTE_CHANGE_EVENT, { cancelable: true, detail: { current, next } }))) return;
  window.history.pushState(null, '', next);
  notifyRouteChange();
}

export function boutiquePath(routePath = '/') {
  const path = String(routePath).split('?')[0] || '/';
  const parts = path.split('/').filter(Boolean);
  if (!parts.length) return '/';
  if (RESERVED_PATHS.has(parts[0])) return path;
  return `/store/${parts.join('/')}`;
}

export function parseProductKey(route = '') {
  const [path, queryString] = String(route).split('?');
  const queryId = String(new URLSearchParams(queryString || '').get('id') || '').trim();
  if (queryId) return queryId;
  const parts = boutiquePath(path).split('/').filter(Boolean);
  if (parts[0] === 'product' && parts[1]) return decodeRoutePart(parts[1]);
  if (parts[0] === 'products' && parts[1]) return decodeRoutePart(parts[1]);
  if (parts[0] === 'store' && parts[2] === 'products' && parts[3]) return decodeRoutePart(parts[3]);
  if (parts[0] === 'store' && parts[2] === 'product' && parts[3]) return decodeRoutePart(parts[3]);
  return '';
}

export function productHref(product, storeSlug = '') {
  const slug = String(product?.slug || '').trim();
  const rawId = String(product?._id || product?.id || '').trim();
  const stableId = /^[a-f\d]{24}$/i.test(rawId) ? rawId : '';
  const key = slug || stableId || rawId;
  if (!key) return '/products';
  const pathname = storeSlug
    ? `/store/${encodeURIComponent(String(storeSlug).trim())}/products/${encodeURIComponent(key)}`
    : `/product/${encodeURIComponent(key)}`;
  return stableId && stableId !== key
    ? `${pathname}?id=${encodeURIComponent(stableId)}`
    : pathname;
}

export function storefrontPath(path, storeSlug = '') {
  if (!storeSlug || !/^\/(?:$|\?|products(?:[/?]|$)|product(?:[/?]|$)|search(?:[/?]|$)|category(?:[/?]|$)|rentals(?:[/?]|$)|rental-book(?:[/?]|$))/.test(String(path || ''))) return path;
  return `/store/${encodeURIComponent(storeSlug)}${path === '/' ? '' : path}`;
}

function decodeRoutePart(value) {
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return String(value || '').trim();
  }
}

export function currentPath() {
  if (typeof window === 'undefined') return '/';
  return `${window.location.pathname}${window.location.search}` || '/';
}
