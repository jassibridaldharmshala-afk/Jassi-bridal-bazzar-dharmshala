const key = (kind, storeSlug, userId = '') => `rental-${kind}:${storeSlug || 'default'}:${userId}`;
export function readRentalSession(kind, storeSlug, userId) {
  try {
    const storageKey = key(kind, storeSlug, userId), raw = sessionStorage.getItem(storageKey);
    const value = raw && raw.length <= 64 * 1024 ? JSON.parse(raw) : null;
    const age = Date.now() - value?.savedAt;
    if (value && !Array.isArray(value) && Number.isFinite(age) && age >= 0 && age < 24 * 60 * 60 * 1000) return value;
    sessionStorage.removeItem(storageKey);
  } catch { try { sessionStorage.removeItem(key(kind, storeSlug, userId)); } catch { /* Storage can be unavailable. */ } }
  return null;
}
export function saveRentalSession(kind, storeSlug, value, userId) {
  try { sessionStorage.setItem(key(kind, storeSlug, userId), JSON.stringify({ ...value, savedAt: Date.now() })); } catch { /* Planning can continue when storage is unavailable. */ }
}
export function clearRentalSession(kind, storeSlug, userId) {
  try { sessionStorage.removeItem(key(kind, storeSlug, userId)); } catch { /* Storage can be disabled. */ }
}
