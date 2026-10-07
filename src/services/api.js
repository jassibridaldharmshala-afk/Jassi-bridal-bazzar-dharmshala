import { samiraApi } from '../store/apiSlice';
import { store } from '../store/store';
import { compressImageFile, isSupportedImageFile } from './imageCompression';
import { startMobileLoader, stopMobileLoader } from '../utils/mobileLoader';
import { getApiBaseUrl } from '../store/apiBaseUrl';
import { finishUploadRetryKey, forgetUploadRetryKey, getDurableUploadRetryKey, getRecordRetryKey, hasUploadAttempt, isMediaUpload, isRetrySafeCreation, markUploadAttempt, retainUploadedReceipt, uploadScope } from './uploadRetry';

const mediaUploads = new Map();
const recordSaves = new Map();

function customerSafeMessage(message, status, path = '', code = '') {
  if (code.startsWith('UPLOAD_') && message) return message;
  if (/\/(?:admin|seller)\/smart-fill\//.test(path) && code.startsWith('AI_') && message) return message;
  if (code.startsWith('BACKGROUND_') && message) return message;
  if (path.includes('/auth/')) {
    const otpMessages = {
      OTP_PROVIDER_AUTH_FAILED: 'SMS login is unavailable because the SMS provider rejected the store credentials. Please contact support.',
      OTP_PROVIDER_NOT_CONFIGURED: 'SMS login has not been configured for this account. Please contact support.',
      OTP_DELIVERY_UNAVAILABLE: 'We could not send your OTP. Please try again shortly or contact support if this continues.',
    };
    if (Object.prototype.hasOwnProperty.call(otpMessages, code)) return otpMessages[code];
  }
  if (code.startsWith('SHIPPING_') && message) return message;
  if (code === 'PERSISTENT_UPLOAD_STORAGE_REQUIRED') {
    return path.includes('/videos') || path.includes('reel')
      ? 'Reel videos need Cloudflare R2 or Cloudinary. Local disk storage is not enough for AI processing.'
      : 'Image storage is not configured for production uploads yet. Please connect Cloudinary or R2, then upload again.';
  }
  const text = String(message || '').toLowerCase();
  if (status === 401 || status === 403 || status === 400) {
    if (message) return message;
    if (path.includes('/admin/login')) return 'Invalid admin email or password.';
    if (path.includes('/auth/')) return 'Please check the details and try again.';
  }
  if (status === 'FETCH_ERROR' || status === 'TIMEOUT_ERROR') {
    return path.includes('/auth/')
      ? 'Unable to reach the login service. Please try again.'
      : 'Unable to reach the store right now. Please try again.';
  }
  if (status === 503 || text.includes('database unavailable') || text.includes('mongodb') || text.includes('mongo_uri') || text.includes('atlas')) {
    if (path.includes('/auth/')) return 'Login service is temporarily unavailable. Please try again in a few minutes.';
    if (path.includes('/coupons')) return 'Coupon service is temporarily unavailable. Please try again in a few minutes.';
    if (path.includes('/orders') || path.includes('/payments')) return 'Checkout service is temporarily unavailable. Please try again in a few minutes.';
    if (path.includes('/uploads')) return 'Image upload service is temporarily unavailable. Please try again in a few minutes.';
    if (path.includes('/admin/')) return 'Admin data service is temporarily unavailable. Please try again in a few minutes.';
    if (path.includes('/products') || path.includes('/categories') || path.includes('/banners') || path.includes('/settings')) return 'Store data service is temporarily unavailable. Please try again in a few minutes.';
    if (path.includes('/user/addresses')) return 'Address service is temporarily unavailable. Please try again in a few minutes.';
    if (path.includes('/wishlist') || path.includes('/cart')) return 'Shopping service is temporarily unavailable. Please try again in a few minutes.';
    return 'Service is temporarily unavailable. Please try again in a few minutes.';
  }
  if (status >= 500 || text.includes('server error') || text.includes('internal')) {
    return 'Something went wrong on our side. Please try again shortly.';
  }
  if (!message) return 'Something went wrong. Please try again.';
  return message;
}

async function request(path, options = {}) {
  const method = options.method || 'GET';
  const body = options.body ? JSON.parse(options.body) : undefined;
  const scope = uploadScope(store.getState().auth);
  const idempotencyKey = options.idempotencyKey || (method === 'POST' && isRetrySafeCreation(path) ? await getRecordRetryKey({ path, body, scope }) : undefined);
  if (idempotencyKey && uploadScope(store.getState().auth) !== scope) throw toCustomerError({ status: 409, message: 'Your session changed. Please retry the save.' }, path);
  const saveKey = idempotencyKey ? `${scope}:${idempotencyKey}` : '';
  if (saveKey && recordSaves.has(saveKey)) return recordSaves.get(saveKey);
  const endpoint = method === 'GET' ? samiraApi.endpoints.request : samiraApi.endpoints.mutate;
  const action = method === 'GET'
    ? endpoint.initiate({ path, silent: options.silent, ...(options.cacheFirst ? { silentWhenCached: true } : {}), ...(options.cache ? { cache: options.cache } : {}), ...(options.cacheScope !== undefined ? { cacheScope: options.cacheScope } : {}) }, {
      forceRefetch: options.forceRefetch !== undefined ? options.forceRefetch : !options.cacheFirst,
      subscribe: false,
    })
    : endpoint.initiate({ path, method, body, ...(options.silent ? { silent: true } : {}), ...(idempotencyKey ? { idempotencyKey } : {}) });
  const promise = store.dispatch(action);
  const abort = () => promise.abort?.();
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) abort();
  const pending = (async () => {
    try {
      const result = await promise.unwrap();
      if (idempotencyKey) finishUploadRetryKey(idempotencyKey);
      return result;
    } catch (error) {
      if (error.data?.code === 'UPLOAD_RETRY_CONFLICT') forgetUploadRetryKey(idempotencyKey);
      throw toCustomerError(error, path);
    } finally {
      options.signal?.removeEventListener('abort', abort);
      if (method === 'GET') promise?.unsubscribe?.();
    }
  })();
  if (saveKey) recordSaves.set(saveKey, pending);
  try { return await pending; } finally { if (saveKey) recordSaves.delete(saveKey); }
}

async function prepareUploadFiles(files, fieldName) {
  const incoming = Array.from(files || []);
  if (fieldName !== 'images') return incoming;

  const prepared = [];
  for (const file of incoming) {
    if (!file) continue;
    if (file.__compressionMeta) {
      prepared.push(file);
      continue;
    }
    if (!isSupportedImageFile(file)) {
      throw new Error('Only JPG, JPEG, PNG, and WEBP images are allowed.');
    }
    prepared.push(await compressImageFile(file, {
      maxOriginalSizeMb: 2,
      targetMaxSizeMb: 0.7,
      maxWidthOrHeight: 1600,
    }));
  }
  return prepared;
}

async function download(path, body) {
  startMobileLoader();
  try {
    const token = store.getState().auth.token || localStorage.getItem('samira_token');
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      let data = {};
      try { data = await response.json(); } catch { data = { message: 'Unable to download the generated project.' }; }
      throw toCustomerError({ status: response.status, data }, path);
    }
    return response.blob();
  } catch (error) {
    if (error?.status) throw error;
    throw toCustomerError({ status: 'FETCH_ERROR', message: error?.message }, path, 'Unable to download the generated project.');
  } finally { stopMobileLoader(); }
}

const api = {
  get: (path, options = {}) => request(path, options),
  post: (path, body, options = {}) => request(path, { ...options, method: 'POST', body: JSON.stringify(body) }),
  put: (path, body, options = {}) => request(path, { ...options, method: 'PUT', body: JSON.stringify(body) }),
  patch: (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path, body) => request(path, { method: 'DELETE', ...(body ? { body: JSON.stringify(body) } : {}) }),
  download,
  upload: async (path, files, { fieldName = 'images', fields, onRequest, silent = false, idempotencyKey } = {}) => {
    if (!silent) startMobileLoader();
    const control = { cancelled: false, entry: null };
    onRequest?.({ cancel: () => { control.cancelled = true; control.entry?.cancel(); } });
    try {
      const media = isMediaUpload(path);
      const scope = uploadScope(store.getState().auth);
      const key = media ? await getDurableUploadRetryKey({ path, files, fields, fieldName, scope, idempotencyKey }) : '';
      if (control.cancelled) throw { status: 400, data: { message: 'Upload cancelled.' } }; // eslint-disable-line no-throw-literal
      const cacheKey = `${scope}:${key}`;
      for (const [cachedKey, entry] of mediaUploads) if (entry.complete && Date.now() - entry.at > 10 * 60 * 1000) mediaUploads.delete(cachedKey);
      let entry = media ? mediaUploads.get(cacheKey) : null;
      if (!entry) {
        entry = { at: Date.now(), complete: false, cancelled: false };
        entry.cancel = () => { entry.cancelled = true; entry.request?.abort?.(); };
        entry.promise = (async () => {
          const accept = async result => {
            if (uploadScope(store.getState().auth) !== scope) throw { status: 409, data: { message: 'Your session changed. Please retry the upload.' } }; // eslint-disable-line no-throw-literal
            if (media && !/^\/admin\/reel-imports(?:\?|$)/.test(path) && (!Array.isArray(result?.files) || result.files.length !== Array.from(files || []).length)) throw { status: 503, data: { code: 'UPLOAD_INCOMPLETE', message: 'Not all files were confirmed. Retry to finish the upload.' } }; // eslint-disable-line no-throw-literal
            entry.complete = true; entry.at = Date.now();
            if (key && Array.isArray(result?.files)) await retainUploadedReceipt(key, result.files);
            else if (key) finishUploadRetryKey(key);
            if (!Array.isArray(result?.files)) mediaUploads.delete(cacheKey);
            return result;
          };
          if (uploadScope(store.getState().auth) !== scope) throw { status: 409, data: { message: 'Your session changed. Please retry the upload.' } }; // eslint-disable-line no-throw-literal
          if (media && hasUploadAttempt(key)) {
            entry.request = store.dispatch(samiraApi.endpoints.mutate.initiate({ path, method: 'POST', body: { resumeUpload: true }, idempotencyKey: key, silent }));
            try {
              const result = await entry.request.unwrap();
              return accept(result);
            } catch (error) {
              if (error.status !== 404 && error.data?.code !== 'UPLOAD_INCOMPLETE') throw error;
            } finally { entry.request.reset?.(); }
          }
          const preparedFiles = await prepareUploadFiles(files, fieldName);
          if (entry.cancelled) throw { status: 400, data: { message: 'Upload cancelled.' } }; // eslint-disable-line no-throw-literal
          if (uploadScope(store.getState().auth) !== scope) throw { status: 409, data: { message: 'Your session changed. Please retry the upload.' } }; // eslint-disable-line no-throw-literal
          if (key) markUploadAttempt(key);
          entry.request = store.dispatch(samiraApi.endpoints.upload.initiate({ path, files: preparedFiles, fieldName, silent, ...(fields ? { fields } : {}), ...(key ? { idempotencyKey: key } : {}) }));
          try {
            const result = await entry.request.unwrap();
            // Only media receipts are reusable. Booking revisions and AI output
            // must always go through their normal permission/state validation.
            return accept(result);
          } finally { entry.request.reset?.(); }
        })().catch(error => {
          mediaUploads.delete(cacheKey);
          if (error.data?.code === 'UPLOAD_RETRY_CONFLICT') forgetUploadRetryKey(key);
          throw error;
        });
        if (media) {
          if (mediaUploads.size >= 128) {
            const oldest = Array.from(mediaUploads).find(([, value]) => value.complete);
            if (oldest) mediaUploads.delete(oldest[0]);
          }
          mediaUploads.set(cacheKey, entry);
        }
      }
      control.entry = entry;
      return await entry.promise;
    } catch (error) {
      throw toCustomerError(error, path, 'Upload failed');
    } finally {
      if (!silent) stopMobileLoader();
    }
  },
};

function toCustomerError(error, path, fallbackMessage) {
  const status = error?.status || error?.originalStatus || 500;
  const data = error?.data || {};
  const message = data.message || error?.message || fallbackMessage;
  const customerError = new Error(customerSafeMessage(message, status, path, data.code));
  customerError.status = status;
  customerError.code = data.code;
  customerError.details = message;
  return customerError;
}

export default api;
