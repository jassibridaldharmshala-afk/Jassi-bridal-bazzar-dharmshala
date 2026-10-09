import { createApi, defaultSerializeQueryArgs, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { getApiBaseUrl } from './apiBaseUrl';
import { DRAFT_UPLOAD_TIMEOUT, followDraftUpload } from '../services/draftUploadProgress';
import { compressImageFile, isSupportedImageFile, preparePhotoUploads } from '../services/imageCompression';
import { logout, setCredentials } from './authSlice';
import { startMobileLoader, stopMobileLoader } from '../utils/mobileLoader';
import { getOrCreateSessionId } from '../utils/attribution';
import { isWebsitePreview } from '../config/websiteDesigner';
import { expandHomeFeed, storefrontReadOptions } from './storefrontTransport';
import { confirmUploadedReferences, finishUploadRetryKey, forgetUploadRetryKey, getDurableUploadRetryKey, getRecordRetryKey, hasUploadAttempt, isRetrySafeCreation, markUploadAttempt, uploadScope } from '../services/uploadRetry';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: getApiBaseUrl(),
  credentials: 'include',
  prepareHeaders: (headers, { getState, arg }) => {
    if (isWebsitePreview()) return headers;
    const token = getState().auth.token || localStorage.getItem('samira_token');
    if (token) headers.set('authorization', `Bearer ${token}`);
    try {
      const sessionId = getOrCreateSessionId();
      if (sessionId) headers.set('x-session-id', sessionId);
    } catch {
      // ignore
    }
    try {
      const queryScope = new URLSearchParams(String(typeof arg === 'string' ? arg : arg?.url || '').split('?')[1] || '');
      const hasParamScope = arg?.params && Object.prototype.hasOwnProperty.call(arg.params, 'store');
      const hasStoreScope = hasParamScope || queryScope.has('store');
      const storeSlug = hasParamScope ? arg.params.store : queryScope.has('store') ? queryScope.get('store') : (/^\/store\/([^/]+)/.exec(window.location.pathname)?.[1] || sessionStorage.getItem('samira_store_slug'));
      if (storeSlug) headers.set('x-store-slug', storeSlug);
      else if (hasStoreScope) headers.delete('x-store-slug');
      const requestPath = String(typeof arg === 'string' ? arg : arg?.url || '').split('?')[0];
      if (requestPath.startsWith('/admin/rentals')) {
        const targetStoreId = queryScope.get('storeId') || new URLSearchParams(window.location.search).get('storeId');
        if (/^[a-f\d]{24}$/i.test(targetStoreId || '')) headers.set('x-store-id', targetStoreId);
      }
      if (requestPath.startsWith('/seller/') || requestPath === '/stores/me/current') {
        const linkedStoreId = queryScope.get('storeId') || new URLSearchParams(window.location.search).get('storeId');
        const sellerStoreId = /^[a-f\d]{24}$/i.test(linkedStoreId || '') ? linkedStoreId : sessionStorage.getItem('samira_seller_store_id');
        if (sellerStoreId) headers.set('x-store-id', sellerStoreId);
      }
    } catch {
      // ignore
    }
    return headers;
  },
});

function requestUrl(args) {
  if (typeof args === 'string') return args;
  return String(args?.url || args?.path || '');
}

function isCredentialAuthRequest(args) {
  return /\/(?:auth\/(?:register|send-otp|resend-otp|verify-otp|refresh)|admin\/login)\b/.test(requestUrl(args));
}

// Every protected request can expire together when a saved tab is reopened.
// Share refresh work for that session so a slower failure cannot erase a login
// that another request has already restored.
const sessionRefreshes = new WeakMap();

function sessionCredentials(api) {
  return {
    userId: String(api.getState().auth.user?._id || api.getState().auth.user?.id || ''),
    token: api.getState().auth.token || localStorage.getItem('samira_token') || '',
  };
}

function sameSession(left, right) {
  return left.userId === right.userId && left.token === right.token;
}

async function baseQueryWithRefresh(args, api, extraOptions) {
  const policy = storefrontReadOptions(args);
  args = policy.request;
  const cachedQuery = api.queryCacheKey
    ? api.getState()?.samiraApi?.queries?.[api.queryCacheKey]
    : null;
  const silent = policy.readOnly || Boolean(typeof args === 'object' && (
    args.silent || (args.silentWhenCached && cachedQuery?.data !== undefined)
  ));
  if (typeof args === 'object') {
    const { silent: _silent, silentWhenCached: _silentWhenCached, ...requestArgs } = args;
    args = requestArgs;
  }
  if (isWebsitePreview()) {
    const method = typeof args === 'string' ? 'GET' : (args.method || 'GET').toUpperCase();
    if (method !== 'GET') return { error: { status: 403, data: { message: 'Storefront preview is read-only.' } } };
    return rawBaseQuery(args, api, extraOptions);
  }
  if (!silent) startMobileLoader();
  try {
    const requestedSession = sessionCredentials(api);
    let creationKey;
    if (typeof args === 'object' && args.method === 'POST' && isRetrySafeCreation(requestUrl(args)) && !(args.body instanceof FormData)) {
      const scope = uploadScope(api.getState().auth);
      const headers = args.headers instanceof Headers ? Object.fromEntries(args.headers.entries()) : args.headers || {};
      creationKey = headers['Idempotency-Key'] || headers['idempotency-key'] || await getRecordRetryKey({ path: requestUrl(args), body: args.body, scope });
      if (uploadScope(api.getState().auth) !== scope) return { error: { status: 409, data: { message: 'Your session changed. Please retry the save.' } } };
      args = { ...args, headers: { ...headers, 'Idempotency-Key': creationKey } };
    }
    let result = await rawBaseQuery(args, api, extraOptions);

    if (result.error?.status === 401 && !isCredentialAuthRequest(args)) {
      const currentSession = sessionCredentials(api);
      if (!sameSession(requestedSession, currentSession)) {
        // A concurrent refresh, mode switch or sign-in already replaced the
        // token. Never use this old response to invalidate the new session.
        return currentSession.token && currentSession.userId === requestedSession.userId
          ? rawBaseQuery(args, api, extraOptions)
          : { error: { status: 409, data: { message: 'Your session changed. Please try again.' } } };
      }
      if (currentSession.token && currentSession.userId) {
        let pending = sessionRefreshes.get(api.dispatch);
        if (!pending || !sameSession(pending.session, currentSession)) {
          pending = { session: currentSession };
          pending.promise = (async () => {
            const refreshed = await rawBaseQuery({
              url: '/auth/refresh',
              method: 'POST',
              body: {},
            }, api, extraOptions);
            if (!sameSession(currentSession, sessionCredentials(api))) return { stale: true };
            if (refreshed.data?.token && refreshed.data?.user) {
              api.dispatch(setCredentials(refreshed.data));
              window.dispatchEvent(new CustomEvent('samira:session-refreshed', { detail: refreshed.data.user }));
            } else if ([401, 403].includes(refreshed.error?.status)) {
              api.dispatch(logout());
              window.dispatchEvent(new Event('samira:session-expired'));
            }
            return refreshed;
          })();
          sessionRefreshes.set(api.dispatch, pending);
        }
        const refreshResult = await pending.promise;
        if (sessionRefreshes.get(api.dispatch) === pending) sessionRefreshes.delete(api.dispatch);
        if (refreshResult.data?.token && refreshResult.data?.user) {
          if (sessionCredentials(api).token === refreshResult.data.token) result = await rawBaseQuery(args, api, extraOptions);
          else result = { error: { status: 409, data: { message: 'Your session changed. Please try again.' } } };
        } else if (refreshResult.error) {
          // A network outage or unavailable database is recoverable. Return
          // that error instead of the initial 401 so profile loading can retry
          // without deleting the saved account and shopping data.
          result = refreshResult;
        } else if (!refreshResult.stale) {
          result = { error: { status: 503, data: { message: 'Unable to restore your session. Please try again.' } } };
        } else {
          result = { error: { status: 409, data: { message: 'Your session changed. Please try again.' } } };
        }
      } else if (requestedSession.token) {
        api.dispatch(logout());
        window.dispatchEvent(new Event('samira:session-expired'));
      }
    }

    if (result.error?.data?.code === 'SUBSCRIPTION_REQUIRED' && sameSession(requestedSession, sessionCredentials(api))) {
      const user = api.getState().auth.user;
      if (user?.role === 'admin' && user?.activeMode === 'admin') {
        window.dispatchEvent(new CustomEvent('samira:subscription-required', {
          detail: { userId: String(user._id || user.id || user.phone || ''), path: requestUrl(args) },
        }));
      }
    }
    if (result.data && result.data.success !== false && typeof args === 'object' && ['POST', 'PUT', 'PATCH'].includes(args.method) && args.body && !(args.body instanceof FormData)) await confirmUploadedReferences(args.body).catch(() => {});
    if (creationKey && result.data && result.data.success !== false) finishUploadRetryKey(creationKey);
    if (creationKey && result.error?.data?.code === 'UPLOAD_RETRY_CONFLICT') forgetUploadRetryKey(creationKey);
    return result;
  } finally {
    if (!silent) stopMobileLoader();
  }
}

function params(query) {
  return query && Object.keys(query).length ? { params: query } : undefined;
}

function cacheIdentity(queryArgs) {
  if (!queryArgs || typeof queryArgs !== 'object' || Array.isArray(queryArgs)) return queryArgs;
  const { silent: _silent, silentWhenCached: _silentWhenCached, cache: _cache, ...identity } = queryArgs;
  return identity;
}

export const samiraApi = createApi({
  reducerPath: 'samiraApi',
  baseQuery: baseQueryWithRefresh,
  serializeQueryArgs: ({ endpointName, queryArgs, endpointDefinition }) => defaultSerializeQueryArgs({
    endpointName,
    endpointDefinition,
    queryArgs: cacheIdentity(queryArgs),
  }),
  tagTypes: ['Auth', 'Products', 'Categories', 'Banners', 'Settings', 'Cart', 'Wishlist', 'Addresses', 'Coupons', 'Orders', 'Payments', 'Returns', 'Reviews', 'AdminDashboard', 'AdminProducts', 'AdminCategories', 'AdminOrders', 'AdminCustomers', 'AdminSettings', 'ProductDrafts', 'VariantGroups', 'Inventory', 'Contact', 'Newsletter', 'Notifications', 'WebsiteCustomization', 'ReelImports'],
  keepUnusedDataFor: 120,
  endpoints: (builder) => ({
    request: builder.query({
      query: ({ path, query, silent, silentWhenCached, cache }) => ({ url: path, ...params(query), silent, silentWhenCached, ...(cache ? { cache } : {}) }),
      providesTags: (_result, _error, arg) => tagsForPath(arg.path),
      keepUnusedDataFor: 900,
    }),
    mutate: builder.mutation({
      query: ({ path, method = 'POST', body, silent, idempotencyKey }) => ({ url: path, method, body, ...(silent ? { silent } : {}), ...(idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : {}) }),
      invalidatesTags: (_result, _error, arg) => tagsForPath(arg.path, true),
    }),
    upload: builder.mutation({
      queryFn: async ({ path, files, fieldName = 'images', silent = false, fields = {}, idempotencyKey }, api, extraOptions, baseQuery) => {
        try {
          const scope = uploadScope(api.getState().auth);
          const prepared = await preparePhotoUploads(files, { imagesOnly: fieldName === 'images' || fieldName === 'image' });
          if (api.signal.aborted || uploadScope(api.getState().auth) !== scope) return { error: { status: 409, data: { message: 'Your session changed or the upload was cancelled. Please retry.' } } };
          const formData = new FormData();
          prepared.forEach(file => formData.append(fieldName, file));
          Object.entries(fields).forEach(([key, value]) => formData.append(key, String(value)));
          return await baseQuery({ url: path, method: 'POST', body: formData, silent, ...(idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : {}) }, api, extraOptions);
        } catch (error) { return { error: { status: 400, data: { code: 'UPLOAD_IMAGE_INVALID', message: error.message || 'Unable to prepare the photo.' } } }; }
      },
      invalidatesTags: (_result, _error, arg) => arg.path.endsWith('/background') || /\/rentals\/bookings\/[^/]+\/proofs(?:\?|$)/.test(arg.path) ? [] : ['AdminProducts', 'Products'],
    }),
    sendOtp: builder.mutation({ query: (body) => ({ url: '/auth/send-otp', method: 'POST', body }) }),
    resendOtp: builder.mutation({ query: (body) => ({ url: '/auth/resend-otp', method: 'POST', body }) }),
    verifyOtp: builder.mutation({ query: (body) => ({ url: '/auth/verify-otp', method: 'POST', body }), invalidatesTags: ['Auth'] }),
    getCurrentUser: builder.query({ query: () => '/auth/me', providesTags: ['Auth'] }),
    switchMode: builder.mutation({ query: (body) => ({ url: '/auth/switch-mode', method: 'POST', body }), invalidatesTags: ['Auth', 'AdminDashboard'] }),
    getProducts: builder.query({
      query: (query = {}) => {
        const { silent = false, ...requestParams } = query || {};
        return { url: '/products', ...params(requestParams), silent, silentWhenCached: true };
      },
      providesTags: ['Products'],
      keepUnusedDataFor: 900,
    }),
    getMobileHome: builder.query({
      query: (query) => ({ url: '/storefront/home', params: { ...query, format: 'compact' }, silentWhenCached: true }),
      transformResponse: expandHomeFeed,
      providesTags: ['Products', 'Categories', 'Banners', 'Settings', 'WebsiteCustomization'],
      keepUnusedDataFor: 900,
    }),
    getProduct: builder.query({
      query: (value) => typeof value === 'object'
        ? { url: `/products/${encodeURIComponent(value.id)}`, params: { store: value.store || '' }, silent: Boolean(value.silent), silentWhenCached: true }
        : { url: `/products/${encodeURIComponent(value)}`, silentWhenCached: true },
      providesTags: ['Products'],
      keepUnusedDataFor: 900,
    }),
    getCategories: builder.query({
      query: (query = {}) => {
        const { silent = false, ...requestParams } = query || {};
        return { url: '/categories', ...params(requestParams), silent, silentWhenCached: true };
      },
      providesTags: ['Categories'],
      keepUnusedDataFor: 900,
    }),
    getBanners: builder.query({
      query: (query = {}) => {
        const { silent = false, ...requestParams } = query || {};
        return { url: '/banners', ...params(requestParams), silent, silentWhenCached: true };
      },
      providesTags: ['Banners'],
      keepUnusedDataFor: 900,
    }),
    getSettings: builder.query({
      query: (options = {}) => ({ url: '/settings', params: options?.store !== undefined ? { store: options.store } : undefined, silent: Boolean(options?.silent), silentWhenCached: true }),
      providesTags: ['Settings'],
      keepUnusedDataFor: 900,
    }),
    getCart: builder.query({ query: () => ({ url: '/cart', silentWhenCached: true }), providesTags: ['Cart'], keepUnusedDataFor: 300 }),
    getWishlist: builder.query({ query: () => ({ url: '/wishlist', silentWhenCached: true }), providesTags: ['Wishlist'], keepUnusedDataFor: 300 }),
    getAddresses: builder.query({ query: () => ({ url: '/user/addresses', silentWhenCached: true }), providesTags: ['Addresses'], keepUnusedDataFor: 300 }),
    getCoupons: builder.query({ query: () => ({ url: '/coupons', silentWhenCached: true }), providesTags: ['Coupons'], keepUnusedDataFor: 300 }),
    getOrders: builder.query({ query: () => ({ url: '/orders/my-orders', silentWhenCached: true }), providesTags: ['Orders'], keepUnusedDataFor: 300 }),
    getReviews: builder.query({
      query: (value) => typeof value === 'object'
        ? ({ url: `/reviews/${encodeURIComponent(value.productId)}`, params: { page: value.page || 1, limit: value.limit || 20, ...(value.store ? { store: value.store } : {}) }, silent: Boolean(value.silent), silentWhenCached: true })
        : ({ url: `/reviews/${encodeURIComponent(value)}`, silentWhenCached: true }),
      providesTags: ['Reviews'],
      keepUnusedDataFor: 600,
    }),
    getFeaturedReviews: builder.query({ query: (query) => ({ url: '/reviews/featured', ...params(query), silentWhenCached: true }), providesTags: ['Reviews'], keepUnusedDataFor: 600 }),
    getAdminStats: builder.query({ query: () => '/admin/dashboard/stats', providesTags: ['AdminDashboard'] }),
    getAdminProducts: builder.query({ query: () => '/admin/products', providesTags: ['AdminProducts'] }),
    getAdminCategories: builder.query({ query: () => '/admin/categories', providesTags: ['AdminCategories'] }),
    getAdminOrders: builder.query({ query: () => '/admin/orders', providesTags: ['AdminOrders'] }),
    getAdminCustomers: builder.query({ query: () => '/admin/customers', providesTags: ['AdminCustomers'] }),
    getAdminSettings: builder.query({ query: () => '/admin/settings', providesTags: ['AdminSettings'] }),
    getAdminLowStock: builder.query({ query: () => '/admin/dashboard/low-stock', providesTags: ['Inventory'] }),
    getProductDrafts: builder.query({
      query: ({ apiPrefix = '/admin', ...query } = {}) => ({ url: `${apiPrefix === '/seller' ? '/seller' : '/admin'}/product-drafts`, ...params(query) }),
      providesTags: ['ProductDrafts'],
    }),
    getVariantGroups: builder.query({
      query: ({ apiPrefix = '', ...query } = {}) => ({ url: apiPrefix === '/seller' ? '/seller/variant-groups' : apiPrefix === '/admin' ? '/admin/variant-groups' : '/variant-groups', ...params(query) }),
      providesTags: ['VariantGroups'],
    }),
    getVariantGroup: builder.query({
      query: (value) => {
        const input = typeof value === 'object' ? value : { id: value };
        const prefix = input.apiPrefix === '/seller' ? '/seller' : input.apiPrefix === '/admin' ? '/admin' : '';
        return { url: `${prefix}/variant-groups/${encodeURIComponent(input.id)}`, params: input.store ? { store: input.store } : undefined, silent: Boolean(input.silent) };
      },
      providesTags: ['VariantGroups'],
    }),
    getVariantGroupCandidates: builder.query({
      query: ({ apiPrefix = '/admin', ...query } = {}) => ({ url: `${apiPrefix === '/seller' ? '/seller' : '/admin'}/variant-groups/candidates`, ...params(query) }),
      providesTags: ['AdminProducts', 'VariantGroups'],
    }),
    getManagementCategories: builder.query({
      query: ({ apiPrefix = '/admin' } = {}) => `${apiPrefix === '/seller' ? '/seller' : '/admin'}/categories`,
      providesTags: ['AdminCategories'],
    }),
    bulkUploadProductDrafts: builder.mutation({
      async queryFn({ files, groupMode = 'separate', photoGroups, apiPrefix = '/admin', onProgress }, api, extraOptions, baseQuery) {
        const prefix = apiPrefix === '/seller' ? '/seller' : '/admin';
        const path = `${prefix}/product-drafts/bulk-upload`;
        let idempotencyKey;
        try {
          if (!['single', 'separate', 'grouped'].includes(groupMode)) throw new Error('Choose a valid product photo grouping option.');
          if (groupMode === 'grouped' && (!Array.isArray(photoGroups) || !photoGroups.length)) throw new Error('Create product photo groups before uploading.');
          const fields = { groupMode, ...(groupMode === 'grouped' ? { photoGroups: JSON.stringify(photoGroups) } : {}) };
          const scope = uploadScope(api.getState().auth);
          const sameScope = () => !api.signal.aborted && uploadScope(api.getState().auth) === scope;
          const progress = value => { if (sameScope()) { try { onProgress?.(value); } catch { /* Observers cannot cancel a saved upload. */ } } };
          progress({ phase: 'preparing', fileCount: files?.length || 0, completedFiles: 0 });
          const follow = result => followDraftUpload({ result, query: args => baseQuery(args, api, extraOptions), path, key: idempotencyKey, signal: api.signal, onProgress: progress, sameScope });
          idempotencyKey = await getDurableUploadRetryKey({ path, files, fields, scope });
          if (api.signal.aborted || uploadScope(api.getState().auth) !== scope) throw new Error('Your session changed or the upload was cancelled. Please retry.');
          if (hasUploadAttempt(idempotencyKey)) {
            // All photos may already be stored even though draft save/response
            // failed. Resume by receipt, without posting the photos again.
            const resumed = await follow(await baseQuery({ url: path, method: 'POST', body: { resumeUpload: true, asyncUpload: true }, timeout: DRAFT_UPLOAD_TIMEOUT, silent: true, headers: { 'Idempotency-Key': idempotencyKey } }, api, extraOptions));
            if (!resumed.error) { finishUploadRetryKey(idempotencyKey); return { data: resumed.data }; }
            if (resumed.error.status !== 404 && resumed.error.data?.code !== 'UPLOAD_INCOMPLETE') {
              if (resumed.error.data?.code === 'UPLOAD_RETRY_CONFLICT') forgetUploadRetryKey(idempotencyKey);
              return { error: resumed.error };
            }
          }
          const preparedFiles = [];
          for (const file of Array.from(files || [])) {
            if (!file) throw new Error('A selected photo is missing. Review the photos before uploading.');
            if (!isSupportedImageFile(file)) {
              return { error: { status: 400, data: { message: 'Only JPG, JPEG, PNG, and WEBP images are allowed.' } } };
            }
            preparedFiles.push(await compressImageFile(file));
          }
          const formData = new FormData();
          preparedFiles.forEach((file) => formData.append('images', file));
          if (api.signal.aborted || uploadScope(api.getState().auth) !== scope) throw new Error('Your session changed or the upload was cancelled. Please retry.');
          Object.entries(fields).forEach(([key, value]) => formData.append(key, value));
          formData.append('asyncUpload', 'true');
          markUploadAttempt(idempotencyKey);
          progress({ phase: 'uploading', fileCount: preparedFiles.length, completedFiles: 0 });
          const result = await follow(await baseQuery({ url: path, method: 'POST', body: formData, timeout: DRAFT_UPLOAD_TIMEOUT, silent: true, headers: { 'Idempotency-Key': idempotencyKey } }, api, extraOptions));
          if (result.error) {
            if (result.error.data?.code === 'UPLOAD_RETRY_CONFLICT') forgetUploadRetryKey(idempotencyKey);
            if (['FETCH_ERROR', 'TIMEOUT_ERROR'].includes(result.error.status)) return { error: { ...result.error, data: { message: 'The upload response timed out or could not be reached. Your photos are kept. Check status with this same selection before starting another upload.' } } };
            return { error: result.error };
          }
          finishUploadRetryKey(idempotencyKey);
          return { data: result.data };
        } catch (error) { return { error: { status: 400, data: { message: error.message || 'Unable to prepare the product photos.' } } }; }
      },
      invalidatesTags: ['ProductDrafts'],
    }),
    updateProductDraft: builder.mutation({
      query: ({ id, body, apiPrefix = '/admin' }) => ({ url: `${apiPrefix === '/seller' ? '/seller' : '/admin'}/product-drafts/${id}`, method: 'PUT', body }),
      invalidatesTags: ['ProductDrafts'],
    }),
    archiveProductDraft: builder.mutation({
      query: ({ id, apiPrefix = '/admin' }) => ({ url: `${apiPrefix === '/seller' ? '/seller' : '/admin'}/product-drafts/${id}/archive`, method: 'PATCH' }),
      invalidatesTags: ['ProductDrafts'],
    }),
    restoreProductDraft: builder.mutation({
      query: ({ id, apiPrefix = '/admin' }) => ({ url: `${apiPrefix === '/seller' ? '/seller' : '/admin'}/product-drafts/${id}/restore`, method: 'PATCH' }),
      invalidatesTags: ['ProductDrafts'],
    }),
    deleteProductDraft: builder.mutation({
      query: (input) => {
        const value = typeof input === 'object' ? input : { id: input };
        const prefix = value.apiPrefix === '/seller' ? '/seller' : '/admin';
        return { url: `${prefix}/product-drafts/${value.id}`, method: 'DELETE', params: value.confirm ? { confirm: value.confirm, ...(value.baseRevision !== undefined ? { baseRevision: value.baseRevision } : {}) } : undefined };
      },
      invalidatesTags: ['ProductDrafts'],
    }),
    publishSelectedDrafts: builder.mutation({
      query: ({ apiPrefix = '/admin', ...body }) => ({ url: `${apiPrefix === '/seller' ? '/seller' : '/admin'}/product-drafts/publish-selected`, method: 'POST', body }),
      invalidatesTags: ['ProductDrafts', 'Products', 'AdminProducts', 'AdminDashboard', 'Inventory'],
    }),
    createVariantGroup: builder.mutation({
      query: ({ apiPrefix = '/admin', ...body }) => ({ url: `${apiPrefix === '/seller' ? '/seller' : '/admin'}/variant-groups`, method: 'POST', body }),
      invalidatesTags: ['VariantGroups', 'Products', 'AdminProducts'],
    }),
    updateVariantGroup: builder.mutation({
      query: ({ id, body, apiPrefix = '/admin' }) => ({ url: `${apiPrefix === '/seller' ? '/seller' : '/admin'}/variant-groups/${id}`, method: 'PUT', body }),
      invalidatesTags: ['VariantGroups', 'Products', 'AdminProducts'],
    }),
    deleteVariantGroup: builder.mutation({
      query: (value) => {
        const input = typeof value === 'object' ? value : { id: value };
        return { url: `${input.apiPrefix === '/seller' ? '/seller' : '/admin'}/variant-groups/${input.id}`, method: 'DELETE', params: input.confirm ? { confirm: input.confirm } : undefined };
      },
      invalidatesTags: ['VariantGroups', 'Products', 'AdminProducts'],
    }),
    archiveVariantGroup: builder.mutation({
      query: ({ id, apiPrefix = '/admin' }) => ({ url: `${apiPrefix === '/seller' ? '/seller' : '/admin'}/variant-groups/${id}/archive`, method: 'PATCH' }),
      invalidatesTags: ['VariantGroups', 'Products', 'AdminProducts'],
    }),
    restoreVariantGroup: builder.mutation({
      query: ({ id, body = {}, apiPrefix = '/admin' }) => ({ url: `${apiPrefix === '/seller' ? '/seller' : '/admin'}/variant-groups/${id}/restore`, method: 'PATCH', body }),
      invalidatesTags: ['VariantGroups', 'Products', 'AdminProducts'],
    }),
    reconcileVariantGroup: builder.mutation({
      query: ({ id, apiPrefix = '/admin' }) => ({ url: `${apiPrefix === '/seller' ? '/seller' : '/admin'}/variant-groups/${id}/reconcile`, method: 'POST' }),
      invalidatesTags: ['VariantGroups', 'Products', 'AdminProducts'],
    }),
    addVariantGroupProducts: builder.mutation({
      query: ({ id, body, apiPrefix = '/admin' }) => ({ url: `${apiPrefix === '/seller' ? '/seller' : '/admin'}/variant-groups/${id}/add-products`, method: 'POST', body }),
      invalidatesTags: ['VariantGroups', 'Products', 'AdminProducts'],
    }),
    removeVariantGroupProducts: builder.mutation({
      query: ({ id, body, apiPrefix = '/admin' }) => ({ url: `${apiPrefix === '/seller' ? '/seller' : '/admin'}/variant-groups/${id}/remove-products`, method: 'POST', body }),
      invalidatesTags: ['VariantGroups', 'Products', 'AdminProducts'],
    }),
  }),
});

function tagsForPath(path = '', mutation = false) {
  if (/\/(?:admin|seller)\/rentals\/configuration(?:\?|$)/.test(path)) return mutation ? ['Settings', 'AdminSettings', 'Products', 'Cart'] : ['Settings'];
  if (/\/(?:admin|seller)\/rentals\/(?:listings|assets)(?:\/|\?|$)/.test(path)) return mutation ? ['Products', 'AdminProducts', 'Inventory', 'Wishlist'] : [];
  if (/\/rentals\/(?:catalogue|availability|products)(?:\/|\?|$)/.test(path)) return mutation ? [] : ['Products'];
  if (/\/smart-fill\//.test(path)) return mutation && /\/catalog\/save(?:\?|$)/.test(path) ? ['Products', 'AdminProducts', 'AdminDashboard'] : [];
  if (/\/products\/(?:smart-fill|quick-analyze)(?:\/status)?$/.test(path)) return [];
  if (path.includes('/admin/social-imports')) return mutation && path.endsWith('/draft') ? ['ProductDrafts'] : [];
  if (path.includes('/admin/reel-imports')) return ['ReelImports'];
  if (path.includes('/admin/customization') || path.includes('/website-config')) return ['WebsiteCustomization'];
  if (path.includes('/auth/')) return ['Auth'];
  if (path.includes('/admin/dashboard')) return ['AdminDashboard', 'Inventory'];
  if (path.includes('/quick-analyze')) return [];
  if (/\/(?:admin|seller)\/products\/[^/]+\/permanent(?:\?|$)/.test(path)) return mutation ? ['AdminProducts', 'Products', 'AdminDashboard', 'Inventory', 'Cart', 'Wishlist', 'ProductDrafts'] : ['AdminProducts'];
  if (path.includes('/admin/products')) return mutation ? ['AdminProducts', 'Products', 'AdminDashboard'] : ['AdminProducts'];
  if (path.includes('/admin/categories')) return mutation ? ['AdminCategories', 'Categories'] : ['AdminCategories'];
  if (path.includes('/admin/orders')) return mutation ? ['AdminOrders', 'Orders', 'AdminDashboard'] : ['AdminOrders'];
  if (path.includes('/admin/customers') || path.includes('/admin/users')) return ['AdminCustomers'];
  if (path.includes('/admin/settings')) return mutation ? ['AdminSettings', 'Settings', 'WebsiteCustomization', 'Cart'] : ['AdminSettings'];
  if (path.includes('/admin/product-drafts')) return mutation ? ['ProductDrafts', 'Products', 'AdminProducts', 'AdminDashboard'] : ['ProductDrafts'];
  if (path.includes('/admin/variant-groups') || path.includes('/variant-groups')) return mutation ? ['VariantGroups', 'Products', 'AdminProducts'] : ['VariantGroups'];
  if (path.includes('/admin/dashboard/low-stock') || path.includes('/admin/inventory/low-stock')) return ['Inventory', 'AdminDashboard'];
  if (path.includes('/products')) return ['Products'];
  if (path.includes('/categories')) return ['Categories'];
  if (path.includes('/banners')) return ['Banners'];
  if (path.includes('/settings')) return ['Settings'];
  if (path.includes('/cart')) return ['Cart'];
  if (path.includes('/wishlist')) return ['Wishlist'];
  if (path.includes('/user/addresses')) return ['Addresses'];
  if (path.includes('/coupons')) return ['Coupons'];
  if (path.includes('/orders')) return mutation ? ['Orders', 'Cart', 'Products', 'AdminDashboard'] : ['Orders'];
  if (path.includes('/payments')) return mutation ? ['Payments', 'Orders', 'AdminDashboard', 'AdminOrders'] : ['Payments', 'Orders'];
  if (path.includes('/reviews')) return ['Reviews'];
  if (path.includes('/returns')) return mutation ? ['Returns', 'Orders', 'AdminDashboard', 'AdminOrders', 'Inventory'] : ['Returns'];
  if (path.includes('/contact')) return mutation ? ['Contact'] : ['Contact'];
  if (path.includes('/newsletter')) return mutation ? ['Newsletter'] : ['Newsletter'];
  if (path.includes('/notifications')) return ['Notifications'];
  return [];
}

export const {
  useGetAdminCategoriesQuery,
  useGetAdminCustomersQuery,
  useGetAdminOrdersQuery,
  useGetAdminProductsQuery,
  useGetAdminSettingsQuery,
  useGetAdminLowStockQuery,
  useGetAdminStatsQuery,
  useGetAddressesQuery,
  useGetBannersQuery,
  useGetCartQuery,
  useGetCategoriesQuery,
  useGetCouponsQuery,
  useGetCurrentUserQuery,
  useGetOrdersQuery,
  useGetProductQuery,
  useGetProductDraftsQuery,
  useGetProductsQuery,
  useGetVariantGroupQuery,
  useGetVariantGroupCandidatesQuery,
  useGetManagementCategoriesQuery,
  useGetMobileHomeQuery,
  useGetVariantGroupsQuery,
  useGetReviewsQuery,
  useGetFeaturedReviewsQuery,
  useGetSettingsQuery,
  useGetWishlistQuery,
  useBulkUploadProductDraftsMutation,
  useArchiveProductDraftMutation,
  useArchiveVariantGroupMutation,
  useCreateVariantGroupMutation,
  useDeleteProductDraftMutation,
  useDeleteVariantGroupMutation,
  usePublishSelectedDraftsMutation,
  useRestoreProductDraftMutation,
  useRestoreVariantGroupMutation,
  useResendOtpMutation,
  useSendOtpMutation,
  useAddVariantGroupProductsMutation,
  useSwitchModeMutation,
  useRemoveVariantGroupProductsMutation,
  useReconcileVariantGroupMutation,
  useUpdateProductDraftMutation,
  useUpdateVariantGroupMutation,
  useVerifyOtpMutation,
} = samiraApi;
