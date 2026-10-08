import { getApiBaseUrl } from '../store/apiBaseUrl';
import { boutiquePath } from './routing';

export const TRAFFIC_CHANGE_EVENT = 'store:traffic-privacy';
const DAY = 86400000;
const LIMIT = 100;
const PUBLIC = new Set(['PAGE_VIEW', 'ENGAGEMENT', 'STORE_VIEW', 'HOME_SECTION_VIEW', 'HOME_PRODUCT_CLICK', 'HOME_CATEGORY_CLICK', 'HOME_VIEW_ALL', 'HOME_SCROLL', 'PRODUCT_VIEW', 'SEARCH', 'FILTER_USED', 'WISHLIST_ADD', 'ADD_TO_CART', 'REMOVE_FROM_CART', 'BEGIN_CHECKOUT', 'CHECKOUT_START', 'COUPON_APPLIED', 'BANNER_IMPRESSION', 'BANNER_CLICK', 'WHATSAPP_CLICK', 'INSTAGRAM_SOURCE', 'ATTRIBUTION_CAPTURE', 'RENTAL_CTA', 'RENTAL_DATES_CHECK', 'RENTAL_QUOTE_SUCCESS', 'RENTAL_QUOTE_FAILURE', 'RENTAL_HOLD_CREATED']);
const PRIVATE = /[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?\d[\s().-]*){8,}|bearer\s|(?:password|token|otp|secret|signature)=/i;
const memory = new Map();
let state = null; let timer; let inFlight = false; let lastPage = '';
let ga4Id = ''; let serial = Promise.resolve(); const viewEvents = new Set();
const clean = (value, max = 80) => { const text = Array.from(String(value || '')).filter(char => char.charCodeAt(0) >= 32 && char !== '<' && char !== '>').join('').trim().slice(0, max); return PRIVATE.test(text) ? '[redacted]' : text; };
export function safeTrafficPath(route) {
  try {
    return new URL(route || '/', window.location.origin).pathname.split('/').map(segment => {
      let decoded; try { decoded = decodeURIComponent(segment); } catch { decoded = segment; }
      return PRIVATE.test(decoded) || decoded.length > 100 ? '[redacted]' : segment;
    }).join('/').slice(0, 300);
  } catch { return '/'; }
}
function id() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  if (!window.crypto?.getRandomValues) return '';
  return Array.from(window.crypto.getRandomValues(new Uint8Array(24)), byte => byte.toString(16).padStart(2, '0')).join('');
}
function read(key) { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : memory.get(key); } catch { return memory.get(key); } }
function write(key, value) { memory.set(key, value); try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Volatile, same-tab identities only when storage is blocked. */ } }
function remove(key) { memory.delete(key); try { localStorage.removeItem(key); } catch { /* optional */ } }
function readQueue(key) { try { return JSON.parse(sessionStorage.getItem(key) || '[]'); } catch { return memory.get(`session:${key}`) || []; } }
function writeQueue(key, value) { memory.set(`session:${key}`, value); try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* bounded volatile fallback */ } }
function removeQueue(key) { memory.delete(`session:${key}`); try { sessionStorage.removeItem(key); } catch { /* optional */ } }
const prefix = () => `traffic:${state.config.storeKey}:g${state.config.privacyGeneration}:`;
const preferenceKey = () => `traffic:${state.config.storeKey}:consent`;
export function trafficPreference() { return state ? read(preferenceKey())?.value || 'unknown' : 'unknown'; }
export function trafficAllowed() {
  if (!state || !state.config.enabled || state.internal || state.preview) return false;
  const path = boutiquePath(String(state.route || '/').split('?')[0]);
  if (/^\/(admin|seller|master|login|register|auth)(\/|$)/i.test(path)) return false;
  if ((state.config.excludedPaths || []).some(p => p === '/' || path === p || path.startsWith(`${p.replace(/\/$/, '')}/`))) return false;
  if (state.config.excludeLocalhost && /^(localhost|127\.|\[?::1\]?)/.test(window.location.hostname)) return false;
  if (navigator.globalPrivacyControl === true || navigator.doNotTrack === '1') return false;
  const preference = trafficPreference();
  return preference !== 'denied' && (!state.config.consentRequired || preference === 'granted');
}
function identity(touch = true) {
  if (!trafficAllowed()) return null;
  const now = Date.now();
  let visitor = read(`${prefix()}visitor`);
  if (!visitor || !visitor.visitorId || visitor.expiresAt <= now) {
    visitor = { visitorId: id(), deletionToken: id(), expiresAt: now + 365 * DAY };
    if (!visitor.visitorId || !visitor.deletionToken) return null;
    write(`${prefix()}visitor`, visitor);
  }
  let session = read(`${prefix()}session`);
  if (!session || now - session.lastActivity > state.config.sessionTimeoutMinutes * 60000 || now - session.startedAt > DAY) {
    session = { sessionId: id(), startedAt: now, lastActivity: now };
    write(`${prefix()}session`, session);
  }
  if (touch) { session.lastActivity = now; write(`${prefix()}session`, session); }
  return { ...visitor, ...session };
}
function device() {
  const ua = navigator.userAgent || '';
  return {
    device: /ipad|tablet|android(?!.*mobile)/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1) ? 'tablet' : /mobile|iphone|ipod/i.test(ua) ? 'mobile' : 'desktop',
    browser: /edg\//i.test(ua) ? 'Edge' : /opr\//i.test(ua) ? 'Opera' : /firefox/i.test(ua) ? 'Firefox' : /chrome|crios/i.test(ua) ? 'Chrome' : /safari/i.test(ua) ? 'Safari' : 'Other',
    os: /android/i.test(ua) ? 'Android' : /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1) ? 'iOS' : /windows/i.test(ua) ? 'Windows' : /macintosh/i.test(ua) ? 'macOS' : /linux/i.test(ua) ? 'Linux' : 'Other',
  };
}
function attribution(route = state?.route) {
  if (!trafficAllowed()) return {};
  const params = new URLSearchParams(String(route || '').split('?')[1] || '');
  let referrer = ''; try { const url = new URL(document.referrer); if (url.hostname !== window.location.hostname && !/(^|\.)razorpay\.com$/.test(url.hostname)) referrer = url.origin; } catch { /* missing referrer */ }
  let source = clean(params.get('utm_source') || params.get('source')).toLowerCase();
  let medium = clean(params.get('utm_medium'));
  if (!source && referrer) {
    const host = new URL(referrer).hostname;
    source = /(^|\.)google\.(com|co\.in|co\.uk|com\.au|ca|de|fr|co\.jp|ae|co\.nz|it|es|nl)$/.test(host) ? 'google' : /(^|\.)bing\.com$/.test(host) ? 'bing' : /(^|\.)instagram\.com$/.test(host) ? 'instagram' : /(^|\.)facebook\.com$/.test(host) ? 'facebook' : /(^|\.)(wa\.me|whatsapp\.com)$/.test(host) ? 'whatsapp' : 'referral';
    medium = ['google', 'bing'].includes(source) ? 'organic' : source === 'referral' ? 'referral' : 'social';
  }
  const key = `${prefix()}attribution`;
  let current = read(key);
  if (current?.expiresAt <= Date.now()) current = null;
  if (source && source !== 'direct' && source !== 'direct/unknown') {
    const next = { source, medium, campaign: clean(params.get('utm_campaign') || params.get('campaign')), reelId: clean(params.get('reel') || params.get('reelId')), capturedAt: Date.now(), expiresAt: Date.now() + state.config.attributionDays * DAY, firstSource: current?.firstSource || source };
    if (!current || current.source !== next.source || current.campaign !== next.campaign) { current = next; write(key, current); }
  }
  if (!current) { current = { source: 'direct/unknown', firstSource: 'direct/unknown', expiresAt: Date.now() + state.config.attributionDays * DAY }; write(key, current); }
  return { ...current, referrer };
}
export function readTrafficAttribution() {
  const value = attribution();
  return Object.fromEntries(['source', 'campaign', 'reelId', 'capturedAt', 'expiresAt'].filter(key => value[key] !== undefined).map(key => [key, value[key]]));
}
export function getTrafficContext() {
  const value = identity(false);
  return value ? { visitorId: value.visitorId, sessionId: value.sessionId, consent: true } : undefined;
}
function persistQueue() { if (state) writeQueue(`${prefix()}queue`, state.queue.slice(-LIMIT)); }
function schedule(delay = 5000) { if (!timer && state) timer = window.setTimeout(() => { timer = null; flushTraffic().catch(() => {}); }, delay); }
function notify() { window.dispatchEvent(new Event(TRAFFIC_CHANGE_EVENT)); }
function stopGa4() {
  if (!ga4Id) return;
  window[`ga-disable-${ga4Id}`] = true;
  window.gtag?.('consent', 'update', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  ga4Id = '';
}
function ga4Page(path) {
  const config = state?.config;
  if (!trafficAllowed() || trafficPreference() !== 'granted' || !config.ga4Enabled || !/^G-[A-Z0-9]{4,20}$/.test(config.ga4MeasurementId || '')) return;
  const measurement = config.ga4MeasurementId;
  if (ga4Id && ga4Id !== measurement) stopGa4();
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  if (ga4Id !== measurement) {
    window[`ga-disable-${measurement}`] = false;
    window.gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    window.gtag('js', new Date());
    window.gtag('consent', 'update', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    window.gtag('config', measurement, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false, cookie_prefix: `traffic_${config.storeKey}`, page_location: `${window.location.origin}${path}`, page_referrer: attribution().referrer || '', page_title: 'Storefront' });
    if (!document.getElementById('store-analytics-tag')) { const script = document.createElement('script'); script.id = 'store-analytics-tag'; script.async = true; script.src = `https://www.googletagmanager.com/gtag/js?id=${measurement}`; document.head.appendChild(script); }
    ga4Id = measurement;
  }
  window.gtag('event', 'page_view', { send_to: measurement, page_location: `${window.location.origin}${path}`, page_title: 'Storefront', page_referrer: attribution().referrer || '' });
}
export function configureTraffic(config, context) {
  const same = state?.config.storeKey === config.storeKey && state?.config.privacyGeneration === config.privacyGeneration;
  if (state?.config.storeKey === config.storeKey && !same) clearOwnStorage();
  if (!same) { stopGa4(); lastPage = ''; }
  if (timer) window.clearTimeout(timer); timer = null;
  state = { config, ...context, queue: same ? state.queue : [], attempts: 0 };
  if (trafficAllowed()) {
    const saved = same ? state.queue : readQueue(`${prefix()}queue`);
    state.queue = saved.filter(event => Date.now() - Date.parse(event.occurredAt) < DAY).slice(-LIMIT);
    attribution(); if (state.queue.length) schedule();
  } else { state.queue = []; removeQueue(`${prefix()}queue`); stopGa4(); }
  notify();
}
export function updateTrafficRoute(route, internal = false) {
  if (!state) return;
  state.route = route; state.internal = internal;
  if (!trafficAllowed()) { stopGa4(); return; }
  attribution();
  // React effect replay/rerenders must not manufacture a second page view.
  // A genuine refresh starts a new runtime and remains a new page view.
  if (lastPage === route) return;
  lastPage = route;
  viewEvents.clear();
  recordTrafficEvent('PAGE_VIEW'); ga4Page(safeTrafficPath(route));
}
export function recordTrafficEvent(name, extra = {}) {
  if (!PUBLIC.has(name) || !trafficAllowed()) return false;
  const active = state;
  const capturedRoute = state.route;
  const capturedSource = attribution(capturedRoute);
  const occurredAt = new Date().toISOString();
  const enqueue = () => {
    if (state !== active || !trafficAllowed()) return;
    const visitor = identity(); if (!visitor) return;
    if (['PRODUCT_VIEW', 'BEGIN_CHECKOUT', 'CHECKOUT_START', 'STORE_VIEW'].includes(name)) {
      const viewKey = `${visitor.sessionId}:${name}:${extra.productId || ''}`;
      if (viewEvents.has(viewKey)) return;
      viewEvents.add(viewKey);
    }
    const source = capturedSource;
    const event = {
      eventId: id(), visitorId: visitor.visitorId, sessionId: visitor.sessionId, name: name === 'CHECKOUT_START' ? 'BEGIN_CHECKOUT' : name,
      occurredAt, path: safeTrafficPath(capturedRoute), ...device(), source: source.source, firstSource: source.firstSource, medium: source.medium, campaign: source.campaign, referrer: source.referrer,
      ...(/^[a-f\d]{24}$/i.test(extra.productId || '') ? { productId: extra.productId } : {}),
      ...(name === 'SEARCH' ? { searchQuery: clean(extra.searchQuery || extra.query, 120) } : {}),
      ...(name === 'ENGAGEMENT' ? { engagementMs: Math.max(0, Math.min(15000, Number(extra.engagementMs) || 0)) } : {}),
      metadata: Object.fromEntries(['surface', 'sectionId', 'categoryId', 'categoryName', 'action', 'milestone', 'bannerId', 'placement'].filter(key => extra.metadata?.[key] !== undefined).map(key => [key, clean(extra.metadata[key], 100)])),
      ...(extra.categoryId ? { categoryId: clean(extra.categoryId) } : {}),
    };
    if (!event.eventId) return;
    active.queue = [...active.queue, event].slice(-LIMIT); persistQueue(); schedule(active.queue.length >= 20 ? 0 : 5000);
  };
  serial = serial.then(() => navigator.locks?.request ? navigator.locks.request(`traffic-session-${active.config.storeKey}`, enqueue) : enqueue()).catch(() => {});
  return true;
}
function collectionUrl(endpoint = 'collect', current = state) {
  return `${getApiBaseUrl()}/analytics/${endpoint}${current?.storeSlug ? `?store=${encodeURIComponent(current.storeSlug)}` : ''}`;
}
export async function flushTraffic(background = false) {
  await serial;
  if (inFlight || !trafficAllowed() || !state.queue.length) return;
  const active = state;
  active.queue = active.queue.filter(event => Date.now() - Date.parse(event.occurredAt) < DAY);
  const batch = active.queue.slice(0, 20); if (!batch.length) { persistQueue(); return; }
  const visitor = read(`${prefix()}visitor`); if (!visitor) return;
  const body = JSON.stringify({ events: batch, deletionToken: visitor.deletionToken, consent: trafficPreference() === 'granted', privacyGeneration: active.config.privacyGeneration });
  if (background && navigator.sendBeacon) {
    // Queue acceptance is not a server acknowledgement. Keep event IDs for a
    // later deduplicated retry; never lose events just because beacon returned true.
    try { if (navigator.sendBeacon(collectionUrl(), new Blob([body], { type: 'application/json' }))) return; } catch { /* use keepalive */ }
  }
  inFlight = true;
  const controller = new AbortController(); const timeout = window.setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(collectionUrl(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit', body, keepalive: true, signal: controller.signal });
    if (!response.ok) throw new Error('Analytics batch not acknowledged');
    const result = await response.json();
    if (state !== active) return;
    const sent = new Set(batch.map(event => event.eventId)); active.queue = active.queue.filter(event => !sent.has(event.eventId)); active.attempts = 0;
    if (result.ignored) { active.queue = []; if (['settings_changed', 'consent_required', 'disabled', 'withdrawn'].includes(result.reason)) window.dispatchEvent(new Event('store:traffic-reload')); }
    persistQueue();
  } catch {
    if (state === active) {
      active.attempts += 1;
      if (active.attempts >= 5) { const expired = new Set(batch.map(event => event.eventId)); active.queue = active.queue.filter(event => !expired.has(event.eventId)); active.attempts = 0; persistQueue(); }
    }
  } finally {
    window.clearTimeout(timeout); inFlight = false;
    if (state?.queue.length && trafficAllowed()) schedule(Math.min(60000, 5000 * 2 ** state.attempts) + Math.random() * 500);
  }
}
function clearOwnStorage() {
  if (!state) return;
  const own = `traffic:${state.config.storeKey}:g`;
  const keys = [...memory.keys()];
  try { for (let i = 0; i < localStorage.length; i += 1) keys.push(localStorage.key(i)); } catch { /* optional */ }
  [...new Set(keys)].filter(key => key?.startsWith(own)).forEach(remove);
  try { const queueKeys = []; for (let i = 0; i < sessionStorage.length; i += 1) if (sessionStorage.key(i)?.startsWith(own)) queueKeys.push(sessionStorage.key(i)); queueKeys.forEach(removeQueue); } catch { /* optional */ }
  const cookiePrefix = `traffic_${state.config.storeKey}`;
  document.cookie.split(';').map(part => part.trim().split('=')[0]).filter(name => name.startsWith(cookiePrefix)).forEach(name => {
    for (const domain of ['', `;domain=${window.location.hostname}`, `;domain=.${window.location.hostname}`]) document.cookie = `${name}=;max-age=0;path=/${domain}`;
  });
}
export async function setTrafficConsent(allowed, erase = false) {
  if (!state) return;
  const current = state;
  const visitor = read(`${prefix()}visitor`);
  write(preferenceKey(), { value: allowed ? 'granted' : 'denied' });
  if (!allowed) {
    current.queue = []; if (timer) window.clearTimeout(timer); timer = null; stopGa4();
    if (visitor) {
      // Keep only the deletion credential when offline, so a later visit can
      // finish the withdrawal without retaining browsing events.
      write(`traffic:${current.config.storeKey}:pending-delete`, { visitorId: visitor.visitorId, deletionToken: visitor.deletionToken, requestedAt: Date.now() });
    }
    clearOwnStorage(); lastPage = '';
  }
  notify();
  if (allowed) updateTrafficRoute(current.route, current.internal);
  if (!allowed && (erase || visitor)) await retryTrafficDeletion();
}
export async function retryTrafficDeletion() {
  if (!state) return false;
  const current = state; const key = `traffic:${current.config.storeKey}:pending-delete`; const pending = read(key);
  if (!pending) return true;
  const controller = new AbortController(); const timeout = window.setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(collectionUrl('forget', current), { method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visitorId: pending.visitorId, deletionToken: pending.deletionToken }), keepalive: true, signal: controller.signal });
    if (response.ok) { remove(key); return true; }
  } catch { /* Retry on a future online event/visit; collection remains denied. */ }
  finally { window.clearTimeout(timeout); }
  return false;
}
export function engagementLeader() {
  if (!trafficAllowed()) return false;
  const key = `${prefix()}leader`; const current = read(key); const now = Date.now();
  if (current?.until > now && current.tab !== state.tabId) return false;
  write(key, { tab: state.tabId, until: now + 17000 }); return true;
}
export function resetTrafficRuntime() { if (timer) window.clearTimeout(timer); timer = null; state = null; lastPage = ''; inFlight = false; serial = Promise.resolve(); viewEvents.clear(); memory.clear(); stopGa4(); }
export function suspendTraffic() { if (timer) window.clearTimeout(timer); timer = null; state = null; lastPage = ''; viewEvents.clear(); stopGa4(); }
