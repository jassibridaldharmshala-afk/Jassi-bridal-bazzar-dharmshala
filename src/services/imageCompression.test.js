import { compressImageFile, isSupportedImageFile, preparePhotoUploads, PHOTO_MAX_BYTES, PHOTO_SOURCE_MAX_BYTES } from './imageCompression';
const mockLoadModule = jest.fn();
const mockCompress = jest.fn();
jest.mock('browser-image-compression', () => {
  mockLoadModule();
  return { __esModule: true, default: (...args) => mockCompress(...args) };
});

test('file validation and small WebP uploads do not load the compression library', async () => {
  expect(isSupportedImageFile({ name: 'image.jpg' })).toBe(true);
  const file = new File(['small'], 'small.webp', { type: 'image/webp' });
  expect(await compressImageFile(file)).toBe(file);
  expect(file.__compressionMeta.skipped).toBe(true);
  await expect(compressImageFile(new File(['x'], 'bad.txt', { type: 'text/plain' }))).rejects.toThrow('Only JPG');
  expect(mockLoadModule).not.toHaveBeenCalled();
});

test('compression module loads on first required upload and keeps worker/options behavior', async () => {
  mockCompress.mockResolvedValue(new Blob(['compressed'], { type: 'image/webp' }));
  const file = new File(['jpg'], 'photo.jpg', { type: 'image/jpeg' });
  const progress = jest.fn();
  const result = await compressImageFile(file, { onProgress: progress });
  expect(mockLoadModule).toHaveBeenCalledTimes(1);
  expect(mockCompress).toHaveBeenCalledWith(file, expect.objectContaining({ useWebWorker: true, fileType: 'image/webp', onProgress: progress }));
  expect(result.name).toBe('photo.webp');
  expect(result.__compressionMeta.convertedToWebp).toBe(true);
});

test('compression failure is reported and another upload can retry', async () => {
  const file = new File(['jpg'], 'photo.jpg', { type: 'image/jpeg' });
  mockCompress.mockRejectedValueOnce(new Error('Compression interrupted')).mockResolvedValueOnce(new Blob(['ok'], { type: 'image/webp' }));
  await expect(compressImageFile(file)).rejects.toThrow('Compression interrupted');
  expect((await compressImageFile(file)).type).toBe('image/webp');
});

test('photos over 2 MB and oversized WebP are optimized below 100 decimal KB, ignoring old form targets', async () => {
  mockCompress.mockReset().mockResolvedValue(new Blob(['optimized'], { type: 'image/webp' }));
  for (const type of ['image/jpeg', 'image/webp']) {
    const file = new File([new Uint8Array(3 * 1024 * 1024)], type === 'image/webp' ? 'large.webp' : 'large.jpg', { type });
    file.__compressionMeta = { skipped: true }; // stale metadata must not bypass size policy
    const output = await compressImageFile(file, { targetMaxSizeMb: 0.7, targetMinSizeMb: 0.3 });
    expect(output.size).toBeLessThan(100_000);
    expect(mockCompress).toHaveBeenLastCalledWith(file, expect.objectContaining({ maxSizeMB: PHOTO_MAX_BYTES / (1024 * 1024), maxIteration: 1, initialQuality: 0.92 }));
  }
  expect(mockCompress).toHaveBeenCalledTimes(2);
});

test('adaptive retries use the original photo and shrink dimensions while keeping high encoding quality', async () => {
  mockCompress.mockReset()
    .mockResolvedValueOnce(new Blob([new Uint8Array(220000)], { type: 'image/webp' }))
    .mockResolvedValueOnce(new Blob(['fits'], { type: 'image/webp' }));
  const file = new File(['source'], 'detail.png', { type: 'image/png' });
  const output = await compressImageFile(file);
  expect(output.size).toBeLessThanOrEqual(PHOTO_MAX_BYTES);
  expect(mockCompress.mock.calls[1][0]).toBe(file);
  expect(mockCompress.mock.calls[1][1].maxWidthOrHeight).toBeLessThan(1600);
  expect(mockCompress.mock.calls[1][1].initialQuality).toBe(0.92);
});

test('an oversized result fails clearly and never uploads the original as a fallback', async () => {
  mockCompress.mockReset().mockResolvedValue(new Blob([new Uint8Array(200000)], { type: 'image/webp' }));
  const file = new File(['source'], 'complex.jpg', { type: 'image/jpeg' });
  await expect(compressImageFile(file)).rejects.toMatchObject({ status: 400, code: 'UPLOAD_IMAGE_INVALID' });
  expect(mockCompress.mock.calls.length).toBeLessThanOrEqual(8);
  await expect(compressImageFile(new File([new Uint8Array(PHOTO_SOURCE_MAX_BYTES + 1)], 'huge.jpg', { type: 'image/jpeg' }))).rejects.toThrow('20 MB');
});

test('mixed evidence compresses photos only and rejects unsupported photos', async () => {
  mockCompress.mockReset().mockResolvedValue(new Blob(['fits'], { type: 'image/webp' }));
  const photo = new File(['source'], 'photo.jpg', { type: 'image/jpeg' });
  const video = new File(['video'], 'video.mp4', { type: 'video/mp4' });
  const document = new File(['pdf'], 'invoice.pdf', { type: 'application/pdf' });
  const files = await preparePhotoUploads([photo, video, document]);
  expect(files[0].type).toBe('image/webp');
  expect(files.slice(1)).toEqual([video, document]);
  await expect(preparePhotoUploads([new File(['gif'], 'animated.gif', { type: 'image/gif' })])).rejects.toThrow('Only JPG');
  expect(isSupportedImageFile({ name: 'forged.jpg', type: 'text/plain' })).toBe(false);
});
