import { useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, Heart, ShoppingBag } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { getPrimaryImageUrl, normalizeImageUrl } from '../../services/normalize';
import './RelatedProductCarousel.css';
import { isUnavailable, wishlistPrice, wishlistStock } from '../../utils/wishlist';
import { getSelectableSizes } from '../../utils/productSizing';

export default function RelatedProductCarousel({ products = [], navigate, title = 'You may also like', description = 'Curated styles that pair beautifully with this look' }) {
  const railRef = useRef(null);
  const cart = useCart();
  const wishlist = useWishlist();
  const sortedProducts = useMemo(() => products.slice(0, 12), [products]);

  const slide = (direction) => {
    railRef.current?.scrollBy({ left: direction * 680, behavior: 'smooth' });
  };

  if (!sortedProducts.length) return null;

  return (
    <section className="sc-related">
      <div className="sc-related__head">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <div className="sc-related__nav">
          <button type="button" onClick={() => slide(-1)} aria-label="Previous products">
            <ChevronLeft size={18} />
          </button>
          <button type="button" onClick={() => slide(1)} aria-label="Next products">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div ref={railRef} className="sc-related__rail">
        {sortedProducts.map((product) => {
          const productId = product._id || product.id || product.slug;
          const image = getPrimaryImageUrl(product.images);
          const price = Number(product.price || 0).toLocaleString('en-IN');
          const original = Number(product.originalPrice || product.price || 0).toLocaleString('en-IN');
          const discount = wishlistPrice(product).discount;
          const rental = product.discoveryPurchase === 'RENTAL' || product.commerceMode === 'RENTAL_ONLY';
          const unavailable = !rental && (isUnavailable(product) || wishlistStock(product) === 0);
          const isWishlisted = wishlist.items.some((item) => (item._id || item.id || item.slug) === productId);
          const cartItem = cart.getCartItem(product);
          const needsSize = getSelectableSizes(product).length > 0;

          return (
            <article key={productId} className="sc-related__card">
              <div className="sc-related__image">
                <button type="button" className="sc-related__image-open" onClick={() => navigate(`/product?id=${productId}`)}>
                  {image ? <img src={normalizeImageUrl(image)} alt={product.name} /> : <div className="sc-related__fallback" />}
                  {product.isNewArrival ? <span className="sc-related__badge">NEW</span> : null}
                </button>
                <button
                  type="button"
                  className={`sc-related__heart${isWishlisted ? ' sc-related__heart--active' : ''}`}
                  onClick={() => wishlist.toggleWishlist(product)}
                  aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                  aria-pressed={isWishlisted}
                >
                  <Heart size={16} fill={isWishlisted ? 'currentColor' : 'none'} />
                </button>
              </div>
              <div className="sc-related__body">
                <h3 title={product.name}>{product.name}</h3>
                <div className="sc-related__meta">
                  <span className="sc-related__price">{rental ? product.rentalPreview ? `₹${(product.rentalPreview.dailyRatePaise / 100).toLocaleString('en-IN')} / day` : 'Check rental rates' : `Rs. ${price}`}</span>
                  {!rental && Number(product.originalPrice) > Number(product.price) && <span className="sc-related__original">Rs. {original}</span>}
                </div>
                {product.commerceMode === 'SALE_AND_RENTAL' && <button type="button" className="rental-text-button" onClick={() => navigate(`/product?id=${productId}`)}>{product.rentalPreview?.dailyRatePaise ? `Rent from ₹${(product.rentalPreview.dailyRatePaise / 100).toLocaleString('en-IN')} / day · dates →` : 'Rental pricing & dates →'}</button>}
                {rental && product.rentalPreview && <p>Refundable deposit: ₹{(product.rentalPreview.depositPaise / 100).toLocaleString('en-IN')}</p>}
                {!rental && discount > 0 && <p className="sc-related__discount">({discount}% OFF)</p>}
                <button type="button" disabled={unavailable || (!rental && cart.loading)} className={`sc-related__cart disabled:opacity-50${cartItem && !rental ? ' sc-related__cart--active' : ''}`} onClick={() => rental ? navigate(`/rental-book?product=${encodeURIComponent(productId)}`) : needsSize ? navigate(`/product?id=${productId}`) : cart.addToCart(product)}>
                  <ShoppingBag size={15} />
                  {rental ? 'Check rental dates' : unavailable ? 'Out of stock' : needsSize ? 'Select size' : cartItem ? 'Add More' : 'Add to Cart'}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
