import { normalizeImageUrl } from '../services/normalize';
export function responsiveImage(image, use = 'card') {
  if (typeof image === 'string') image = { url: image };
  if (!image) return {};
  const master = normalizeImageUrl(image.url);
  if (use === 'zoom') return { src: master };
  const variants = (image.variants || []).filter(v => Number(v.width) > 0 && normalizeImageUrl(v.url)).sort((a, b) => a.width - b.width);
  if (!variants.length) return { src: master };
  const target = use === 'thumbnail' ? 320 : use === 'detail' ? 1200 : 640;
  const fallback = variants.find(v => v.width >= target) || variants[variants.length - 1];
  return { src: normalizeImageUrl(fallback.url), srcSet: variants.map(v => `${normalizeImageUrl(v.url)} ${v.width}w`).join(', '),
    sizes: use === 'thumbnail' ? '80px' : use === 'detail' ? '(min-width: 768px) 50vw, 100vw' : '(min-width: 1280px) 280px, (min-width: 768px) 25vw, 50vw' };
}
