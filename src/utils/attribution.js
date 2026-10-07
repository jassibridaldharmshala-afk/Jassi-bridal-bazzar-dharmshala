import { boutiquePath } from './routing';

const ATTRIBUTION_KEY = 'samira_attribution';
const STORE_SLUG_KEY = 'samira_store_slug';
const SESSION_KEY = 'samira_session_id';
const ATTRIBUTION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function parseHashQuery(route = '') {
  const query = route.includes('?') ? route.slice(route.indexOf('?') + 1) : '';
  return new URLSearchParams(query);
}

export function parseStoreSlug(route = '') {
  const path = boutiquePath(String(route).split('?')[0] || '/');
  const parts = path.split('/').filter(Boolean);
  if (parts[0] === 'store' && parts[1]) return parts[1];
  return '';
}

export function getOrCreateSessionId() {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id = `ses_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return '';
  }
}

export function captureAttribution(route = '') {
  const params = parseHashQuery(route);
  const source = params.get('source') || params.get('utm_source') || '';
  const campaign = params.get('campaign') || params.get('utm_campaign') || '';
  const reelId = params.get('reel') || params.get('reelId') || '';
  if (!source && !campaign && !reelId) return readAttribution();
  const capturedAt = Date.now();
  const attribution = { source, campaign, reelId, capturedAt, expiresAt: capturedAt + ATTRIBUTION_WINDOW_MS };
  try {
    sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
  } catch {
    // ignore storage failures
  }
  return attribution;
}

export function readAttribution() {
  try {
    const attribution = JSON.parse(sessionStorage.getItem(ATTRIBUTION_KEY) || '{}');
    if (attribution.expiresAt && Number(attribution.expiresAt) <= Date.now()) {
      sessionStorage.removeItem(ATTRIBUTION_KEY);
      return {};
    }
    return attribution;
  } catch {
    return {};
  }
}

export { ATTRIBUTION_WINDOW_MS };

export function setStoreSlug(slug) {
  try {
    if (slug) sessionStorage.setItem(STORE_SLUG_KEY, slug);
    else sessionStorage.removeItem(STORE_SLUG_KEY);
  } catch {
    // ignore
  }
}

export function readStoreSlug() {
  try {
    return sessionStorage.getItem(STORE_SLUG_KEY) || '';
  } catch {
    return '';
  }
}
