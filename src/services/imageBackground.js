import api from './api';
import { compressImageFile } from './imageCompression';

// One preset catalogue for controls and the pixels saved to storage.
export const BACKGROUND_PRESETS = [
  { id: 'white', label: 'Pure white', colors: ['#ffffff'] },
  { id: 'grey', label: 'Light grey', colors: ['#f1f2f4'] },
  { id: 'beige', label: 'Soft beige', colors: ['#f3e9dd'] },
  { id: 'studio', label: 'Clean studio', colors: ['#ffffff', '#e4e1dc'], radial: true },
  { id: 'gradient', label: 'Subtle gradient', colors: ['#f7f3ef', '#e3e8ee'] },
];

export async function removeImageBackground(file, uploadPath, onRequest) {
  const result = await api.upload(`${uploadPath}/background`, [file], { fieldName: 'image', silent: true, onRequest });
  if (!result.image?.startsWith('data:image/png;base64,')) throw new Error('No background preview was returned.');
  return result.image;
}

export async function composeBackground(cutout, presetId) {
  const source = new Image();
  source.src = cutout;
  await source.decode();
  const canvas = document.createElement('canvas');
  canvas.width = source.naturalWidth; canvas.height = source.naturalHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Image editing is unavailable in this browser.');
  const preset = BACKGROUND_PRESETS.find(item => item.id === presetId);
  if (presetId !== 'transparent' && !preset) throw new Error('Choose a valid background.');
  if (preset) {
    let fill = preset.colors[0];
    if (preset.colors.length > 1) {
      fill = preset.radial
        ? context.createRadialGradient(canvas.width / 2, canvas.height / 3, 0, canvas.width / 2, canvas.height / 3, Math.max(canvas.width, canvas.height))
        : context.createLinearGradient(0, 0, canvas.width, canvas.height);
      preset.colors.forEach((color, index) => fill.addColorStop(index / (preset.colors.length - 1), color));
    }
    context.fillStyle = fill; context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context.drawImage(source, 0, 0);
  const blob = await new Promise((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error('Could not prepare the preview.')), 'image/webp', 0.92));
  // Preview exactly the compressed file that the normal uploader will store.
  return compressImageFile(new File([blob], `product-${presetId}.webp`, { type: blob.type }), { maxOriginalSizeMb: 2, maxWidthOrHeight: 1600 });
}

export function applyBackgroundAsset(image, asset, preset) {
  const original = image.background?.original || { url: image.url, publicId: image.publicId };
  return { ...image, url: asset.url, publicId: asset.publicId, background: { original, edited: { url: asset.url, publicId: asset.publicId }, preset } };
}

export function restoreOriginalAsset(image) {
  return image.background ? { ...image, ...image.background.original } : image;
}
