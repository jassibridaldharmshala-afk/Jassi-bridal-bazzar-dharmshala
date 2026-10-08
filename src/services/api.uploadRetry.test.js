import api from './api';
import { compressImageFile, isSupportedImageFile } from './imageCompression';
import { waitFor } from '@testing-library/react';
import { confirmUploadedReferences } from './uploadRetry';
const mockInitiate = jest.fn(value => value);
const mockDispatch = jest.fn();
let mockAuth;
jest.mock('../store/apiSlice', () => ({ samiraApi: { endpoints: { upload: { initiate: value => mockInitiate(value) }, mutate: { initiate: value => mockInitiate(value) } } } }));
jest.mock('../store/store', () => ({ store: { dispatch: value => mockDispatch(value), getState: () => ({ auth: mockAuth }) } }));
jest.mock('../utils/mobileLoader', () => ({ startMobileLoader: jest.fn(), stopMobileLoader: jest.fn() }));
jest.mock('./imageCompression', () => ({ compressImageFile: jest.fn(), isSupportedImageFile: jest.fn() }));
beforeEach(() => {
  jest.clearAllMocks(); sessionStorage.clear(); localStorage.clear();
  mockAuth = { user: { _id: 'owner', activeMode: 'admin' }, token: 'one' };
  isSupportedImageFile.mockReturnValue(true); compressImageFile.mockImplementation(file => Promise.resolve(file));
  mockDispatch.mockImplementation(() => ({ unwrap: async () => ({ files: [{ url: '/uploads/saved.webp' }] }), reset: jest.fn(), abort: jest.fn() }));
});
function file() { return new File(['photo'], 'photo.webp', { type: 'image/webp' }); }

test('mixed evidence photos are compressed before dispatch while videos remain unchanged', async () => {
  const photo = new File([new Uint8Array(3 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });
  const compressed = new File(['optimized'], 'large.webp', { type: 'image/webp' });
  const video = new File(['video'], 'packing.mp4', { type: 'video/mp4' });
  isSupportedImageFile.mockImplementation(file => file.type.startsWith('image/'));
  compressImageFile.mockResolvedValue(compressed);
  mockDispatch.mockImplementation(() => ({ unwrap: async () => ({ files: [{ url: '/uploads/evidence.webp' }, { url: '/uploads/packing.mp4' }] }), reset: jest.fn() }));
  await api.upload('/admin/orders/evidence/uploads', [photo, video], { fieldName: 'files' });
  expect(mockInitiate.mock.calls[0][0].files).toEqual([compressed, video]);
  expect(compressImageFile).toHaveBeenCalledTimes(1);
});

test('already-uploaded evidence is reused when the following form save fails', async () => {
  const photos = [file()];
  const first = await api.upload('/returns/evidence/uploads', photos, { fieldName: 'files' });
  // The owning form still has these files after its JSON save failed.
  const retry = await api.upload('/returns/evidence/uploads', photos, { fieldName: 'files' });
  expect(retry).toEqual(first); expect(mockDispatch).toHaveBeenCalledTimes(1);
  expect(mockInitiate.mock.calls[0][0].idempotencyKey).toMatch(/^[a-zA-Z0-9_-]{16,100}$/);
});
test('a failed upload keeps its key for the retry instead of claiming a new storage operation', async () => {
  const photos = [file()];
  mockDispatch.mockImplementationOnce(() => ({ unwrap: async () => { throw { status: 'FETCH_ERROR' }; }, reset: jest.fn() }));
  await expect(api.upload('/admin/uploads?folder=products', photos)).rejects.toThrow();
  await api.upload('/admin/uploads?folder=products', photos);
  expect(mockDispatch).toHaveBeenCalledTimes(2);
  expect(mockInitiate.mock.calls[0][0].idempotencyKey).toBe(mockInitiate.mock.calls[1][0].idempotencyKey);
});
test('concurrent uploads share preparation and the network request', async () => {
  const photos = [file()]; let finish;
  mockDispatch.mockImplementation(() => ({ unwrap: () => new Promise(resolve => { finish = resolve; }), reset: jest.fn() }));
  const first = api.upload('/admin/uploads', photos);
  const second = api.upload('/admin/uploads', photos);
  await waitFor(() => expect(mockDispatch).toHaveBeenCalledTimes(1));
  expect(mockDispatch).toHaveBeenCalledTimes(1); expect(compressImageFile).toHaveBeenCalledTimes(1);
  finish({ files: [{ url: '/uploads/one.webp' }] });
  expect(await first).toEqual(await second);
});
test('owners, stores and folders are isolated; the same uncommitted photo is reused until its form is saved', async () => {
  const photos = [file()];
  await api.upload('/admin/uploads?folder=products', photos);
  mockAuth.user._id = 'other'; await api.upload('/admin/uploads?folder=products', photos);
  sessionStorage.setItem('samira_store_slug', 'new-store'); await api.upload('/admin/uploads?folder=products', photos);
  await api.upload('/admin/uploads?folder=categories', photos);
  await api.upload('/admin/uploads?folder=products', [file()]);
  expect(new Set(mockInitiate.mock.calls.map(([value]) => value.idempotencyKey)).size).toBe(4);
  await confirmUploadedReferences({ images: [{ url: '/uploads/saved.webp' }] });
  await api.upload('/admin/uploads?folder=products', [file()]);
  expect(new Set(mockInitiate.mock.calls.map(([value]) => value.idempotencyKey)).size).toBe(5);
});
test('proof writes and background processing do not reuse business responses', async () => {
  const photos = [file()];
  for (const path of ['/admin/rentals/bookings/booking/proofs', '/admin/uploads/background']) {
    await api.upload(path, photos); await api.upload(path, photos);
  }
  expect(mockDispatch).toHaveBeenCalledTimes(4);
  expect(mockInitiate.mock.calls.every(([value]) => !value.idempotencyKey)).toBe(true);
});
test('cancellation during preparation prevents the network upload', async () => {
  let prepared; let control;
  const photo = file(); compressImageFile.mockImplementation(() => new Promise(resolve => { prepared = resolve; }));
  const pending = api.upload('/admin/uploads', [photo], { onRequest: value => { control = value; } });
  await waitFor(() => expect(prepared).toEqual(expect.any(Function)));
  control.cancel(); prepared(photo);
  await expect(pending).rejects.toThrow('Upload cancelled'); expect(mockDispatch).not.toHaveBeenCalled();
});

test('a retry resumes an uploaded receipt without sending or compressing the photo again', async () => {
  const photos = [file()];
  mockDispatch.mockImplementationOnce(() => ({ unwrap: async () => { throw { status: 'FETCH_ERROR' }; }, reset: jest.fn() }));
  await expect(api.upload('/admin/uploads?folder=products', photos)).rejects.toThrow();
  await api.upload('/admin/uploads?folder=products', photos);
  expect(mockInitiate.mock.calls[1][0]).toMatchObject({ body: { resumeUpload: true }, idempotencyKey: mockInitiate.mock.calls[0][0].idempotencyKey });
  expect(mockInitiate.mock.calls[1][0].files).toBeUndefined();
  expect(compressImageFile).toHaveBeenCalledTimes(1);
});

test('an incomplete receipt falls back to the same-key multipart upload', async () => {
  const photos = [file()];
  mockDispatch.mockImplementationOnce(() => ({ unwrap: async () => { throw { status: 'FETCH_ERROR' }; }, reset: jest.fn() }));
  await expect(api.upload('/admin/uploads', photos)).rejects.toThrow();
  mockDispatch.mockImplementationOnce(() => ({ unwrap: async () => { throw { status: 409, data: { code: 'UPLOAD_INCOMPLETE' } }; }, reset: jest.fn() }));
  await api.upload('/admin/uploads', photos);
  expect(mockInitiate.mock.calls[2][0].files).toEqual(photos);
  expect(new Set(mockInitiate.mock.calls.map(([value]) => value.idempotencyKey)).size).toBe(1);
});

test('direct reel uploads receive retry keys but job responses are not media-cached', async () => {
  mockDispatch.mockImplementation(() => ({ unwrap: async () => ({ data: { id: 'job', status: 'queued' } }), reset: jest.fn() }));
  const reel = new File(['video'], 'one.mp4', { type: 'video/mp4' });
  await api.upload('/admin/reel-imports', [reel], { fieldName: 'video' });
  await api.upload('/admin/reel-imports', [reel], { fieldName: 'video' });
  expect(mockDispatch).toHaveBeenCalledTimes(2);
  expect(mockInitiate.mock.calls[0][0].idempotencyKey).toBe(mockInitiate.mock.calls[1][0].idempotencyKey);
});

test('a confirmed upload followed by a failed form save survives refresh without another multipart upload', async () => {
  await api.upload('/admin/uploads?folder=products', [file()]);
  const key = mockInitiate.mock.calls[0][0].idempotencyKey;
  mockDispatch.mockImplementationOnce(() => ({ unwrap: async () => { throw { status: 503 }; } }));
  await expect(api.post('/admin/product-drafts', { name: 'One', images: [{ url: '/uploads/saved.webp' }] })).rejects.toThrow();
  let reloaded; jest.isolateModules(() => { reloaded = require('./api').default; });
  await reloaded.upload('/admin/uploads?folder=products', [file()]);
  expect(mockInitiate.mock.calls[2][0]).toMatchObject({ idempotencyKey: key, body: { resumeUpload: true } });
  expect(mockInitiate.mock.calls[2][0].files).toBeUndefined(); expect(compressImageFile).toHaveBeenCalledTimes(1);
});

test('new draft/banner/post create requests reuse their key after failure, but a confirmed new save gets a new key', async () => {
  for (const path of ['/admin/product-drafts', '/seller/banners', '/social/posts?storeId=one']) {
    const body = { name: 'private form' };
    mockDispatch.mockImplementationOnce(() => ({ unwrap: async () => { throw { status: 'FETCH_ERROR' }; } }));
    await expect(api.post(path, body)).rejects.toThrow();
    const first = mockInitiate.mock.calls.at(-1)[0];
    await api.post(path, body); const retry = mockInitiate.mock.calls.at(-1)[0];
    expect(retry.idempotencyKey).toBe(first.idempotencyKey);
    await api.post(path, body); expect(mockInitiate.mock.calls.at(-1)[0].idempotencyKey).not.toBe(first.idempotencyKey);
  }
});

test('simultaneous create clicks share one network request', async () => {
  let finish; mockDispatch.mockImplementation(() => ({ unwrap: () => new Promise(resolve => { finish = resolve; }) }));
  const one = api.post('/admin/product-drafts', { name: 'one' });
  const two = api.post('/admin/product-drafts', { name: 'one' });
  await waitFor(() => expect(mockDispatch).toHaveBeenCalledTimes(1));
  finish({ success: true, data: { _id: 'one' } });
  expect(await one).toEqual(await two);
});
