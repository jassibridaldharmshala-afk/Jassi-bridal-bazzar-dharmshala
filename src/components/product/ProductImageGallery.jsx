import { useEffect, useState } from 'react';
import { ProductVisual } from './ProductCard';
import { getPrimaryImageIndex, normalizeImageUrl } from '../../services/normalize';

export default function ProductImageGallery({ product }) {
  const images = product.images?.filter((image) => image.url) || [];
  const primaryIndex = getPrimaryImageIndex(images);
  const [active, setActive] = useState(0);

  useEffect(() => {
    setActive(primaryIndex);
  }, [primaryIndex]);

  if (!images.length) {
    return (
      <div className="overflow-hidden rounded-xl bg-white shadow-sm md:rounded-3xl">
        <ProductVisual product={product} />
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-[80px_1fr]">
      <div className="order-2 flex gap-2 overflow-x-auto md:order-1 md:block md:space-y-3">
        {images.map((image, index) => (
          <button key={`${image.url}-${index}`} onClick={() => setActive(index)} className={`h-20 w-16 shrink-0 overflow-hidden rounded-xl border-2 shadow-sm ${active === index ? 'border-wine' : 'border-white'}`}>
            <img src={normalizeImageUrl(image.url)} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
      <div className="order-1 overflow-hidden rounded-xl bg-white shadow-sm md:order-2 md:rounded-3xl">
        <img src={normalizeImageUrl(images[active].url)} alt={product.name} className="h-[340px] w-full object-cover md:h-[420px]" />
      </div>
    </div>
  );
}
