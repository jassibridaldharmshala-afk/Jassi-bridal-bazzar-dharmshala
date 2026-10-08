import { useState } from 'react';
import { Heart, ShoppingBag, Star } from 'lucide-react';
import { rentalDetailHref } from '../../utils/rentalShopping';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import ProductImageCarousel from '../product/ProductImageCarousel';
import QuickViewModal from '../product/QuickViewModal';
import { useStorefront } from '../../context/StorefrontContext';
import { rentalProductHref, productHref } from '../../utils/routing';
import { isUnavailable, wishlistId, wishlistOptions, wishlistStock } from '../../utils/wishlist';
import { getSelectableSizes } from '../../utils/productSizing';
import './ProductCard.css';

export default function ProductCard({ product, navigate, onAddToCart, onWishlistToggle, isWishlisted: isWishlistedProp, badgeLabel, onBeforeOpen, imagePriority = false, shoppingMode }) {
  const cart = useCart();
  const wishlist = useWishlist();
  const { storeSlug } = useStorefront();
  const [busy, setBusy] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const productId = wishlistId(product);
  const cartItem = cart.getCartItem(product);
  const isWishlisted = typeof isWishlistedProp === 'boolean'
    ? isWishlistedProp
    : wishlist.items.some(item => wishlistId(item) === productId);
  const rental = shoppingMode === 'rental' || product.commerceMode === 'RENTAL_ONLY' || product.purchaseEnabled === false;
  const mixed = !rental && product.commerceMode === 'SALE_AND_RENTAL';
  const saleUnavailable = !rental && isUnavailable(product);
  const unavailable = saleUnavailable && !mixed;
  const stock = rental ? null : wishlistStock(product);
  const options = wishlistOptions(product);
  const needsSize = getSelectableSizes(product).length > 0;
  const price = Number(product.sellingPrice ?? product.price ?? 0);
  const originalPrice = Math.max(price, Number(product.originalPrice ?? price));
  const discount = originalPrice > price ? Math.round((originalPrice - price) / originalPrice * 100) : 0;
  const badge = badgeLabel || (product.isBestSeller ? 'Bestseller' : product.isNewArrival ? 'New' : product.isFeatured ? 'Featured' : '');
  const badgeTone = String(badge).toLowerCase().replace(/\s+/g, '');
  const optionLabel = [
    options.sizes.length === 1 ? options.sizes[0] || 'One size' : options.sizes.length ? options.sizes.length + ' sizes' : '',
    options.colors.filter(Boolean).length > 1 ? options.colors.filter(Boolean).length + ' colours' : options.colors[0],
  ].filter(Boolean).join(' · ');
  const rating = Number(product.rating || 0);
  const reviews = Number(product.numReviews || 0);

  const openProduct = () => {
    onBeforeOpen?.(product);
    navigate?.(rental ? rentalDetailHref(product, storeSlug, product.rentalOffer?._id) : productHref(product, storeSlug));
  };
  const toggleWishlist = async event => {
    event.stopPropagation();
    if (busy || wishlist.loading) return;
    setBusy(true);
    try {
      if (onWishlistToggle) await onWishlistToggle(product);
      else await wishlist.toggleWishlist(product);
    } finally { setBusy(false); }
  };
  const addToCart = event => {
    event.stopPropagation();
    if (rental || (mixed && (saleUnavailable || stock === 0))) { onBeforeOpen?.(product); navigate?.(rentalProductHref(product, storeSlug)); return; }
    if (needsSize) { openProduct(); return; }
    if (onAddToCart) onAddToCart(product);
    else cart.addToCart(product);
  };

  return (
    <article className={'sc-product-card' + (unavailable || (!mixed && stock === 0) ? ' is-unavailable' : '')} data-theme-product-card data-mobile-catalog-card aria-label={product.name}>
      <div className="sc-product-card__media" data-theme-product-media>
        <ProductImageCarousel product={product} className="sc-product-card__carousel" onOpen={openProduct} priority={imagePriority} />
        {badge && !unavailable && <span className="sc-product-card__badge" data-badge-tone={badgeTone}>{badge}</span>}
        <button
          type="button"
          className={'sc-product-card__wishlist' + (isWishlisted ? ' is-active' : '')}
          onClick={toggleWishlist}
          disabled={busy || wishlist.loading}
          aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          aria-pressed={isWishlisted}
          data-card-field="wishlist"
        ><Heart size={18} strokeWidth={1.8} fill={isWishlisted ? 'currentColor' : 'none'} /></button>
        {rating > 0 && reviews > 0 && <p className="sc-product-card__rating" data-card-field="rating" aria-label={rating.toFixed(1) + ' out of 5, ' + reviews + ' reviews'}><strong>{rating.toFixed(1)}</strong><Star size={11} fill="currentColor" /><span>{reviews}</span></p>}
        {(unavailable || stock === 0) && <span className="sc-product-card__sold">{unavailable ? 'Unavailable' : mixed ? 'Sale out of stock' : 'Out of stock'}</span>}
        <button type="button" className="sc-product-card__quick" data-card-field="quick-view" onClick={() => setQuickOpen(true)}>Quick view</button>
      </div>

      <div className="sc-product-card__body">
        <button type="button" className="sc-product-card__details" onClick={openProduct} title={product.name}>
          <h3 className="sc-product-card__title" title={product.name} data-card-field="title">{product.name}</h3>
        </button>
        <div className="sc-product-card__price-copy" data-card-field="price">
          <strong className="sc-product-card__price">{rental ? product.rentalPreview?.dailyRatePaise ? `${money(product.rentalPreview.dailyRatePaise / 100)} / day` : 'Check rental rates' : `${mixed ? 'Sale · ' : ''}${money(price)}`}</strong>
          {!rental && originalPrice > price && <del className="sc-product-card__original">{money(originalPrice)}</del>}
          {!rental && discount > 0 && <span className="sc-product-card__discount" data-card-field="discount">{discount}% off</span>}
        </div>
        {mixed && <button type="button" className="sc-product-card__rental-link" onClick={() => { onBeforeOpen?.(product); navigate?.(rentalProductHref(product, storeSlug)); }} aria-label={`Rental pricing and dates for ${product.name}`}>{product.rentalPreview?.dailyRatePaise ? `Rent from ${money(product.rentalPreview.dailyRatePaise / 100)} / day` : 'Rental pricing & dates'} <span aria-hidden="true">→</span></button>}
        <div className="sc-product-card__footer">
          <div className="sc-product-card__meta">
            {optionLabel && <p className="sc-product-card__options">{optionLabel}</p>}
            {stock > 0 && stock <= 5 && <p className="sc-product-card__stock">Only {stock} left</p>}
          </div>
          <button
            type="button"
            className={'sc-product-card__cart' + (cartItem ? ' is-active' : '')}
            onClick={addToCart}
            disabled={unavailable || (!mixed && stock === 0) || (!rental && !saleUnavailable && cart.loading)}
            aria-label={rental ? `Check rental dates for ${product.name}` : unavailable ? product.name + ' is unavailable' : mixed && (saleUnavailable || stock === 0) ? `Check rental dates for ${product.name}` : stock === 0 ? product.name + ' is out of stock' : needsSize ? `Select a size for ${product.name}` : (cartItem ? 'Add more ' : 'Add ') + product.name + ' to bag'}
            data-card-field="cart"
          >
            <ShoppingBag size={17} strokeWidth={1.6} />
            <span>{rental ? 'Book rental' : unavailable ? 'Unavailable' : mixed && (saleUnavailable || stock === 0) ? 'Rent · check dates' : stock === 0 ? 'Out of stock' : needsSize ? 'Select size' : cartItem ? 'Add more' : 'Add to bag'}</span>
          </button>
        </div>
      </div>
      {quickOpen && <QuickViewModal product={product} shoppingMode={shoppingMode} onClose={() => setQuickOpen(false)} onOpenFull={() => { setQuickOpen(false); openProduct(); }} />}
    </article>
  );
}

const money = value => '₹' + Number(value || 0).toLocaleString('en-IN');
