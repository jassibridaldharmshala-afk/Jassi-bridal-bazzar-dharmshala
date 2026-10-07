import { useState } from 'react';
import { getPrimaryImageUrl, isUsableImageUrl, normalizeImageUrl } from '../../services/normalize';

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
      <div className={`relative overflow-hidden bg-[#f6efe8] ${frameClass}`}>
        <img loading="lazy" decoding="async" src={normalizeImageUrl(image)} alt={product.name} onError={() => setImageFailed(true)} className="h-full w-full object-cover object-center" />
      </div>
    );
  }
  const color = swatches[product.colors?.[0]] || '#6d1f34';
  return (
    <div className={`relative overflow-hidden bg-[#f6efe8] ${frameClass}`}>
      <div className="absolute inset-x-5 bottom-0 h-[86%] rounded-t-[90px]" style={{ background: `linear-gradient(145deg, ${color}, #f9d4dd)` }} />
      <div className="absolute left-1/2 top-8 h-24 w-20 -translate-x-1/2 rounded-t-full bg-[#f6d2bf]" />
      <div className="absolute bottom-0 left-1/2 h-[70%] w-[54%] -translate-x-1/2 rounded-t-[80px] bg-white/20 ring-8 ring-white/30" />
      {showMeta && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/35 to-transparent p-2">
          <span className="badge-text rounded bg-white/95 px-2 py-1 font-bold text-slate-700">{product.rating} star | {product.numReviews}</span>
        </div>
      )}
    </div>
  );
}
