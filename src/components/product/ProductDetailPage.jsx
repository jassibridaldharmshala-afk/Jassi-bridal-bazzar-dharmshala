import { useMemo, useState } from 'react';
import { ChevronRight, Star } from 'lucide-react';
import ProductGallery from './ProductGallery';
import ProductInfoPanel from './ProductInfoPanel';
import RentalOffer from '../rentals/RentalOffer';
import ProductTrustPanel from './ProductTrustPanel';
import ProductTabs from './ProductTabs';
import RelatedProductCarousel from './RelatedProductCarousel';
import PublicReviewCard from './PublicReviewCard';
import './ProductDetailPage.css';

export default function ProductDetailPage({
  product,
  navigate,
  route = '',
  mediaItems = [],
  activeMediaIndex = 0,
  onSelectMedia,
  onPrevMedia,
  onNextMedia,
  onOpenFullscreen,
  onToggleWishlist,
  isWishlisted = false,
  wishlistBusy = false,
  size,
  setSize,
  color,
  setColor,
  quantity,
  setQuantity,
  deliveryPin,
  setDeliveryPin,
  actionMessage,
  dealPrice,
  originalPrice,
  discountPercentage,
  selectedStock,
  deliveryResult,
  cartItem,
  isOutOfStock,
  cartBusy = false,
  onAddToCart,
  onBuyNow,
  onOrderWhatsApp,
  onCheckDelivery,
  deliveryChecking = false,
  relatedProducts = [],
  reviews = [],
  reviewSummary,
  myReview,
  reviewFeedback = '',
  reviewLoading = false,
  helpfulReviewIds = [],
  helpfulBusyId = '',
  onHelpful,
  onReport,
  reviewHasMore = false,
  reviewsLoadingMore = false,
  onLoadMoreReviews,
  variantProducts = [],
  managedVariants = [],
  selectedVariant,
  selectedMedia,
  storeWhatsappNumber,
  onOpenSizeGuide,
  onViewOffers,
  onSelectVariant,
  onSelectManagedVariant,
  onShare,
  onWriteReview,
  isSizeAvailable,
  isColorAvailable,
  settings = {},
  returnPolicy = '',
}) {
  const breadcrumb = useMemo(
    () => ['Home', product?.category || 'Products', product?.name || 'Product'],
    [product?.category, product?.name],
  );

  const rating = Number(reviewSummary?.average ?? product?.rating ?? 0).toFixed(1);
  const reviewCount = Number(reviewSummary?.total ?? product?.numReviews ?? reviews.length ?? 0);
  const similarTarget = product?.categoryId
    ? `/products?category=${encodeURIComponent(product.categoryId)}`
    : product?.category
      ? `/products?search=${encodeURIComponent(product.category)}`
      : '/products';
  const scrollToReviews = () => document.getElementById('desktop-ratings-and-reviews')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <section className="sc-pdp">
      <div className="sc-pdp__container">
        <nav className="sc-pdp__breadcrumb" aria-label="Breadcrumb">
          {breadcrumb.map((item, index) => (
            <span
              key={`${item}-${index}`}
              className={`sc-pdp__breadcrumb-item${index === breadcrumb.length - 1 ? ' sc-pdp__breadcrumb-item--active' : ''}`}
            >
              {index === breadcrumb.length - 1 ? item : (
                <button type="button" onClick={() => navigate(index === 0 ? '/' : similarTarget)}>{item}</button>
              )}
              {index < breadcrumb.length - 1 ? <ChevronRight className="sc-pdp__breadcrumb-sep" aria-hidden="true" /> : null}
            </span>
          ))}
        </nav>

        <div className="sc-pdp__main">
          <ProductGallery
            product={product}
            mediaItems={mediaItems}
            activeIndex={activeMediaIndex}
            onSelect={onSelectMedia}
            onPrev={onPrevMedia}
            onNext={onNextMedia}
            onOpenFullscreen={onOpenFullscreen}
            onToggleWishlist={onToggleWishlist}
            isWishlisted={isWishlisted}
            wishlistBusy={wishlistBusy}
            onViewSimilar={() => navigate(similarTarget)}
            selectedMedia={selectedMedia}
            ratingLabel={reviewCount ? `${rating} • ${reviewCount}` : 'No ratings yet'}
          />

          <div className="sc-pdp__info-stack">
            <RentalOffer productId={product._id || product.id} commerceMode={settings.commerceMode === 'RENTAL_ONLY' ? 'RENTAL_ONLY' : product.commerceMode} navigate={navigate} />
            <ProductInfoPanel
              product={product}
              rentalOnly={settings.commerceMode === 'RENTAL_ONLY' || product.commerceMode === 'RENTAL_ONLY'}
              size={size}
              setSize={setSize}
              color={color}
              setColor={setColor}
              quantity={quantity}
              setQuantity={setQuantity}
              deliveryPin={deliveryPin}
              setDeliveryPin={setDeliveryPin}
              actionMessage={actionMessage}
              dealPrice={dealPrice}
              originalPrice={originalPrice}
              discountPercentage={discountPercentage}
              selectedStock={selectedStock}
              deliveryResult={deliveryResult}
              cartItem={cartItem}
              isOutOfStock={isOutOfStock}
              cartBusy={cartBusy}
              onAddToCart={onAddToCart}
              onBuyNow={onBuyNow}
              onOrderWhatsApp={onOrderWhatsApp}
              onCheckDelivery={onCheckDelivery}
              deliveryChecking={deliveryChecking}
              variantProducts={variantProducts}
              managedVariants={managedVariants}
              selectedVariant={selectedVariant}
              onSelectManagedVariant={onSelectManagedVariant}
              storeWhatsappNumber={storeWhatsappNumber}
              onOpenSizeGuide={onOpenSizeGuide}
              onSelectVariant={onSelectVariant}
              onShare={onShare}
              onViewReviews={scrollToReviews}
              rating={rating}
              reviewCount={reviewCount}
              isSizeAvailable={isSizeAvailable}
              isColorAvailable={isColorAvailable}
            />

            <ProductTrustPanel settings={settings} returnPolicy={returnPolicy} />
          </div>
        </div>

        <div className="sc-pdp__below">
          <ProductTabs
            product={product}
            returnPolicy={returnPolicy}
            shippingPolicy={settings.shippingPolicy || ''}
            freeShippingMinimum={settings.freeShippingMinAmount}
            deliveryCharge={settings.deliveryCharge}
            onOpenSizeGuide={onOpenSizeGuide}
          />

          <DesktopReviews
            reviews={reviews}
            summary={reviewSummary}
            rating={rating}
            reviewCount={reviewCount}
            myReview={myReview}
            feedback={reviewFeedback}
            loading={reviewLoading}
            helpfulReviewIds={helpfulReviewIds}
            helpfulBusyId={helpfulBusyId}
            onWriteReview={onWriteReview}
            onHelpful={onHelpful}
            onReport={onReport}
            reviewHasMore={reviewHasMore}
            reviewsLoadingMore={reviewsLoadingMore}
            onLoadMoreReviews={onLoadMoreReviews}
          />
        </div>

        <RelatedProductCarousel products={relatedProducts} navigate={navigate} />
      </div>
    </section>
  );
}

function DesktopReviews({
  reviews,
  summary,
  rating,
  reviewCount,
  myReview,
  feedback,
  loading,
  helpfulReviewIds,
  helpfulBusyId,
  onWriteReview,
  onHelpful,
  onReport,
  reviewHasMore,
  reviewsLoadingMore,
  onLoadMoreReviews,
}) {
  const [ratingFilter, setRatingFilter] = useState(0);
  const [sort, setSort] = useState('newest');
  const [showAll, setShowAll] = useState(false);
  const distribution = useMemo(() => {
    if (summary?.distribution) return summary.distribution;
    const values = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach((review) => {
      const value = Number(review?.rating);
      if (Number.isInteger(value) && value >= 1 && value <= 5) values[value] += 1;
    });
    return values;
  }, [reviews, summary?.distribution]);
  const filteredReviews = useMemo(() => {
    const items = ratingFilter ? reviews.filter((review) => Number(review.rating) === ratingFilter) : [...reviews];
    return items.sort((left, right) => {
      if (sort === 'highest') return Number(right.rating) - Number(left.rating) || new Date(right.createdAt) - new Date(left.createdAt);
      if (sort === 'lowest') return Number(left.rating) - Number(right.rating) || new Date(right.createdAt) - new Date(left.createdAt);
      if (sort === 'helpful') return Number(right.helpfulCount || 0) - Number(left.helpfulCount || 0) || new Date(right.createdAt) - new Date(left.createdAt);
      return new Date(right.createdAt) - new Date(left.createdAt);
    });
  }, [ratingFilter, reviews, sort]);
  const visibleReviews = showAll ? filteredReviews : filteredReviews.slice(0, 6);

  return (
    <section className="sc-pdp__reviews-card" id="desktop-ratings-and-reviews">
      <div className="sc-pdp__section-head">
        <div><h2>Ratings &amp; Reviews</h2><p className="mt-1 text-sm text-slate-500">Reviews from customers who purchased this product</p></div>
        <button type="button" className="sc-pdp__review-btn" disabled={loading} onClick={onWriteReview}>{loading ? 'Checking...' : myReview ? 'Edit Your Review' : 'Write a Review'}</button>
      </div>
      <div className="sc-pdp__reviews-top">
        <div className="sc-pdp__rating">
          <span className="sc-pdp__rating-value">{rating}</span>
          <div className="sc-pdp__stars" aria-label={`Rated ${rating} out of 5`}>
            {[1, 2, 3, 4, 5].map((value) => <Star key={value} className={`sc-pdp__star${value <= Math.round(Number(rating)) ? ' is-filled' : ''}`} aria-hidden="true" />)}
          </div>
          <p>{reviewCount} rating{reviewCount === 1 ? '' : 's'}</p>
          {reviewCount > 0 ? <p className="mt-2 text-xs font-bold text-emerald-700">{Number(summary?.recommendationPercentage || 0)}% rated 4★ or above</p> : null}
        </div>
        <div className="sc-pdp__rating-bars">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = Number(distribution?.[star] || 0);
            const width = reviewCount ? Math.round((count / reviewCount) * 100) : 0;
            return (
              <button key={star} type="button" onClick={() => { setRatingFilter((current) => current === star ? 0 : star); setShowAll(false); }} className={`sc-pdp__rating-row w-full text-left${ratingFilter === star ? ' is-active' : ''}`} aria-label={`Show ${star} star reviews`} aria-pressed={ratingFilter === star}>
                <span>{star}★</span>
                <span className="sc-pdp__rating-track"><span className="sc-pdp__rating-fill block" style={{ width: `${width}%` }} /></span>
                <span className="w-8 text-right text-xs text-slate-400">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {feedback ? <p role="status" className="mt-4 rounded-xl bg-[#fff3f6] px-4 py-3 text-sm font-semibold text-[#c51b4d]">{feedback}</p> : null}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
        <div className="flex flex-wrap gap-2">
          {[0, 5, 4, 3, 2, 1].map((value) => <button key={value} type="button" onClick={() => { setRatingFilter(value); setShowAll(false); }} className={`rounded-full border px-3 py-2 text-xs font-bold ${ratingFilter === value ? 'border-[#ff3e6c] bg-blush text-[#ff3e6c]' : 'border-slate-200 text-slate-500'}`}>{value ? `${value} ★ (${distribution?.[value] || 0})` : `All (${reviewCount})`}</button>)}
        </div>
        <select value={sort} onChange={(event) => setSort(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600" aria-label="Sort reviews"><option value="newest">Most recent</option><option value="helpful">Most helpful</option><option value="highest">Highest rated</option><option value="lowest">Lowest rated</option></select>
      </div>

      {visibleReviews.length ? (
        <div className="sc-pdp__review-list mt-2 divide-y divide-slate-100">
          {visibleReviews.map((review) => {
            const reviewId = String(review._id || '');
            const helpful = helpfulReviewIds.includes(reviewId);
            const isOwnReview = String(myReview?._id || '') === reviewId;
            return <PublicReviewCard key={reviewId} review={review} helpful={helpful} helpfulBusy={helpfulBusyId === reviewId} isOwnReview={isOwnReview} onHelpful={onHelpful} onReport={onReport} />;
          })}
        </div>
      ) : (
        <p className="sc-pdp__review-empty">{ratingFilter ? `No ${ratingFilter}-star reviews yet.` : 'No customer reviews yet. Delivered customers can be the first to review this product.'}</p>
      )}
      {filteredReviews.length > 6 && !showAll ? <button type="button" onClick={() => setShowAll(true)} className="mt-4 h-11 rounded-xl border border-slate-200 px-5 text-sm font-bold text-charcoal">View loaded reviews</button> : null}
      {showAll && reviewHasMore ? <button type="button" disabled={reviewsLoadingMore} onClick={onLoadMoreReviews} className="mt-4 h-11 rounded-xl border border-slate-200 px-5 text-sm font-bold text-charcoal disabled:opacity-50">{reviewsLoadingMore ? 'Loading reviews...' : 'Load more reviews'}</button> : null}
      {showAll && filteredReviews.length > 6 ? <button type="button" onClick={() => setShowAll(false)} className="ml-2 mt-4 h-11 px-4 text-sm font-bold text-slate-500">Show fewer</button> : null}
    </section>
  );
}
