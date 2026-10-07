import { useMemo } from 'react';
import { ChevronLeft, ChevronRight, Heart, Maximize2, ScanSearch, Star } from 'lucide-react';
import { getPrimaryImageIndex, normalizeImageEntries, normalizeImageUrl } from '../../services/normalize';
import './ProductGallery.css';

export default function ProductGallery({
  product,
  mediaItems = [],
  activeIndex = 0,
  onSelect,
  onPrev,
  onNext,
  onOpenFullscreen,
  onToggleWishlist,
  isWishlisted = false,
  wishlistBusy = false,
  onViewSimilar,
  ratingLabel,
}) {
  const images = useMemo(() => {
    if (!mediaItems.length) return normalizeImageEntries(product?.images || []);
    return mediaItems;
  }, [mediaItems, product?.images]);

  const primaryIndex = getPrimaryImageIndex(product?.images || []);
  const currentIndex = images.length ? Math.max(0, Math.min(activeIndex, images.length - 1)) : 0;
  const current = images[currentIndex] || images[primaryIndex] || images[0];

  if (!images.length) {
    return <div className="sc-gallery sc-gallery--empty" />;
  }

  return (
    <div className="sc-gallery">
      <div className="sc-gallery__thumbs">
        {images.map((item, index) => (
          <button
            key={`${item.type || 'image'}-${item.url}-${index}`}
            type="button"
            className={`sc-gallery__thumb${index === currentIndex ? ' sc-gallery__thumb--active' : ''}`}
            onClick={() => onSelect?.(index)}
            aria-label={`Show image ${index + 1}`}
          >
            {item.type === 'video' ? (
              <video src={item.thumbnail || item.url} className="sc-gallery__thumb-media" muted playsInline />
            ) : (
              <img src={normalizeImageUrl(item.thumbnail || item.url)} alt="" className="sc-gallery__thumb-media" />
            )}
          </button>
        ))}
      </div>

      <div className="sc-gallery__stage">
        <button type="button" className="sc-gallery__wish" onClick={onToggleWishlist} disabled={wishlistBusy} aria-label="Wishlist">
          <Heart className={isWishlisted ? 'sc-gallery__wish-icon sc-gallery__wish-icon--active' : 'sc-gallery__wish-icon'} />
        </button>

        {images.length > 1 ? (
          <>
            <button type="button" className="sc-gallery__nav sc-gallery__nav--left" onClick={onPrev} aria-label="Previous image"><ChevronLeft /></button>
            <button type="button" className="sc-gallery__nav sc-gallery__nav--right" onClick={onNext} aria-label="Next image"><ChevronRight /></button>
          </>
        ) : null}

        {current?.type === 'video' ? (
          <video src={current.url} poster={current.thumbnail} controls playsInline className="sc-gallery__media" />
        ) : (
          <button
            type="button"
            className="sc-gallery__media-trigger"
            onClick={onOpenFullscreen}
            aria-label={`View ${product?.name || 'product'} image fullscreen`}
          >
            <img src={normalizeImageUrl(current?.url)} alt={product?.name || 'Product'} className="sc-gallery__media" />
          </button>
        )}

        <div className="sc-gallery__footer">
          <button type="button" className="sc-gallery__pill sc-gallery__pill--secondary" onClick={onViewSimilar}>
            <ScanSearch className="sc-gallery__pill-icon" />
            View Similar
          </button>
          <button type="button" className="sc-gallery__pill sc-gallery__pill--primary" onClick={onOpenFullscreen}>
            <Maximize2 className="sc-gallery__pill-icon" />
            View Fullscreen
          </button>
        </div>

        <div className="sc-gallery__rating">
          <Star className="sc-gallery__rating-icon" />
          <span>{ratingLabel}</span>
        </div>
      </div>
    </div>
  );
}
