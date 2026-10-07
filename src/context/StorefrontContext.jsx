import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import {
  parseStoreSlug,
  setStoreSlug,
} from '../utils/attribution';

const StorefrontContext = createContext({
  store: null,
  storeSlug: '',
  loading: false,
  hostResolved: false,
  isHostStore: false,
});

export function StorefrontProvider({ route, children }) {
  const pathSlug = parseStoreSlug(route);
  const [pathResult, setPathResult] = useState(null);
  const [hostStore, setHostStore] = useState(null);
  const [hostResolved, setHostResolved] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt(value => value + 1), []);

  useEffect(() => {
    if (pathSlug) {
      setHostStore(null);
      setHostResolved(false);
      return undefined;
    }
    let cancelled = false;
    api.get(`/stores/resolve?host=${encodeURIComponent(window.location.host)}`, { cacheFirst: true })
      .then((data) => {
        if (!cancelled) { setHostStore(data?.slug && !data.isDefault ? data : null); setHostResolved(true); }
      })
      .catch(() => {
        if (!cancelled) { setHostStore(null); setHostResolved(true); }
      });
    return () => { cancelled = true; };
  }, [pathSlug]);

  useEffect(() => {
    if (!pathSlug) {
      setPathResult(null);
      return undefined;
    }
    let cancelled = false;
    setPathResult({ slug: pathSlug, loading: true });
    api.get(`/stores/${encodeURIComponent(pathSlug)}`, { cacheFirst: true })
      .then((data) => {
        if (!data?.slug) throw new Error('The boutique returned incomplete information. Please try again.');
        if (!cancelled) setPathResult({ slug: pathSlug, store: data, loading: false });
      })
      .catch((error) => {
        if (!cancelled) setPathResult({ slug: pathSlug, error: error.message || 'Unable to open this boutique. Please try again.', loading: false });
      });
    return () => { cancelled = true; };
  }, [pathSlug, attempt]);

  const currentPath = pathResult?.slug === pathSlug ? pathResult : null;
  const store = pathSlug ? currentPath?.store || null : hostStore;
  const loading = Boolean(pathSlug && (!currentPath || currentPath.loading));
  const error = pathSlug ? currentPath?.error || '' : '';
  const storeSlug = pathSlug || hostStore?.slug || '';
  const isHostStore = Boolean(hostStore?.slug && !pathSlug);

  useEffect(() => {
    setStoreSlug(storeSlug);
  }, [storeSlug]);

  const value = useMemo(
    () => ({ store, storeSlug, loading, error, retry, isHostStore, hostResolved }),
    [hostResolved, isHostStore, loading, error, retry, store, storeSlug],
  );
  return <StorefrontContext.Provider value={value}>{children}</StorefrontContext.Provider>;
}

export function useStorefront() {
  return useContext(StorefrontContext);
}
