import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Check, ChevronLeft, ChevronRight, Gem, RotateCcw, ShieldCheck, Sparkles, Star, Truck } from 'lucide-react';
import { useMediaQuery } from '@mantine/hooks';
import Icon from '../../components/layout/Icon';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import PageState from '../../components/ui/PageState';
import StorefrontSkeleton from '../../components/ui/StorefrontSkeleton';
import { getPrimaryImageUrl, normalizeImageUrl, normalizeProducts } from '../../services/normalize';
import { samiraApi, useGetBannersQuery, useGetCategoriesQuery, useGetFeaturedReviewsQuery, useGetMobileHomeQuery, useGetProductsQuery } from '../../store/apiSlice';
import { useWebsiteCustomization } from '../../context/WebsiteCustomizationContext';
import { getHomepageSection } from '../../config/websiteCustomization';
import { isUnavailable, wishlistStock } from '../../utils/wishlist';
import { useBrandIdentity } from '../../context/BrandIdentityContext';
import StorefrontBannerSlot, { bannersForHero, bannersForPosition, openBanner, useBannerEngagement } from '../../components/banners/StorefrontBannerSlot';
import StorefrontCustomBlocks from '../../components/storefront/StorefrontCustomBlocks';
import { getSelectableSizes } from '../../utils/productSizing';
import { trackEvent } from '../../utils/analytics';
import { clearRecentProducts } from '../../utils/recentProducts';
import useShoppingDiscovery from '../../hooks/useShoppingDiscovery';
import ShoppingShortcuts from '../../components/storefront/ShoppingShortcuts';

const DesktopLuxuryHome = lazy(() => import('./DesktopLuxuryHome'));
const emptyList = [];
const SHARED_HOME_SECTIONS = new Set(['services', 'reviews', 'newsletter', 'instagram', 'recentlyViewed', 'recommended']);
const MOBILE_SHARED_HOME_SECTIONS = new Set(['services', 'instagram', 'recentlyViewed', 'recommended', 'shoppingShortcuts']);
const INDUSTRY_SECTION_ALIASES = {
  sale: ['offers'],
  promotional: ['wedding', 'artistSpotlight', 'todaySpecial', 'customOrders'],
};

function applyIndustryHomepageVisibility(config, industry, configuredSections) {
  if (!config || industry === 'fashion' || !Array.isArray(configuredSections) || !configuredSections.length) return config;
  const enabled = new Set(configuredSections);
  const isAllowed = (id, mobile = false) => (mobile ? MOBILE_SHARED_HOME_SECTIONS : SHARED_HOME_SECTIONS).has(id)
    || enabled.has(id)
    || (INDUSTRY_SECTION_ALIASES[id] || []).some((alias) => enabled.has(alias));
  const restrict = (sections = [], mobile = false) => sections.map((section) => ({
    ...section,
    visible: section.visible !== false && isAllowed(section.id, mobile),
  }));
  return {
    ...config,
    homepage: { ...config.homepage, sections: restrict(config.homepage?.sections) },
    mobile: { ...config.mobile, sections: restrict(config.mobile?.sections, true) },
  };
}

function isIndustryHomepageSectionAllowed(industry, configuredSections, id) {
  if (industry === 'fashion' || !Array.isArray(configuredSections) || !configuredSections.length) return true;
  const enabled = new Set(configuredSections);
  return MOBILE_SHARED_HOME_SECTIONS.has(id)
    || enabled.has(id)
    || (INDUSTRY_SECTION_ALIASES[id] || []).some((alias) => enabled.has(alias));
}

function industryLabel(industry) {
  const labels = { mobile: 'mobile', electronics: 'electronics', jewellery: 'jewellery', cosmetics: 'beauty', art: 'art', bakery: 'bakery', footwear: 'footwear', home: 'home & decor' };
  return labels[industry] || 'product';
}

export default function Home({ navigate, storeSlug = '', industry = 'fashion', industrySections = [] }) {
  const isDesktop = useMediaQuery('(min-width: 1024px)', false, { getInitialValueInEffect: false });
  const isTablet = useMediaQuery('(min-width: 768px)', false, { getInitialValueInEffect: false });
  const { config: baseWebsiteConfig } = useWebsiteCustomization();
  const websiteConfig = useMemo(
    () => applyIndustryHomepageVisibility(baseWebsiteConfig, industry, industrySections),
    [baseWebsiteConfig, industry, industrySections],
  );
  const mobileCustom = websiteConfig.mobile.enabled && !isTablet;
  const mobileLayoutSection = (id) => websiteConfig.mobile.sections.find((section) => section.id === id) || null;
  const mobileSection = (id) => mobileCustom ? mobileLayoutSection(id) : null;
  const { data: discovery, recentIds } = useShoppingDiscovery(storeSlug);
  const prefetchProduct = samiraApi.usePrefetch('getProduct', { ifOlderThan: 60 });
  const mobileFeedQuery = useGetMobileHomeQuery(
    { store: storeSlug, ...(recentIds.length ? { recent: recentIds.join(',') } : {}) },
    { skip: isDesktop },
  );
  const useLegacyMobileFeed = !isDesktop && mobileFeedQuery.isError
    && [404, 501].includes(Number(mobileFeedQuery.error?.status));
  // Keep the existing public APIs as a compatibility path while an older
  // backend deployment catches up with the combined mobile-home endpoint.
  // Do not multiply traffic when a server is slow/offline or rate-limiting us.
  const mobileFallbackProductsQuery = useGetProductsQuery(
    { store: storeSlug, page: 1, limit: 60, silent: true },
    { skip: !useLegacyMobileFeed },
  );
  const mobileFallbackCategoriesQuery = useGetCategoriesQuery(
    { store: storeSlug, silent: true },
    { skip: !useLegacyMobileFeed },
  );
  const mobileFallbackBannersQuery = useGetBannersQuery(
    { store: storeSlug, silent: true },
    { skip: !useLegacyMobileFeed },
  );
  const desktopProductsQuery = useGetProductsQuery({ store: storeSlug, page: 1, limit: 60 }, { skip: !isDesktop });
  const desktopCategoriesQuery = useGetCategoriesQuery({ store: storeSlug }, { skip: !isDesktop });
  const desktopBannersQuery = useGetBannersQuery({ store: storeSlug }, { skip: !isDesktop });
  const mobileFeed = mobileFeedQuery.currentData || {};
  const productData = isDesktop
    ? (desktopProductsQuery.data?.items || desktopProductsQuery.data || emptyList)
    : useLegacyMobileFeed ? (mobileFallbackProductsQuery.data?.items || mobileFallbackProductsQuery.data || emptyList) : (mobileFeed.products || emptyList);
  const categories = isDesktop
    ? (desktopCategoriesQuery.data || emptyList)
    : useLegacyMobileFeed ? (mobileFallbackCategoriesQuery.data || emptyList) : (mobileFeed.categories || emptyList);
  const banners = isDesktop
    ? (desktopBannersQuery.data || emptyList)
    : useLegacyMobileFeed ? (mobileFallbackBannersQuery.data || emptyList) : (mobileFeed.banners || emptyList);
  const settings = mobileFeed.settings || {};
  const feedWarnings = new Set(mobileFeed.warnings || []);
  const productFeedWarning = (mobileFeed.warnings || []).some((warning) => String(warning).startsWith('products.'));
  const fallbackLoading = useLegacyMobileFeed && [mobileFallbackProductsQuery, mobileFallbackCategoriesQuery, mobileFallbackBannersQuery]
    .some((query) => query.isLoading);
  const fallbackUnavailable = useLegacyMobileFeed && [mobileFallbackProductsQuery, mobileFallbackCategoriesQuery, mobileFallbackBannersQuery]
    .every((query) => query.isError);
  const isLoading = isDesktop ? desktopProductsQuery.isLoading : mobileFeedQuery.isLoading
    || (mobileFeedQuery.isFetching && !mobileFeedQuery.currentData) || fallbackLoading;
  const isError = isDesktop ? desktopProductsQuery.isError : useLegacyMobileFeed ? fallbackUnavailable : mobileFeedQuery.isError;
  const refetch = isDesktop ? desktopProductsQuery.refetch : () => {
    const requests = [mobileFeedQuery.refetch?.()];
    if (useLegacyMobileFeed) requests.push(
      mobileFallbackProductsQuery.refetch?.(),
      mobileFallbackCategoriesQuery.refetch?.(),
      mobileFallbackBannersQuery.refetch?.(),
    );
    return Promise.allSettled(requests.filter(Boolean));
  };
  const reviewsSection = getHomepageSection(websiteConfig, 'reviews');
  const { data: desktopReviews = emptyList } = useGetFeaturedReviewsQuery({ store: storeSlug }, { skip: !isDesktop || !reviewsSection.visible });
  const customerReviews = desktopReviews;
  const catalog = useMemo(() => normalizeProducts(productData || emptyList), [productData]);
  const heroBanners = bannersForHero(banners);
  const promoBanner = banners.find((banner) => ['Offer', 'Category', 'Sale', 'Hero'].includes(banner.type));
  const middleBanners = bannersForPosition(banners, 'Home - Middle', ['Offer', 'Category', 'Sale']);
  const mobileCustomBlocks = useMemo(
    () => (websiteConfig.homepage.blocks || []).filter((block) => !['newsletter', 'reviews'].includes(block.type)),
    [websiteConfig.homepage.blocks],
  );

  const localCollections = useMemo(() => ({
    featured: catalog.filter((product) => product.isFeatured || product.showOnHomepage).slice(0, 12),
    trending: catalog.filter((product) => product.showInTrending).slice(0, 12),
    newArrivals: catalog.filter((product) => product.isNewArrival).slice(0, 12),
    bestSellers: catalog.filter((product) => product.isBestSeller).slice(0, 12),
    instagram: catalog.filter((product) => getPrimaryImageUrl(product.images)).slice(0, 12),
    ethnicSets: catalog.filter((product) => matchesCollection(product, ['ethnic', 'set', 'suit', 'kurti', 'lehenga', 'saree'])).slice(0, 12),
    accessories: catalog.filter((product) => matchesCollection(product, ['accessory', 'accessories', 'jewellery', 'jewelry', 'earring', 'necklace', 'bracelet', 'bag'])).slice(0, 12),
  }), [catalog]);
  const collections = useMemo(() => {
    if (isDesktop || !mobileFeed.collections) return localCollections;
    return Object.fromEntries(Object.entries({ ...localCollections, ...mobileFeed.collections })
      .map(([key, products]) => [key, normalizeProducts(products || emptyList)]));
  }, [isDesktop, localCollections, mobileFeed.collections]);
  const { featured: featuredProducts, trending: trendingProducts, newArrivals: newArrivalProducts,
    instagram: instagramProducts, ethnicSets: ethnicSetProducts, accessories: accessoryProducts } = collections;
  const catalogById = useMemo(() => new Map(catalog.map((product) => [String(product._id || product.id || product.slug), product])), [catalog]);
  const configured = useMemo(() => Object.fromEntries(
    Object.entries(websiteConfig.homepage.sectionProductIds || {}).map(([id, ids]) =>
      [id, ids.length ? ids.map((productId) => catalogById.get(String(productId))).filter(Boolean).slice(0, 12) : null]),
  ), [catalogById, websiteConfig.homepage.sectionProductIds]);
  const selectConfiguredProducts = (id, fallback) => configured[id]?.length ? configured[id] : fallback;
  const desktopFeaturedProducts = selectConfiguredProducts('featured', featuredProducts);
  const desktopTrendingProducts = selectConfiguredProducts('trending', trendingProducts);
  const desktopNewArrivalProducts = selectConfiguredProducts('newArrivals', newArrivalProducts);
  const desktopBestSellerProducts = selectConfiguredProducts('bestSellers', collections.bestSellers);
  const desktopEthnicSetProducts = selectConfiguredProducts('ethnicSets', ethnicSetProducts);
  const desktopAccessoryProducts = selectConfiguredProducts('accessories', accessoryProducts);
  const themedCategories = useMemo(() => {
    const overrides = new Map((websiteConfig.homepage.categoryImages || []).map((item) => [String(item.categoryId), item.image]));
    const ids = websiteConfig.homepage.featuredCategoryIds || [];
    const byId = new Map(categories.map((category) => [String(category._id || category.id || category.slug), category]));
    const selected = ids.map((id) => byId.get(String(id))).filter(Boolean);
    const selectedIds = new Set(selected.map((category) => String(category._id || category.id || category.slug)));
    const ordered = ids.length ? [...selected, ...categories.filter((category) => !selectedIds.has(String(category._id || category.id || category.slug)))] : categories;
    return ordered
      .map((category) => ({ ...category, image: overrides.get(String(category._id || category.id || category.slug)) || category.image }));
  }, [categories, websiteConfig.homepage.categoryImages, websiteConfig.homepage.featuredCategoryIds]);
  const maxDiscount = useMemo(() => catalog.reduce((maximum, product) => Math.max(maximum, Number(product.discountPercentage || 0)), 0), [catalog]);
  const mobileProductSections = dedupeMobileProductSections([
    { id: 'featured', eyebrow: 'Featured', title: 'Handpicked for you', products: collections.featured, viewAllPath: '/products?featured=true' },
    { id: 'trending', eyebrow: 'Trending Now', title: 'Fast-moving styles', products: collections.trending.length ? collections.trending : collections.featured, viewAllPath: '/products?trending=true&collection=trending-now' },
    { id: 'newArrivals', eyebrow: 'New Arrivals', title: 'Fresh drops this week', products: collections.newArrivals.length ? collections.newArrivals : collections.latest || collections.featured, viewAllPath: '/products?newArrival=true&collection=new-arrivals' },
    { id: 'bestSellers', eyebrow: 'Best Sellers', title: 'Customer favourites', products: collections.bestSellers, viewAllPath: '/products?bestSeller=true' },
    { id: 'ethnicSets', eyebrow: 'Ethnic Sets', title: 'Complete occasion-ready looks', products: collections.ethnicSets, viewAllPath: '/products?search=Set' },
    { id: 'accessories', eyebrow: 'Accessories', title: 'Finishing touches', products: collections.accessories, viewAllPath: '/products?search=Accessory' },
    { id: 'recentlyViewed', eyebrow: 'Recently Viewed', title: 'Continue where you left off', products: settings.recentlyViewedEnabled === false || discovery?.recentlyViewedEnabled === false || !recentIds.length ? [] : normalizeProducts(discovery?.recentlyViewed || collections.recentlyViewed || []), viewAllPath: '/products' },
    { id: 'recommended', eyebrow: 'Recommended', title: 'Top-rated picks for you', products: collections.recommended?.length ? collections.recommended : collections.bestSellers, viewAllPath: '/products?sort=rating' },
    { id: 'instagram', eyebrow: 'Style Inspiration', title: 'Discover the latest edit', products: collections.instagram, viewAllPath: '/products' },
  ].map((entry) => ({
    ...entry,
    products: entry.id !== 'recentlyViewed' && mobileCustom && websiteConfig.mobile.useDesktopCatalog
      ? selectConfiguredProducts(entry.id, entry.products)
      : entry.products,
    order: mobileSection(entry.id)?.order ?? 999,
  })));

  useEffect(() => {
    const track = () => trackEvent('STORE_VIEW', { metadata: { surface: isDesktop ? 'desktop-home' : 'mobile-home' } });
    track();
    window.addEventListener('store:traffic-privacy', track);
    return () => window.removeEventListener('store:traffic-privacy', track);
  }, [isDesktop, storeSlug]);

  useEffect(() => {
    if (isDesktop || typeof window === 'undefined') return undefined;
    const sent = new Set();
    let scheduled = false;
    const measure = () => {
      scheduled = false;
      const height = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0);
      if (!height) return;
      const percent = Math.min(100, Math.round(((window.scrollY + window.innerHeight) / height) * 100));
      [25, 50, 75, 100].forEach((milestone) => {
        if (percent < milestone || sent.has(milestone)) return;
        sent.add(milestone);
        trackEvent('HOME_SCROLL', { metadata: { milestone, surface: 'mobile-home' } });
      });
    };
    const onScroll = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isDesktop]);

  if (isLoading && !catalog.length) {
    return isDesktop
      ? <section className="container-page py-10"><PageState loading loadingLabel="Loading the collection..." /></section>
      : <StorefrontSkeleton />;
  }

  if (isError && !catalog.length) {
    return isDesktop
      ? <section className="container-page py-10"><PageState error="Unable to load the store right now." onRetry={refetch} /></section>
      : <MobileHomeError onRetry={refetch} />;
  }

  return (
    <>
      {!isDesktop && <div className={`mobile-home flex flex-col bg-ivory ${mobileCustom ? 'mobile-home--custom' : ''}`}>
        {isError && <MobileSectionNotice message="Showing your last loaded collection. Refresh when your connection improves." onRetry={refetch} />}
        {settings.acceptingOrders === false && <MobileOrderPause message={settings.orderPauseMessage} />}
        {productFeedWarning && <MobileSectionNotice message="Some product collections could not be refreshed." onRetry={refetch} />}
        {[
          ['hero', <MobileHero banners={heroBanners.length ? heroBanners : (promoBanner ? [promoBanner] : [])} heading={mobileSection('hero')?.heading} section={mobileCustom ? getHomepageSection(websiteConfig, 'hero') : null} navigate={navigate} industry={industry} offerLabel={maxDiscount > 0 ? `Up to ${maxDiscount}% off` : 'Fresh arrivals'} />],
          ['services', <MobileServices settings={settings} heading={mobileSection('services')?.heading} />],
          ['categories', feedWarnings.has('categories')
            ? <MobileSectionNotice message="Categories could not be loaded." onRetry={refetch} />
            : <MobileCategoryScroller heading={mobileSection('categories')?.heading} categories={mobileCustom && websiteConfig.mobile.useDesktopCatalog ? themedCategories : categories} navigate={navigate} />],
          ['shoppingShortcuts', discovery && <ShoppingShortcuts data={discovery} navigate={navigate} />],
          ['sale', feedWarnings.has('banners')
            ? <MobileSectionNotice message="Current offers could not be loaded." onRetry={refetch} />
            : bannersForPosition(banners, 'Offer Strip').length
              ? <StorefrontBannerSlot banners={banners} position="Offer Strip" navigate={navigate} compact />
              : maxDiscount > 0 ? <MobileOfferStrip navigate={navigate} maxDiscount={maxDiscount} heading={mobileSection('sale')?.heading} /> : null],
          ['promotional', middleBanners.length ? <MobileEditorialBanners heading={mobileSection('promotional')?.heading} banners={middleBanners} navigate={navigate} /> : null],
          ...mobileProductSections.map((entry) => [entry.id, entry.products.length ? <MobileProductSection
            sectionId={entry.id}
            eyebrow={entry.eyebrow}
            title={mobileSection(entry.id)?.heading || entry.title}
            products={entry.products}
            navigate={navigate}
            viewAllPath={entry.viewAllPath}
            acceptingOrders={settings.acceptingOrders !== false}
            prefetchProduct={(productId) => prefetchProduct({ id: productId, store: storeSlug, silent: true })}
            onClear={entry.id === 'recentlyViewed' ? () => clearRecentProducts(storeSlug) : undefined}
          /> : null]),
        ].filter(([id, content]) => content && mobileSection(id)?.visible !== false && isIndustryHomepageSectionAllowed(industry, industrySections, id))
          .map(([id, content]) => <MobileSection key={id} id={id} section={id === 'shoppingShortcuts' ? { order: (mobileLayoutSection('categories')?.order ?? 20) + 1 } : mobileLayoutSection(id)} storeSlug={storeSlug}>{content}</MobileSection>)}
        <StorefrontCustomBlocks blocks={mobileCustomBlocks} catalog={catalog} categories={themedCategories} navigate={navigate} mobile storeSlug={storeSlug} />
      </div>}

      {isDesktop && (
        <Suspense fallback={<section className="container-page min-h-[560px] py-10"><PageState loading loadingLabel="Loading the collection..." /></section>}>
        <StorefrontBannerSlot banners={banners} position="Offer Strip" navigate={navigate} compact className="max-w-[1500px]" />
        <DesktopLuxuryHome
          navigate={navigate}
          categories={themedCategories}
          banners={banners}
          catalog={catalog}
          featuredProducts={desktopFeaturedProducts}
          trendingProducts={desktopTrendingProducts}
          newArrivalProducts={desktopNewArrivalProducts}
          bestSellerProducts={desktopBestSellerProducts}
          instagramProducts={instagramProducts}
          ethnicSetProducts={desktopEthnicSetProducts}
          accessoryProducts={desktopAccessoryProducts}
          websiteConfig={websiteConfig}
          industry={industry}
          customerReviews={customerReviews}
          storeSlug={storeSlug}
          discovery={discovery}
        />
        </Suspense>
      )}
      <StorefrontBannerSlot banners={banners} position="Home - Bottom" navigate={navigate} className="max-w-[1500px]" />
    </>
  );
}

function MobileSection({ id, section, storeSlug, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;
    const storageKey = `samira_home_section_v1:${storeSlug || 'default'}:${id}`;
    try { if (sessionStorage.getItem(storageKey) === '1') return undefined; } catch { /* optional */ }
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.35)) return;
      try { sessionStorage.setItem(storageKey, '1'); } catch { /* optional */ }
      trackEvent('HOME_SECTION_VIEW', { metadata: { sectionId: id, surface: 'mobile-home' } });
      observer.disconnect();
    }, { threshold: [0.35] });
    observer.observe(node);
    return () => observer.disconnect();
  }, [id, storeSlug]);
  return <div ref={ref} data-home-section={id} style={section ? { order: section.order } : undefined}>{children}</div>;
}

function MobileHero({ banners = [], heading, section, navigate, industry = 'fashion', offerLabel }) {
  const brand = useBrandIdentity();
  const slides = banners.length ? banners : [{}];
  const [slideIndex, setSlideIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const banner = slides[slideIndex % slides.length] || {};
  const engagementRef = useBannerEngagement(banner);
  const fashion = industry === 'fashion';
  const configuredImage = section?.mobileImage || section?.image;
  const bannerImage = banner?.mobileImage || banner?.image;
  const heroImage = normalizeImageUrl(bannerImage || configuredImage);
  const heroAlt = bannerImage
    ? banner?.altText || banner?.title || 'Featured collection'
    : section?.imageAlt || 'Featured collection';
  const heroImagePosition = bannerImage ? banner?.focalPoint || 'center' : section?.imagePosition || 'center';

  useEffect(() => {
    setSlideIndex((current) => current % slides.length);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length < 2 || paused || prefersReducedMotion()) return undefined;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') setSlideIndex((current) => (current + 1) % slides.length);
    }, 5200);
    return () => window.clearInterval(timer);
  }, [paused, slides.length]);

  const move = (direction) => setSlideIndex((current) => (current + direction + slides.length) % slides.length);
  return (
    <section
      ref={engagementRef}
      className="relative px-3 pb-4 pt-3"
      aria-label="Featured offers"
      aria-roledescription="carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}
    >
      <button
        type="button"
        onClick={() => section?.buttonLink ? navigate(section.buttonLink) : banner?._id ? openBanner(banner, navigate) : navigate('/products')}
        className="relative block min-h-[190px] w-full overflow-hidden rounded-[18px] bg-gradient-to-r from-blush via-ivory to-[#f6ddcf] text-left shadow-[0_8px_24px_rgba(122,31,54,0.10)]"
        aria-label={`${banner?.title || heading || 'Featured collection'}${slides.length > 1 ? `, slide ${(slideIndex % slides.length) + 1} of ${slides.length}` : ''}`}
      >
        {heroImage && <img src={heroImage} alt={heroAlt} loading="eager" fetchPriority="high" decoding="async" sizes="100vw" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: heroImagePosition }} />}
        <span className="absolute inset-0 bg-gradient-to-r from-ivory/95 via-ivory/82 to-[#4b1b2a]/10" />
        <div className="relative flex min-h-[190px] items-center px-5 py-5">
          <div className="min-w-0 max-w-[72%]">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-wine">{fashion ? 'New festive collection' : `New ${industryLabel(industry)} collection`}</p>
            <h1 className="mt-2 text-[20px] font-semibold leading-[1.12] text-wine">
              {heading || section?.heading || banner?.title || 'Celebrate in Style'}
            </h1>
            <p className="mt-1.5 max-w-[190px] text-[12px] leading-[1.35] text-theme-muted">
              {section?.description || banner?.subtitle || (fashion ? 'Elegant sarees, suits & kurtis for every occasion.' : `Discover quality ${industryLabel(industry).toLowerCase()} products selected for you.`)}
            </p>
            <div className="mt-3 inline-flex items-center rounded-full border border-theme-border bg-white/90 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-wine">
              {offerLabel}
            </div>
            <div className="mt-3">
              <span className="inline-flex h-9 items-center rounded-[8px] bg-wine px-4 text-[10px] font-bold uppercase tracking-[0.08em] text-white">
                {section?.buttonText || 'Shop Now'}
              </span>
            </div>
          </div>
          {!heroImage && <span className="absolute bottom-4 right-4 max-w-[28%] text-right font-display text-lg font-black leading-tight text-wine/70">{brand.websiteName}</span>}
        </div>
      </button>
      {slides.length > 1 && <>
        <button type="button" onClick={() => move(-1)} aria-label="Previous featured offer" className="absolute left-5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-white/70 bg-white/90 text-wine shadow-md"><ChevronLeft className="h-4 w-4" /></button>
        <button type="button" onClick={() => move(1)} aria-label="Next featured offer" className="absolute right-5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-white/70 bg-white/90 text-wine shadow-md"><ChevronRight className="h-4 w-4" /></button>
        <div className="absolute bottom-7 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/20 px-2 py-1" aria-label="Choose featured offer">
          {slides.map((slide, index) => <button key={slide._id || slide.id || index} type="button" onClick={() => setSlideIndex(index)} aria-label={`Show featured offer ${index + 1}`} aria-current={index === slideIndex % slides.length ? 'true' : undefined} className={`h-1.5 rounded-full transition-all ${index === slideIndex % slides.length ? 'w-5 bg-white' : 'w-1.5 bg-white/60'}`} />)}
        </div>
      </>}
    </section>
  );
}

function MobileServices({ settings, heading }) {
  const policiesAvailable = settings?.available !== false;
  const freeThreshold = Math.max(0, Number(settings?.freeShippingMinAmount ?? 999));
  const paymentTypes = [settings?.upiEnabled, settings?.cardPaymentEnabled, settings?.netBankingEnabled, settings?.walletEnabled, settings?.razorpayEnabled].filter(Boolean).length;
  const highlights = [
    !policiesAvailable
      ? { icon: Truck, title: 'Delivery', subtitle: 'Checked at checkout' }
      : settings?.shippingFreeAboveEnabled === false
      ? { icon: Truck, title: 'Delivery', subtitle: Number(settings?.deliveryCharge) > 0 ? `From ₹${Number(settings.deliveryCharge).toLocaleString('en-IN')}` : 'Calculated at checkout' }
      : { icon: Truck, title: 'Free Shipping', subtitle: freeThreshold > 0 ? `Above ₹${freeThreshold.toLocaleString('en-IN')}` : 'On all orders' },
    { icon: Gem, title: 'Quality Checked', subtitle: 'Carefully selected' },
    !policiesAvailable
      ? { icon: RotateCcw, title: 'Returns', subtitle: 'See product policy' }
      : settings?.returnsEnabled === false
      ? { icon: RotateCcw, title: 'Final Sale', subtitle: 'Check product policy' }
      : { icon: RotateCcw, title: 'Easy Returns', subtitle: `${Math.max(1, Number(settings?.returnWindowDays || 7))}-day window` },
    { icon: ShieldCheck, title: 'Secure Payment', subtitle: !policiesAvailable ? 'Options at checkout' : paymentTypes ? `${settings?.codEnabled !== false ? 'Prepaid & COD' : 'Prepaid options'}` : settings?.codEnabled !== false ? 'Cash on delivery' : 'At checkout' },
  ];
  return (
    <section className="px-3 pb-4" aria-labelledby={heading ? 'mobile-services-heading' : undefined} aria-label={heading ? undefined : 'Store services'}>
      {heading && <h2 id="mobile-services-heading" className="mb-3 text-[16px] font-bold text-charcoal">{heading}</h2>}
      <div className="grid grid-cols-4 gap-2 rounded-[16px] bg-white px-2.5 py-3.5 shadow-[0_6px_18px_rgba(15,23,42,0.04)]">
        {highlights.map(({ icon: IconComp, title, subtitle }) => (
          <div key={title} className="flex flex-col items-center text-center">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-blush text-wine">
              <IconComp className="h-4.5 w-4.5" strokeWidth={1.9} />
            </div>
            <p className="mt-2 text-[11px] font-semibold leading-3 text-charcoal">{title}</p>
            <p className="mt-1 text-[9px] leading-3 text-slate-400">{subtitle}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function MobileCategoryScroller({ categories, navigate, heading }) {
  const visibleCategories = categories || [];

  return (
    <section className="px-3 pb-4" aria-labelledby="mobile-categories-heading">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 id="mobile-categories-heading" className="text-[15px] font-bold text-charcoal">{heading || 'Shop by category'}</h2>
        </div>
        <button type="button" onClick={() => { trackEvent('HOME_VIEW_ALL', { metadata: { sectionId: 'categories' } }); navigate('/category'); }} className="inline-flex min-h-11 items-center gap-1 px-1 text-[11px] font-bold uppercase tracking-[0.08em] text-theme-muted">
          View all
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
      {visibleCategories.length ? <div className="hide-scrollbar flex gap-3.5 overflow-x-auto pb-1" role="region" aria-label="Product categories">
        {visibleCategories.map((category) => {
          const categoryId = category._id || category.id || category.slug || '';
          return (
            <button
              key={categoryId || category.name}
              type="button"
              onClick={() => { trackEvent('HOME_CATEGORY_CLICK', { metadata: { categoryId: String(categoryId), categoryName: category.name } }); navigate(`/products?category=${encodeURIComponent(categoryId)}`); }}
              className="min-w-[72px] max-w-[72px] text-center"
            >
              <div className="mx-auto flex h-[60px] w-[60px] items-center justify-center overflow-hidden rounded-full bg-blush ring-1 ring-[#f0dfd3]">
                {category.image ? (
                  <img loading="lazy" decoding="async" src={normalizeImageUrl(category.image)} alt={category.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[11px] font-bold uppercase tracking-[0.04em] text-wine">{category.name?.slice(0, 2)}</span>
                )}
              </div>
              <p className="mt-2 truncate text-[11px] font-medium text-charcoal">{category.name}</p>
            </button>
          );
        })}
      </div> : <div className="rounded-[14px] border border-theme-border bg-white px-4 py-5 text-center text-[12px] font-semibold text-slate-500">Categories will appear here when they are published.</div>}
    </section>
  );
}

function MobileOfferStrip({ navigate, maxDiscount, heading }) {
  return (
    <section className="px-3 pb-4">
      <button
        type="button"
        onClick={() => { trackEvent('HOME_VIEW_ALL', { metadata: { sectionId: 'sale' } }); navigate('/products?discount=1'); }}
        className="flex w-full items-center justify-between rounded-[14px] bg-gradient-to-r from-blush via-[#fff8fb] to-[#fdf2e8] px-4 py-3.5 text-left shadow-[0_6px_18px_rgba(122,31,54,0.05)]"
      >
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-white text-wine shadow-sm">
            <Sparkles className="h-4.5 w-4.5" strokeWidth={2} />
          </div>
          <div>
            <p className="text-[12px] font-semibold text-charcoal">{heading || 'Current offers'}</p>
            <p className="mt-0.5 text-[10px] text-theme-muted">Save up to {maxDiscount}% on selected products</p>
          </div>
        </div>
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-wine">Shop now</span>
      </button>
    </section>
  );
}

function MobileEditorialBanners({ banners, navigate, heading }) {
  const cards = (banners || []).slice(0, 3);
  if (!cards.length) return null;

  return (
    <section className="px-3 pb-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-bold text-charcoal">{heading || 'Featured collections'}</h2>
        </div>
        <button type="button" onClick={() => { trackEvent('HOME_VIEW_ALL', { metadata: { sectionId: 'promotional' } }); navigate('/products'); }} className="inline-flex min-h-11 items-center gap-1 px-1 text-[10px] font-bold uppercase tracking-[0.08em] text-theme-muted">
          View all
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="hide-scrollbar -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1" role="region" aria-label="Featured collections">
        {cards.map((banner, index) => <MobileBannerCard key={banner._id || banner.title || index} banner={banner} navigate={navigate} />)}
      </div>
    </section>
  );
}

function MobileBannerCard({ banner, navigate }) {
  const ref = useBannerEngagement(banner);
  return <button ref={ref} type="button" onClick={() => openBanner(banner, navigate)} className="relative min-w-[78%] snap-center overflow-hidden rounded-[16px] bg-[#f4e9e0] text-left shadow-[0_6px_16px_rgba(15,23,42,0.05)] first:snap-start last:snap-end">
    <div className="aspect-[0.92]">{banner.image ? <picture><source media="(max-width: 639px)" srcSet={normalizeImageUrl(banner.mobileImage || banner.image)} /><img loading="lazy" decoding="async" src={normalizeImageUrl(banner.image)} alt={banner.altText || banner.title || 'Collection'} className="h-full w-full object-cover" style={{ objectPosition: banner.focalPoint || 'center' }} /></picture> : <div className="flex h-full items-end bg-gradient-to-br from-[#f7e8de] to-[#ecd2c4] p-3"><span className="text-[11px] font-semibold text-wine">{banner.title || 'Jassi edit'}</span></div>}</div>
    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#3f2731]/85 via-[#3f2731]/25 to-transparent px-2.5 py-2"><p className="line-clamp-2 text-[10px] font-semibold leading-3 text-white">{banner.title || 'Featured collection'}</p></div>
  </button>;
}

function MobileProductSection({ sectionId, eyebrow, title, products = [], navigate, viewAllPath, acceptingOrders = true, prefetchProduct, emptyMessage = '', onClear }) {
  return (
    <section className="px-3 pb-5" aria-labelledby={`mobile-section-${sectionId}`}>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-wine">{eyebrow}</p>
          <h2 id={`mobile-section-${sectionId}`} className="mt-0.5 text-[18px] font-bold leading-tight text-charcoal">{title}</h2>
        </div>
        <button type="button" onClick={() => { if (onClear) { onClear(); return; } trackEvent('HOME_VIEW_ALL', { metadata: { sectionId } }); navigate(viewAllPath || '/products'); }} className="inline-flex min-h-11 items-center gap-1 px-1 text-[10px] font-bold uppercase tracking-[0.08em] text-theme-muted">
          {onClear ? 'Clear history' : 'View all'}
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
      {products.length ? (
        <MobileCompactProductGrid products={products} navigate={navigate} title={title} sectionId={sectionId} acceptingOrders={acceptingOrders} prefetchProduct={prefetchProduct} />
      ) : (
        <div className="rounded-[14px] border border-theme-border bg-white px-4 py-5 text-center shadow-[0_6px_18px_rgba(15,23,42,0.04)]">
          <p className="text-[12px] font-semibold leading-5 text-slate-500">{emptyMessage || `No ${eyebrow.toLowerCase()} are published yet.`}</p>
          <button type="button" onClick={() => navigate('/products')} className="mt-3 text-[11px] font-bold uppercase tracking-[0.08em] text-wine">Browse all products</button>
        </div>
      )}
    </section>
  );
}

function matchesCollection(product, terms) {
  const text = [product?.name, product?.category, product?.subCategory, product?.description, ...(product?.tags || [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return terms.some((term) => text.includes(term));
}

function MobileCompactProductGrid({ products, navigate, title, sectionId, acceptingOrders, prefetchProduct }) {
  return (
    <div className="mobile-home-product-grid hide-scrollbar -mx-0.5 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2" role="region" aria-label={`${title} products`}>
      {products.map((product) => (
        <MobileCompactProductCard key={product.id} product={product} navigate={navigate} sectionTitle={title} sectionId={sectionId} acceptingOrders={acceptingOrders} prefetchProduct={prefetchProduct} />
      ))}
    </div>
  );
}

function MobileCompactProductCard({ product, navigate, sectionTitle, sectionId, acceptingOrders, prefetchProduct }) {
  const cart = useCart();
  const wishlist = useWishlist();
  const [wishlistBusy, setWishlistBusy] = useState(false);
  const [cartBusy, setCartBusy] = useState(false);
  const [actionStatus, setActionStatus] = useState('');
  const productId = product._id || product.id || product.slug;
  const isWishlisted = wishlist.items.some((item) => (item._id || item.id || item.slug) === productId);
  const image = getPrimaryImageUrl(product.images);
  const cartItem = cart.getCartItem(product);
  const availableStock = wishlistStock(product);
  const rental = product.commerceMode === 'RENTAL_ONLY';
  const unavailable = !rental && (isUnavailable(product) || availableStock === 0);
  const needsSize = getSelectableSizes(product).length > 0;
  const wishlistPending = wishlistBusy || (wishlist.pendingIds || []).some((id) => String(id) === String(productId));
  const openProduct = () => {
    trackEvent('HOME_PRODUCT_CLICK', { productId, metadata: { sectionId, action: 'open' } });
    navigate(`/product?id=${productId}`);
  };

  const badge = product.isBestSeller
    ? { label: 'BESTSELLER', className: 'bg-[#f59e0b] text-white' }
    : product.isNewArrival
      ? { label: 'NEW', className: 'bg-[#22c55e] text-white' }
      : product.showInTrending || sectionTitle === 'Fast-moving styles'
        ? { label: 'TREND', className: 'bg-[#10b981] text-white' }
        : null;

  return (
    <article data-mobile-product-card className="min-w-0 shrink-0 snap-start basis-[calc(50%-6px)]">
      <div data-mobile-product-shell className="relative overflow-hidden rounded-[14px] bg-blush shadow-[0_4px_12px_rgba(15,23,42,0.06)]">
          <button type="button" onPointerDown={() => prefetchProduct?.(productId)} onFocus={() => prefetchProduct?.(productId)} onClick={openProduct} className="absolute inset-0 z-[1]" aria-label={`View ${product.name}`} />
          <div data-mobile-product-media className="aspect-[0.92]">
            {image ? (
              <img loading="lazy" decoding="async" sizes="(max-width: 767px) 46vw, 30vw" src={normalizeImageUrl(image)} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center bg-gradient-to-br from-[#f8e2d7] to-[#f5d0d5] text-[12px] font-semibold text-wine">
                Jassi
              </div>
            )}
          </div>
          {badge && (
            <span className={`absolute left-2 top-2 rounded-[4px] px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.05em] ${badge.className}`}>
              {badge.label}
            </span>
          )}
          <button
            data-card-field="wishlist"
            type="button"
            disabled={wishlistPending}
            onClick={async () => {
              if (wishlistPending) return;
              setWishlistBusy(true);
              setActionStatus('');
              try {
                const result = await Promise.resolve(wishlist.toggleWishlist(product));
                setActionStatus(result?.ok === false ? (result.message || 'Wishlist could not be updated') : isWishlisted ? 'Removed from wishlist' : 'Saved to wishlist');
              } catch (error) {
                setActionStatus(error?.message || 'Wishlist could not be updated');
              } finally {
                setWishlistBusy(false);
              }
            }}
            className={`absolute right-1 top-1 z-[2] grid h-11 w-11 place-items-center rounded-full bg-white/95 shadow-sm disabled:opacity-60 ${isWishlisted ? 'text-rose' : 'text-slate-500'}`}
            aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            aria-pressed={isWishlisted}
            aria-busy={wishlistPending}
          >
            <Icon name="heart" className="h-4 w-4" />
          </button>
      </div>
      <div className="px-1 pt-2">
        <button type="button" onClick={openProduct} className="block min-h-11 w-full text-left">
          <p data-card-field="title" className="truncate text-[11px] font-semibold leading-[1.3] text-charcoal" title={product.name}>{product.name}</p>
          <p className="mt-0.5 truncate text-[10px] text-slate-500" title={product.category}>{product.category}</p>
        </button>
        <div className="mt-2 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div data-card-field="price" className="flex items-center gap-1">
              <span className="text-[13px] font-bold text-charcoal">{rental ? 'Check rental rates' : `₹${Number(product.price || 0).toLocaleString('en-IN')}`}</span>
              {!rental && product.originalPrice > product.price && <span className="truncate text-[9px] text-slate-400 line-through">₹{Number(product.originalPrice || 0).toLocaleString('en-IN')}</span>}
            </div>
            {!rental && product.discountPercentage > 0 && <p data-card-field="discount" className="mt-0.5 text-[9px] font-bold text-rose">({product.discountPercentage}% OFF)</p>}
            {Number(product.rating) > 0 && <p data-card-field="rating" className="mt-1 inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-600"><Star className="h-3 w-3 fill-current" />{Number(product.rating).toFixed(1)}{Number(product.numReviews) > 0 ? ` (${product.numReviews})` : ''}</p>}
            {unavailable && <p className="mt-0.5 text-[9px] font-bold text-slate-500">Out of stock</p>}
            {!rental && !unavailable && Number.isFinite(availableStock) && availableStock > 0 && availableStock <= 3 && <p className="mt-0.5 text-[9px] font-bold text-orange-600">Only {availableStock} left</p>}
          </div>
          <button
            data-card-field="cart"
            type="button"
            onClick={async () => {
              if (cartBusy) return;
              if (rental) { openProduct(); return; }
              if (needsSize) {
                trackEvent('HOME_PRODUCT_CLICK', { productId, metadata: { sectionId, action: 'select-size' } });
                navigate(`/product?id=${productId}`);
                return;
              }
              setCartBusy(true);
              setActionStatus('');
              try {
                const result = await Promise.resolve(cart.addToCart(product));
                if (result?.ok !== false) {
                  setActionStatus('Added to shopping bag');
                  trackEvent('HOME_PRODUCT_CLICK', { productId, metadata: { sectionId, action: 'quick-add' } });
                } else {
                  setActionStatus(result.message || 'Product could not be added');
                }
              } catch (error) {
                setActionStatus(error?.message || 'Product could not be added');
              } finally {
                setCartBusy(false);
              }
            }}
            disabled={!rental && (!acceptingOrders || unavailable || cart.loading || cartBusy)}
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#e7e5e4] disabled:opacity-40 ${cartItem ? 'bg-emerald-50 text-emerald-700' : 'bg-white text-slate-600'}`}
            aria-label={rental ? 'Check rental dates' : !acceptingOrders ? 'Orders are temporarily paused' : unavailable ? 'Out of stock' : needsSize ? 'Select a size' : cartItem ? 'Add more to cart' : 'Add to cart'}
            aria-busy={cartBusy}
          >
            {cartBusy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" /> : cartItem ? <Check className="h-4 w-4" /> : <Icon name="bag" className="h-4 w-4" />}
          </button>
        </div>
        {actionStatus && <span className="sr-only" role="status">{actionStatus}</span>}
      </div>
    </article>
  );
}

function MobileOrderPause({ message }) {
  return <aside className="mx-3 mt-3 flex items-start gap-3 rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950" role="status">
    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
    <div><p className="text-[12px] font-bold">Online orders are temporarily paused</p><p className="mt-1 text-[11px] leading-4">{message || 'You can still browse the collection. Please check again soon.'}</p></div>
  </aside>;
}

function MobileHomeError({ onRetry }) {
  return <section className="grid min-h-[65vh] place-items-center bg-ivory px-6 pb-24 text-center">
    <div><AlertCircle className="mx-auto h-8 w-8 text-wine" /><h1 className="mt-4 text-xl font-bold text-charcoal">The store could not be loaded</h1><p className="mt-2 text-[12px] leading-5 text-slate-500">Check your connection and try again.</p><button type="button" onClick={onRetry} className="mt-5 min-h-11 rounded-[10px] bg-wine px-6 text-[12px] font-bold text-white">Try again</button></div>
  </section>;
}

function MobileSectionNotice({ message, onRetry }) {
  return <section className="px-3 pb-4"><div className="flex items-center justify-between gap-3 rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900"><div className="flex min-w-0 items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" /><p className="text-[11px] font-semibold">{message}</p></div><button type="button" onClick={onRetry} className="min-h-11 shrink-0 px-2 text-[10px] font-black uppercase">Retry</button></div></section>;
}

function dedupeMobileProductSections(sections) {
  const used = new Set();
  return [...sections].sort((left, right) => left.order - right.order).map((section) => {
    if (section.id === 'recentlyViewed') return { ...section, products: (section.products || []).slice(0, 12) };
    const unique = (section.products || []).filter((product) => {
      const id = String(product?._id || product?.id || product?.slug || '');
      return id && !used.has(id);
    });
    const selected = unique.length >= Math.min(4, section.products?.length || 0) ? unique : (section.products || []);
    selected.forEach((product) => used.add(String(product?._id || product?.id || product?.slug || '')));
    return { ...section, products: selected.slice(0, 12) };
  });
}

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
