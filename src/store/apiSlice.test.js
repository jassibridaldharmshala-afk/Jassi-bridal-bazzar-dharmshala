import { configureStore } from '@reduxjs/toolkit';
import { waitFor } from '@testing-library/react';
import authReducer, { logout, setCredentials } from './authSlice';
import { samiraApi } from './apiSlice';
import { startMobileLoader, stopMobileLoader } from '../utils/mobileLoader';
import { STOREFRONT_READ_TIMEOUT } from './storefrontTransport';
import { getDurableUploadRetryKey, hasUploadAttempt, retainUploadedReceipt, uploadScope } from '../services/uploadRetry';
test('multipart condition proof uploads preserve stage/consent/revision fields and stay silent', async () => {
  mockRawQuery.mockResolvedValue({ data: { booking: { revision: 5 } } });
  const photo = new File(['photo'], 'photo.webp', { type: 'image/webp' });
  await testStore.dispatch(samiraApi.endpoints.upload.initiate({ path: '/admin/rentals/bookings/b/proofs', files: [photo], silent: true, fields: { stage: 'RETURN', consent: true, revision: 4, assetId: 'piece1' } })).unwrap();
  const body = mockRawQuery.mock.calls[0][0].body;
  expect(body).toBeInstanceOf(FormData); expect(body.get('stage')).toBe('RETURN'); expect(body.get('revision')).toBe('4'); expect(body.get('consent')).toBe('true'); expect(body.getAll('images')).toHaveLength(1);
  expect(startMobileLoader).not.toHaveBeenCalled();
});

test('bulk draft retries preserve the upload key while a changed grouping is a new operation', async () => {
  const photo = new File(['photo'], 'photo.webp', { type: 'image/webp' });
  mockRawQuery.mockResolvedValueOnce({ error: { status: 500, data: { message: 'Save failed' } } }).mockResolvedValue({ data: { success: true, data: { drafts: [] } } });
  await testStore.dispatch(samiraApi.endpoints.bulkUploadProductDrafts.initiate({ files: [photo], groupMode: 'single' }));
  await testStore.dispatch(samiraApi.endpoints.bulkUploadProductDrafts.initiate({ files: [photo], groupMode: 'single' })).unwrap();
  await testStore.dispatch(samiraApi.endpoints.bulkUploadProductDrafts.initiate({ files: [photo], groupMode: 'separate' })).unwrap();
  const keys = mockRawQuery.mock.calls.map(([value]) => value.headers['Idempotency-Key']);
  expect(keys[0]).toBe(keys[1]); expect(keys[2]).not.toBe(keys[0]);
  expect(mockRawQuery.mock.calls[0][0].body).toBeInstanceOf(FormData);
  expect(mockRawQuery.mock.calls[1][0].body).toEqual({ resumeUpload: true });
});

test('an incomplete bulk receipt continues the multipart upload with the original key', async () => {
  const photo = new File(['photo'], 'retry.webp', { type: 'image/webp' });
  mockRawQuery.mockResolvedValueOnce({ error: { status: 'FETCH_ERROR' } });
  await testStore.dispatch(samiraApi.endpoints.bulkUploadProductDrafts.initiate({ files: [photo] }));
  mockRawQuery.mockResolvedValueOnce({ error: { status: 409, data: { code: 'UPLOAD_INCOMPLETE' } } }).mockResolvedValue({ data: { success: true } });
  await testStore.dispatch(samiraApi.endpoints.bulkUploadProductDrafts.initiate({ files: [photo] })).unwrap();
  expect(mockRawQuery.mock.calls[1][0].body).toEqual({ resumeUpload: true });
  expect(mockRawQuery.mock.calls[2][0].body).toBeInstanceOf(FormData);
  expect(mockRawQuery.mock.calls[0][0].headers['Idempotency-Key']).toBe(mockRawQuery.mock.calls[2][0].headers['Idempotency-Key']);
});

test('Smart Fill suggestions do not refetch catalog subscriptions or block the mobile screen', async () => {
  mockRawQuery.mockResolvedValue({ data: [] });
  const catalog = testStore.dispatch(samiraApi.endpoints.request.initiate({ path: '/admin/products' }));
  await catalog.unwrap(); jest.clearAllMocks();
  await testStore.dispatch(samiraApi.endpoints.mutate.initiate({ path: '/admin/products/smart-fill', body: { notes: 'Saree' }, silent: true })).unwrap();
  expect(mockRawQuery).toHaveBeenCalledTimes(1);
  expect(mockRawQuery.mock.calls[0][0].url).toBe('/admin/products/smart-fill');
  expect(startMobileLoader).not.toHaveBeenCalled(); catalog.unsubscribe();
});

const mockRawQuery = jest.fn();

test('workflow previews never invalidate subscribed catalogs, but reviewed catalog saves do', async () => {
  mockRawQuery.mockResolvedValue({ data: [] });
  const catalog = testStore.dispatch(samiraApi.endpoints.request.initiate({ path: '/admin/products' }));
  await catalog.unwrap(); jest.clearAllMocks();
  for (const path of ['/admin/smart-fill/preview', '/seller/smart-fill/catalog/preview']) {
    await testStore.dispatch(samiraApi.endpoints.mutate.initiate({ path, body: {}, silent: true })).unwrap();
  }
  expect(mockRawQuery).toHaveBeenCalledTimes(2);
  await testStore.dispatch(samiraApi.endpoints.mutate.initiate({ path: '/admin/smart-fill/catalog/save', body: {}, silent: true })).unwrap();
  await waitFor(() => expect(mockRawQuery.mock.calls.some(([args]) => args.url === '/admin/products')).toBe(true));
  expect(startMobileLoader).not.toHaveBeenCalled(); catalog.unsubscribe();
});
let mockBaseOptions;
// CRA's Jest resolver predates conditional package exports; use the package's
// CommonJS build while exercising the actual Redux Query implementation.
jest.mock('@standard-schema/utils', () => jest.requireActual('../../node_modules/@standard-schema/utils/dist/index.cjs'));
jest.mock('@reduxjs/toolkit/query/react', () => ({
  ...jest.requireActual('@reduxjs/toolkit/query/react'),
  fetchBaseQuery: options => (...args) => { mockBaseOptions = options; return mockRawQuery(...args); },
}));
jest.mock('../utils/mobileLoader', () => ({ startMobileLoader: jest.fn(), stopMobileLoader: jest.fn() }));

const user = { _id: 'admin-one', role: 'admin', activeMode: 'admin' };
const original = { user, token: 'expired-access', refreshToken: 'valid-refresh' };
const renewed = { user, token: 'renewed-access', refreshToken: 'renewed-refresh' };
const unauthorized = { error: { status: 401, data: { message: 'Token expired' } } };
let testStore;
function request(path) {
  return testStore.dispatch(samiraApi.endpoints.request.initiate({ path }, { subscribe: false }));
}
function defer() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); jest.clearAllMocks();
  testStore = configureStore({
    reducer: { auth: authReducer, [samiraApi.reducerPath]: samiraApi.reducer },
    middleware: (defaults) => defaults().concat(samiraApi.middleware),
  });
  testStore.dispatch(setCredentials(original));
});
afterEach(() => testStore.dispatch(samiraApi.util.resetApiState()));

test('typed create requests automatically retain a retry key after failure and clear it after confirmation', async () => {
  mockRawQuery.mockResolvedValueOnce({ error: { status: 'FETCH_ERROR' } }).mockResolvedValue({ data: { success: true, data: { _id: 'saved' } } });
  const action = () => testStore.dispatch(samiraApi.endpoints.mutate.initiate({ path: '/admin/product-drafts', method: 'POST', body: { name: 'Typed draft' } }));
  await action(); await action().unwrap(); await action().unwrap();
  const keys = mockRawQuery.mock.calls.map(([value]) => value.headers['Idempotency-Key']);
  expect(keys[0]).toMatch(/^[a-zA-Z0-9_-]{16,100}$/); expect(keys[1]).toBe(keys[0]); expect(keys[2]).not.toBe(keys[0]);
});

test('only a successful business mutation releases its referenced media receipt', async () => {
  const options = { path: '/admin/uploads', files: [new File(['one'], 'one.webp')], scope: uploadScope(testStore.getState().auth) };
  const key = await getDurableUploadRetryKey(options);
  await retainUploadedReceipt(key, [{ url: '/uploads/one.webp' }]);
  mockRawQuery.mockResolvedValueOnce({ error: { status: 503 } }).mockResolvedValue({ data: { success: true } });
  const action = () => testStore.dispatch(samiraApi.endpoints.mutate.initiate({ path: '/admin/products/one', method: 'PUT', body: { images: [{ url: '/uploads/one.webp' }] } }));
  await action(); expect(hasUploadAttempt(key)).toBe(true);
  await action().unwrap(); expect(hasUploadAttempt(key)).toBe(false);
});

test('license restrictions notify the admin monitor without clearing the authenticated session', async () => {
  const listener = jest.fn(); window.addEventListener('samira:subscription-required', listener);
  try {
    mockRawQuery.mockResolvedValue({ error: { status: 402, data: { code: 'SUBSCRIPTION_REQUIRED', message: 'Renew store access' } } });
    await expect(request('/admin/products').unwrap()).rejects.toMatchObject({ status: 402 });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].detail.userId).toBe(user._id);
    expect(testStore.getState().auth.token).toBe(original.token);
  } finally { window.removeEventListener('samira:subscription-required', listener); }
});

test('license restrictions on the storefront do not trigger an owner subscription popup', async () => {
  testStore.dispatch(setCredentials({ ...original, user: { _id: 'buyer', role: 'customer', activeMode: 'customer' } }));
  const listener = jest.fn(); window.addEventListener('samira:subscription-required', listener);
  try {
    mockRawQuery.mockResolvedValue({ error: { status: 402, data: { code: 'SUBSCRIPTION_REQUIRED' } } });
    await expect(request('/orders').unwrap()).rejects.toMatchObject({ status: 402 });
    expect(listener).not.toHaveBeenCalled();
  } finally { window.removeEventListener('samira:subscription-required', listener); }
});

test.each(['FETCH_ERROR', 'TIMEOUT_ERROR', 503])('a %s during token refresh preserves the restored admin login', async (status) => {
  mockRawQuery.mockImplementation(async ({ url }) => url === '/auth/refresh'
    ? { error: { status, data: { message: 'Temporarily unavailable' } } }
    : unauthorized);
  const result = await request('/auth/me');
  expect(result.error.status).toBe(status);
  expect(testStore.getState().auth).toEqual({ user, token: original.token, refreshToken: null });
  expect(localStorage.getItem('samira_token')).toBe(original.token);
});

test('simultaneous expired requests share one refresh and both resume with the new token', async () => {
  const refresh = defer();
  mockRawQuery.mockImplementation(async ({ url }, context) => url === '/auth/refresh'
    ? refresh.promise
    : context.getState().auth.token === renewed.token ? { data: { path: url } } : unauthorized);
  const first = request('/auth/me'); const second = request('/notifications/summary');
  await waitFor(() => expect(mockRawQuery.mock.calls.filter(([arg]) => arg.url === '/auth/refresh')).toHaveLength(1));
  refresh.resolve({ data: renewed });
  expect((await first).data).toEqual({ path: '/auth/me' });
  expect((await second).data).toEqual({ path: '/notifications/summary' });
  expect(mockRawQuery.mock.calls.filter(([arg]) => arg.url === '/auth/refresh')).toHaveLength(1);
  expect(testStore.getState().auth).toEqual({ user, token: renewed.token, refreshToken: null });
});

test('an invalid refresh token clears the rejected session', async () => {
  mockRawQuery.mockResolvedValue(unauthorized);
  expect((await request('/auth/me')).error.status).toBe(401);
  expect(testStore.getState().auth.user).toBeNull();
  expect(localStorage.getItem('samira_refresh_token')).toBeNull();
});

test('a delayed refresh cannot sign the account back in after logout', async () => {
  const refresh = defer();
  mockRawQuery.mockImplementation(async ({ url }) => url === '/auth/refresh' ? refresh.promise : unauthorized);
  const pending = request('/auth/me');
  await waitFor(() => expect(mockRawQuery.mock.calls.some(([arg]) => arg.url === '/auth/refresh')).toBe(true));
  testStore.dispatch(logout());
  refresh.resolve({ data: renewed });
  expect((await pending).error.status).toBe(409);
  expect(testStore.getState().auth.user).toBeNull();
  expect(localStorage.getItem('samira_token')).toBeNull();
});

test('a failed request from the previous account is never replayed as another customer', async () => {
  const response = defer(); mockRawQuery.mockReturnValue(response.promise);
  const pending = testStore.dispatch(samiraApi.endpoints.mutate.initiate({ path: '/orders/order-one/cancel', body: {} }));
  testStore.dispatch(setCredentials({ user: { _id: 'customer-two' }, token: 'customer-two-access', refreshToken: 'customer-two-refresh' }));
  response.resolve(unauthorized);
  expect((await pending).error.status).toBe(409);
  expect(mockRawQuery).toHaveBeenCalledTimes(1);
  expect(testStore.getState().auth.user._id).toBe('customer-two');
});

test('a slow original 401 retries an already refreshed session without refreshing twice', async () => {
  const slow = defer();
  mockRawQuery.mockImplementation(async ({ url }, context) => {
    if (url === '/auth/refresh') return { data: renewed };
    if (context.getState().auth.token === renewed.token) return { data: { path: url } };
    return url === '/notifications/summary' ? slow.promise : unauthorized;
  });
  const notifications = request('/notifications/summary');
  await request('/auth/me');
  slow.resolve(unauthorized);
  expect((await notifications).data).toEqual({ path: '/notifications/summary' });
  expect(mockRawQuery.mock.calls.filter(([arg]) => arg.url === '/auth/refresh')).toHaveLength(1);
});

test('catalog caches remain separate when switching between boutiques and the main shop', async () => {
  mockRawQuery.mockImplementation(async args => ({ data: [{ id: args.params?.store || 'main' }] }));
  const read = store => testStore.dispatch(samiraApi.endpoints.getProducts.initiate({ store }, { subscribe: false }));
  expect((await read('boutique-a')).data).toEqual([{ id: 'boutique-a' }]);
  expect((await read('boutique-b')).data).toEqual([{ id: 'boutique-b' }]);
  expect((await read('')).data).toEqual([{ id: 'main' }]);
  expect((await read('boutique-a')).data).toEqual([{ id: 'boutique-a' }]);
  expect(mockRawQuery).toHaveBeenCalledTimes(3);
});

test('storefront transport options share one Redux cache entry while account scopes stay isolated', async () => {
  mockRawQuery.mockImplementation(async args => ({ data: { path: args.url } }));
  const read = (cacheScope, silent) => testStore.dispatch(samiraApi.endpoints.request.initiate(
    { path: '/cart', cacheScope, silent, silentWhenCached: true },
    { subscribe: false },
  ));

  await read('customer-one', false);
  await read('customer-one', true);
  await read('customer-two', true);

  expect(mockRawQuery).toHaveBeenCalledTimes(2);
});

test('mobile home feed is bounded and never blocks navigation, including the first load', async () => {
  mockRawQuery.mockResolvedValue({ data: { products: [], categories: [], banners: [] } });
  await testStore.dispatch(samiraApi.endpoints.getMobileHome.initiate({ store: 'boutique-a' }, { subscribe: false }));
  expect(mockRawQuery.mock.calls[0][0]).toEqual({ url: '/storefront/home', params: { store: 'boutique-a', format: 'compact' }, timeout: STOREFRONT_READ_TIMEOUT });
  expect(startMobileLoader).not.toHaveBeenCalled();
});

test('a cached mobile home refresh stays in Redux without reopening the blocking loader', async () => {
  mockRawQuery.mockResolvedValue({ data: { products: [], categories: [], banners: [] } });
  const subscription = testStore.dispatch(samiraApi.endpoints.getMobileHome.initiate({ store: 'boutique-a' }));
  await subscription.unwrap();
  expect(startMobileLoader).not.toHaveBeenCalled();

  jest.clearAllMocks();
  testStore.dispatch(samiraApi.util.invalidateTags(['Products']));
  await waitFor(() => expect(mockRawQuery).toHaveBeenCalledTimes(1));
  expect(startMobileLoader).not.toHaveBeenCalled();
  subscription.unsubscribe();
});

test('explicit catalog scope wins over the previous tab session header, including the main shop', async () => {
  mockRawQuery.mockResolvedValue({ data: [] });
  await request('/settings');
  sessionStorage.setItem('samira_store_slug', 'previous-store');
  const prepare = store => {
    const headers = new Map();
    mockBaseOptions.prepareHeaders(headers, { getState: testStore.getState, arg: { params: { store } } });
    return headers;
  };
  expect(prepare('new-store').get('x-store-slug')).toBe('new-store');
  expect(prepare('').has('x-store-slug')).toBe(false);
});

test('product detail, categories and banners carry their own explicit store scope', async () => {
  mockRawQuery.mockResolvedValue({ data: [] });
  await testStore.dispatch(samiraApi.endpoints.getProduct.initiate({ id: 'item', store: 'boutique' }, { subscribe: false }));
  await testStore.dispatch(samiraApi.endpoints.getCategories.initiate({ store: 'boutique' }, { subscribe: false }));
  await testStore.dispatch(samiraApi.endpoints.getBanners.initiate({ store: 'boutique' }, { subscribe: false }));
  expect(mockRawQuery.mock.calls.map(([args]) => args)).toEqual([
    { url: '/products/item', params: { store: 'boutique' }, timeout: STOREFRONT_READ_TIMEOUT },
    { url: '/categories', params: { store: 'boutique' }, timeout: STOREFRONT_READ_TIMEOUT },
    { url: '/banners', params: { store: 'boutique' }, timeout: STOREFRONT_READ_TIMEOUT },
  ]);
});

test('a pending or timed-out background read cannot hold the mobile overlay open', async () => {
  const pending = defer(); mockRawQuery.mockReturnValue(pending.promise);
  const response = request('/website-config');
  expect(startMobileLoader).not.toHaveBeenCalled();
  pending.resolve({ error: { status: 'TIMEOUT_ERROR' } });
  expect((await response).error.status).toBe('TIMEOUT_ERROR');
  expect(stopMobileLoader).not.toHaveBeenCalled();
});

test('checkout writes retain the busy indicator, do not gain a read timeout, and are not retried on network failure', async () => {
  const pending = defer(); mockRawQuery.mockReturnValue(pending.promise);
  const response = testStore.dispatch(samiraApi.endpoints.mutate.initiate({ path: '/payments/create-order', body: { orderId: 'one' } }));
  expect(startMobileLoader).toHaveBeenCalledTimes(1);
  expect(stopMobileLoader).not.toHaveBeenCalled();
  expect(mockRawQuery.mock.calls[0][0]).not.toHaveProperty('timeout');
  pending.resolve({ error: { status: 'FETCH_ERROR' } });
  await response;
  expect(stopMobileLoader).toHaveBeenCalledTimes(1);
  expect(mockRawQuery).toHaveBeenCalledTimes(1);
});

test('compact home feed is expanded transparently and simultaneous subscribers share one request', async () => {
  const pending = defer(); mockRawQuery.mockReturnValue(pending.promise);
  const first = testStore.dispatch(samiraApi.endpoints.getMobileHome.initiate({ store: 'one' }));
  const second = testStore.dispatch(samiraApi.endpoints.getMobileHome.initiate({ store: 'one' }));
  const product = { _id: 'product-one', price: 100 };
  pending.resolve({ data: { format: 'compact-v1', products: [product], collections: { featured: ['product-one'] } } });
  expect((await first).data.collections.featured).toEqual([product]);
  expect((await second).data.products).toEqual([product]);
  expect(mockRawQuery).toHaveBeenCalledTimes(1);
  first.unsubscribe(); second.unsubscribe();
});
