import { useEffect, useLayoutEffect, useRef } from 'react';
import api from '../../services/api';
import { useStorefront } from '../../context/StorefrontContext';
import { useAuth } from '../../context/AuthContext';
import { isWebsitePreview } from '../../config/websiteDesigner';
import { configureTraffic, updateTrafficRoute, flushTraffic, trafficPreference, trafficAllowed, setTrafficConsent, retryTrafficDeletion, engagementLeader, recordTrafficEvent, suspendTraffic } from '../../utils/trafficTracker';

export default function TrafficTracking({ route }) {
  const { store, storeSlug, loading, hostResolved } = useStorefront();
  const { user } = useAuth();
  const currentRoute = useRef(route); currentRoute.current = route;
  const configurationKey = useRef('');
  const tabId = useRef(window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`);
  const internal = user?.activeMode === 'admin' || user?.activeMode === 'seller';
  const currentInternal = useRef(internal); currentInternal.current = internal;
  const excluded = /^\/(admin|seller|master)(\/|$)/.test(route);
  useLayoutEffect(() => { suspendTraffic(); }, [store?._id, storeSlug, loading, excluded, hostResolved]);

  useEffect(() => {
    if (loading || (!store?._id && hostResolved === false) || excluded || isWebsitePreview()) return undefined;
    let active = true; let interval;
    const load = () => api.get(`/analytics/config${storeSlug ? `?store=${encodeURIComponent(storeSlug)}` : '?store='}`, { silent: true, cache: 'no-store' }).then(value => {
      if (!active) return;
      configurationKey.current = value.storeKey;
      configureTraffic(value, { storeSlug, route: currentRoute.current, internal: currentInternal.current, preview: false, tabId: tabId.current });
      updateTrafficRoute(currentRoute.current, currentInternal.current); retryTrafficDeletion();
    }).catch(() => { /* Shopping must work even when analytics configuration is unavailable. */ });
    const onStorage = event => { if (event.key === `traffic:${configurationKey.current}:consent`) { if (trafficPreference() === 'denied') setTrafficConsent(false); else updateTrafficRoute(currentRoute.current, currentInternal.current); } };
    window.addEventListener('storage', onStorage); window.addEventListener('store:traffic-reload', load);
    load(); interval = window.setInterval(load, 300000);
    return () => { active = false; window.clearInterval(interval); window.removeEventListener('storage', onStorage); window.removeEventListener('store:traffic-reload', load); };
  }, [store?._id, storeSlug, loading, excluded, hostResolved]);
  useLayoutEffect(() => { updateTrafficRoute(route, internal); }, [route, internal]);
  useEffect(() => {
    let lastInput = Date.now(); let lastTick = Date.now();
    const activity = () => { lastInput = Date.now(); };
    const visibility = () => { if (document.visibilityState === 'hidden') flushTraffic(true); else { lastInput = Date.now(); lastTick = Date.now(); } };
    const online = () => { flushTraffic(); retryTrafficDeletion(); };
    const heartbeat = window.setInterval(() => {
      const now = Date.now(); const elapsed = Math.min(15000, now - lastTick); lastTick = now;
      if (document.visibilityState !== 'hidden' && now - lastInput <= 30000 && trafficAllowed() && engagementLeader()) recordTrafficEvent('ENGAGEMENT', { engagementMs: elapsed });
    }, 15000);
    ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(name => window.addEventListener(name, activity, { passive: true }));
    document.addEventListener('visibilitychange', visibility); window.addEventListener('pagehide', visibility); window.addEventListener('online', online);
    return () => { window.clearInterval(heartbeat); ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(name => window.removeEventListener(name, activity)); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pagehide', visibility); window.removeEventListener('online', online); };
  }, []);
  // Visitor measurement runs in the background. Policy controls belong inside
  // Privacy Policy, never over product actions, the bag or checkout.
  return null;
}
