import api from './api';
import { startMobileLoader, stopMobileLoader } from '../utils/mobileLoader';
import { trackEvent } from '../utils/analytics';
import { configureTraffic, setTrafficConsent, flushTraffic, resetTrafficRuntime } from '../utils/trafficTracker';

const mockUnsubscribe = jest.fn();

test('workflow document AI shows sanitized configuration guidance while unrelated 503 errors stay generic', async () => {
  mockDispatch.mockReturnValue({ unwrap: () => Promise.reject({ status: 503, data: { code: 'AI_KEY_MISSING', message: 'Configure document extraction. Pasted notes still work.' } }) });
  await expect(api.post('/admin/smart-fill/preview', {})).rejects.toMatchObject({ code: 'AI_KEY_MISSING', message: 'Configure document extraction. Pasted notes still work.' });
  await expect(api.post('/admin/orders', {})).rejects.toMatchObject({ message: 'Checkout service is temporarily unavailable. Please try again in a few minutes.' });
});

test('Smart Fill can be cancelled without opening the global mobile loader', async () => {
  const abort = jest.fn();
  let finish;
  mockDispatch.mockReturnValue({ unwrap: () => new Promise(resolve => { finish = resolve; }), abort });
  const controller = new AbortController();
  const pending = api.post('/admin/products/smart-fill', { notes: 'Wine saree' }, { silent: true, signal: controller.signal });
  expect(mockInitiateMutation).toHaveBeenCalledWith({ path: '/admin/products/smart-fill', method: 'POST', body: { notes: 'Wine saree' }, silent: true });
  controller.abort(); expect(abort).toHaveBeenCalledTimes(1);
  finish({ suggestion: {} }); await pending;
  expect(startMobileLoader).not.toHaveBeenCalled(); expect(stopMobileLoader).not.toHaveBeenCalled();
});
const mockInitiateQuery = jest.fn(() => ({ type: 'query-request' }));
const mockInitiateMutation = jest.fn(() => ({ type: 'mutation-request' }));
const mockDispatch = jest.fn(() => ({
  unwrap: jest.fn().mockResolvedValue({ success: true, data: { progress: 32 } }),
  unsubscribe: mockUnsubscribe,
}));

jest.mock('../store/apiSlice', () => ({
  samiraApi: {
    endpoints: {
      request: { initiate: (...args) => mockInitiateQuery(...args) },
      mutate: { initiate: (...args) => mockInitiateMutation(...args) },
      upload: { initiate: jest.fn() },
    },
  },
}));
jest.mock('../store/store', () => ({ store: { dispatch: (...args) => mockDispatch(...args), getState: () => ({ auth: { token: 'master-token' } }) } }));
jest.mock('../utils/mobileLoader', () => ({ startMobileLoader: jest.fn(), stopMobileLoader: jest.fn() }));
jest.mock('./imageCompression', () => ({ compressImageFile: jest.fn(), isSupportedImageFile: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  mockDispatch.mockImplementation(() => ({
    unwrap: jest.fn().mockResolvedValue({ success: true, data: { progress: 32 } }),
    unsubscribe: mockUnsubscribe,
  }));
});

test('imperative GET requests force a network refresh instead of returning stale RTK cache data', async () => {
  const response = await api.get('/admin/reel-imports/job-1');

  expect(response).toEqual({ success: true, data: { progress: 32 } });
  expect(mockInitiateQuery).toHaveBeenCalledWith(
    { path: '/admin/reel-imports/job-1', silent: undefined },
    { forceRefetch: true, subscribe: false },
  );
  expect(mockUnsubscribe).toHaveBeenCalled();
});

test('storefront cache-first GET reuses Redux data and refreshes silently when required', async () => {
  await api.get('/products?limit=8', { cacheFirst: true, cacheScope: 'boutique-a' });

  expect(mockInitiateQuery).toHaveBeenCalledWith(
    { path: '/products?limit=8', silent: undefined, silentWhenCached: true, cacheScope: 'boutique-a' },
    { forceRefetch: false, subscribe: false },
  );
  expect(startMobileLoader).not.toHaveBeenCalled();
  expect(stopMobileLoader).not.toHaveBeenCalled();
});

test('background notification polling does not trigger the mobile loading overlay', async () => {
  await api.get('/notifications/summary', { silent: true });
  expect(mockInitiateQuery).toHaveBeenCalledWith({ path: '/notifications/summary', silent: true }, { forceRefetch: true, subscribe: false });
  expect(startMobileLoader).not.toHaveBeenCalled();
  expect(stopMobileLoader).not.toHaveBeenCalled();
});

test('consented batched analytics never trigger the mobile loading overlay or authenticated API middleware', async () => {
  resetTrafficRuntime(); localStorage.clear();
  let sequence = 0;
  Object.defineProperty(window, 'crypto', { configurable: true, value: { randomUUID: () => `test_uuid_${String(++sequence).padStart(24, '0')}` } });
  const originalFetch = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ accepted: 2 }) });
  configureTraffic({ storeKey: 'test-traffic-store', privacyGeneration: 1, enabled: true, consentRequired: true, sessionTimeoutMinutes: 30, attributionDays: 7, excludeLocalhost: false }, { route: '/', storeSlug: 'test-shop' });
  await setTrafficConsent(true);
  trackEvent('HOME_SCROLL', { metadata: { milestone: 50, surface: 'mobile-home' } });
  await flushTraffic();
  expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/analytics/collect?store=test-shop'), expect.objectContaining({
    method: 'POST',
    credentials: 'omit',
  }));
  expect(mockInitiateMutation).not.toHaveBeenCalled();
  expect(startMobileLoader).not.toHaveBeenCalled();
  expect(stopMobileLoader).not.toHaveBeenCalled();
  resetTrafficRuntime(); global.fetch = originalFetch;
});

test('bag requests use separate query identities for guests and customer accounts', async () => {
  await api.get('/cart', { silent: true, cacheScope: 'guest' });
  await api.get('/cart', { silent: true, cacheScope: 'customer-1' });
  expect(mockInitiateQuery).toHaveBeenNthCalledWith(1, { path: '/cart', silent: true, cacheScope: 'guest' }, { forceRefetch: true, subscribe: false });
  expect(mockInitiateQuery).toHaveBeenNthCalledWith(2, { path: '/cart', silent: true, cacheScope: 'customer-1' }, { forceRefetch: true, subscribe: false });
});

test('project downloads use bearer authentication and the secure refresh cookie', async () => {
  const archive = new Blob(['PK'], { type: 'application/zip' });
  global.fetch = jest.fn().mockResolvedValue({ ok: true, blob: jest.fn().mockResolvedValue(archive) });
  await expect(api.download('/master/projects/generate', { industry: 'mobile' })).resolves.toBe(archive);
  expect(global.fetch).toHaveBeenCalledWith('http://localhost:5000/api/master/projects/generate', expect.objectContaining({
    method: 'POST',
    headers: expect.objectContaining({ Authorization: 'Bearer master-token' }),
  }));
  expect(global.fetch.mock.calls[0][1]).toHaveProperty('credentials', 'include');
});

test.each([
  ['OTP_PROVIDER_AUTH_FAILED', 'SMS login is unavailable because the SMS provider rejected the store credentials. Please contact support.'],
  ['OTP_PROVIDER_NOT_CONFIGURED', 'SMS login has not been configured for this account. Please contact support.'],
  ['OTP_DELIVERY_UNAVAILABLE', 'We could not send your OTP. Please try again shortly or contact support if this continues.'],
  ['SERVICE_UNAVAILABLE', 'Login service is temporarily unavailable. Please try again in a few minutes.'],
])('login preserves safe delivery guidance for %s without displaying provider data', async (code, message) => {
  mockDispatch.mockReturnValue({ unwrap: () => Promise.reject({ status: 503, data: { code, message: 'private-provider-data' } }) });
  await expect(api.post('/auth/send-otp', { phone: '9876543210' })).rejects.toMatchObject({ status: 503, code, message });
});
