import { Monitor, Smartphone, X } from 'lucide-react';
import { useState } from 'react';
import { normalizeImageUrl } from '../../services/normalize';

export default function ProductPreviewModal({ product, onClose }) {
  const [device, setDevice] = useState('desktop');
  const images = Array.isArray(product.images) ? product.images : [];
  const primary = images.find((image) => image.primary) || images[0];
  const price = Number(product.price || 0);
  const mrp = Number(product.originalPrice || price);
  const discount = mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
  const sizes = list(product.sizes);
  const colors = list(product.colors);

  return <div className="product-preview-overlay" role="dialog" aria-modal="true" aria-labelledby="product-preview-title">
    <div className="product-preview-shell">
      <header className="product-preview-header">
        <div><p>Storefront preview</p><h2 id="product-preview-title">Review before publishing</h2></div>
        <div className="product-preview-header__actions">
          <div className="product-preview-device" aria-label="Preview device">
            <button type="button" aria-pressed={device === 'mobile'} onClick={() => setDevice('mobile')}><Smartphone size={16} /> Mobile</button>
            <button type="button" aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')}><Monitor size={16} /> Desktop</button>
          </div>
          <button type="button" onClick={onClose} className="product-preview-close" aria-label="Close preview"><X /></button>
        </div>
      </header>
      <div className="product-preview-stage">
        <article className={`product-preview-page is-${device}`}>
          <div className="product-preview-image">
            {primary?.url ? <img src={normalizeImageUrl(primary.url)} alt={product.name || 'Product preview'} /> : <span>Add a product photo to preview it</span>}
            {product.isNewArrival && <b>NEW</b>}
          </div>
          <div className="product-preview-copy">
            <small>{product.subCategory || categoryName(product.category) || 'PRODUCT'}</small>
            <h3 title={product.name}>{product.name || 'Your product name'}</h3>
            <p>{product.shortDescription || product.description || 'Add a clear product description for customers.'}</p>
            <div className="product-preview-price"><strong>₹{price.toLocaleString('en-IN')}</strong>{mrp > price && <><del>₹{mrp.toLocaleString('en-IN')}</del><em>{discount}% OFF</em></>}</div>
            {!!colors.length && <div className="product-preview-options"><span>Colours</span><p>{colors.join(' · ')}</p></div>}
            {!!sizes.length && <div className="product-preview-options"><span>Sizes</span><div>{sizes.map((size) => <b key={size}>{size}</b>)}</div></div>}
            <button type="button" disabled>{Number(product.stock || 0) > 0 ? 'Add to bag' : 'Out of stock'}</button>
          </div>
        </article>
      </div>
      <footer className="product-preview-footer"><span>This preview uses unsaved form values.</span><button type="button" className="admin-btn" onClick={onClose}>Continue editing</button></footer>
    </div>
  </div>;
}

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function categoryName(value) {
  return typeof value === 'object' ? value?.name : '';
}
