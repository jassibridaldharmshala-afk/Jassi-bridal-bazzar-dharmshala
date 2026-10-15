import { rememberOriginalUpload } from './uploadRetry';

const supportedTypes = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const supportedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
export const PHOTO_SOURCE_MAX_BYTES = 20 * 1024 * 1024;
export const PHOTO_BATCH_MAX_BYTES = 60 * 1024 * 1024;
export const PHOTO_PRIVATE_MAX_BYTES = 8 * 1024 * 1024;
const photoError = message => Object.assign(new Error(message), { code: 'UPLOAD_IMAGE_INVALID', status: 400 });
const preparedPhotos = new WeakMap();
const workerLibraryUrl = () => new URL(`${process.env.PUBLIC_URL || ''}/vendor/browser-image-compression.js`, window.location.href).href;

export function isSupportedImageFile(file) {
  if (!file) return false;
  const type = String(file.type || '').toLowerCase();
  return supportedTypes.has(type) || (!type && supportedExtensions.some(extension => String(file.name || '').toLowerCase().endsWith(extension)));
}

function validatePhoto(file) {
  if (!isSupportedImageFile(file)) throw photoError('Only JPG, JPEG, PNG, and WEBP images are allowed.');
  if (!file.size) throw photoError('This photo is empty. Choose another photo.');
  if (file.size > PHOTO_SOURCE_MAX_BYTES) throw photoError('Each photo can be up to 20 MB.');
}

export async function preparePhotoUploads(files, { imagesOnly = false, ...options } = {}) {
  const incoming = Array.from(files || []).filter(Boolean);
  if (incoming.filter(isSupportedImageFile).reduce((total, file) => total + file.size, 0) > PHOTO_BATCH_MAX_BYTES) {
    throw photoError('Choose up to 60 MB of photos per upload. Upload the remaining photos in another batch.');
  }
  const prepared = [];
  for (const file of incoming) {
    if (isSupportedImageFile(file)) prepared.push(await compressImageFile(file, options));
    else if (imagesOnly || String(file.type || '').startsWith('image/')) throw photoError('Only JPG, JPEG, PNG, and WEBP images are allowed.');
    else prepared.push(file);
  }
  return prepared;
}

// Reduce the network upload before the server creates its display sizes.
// Preserve the original selection identity so a retry cannot upload duplicates.
export async function compressImageFile(file, options = {}) {
  validatePhoto(file);
  if (preparedPhotos.has(file)) { const saved = await preparedPhotos.get(file); options.onProgress?.(100); return saved; }
  const source = file.type ? file : new File([file], file.name, {
    type: /\.png$/i.test(file.name) ? 'image/png' : /\.webp$/i.test(file.name) ? 'image/webp' : 'image/jpeg',
    lastModified: file.lastModified,
  });
  const pending = (async () => {
    let prepared = source;
    if (source.size > 128 * 1024) {
      const { default: imageCompression } = await import('browser-image-compression');
      const blob = await imageCompression(source, { maxSizeMB: 0.45, maxWidthOrHeight: 1600, initialQuality: 0.85,
        maxIteration: 6, alwaysKeepResolution: false, useWebWorker: true, libURL: workerLibraryUrl(), preserveExif: false, fileType: 'image/webp', onProgress: options.onProgress });
      if (!blob.size || blob.size > 0.45 * 1024 * 1024 || blob.type !== 'image/webp') throw photoError('This photo could not be compressed. Choose another photo.');
      prepared = new File([blob], `${String(file.name).replace(/\.[^.]+$/, '')}.webp`, { type: 'image/webp', lastModified: file.lastModified });
    }
    rememberOriginalUpload(prepared, file);
    Object.defineProperty(prepared, '__compressionMeta', { configurable: true, enumerable: false, writable: true,
      value: { originalSize: file.size, compressedSize: prepared.size, skipped: prepared === source, lossless: prepared === source, convertedToWebp: prepared !== source } });
    preparedPhotos.set(prepared, Promise.resolve(prepared));
    options.onProgress?.(100);
    return prepared;
  })();
  preparedPhotos.set(file, pending);
  try { return await pending; } catch (error) { preparedPhotos.delete(file); throw error; }
}

// A separate, temporary copy for document AI's bounded JSON payload. This is
// never returned to catalog uploaders or used as the saved product photo.
export async function prepareAnalysisImageFile(file) {
  validatePhoto(file);
  if (file.type && file.size <= 512 * 1024) return file;
  const source = file.type ? file : new File([file], file.name, { type: /\.png$/i.test(file.name) ? 'image/png' : /\.webp$/i.test(file.name) ? 'image/webp' : 'image/jpeg' });
  const { default: imageCompression } = await import('browser-image-compression');
  const blob = await imageCompression(source, { maxSizeMB: 0.5, maxWidthOrHeight: 2400, initialQuality: 0.95,
    maxIteration: 4, alwaysKeepResolution: false, useWebWorker: true, libURL: workerLibraryUrl(), preserveExif: false, fileType: 'image/webp' });
  if (!blob.size || blob.size > 512 * 1024 || blob.type !== 'image/webp') throw photoError('This document is too detailed for AI extraction. Crop the relevant text or paste its text.');
  return new File([blob], `${String(file.name).replace(/\.[^.]+$/, '')}-analysis.webp`, { type: 'image/webp', lastModified: file.lastModified });
}
