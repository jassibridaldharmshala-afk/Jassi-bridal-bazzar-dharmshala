import { configureTraffic, recordTrafficEvent, flushTraffic, setTrafficConsent, getTrafficContext, updateTrafficRoute, resetTrafficRuntime, safeTrafficPath, trafficAllowed, readTrafficAttribution } from './trafficTracker';
const config = { storeKey: 'brand-a', privacyGeneration: 1, enabled: true, consentRequired: true, sessionTimeoutMinutes: 30, attributionDays: 7, excludeLocalhost: false, excludedPaths: [], ga4Enabled: false };
const context = { route: '/', storeSlug: 'brand-a', tabId: 'tab-a' };
let originalFetch;
let sequence = 0;
beforeAll(() => Object.defineProperty(window, 'crypto', { configurable: true, value: { randomUUID: () => `test_uuid_${String(++sequence).padStart(24, '0')}` } }));
beforeEach(() => { originalFetch = global.fetch; global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ accepted: 20 }) }); localStorage.clear(); sessionStorage.clear(); resetTrafficRuntime(); });
afterEach(() => { resetTrafficRuntime(); global.fetch = originalFetch; jest.useRealTimers(); jest.restoreAllMocks(); });
const batches = () => global.fetch.mock.calls.filter(([url]) => url.includes('/collect')).map(([, options]) => JSON.parse(options.body));
test('no consent means no visitor ID, persistent queue or collection', async () => {
  configureTraffic(config, context); expect(recordTrafficEvent('PAGE_VIEW')).toBe(false); await flushTraffic();
  expect(getTrafficContext()).toBeUndefined(); expect(global.fetch).not.toHaveBeenCalled(); expect(localStorage.length).toBe(0);
});
test('refresh keeps visitor/session but records a new page view; config refresh does not', async () => {
  configureTraffic(config, context); await setTrafficConsent(true); const before = getTrafficContext(); await flushTraffic();
  configureTraffic(config, context); updateTrafficRoute('/'); await flushTraffic(); expect(batches().length).toBe(1);
  resetTrafficRuntime(); configureTraffic(config, context); updateTrafficRoute('/'); await flushTraffic();
  expect(getTrafficContext()).toEqual(before); expect(batches()[1].events[0].name).toBe('PAGE_VIEW');
});
test('a new analytics session starts after inactivity without changing guest-cart or login keys', async () => {
  jest.spyOn(Date, 'now').mockReturnValue(1000000);
  localStorage.setItem('samira_token', 'login-token'); sessionStorage.setItem('samira_session_id', 'guest-cart-session');
  configureTraffic(config, context); await setTrafficConsent(true); await flushTraffic(); const before = getTrafficContext();
  Date.now.mockReturnValue(1000000 + 31 * 60000); recordTrafficEvent('PAGE_VIEW'); await flushTraffic();
  expect(getTrafficContext().visitorId).toBe(before.visitorId); expect(getTrafficContext().sessionId).not.toBe(before.sessionId);
  expect(localStorage.getItem('samira_token')).toBe('login-token'); expect(sessionStorage.getItem('samira_session_id')).toBe('guest-cart-session'); Date.now.mockRestore();
});
test('SPA navigation counts once and redacts query/search/metadata secrets', async () => {
  configureTraffic(config, context); await setTrafficConsent(true); updateTrafficRoute('/products?token=abc&email=person@example.com'); updateTrafficRoute('/products?token=abc&email=person@example.com');
  recordTrafficEvent('SEARCH', { query: 'person@example.com', metadata: { otp: '123456', token: 'secret' } }); await flushTraffic();
  const events = batches().flatMap(batch => batch.events); expect(events.filter(event => event.name === 'PAGE_VIEW')).toHaveLength(2);
  expect(JSON.stringify(events)).not.toMatch(/person@example|token=abc|123456|secret/); expect(events.find(event => event.name === 'SEARCH').searchQuery).toBe('[redacted]');
});
test('private routes, previews, explicit exclusions and financial events are never collected', async () => {
  configureTraffic(config, context); await setTrafficConsent(true); await flushTraffic(); global.fetch.mockClear();
  updateTrafficRoute('/admin/orders'); expect(recordTrafficEvent('PAGE_VIEW')).toBe(false);
  configureTraffic({ ...config, excludedPaths: ['/'] }, context); expect(trafficAllowed()).toBe(false);
  configureTraffic(config, { ...context, preview: true }); expect(recordTrafficEvent('PAGE_VIEW')).toBe(false);
  configureTraffic(config, context); expect(recordTrafficEvent('PURCHASE')).toBe(false); await flushTraffic(); expect(global.fetch).not.toHaveBeenCalled();
});
test('separate stores never share visitor identity, consent, queues or campaign attribution', async () => {
  configureTraffic(config, { ...context, route: '/?utm_source=instagram&utm_campaign=launch' }); await setTrafficConsent(true); await flushTraffic(); const a = getTrafficContext();
  expect(readTrafficAttribution().source).toBe('instagram');
  configureTraffic({ ...config, storeKey: 'brand-b' }, { ...context, storeSlug: 'brand-b' }); expect(getTrafficContext()).toBeUndefined();
  await setTrafficConsent(true); await flushTraffic(); expect(getTrafficContext().visitorId).not.toBe(a.visitorId); expect(readTrafficAttribution().source).toBe('direct/unknown');
});
test('withdrawal stops tracking, clears events and preserves offline deletion for retry', async () => {
  configureTraffic(config, context); await setTrafficConsent(true); await flushTraffic();
  global.fetch.mockRejectedValue(new Error('offline')); await setTrafficConsent(false, true);
  expect(recordTrafficEvent('ADD_TO_CART')).toBe(false); expect(getTrafficContext()).toBeUndefined();
  expect(sessionStorage.getItem('traffic:brand-a:g1:queue')).toBeNull(); expect(localStorage.getItem('traffic:brand-a:pending-delete')).toContain('deletionToken');
});
test('beacon queueing is not treated as server acknowledgement and retries retain event IDs', async () => {
  configureTraffic(config, context); await setTrafficConsent(true);
  Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: jest.fn(() => true) });
  await flushTraffic(true); const saved = JSON.parse(sessionStorage.getItem('traffic:brand-a:g1:queue'));
  expect(saved.length).toBeGreaterThan(0); await flushTraffic(); expect(batches()[0].events[0].eventId).toBe(saved[0].eventId);
  delete navigator.sendBeacon;
});
test('queues and batches are bounded and unsafe path segments are masked', async () => {
  configureTraffic(config, context); await setTrafficConsent(true);
  for (let i = 0; i < 200; i += 1) recordTrafficEvent('HOME_SCROLL', { metadata: { milestone: i } });
  await flushTraffic(); expect(batches()[0].events).toHaveLength(20); expect(JSON.parse(sessionStorage.getItem('traffic:brand-a:g1:queue')).length).toBeLessThanOrEqual(100);
  expect(safeTrafficPath('/profile/person%40example.com?otp=123')).toBe('/profile/[redacted]');
});
test('blocked browser storage uses bounded volatile identities without breaking shopping', async () => {
  jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage blocked'); });
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage blocked'); });
  jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('Storage blocked'); });
  configureTraffic(config, context); await setTrafficConsent(true); const visitor = getTrafficContext();
  recordTrafficEvent('ADD_TO_CART'); await flushTraffic();
  expect(visitor).toBeDefined(); expect(getTrafficContext()).toEqual(visitor); expect(batches()[0].events).toHaveLength(2);
});
test('another tab shares visitor/visit identity while retaining its own pending batch', async () => {
  configureTraffic(config, context); await setTrafficConsent(true); await flushTraffic(); const before = getTrafficContext();
  recordTrafficEvent('ADD_TO_CART'); await Promise.resolve(); await Promise.resolve();
  const firstTab = sessionStorage.getItem('traffic:brand-a:g1:queue'); resetTrafficRuntime(); sessionStorage.clear();
  configureTraffic(config, { ...context, tabId: 'tab-b' }); updateTrafficRoute('/products'); await flushTraffic();
  expect(getTrafficContext()).toEqual(before); expect(firstTab).toContain('ADD_TO_CART');
  expect(batches().at(-1).events.map(event => event.name)).toEqual(['PAGE_VIEW']);
});
test('optional GA4 cannot load before consent and withdrawal disables its tag', async () => {
  const measurement = 'G-ABCDEF'; configureTraffic({ ...config, ga4Enabled: true, ga4MeasurementId: measurement }, context);
  expect(document.getElementById('store-analytics-tag')).toBeNull(); await setTrafficConsent(true);
  expect(document.getElementById('store-analytics-tag').getAttribute('src')).toBe(`https://www.googletagmanager.com/gtag/js?id=${measurement}`);
  await setTrafficConsent(false, true); expect(window[`ga-disable-${measurement}`]).toBe(true);
  document.getElementById('store-analytics-tag').remove(); delete window.gtag; delete window.dataLayer;
});
