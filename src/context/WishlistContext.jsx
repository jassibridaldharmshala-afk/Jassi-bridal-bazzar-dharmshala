import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api from '../services/api';
import { normalizeProduct } from '../services/normalize';
import { useAuth } from './AuthContext';
import { createStoragePlan, readScopedJson } from '../utils/userStorage';
import { trackEvent } from '../utils/analytics';

export const WishlistContext = createContext(null);
const GUEST_STORAGE = createStoragePlan('samira_wishlist', null);
const SYNC_KEY = 'samira_wishlist_sync';
const itemId = product => String(product?._id || product?.id || product?.slug || '');
const normalizeItems = values => {
  const seen = new Set();
  return (Array.isArray(values) ? values : []).filter(product => {
    const id = itemId(product); if (!id || seen.has(id)) return false; seen.add(id); return true;
  }).map(product => normalizeProduct({ ...product, images: product.images?.length ? product.images : [product.primaryImageUrl || product.primaryImage || product.image].filter(Boolean) }));
};
function loadGuest() {
  try { return normalizeItems(readScopedJson(GUEST_STORAGE.storageName, GUEST_STORAGE.legacyStorageNames, [])); } catch { return []; }
}
function storeGuest(items) {
  try { localStorage.setItem(GUEST_STORAGE.storageName, JSON.stringify(items)); return true; } catch { return false; }
}
function normalizeRemoteItems(values) {
  if (!Array.isArray(values) || values.some(product => !product || typeof product !== 'object' || !itemId(product))) {
    throw new Error('Your wishlist could not be loaded. Please retry to retrieve your saved items.');
  }
  return normalizeItems(values);
}

export function WishlistProvider({ children }) {
  const { user, notify } = useAuth();
  const account = user ? String(user._id || user.id || user.phone) : 'guest';
  const ownerRef = useRef({ account });
  const alive = useRef(true);
  const queue = useRef(Promise.resolve());
  const requests = useRef(new Map());
  if (ownerRef.current.account !== account) {
    ownerRef.current = { account };
    queue.current = Promise.resolve();
    requests.current = new Map();
  }
  const session = ownerRef.current;
  const [items, setItems] = useState(() => user ? [] : loadGuest());
  const itemsRef = useRef(items);
  const guestStorageFailed = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingIds, setPendingIds] = useState([]);
  const lastRefresh = useRef(0);
  const authenticated = account !== 'guest';
  const valid = useCallback(() => alive.current && ownerRef.current === session, [session]);
  const commit = useCallback((values, persist = false) => {
    if (!valid()) return;
    const next = normalizeItems(values); itemsRef.current = next; setItems(next);
    if (persist && !authenticated) {
      guestStorageFailed.current = !storeGuest(next);
      if (guestStorageFailed.current) setError('Your browser could not save these items. Keep this tab open or sign in to save them.');
    }
  }, [authenticated, valid]);
  const currentGuest = useCallback(() => guestStorageFailed.current ? itemsRef.current : loadGuest(), []);
  const enqueue = useCallback(operation => {
    const next = queue.current.catch(() => {}).then(() => valid() ? operation() : { ok: false, message: 'Your account changed. Please retry.' });
    queue.current = next;
    return next;
  }, [valid]);

  const refresh = useCallback((forceRefetch = false) => enqueue(async () => {
    if (!valid()) return { ok: false };
    setLoading(true); setError('');
    try {
      if (authenticated) {
        let remote = normalizeRemoteItems(await api.get('/wishlist', { silent: true, cacheFirst: true, cacheScope: account, forceRefetch }));
        if (!valid()) return { ok: false };
        commit(remote);
        let mergeFailed = false;
        for (const saved of loadGuest()) {
          if (!valid()) return { ok: false };
          try {
            if (!remote.some(item => itemId(item) === itemId(saved))) remote = normalizeRemoteItems(await api.post(`/wishlist/${encodeURIComponent(itemId(saved))}`));
            if (!valid()) return { ok: false };
            commit(remote);
            storeGuest(loadGuest().filter(item => itemId(item) !== itemId(saved)));
          } catch { mergeFailed = true; }
        }
        if (valid() && mergeFailed) setError('Some items saved before sign-in could not sync. Retry to finish saving them to your account.');
      } else {
        const local = currentGuest(); commit(local);
        const resolved = [];
        for (let start = 0; start < local.length; start += 200) {
          resolved.push(...normalizeRemoteItems(await api.post('/wishlist/resolve', { ids: local.slice(start, start + 200).map(itemId) })));
        }
        // Refresh product details without restoring removals or losing new saves
        // made in another tab while the catalogue request was in flight.
        const lookup = new Map();
        resolved.forEach(product => { lookup.set(itemId(product), product); if (product.slug) lookup.set(product.slug, product); });
        commit(currentGuest().map(product => lookup.get(itemId(product)) || product), true);
      }
      lastRefresh.current = Date.now();
      return { ok: true };
    } catch (failure) {
      if (valid()) setError(failure.message || 'Could not refresh your wishlist. Your saved items are still here.');
      return { ok: false };
    } finally { if (valid()) setLoading(false); }
  }), [account, authenticated, commit, currentGuest, enqueue, valid]);

  useEffect(() => {
    alive.current = true; itemsRef.current = authenticated ? [] : loadGuest(); setItems(itemsRef.current);
    setPendingIds([]); guestStorageFailed.current = false;
    refresh();
    const onFocus = () => { if (Date.now() - lastRefresh.current > 30000) refresh(); };
    const onStorage = event => {
      if (!authenticated && (event.key === GUEST_STORAGE.storageName || event.key === null)) { guestStorageFailed.current = false; commit(loadGuest()); }
      if (authenticated && event.key === SYNC_KEY) {
        try { if (JSON.parse(event.newValue)?.account === account) refresh(true); } catch { /* unrelated storage */ }
      }
    };
    window.addEventListener('focus', onFocus); window.addEventListener('storage', onStorage);
    return () => { alive.current = false; window.removeEventListener('focus', onFocus); window.removeEventListener('storage', onStorage); };
  }, [account, authenticated, commit, refresh]);

  const mutate = useCallback((productOrId, action) => {
    const id = typeof productOrId === 'string' ? productOrId : itemId(productOrId);
    if (!id) return Promise.resolve({ ok: false, message: 'This product could not be saved.' });
    const requestKey = `${account}:${id}`;
    if (requests.current.has(requestKey)) return requests.current.get(requestKey);
    setPendingIds(current => [...current, id]);
    const promise = enqueue(async () => {
      const current = authenticated ? itemsRef.current : currentGuest();
      const exists = current.some(item => itemId(item) === id);
      const remove = action === 'remove' || (action === 'toggle' && exists);
      if ((action === 'add' && exists) || (remove && !exists)) { commit(current); return { ok: true }; }
      try {
        setError('');
        if (authenticated) {
          const response = remove ? await api.delete(`/wishlist/${encodeURIComponent(id)}`) : await api.post(`/wishlist/${encodeURIComponent(id)}`);
          if (!valid()) return { ok: false, message: 'Your account changed. Please retry.' };
          commit(normalizeRemoteItems(response));
          try { localStorage.setItem(SYNC_KEY, JSON.stringify({ account, at: Date.now(), nonce: Math.random() })); } catch { /* focus refresh still works */ }
        } else {
          // Read the latest storage value so another tab's saves are preserved.
          commit(remove ? current.filter(item => itemId(item) !== id) : [...current, productOrId], true);
        }
        if (!remove) trackEvent('WISHLIST_ADD', { productId: id });
        return { ok: true };
      } catch (failure) {
        const message = failure.message || 'Could not update your wishlist. Please retry.';
        if (valid()) { setError(message); notify?.(message, 'error', 'Wishlist'); }
        return { ok: false, message };
      }
    }).finally(() => {
      if (requests.current.get(requestKey) === promise) requests.current.delete(requestKey);
      if (valid()) setPendingIds(current => current.filter(value => value !== id));
    });
    requests.current.set(requestKey, promise);
    return promise;
  }, [account, authenticated, commit, currentGuest, enqueue, notify, valid]);
  const toggleWishlist = useCallback(product => mutate(product, 'toggle'), [mutate]);
  const addToWishlist = useCallback(product => mutate(product, 'add'), [mutate]);
  const removeFromWishlist = useCallback(product => mutate(product, 'remove'), [mutate]);
  const value = useMemo(() => ({ items, loading, error, pendingIds, refresh, toggleWishlist, addToWishlist, removeFromWishlist, isSynced: authenticated && !error }), [items, loading, error, pendingIds, refresh, toggleWishlist, addToWishlist, removeFromWishlist, authenticated]);
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export const useWishlist = () => useContext(WishlistContext);
