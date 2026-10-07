const PREFIX = 'samira_recent_products_v1';
export const RECENT_PRODUCTS_EVENT = 'samira:recent-products-changed';
const MAX_ITEMS = 12;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function key(storeSlug = '') {
  return `${PREFIX}:${String(storeSlug || 'default').trim().toLowerCase()}`;
}

function records(storeSlug) {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key(storeSlug)) || '[]');
    const seen = new Set();
    return (Array.isArray(parsed) ? parsed : []).flatMap(item => {
      const id = String(item?.id || (typeof item === 'string' ? item : ''));
      const viewedAt = item?.viewedAt;
      const timestamp = viewedAt ? Date.parse(viewedAt) : null;
      if (!/^[a-z\d_-]{1,120}$/i.test(id) || seen.has(id) || (viewedAt && (!Number.isFinite(timestamp) || timestamp < Date.now() - MAX_AGE_MS || timestamp > Date.now() + 60000))) return [];
      seen.add(id);
      return [{ id, ...(viewedAt ? { viewedAt } : {}) }];
    }).slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

export function getRecentProductIds(storeSlug = '', limit = MAX_ITEMS) {
  return records(storeSlug).slice(0, Math.max(0, Math.min(MAX_ITEMS, Number(limit) || 0))).map(item => item.id);
}

function announce(storeSlug) {
  window.dispatchEvent(new CustomEvent(RECENT_PRODUCTS_EVENT, { detail: { storeSlug } }));
}

export function clearRecentProducts(storeSlug = '') {
  if (typeof window === 'undefined') return;
  try { window.localStorage.removeItem(key(storeSlug)); announce(storeSlug); } catch { /* Storage is optional. */ }
}

export function rememberRecentProduct(productId, storeSlug = '') {
  if (typeof window === 'undefined' || !productId) return;
  try {
    const id = String(productId);
    if (!/^[a-z\d_-]{1,120}$/i.test(id)) return;
    const current = records(storeSlug).filter(item => item.id !== id);
    window.localStorage.setItem(key(storeSlug), JSON.stringify([{ id, viewedAt: new Date().toISOString() }, ...current].slice(0, MAX_ITEMS)));
    announce(storeSlug);
  } catch {
    // Browsing still works when storage is unavailable.
  }
}
