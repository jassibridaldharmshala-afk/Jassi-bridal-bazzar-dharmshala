import { useState } from 'react';
import { Image } from 'lucide-react';
import { normalizeImageEntries } from '../../services/normalize';
import { responsiveImage } from '../../utils/responsiveImages';

export function RentalProductPhoto({ product, image, thumbnail = false }) {
  const photo = image || normalizeImageEntries(product?.images).find(item => item.primary) || normalizeImageEntries(product?.images)[0];
  const [failed, setFailed] = useState('');
  const source = responsiveImage(photo, thumbnail ? 'thumbnail' : 'card');
  return source.src && failed !== source.src ? <img {...source} alt={product.name} loading="lazy" onError={() => setFailed(source.src)} /> : <span className="rental-product-no-photo"><Image size={24} aria-hidden="true" /><small>No photo yet</small></span>;
}

export default function RentalProductIdentity({ product, title }) {
  const images = normalizeImageEntries(product?.images);
  const [choice, setChoice] = useState({ productId: '', url: '' });
  if (!product) return null;
  const selected = images.find(image => choice.productId === String(product._id) && image.url === choice.url) || images.find(image => image.primary) || images[0];
  return <section className="rental-product-identity" aria-label="Selected rental product">
    <div className="rental-product-identity__photo"><RentalProductPhoto product={product} image={selected} />{selected && <a href={selected.url} target="_blank" rel="noopener noreferrer">Open original photo</a>}</div>
    <div className="rental-product-identity__details"><span className="rental-eyebrow">SELECTED PRODUCT</span><h3>{title || product.name}</h3>{title && title !== product.name && <p>{product.name}</p>}{product.sku && <p className="rental-muted">SKU {product.sku}</p>}
      <p className="rental-muted">{product.commerceMode === 'SALE_ONLY' ? 'Sale only — enable Rent or Sale + rent in the product editor first.' : 'Photos and product details come from your catalogue.'}</p>
      {images.length > 1 && <div className="rental-product-photo-choices" role="group" aria-label="Product photos">{images.map((image, index) => <button key={image.url} type="button" aria-label={`View product photo ${index + 1}`} aria-pressed={selected.url === image.url} onClick={() => setChoice({ productId: String(product._id), url: image.url })}><RentalProductPhoto product={product} image={image} thumbnail /></button>)}</div>}
    </div>
  </section>;
}
