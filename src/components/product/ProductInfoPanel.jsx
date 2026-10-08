import { useState } from 'react';
import { CheckCircle2, MapPin, Minus, Plus, Ruler, Share2, ShoppingBag, Store, Truck } from 'lucide-react';
import { getColorSwatch } from '../../utils/catalogFacets';
import { getSelectableSizes } from '../../utils/productSizing';
import SelectedSizeSummary from './SelectedSizeSummary';
import './ProductInfoPanel.css';

export default function ProductInfoPanel({
  product,
  rentalOnly = false,
  size,
  setSize,
  color,
  setColor,
  quantity,
  setQuantity,
  deliveryPin,
  setDeliveryPin,
  deliveryResult,
  actionMessage,
  dealPrice,
  originalPrice: effectiveOriginalPrice,
  discountPercentage: effectiveDiscount,
  selectedStock,
  cartItem,
  isOutOfStock,
  cartBusy = false,
  onAddToCart,
  onBuyNow,
  onOrderWhatsApp,
  onCheckDelivery,
  deliveryChecking = false,
  variantProducts = [],
  managedVariants = [],
  selectedVariant,
  storeWhatsappNumber,
  onOpenSizeGuide,
  onSelectVariant,
  onSelectManagedVariant,
  onShare,
  onViewReviews,
  rating,
  reviewCount,
  isSizeAvailable = () => true,
  isColorAvailable = () => true,
  getSizeStock = () => null,
}) {
  const [showPriceDetails, setShowPriceDetails] = useState(false);
  const sizes = getSelectableSizes(product);
  const colors = uniqueValues(product?.colors);
  const currentPrice = Math.max(0, Number(dealPrice ?? product?.price ?? 0));
  const originalPrice = Math.max(currentPrice, Number(effectiveOriginalPrice ?? product?.originalPrice ?? currentPrice));
  const discount = Math.max(0, Number(effectiveDiscount ?? product?.discountPercentage ?? 0));
  const savings = Math.max(0, originalPrice - currentPrice);
  const displayedRating = Number(rating ?? product?.rating ?? 0);
  const displayedReviewCount = Math.max(0, Number(reviewCount ?? product?.numReviews ?? 0));
  const stockLimit = selectedStock === null || selectedStock === undefined ? null : Math.max(0, Number(selectedStock || 0));
  const positiveMessage = /added|copied|submitted|updated|success/i.test(actionMessage || '');

  return (
    <div className="sc-info">
      <div className="sc-info__panel">
        <div className="sc-info__heading">
          <div>
            {product?.brand ? <p className="sc-info__brand">{product.brand}</p> : null}
            <h1 className="sc-info__title">{product?.name}</h1>
          </div>
          <button type="button" className="sc-info__share" onClick={onShare} aria-label="Share product">
            <Share2 aria-hidden="true" />
          </button>
        </div>

        <button type="button" className="sc-info__rating-row" onClick={onViewReviews}>
          {displayedReviewCount > 0 ? (
            <>
              <span className="sc-info__rating-badge">{displayedRating.toFixed(1)} <span aria-hidden="true">★</span></span>
              <span>{displayedReviewCount} rating{displayedReviewCount === 1 ? '' : 's'} &amp; review{displayedReviewCount === 1 ? '' : 's'}</span>
              <span aria-hidden="true">›</span>
            </>
          ) : (
            <><span className="sc-info__rating-empty">New</span><span>Be the first to review this product</span><span aria-hidden="true">›</span></>
          )}
        </button>

        {!rentalOnly && <>{product.commerceMode === 'SALE_AND_RENTAL' && <span className="rental-eyebrow">BUY & KEEP · SALE PRICE</span>}<div className="sc-info__price-row">
          <span className="sc-info__price">₹{formatIndian(currentPrice)}</span>
          {originalPrice > currentPrice ? <span className="sc-info__original">MRP ₹{formatIndian(originalPrice)}</span> : null}
          {discount > 0 ? <span className="sc-info__discount">({Math.round(discount)}% OFF)</span> : null}
        </div>
        <p className="sc-info__tax">Inclusive of all taxes</p>

        {savings > 0 ? (
          <section className="sc-info__offer" aria-label="Price offer">
            <div className="sc-info__offer-main">
              <span className="sc-info__offer-icon">%</span>
              <div>
                <p>Best price for this style</p>
                <strong>₹{formatIndian(currentPrice)}</strong>
                <small>You save ₹{formatIndian(savings)} on the listed MRP</small>
              </div>
            </div>
            <button type="button" className="sc-info__offer-link" aria-expanded={showPriceDetails} onClick={() => setShowPriceDetails((current) => !current)}>
              {showPriceDetails ? 'Hide details' : 'Price details'}
            </button>
            {showPriceDetails ? (
              <dl className="sc-info__offer-breakdown">
                <div><dt>Maximum retail price</dt><dd>₹{formatIndian(originalPrice)}</dd></div>
                <div><dt>Product discount</dt><dd>-₹{formatIndian(savings)}</dd></div>
                <div><dt>Selling price</dt><dd>₹{formatIndian(currentPrice)}</dd></div>
              </dl>
            ) : null}
          </section>
        ) : null}

        {sizes.length ? (
          <section className="sc-info__section">
            <div className="sc-info__section-head">
              <h2>Select size {size ? <span>· {size}</span> : null}</h2>
              <button type="button" className="sc-info__link" onClick={onOpenSizeGuide}>
                <Ruler aria-hidden="true" />
                Size guide
              </button>
            </div>
            <div className="sc-info__sizes">
              {sizes.map((item) => {
                const available = isSizeAvailable(item);
                const remaining = getSizeStock(item);
                return (
                  <span className="sc-info__size-wrap" key={item}>
                    <button
                      type="button"
                      disabled={!available}
                      onClick={() => setSize?.(item)}
                      className={`sc-info__size${size === item ? ' sc-info__size--active' : ''}`}
                      aria-label={`Size ${item}${available ? '' : ', unavailable'}`}
                      aria-pressed={size === item}
                    >
                      {item}
                    </button>
                    {available && Number.isFinite(remaining) && remaining > 0 && remaining <= 3 ? <small>{remaining} left</small> : null}
                  </span>
                );
              })}
            </div>
            <SelectedSizeSummary product={product} size={size} onOpenSizeGuide={onOpenSizeGuide} />
          </section>
        ) : null}

        <div className="sc-info__choice-grid">
          {colors.length ? (
            <section className="sc-info__section">
              <div className="sc-info__section-head">
                <h2>Select colour {color ? <span>· {color}</span> : null}</h2>
              </div>
              <div className="sc-info__colors">
                {colors.map((item) => {
                  const available = isColorAvailable(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      disabled={!available}
                      onClick={() => setColor?.(item)}
                      className={`sc-info__color${color === item ? ' sc-info__color--active' : ''}`}
                      aria-label={`Select colour ${item}${available ? '' : ', unavailable for the selected size'}`}
                    >
                      <span className="sc-info__swatch" style={{ backgroundColor: getColorSwatch(item) }} aria-hidden="true" />
                      <span>{item}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className="sc-info__section sc-info__section--qty">
            <div className="sc-info__section-head"><h2>Quantity</h2></div>
            <div className="sc-info__qty">
              <button type="button" disabled={quantity <= 1} onClick={() => setQuantity?.((value) => Math.max(1, value - 1))} aria-label="Decrease quantity"><Minus aria-hidden="true" /></button>
              <span>{quantity}</span>
              <button type="button" disabled={stockLimit !== null && quantity >= stockLimit} onClick={() => setQuantity?.((value) => value + 1)} aria-label="Increase quantity"><Plus aria-hidden="true" /></button>
            </div>
          </section>
        </div>

        {managedVariants.length ? (
          <section className="sc-info__section">
            <div className="sc-info__section-head"><h2>Choose product option</h2></div>
            <div className="sc-info__variants">
              {managedVariants.map((variant) => {
                const selected = String(selectedVariant?._id || '') === String(variant._id || '');
                const available = variant.isActive !== false && Number(variant.stock || 0) > 0;
                const label = formatManagedVariant(variant);
                return (
                  <button key={variant._id || label} type="button" disabled={!available} onClick={() => onSelectManagedVariant?.(variant)} className={`sc-info__variant${selected ? ' sc-info__variant--active' : ''}`} title={label}>
                    {label}{available ? '' : ' · Out of stock'}
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {variantProducts.length > 0 ? (
          <section className="sc-info__section">
            <div className="sc-info__section-head"><h2>Available variants</h2></div>
            <div className="sc-info__variants">
              {variantProducts.map((variant) => {
                const variantId = variant._id || variant.id || variant.slug;
                const isActive = String(variantId) === String(product?._id || product?.id || product?.slug);
                return (
                  <button key={variantId} type="button" onClick={() => onSelectVariant?.(variant)} className={`sc-info__variant${isActive ? ' sc-info__variant--active' : ''}`}>
                    {variant.variantColor || variant.variantName || variant.name}
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {sizes.length && !size ? <p className="sc-info__selection-message">Choose a size before adding this product to your bag.</p> : isOutOfStock ? <p className="sc-info__stock-message">This selection is currently out of stock. Choose another available size or colour.</p> : stockLimit !== null && stockLimit <= 5 ? <p className="sc-info__low-stock">Only {stockLimit} left in this selection</p> : null}

        <div className={`sc-info__actions${storeWhatsappNumber ? '' : ' sc-info__actions--two'}`}>
          <button type="button" disabled={isOutOfStock || cartBusy} onClick={onAddToCart} className={`sc-info__action sc-info__action--primary${cartItem ? ' sc-info__action--active' : ''}`}>
            <ShoppingBag aria-hidden="true" />
            {cartBusy ? 'Adding…' : isOutOfStock ? 'Out of stock' : cartItem ? 'Add another' : 'Add to bag'}
          </button>
          <button type="button" disabled={isOutOfStock || cartBusy} onClick={onBuyNow} className="sc-info__action sc-info__action--dark">
            {cartBusy ? 'Adding…' : isOutOfStock ? 'Unavailable' : 'Buy now'}
          </button>
          {storeWhatsappNumber ? (
            <button type="button" disabled={isOutOfStock} onClick={onOrderWhatsApp} className="sc-info__action sc-info__action--whatsapp">
              <Store aria-hidden="true" />
              WhatsApp
            </button>
          ) : null}
        </div>

        </>}
        {actionMessage && actionMessage !== deliveryResult?.message ? (
          <p role="status" className={`sc-info__message${positiveMessage ? ' sc-info__message--success' : ''}`}>{actionMessage}</p>
        ) : null}

        <section className="sc-info__delivery">
          <div className="sc-info__section-head">
            <h2><Truck aria-hidden="true" /> Delivery options</h2>
          </div>
          <p className="sc-info__delivery-help">Enter your six-digit PIN code to check delivery charges and Cash on Delivery.</p>
          <div className="sc-info__delivery-row">
            <label>
              <MapPin aria-hidden="true" />
              <span className="sr-only">Delivery PIN code</span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={deliveryPin}
                onChange={(event) => setDeliveryPin?.(event.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(event) => { if (event.key === 'Enter' && deliveryPin?.length === 6 && !deliveryChecking) onCheckDelivery?.(deliveryPin); }}
                placeholder="Enter delivery PIN"
              />
            </label>
            <button type="button" disabled={deliveryPin?.length !== 6 || deliveryChecking} onClick={() => onCheckDelivery?.(deliveryPin)}>{deliveryChecking ? 'Checking...' : 'Check'}</button>
          </div>
          {deliveryResult ? (
            <div className={`sc-info__delivery-result sc-info__delivery-result--${deliveryResult.status}`} role="status">
              {deliveryResult.status === 'success' ? <CheckCircle2 aria-hidden="true" /> : <MapPin aria-hidden="true" />}
              <div>
                <strong>{deliveryResult.title}</strong>
                {deliveryResult.lines?.map((line) => <p key={line}>{line}</p>)}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function uniqueValues(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map((value) => String(value || '').trim()).filter(Boolean)));
}

function formatManagedVariant(variant = {}) {
  const values = Object.values(variant.optionValues || {}).map((value) => String(value || '').trim()).filter(Boolean);
  return values.join(' · ') || [variant.size, variant.color].filter(Boolean).join(' · ') || variant.sku || 'Product option';
}

function formatIndian(value) {
  return Math.max(0, Number(value || 0)).toLocaleString('en-IN');
}
