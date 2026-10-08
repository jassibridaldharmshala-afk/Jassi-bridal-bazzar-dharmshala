import { useMediaQuery } from '@mantine/hooks';
import { responsiveImage } from '../../utils/responsiveImages';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { skipToken } from '@reduxjs/toolkit/query';
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, MapPin, RotateCcw, Ruler, Share2, ShieldCheck, Star, Truck, X } from 'lucide-react';
import LazyBoundary from '../../components/ui/LazyBoundary';
import { ProductVisual } from '../../components/product/ProductCard';
import ProductDetailPage from '../../components/product/ProductDetailPage';
import RentalModeSelector from '../../components/rentals/RentalModeSelector';
import RentalOffer from '../../components/rentals/RentalOffer';
import CompleteLook from '../../components/product/CompleteLook';
import PublicReviewCard from '../../components/product/PublicReviewCard';
import Icon from '../../components/layout/Icon';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { getPrimaryImageIndex, getPrimaryImageUrl, normalizeImageUrl, normalizeProduct, normalizeProducts } from '../../services/normalize';
import { useGetProductQuery, useGetProductsQuery, useGetReviewsQuery, useGetSettingsQuery, useGetVariantGroupQuery } from '../../store/apiSlice';
import PageState from '../../components/ui/PageState';
import api from '../../services/api';
import { activeVariants, findProductVariant, firstInStockVariant, hasManagedVariants, isColorAvailable, isSizeAvailable, variantStock } from '../../utils/variants';
import { trackEvent } from '../../utils/analytics';
import SeoHead from '../../components/seo/SeoHead';
import { parseProductKey, storefrontPath } from '../../utils/routing';
import { getSelectableSizes } from '../../utils/productSizing';
import { useStorefront } from '../../context/StorefrontContext';
import { isUnavailable, wishlistStock } from '../../utils/wishlist';
import SelectedSizeSummary from '../../components/product/SelectedSizeSummary';
import { rememberRecentProduct } from '../../utils/recentProducts';

const SizeChartModal = lazy(() => import('../../components/product/SizeChartModal'));
const ReviewModal = lazy(() => import('../../components/product/ReviewModal'));

export default function ProductDetail({ navigate: navigateRoute, route = '' }) {
  const productKey = parseProductKey(route);
  const { storeSlug } = useStorefront();
  const isDesktop = useMediaQuery('(min-width: 1024px)', false, { getInitialValueInEffect: false });
  const navigate = useCallback(path => navigateRoute(storefrontPath(path, storeSlug)), [navigateRoute, storeSlug]);
  const cart = useCart();
  const wishlist = useWishlist();
  const { user } = useAuth();
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [openGallery, setOpenGallery] = useState(false);
  const [openSizeChart, setOpenSizeChart] = useState(false);
  const [deliveryPin, setDeliveryPin] = useState('');
  const [touchStartX, setTouchStartX] = useState(0);
  const [actionMessage, setActionMessage] = useState('');
  const [cartBusy, setCartBusy] = useState(false);
  const purchasePending = useRef(false);
  const initializedSelectionFor = useRef('');
  const activeProductKey = useRef(productKey);
  const mounted = useRef(true);
  activeProductKey.current = productKey;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [wishlistBusy, setWishlistBusy] = useState(false);
  const [deliveryChecking, setDeliveryChecking] = useState(false);
  const [deliveryResult, setDeliveryResult] = useState(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewEligibility, setReviewEligibility] = useState(null);
  const [reviewEligibilityLoading, setReviewEligibilityLoading] = useState(false);
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [reviewInitialRating, setReviewInitialRating] = useState(0);
  const [reviewSummary, setReviewSummary] = useState(null);
  const [helpfulReviewIds, setHelpfulReviewIds] = useState([]);
  const [helpfulBusyId, setHelpfulBusyId] = useState('');
  const [reviewItems, setReviewItems] = useState([]);
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewsLoadingMore, setReviewsLoadingMore] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const { data: productData, isLoading, error, refetch: refetchProduct } = useGetProductQuery(productKey ? { id: productKey, store: storeSlug, silent: true } : skipToken);
  const { data: settingsData } = useGetSettingsQuery({ store: storeSlug, silent: true });
  const product = productData ? normalizeProduct(productData) : null;
  const productId = product?._id || product?.id || product?.slug;
  const relatedQuery = product?.categoryId ? { category: product.categoryId, store: storeSlug } : { sort: 'rating', store: storeSlug };
  const { data: relatedData = [] } = useGetProductsQuery(product ? { ...relatedQuery, page: 1, limit: 12, silent: true } : skipToken);
  const { data: fallbackRelatedData = [] } = useGetProductsQuery(product ? { sort: 'rating', store: storeSlug, page: 1, limit: 12, silent: true } : skipToken);
  const { data: reviewsData, refetch: refetchReviews } = useGetReviewsQuery(productId ? { productId, store: storeSlug, page: 1, limit: 20, silent: true } : skipToken);
  const { data: variantGroupData } = useGetVariantGroupQuery(product?.variantGroupId ? { id: product.variantGroupId, store: storeSlug, silent: true } : skipToken);
  const variantMembers = useMemo(() => {
    const group = variantGroupData?.data;
    if (Array.isArray(group?.members) && group.members.length) return group.members.filter((member) => member?.product);
    return (Array.isArray(group?.products) ? group.products : []).map((entry) => ({ product: entry, productId: entry?._id || entry?.id, label: entry?.variantColor || entry?.variantName || entry?.name }));
  }, [variantGroupData?.data]);
  const variantProducts = useMemo(
    () => variantMembers.map((member) => member.product),
    [variantMembers],
  );
  const related = useMemo(() => {
    const byId = new Map();
    const pushProduct = (entry) => {
      if (!entry) return;
      const normalized = normalizeProduct(entry);
      const key = normalized._id || normalized.id || normalized.slug;
      if (!key || key === productId || byId.has(key)) return;
      byId.set(key, normalized);
    };

    [...normalizeProducts(catalogItems(relatedData)), ...normalizeProducts(catalogItems(fallbackRelatedData)), ...normalizeProducts(variantProducts)].forEach(pushProduct);
    return Array.from(byId.values()).slice(0, 12);
  }, [fallbackRelatedData, productId, relatedData, variantProducts]);
  const firstReviewItems = useMemo(() => Array.isArray(reviewsData) ? reviewsData : Array.isArray(reviewsData?.items) ? reviewsData.items : [], [reviewsData]);
  const reviewPagination = Array.isArray(reviewsData) ? null : reviewsData;
  const reviews = reviewItems;
  const effectiveReviewSummary = useMemo(() => reviewSummary || buildReviewSummary(reviews), [reviewSummary, reviews]);
  const storeWhatsappNumber = formatWhatsappNumber(settingsData?.whatsappNumber || '');
  const selectableSizes = product ? getSelectableSizes(product) : [];
  const managedOptionVariants = product ? activeVariants(product).filter((variant) => Object.keys(variant.optionValues || {}).length) : [];

  useEffect(() => {
    setReviewItems((current) => JSON.stringify(current) === JSON.stringify(firstReviewItems) ? current : firstReviewItems);
    setReviewPage((current) => current === 1 ? current : 1);
  }, [firstReviewItems, productId]);

  useEffect(() => {
    if (!productData) return;
    const item = normalizeProduct(productData);
    const selectionKey = String(item._id || item.id || item.slug || productKey);
    if (initializedSelectionFor.current === selectionKey) return;
    initializedSelectionFor.current = selectionKey;
    const inStock = firstInStockVariant(item);
    const availableSizes = getSelectableSizes(item);
    setSize('');
    setColor(inStock?.color || item.colors?.[0] || '');
    setSelectedVariantId(availableSizes.length ? '' : inStock?._id || '');
    setActiveImage(Math.max(0, getPrimaryImageIndex(item.images)));
    setOpenGallery(false);
    setActionMessage('');
    setDeliveryResult(null);
    setQuantity(1);
  }, [productData, productKey]);

  useEffect(() => {
    if (!product?._id) return;
    const track = () => trackEvent('PRODUCT_VIEW', { productId: product._id });
    track();
    window.addEventListener('store:traffic-privacy', track);
    return () => window.removeEventListener('store:traffic-privacy', track);
  }, [product?._id, storeSlug]);
  const historyEnabled = Boolean(settingsData) && settingsData.recentlyViewedEnabled !== false;
  useEffect(() => {
    if (product?._id && historyEnabled) rememberRecentProduct(product._id, storeSlug);
  }, [product?._id, storeSlug, historyEnabled]);

  useEffect(() => {
    if (!productId) return undefined;
    let active = true;
    const loadReviewState = async () => {
      try {
        const summary = await api.get(`/reviews/${productId}/summary`, { silent: true, cacheFirst: true });
        if (active && summary) setReviewSummary(summary);
      } catch {
        if (active) setReviewSummary(null);
      }
      if (!user) {
        if (active) {
          setReviewEligibility(null);
          setHelpfulReviewIds([]);
        }
        return;
      }
      try {
        const eligibility = await api.get(`/reviews/${productId}/eligibility`, { silent: true });
        if (active) {
          setReviewEligibility(eligibility);
          setHelpfulReviewIds(Array.isArray(eligibility?.helpfulReviewIds) ? eligibility.helpfulReviewIds.map(String) : []);
        }
      } catch {
        if (active) setReviewEligibility(null);
      }
    };
    loadReviewState();
    return () => { active = false; };
  }, [productId, user]);

  const isWishlisted = useMemo(
    () => Boolean(productId) && wishlist.items.some((item) => (item._id || item.id || item.slug) === productId),
    [wishlist.items, productId],
  );
  const selectedVariant = hasManagedVariants(product || {})
    ? (selectedVariantId
      ? findProductVariant(product || {}, { variantId: selectedVariantId })
      : selectableSizes.length || product?.colors?.length
        ? findProductVariant(product || {}, { size, color })
        : managedOptionVariants.length
          ? null
          : activeVariants(product || {}).find((variant) => (!color || String(variant.color) === String(color)) && Number(variant.stock || 0) > 0)
            || activeVariants(product || {})[0]
            || null)
    : null;
  const mediaItems = useMemo(() => {
    const variantImageItems = selectedVariant?.images?.length
      ? selectedVariant.images.map((image) => ({ ...image, type: 'image', url: normalizeImageUrl(image.url), thumbnail: normalizeImageUrl(image.url) }))
      : [];
    const productImageItems = product?.images?.length
      ? product.images.map((image) => ({ ...image, type: 'image', url: normalizeImageUrl(image.url), thumbnail: normalizeImageUrl(image.url) }))
      : [];
    const videoItems = product?.videos?.length
      ? product.videos.map((video) => ({ type: 'video', url: normalizeImageUrl(video.url), thumbnail: normalizeImageUrl(video.thumbnail || video.url) }))
      : [];
    const byUrl = new Map();
    [...variantImageItems, ...productImageItems, ...videoItems].forEach((item) => {
      if (item.url && !byUrl.has(item.url)) byUrl.set(item.url, item);
    });
    return Array.from(byUrl.values());
  }, [product?.images, product?.videos, selectedVariant?.images]);
  const selectedMedia = mediaItems[activeImage];
  const dealPrice = Math.max(0, Number(selectedVariant?.price ?? product?.price ?? 0));
  const originalPrice = Math.max(dealPrice, Number(selectedVariant?.originalPrice ?? product?.originalPrice ?? dealPrice));
  const discountPrice = Math.max(0, originalPrice - dealPrice);
  const discountPercentage = originalPrice > dealPrice
    ? Math.round(((originalPrice - dealPrice) / originalPrice) * 100)
    : 0;
  const freeShippingMinimum = Number(settingsData?.freeShippingMinAmount || 0);
  const qualifiesForFreeShipping = freeShippingMinimum > 0 && dealPrice >= freeShippingMinimum;
  const returnWindowDays = Number(settingsData?.returnWindowDays || 0);
  const returnPolicyText = product?.returnPolicy || settingsData?.returnPolicy || (returnWindowDays > 0 ? `${returnWindowDays}-day return window` : '');
  const selectionIncomplete = Boolean(
    (selectableSizes.length && !size)
    || (product?.colors?.length && !color)
    || (hasManagedVariants(product || {}) && !selectedVariant),
  );
  const selectedStock = hasManagedVariants(product || {}) && selectionIncomplete
    ? null
    : variantStock(product || {}, { size, color, variantId: selectedVariant?._id });
  const [purchaseMode, setPurchaseMode] = useState(() => new URLSearchParams(route.split('?')[1] || '').get('mode') === 'rent' ? 'rent' : 'buy');
  const supportsRental = ['RENTAL_ONLY', 'SALE_AND_RENTAL'].includes(product?.commerceMode);
  const purchaseEnabled = product?.purchaseEnabled !== false && settingsData?.commerceMode !== 'RENTAL_ONLY' && product?.commerceMode !== 'RENTAL_ONLY';
  const rentalOnly = !purchaseEnabled || (supportsRental && purchaseMode === 'rent');
  const selectedMode = rentalOnly ? 'rent' : 'buy';
  const chooseRentalDates = () => navigate('/rental-book?' + new URLSearchParams({ product: productId, ...(product?.rentalPreview?.listingId ? { listing: product.rentalPreview.listingId } : {}) }));
  const isOutOfStock = rentalOnly || (selectedStock !== null && Number(selectedStock) <= 0);
  const sizeStock = (item) => {
    if (!hasManagedVariants(product || {})) return null;
    const matching = activeVariants(product || {}).filter((variant) => (
      String(variant.size || '') === String(item)
      && (!color || String(variant.color || '') === String(color))
    ));
    return matching.length ? matching.reduce((sum, variant) => sum + Math.max(0, Number(variant.stock || 0)), 0) : 0;
  };

  useEffect(() => {
    if (selectedVariant?.images?.length) setActiveImage(0);
    if (selectedStock !== null && Number(selectedStock) > 0) {
      setQuantity((current) => Math.min(Math.max(1, current), Number(selectedStock)));
    }
  }, [selectedStock, selectedVariant?._id, selectedVariant?.images?.length]);

  useEffect(() => {
    if (!openGallery || !mediaItems.length) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpenGallery(false);
      if (event.key === 'ArrowLeft') setActiveImage((current) => (current - 1 + mediaItems.length) % mediaItems.length);
      if (event.key === 'ArrowRight') setActiveImage((current) => (current + 1) % mediaItems.length);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [mediaItems.length, openGallery]);

  const cartItem = product ? cart.getCartItem(product, { size, color, variantId: selectedVariant?._id }) : null;
  const similarPath = product?.categoryId
    ? `/products?category=${product.categoryId}`
    : product?.category
      ? `/products?search=${encodeURIComponent(product.category)}`
      : '/products';
  const handleCheckDelivery = async () => {
    if (!deliveryPin || deliveryPin.length < 6) {
      const message = 'Please enter a valid 6-digit PIN code.';
      setDeliveryResult({ status: 'error', title: 'Invalid PIN code', lines: [message], message });
      setActionMessage(message);
      return;
    }
    setDeliveryChecking(true);
    setActionMessage('');
    setDeliveryResult(null);
    try {
      const data = await api.get(`/settings/payment-methods?pincode=${encodeURIComponent(deliveryPin)}&amount=${encodeURIComponent(dealPrice)}`, { silent: true });
      const cod = (data?.methods || []).find((method) => method.key === 'COD');
      const freeShippingThreshold = Math.max(0, Number(data?.freeShippingMinAmount || 0));
      const shippingCharge = freeShippingThreshold > 0 && Number(dealPrice) >= freeShippingThreshold
        ? 0
        : Math.max(0, Number(data?.deliveryCharge || 0));
      const lines = [
        shippingCharge > 0 ? `Delivery charge: ₹${shippingCharge.toLocaleString('en-IN')}.` : 'This order qualifies for free shipping.',
        !cod
          ? 'Cash on Delivery is not enabled.'
          : cod.enabled
            ? `Cash on Delivery is available${Number(data?.codCharge || 0) > 0 ? ` with a ₹${Number(data.codCharge).toLocaleString('en-IN')} charge` : ''}.`
            : cod.disabledReason || 'Cash on Delivery is unavailable for this PIN code.',
      ];
      const result = { status: 'success', title: `Options for ${deliveryPin}`, lines, message: lines.join(' ') };
      setDeliveryResult(result);
      setActionMessage(result.message);
    } catch (deliveryError) {
      const message = deliveryError.message || 'Unable to check delivery right now.';
      setDeliveryResult({ status: 'error', title: 'Could not check this PIN code', lines: [message], message });
      setActionMessage(message);
    } finally {
      setDeliveryChecking(false);
    }
  };

  if (!productKey || error) {
    return (
      <section className="container-page py-10">
        <PageState error={error?.data?.message || error?.message || 'Product not found.'} onRetry={refetchProduct} />
      </section>
    );
  }

  if (isLoading || !product) {
    return (
      <section className="container-page py-10">
        <PageState loading loadingLabel="Loading product..." />
      </section>
    );
  }

  const add = async () => {
    if (purchasePending.current || cart.loading) return { ok: false, reason: 'busy' };
    if (selectableSizes.length && !size) {
      setActionMessage('Please select a size first.');
      return { ok: false, reason: 'missing-size' };
    }
    if (product?.colors?.length && !color) {
      setActionMessage('Please select a color first.');
      return { ok: false, reason: 'missing-color' };
    }
    if (!Number.isInteger(Number(quantity)) || Number(quantity) < 1) {
      setActionMessage('Please choose a valid quantity.');
      return { ok: false, reason: 'invalid-quantity' };
    }
    const selected = selectedVariant;
    if (hasManagedVariants(product) && !selected) {
      setActionMessage('This size and colour combination is unavailable. Please choose another option.');
      return { ok: false, reason: 'variant-unavailable' };
    }
    if (isOutOfStock) {
      setActionMessage('This product is out of stock.');
      return { ok: false, reason: 'out-of-stock' };
    }
    purchasePending.current = true;
    setCartBusy(true); setActionMessage('');
    try {
      const result = await cart.addToCartConfirmed(product, size, color, selected?._id || product.variantId || product.selectedVariantId || '', Number(quantity));
      if (!mounted.current || activeProductKey.current !== productKey) return { ok: false, reason: 'page-changed' };
      setActionMessage(result?.ok
        ? `${quantity} item${Number(quantity) === 1 ? '' : 's'} added to cart.`
        : result?.message || 'Unable to add this product right now. Please try again.');
      return result;
    } catch (error) {
      if (mounted.current && activeProductKey.current === productKey) setActionMessage(error.message || 'Unable to add this product right now. Please try again.');
      return { ok: false };
    } finally {
      purchasePending.current = false;
      if (mounted.current) setCartBusy(false);
    }
  };

  const selectDesktopSize = (nextSize) => {
    setSelectedVariantId('');
    setSize(nextSize);
    if (hasManagedVariants(product) && (!color || !isColorAvailable(product, color, nextSize))) {
      const compatible = activeVariants(product).find((variant) => String(variant.size) === String(nextSize) && Number(variant.stock || 0) > 0);
      setColor(compatible?.color || '');
    }
    setQuantity(1);
    setActionMessage('');
  };

  const selectDesktopColor = (nextColor) => {
    setSelectedVariantId('');
    setColor(nextColor);
    if (size && selectableSizes.length && hasManagedVariants(product) && !activeVariants(product).some((variant) => String(variant.size) === String(size) && String(variant.color) === String(nextColor) && Number(variant.stock || 0) > 0)) {
      setSize('');
    }
    setQuantity(1);
    setActionMessage('');
  };

  const selectManagedVariant = (variant) => {
    setSelectedVariantId(variant?._id || '');
    setSize(variant?.size || '');
    setColor(variant?.color || '');
    setQuantity(1);
    setActionMessage('');
  };

  const handleWishlist = async () => {
    if (!product || wishlist.loading || wishlistBusy) return;
    setWishlistBusy(true);
    try {
      await wishlist.toggleWishlist(product);
    } finally {
      setWishlistBusy(false);
    }
  };

  const loadReviewEligibility = async () => {
    const eligibility = await api.get(`/reviews/${productId}/eligibility`, { silent: true });
    setReviewEligibility(eligibility);
    setHelpfulReviewIds(Array.isArray(eligibility?.helpfulReviewIds) ? eligibility.helpfulReviewIds.map(String) : []);
    return eligibility;
  };

  const openReviewForm = async (initialRating = 0) => {
    setReviewFeedback('');
    setReviewInitialRating(initialRating);
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(route)}`);
      return;
    }
    if (!productId || reviewEligibilityLoading) return;
    setReviewEligibilityLoading(true);
    try {
      const eligibility = await loadReviewEligibility();
      if (!eligibility?.canReview) {
        const message = eligibility?.message || 'You can review this product after it has been delivered.';
        setReviewFeedback(message);
        setActionMessage(message);
        return;
      }
      setReviewModalOpen(true);
    } catch (reviewError) {
      if (reviewError?.status === 401) {
        navigate(`/login?redirect=${encodeURIComponent(route)}`);
      } else {
        const message = reviewError?.message || 'Unable to check review eligibility right now.';
        setReviewFeedback(message);
        setActionMessage(message);
      }
    } finally {
      setReviewEligibilityLoading(false);
    }
  };

  const saveReview = async (payload) => {
    const existing = reviewEligibility?.existingReview;
    const saved = existing?._id
      ? await api.put(`/reviews/${existing._id}`, payload)
      : await api.post(`/reviews/${productId}`, payload);
    const nextEligibility = {
      ...(reviewEligibility || {}),
      canReview: true,
      canEdit: true,
      hasDeliveredPurchase: true,
      existingReview: saved,
    };
    setReviewEligibility(nextEligibility);
    setReviewItems((current) => saved?.isVisible === false
      ? current.filter((item) => String(item._id) !== String(saved._id))
      : [saved, ...current.filter((item) => String(item._id) !== String(saved._id))]);
    const successMessage = existing ? 'Your review was updated successfully.' : 'Thank you. Your verified review was submitted successfully.';
    setReviewFeedback(successMessage);
    setActionMessage(successMessage);
    await Promise.allSettled([refetchReviews(), refetchProduct()]);
    try {
      const summary = await api.get(`/reviews/${productId}/summary`, { silent: true });
      if (summary) setReviewSummary(summary);
    } catch {
      setReviewSummary(null);
    }
    trackEvent(existing ? 'REVIEW_UPDATED' : 'REVIEW_SUBMITTED', { productId, metadata: { rating: payload.rating } });
    return {
      ...saved,
      message: saved?.isVisible === false
        ? 'Your review was saved. It will appear publicly when moderation is complete.'
        : existing
          ? 'Your changes are now visible in your review.'
          : 'Your verified review is now visible to other customers.',
    };
  };

  const uploadReviewPhotos = async (files) => api.upload('/reviews/uploads', files);

  const toggleReviewHelpful = async (review) => {
    const reviewId = String(review?._id || '');
    if (!reviewId || helpfulBusyId) return;
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(route)}`);
      return;
    }
    setHelpfulBusyId(reviewId);
    setReviewFeedback('');
    try {
      const result = await api.post(`/reviews/${reviewId}/helpful`, { helpful: !helpfulReviewIds.includes(reviewId) });
      setHelpfulReviewIds((current) => result.helpful
        ? Array.from(new Set([...current, reviewId]))
        : current.filter((id) => id !== reviewId));
      setReviewItems((current) => current.map((item) => String(item._id) === reviewId ? { ...item, helpfulCount: result.helpfulCount } : item));
    } catch (reviewError) {
      setReviewFeedback(reviewError?.message || 'Unable to update this review right now.');
    } finally {
      setHelpfulBusyId('');
    }
  };

  const loadMoreReviews = async () => {
    const totalPages = Number(reviewPagination?.totalPages || 1);
    if (!productId || reviewsLoadingMore || reviewPage >= totalPages) return;
    setReviewsLoadingMore(true);
    try {
      const nextPage = reviewPage + 1;
      const params = new URLSearchParams({ page: String(nextPage), limit: '20' });
      if (storeSlug) params.set('store', storeSlug);
      const data = await api.get(`/reviews/${productId}?${params}`, { silent: true, cacheFirst: true });
      const incoming = Array.isArray(data?.items) ? data.items : [];
      setReviewItems((current) => {
        const map = new Map(current.map((item) => [String(item._id), item]));
        incoming.forEach((item) => map.set(String(item._id), item));
        return [...map.values()];
      });
      setReviewPage(nextPage);
    } catch (reviewError) {
      setReviewFeedback(reviewError.message || 'Unable to load more reviews.');
    } finally { setReviewsLoadingMore(false); }
  };

  const withdrawReview = async (review) => {
    if (!review?._id) return;
    const result = await api.patch(`/reviews/${review._id}/withdraw`, {});
    setReviewItems((current) => current.filter((item) => String(item._id) !== String(review._id)));
    setReviewEligibility((current) => ({ ...(current || {}), existingReview: result.review, canEdit: true }));
    await Promise.allSettled([refetchProduct(), api.get(`/reviews/${productId}/summary`, { silent: true }).then(setReviewSummary)]);
  };

  const reportReview = async ({ reason, details }) => {
    if (!reportTarget?._id) return;
    const response = await api.post(`/reviews/${reportTarget._id}/report`, { reason, details });
    setReportTarget(null);
    setReviewFeedback(response.message || 'Thank you. The review was sent for moderation.');
  };

  const openReportReview = (review) => {
    if (!user) { navigate(`/login?redirect=${encodeURIComponent(route)}`); return; }
    setReportTarget(review);
  };

  const buyNow = async () => {
    const result = await add();
    if (result?.ok) {
      const match = (result.items || []).find(item => String(item.productId || item.product?._id || item.product?.id) === String(product._id || product.id)
        && String(item.size || '') === String(size || '') && String(item.color || '') === String(color || '')
        && String(item.variantId || '') === String(selectedVariant?._id || product.variantId || product.selectedVariantId || ''));
      const cartItemId = match?._id || match?.id || match?.cartItemId;
      navigate(cartItemId ? `/checkout?buyNow=${encodeURIComponent(cartItemId)}&quantity=${encodeURIComponent(quantity)}` : '/checkout');
    }
  };

  const orderOnWhatsApp = () => {
    if (!storeWhatsappNumber) {
      setActionMessage('Store WhatsApp number is not configured.');
      return;
    }
    trackEvent('WHATSAPP_CLICK', { productId: product?._id });
    if (selectableSizes.length && !size) {
      setActionMessage('Please select a size first.');
      return;
    }
    if (product?.colors?.length && !color) {
      setActionMessage('Please select a color first.');
      return;
    }
    if (!Number(quantity) || Number(quantity) < 1) {
      setActionMessage('Please choose a valid quantity.');
      return;
    }

    const currentUrl = window.location.href;
    const lines = [
      'Hello Jassi General Store,',
      'I want to order this product:',
      '',
      `Product: ${product.name}`,
      ...(selectableSizes.length ? [`Size: ${size}`] : []),
      `Color: ${color || 'N/A'}`,
      `Quantity: ${quantity}`,
      `Price: ₹${dealPrice}`,
      `Link: ${currentUrl}`,
    ];
    if (user?.name) lines.push(`Customer Name: ${user.name}`);
    if (user?.phone) lines.push(`Customer Phone: ${user.phone}`);
    const message = encodeURIComponent(lines.join('\n'));
    window.open(`https://wa.me/91${storeWhatsappNumber}?text=${message}`, '_blank', 'noopener,noreferrer');
    setActionMessage('');
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;
    const shareData = {
      title: product.name,
      text: `Check out ${product.name} at Samaira Collection`,
      url: shareUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        setActionMessage('Product link copied.');
      } else {
        setActionMessage('Sharing is not available in this browser.');
      }
    } catch {
      setActionMessage('Unable to share right now.');
    }
  };

  const goToImage = (index) => {
    if (!mediaItems.length) return;
    const total = mediaItems.length;
    setActiveImage((index + total) % total);
  };

  const backToCatalog = () => navigate(readCatalogReturnRoute(storeSlug));

  const handleTouchStart = (event) => {
    setTouchStartX(event.changedTouches[0]?.clientX || 0);
  };

  const handleTouchEnd = (event) => {
    const endX = event.changedTouches[0]?.clientX || 0;
    const deltaX = endX - touchStartX;
    if (Math.abs(deltaX) < 40) return;
    goToImage(activeImage + (deltaX < 0 ? 1 : -1));
  };

  return (
    <>
      <SeoHead route={route} product={product} />
      {isDesktop && <div className="hidden lg:block">
        <ProductDetailPage
          product={product}
          purchaseMode={selectedMode}
          onPurchaseMode={setPurchaseMode}
          purchaseEnabled={purchaseEnabled}
          navigate={navigate}
          route={route}
          mediaItems={mediaItems}
          activeMediaIndex={activeImage}
          onSelectMedia={setActiveImage}
          onPrevMedia={() => goToImage(activeImage - 1)}
          onNextMedia={() => goToImage(activeImage + 1)}
          onOpenFullscreen={() => setOpenGallery(true)}
          onToggleWishlist={handleWishlist}
          isWishlisted={isWishlisted}
          wishlistBusy={wishlistBusy}
          size={size}
          setSize={selectDesktopSize}
          color={color}
          setColor={selectDesktopColor}
          quantity={quantity}
          setQuantity={setQuantity}
          deliveryPin={deliveryPin}
          setDeliveryPin={setDeliveryPin}
          actionMessage={actionMessage}
          deliveryResult={deliveryResult}
          dealPrice={dealPrice}
          originalPrice={originalPrice}
          discountPercentage={discountPercentage}
          selectedStock={selectedStock}
          cartItem={cartItem}
          isOutOfStock={isOutOfStock}
          cartBusy={cartBusy || cart.loading}
          isSizeAvailable={(item) => isSizeAvailable(product, item)}
          isColorAvailable={(item) => isColorAvailable(product, item, size)}
          getSizeStock={sizeStock}
          onAddToCart={add}
          onBuyNow={buyNow}
          onOrderWhatsApp={orderOnWhatsApp}
          onCheckDelivery={handleCheckDelivery}
          deliveryChecking={deliveryChecking}
          relatedProducts={related}
          reviews={reviews}
          reviewSummary={effectiveReviewSummary}
          myReview={reviewEligibility?.existingReview}
          reviewFeedback={reviewFeedback}
          reviewLoading={reviewEligibilityLoading}
          helpfulReviewIds={helpfulReviewIds}
          helpfulBusyId={helpfulBusyId}
          onHelpful={toggleReviewHelpful}
          onReport={openReportReview}
          reviewHasMore={reviewPage < Number(reviewPagination?.totalPages || 1)}
          reviewsLoadingMore={reviewsLoadingMore}
          onLoadMoreReviews={loadMoreReviews}
          variantProducts={variantProducts}
          managedVariants={managedOptionVariants}
          selectedVariant={selectedVariant}
          onSelectManagedVariant={selectManagedVariant}
          selectedMedia={selectedMedia}
          storeWhatsappNumber={storeWhatsappNumber}
          settings={settingsData || {}}
          returnPolicy={returnPolicyText}
          onOpenSizeGuide={() => setOpenSizeChart(true)}
          onSelectVariant={(variant) => {
            const variantId = variant?._id || variant?.id || variant?.slug;
            if (variantId) navigate(`/product?id=${variantId}`);
          }}
          onShare={handleShare}
          onWriteReview={() => openReviewForm()}
        />
      </div>}
      {!isDesktop && <div className="lg:hidden">
        <section className="bg-ivory pb-40 md:bg-ivory md:pb-10 md:pt-8">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-3 md:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <button type="button" onClick={backToCatalog} className="grid h-10 w-10 place-items-center rounded-full text-slate-700 active:bg-slate-100" aria-label="Back to products"><ChevronLeft className="h-6 w-6" /></button>
          <span className="truncate text-[14px] font-semibold text-charcoal">Product Details</span>
        </div>
        <div className="flex items-center gap-0.5 text-slate-800">
          <button type="button" onClick={() => navigate('/search')} className="grid h-10 w-10 place-items-center rounded-full active:bg-slate-100" aria-label="Search"><Icon name="search" className="h-5 w-5" /></button>
          <button type="button" onClick={handleShare} className="grid h-10 w-10 place-items-center rounded-full active:bg-slate-100" aria-label="Share product"><Share2 className="h-5 w-5" /></button>
          <button type="button" onClick={() => navigate('/cart')} className="relative grid h-10 w-10 place-items-center rounded-full active:bg-slate-100" aria-label={cart.itemCount ? `Cart, ${cart.itemCount} items` : 'Cart'}><Icon name="bag" className="h-5 w-5" />{cart.itemCount > 0 ? <span aria-hidden="true" className="absolute right-0 top-0 rounded-full bg-rose px-1 text-[8px] font-bold leading-4 text-white">{cart.itemCount > 99 ? '99+' : cart.itemCount}</span> : null}</button>
        </div>
      </header>
      <div className="mx-auto max-w-6xl md:grid md:grid-cols-[0.95fr_1fr] md:gap-8 md:px-6">
        <div className="md:sticky md:top-24 md:self-start">
          <div
            className="relative mx-3 mt-3 overflow-hidden rounded-[16px] bg-[#f6efe8] shadow-sm md:mx-0 md:mt-0 md:rounded-2xl"
            onTouchStart={mediaItems.length > 1 ? handleTouchStart : undefined}
            onTouchEnd={mediaItems.length > 1 ? handleTouchEnd : undefined}
          >
            {selectedMedia ? (
              selectedMedia.type === 'video' ? (
                <video
                  src={selectedMedia.url}
                  poster={selectedMedia.thumbnail}
                  controls
                  playsInline
                  className="h-[min(118vw,520px)] min-h-[420px] w-full bg-black object-contain md:h-[620px]"
                />
              ) : (
                <button type="button" onClick={() => setOpenGallery(true)} className="block w-full cursor-zoom-in bg-[#f6efe8]" aria-label={`View ${product.name} image fullscreen`}>
                  <img {...responsiveImage(selectedMedia, 'detail')} alt={product.name} className="h-[min(118vw,520px)] min-h-[420px] w-full bg-[#f6efe8] object-contain md:h-[620px]" />
                </button>
              )
            ) : (
              <ProductVisual product={product} showMeta={false} />
            )}
            <button
              type="button"
              onClick={() => navigate(similarPath)}
              className="absolute bottom-3 left-3 hidden min-w-[106px] rounded-xl bg-white px-3 py-2 text-center text-xs font-black shadow md:block"
            >
              View Similar
            </button>
            <div className="absolute bottom-3 right-3 inline-flex min-w-[108px] items-center justify-center rounded-lg bg-white/95 px-3 py-2 text-center text-[11px] font-black shadow md:bottom-4 md:right-4 md:min-w-[106px] md:text-xs">
              {Number(product.rating || 0).toFixed(1)} <Star className="ml-1 h-3 w-3 fill-emerald-600 text-emerald-600" /> <span className="mx-2 text-slate-300">|</span> {product.numReviews || reviews.length || 0}
            </div>
          </div>
          {mediaItems.length > 1 && (
            <div className="mt-3 flex justify-center gap-2.5">
              {mediaItems.slice(0, 8).map((item, index) => (
                <button
                  key={`${item.type}-${item.url}`}
                  type="button"
                  onClick={() => goToImage(index)}
                  className={`rounded-full ${activeImage === index ? 'h-2.5 w-2.5 bg-slate-700' : 'h-2.5 w-2.5 bg-slate-300'}`}
                  aria-label={`Show media ${index + 1}`}
                />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3 px-3 pt-3 md:space-y-7 md:px-0 md:pt-0">
          <div className="rounded-[14px] bg-white px-4 py-4 md:rounded-none md:bg-transparent md:px-0 md:py-0">
            <div className="relative pr-12">
            <p className="text-[16px] font-bold leading-tight text-slate-900 md:text-xl">{product.brand || 'Jassi General Store'}</p>
            <h1 className="mt-1.5 text-[14px] font-medium leading-5 text-slate-600 md:text-[22px] md:text-slate-900">
              {product.name}
            </h1>
            <button
              type="button"
              onClick={handleWishlist}
              disabled={wishlist.loading || wishlistBusy}
              className={`absolute right-0 top-0 grid h-10 w-10 place-items-center rounded-full border transition disabled:opacity-60 md:h-8 md:w-8 md:rounded-xl ${isWishlisted ? 'border-rose bg-rose/10 text-rose' : 'border-slate-200 text-slate-700'}`}
              aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
              aria-pressed={isWishlisted}
            >
              <Icon name="heart" className="h-4.5 w-4.5 md:h-5 md:w-5" />
            </button>
            </div>
            {supportsRental && <RentalModeSelector product={product} value={selectedMode} onChange={setPurchaseMode} purchaseEnabled={purchaseEnabled} />}
            {!rentalOnly && <><div className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-[20px] font-bold text-charcoal md:text-2xl">{formatRupees(dealPrice)}</span>
              {originalPrice > dealPrice && <span className="text-[13px] text-slate-400">MRP <span className="line-through">{formatRupees(originalPrice)}</span></span>}
              {discountPercentage > 0 && <span className="text-[13px] font-bold text-[#ff3e6c]">({discountPercentage}% OFF)</span>}
            </div>
            <p className="mt-1 text-[11px] font-semibold text-emerald-600">Inclusive of all taxes</p></>}
            <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-bold text-white">{Number(product.rating || 0).toFixed(1)} <Star className="h-3 w-3 fill-white" /></span>
              <span className="text-[11px] font-medium text-slate-500">{product.numReviews || reviews.length || 0} rating{(product.numReviews || reviews.length || 0) === 1 ? '' : 's'}</span>
              <span className="ml-auto text-[11px] font-semibold text-slate-500">{rentalOnly ? 'Check rental dates below' : isOutOfStock ? 'Out of stock' : 'In stock'}</span>
            </div>
          </div>

          {!rentalOnly && <><div className="rounded-[14px] bg-white p-4 md:rounded-2xl">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[14px] font-bold text-charcoal">Price details</h2>
              {discountPrice > 0 && <span className="rounded-full bg-blush px-3 py-1 text-[10px] font-bold text-[#ff3e6c]">You save {formatRupees(discountPrice)}</span>}
            </div>
            <dl className="mt-3 space-y-2 text-[12px]">
              <PriceRow label="Maximum retail price" value={formatRupees(originalPrice)} />
              {discountPrice > 0 && <PriceRow label={`Product discount (${discountPercentage}%)`} value={`- ${formatRupees(discountPrice)}`} valueClass="text-emerald-600" />}
              <PriceRow label="Selling price" value={formatRupees(dealPrice)} strong />
            </dl>
            <p className="mt-3 border-t border-slate-100 pt-3 text-[10px] leading-4 text-slate-500">MRP includes applicable taxes. Delivery fees, if any, are shown at checkout.</p>
          </div>

          <section className="rounded-[14px] bg-white p-4 md:rounded-none md:bg-transparent md:p-0">
            {selectableSizes.length ? (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-[14px] font-bold uppercase tracking-[.04em] text-charcoal md:text-xl">Select size</h2>
                  <button type="button" onClick={() => setOpenSizeChart(true)} className="inline-flex items-center gap-1 text-[11px] font-bold text-[#ff3e6c]">Size chart <ChevronRight className="h-3.5 w-3.5" /></button>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-5">
                  {selectableSizes.map((item) => {
                    const remaining = sizeStock(item);
                    const available = isSizeAvailable(product, item);
                    return <span key={item} className="relative inline-grid place-items-center">
                      <button type="button" disabled={!available} onClick={() => selectDesktopSize(item)} className={`grid h-12 min-w-12 place-items-center rounded-full border px-3 text-[12px] font-bold disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300 disabled:line-through md:h-14 md:min-w-14 ${size === item ? 'border-[#ff3e6c] bg-blush text-[#ff3e6c] ring-1 ring-[#ff3e6c]' : 'border-slate-300 bg-white text-charcoal'}`} aria-label={`Size ${item}${available ? '' : ', unavailable'}`} aria-pressed={size === item}>{item}</button>
                      {available && Number.isFinite(remaining) && remaining > 0 && remaining <= 3 ? <small className="absolute -bottom-2 right-[-4px] rounded-[3px] bg-[#ff7f50] px-1.5 py-0.5 text-[8px] font-black leading-none text-white">{remaining} left</small> : null}
                    </span>;
                  })}
                </div>
                <SelectedSizeSummary product={product} size={size} onOpenSizeGuide={() => setOpenSizeChart(true)} />
              </>
            ) : null}
            {product.colors?.length > 0 && (
              <div className="mt-5 border-t border-slate-100 pt-4">
                <p className="text-[13px] font-bold text-charcoal">Select colour <span className="ml-1 font-medium text-slate-500">{color}</span></p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {product.colors.map((item) => (
                    <button
                      key={item}
                      type="button"
                      disabled={!isColorAvailable(product, item, size)}
                      onClick={() => selectDesktopColor(item)}
                      className={`inline-flex h-10 items-center gap-2 rounded-full border px-3 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-35 ${color === item ? 'border-[#ff3e6c] bg-blush text-[#ff3e6c]' : 'border-slate-200 bg-white text-charcoal'}`}
                      aria-label={`Select color ${item}`}
                    >
                      <span className="h-5 w-5 rounded-full border border-black/10" style={{ backgroundColor: colorSwatches[item] || '#d8b4c0' }} />
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {managedOptionVariants.length ? (
              <div className="mt-5 border-t border-slate-100 pt-4">
                <p className="text-[13px] font-bold text-charcoal">Choose product option</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {managedOptionVariants.map((variant) => {
                    const active = String(selectedVariant?._id || '') === String(variant._id || '');
                    const available = variant.isActive !== false && Number(variant.stock || 0) > 0;
                    return (
                      <button key={variant._id || formatManagedVariant(variant)} type="button" disabled={!available} onClick={() => selectManagedVariant(variant)} className={`min-h-12 rounded-xl border px-3 py-2 text-left text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${active ? 'border-[#ff3e6c] bg-blush text-[#ff3e6c]' : 'border-slate-200 bg-white text-charcoal'}`}>
                        <span className="block">{formatManagedVariant(variant)}</span>
                        <small className="mt-1 block text-[9px] font-medium opacity-70">{available ? `${variant.stock} available` : 'Out of stock'}</small>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
              <div><span className="text-[13px] font-bold text-charcoal">Quantity</span><p className="mt-1 text-[10px] text-slate-500">Choose how many you need</p></div>
              <div className="inline-flex items-center overflow-hidden rounded-lg border border-slate-300 bg-white">
                <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} className="h-10 w-10 text-lg font-black text-[#ff3e6c] disabled:text-slate-300" disabled={quantity <= 1} aria-label="Decrease quantity">−</button>
                <span className="grid h-10 min-w-10 place-items-center border-x border-slate-200 px-2 text-[13px] font-black text-charcoal">{quantity}</span>
                <button type="button" onClick={() => setQuantity((value) => selectedStock === null ? value + 1 : Math.min(value + 1, Number(selectedStock)))} disabled={selectedStock !== null && quantity >= Number(selectedStock)} className="h-10 w-10 text-lg font-black text-[#ff3e6c] disabled:text-slate-300" aria-label="Increase quantity">+</button>
              </div>
            </div>
            <div className={`mt-4 flex items-center gap-2 rounded-lg px-3 py-2.5 text-[11px] font-semibold ${selectableSizes.length && !size ? 'bg-amber-50 text-amber-800' : isOutOfStock ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
              {selectableSizes.length && !size ? <Ruler className="h-4 w-4 shrink-0" /> : isOutOfStock ? <AlertCircle className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
              {selectableSizes.length && !size ? 'Choose a size before adding this product to your bag.' : isOutOfStock ? 'This selection is currently unavailable.' : selectedStock === null ? 'Available to order' : `${selectedStock} item${Number(selectedStock) === 1 ? '' : 's'} available for this selection`}
            </div>
          </section>

          </>}
          {variantMembers.length > 1 ? (
            <section className="rounded-[14px] bg-white p-4 md:rounded-2xl md:border md:border-theme-border">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[.12em] text-[#9b3150]">Product family</p>
                  <h2 className="mt-1 text-[14px] font-bold text-charcoal md:text-xl">Choose {variantGroupData?.data?.optionDefinitions?.map((item) => item.label).join(' / ') || 'a style'}</h2>
                </div>
                <span className="rounded-full bg-[#f8eef1] px-2.5 py-1 text-[9px] font-bold text-wine">{variantMembers.length} choices</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {variantMembers.map((member) => {
                  const variantProduct = normalizeProduct(member.product);
                  const variantId = variantProduct._id || variantProduct.id;
                  const isCurrent = String(variantId) === String(productId);
                  const available = Number(variantProduct.stock || 0) > 0;
                  const image = variantProduct.primaryImageUrl;
                  const difference = Number(variantProduct.price || 0) - Number(product.price || 0);
                  const compatibleSize = size && getSelectableSizes(variantProduct).includes(size) ? size : '';
                  return (
                    <button
                      key={variantId}
                      type="button"
                      disabled={!available && !isCurrent}
                      onClick={() => navigate(`/product?id=${encodeURIComponent(variantId)}${compatibleSize ? `&size=${encodeURIComponent(compatibleSize)}` : ''}`)}
                      aria-current={isCurrent ? 'true' : undefined}
                      className={`flex min-w-0 items-center gap-2 rounded-xl border p-2 text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${isCurrent ? 'border-wine bg-[#fff2f6] shadow-[inset_0_0_0_1px_#7a1f36]' : 'border-slate-200 bg-white hover:border-[#bd7589]'}`}
                    >
                      {member.swatch && /^#[0-9a-f]{3,8}$/i.test(member.swatch) ? <span className="h-9 w-9 shrink-0 rounded-lg border border-black/10" style={{ backgroundColor: member.swatch }} /> : image ? <img src={image} alt="" className="h-11 w-9 shrink-0 rounded-lg object-cover" /> : <span className="grid h-11 w-9 shrink-0 place-items-center rounded-lg bg-[#f5e9e4] text-[9px] font-black text-[#8c2947]">SC</span>}
                      <span className="min-w-0 flex-1">
                        <b className="block truncate text-[10px] font-bold text-charcoal md:text-[11px]" title={member.label}>{member.label || variantProduct.variantColor || variantProduct.name}</b>
                        <small className={`mt-1 block text-[9px] font-semibold ${available ? 'text-emerald-700' : 'text-rose'}`}>{available ? `₹${Number(variantProduct.price || 0).toLocaleString('en-IN')}${difference ? ` · ${difference > 0 ? '+' : '−'}₹${Math.abs(difference).toLocaleString('en-IN')}` : ''}` : 'Out of stock'}</small>
                      </span>
                      {isCurrent && <CheckCircle2 className="h-4 w-4 shrink-0 text-wine" />}
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {!rentalOnly && <div className="hidden gap-3 md:flex">
            <button disabled={isOutOfStock || cartBusy || cart.loading} onClick={add} className={`h-14 flex-1 rounded-xl px-5 py-4 text-sm font-black text-white disabled:opacity-50 ${cartItem ? 'bg-emerald-600' : 'bg-rose'}`}>
              {cartBusy ? 'Adding…' : cartItem ? 'Add More' : 'Add to Cart'}
            </button>
            <button disabled={isOutOfStock || cartBusy || cart.loading} onClick={buyNow} className="h-14 flex-1 rounded-xl bg-charcoal px-5 py-4 text-sm font-black text-white disabled:opacity-50">{cartBusy ? 'Adding…' : 'Buy Now'}</button>
            <button disabled={isOutOfStock} onClick={orderOnWhatsApp} className="h-14 flex-1 rounded-xl border border-emerald-600 px-5 py-4 text-sm font-black text-emerald-700 disabled:opacity-50">
              Order on WhatsApp
            </button>
          </div>}

          {actionMessage && <p className="rounded-[14px] bg-[#fff4f7] px-4 py-3 text-[12px] font-semibold leading-5 text-rose md:rounded-2xl" role="status">{actionMessage}</p>}

          {!supportsRental && !purchaseEnabled && <section className="rental-card"><h2>Rental setup is not available for this item</h2><p>The store is currently rental-only. Choose a ready rental from the collection or contact the store.</p><button type="button" className="rental-button" onClick={() => navigate('/products?mode=rent')}>Browse rental collection</button><button type="button" className="rental-text-button" onClick={() => navigate('/contact')}>Contact store</button></section>}
          {supportsRental && rentalOnly && <RentalOffer productId={productId} commerceMode={product.commerceMode} navigate={navigate} />}

          <section className="rounded-[14px] bg-white p-4 md:space-y-2 md:rounded-none md:bg-transparent md:p-0 md:pt-2">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-charcoal" />
              <h2 className="text-[14px] font-bold uppercase tracking-[.04em] text-charcoal md:text-xl">Delivery & services</h2>
            </div>
            <p className="mt-2 text-[10px] leading-4 text-slate-500">Enter your PIN code to check delivery and Cash on Delivery availability.</p>
            <div className="mt-3 flex gap-2">
              <label className="sc-field-shell flex h-12 min-w-0 flex-1 items-center rounded-[10px] border border-slate-300 bg-white px-3 focus-within:border-[#ff3e6c]">
                <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
                <input value={deliveryPin} onChange={(event) => setDeliveryPin(event.target.value.replace(/\D/g, '').slice(0, 6))} className="min-w-0 flex-1 bg-transparent px-2 text-[12px] font-semibold outline-none" placeholder="Enter delivery PIN" inputMode="numeric" aria-label="Delivery PIN code" />
              </label>
              <button type="button" onClick={handleCheckDelivery} disabled={deliveryPin.length !== 6 || deliveryChecking} className="h-12 rounded-[10px] border border-[#ff3e6c] bg-white px-5 text-[12px] font-bold text-[#ff3e6c] disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300 md:rounded-xl">{deliveryChecking ? 'Checking...' : 'Check'}</button>
            </div>
            <div className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
              <ServiceRow
                icon={Truck}
                title={qualifiesForFreeShipping ? 'Free delivery for this product' : freeShippingMinimum > 0 ? `Free delivery on orders above ${formatRupees(freeShippingMinimum)}` : 'Delivery charge shown at checkout'}
                detail="Final delivery options are confirmed for your PIN code."
              />
              <ServiceRow
                icon={RotateCcw}
                title={returnPolicyText || 'Return policy'}
                detail={returnPolicyText ? 'Full return information is included below.' : 'Return eligibility is shown before checkout.'}
              />
              <ServiceRow icon={ShieldCheck} title="Payment options at checkout" detail="Available payment methods are confirmed before you place the order." />
            </div>
          </section>

          <DetailsCard product={product} returnPolicy={returnPolicyText} />

          <section className="hidden grid-cols-2 gap-2 text-center md:grid">
            <TrustBadge title="Genuine Product" />
            <TrustBadge title="Quality Checked" />
          </section>

          <section className="hidden md:block">
            <h2 className="section-title text-xl">Easy returns and exchanges</h2>
            <p className="body-text text-slate-600">{product.returnPolicy || 'Choose to return or exchange for a different size, if available, within the allowed return window.'}</p>
          </section>
        </div>
      </div>

      {related.length > 0 && (
        <div className="mx-auto mt-4 max-w-6xl space-y-9 px-4 md:px-6">
          <ProductRail title="You may also like" subtitle="More available styles from this collection" products={related.slice(0, 10)} navigate={navigate} />
        </div>
      )}

      <ReviewsSection
        product={product}
        reviews={reviews}
        summary={effectiveReviewSummary}
        onRate={() => openReviewForm()}
        rateLoading={reviewEligibilityLoading}
        feedback={reviewFeedback}
        myReview={reviewEligibility?.existingReview}
        helpfulReviewIds={helpfulReviewIds}
        helpfulBusyId={helpfulBusyId}
        onHelpful={toggleReviewHelpful}
        onReport={openReportReview}
        reviewHasMore={reviewPage < Number(reviewPagination?.totalPages || 1)}
        reviewsLoadingMore={reviewsLoadingMore}
        onLoadMoreReviews={loadMoreReviews}
      />

      <div className="mx-auto mt-9 max-w-6xl px-4 md:px-6">
        <div className="rounded-[14px] border border-slate-200 bg-white p-4 md:rounded-3xl md:p-5">
          {[
            `More ${product.category} by ${product.brand || 'Jassi General Store'}`,
            `More ${product.colors?.[0] || ''} ${product.category}`,
            `More ${product.category}`,
          ].map((label) => (
            <button key={label} type="button" onClick={() => navigate(`/products?category=${product.categoryId || ''}`)} className="flex w-full items-center justify-between gap-3 border-b border-slate-100 py-3.5 text-left text-[12px] font-semibold text-charcoal last:border-b-0 md:text-lg md:font-black">
              {label.trim()}
              <ChevronRight className="h-4 w-4 text-rose" />
            </button>
          ))}
        </div>
        <p className="small-text mt-8 text-slate-500">Product Code: {product.sku || productId}</p>
      </div>

      {supportsRental && rentalOnly && <div className="rental-sticky-action md:hidden"><button type="button" className="rental-button" onClick={chooseRentalDates}>Choose rental dates</button><button type="button" className="rental-text-button" onClick={() => navigate('/contact')}>Ask the store</button></div>}
      {!rentalOnly && <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] left-0 right-0 z-40 border-t border-slate-200 bg-white/95 px-3 py-2.5 shadow-[0_-8px_20px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
        <div className={`grid gap-2 ${storeWhatsappNumber ? 'grid-cols-[.9fr_1.2fr_.9fr]' : 'grid-cols-2'}`}>
          <button disabled={isOutOfStock || cartBusy || cart.loading} onClick={buyNow} className="h-12 rounded-[10px] border border-wine bg-white px-2 text-[12px] font-bold text-wine disabled:border-slate-200 disabled:text-slate-400">
            {cartBusy ? 'Adding…' : selectableSizes.length && !size ? 'Select size' : 'Buy Now'}
          </button>
          <button disabled={isOutOfStock || cartBusy || cart.loading} onClick={add} className={`flex h-12 items-center justify-center gap-1.5 rounded-[10px] px-2 text-[12px] font-bold text-white disabled:bg-slate-300 ${cartItem ? 'bg-emerald-600' : 'bg-wine'}`}>
            <Icon name="bag" className="h-4 w-4" />
            {cartBusy ? 'Adding…' : isOutOfStock ? 'Out of Stock' : selectableSizes.length && !size ? 'Select size' : cartItem ? 'Add More' : 'Add to Bag'}
          </button>
          {storeWhatsappNumber ? <button disabled={isOutOfStock} onClick={orderOnWhatsApp} className="h-12 rounded-[10px] border border-emerald-600 px-2 text-[12px] font-bold text-emerald-700 disabled:border-slate-200 disabled:text-slate-400">
            WhatsApp
          </button> : null}
        </div>
      </div>}

        </section>
      </div>}

      <CompleteLook key={`${storeSlug}:${productId}`} productId={productId} storeSlug={storeSlug} navigate={navigate} />

      {reviewModalOpen && <LazyBoundary><Suspense fallback={<p role="status" className="p-4 text-sm">Loading review form…</p>}><ReviewModal
        open={reviewModalOpen}
        product={product}
        existingReview={reviewEligibility?.existingReview}
        initialRating={reviewInitialRating}
        onClose={() => setReviewModalOpen(false)}
        onSubmit={saveReview}
        onUpload={uploadReviewPhotos}
        onWithdraw={withdrawReview}
      /></Suspense></LazyBoundary>}
      {reportTarget ? <ReviewReportModal review={reportTarget} onClose={() => setReportTarget(null)} onSubmit={reportReview} /> : null}
      {openSizeChart && <LazyBoundary><Suspense fallback={<p role="status" className="p-4 text-sm">Loading size guide…</p>}><SizeChartModal
        open={openSizeChart}
        onClose={() => setOpenSizeChart(false)}
        product={product}
        sizes={selectableSizes}
        guideText={settingsData?.sizeGuide || ''}
        selectedSize={size}
        onSelectSize={selectDesktopSize}
        isSizeAvailable={(item) => isSizeAvailable(product, item)}
      /></Suspense></LazyBoundary>}
      {openGallery && mediaItems.length > 0 && (
        <div className="fixed inset-0 z-[90] bg-black md:bg-black/95" role="dialog" aria-modal="true" aria-label={`${product.name} image gallery`} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between px-4 pb-3 pt-6 text-white">
              <button type="button" onClick={() => setOpenGallery(false)} className="grid h-10 w-10 place-items-center text-3xl leading-none" aria-label="Close gallery">
                &times;
              </button>
              <p className="text-sm font-black">{activeImage + 1} / {mediaItems.length}</p>
            </div>
            <div className="relative flex min-h-0 flex-1 items-center justify-center px-3 md:px-16">
              {mediaItems.length > 1 ? (
                <>
                  <button type="button" onClick={() => goToImage(activeImage - 1)} className="absolute left-4 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-slate-900 shadow-lg md:grid" aria-label="Previous image">
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <button type="button" onClick={() => goToImage(activeImage + 1)} className="absolute right-4 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-slate-900 shadow-lg md:grid" aria-label="Next image">
                    <ChevronRight className="h-6 w-6" />
                  </button>
                </>
              ) : null}
              {mediaItems[activeImage]?.type === 'video' ? (
                <video
                  src={mediaItems[activeImage]?.url}
                  poster={mediaItems[activeImage]?.thumbnail}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-full w-full object-contain"
                />
              ) : (
                <img src={mediaItems[activeImage]?.url} alt={`${product.name} ${activeImage + 1}`} className="max-h-full w-full object-contain" />
              )}
            </div>
            {mediaItems.length > 1 && (
              <div className="pb-[max(20px,env(safe-area-inset-bottom))] pt-4">
                <div className="hide-scrollbar flex gap-3 overflow-x-auto px-4">
                  {mediaItems.map((item, index) => (
                    <button
                      key={`${item.type}-${item.url}-${index}`}
                      type="button"
                      onClick={() => goToImage(index)}
                      className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-2 ${activeImage === index ? 'border-rose' : 'border-white/20'}`}
                    >
                      {item.type === 'video' ? (
                        <video src={item.thumbnail || item.url} className="h-full w-full object-cover" muted />
                      ) : (
                        <img {...responsiveImage(item, 'thumbnail')} alt={`${product.name} thumbnail ${index + 1}`} className="h-full w-full object-cover" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function DetailsCard({ product, returnPolicy }) {
  const selectableSizes = getSelectableSizes(product);
  const specifications = [
    ...(Array.isArray(product.specifications) ? product.specifications : []).filter((item) => item?.label && item?.value).map((item) => [item.label, [item.value, item.unit].filter(Boolean).join(' ')]),
    ['Category', product.category],
    ['Subcategory', product.subCategory],
    ['Fabric', product.fabric],
    ['Occasion', product.occasion],
    ['Colours', product.colors?.join(', ')],
    ['Available sizes', selectableSizes.join(', ')],
    ['Product code', product.sku],
  ].filter(([, value]) => String(value || '').trim());
  const description = product.description || product.shortDescription || '';
  const highlights = Array.isArray(product.highlights) ? product.highlights.filter(Boolean) : [];

  return (
    <section className="rounded-[14px] bg-white p-4 md:rounded-3xl md:p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-bold uppercase tracking-[.04em] text-charcoal md:text-xl">Product details</h2>
        {product.sku && <span className="text-[9px] font-semibold text-slate-400">Code: {product.sku}</span>}
      </div>

      {description && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <h3 className="text-[12px] font-bold text-charcoal">Product description</h3>
          <p className="mt-2 whitespace-pre-line text-[11px] leading-5 text-slate-600 md:text-sm">{description}</p>
        </div>
      )}

      {specifications.length > 0 && (
        <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4 border-t border-slate-100 pt-4">
          {specifications.map(([label, value]) => <Spec key={label} label={label} value={value} />)}
        </dl>
      )}

      {highlights.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <h3 className="text-[12px] font-bold text-charcoal">Key highlights</h3>
          <ul className="mt-2 space-y-2 text-[11px] leading-5 text-slate-600 md:text-sm">
            {highlights.map((item) => <li key={item} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /><span>{item}</span></li>)}
          </ul>
        </div>
      )}

      {product.careInstructions && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <h3 className="text-[12px] font-bold text-charcoal">Material & care</h3>
          <p className="mt-2 text-[11px] leading-5 text-slate-600 md:text-sm">{product.careInstructions}</p>
        </div>
      )}

      {returnPolicy && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <h3 className="text-[12px] font-bold text-charcoal">Returns</h3>
          <p className="mt-2 text-[11px] leading-5 text-slate-600 md:text-sm">{returnPolicy}</p>
        </div>
      )}
    </section>
  );
}

function Spec({ label, value }) {
  return <div><dt className="text-[10px] font-medium text-slate-500">{label}</dt><dd className="mt-1 text-[11px] font-semibold leading-4 text-charcoal md:text-sm">{value}</dd></div>;
}

function PriceRow({ label, value, strong = false, valueClass = '' }) {
  return (
    <div className={`flex items-center justify-between gap-4 ${strong ? 'border-t border-slate-100 pt-2 font-bold text-charcoal' : 'text-slate-600'}`}>
      <dt>{label}</dt>
      <dd className={`shrink-0 ${valueClass}`}>{value}</dd>
    </div>
  );
}

function ServiceRow({ icon: ServiceIcon, title, detail }) {
  return (
    <div className="flex gap-3 py-3.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blush text-[#ff3e6c]">
        <ServiceIcon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold leading-4 text-charcoal">{title}</p>
        {detail && <p className="mt-0.5 text-[9px] leading-4 text-slate-500">{detail}</p>}
      </div>
    </div>
  );
}

function TrustBadge({ title }) {
  return (
    <div className="rounded-2xl bg-rose/5 p-4">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-rose text-rose">
        <Icon name="star" />
      </div>
      <p className="label-text mt-2 text-rose">{title}</p>
    </div>
  );
}

function ProductRail({ title, subtitle, products, navigate }) {
  if (!products.length) return null;
  return (
    <section>
      <h2 className="section-title text-xl md:text-xl">{title}</h2>
      {subtitle && <p className="small-text mt-1 font-bold text-amber-600">{subtitle}</p>}
      <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
        {products.map((product) => <RailProduct key={product.id} product={product} navigate={navigate} />)}
      </div>
    </section>
  );
}

function catalogItems(value) {
  return Array.isArray(value) ? value : Array.isArray(value?.items) ? value.items : [];
}

function readCatalogReturnRoute(storeSlug) {
  const fallback = storeSlug ? `/store/${encodeURIComponent(storeSlug)}/products` : '/products';
  try {
    const saved = JSON.parse(sessionStorage.getItem('samira_catalog_return') || 'null');
    const route = String(saved?.route || '');
    const path = route.split('?')[0];
    const validPath = ['/products', '/search', '/category'].includes(path)
      || /^\/store\/[^/]+\/(products|search|category)$/.test(path);
    const fresh = Date.now() - Number(saved?.savedAt || 0) < 30 * 60 * 1000;
    if (validPath && fresh) return route;
  } catch { /* Ignore unavailable session storage. */ }
  return fallback;
}

function RailProduct({ product, navigate }) {
  const cart = useCart();
  const image = getPrimaryImageUrl(product.images);
  const cartItem = cart.getCartItem(product);
  const unavailable = isUnavailable(product) || wishlistStock(product) === 0;
  const needsSize = getSelectableSizes(product).length > 0;
  return (
    <article className="w-40 shrink-0 md:w-52">
      <button type="button" onClick={() => navigate(`/product?id=${product._id || product.id || product.slug}`)} className="block w-full overflow-hidden rounded-2xl border border-slate-200 bg-[#f6efe8]">
        {image ? <img loading="lazy" decoding="async" src={normalizeImageUrl(image)} alt={product.name} className="h-48 w-full object-cover md:h-64" /> : <ProductVisual product={product} compact />}
      </button>
      <h3 className="product-name mt-2 truncate" title={product.name}>{product.name}</h3>
      <p className="mt-1"><span className="old-price text-slate-400 line-through">Rs. {product.originalPrice}</span> <span className="price">Rs. {product.price}</span></p>
      <button type="button" disabled={unavailable || cart.loading} onClick={() => needsSize ? navigate(`/product?id=${product._id || product.id || product.slug}`) : cart.addToCart(product)} className={`mt-3 h-10 w-full rounded-xl border disabled:opacity-50 ${cartItem ? 'border-emerald-600 text-emerald-700' : 'border-rose text-rose'}`}>
        {unavailable ? 'Out of stock' : needsSize ? 'Select size' : cartItem ? 'Add More' : 'Add to Cart'}
      </button>
    </article>
  );
}

function ReviewsSection({
  product,
  reviews,
  summary,
  onRate,
  rateLoading = false,
  feedback = '',
  myReview,
  helpfulReviewIds = [],
  helpfulBusyId = '',
  onHelpful,
  onReport,
  reviewHasMore = false,
  reviewsLoadingMore = false,
  onLoadMoreReviews,
}) {
  const [showAll, setShowAll] = useState(false);
  const [ratingFilter, setRatingFilter] = useState(0);
  const [sort, setSort] = useState('newest');
  const total = Number(summary?.total ?? product.numReviews ?? reviews.length ?? 0);
  const average = Number(summary?.average ?? product.rating ?? 0);
  const distribution = summary?.distribution || buildReviewSummary(reviews).distribution;
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
    <section className="mx-auto mt-4 max-w-2xl px-3 md:px-6" id="ratings-and-reviews">
      <div className="overflow-hidden rounded-[14px] bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-4">
          <div><h2 className="text-[14px] font-bold uppercase tracking-[.04em] text-charcoal md:text-xl">Ratings & reviews</h2><p className="mt-1 text-[10px] text-slate-500">Feedback from customers who bought this product</p></div>
          <button type="button" onClick={onRate} disabled={rateLoading} className="h-9 shrink-0 rounded-lg border border-[#ff3e6c] px-3 text-[10px] font-black uppercase tracking-[.03em] text-[#ff3e6c] disabled:border-slate-200 disabled:text-slate-300">{rateLoading ? 'Checking...' : myReview ? 'Edit review' : 'Rate product'}</button>
        </div>

        <div className="grid grid-cols-[100px_minmax(0,1fr)] gap-4 px-4 py-5">
          <div className="flex flex-col items-center justify-center border-r border-slate-100 pr-4 text-center">
            <div className="flex items-center gap-1 text-[30px] font-black leading-none text-charcoal">{average.toFixed(1)} <Star className="h-5 w-5 fill-emerald-600 text-emerald-600" /></div>
            <p className="mt-2 text-[10px] leading-4 text-slate-500">{total} rating{total === 1 ? '' : 's'}</p>
            {total > 0 && <p className="mt-2 text-[9px] font-bold text-emerald-600">{Number(summary?.recommendationPercentage || 0)}% rated 4★ or above</p>}
          </div>
          <div className="space-y-1.5">
            {[5, 4, 3, 2, 1].map((value) => {
              const count = Number(distribution?.[value] || 0);
              const percentage = total ? Math.round((count / total) * 100) : 0;
              return <button key={value} type="button" onClick={() => setRatingFilter((current) => current === value ? 0 : value)} className="grid w-full grid-cols-[22px_minmax(0,1fr)_24px] items-center gap-2 text-left" aria-label={`Show ${value} star reviews`}><span className="text-[10px] font-semibold text-slate-600">{value}★</span><span className="h-1.5 overflow-hidden rounded-full bg-slate-100"><span className={`block h-full rounded-full ${value >= 4 ? 'bg-emerald-500' : value === 3 ? 'bg-amber-400' : 'bg-[#ff6b81]'}`} style={{ width: `${percentage}%` }} /></span><span className="text-right text-[9px] text-slate-400">{count}</span></button>;
            })}
          </div>
        </div>

        {feedback && <p className="mx-4 mb-4 rounded-xl bg-[#fff3f6] px-3 py-3 text-[11px] font-semibold leading-4 text-[#c51b4d]" role="status">{feedback}</p>}
      </div>

      <div className="mt-3 rounded-[14px] bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div><h3 className="text-[13px] font-bold text-charcoal">Customer reviews</h3><p className="mt-1 text-[9px] text-slate-400">Showing {filteredReviews.length} review{filteredReviews.length === 1 ? '' : 's'}</p></div>
          <select value={sort} onChange={(event) => setSort(event.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-bold text-slate-600" aria-label="Sort reviews"><option value="newest">Most recent</option><option value="helpful">Most helpful</option><option value="highest">Highest rated</option><option value="lowest">Lowest rated</option></select>
        </div>

        <div className="hide-scrollbar -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
          {[0, 5, 4, 3, 2, 1].map((value) => <button key={value} type="button" onClick={() => { setRatingFilter(value); setShowAll(false); }} className={`min-w-max rounded-full border px-3 py-1.5 text-[10px] font-bold ${ratingFilter === value ? 'border-[#ff3e6c] bg-blush text-[#ff3e6c]' : 'border-slate-200 bg-white text-slate-500'}`}>{value ? `${value} ★ (${distribution?.[value] || 0})` : `All (${total})`}</button>)}
        </div>

        {visibleReviews.length ? (
          <div className="mt-2 divide-y divide-slate-100">
            {visibleReviews.map((review) => {
              const reviewId = String(review._id || '');
              const helpful = helpfulReviewIds.includes(reviewId);
              const isOwnReview = String(myReview?._id || '') === reviewId;
              return <PublicReviewCard key={reviewId} review={review} compact helpful={helpful} helpfulBusy={helpfulBusyId === reviewId} isOwnReview={isOwnReview} onHelpful={onHelpful} onReport={onReport} />;
            })}
          </div>
        ) : (
          <div className="py-10 text-center"><Star className="mx-auto h-8 w-8 text-slate-200" /><p className="mt-3 text-[12px] font-bold text-charcoal">{ratingFilter ? `No ${ratingFilter}-star reviews yet` : 'No customer reviews yet'}</p><p className="mt-1 text-[10px] text-slate-500">{ratingFilter ? 'Choose another rating to continue browsing.' : 'Delivered customers can be the first to review this product.'}</p></div>
        )}

        {filteredReviews.length > 6 && !showAll ? <button type="button" onClick={() => setShowAll(true)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 text-[11px] font-bold text-charcoal">View loaded reviews</button> : null}
        {showAll && reviewHasMore ? <button type="button" disabled={reviewsLoadingMore} onClick={onLoadMoreReviews} className="mt-2 h-11 w-full rounded-xl border border-slate-200 text-[11px] font-bold text-charcoal disabled:opacity-50">{reviewsLoadingMore ? 'Loading reviews...' : 'Load more reviews'}</button> : null}
        {showAll && filteredReviews.length > 6 ? <button type="button" onClick={() => setShowAll(false)} className="mt-2 h-10 w-full text-[10px] font-bold text-slate-500">Show fewer</button> : null}
      </div>
    </section>
  );
}

function ReviewReportModal({ review, onClose, onSubmit }) {
  const [reason, setReason] = useState('SPAM');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try { await onSubmit({ reason, details: details.trim() }); }
    catch (failure) { setError(failure.message || 'Unable to report this review.'); }
    finally { setBusy(false); }
  };
  return <div className="fixed inset-0 z-[100] grid place-items-end bg-black/50 sm:place-items-center sm:p-4"><form onSubmit={submit} role="dialog" aria-modal="true" aria-label="Report review" className="w-full rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-3xl"><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-black text-charcoal">Report this review</h2><p className="mt-1 text-xs text-slate-500">Our store team will check it. Reports do not remove reviews automatically.</p></div><button type="button" onClick={onClose} disabled={busy} aria-label="Close report form" className="grid h-9 w-9 place-items-center rounded-full bg-slate-50"><X className="h-4 w-4" /></button></div><p className="mt-4 line-clamp-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">{review.comment || review.title || `${review.rating} star review`}</p><label className="mt-4 block text-xs font-bold">Reason<select value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3"><option value="SPAM">Spam or promotion</option><option value="ABUSE">Abusive content</option><option value="PRIVACY">Personal information</option><option value="IRRELEVANT">Not about this product</option><option value="OTHER">Something else</option></select></label><label className="mt-4 block text-xs font-bold">Additional details <span className="font-normal text-slate-400">(optional)</span><textarea value={details} maxLength={500} onChange={(event) => setDetails(event.target.value)} className="mt-2 min-h-24 w-full resize-none rounded-xl border border-slate-200 p-3 text-xs" /></label>{error ? <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-600">{error}</p> : null}<button type="submit" disabled={busy} className="mt-4 h-12 w-full rounded-xl bg-wine text-sm font-black text-white disabled:opacity-50">{busy ? 'Sending report...' : 'Submit report'}</button></form></div>;
}

const colorSwatches = {
  Wine: '#6d1f34',
  Blush: '#f8b7c8',
  Gold: '#b8914a',
  Ivory: '#f3ead7',
  Black: '#17161a',
  Emerald: '#0f6b52',
  Navy: '#1e3a8a',
  Rose: '#ff5f86',
  Blue: '#9ec5ff',
  Pink: '#f3a4be',
};

function formatRupees(value) {
  return `₹${Math.max(0, Number(value || 0)).toLocaleString('en-IN')}`;
}

function formatManagedVariant(variant = {}) {
  const values = Object.values(variant.optionValues || {}).map((value) => String(value || '').trim()).filter(Boolean);
  return values.join(' · ') || [variant.size, variant.color].filter(Boolean).join(' · ') || variant.sku || 'Product option';
}

function buildReviewSummary(reviews = []) {
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let weightedTotal = 0;
  let total = 0;
  reviews.forEach((review) => {
    const rawRating = Number(review?.rating);
    if (!Number.isFinite(rawRating) || rawRating < 1 || rawRating > 5) return;
    const rating = Math.round(rawRating);
    distribution[rating] += 1;
    weightedTotal += rating;
    total += 1;
  });
  return {
    average: total ? Math.round((weightedTotal / total) * 10) / 10 : 0,
    total,
    distribution,
    recommendationPercentage: total ? Math.round(((distribution[4] + distribution[5]) / total) * 100) : 0,
  };
}

function formatWhatsappNumber(value = '') {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length >= 12) return digits.slice(-10);
  return digits.slice(-10);
}
