export async function inspectProductImage(file) {
  if (!file || typeof document === 'undefined') return null;
  let source;
  let revoke = '';
  try {
    if (typeof createImageBitmap === 'function') source = await createImageBitmap(file);
    else {
      revoke = URL.createObjectURL(file);
      source = await loadImage(revoke);
    }
    const width = Number(source.width || source.naturalWidth || 0);
    const height = Number(source.height || source.naturalHeight || 0);
    const warnings = [];
    if (width && height && (Math.min(width, height) < 700 || width * height < 800000)) warnings.push('low resolution');
    if (width > height * 1.2) warnings.push('landscape crop');
    const sharpness = estimateSharpness(source);
    if (sharpness !== null && sharpness < 75) warnings.push('may be blurry');
    return { name: file.name, width, height, sharpness, warnings };
  } catch {
    return { name: file.name, width: 0, height: 0, sharpness: null, warnings: ['quality could not be checked'] };
  } finally {
    source?.close?.();
    if (revoke) URL.revokeObjectURL(revoke);
  }
}

function estimateSharpness(source) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(source, 0, 0, 64, 64);
    const pixels = context.getImageData(0, 0, 64, 64).data;
    const grey = new Float32Array(64 * 64);
    for (let index = 0; index < grey.length; index += 1) grey[index] = pixels[index * 4] * 0.299 + pixels[index * 4 + 1] * 0.587 + pixels[index * 4 + 2] * 0.114;
    const values = [];
    for (let y = 1; y < 63; y += 1) for (let x = 1; x < 63; x += 1) {
      const i = y * 64 + x;
      values.push(Math.abs(grey[i - 64] + grey[i + 64] + grey[i - 1] + grey[i + 1] - 4 * grey[i]));
    }
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    return Math.round(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
  } catch {
    return null;
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}
