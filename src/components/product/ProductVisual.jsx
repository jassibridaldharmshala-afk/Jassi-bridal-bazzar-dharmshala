import { responsiveImage } from '../../utils/responsiveImages';
import { useState } from 'react';
import { getPrimaryImageUrl, isUsableImageUrl } from '../../services/normalize';

const swatches = {
  Wine: '#6d1f34',
  Blush: '#ffb4c5',
  Gold: '#b8914a',
  Ivory: '#fff7e6',
  Black: '#17161a',
  Emerald: '#0f6b52',
  Navy: '#172554',
  Rose: '#ff5f86',
};

export function ProductVisual({ product, compact = false, showMeta = true }) {
  const [imageFailed, setImageFailed] = useState(false);
  const image = getPrimaryImageUrl(product.images) || product.images?.find((item) => isUsableImageUrl(item?.url))?.url;
  const frameClass = compact ? 'aspect-[4/5] w-full' : 'h-56 w-full md:h-64';
  if (image && !imageFailed) {
    return (
      <div className={`relative overflow-hidden bg-[color:var(--site-accent-soft)] ${frameClass}`}>
        <img loading="lazy" decoding="async" {...responsiveImage(product.images?.find(item => item.url === image) || { url: image })} alt={product.name} onError={() => setImageFailed(true)} className="h-full w-full object-cover object-center" />
      </div>
    );
  }
  const color = swatches[product.colors?.[0]] || '#6d1f34';
  return (
    <div className={`relative overflow-hidden bg-[color:var(--site-accent-soft)] ${frameClass}`}>
      <div className="absolute inset-x-5 bottom-0 h-[86%] rounded-t-[90px]" style={{ background: `linear-gradient(145deg, ${color}, var(--site-tint))` }} />
      <div className="absolute left-1/2 top-8 h-24 w-20 -translate-x-1/2 rounded-t-full bg-[color:var(--site-accent-soft)]" />
      <div className="absolute bottom-0 left-1/2 h-[70%] w-[54%] -translate-x-1/2 rounded-t-[80px] bg-[color:color-mix(in_srgb,var(--site-surface)_20%,transparent)] ring-8 ring-[color:color-mix(in_srgb,var(--site-border)_30%,transparent)]" />
      {showMeta && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[color:color-mix(in_srgb,var(--site-media-black)_35%,transparent)] to-transparent p-2">
          <span className="badge-text rounded bg-[color:color-mix(in_srgb,var(--site-surface)_95%,transparent)] px-2 py-1 font-bold text-[color:var(--site-muted)]">{product.rating} star | {product.numReviews}</span>
        </div>
      )}
    </div>
  );
}
