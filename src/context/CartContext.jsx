import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import api from '../services/api';
import { normalizeProduct } from '../services/normalize';
import { useAuth } from './AuthContext';
import { createStoragePlan, readScopedJson } from '../utils/userStorage';
import { findProductVariant, hasManagedVariants, variantStock } from '../utils/variants';
import { trackEvent } from '../utils/analytics';
import { bagTotals, selectedBagItems } from '../utils/bag';
import { getSelectableSizes } from '../utils/productSizing';

export const CartContext = createContext(null);
const GUEST_STORAGE = createStoragePlan('samira_cart', null);
const EMPTY_STORAGE_NAMES = [];
const SYNC_KEY = 'samira_cart_sync';

export function CartProvider({ children, storageName: storageNameProp, legacyStorageNames = EMPTY_STORAGE_NAMES }) {
  const { user } = useAuth();
  const account = String(user?._id || user?.id || user?.phone || 'guest');
  const authenticated = account !== 'guest';
  const owner = useRef({ account });
  const alive = useRef(true), queue = useRef(Promise.resolve()), requests = useRef(new Map());
  const refreshRequests = useRef(new Map());
  if (owner.current.account !== account) {
    owner.current = { account };
    queue.current = Promise.resolve();
    requests.current = new Map();
    refreshRequests.current = new Map();
  }
  const session = owner.current;
  const guestName = !authenticated && storageNameProp ? storageNameProp : GUEST_STORAGE.storageName;
  const guestLegacy = !authenticated && legacyStorageNames.length ? legacyStorageNames : GUEST_STORAGE.legacyStorageNames;
  const [items, setItems] = useState(() => authenticated ? [] : loadGuestCart(guestName, guestLegacy).items);
  const itemsRef = useRef(items), couponRef = useRef(null);
  const [coupon, setCouponState] = useState(null);
  const [loading, setLoading] = useState(true), [hydrated, setHydrated] = useState(false);
  const [pendingCount, setPendingCount] = useState(0), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const valid = useCallback(() => alive.current && owner.current === session, [session]);
  const commit = useCallback(next => {
    if (!valid()) return;
    itemsRef.current = next; setItems(next);
    if (!authenticated) persistGuestCart(guestName, guestLegacy, { items: next, coupon: couponRef.current, synced: !next.some(item => item.localOnly) });
  }, [authenticated, guestLegacy, guestName, valid]);
  const setCoupon = useCallback(value => {
    if (!valid()) return;
    couponRef.current = value; setCouponState(value);
    if (!authenticated) persistGuestCart(guestName, guestLegacy, { items: itemsRef.current, coupon: value, synced: !itemsRef.current.some(item => item.localOnly) });
  }, [authenticated, guestLegacy, guestName, valid]);
  const enqueue = useCallback(operation => {
    const next = queue.current.catch(() => {}).then(() => valid() ? operation() : { ok: false, message: 'Your account changed. Please retry.' });
    queue.current = next; return next;
  }, [valid]);
  const refresh = useCallback((forceRefetch = false) => {
    if (refreshRequests.current.has(account)) return refreshRequests.current.get(account);
    const request = enqueue(async () => {
      setLoading(true); setError('');
      try {
        const cached = loadGuestCart(guestName, guestLegacy);
        let remote = normalizeCartResponse(await api.get('/cart', { silent: true, cacheFirst: true, cacheScope: account, forceRefetch }));
        if (!valid()) return { ok: false };
        const failed = [];
        // New server carts absorb the guest session automatically. Only unsynced
        // legacy/offline lines need replay; synced caches must never resurrect removals.
        if (!cached.synced) {
          for (const line of cached.items) {
            if (!valid()) return { ok: false };
            if (remote.some(item => getItemKey(item) === getItemKey(line))) continue;
            try { remote = normalizeCartResponse(await api.post('/cart', buildCartPayload(line.product, line.quantity, line.size, line.color, line.variantId))); }
            catch { failed.push({ ...line, localOnly: true, issue: 'This saved item could not sync. Retry or remove it.' }); }
          }
        }
        if (!valid()) return { ok: false };
        if (authenticated) {
          if (failed.length) persistGuestCart(guestName, guestLegacy, { items: failed, synced: false });
          else clearGuestCart(guestName, guestLegacy);
        }
        const next = authenticated ? remote : [...remote, ...failed];
        commit(next);
        if (failed.length) setError('Some saved items could not sync. Please retry.');
        return { ok: !failed.length, items: next };
      } catch (failure) {
        if (valid()) setError(failure.message || 'Could not refresh your bag. Please retry.');
        return { ok: false, message: failure.message };
      } finally { if (valid()) { setLoading(false); setHydrated(true); } }
    }).finally(() => { if (refreshRequests.current.get(account) === request) refreshRequests.current.delete(account); });
    refreshRequests.current.set(account, request);
    return request;
  }, [account, authenticated, commit, enqueue, guestLegacy, guestName, valid]);

  useEffect(() => {
    alive.current = true; setHydrated(false); setLoading(true);
    const cached = loadGuestCart(guestName, guestLegacy);
    itemsRef.current = authenticated ? [] : cached.items; setItems(itemsRef.current); setPendingCount(0);
    couponRef.current = cached.coupon; setCouponState(cached.coupon);
    refresh();
    let lastFocus = Date.now();
    const onFocus = () => { if (Date.now() - lastFocus > 30000) { lastFocus = Date.now(); refresh(); } };
    const onStorage = event => {
      if (event.key !== SYNC_KEY) return;
      try { if (JSON.parse(event.newValue)?.account === account) refresh(true); } catch { /* unrelated storage */ }
    };
    const onSessionRefreshed = event => {
      const refreshedUser = event.detail;
      if (String(refreshedUser?._id || refreshedUser?.id || refreshedUser?.phone || '') === account) refresh();
    };
    window.addEventListener('focus', onFocus); window.addEventListener('storage', onStorage);
    window.addEventListener('samira:session-refreshed', onSessionRefreshed);
    return () => { alive.current = false; window.removeEventListener('focus', onFocus); window.removeEventListener('storage', onStorage); window.removeEventListener('samira:session-refreshed', onSessionRefreshed); };
  }, [account, authenticated, guestLegacy, guestName, refresh]);
  useEffect(() => { if (hydrated && !items.length && coupon) setCoupon(null); }, [hydrated, items.length, coupon, setCoupon]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 4500); return () => clearTimeout(timer); }, [notice]);

  const runMutation = (key, operation) => {
    const requestKey = account + ':' + key;
    if (requests.current.has(requestKey)) return requests.current.get(requestKey);
    setPendingCount(value => value + 1);
    const promise = enqueue(async () => {
      try {
        setError('');
        const response = await operation();
        if (!valid()) return { ok: false, message: 'Your account changed. Please check your bag.' };
        const received = normalizeCartResponse(response);
        const removed = new Set(response?.removedKeys || []);
        const local = itemsRef.current.filter(item => item.localOnly && !removed.has(getItemKey(item)) && !received.some(row => getItemKey(row) === getItemKey(item)));
        const next = [...received, ...local]; commit(next);
        try { localStorage.setItem(SYNC_KEY, JSON.stringify({ account, at: Date.now(), nonce: Math.random() })); } catch { /* focus refresh remains available */ }
        return { ok: true, items: next };
      } catch (failure) {
        const message = failure.message || 'Could not update your bag. Please retry.';
        if (valid()) { setError(message); setNotice(message); }
        return { ok: false, message };
      }
    }).finally(() => { if (requests.current.get(requestKey) === promise) requests.current.delete(requestKey); if (valid()) setPendingCount(value => Math.max(0, value - 1)); });
    requests.current.set(requestKey, promise); return promise;
  };
  const addToCartConfirmed = (product, size = '', color = '', variantId = '', quantity = 1) =>
    runMutation('add:' + getCartKey(getProductId(product), size, color, variantId), async () => {
      const response = await api.post('/cart', buildCartPayload(product, quantity, size, color, variantId));
      trackEvent('ADD_TO_CART', { productId: getProductId(product) }); return response;
    });
  // Preserve the storefront's synchronous result contract; actual state comes
  // from the acknowledged server response for guests and accounts alike.
  const addToCart = (product, size = '', color = product.colors?.[0] || '', variantId = product.variantId || product.selectedVariantId || '', quantity = 1) => {
    const selectableSizes = getSelectableSizes(product);
    if (selectableSizes.length && !String(size || '').trim()) {
      setNotice('Please select a size on the product page before adding it to your bag.');
      return { ok: false, reason: 'missing-size' };
    }
    const resolvedSize = String(size || '').trim() || 'Free Size';
    const resolved = variantId || findProductVariant(product, { size: resolvedSize, color })?._id || '';
    const stock = getAvailableStock(product, { size: resolvedSize, color, variantId: resolved });
    if (stock === 0) { setNotice('This selection is out of stock.'); return { ok: false, reason: 'out-of-stock' }; }
    if (!getProductId(product)) return { ok: false, reason: 'invalid-product' };
    const existing = findCartItem(itemsRef.current, product, { size: resolvedSize, color, variantId: resolved });
    const total = Number(existing?.quantity || 0) + quantity;
    if (total > 20 || (stock !== null && total > stock)) { setNotice('The available quantity has been reached.'); return { ok: false, reason: 'stock-limit' }; }
    addToCartConfirmed(product, resolvedSize, color, resolved, quantity);
    return { ok: true, quantity: total };
  };
  const getCartItem = (productOrKey, options = {}) => findCartItem(itemsRef.current, productOrKey, options);
  const updateQuantity = (productOrKey, quantity, options = {}) => {
    const target = getCartItem(productOrKey, options);
    if (!target) return Promise.resolve({ ok: false, message: 'Refresh your bag and try again.' });
    if (quantity <= 0) return removeFromCart(productOrKey, options);
    return runMutation('quantity:' + getItemKey(target), () => api.put('/cart/' + getBackendCartItemId(target), { quantity }));
  };
  const increaseQuantity = (productOrKey, options = {}) => { const item = getCartItem(productOrKey, options); return item && updateQuantity(productOrKey, item.quantity + 1, options); };
  const decreaseQuantity = (productOrKey, options = {}) => { const item = getCartItem(productOrKey, options); return item && updateQuantity(productOrKey, item.quantity - 1, options); };
  const removeItems = targets => {
    const keys = new Set(targets.map(getItemKey));
    return runMutation('remove:' + [...keys].join('|'), async () => {
      const current = itemsRef.current.filter(item => keys.has(getItemKey(item)));
      const remote = current.filter(item => !item.localOnly && getBackendCartItemId(item));
      const response = remote.length ? await api.post('/cart/remove-items', { itemIds: remote.map(getBackendCartItemId) }) : { items: itemsRef.current };
      const normalized = normalizeCartResponse(response).filter(item => !keys.has(getItemKey(item)));
      return { items: normalized, removedKeys: [...keys] };
    });
  };
  const removeFromCart = (productOrKey, options = {}) => { const item = getCartItem(productOrKey, options); return item ? removeItems([item]) : Promise.resolve({ ok: true }); };
  const updateItemOptions = (productOrKey, options = {}) => {
    const item = getCartItem(productOrKey, { cartKey: options.cartKey });
    if (!item) return Promise.resolve({ ok: false });
    const size = options.size ?? item.size, color = options.color ?? item.color;
    const variantId = options.variantId ?? findProductVariant(item.product, { size, color })?._id ?? '';
    return runMutation('options:' + getItemKey(item), () => api.put('/cart/' + getBackendCartItemId(item), { size, color, variantId, quantity: options.quantity ?? item.quantity }));
  };
  const selectItems = (targets, selected) => runMutation('selection:' + targets.map(getItemKey).join('|'), async () => {
    const remote = targets.filter(item => !item.localOnly && getBackendCartItemId(item));
    const response = remote.length ? await api.post('/cart/selection', { itemIds: remote.map(getBackendCartItemId), selected }) : { items: itemsRef.current.filter(item => !item.localOnly) };
    const keys = new Set(targets.map(getItemKey));
    return { items: [...normalizeCartResponse(response), ...itemsRef.current.filter(item => item.localOnly).map(item => keys.has(getItemKey(item)) ? { ...item, selected } : item)] };
  });
  const clearCart = () => runMutation('clear', async () => { const response = await api.delete('/cart'); setCoupon(null); return { ...response, removedKeys: itemsRef.current.map(getItemKey) }; });
  const completeCheckout = async purchased => { const result = await removeItems(purchased); if (result.ok) setCoupon(null); return result; };
  const totals = bagTotals(items, coupon);
  const value = { items, ...totals, coupon, setCoupon, loading, hydrated, error, pendingCount, refresh,
    selectedItems: selectedBagItems(items), addToCart, addToCartConfirmed, updateQuantity, increaseQuantity,
    decreaseQuantity, removeFromCart, removeItems, updateItemOptions, selectItems, getCartItem, clearCart, completeCheckout, isSynced: !error };
  return <CartContext.Provider value={value}>{children}{notice && <button type="button" role="status" onClick={() => setNotice('')} className="fixed bottom-24 left-1/2 z-[90] w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 rounded-xl bg-charcoal px-4 py-3 text-sm font-bold text-white shadow-2xl md:bottom-6">{notice}</button>}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);

function normalizeCartResponse(response) {
  const sourceItems = Array.isArray(response)
    ? response
    : Array.isArray(response?.items)
      ? response.items
      : Array.isArray(response?.data?.items)
        ? response.data.items
        : null;

  if (!sourceItems || response?.success === false || sourceItems.some(item => !item || !(item.product || item.productId))) {
    throw new Error('Your bag could not be loaded. Please retry to retrieve your saved items.');
  }

  const normalized = sourceItems
    .map((item) => {
      const product = normalizeCartLineProduct(item);
      const productId = item.productId || getProductId(product);
      const size = item.size ?? product.sizes?.[0] ?? 'Free Size';
      const color = item.color ?? product.colors?.[0] ?? '';
      const variantId = item.variantId || product.variantId || product.selectedVariantId || '';
      return {
        ...item,
        product,
        productId,
        size,
        color,
        variantId,
        cartKey: item.cartKey || getCartKey(productId, size, color, variantId),
        quantity: Math.max(1, Number(item.quantity || 1)),
      };
    });
  if (normalized.some(item => !item.productId)) throw new Error('Your bag could not be loaded. Please retry to retrieve your saved items.');
  return normalized;
}

function loadGuestCart(storageName, legacyStorageNames = []) {
  const parsed = readScopedJson(storageName, legacyStorageNames, {});
  return {
    items: normalizeStoredItems(parsed.items || []),
    coupon: parsed.coupon || null,
    synced: parsed.synced === true,
  };
}

function persistGuestCart(storageName, legacyStorageNames = [], cartState = {}) {
  try {
    localStorage.setItem(storageName, JSON.stringify(cartState));
  } catch {
    // Ignore storage failures.
  }
  legacyStorageNames.forEach((name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      // Ignore storage failures.
    }
  });
}

function clearGuestCart(storageName, legacyStorageNames = []) {
  try {
    localStorage.removeItem(storageName);
  } catch {
    // Ignore storage failures.
  }
  legacyStorageNames.forEach((name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      // Ignore storage failures.
    }
  });
}

function normalizeStoredItems(storedItems) {
  if (!Array.isArray(storedItems)) return [];
  return storedItems
    .filter((item) => item?.product)
    .map((item) => {
      const product = normalizeCartLineProduct(item);
      const productId = item.productId || getProductId(product);
      const size = item.size ?? product.sizes?.[0] ?? 'Free Size';
      const color = item.color ?? product.colors?.[0] ?? '';
      const variantId = item.variantId || product.variantId || product.selectedVariantId || '';
      return {
        ...item,
        product,
        productId,
        size,
        color,
        variantId,
        cartKey: item.cartKey || getCartKey(productId, size, color, variantId),
        quantity: Math.max(1, Number(item.quantity || 1)),
      };
    });
}

function normalizeCartProduct(product = {}) {
  return normalizeProduct({
    ...product,
    images: Array.isArray(product.images) ? product.images : [],
    videos: Array.isArray(product.videos) ? product.videos : [],
  });
}

function normalizeCartLineProduct(item) {
  const product = normalizeCartProduct(item.product || item);
  const variant = findProductVariant(product, { variantId: item.variantId, size: item.size, color: item.color });
  // Bag totals must use the selected SKU's server-confirmed price.
  const price = Number(item.price ?? variant?.price ?? product.price);
  return { ...product, price, originalPrice: Math.max(price, Number(item.originalPrice ?? variant?.originalPrice ?? product.originalPrice ?? price)) };
}

function buildCartPayload(product, quantity, size, color, variantId) {
  return {
    product: getProductId(product),
    quantity: Math.max(1, Number(quantity || 1)),
    size: size || '',
    color: color || '',
    variantId: variantId || '',
    price: Number(product?.price || 0),
  };
}

function getProductId(product = {}) {
  return product._id || product.id || product.slug || '';
}

function getAvailableStock(product = {}, selection = {}) {
  if (hasManagedVariants(product)) {
    return variantStock(product, selection);
  }
  if (product.stock === undefined || product.stock === null || product.stock === '') return null;
  const stock = Number(product.stock);
  return Number.isFinite(stock) ? Math.max(0, stock) : null;
}

function getCartKey(productId, size = '', color = '', variantId = '') {
  return [productId, size || '', color || '', variantId || ''].join('::');
}

function getItemKey(item) {
  return item.cartKey || getCartKey(item.productId || getProductId(item.product), item.size, item.color, item.variantId);
}

function getBackendCartItemId(item = {}) {
  return item._id || item.id || item.cartItemId || '';
}

function resolveKey(productOrKey, options = {}) {
  if (options.cartKey) return options.cartKey;
  if (typeof productOrKey === 'string') {
    if (options.size || options.color || options.variantId) return getCartKey(productOrKey, options.size, options.color, options.variantId);
    return productOrKey;
  }
  const productId = getProductId(productOrKey);
  return getCartKey(productId, options.size ?? productOrKey?.sizes?.[0] ?? 'Free Size', options.color ?? productOrKey?.colors?.[0] ?? '', options.variantId || productOrKey?.variantId || productOrKey?.selectedVariantId || '');
}

function matchesItem(item, key, options = {}) {
  if (options.cartKey || String(key).includes('::')) return getItemKey(item) === key;
  return String(item.productId || getProductId(item.product)) === String(key);
}

function findCartItem(items, productOrKey, options = {}) {
  const key = resolveKey(productOrKey, options);
  return items.find((item) => matchesItem(item, key, options));
}
