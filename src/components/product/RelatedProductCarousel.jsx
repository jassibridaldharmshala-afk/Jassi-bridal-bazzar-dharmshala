import { useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, Heart, ShoppingBag } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { getPrimaryImageUrl, normalizeImageUrl } from '../../services/normalize';
import './RelatedProductCarousel.css';
import { isUnavailable, wishlistStock } from '../../utils/wishlist';
import { getSelectableSizes } from '../../utils/productSizing';
import { rentalProductHref } from '../../utils/routing';
import RelatedProductPrice, { isRentalRecommendation } from './RelatedProductPrice';

export default function RelatedProductCarousel({ products = [], navigate, purchaseMode = 'buy', title = 'You may also like', description = 'Curated styles that pair beautifully with this look' }) {
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
          const rental = isRentalRecommendation(product, purchaseMode);
          const detailsHref = rental ? rentalProductHref(product) : `/product?id=${productId}`;
          const unavailable = !rental && (isUnavailable(product) || wishlistStock(product) === 0);
          const isWishlisted = wishlist.items.some((item) => (item._id || item.id || item.slug) === productId);
          const cartItem = cart.getCartItem(product);
          const needsSize = getSelectableSizes(product).length > 0;

          return (
            <article key={productId} className="sc-related__card" aria-label={product.name}>
              <div className="sc-related__image">
                <button type="button" className="sc-related__image-open" onClick={() => navigate(detailsHref)}>
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
                <RelatedProductPrice product={product} rental={rental} />
                <button type="button" disabled={unavailable || (!rental && cart.loading)} className={`sc-related__cart disabled:opacity-50${cartItem && !rental ? ' sc-related__cart--active' : ''}`} onClick={() => rental ? navigate(detailsHref) : needsSize ? navigate(`/product?id=${productId}`) : cart.addToCart(product)}>
                  <ShoppingBag size={15} />
                  {rental ? 'View rental details' : unavailable ? 'Out of stock' : needsSize ? 'Select size' : cartItem ? 'Add More' : 'Add to Cart'}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
