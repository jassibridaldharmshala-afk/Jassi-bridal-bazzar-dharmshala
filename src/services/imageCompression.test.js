import { compressImageFile, isSupportedImageFile } from './imageCompression';
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
  mockCompress.mockRejectedValueOnce(new Error('Compression interrupted')).mockResolvedValueOnce(new Blob(['ok']));
  await expect(compressImageFile(file)).rejects.toThrow('Compression interrupted');
  expect((await compressImageFile(file)).type).toBe('image/webp');
});
