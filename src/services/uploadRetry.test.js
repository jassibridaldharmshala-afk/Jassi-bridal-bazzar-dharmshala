import { confirmUploadedReferences, finishUploadRetryKey, getDurableUploadRetryKey, getRecordRetryKey, getUploadRetryKey, forgetUploadRetryKey, hasUploadAttempt, markUploadAttempt, rememberOriginalUpload, retainUploadedReceipt, selectionFingerprint } from './uploadRetry';
import { digestBytes, textBytes } from './retryDigest';
beforeEach(() => localStorage.clear());
test('compressed output keeps the original upload identity', () => {
  const original = new File(['original'], 'one.jpg', { type: 'image/jpeg' });
  const prepared = new File(['compressed'], 'one.webp', { type: 'image/webp' });
  rememberOriginalUpload(prepared, original);
  const key = getUploadRetryKey({ path: '/admin/uploads', files: [original], scope: 'one' });
  expect(getUploadRetryKey({ path: '/admin/uploads', files: [prepared], scope: 'one' })).toBe(key);
  forgetUploadRetryKey(key);
  expect(getUploadRetryKey({ path: '/admin/uploads', files: [original], scope: 'one' })).not.toBe(key);
});

test('SHA-256 fallback matches known vectors', async () => {
  expect(await digestBytes(textBytes('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  expect(await digestBytes(textBytes(''))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
});

test('failed uploads survive module reload and fresh File objects without storing file bytes or account data', async () => {
  const file = () => new File(['original'], 'private-name.jpg', { type: 'image/jpeg' });
  const options = { path: '/admin/uploads', files: [file()], scope: 'private-account', fields: { folder: 'products' } };
  const key = await getDurableUploadRetryKey(options); markUploadAttempt(key);
  let reloaded;
  jest.isolateModules(() => { reloaded = require('./uploadRetry'); });
  const retry = await reloaded.getDurableUploadRetryKey({ ...options, files: [file()] });
  expect(retry).toBe(key); expect(reloaded.hasUploadAttempt(retry)).toBe(true);
  const stored = localStorage.getItem('samira_pending_operations_v2');
  expect(stored).not.toContain('original'); expect(stored).not.toContain('private-account'); expect(stored).not.toContain('private-name');
  reloaded.finishUploadRetryKey(retry);
  expect(await reloaded.getDurableUploadRetryKey({ ...options, files: [file()] })).not.toBe(key);
});

test('pending identities distinguish stores, changed bytes and settings; confirmed uploads allow a new selection', async () => {
  const options = { path: '/admin/uploads', files: [new File(['one'], 'one.jpg')], scope: 'store-one' };
  const key = await getDurableUploadRetryKey(options);
  expect(await getDurableUploadRetryKey({ ...options, scope: 'store-two' })).not.toBe(key);
  expect(await getDurableUploadRetryKey({ ...options, files: [new File(['two'], 'one.jpg')] })).not.toBe(key);
  expect(await getDurableUploadRetryKey({ ...options, fields: { folder: 'categories' } })).not.toBe(key);
  markUploadAttempt(key); expect(hasUploadAttempt(key)).toBe(true);
  finishUploadRetryKey(key); expect(hasUploadAttempt(key)).toBe(false);
  expect(await getDurableUploadRetryKey({ ...options, files: [new File(['one'], 'one.jpg')] })).not.toBe(key);
});

test('record retry identities survive refresh, are order-independent and do not store form fields', async () => {
  const options = { path: '/social/posts', scope: 'owner-one', body: { caption: 'private caption', productId: 'one' } };
  const key = await getRecordRetryKey(options);
  let reloaded; jest.isolateModules(() => { reloaded = require('./uploadRetry'); });
  expect(await reloaded.getRecordRetryKey({ ...options, body: { productId: 'one', caption: 'private caption' } })).toBe(key);
  expect(await reloaded.getRecordRetryKey({ ...options, body: { ...options.body, caption: 'changed' } })).not.toBe(key);
  expect(localStorage.getItem('samira_pending_operations_v2')).not.toContain('private caption');
});

test('uploaded receipts persist until all uploaded files are referenced in a successful business save', async () => {
  const file = () => new File(['one'], 'one.jpg');
  const options = { path: '/admin/uploads', scope: 'owner', files: [file()] };
  const key = await getDurableUploadRetryKey(options);
  await retainUploadedReceipt(key, [{ url: '/uploads/one.jpg' }, { url: '/uploads/two.jpg' }]);
  expect(await getDurableUploadRetryKey({ ...options, files: [file()] })).toBe(key);
  await confirmUploadedReferences({ image: '/uploads/one.jpg' });
  expect(await getDurableUploadRetryKey({ ...options, files: [file()] })).toBe(key);
  await confirmUploadedReferences({ images: [{ url: 'https://my-store.test/uploads/one.jpg' }, { url: '/uploads/two.jpg' }] });
  expect(await getDurableUploadRetryKey({ ...options, files: [file()] })).not.toBe(key);
  expect(localStorage.getItem('samira_pending_operations_v2')).not.toContain('/uploads/');
});

test('blocked browser storage still protects repeated saves within the active session', async () => {
  const blocked = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('private mode'); });
  try {
    const options = { path: '/admin/product-drafts', body: { name: 'private-mode draft' }, scope: 'owner' };
    const key = await getRecordRetryKey(options);
    expect(await getRecordRetryKey(options)).toBe(key);
    finishUploadRetryKey(key);
    expect(await getRecordRetryKey(options)).not.toBe(key);
  } finally { blocked.mockRestore(); localStorage.clear(); }
});
test('failed re-selection recognises identical bytes and distinguishes a changed photo with the same filename', async () => {
  const one = () => new File(['one'], 'one.webp', { type: 'image/webp' });
  expect(await selectionFingerprint([one()])).toBe(await selectionFingerprint([one()]));
  expect(await selectionFingerprint([one()])).not.toBe(await selectionFingerprint([new File(['two'], 'one.webp', { type: 'image/webp' })]));
});
