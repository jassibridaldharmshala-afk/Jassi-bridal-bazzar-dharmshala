import { rememberOriginalUpload } from './uploadRetry';

const compressionCache = new WeakMap();
const supportedTypes = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const supportedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
const DEFAULT_MAX_WIDTH_OR_HEIGHT = 1600;
const DEFAULT_TARGET_MIN_MB = 0.3;
const DEFAULT_TARGET_MAX_MB = 0.7;
const DEFAULT_TARGET_QUALITY = 0.84;

export function isSupportedImageFile(file) {
  if (!file) return false;
  const type = String(file.type || '').toLowerCase();
  if (supportedTypes.has(type)) return true;
  const name = String(file.name || '').toLowerCase();
  return supportedExtensions.some((extension) => name.endsWith(extension));
}

export function compressImageFile(file, options = {}) {
  if (!file || typeof file !== 'object') return compressImage(file, options);
  const key = JSON.stringify(Object.keys(options).filter(key => typeof options[key] !== 'function').sort().map(key => [key, options[key]]));
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
    throw new Error('Only JPG, JPEG, PNG, and WEBP images are allowed.');
  }

  const maxOriginalSizeMb = Number(options.maxOriginalSizeMb || 2);
  const softLimitBytes = maxOriginalSizeMb * 1024 * 1024;
  const originalSize = Number(file.size || 0);
  const targetMinMb = Number(options.targetMinSizeMb || DEFAULT_TARGET_MIN_MB);
  const targetMaxMb = Number(options.targetMaxSizeMb || DEFAULT_TARGET_MAX_MB);
  const targetMaxSizeMb = pickTargetSizeMb(file, targetMinMb, targetMaxMb);
  const maxWidthOrHeight = Number(options.maxWidthOrHeight || DEFAULT_MAX_WIDTH_OR_HEIGHT);

  if (file.size <= softLimitBytes && isPreferredUploadType(file)) {
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
    const compressed = await imageCompression(file, {
      maxSizeMB: targetMaxSizeMb,
      maxWidthOrHeight,
      alwaysKeepResolution: false,
      useWebWorker: true,
      initialQuality: Number(options.initialQuality || DEFAULT_TARGET_QUALITY),
      preserveExif: false,
      fileType: 'image/webp',
      onProgress: typeof options.onProgress === 'function' ? options.onProgress : undefined,
    });

    const outputName = String(file.name || 'image').replace(/\.[^.]+$/, '.webp');
    const compressedFile = new File([compressed], outputName, {
      type: 'image/webp',
      lastModified: file.lastModified || Date.now(),
    });
    return attachCompressionMeta(compressedFile, {
      originalSize,
      compressedSize: Number(compressedFile.size || 0),
      skipped: false,
      convertedToWebp: true,
      maxWidthOrHeight,
      targetMaxSizeMb,
    });
  } catch (error) {
    throw new Error(error.message || 'Image compression failed. Please try again.');
  }
}

function isPreferredUploadType(file) {
  return String(file?.type || '').toLowerCase() === 'image/webp';
}

function pickTargetSizeMb(file, minMb, maxMb) {
  const bytes = Number(file?.size || 0);
  if (bytes >= 12 * 1024 * 1024) return maxMb;
  if (bytes >= 6 * 1024 * 1024) return Math.min(maxMb, 0.6);
  if (bytes >= 3 * 1024 * 1024) return Math.min(maxMb, 0.5);
  return minMb;
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
