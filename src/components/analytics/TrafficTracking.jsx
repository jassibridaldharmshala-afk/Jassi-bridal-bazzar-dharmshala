import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import api from '../../services/api';
import { useStorefront } from '../../context/StorefrontContext';
import { useAuth } from '../../context/AuthContext';
import { isWebsitePreview } from '../../config/websiteDesigner';
import { configureTraffic, updateTrafficRoute, flushTraffic, trafficPreference, trafficAllowed, setTrafficConsent, retryTrafficDeletion, engagementLeader, recordTrafficEvent, suspendTraffic, TRAFFIC_CHANGE_EVENT } from '../../utils/trafficTracker';
import './TrafficTracking.css';

export default function TrafficTracking({ route }) {
  const { store, storeSlug, loading, hostResolved } = useStorefront();
  const { user } = useAuth();
  const [config, setConfig] = useState(null); const [preference, setPreference] = useState('unknown');
  const [open, setOpen] = useState(false); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  const currentRoute = useRef(route); currentRoute.current = route;
  const configurationKey = useRef('');
  const tabId = useRef(window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`);
  const internal = user?.activeMode === 'admin' || user?.activeMode === 'seller';
  const currentInternal = useRef(internal); currentInternal.current = internal;
  const excluded = /^\/(admin|seller|master)(\/|$)/.test(route);
  useLayoutEffect(() => { suspendTraffic(); setConfig(null); setPreference('unknown'); }, [store?._id, storeSlug, loading, excluded, hostResolved]);

  useEffect(() => {
    if (loading || (!store?._id && hostResolved === false) || excluded || isWebsitePreview()) return undefined;
    let active = true; let interval;
    const load = () => api.get(`/analytics/config${storeSlug ? `?store=${encodeURIComponent(storeSlug)}` : '?store='}`, { silent: true, cache: 'no-store' }).then(value => {
      if (!active) return;
      configurationKey.current = value.storeKey;
      setConfig(value); configureTraffic(value, { storeSlug, route: currentRoute.current, internal: currentInternal.current, preview: false, tabId: tabId.current });
      updateTrafficRoute(currentRoute.current, currentInternal.current); retryTrafficDeletion();
    }).catch(() => { /* Shopping must work even when analytics configuration is unavailable. */ });
    const onChange = () => setPreference(trafficPreference());
    const onStorage = event => { if (event.key === `traffic:${configurationKey.current}:consent`) { onChange(); if (trafficPreference() === 'denied') setTrafficConsent(false); else updateTrafficRoute(currentRoute.current, currentInternal.current); } };
    window.addEventListener(TRAFFIC_CHANGE_EVENT, onChange); window.addEventListener('storage', onStorage); window.addEventListener('store:traffic-reload', load);
    load(); interval = window.setInterval(load, 300000);
    return () => { active = false; window.clearInterval(interval); window.removeEventListener(TRAFFIC_CHANGE_EVENT, onChange); window.removeEventListener('storage', onStorage); window.removeEventListener('store:traffic-reload', load); };
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
  const choose = async (allow, erase = false) => {
    setBusy(true); setNotice('');
    try { await setTrafficConsent(allow, erase); setOpen(false); if (erase) setNotice('Tracking is off. Deletion will finish in the background when the service is reachable.'); }
    finally { setBusy(false); }
  };
  if (!config?.enabled || internal || excluded || (config.excludeLocalhost && /^(localhost|127\.|\[?::1\]?)/.test(window.location.hostname))) return null;
  const show = open || (config.consentRequired && preference === 'unknown');
  const browserOptOut = navigator.globalPrivacyControl === true || navigator.doNotTrack === '1';
  const privacyLink = route.startsWith('/store/') && storeSlug ? `/store/${encodeURIComponent(storeSlug)}/privacy-policy` : '/privacy-policy';
  return <div className="traffic-privacy">
    {!show && <button type="button" className="traffic-privacy__trigger" onClick={() => { setOpen(true); setNotice(''); }} aria-label="Analytics privacy preferences">Privacy preferences</button>}
    {show && <section className="traffic-privacy__panel" aria-label="Analytics privacy preferences">
      <div><strong>Your privacy, your choice</strong><p>Allow anonymous traffic analytics to help this store improve your shopping experience. Shopping works either way. No passwords, payment details or form recordings are collected.</p>{config.ga4Enabled && <p>Allowing also enables this store’s Google Analytics integration.</p>}{browserOptOut && <p>Your browser’s privacy signal keeps analytics off. Change that browser preference before enabling analytics.</p>}<a href={privacyLink}>Read privacy policy</a></div>
      <div className="traffic-privacy__actions"><button type="button" disabled={busy} onClick={() => choose(false)}>Decline analytics</button><button type="button" className="traffic-privacy__allow" disabled={busy || browserOptOut} onClick={() => choose(true)}>Allow analytics</button>{preference === 'granted' && <button type="button" disabled={busy} onClick={() => choose(false, true)}>Withdraw & delete my analytics</button>}{open && <button type="button" disabled={busy} onClick={() => setOpen(false)}>Close</button>}</div>
    </section>}
    {notice && <p className="traffic-privacy__notice" role="status">{notice}<button type="button" aria-label="Dismiss privacy notice" onClick={() => setNotice('')}>×</button></p>}
  </div>;
}
