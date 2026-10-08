import { rememberOriginalUpload } from './uploadRetry';

const compressionCache = new WeakMap();
const supportedTypes = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const supportedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
// Decimal KB, with a margin below 100,000 bytes.
export const PHOTO_MAX_BYTES = 99_000;
export const PHOTO_SOURCE_MAX_BYTES = 20 * 1024 * 1024;
const DEFAULT_MAX_WIDTH_OR_HEIGHT = 1600;
const DEFAULT_TARGET_QUALITY = 0.92;

export function isSupportedImageFile(file) {
  if (!file) return false;
  const type = String(file.type || '').toLowerCase();
  if (supportedTypes.has(type)) return true;
  const name = String(file.name || '').toLowerCase();
  return !type && supportedExtensions.some((extension) => name.endsWith(extension));
}

function photoError(message) {
  return Object.assign(new Error(message), { code: 'UPLOAD_IMAGE_INVALID', status: 400 });
}

// Mixed evidence uploads compress photos while preserving videos and documents.
export async function preparePhotoUploads(files, { imagesOnly = false, ...options } = {}) {
  const prepared = [];
  for (const file of Array.from(files || [])) {
    if (!file) continue;
    if (isSupportedImageFile(file)) prepared.push(await compressImageFile(file, options));
    else if (imagesOnly || String(file.type || '').startsWith('image/')) throw photoError('Only JPG, JPEG, PNG, and WEBP images are allowed.');
    else prepared.push(file);
  }
  return prepared;
}

export function compressImageFile(file, options = {}) {
  if (!file || typeof file !== 'object') return compressImage(file, options);
  const key = JSON.stringify([options.maxWidthOrHeight || DEFAULT_MAX_WIDTH_OR_HEIGHT]);
  if (!compressionCache.has(file)) compressionCache.set(file, new Map());
  const entries = compressionCache.get(file);
  if (!entries.has(key)) {
    const pending = compressImage(file, options).then(prepared => { rememberOriginalUpload(prepared, file); return prepared; }).catch(error => { entries.delete(key); throw error; });
    entries.set(key, pending);
  }
  return entries.get(key);
}

async function compressImage(file, options = {}) {
  if (!isSupportedImageFile(file)) {
    throw photoError('Only JPG, JPEG, PNG, and WEBP images are allowed.');
  }

  if (!file.size) throw photoError('This photo is empty. Choose another photo.');
  if (file.size > PHOTO_SOURCE_MAX_BYTES) throw photoError('Each source photo can be up to 20 MB before compression.');
  const originalSize = Number(file.size || 0);
  const targetMaxSizeMb = PHOTO_MAX_BYTES / (1024 * 1024);
  const maxWidthOrHeight = Math.max(320, Math.min(DEFAULT_MAX_WIDTH_OR_HEIGHT, Number(options.maxWidthOrHeight) || DEFAULT_MAX_WIDTH_OR_HEIGHT));

  if (file.size <= PHOTO_MAX_BYTES && isPreferredUploadType(file)) {
    options.onProgress?.(100);
    return attachCompressionMeta(file, {
      originalSize,
      compressedSize: originalSize,
      skipped: true,
      convertedToWebp: file.type === 'image/webp',
      maxWidthOrHeight,
      targetMaxSizeMb,
    });
  }

  try {
    // Validation and already-small WebP uploads do not need the compressor.
    const { default: imageCompression } = await import('browser-image-compression');
    const source = file.type ? file : new File([file], file.name, {
      type: /\.png$/i.test(file.name) ? 'image/png' : /\.webp$/i.test(file.name) ? 'image/webp' : 'image/jpeg',
      lastModified: file.lastModified,
    });
    let dimension = maxWidthOrHeight;
    let compressed;
    // Always start from the source. One iteration keeps quality >= .92 * .95;
    // reduce dimensions instead of repeatedly lowering encoding quality.
    for (let attempt = 0; attempt < 8; attempt += 1) {
      compressed = await imageCompression(source, {
        maxSizeMB: targetMaxSizeMb, maxWidthOrHeight: dimension, maxIteration: 1,
        alwaysKeepResolution: false, useWebWorker: true,
        initialQuality: DEFAULT_TARGET_QUALITY, preserveExif: false, fileType: 'image/webp',
        onProgress: typeof options.onProgress === 'function' ? options.onProgress : undefined,
      });
      if (compressed.type !== 'image/webp') throw photoError('Your browser could not encode this photo as WebP. Try an updated browser.');
      if (compressed.size > 0 && compressed.size <= PHOTO_MAX_BYTES) break;
      if (dimension === 320 || !compressed.size) break;
      dimension = Math.max(320, Math.floor(dimension * Math.min(0.85, Math.sqrt(PHOTO_MAX_BYTES / compressed.size) * 0.94)));
    }
    if (!compressed?.size || compressed.size > PHOTO_MAX_BYTES) throw photoError('This photo could not fit below 100 KB at high quality. Crop unnecessary background and try again.');

    const outputName = `${String(file.name || 'image').replace(/\.[^.]+$/, '')}.webp`;
    const compressedFile = new File([compressed], outputName, {
      type: 'image/webp',
      lastModified: file.lastModified || Date.now(),
    });
    return attachCompressionMeta(compressedFile, {
      originalSize,
      compressedSize: Number(compressedFile.size || 0),
      skipped: false,
      convertedToWebp: true,
      maxWidthOrHeight: dimension,
      targetMaxSizeMb,
    });
  } catch (error) {
    throw photoError(error.message || 'Image compression failed. Please try again.');
  }
}

function isPreferredUploadType(file) {
  return String(file?.type || '').toLowerCase() === 'image/webp';
}

function attachCompressionMeta(file, meta) {
  try {
    Object.defineProperty(file, '__compressionMeta', {
      value: {
        originalSize: meta.originalSize,
        compressedSize: meta.compressedSize,
        skipped: Boolean(meta.skipped),
        convertedToWebp: Boolean(meta.convertedToWebp),
        maxWidthOrHeight: meta.maxWidthOrHeight,
        targetMaxSizeMb: meta.targetMaxSizeMb,
      },
      configurable: true,
      enumerable: false,
      writable: true,
    });
  } catch {
    file.__compressionMeta = meta;
  }
  return file;
}
