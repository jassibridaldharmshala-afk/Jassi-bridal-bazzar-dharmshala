import { compressImageFile, isSupportedImageFile, preparePhotoUploads, prepareAnalysisImageFile,
  PHOTO_SOURCE_MAX_BYTES, PHOTO_BATCH_MAX_BYTES } from './imageCompression';
import { getUploadRetryKey } from './uploadRetry';
const mockCompress = jest.fn();
jest.mock('browser-image-compression', () => ({ __esModule: true, default: (...args) => mockCompress(...args) }));

test.each(['image/jpeg', 'image/png', 'image/webp'])('saved %s photos retain their original encoded bytes despite legacy size options', async type => {
  const file = new File([new Uint8Array(3 * 1024 * 1024)], 'detailed-photo.' + type.split('/')[1], { type });
  const progress = jest.fn();
  const output = await compressImageFile(file, { maxWidthOrHeight: 320, targetMaxSizeMb: 0.1, onProgress: progress });
  expect(output).toBe(file);
  expect(output.size).toBe(3 * 1024 * 1024);
  expect(output.__compressionMeta).toMatchObject({ skipped: true, lossless: true, convertedToWebp: false });
  expect(progress).toHaveBeenCalledWith(100);
  expect(mockCompress).not.toHaveBeenCalled();
});

test('extension-only photos receive the correct MIME without changing bytes or retry identity', async () => {
  const file = new File(['original pixels'], 'detail.png');
  const output = await compressImageFile(file);
  expect(output.type).toBe('image/png'); expect(output.name).toBe(file.name); expect(output.size).toBe(file.size);
  expect(getUploadRetryKey({ path: '/admin/uploads', files: [output] })).toBe(getUploadRetryKey({ path: '/admin/uploads', files: [file] }));
  expect(isSupportedImageFile({ name: 'forged.jpg', type: 'text/plain' })).toBe(false);
});

test('empty, unsupported and oversized photos fail before upload', async () => {
  await expect(compressImageFile(new File([], 'empty.png', { type: 'image/png' }))).rejects.toThrow('empty');
  await expect(compressImageFile(new File(['x'], 'bad.txt', { type: 'text/plain' }))).rejects.toThrow('Only JPG');
  await expect(compressImageFile(new File([new Uint8Array(PHOTO_SOURCE_MAX_BYTES + 1)], 'huge.jpg', { type: 'image/jpeg' }))).rejects.toThrow('20 MB');
});

test('mixed evidence preserves photos, videos and documents, with a bounded total photo size', async () => {
  const photo = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' });
  const video = new File(['video'], 'video.mp4', { type: 'video/mp4' });
  const document = new File(['pdf'], 'invoice.pdf', { type: 'application/pdf' });
  expect(await preparePhotoUploads([photo, video, document])).toEqual([photo, video, document]);
  await expect(preparePhotoUploads([video], { imagesOnly: true })).rejects.toThrow('Only JPG');
  await expect(preparePhotoUploads([new File(['gif'], 'animated.gif', { type: 'image/gif' })])).rejects.toThrow('Only JPG');
  const large = new File([new Uint8Array(PHOTO_SOURCE_MAX_BYTES)], 'large.jpg', { type: 'image/jpeg' });
  expect(PHOTO_BATCH_MAX_BYTES).toBe(3 * PHOTO_SOURCE_MAX_BYTES);
  await expect(preparePhotoUploads([large, large, large, photo])).rejects.toThrow('60 MB');
});

test('document AI gets its own bounded copy while the saved original remains untouched', async () => {
  const original = new File([new Uint8Array(3 * 1024 * 1024)], 'invoice.jpg', { type: 'image/jpeg' });
  mockCompress.mockResolvedValueOnce(new Blob(['analysis'], { type: 'image/webp' }));
  const analysis = await prepareAnalysisImageFile(original);
  expect(analysis.name).toBe('invoice-analysis.webp'); expect(analysis.size).toBeLessThanOrEqual(512 * 1024);
  expect(mockCompress).toHaveBeenLastCalledWith(original, expect.objectContaining({ maxSizeMB: 0.5, maxWidthOrHeight: 2400, initialQuality: 0.95 }));
  expect(await compressImageFile(original)).toBe(original);
  expect(original.size).toBe(3 * 1024 * 1024);
  mockCompress.mockResolvedValueOnce(new Blob([new Uint8Array(600 * 1024)], { type: 'image/webp' }));
  await expect(prepareAnalysisImageFile(original)).rejects.toThrow('too detailed');
});
