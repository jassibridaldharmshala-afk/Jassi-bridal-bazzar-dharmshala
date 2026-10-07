import { useEffect, useState } from 'react';
import api from '../services/api';
import { getRecentProductIds, RECENT_PRODUCTS_EVENT } from '../utils/recentProducts';
import { SETTINGS_CHANGED_EVENT, SETTINGS_STORAGE_KEY } from '../config/storeSettings';
export default function useShoppingDiscovery(storeSlug = '') {
  const [recentState, setRecentState] = useState(() => ({ storeSlug, key: getRecentProductIds(storeSlug).join(',') }));
  const recentKey = recentState.storeSlug === storeSlug ? recentState.key : getRecentProductIds(storeSlug).join(',');
  const [result, setResult] = useState(null), [revision, setRevision] = useState(0);
  useEffect(() => {
    const sync = () => setRecentState({ storeSlug, key: getRecentProductIds(storeSlug).join(',') });
    const refresh = () => setRevision(value => value + 1);
    const visible = () => { if (document.visibilityState === 'visible') refresh(); };
    const storage = event => { sync(); if (event.key === SETTINGS_STORAGE_KEY || event.key === null) refresh(); };
    sync(); window.addEventListener(RECENT_PRODUCTS_EVENT, sync); window.addEventListener('storage', storage); window.addEventListener(SETTINGS_CHANGED_EVENT, refresh);
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', visible);
    return () => { window.removeEventListener(RECENT_PRODUCTS_EVENT, sync); window.removeEventListener('storage', storage); window.removeEventListener(SETTINGS_CHANGED_EVENT, refresh); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', visible); };
  }, [storeSlug]);
  useEffect(() => {
    let alive = true; setResult(null);
    const recent = getRecentProductIds(storeSlug).join(',');
    Promise.resolve(api.get(`/storefront/home/discovery?store=${encodeURIComponent(storeSlug)}&recent=${encodeURIComponent(recent)}`, { silent: true, cacheScope: `discovery:${storeSlug}:${recent}:${revision}` })).then(value => { if (alive && value) setResult({ storeSlug, recentKey, data: value }); }).catch(() => {});
    return () => { alive = false; };
  }, [storeSlug, recentKey, revision]);
  return { data: result?.storeSlug === storeSlug && result?.recentKey === recentKey ? result.data : null, recentIds: recentKey ? recentKey.split(',') : [] };
}
