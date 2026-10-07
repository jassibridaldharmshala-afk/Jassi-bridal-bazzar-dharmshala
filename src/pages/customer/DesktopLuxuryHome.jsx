import { lazy, Suspense, memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  IconChevronLeft,
  IconChevronRight,
  IconCreditCard,
  IconHeart,
  IconPackage,
  IconRefresh,
  IconShieldCheck,
  IconShoppingBag,
  IconStarFilled,
  IconTruckDelivery,
} from '@tabler/icons-react';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { getPrimaryImageUrl, normalizeImageEntries, normalizeImageUrl, normalizeProducts } from '../../services/normalize';
import ShoppingShortcuts from '../../components/storefront/ShoppingShortcuts';
import { clearRecentProducts } from '../../utils/recentProducts';
import api from '../../services/api';
import { isUnavailable, wishlistStock } from '../../utils/wishlist';
import { getHomepageSection } from '../../config/websiteCustomization';
import LazyBoundary from '../../components/ui/LazyBoundary';
import styles from './DesktopLuxuryHome.module.css';
import { useBrandIdentity } from '../../context/BrandIdentityContext';
import { bannersForHero, bannersForPosition, openBanner, useBannerEngagement } from '../../components/banners/StorefrontBannerSlot';
import StorefrontCustomBlocks from '../../components/storefront/StorefrontCustomBlocks';
import { getSelectableSizes } from '../../utils/productSizing';

const QuickViewModal = lazy(() => import('../../components/product/QuickViewModal'));

const services = [
  { title: 'Secure Payments', text: '100% secure & trusted', icon: IconCreditCard },
  { title: 'COD Available', text: 'Cash on delivery nationwide', icon: IconPackage },
  { title: 'Easy Returns', text: 'Simple returns & refunds', icon: IconRefresh },
  { title: '24/7 Support', text: 'We are here to help you', icon: IconShieldCheck },
];

export default function DesktopLuxuryHome({
  navigate,
  categories = [],
  banners = [],
  catalog = [],
  featuredProducts = [],
  trendingProducts = [],
  newArrivalProducts = [],
  bestSellerProducts = [],
  ethnicSetProducts = [],
  accessoryProducts = [],
  instagramProducts = [],
  websiteConfig,
  customerReviews = [],
  industry = 'fashion',
  storeSlug = '',
  discovery = null,
}) {
  const brand = useBrandIdentity();
  const fashion = industry === 'fashion';
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroPaused, setHeroPaused] = useState(false);

  const productsWithImages = useMemo(
    () => uniqueProducts([...featuredProducts, ...trendingProducts, ...newArrivalProducts, ...catalog])
      .filter((product) => getProductImage(product)),
    [catalog, featuredProducts, newArrivalProducts, trendingProducts],
  );

  const heroSlides = useMemo(() => {
    const heroes = bannersForHero(banners);
    if (heroes.length) return heroes;
    const closestBanner = banners.find((banner) => banner.image);
    return closestBanner ? [closestBanner] : [{}];
  }, [banners]);

  const activeHero = heroSlides[heroIndex % heroSlides.length] || {};
  const heroEngagementRef = useBannerEngagement(activeHero);
  const heroSection = getHomepageSection(websiteConfig, 'hero');
  const activeHeroImage = normalizeImageUrl(activeHero.image);
  const heroImage = activeHeroImage || normalizeImageUrl(heroSection.image) || getProductImage(productsWithImages[0]);
  const heroAlt = activeHeroImage
    ? activeHero.altText || activeHero.title || 'Featured collection'
    : heroSection.imageAlt || 'Featured collection';
  const heroImagePosition = activeHeroImage ? activeHero.focalPoint || 'center' : heroSection.imagePosition || 'center';
  const editorialProducts = productsWithImages.slice(0, 3);
  const hasSelection = (id) => Boolean(websiteConfig?.homepage?.sectionProductIds?.[id]?.length);
  const arrivals = uniqueProducts(hasSelection('newArrivals') ? newArrivalProducts : [
    ...newArrivalProducts,
    ...featuredProducts,
    ...trendingProducts,
    ...catalog,
  ]).filter((product) => getProductImage(product));
  const bestSellers = uniqueProducts(hasSelection('bestSellers') || bestSellerProducts.length ? bestSellerProducts : catalog.filter((product) => product.isBestSeller))
    .filter((product) => getProductImage(product)).slice(0, 12);
  const trendingNow = uniqueProducts(
    hasSelection('trending') ? trendingProducts : catalog.filter((product) => product.showInTrending),
  ).filter((product) => getProductImage(product)).slice(0, 12);
  const latestArrivals = arrivals.slice(0, 12);
  const saleBanner = bannersForPosition(banners, 'Home - Middle', ['Sale', 'Offer'])[0];

  const moveHero = (direction) => {
    setHeroIndex((current) => (current + direction + heroSlides.length) % heroSlides.length);
  };

  useEffect(() => {
    setHeroIndex((current) => current % heroSlides.length);
  }, [heroSlides.length]);

  useEffect(() => {
    if (heroSlides.length < 2 || heroPaused || prefersReducedMotion()) return undefined;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') setHeroIndex((current) => (current + 1) % heroSlides.length);
    }, 5200);
    return () => window.clearInterval(timer);
  }, [heroPaused, heroSlides.length]);

  return (
    <div className={`${styles.desktopLuxuryHome} themed-home-flow themed-home-flow--desktop`}>
      <ThemedDesktopSection config={websiteConfig} id="hero"><section
        ref={heroEngagementRef}
        className={styles.hero}
        aria-label="Featured offers"
        aria-roledescription="carousel"
        onMouseEnter={() => setHeroPaused(true)}
        onMouseLeave={() => setHeroPaused(false)}
        onFocusCapture={() => setHeroPaused(true)}
        onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setHeroPaused(false); }}
      >
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <p className={styles.heroEyebrow}>{fashion ? 'New Festive Collection' : `New ${industryLabel(industry)} Collection`}</p>
            <h1>{heroSection.heading}</h1>
            <p className={styles.heroDescription}>
              {heroSection.description || activeHero.subtitle || (fashion ? 'Premium ethnic wear crafted for weddings, festive moments, and everyday elegance.' : `Explore quality ${industryLabel(industry).toLowerCase()} products selected for your needs.`)}
            </p>
            <div className={styles.heroButtons}>
              <button type="button" className={`${styles.primaryButton} site-theme-button`} onClick={() => activeHero?._id ? openBanner({ ...activeHero, link: heroSection.buttonLink || activeHero.link }, navigate) : navigate(heroSection.buttonLink || '/products?newArrival=true')}>{heroSection.buttonText || activeHero.buttonText || 'Shop New Arrivals'}</button>
              <button type="button" className={styles.secondaryButton} onClick={() => navigate('/products')}>Explore Collections</button>
            </div>
            <div className={styles.trustPoints}>
              <TrustPoint icon={IconShieldCheck} title={fashion ? 'Premium Fabric' : 'Quality Assured'} text="Finest quality assured" />
              <TrustPoint icon={IconRefresh} title="Easy Exchange" text="Hassle-free exchange" />
              <TrustPoint icon={IconTruckDelivery} title="Fast Delivery" text="Across India in 2-5 days" />
            </div>
          </div>
          <div className={styles.heroVisual}>
            {heroImage ? <img loading="eager" fetchPriority="high" decoding="async" src={heroImage} alt={heroAlt} style={{ objectPosition: heroImagePosition }} /> : <div className={styles.imageFallback}>{websiteConfig?.branding?.websiteName || brand.websiteName}</div>}
          </div>
        </div>
        {heroSlides.length > 1 && <>
          <button type="button" className={`${styles.heroArrow} ${styles.heroArrowLeft}`} onClick={() => moveHero(-1)} aria-label="Previous hero slide"><IconChevronLeft /></button>
          <button type="button" className={`${styles.heroArrow} ${styles.heroArrowRight}`} onClick={() => moveHero(1)} aria-label="Next hero slide"><IconChevronRight /></button>
          <div className={styles.heroDots} aria-label="Choose featured offer">
            {heroSlides.map((slide, index) => (
              <button
                key={slide._id || slide.id || index}
                type="button"
                className={index === heroIndex % heroSlides.length ? styles.heroDotActive : ''}
                onClick={() => setHeroIndex(index)}
                aria-label={`Show hero slide ${index + 1}`}
                aria-current={index === heroIndex % heroSlides.length ? 'true' : undefined}
              />
            ))}
          </div>
        </>}
      </section></ThemedDesktopSection>

      <ThemedDesktopSection config={websiteConfig} id="categories"><CategorySection categories={categories} products={productsWithImages} navigate={navigate} section={getHomepageSection(websiteConfig, 'categories')} /></ThemedDesktopSection>
      {discovery && <div className="themed-home-section" style={{ '--home-section-order': getHomepageSection(websiteConfig, 'categories').order + 1 }}><ShoppingShortcuts data={discovery} navigate={navigate} /></div>}

      <ThemedDesktopSection config={websiteConfig} id="promotional"><section className={styles.luxuryContainer}>
        <EditorialGrid products={editorialProducts} navigate={navigate} section={getHomepageSection(websiteConfig, 'promotional')} />
      </section></ThemedDesktopSection>

      <ThemedDesktopSection config={websiteConfig} id="featured"><section className={`${styles.luxuryContainer} ${styles.collectionSection}`}>
        <ProductSection
          eyebrow="Featured"
          title={getHomepageSection(websiteConfig, 'featured').heading}
          subtitle={getHomepageSection(websiteConfig, 'featured').description}
          products={featuredProducts}
          navigate={navigate}
          viewAllPath={getHomepageSection(websiteConfig, 'featured').buttonLink}
          viewAllLabel={getHomepageSection(websiteConfig, 'featured').buttonText}
        />
      </section></ThemedDesktopSection>

      <ThemedDesktopSection config={websiteConfig} id="sale"><SaleBanner banner={saleBanner} fallbackProduct={productsWithImages[0]} navigate={navigate} section={getHomepageSection(websiteConfig, 'sale')} /></ThemedDesktopSection>
      <ThemedDesktopSection config={websiteConfig} id="services"><ServiceStrip /></ThemedDesktopSection>

      <ThemedDesktopSection config={websiteConfig} id="trending"><section className={`${styles.luxuryContainer} ${styles.collectionSection}`}>
        <ProductSection
          eyebrow="Trending Now"
          title={getHomepageSection(websiteConfig, 'trending').heading}
          subtitle={getHomepageSection(websiteConfig, 'trending').description}
          products={trendingNow}
          navigate={navigate}
          viewAllPath={getHomepageSection(websiteConfig, 'trending').buttonLink}
          viewAllLabel={getHomepageSection(websiteConfig, 'trending').buttonText}
        />
      </section></ThemedDesktopSection>

      <ThemedDesktopSection config={websiteConfig} id="newArrivals"><section className={`${styles.luxuryContainer} ${styles.collectionSection}`}>
        <ProductSection
          eyebrow="New Arrivals"
          title={getHomepageSection(websiteConfig, 'newArrivals').heading}
          subtitle={getHomepageSection(websiteConfig, 'newArrivals').description}
          products={latestArrivals}
          navigate={navigate}
          viewAllPath={getHomepageSection(websiteConfig, 'newArrivals').buttonLink}
          viewAllLabel={getHomepageSection(websiteConfig, 'newArrivals').buttonText}
        />
      </section></ThemedDesktopSection>

      <ThemedDesktopSection config={websiteConfig} id="bestSellers"><section className={`${styles.luxuryContainer} ${styles.bestSellers}`}>
        <ProductSection
          eyebrow="Best Sellers"
          title={getHomepageSection(websiteConfig, 'bestSellers').heading}
          subtitle={getHomepageSection(websiteConfig, 'bestSellers').description}
          products={bestSellers}
          navigate={navigate}
          viewAllPath={getHomepageSection(websiteConfig, 'bestSellers').buttonLink}
          viewAllLabel={getHomepageSection(websiteConfig, 'bestSellers').buttonText}
        />
      </section></ThemedDesktopSection>

      <ThemedDesktopSection config={websiteConfig} id="ethnicSets"><section className={`${styles.luxuryContainer} ${styles.collectionSection}`}>
        <ProductSection
          eyebrow="Ethnic Sets"
          title={getHomepageSection(websiteConfig, 'ethnicSets').heading}
          subtitle={getHomepageSection(websiteConfig, 'ethnicSets').description}
          products={ethnicSetProducts}
          navigate={navigate}
          viewAllPath={getHomepageSection(websiteConfig, 'ethnicSets').buttonLink}
          viewAllLabel={getHomepageSection(websiteConfig, 'ethnicSets').buttonText}
          emptyMessage="No ethnic sets are published yet. Use the admin catalog to publish products for this collection."
        />
      </section></ThemedDesktopSection>

      <ThemedDesktopSection config={websiteConfig} id="accessories"><section className={`${styles.luxuryContainer} ${styles.collectionSection}`}>
        <ProductSection
          eyebrow="Accessories"
          title={getHomepageSection(websiteConfig, 'accessories').heading}
          subtitle={getHomepageSection(websiteConfig, 'accessories').description}
          products={accessoryProducts}
          navigate={navigate}
          viewAllPath={getHomepageSection(websiteConfig, 'accessories').buttonLink}
          viewAllLabel={getHomepageSection(websiteConfig, 'accessories').buttonText}
          emptyMessage="No accessories are published yet. Browse all products while this collection is being curated."
        />
      </section></ThemedDesktopSection>

      <ThemedDesktopSection config={websiteConfig} id="instagram"><section className={`${styles.luxuryContainer} ${styles.collectionSection}`}>
        <ProductSection
          eyebrow="Style Inspiration"
          title={getHomepageSection(websiteConfig, 'instagram').heading}
          subtitle={getHomepageSection(websiteConfig, 'instagram').description}
          products={instagramProducts}
          navigate={navigate}
          viewAllPath={getHomepageSection(websiteConfig, 'instagram').buttonLink}
          viewAllLabel={getHomepageSection(websiteConfig, 'instagram').buttonText}
        />
      </section></ThemedDesktopSection>

      {discovery?.recentlyViewedEnabled !== false && discovery?.recentlyViewed?.length > 0 && <div className="themed-home-section" style={{ '--home-section-order': 85 }}><section className={`${styles.luxuryContainer} ${styles.collectionSection}`}><ProductSection eyebrow="Recently viewed" title="Continue where you left off" subtitle="Your browsing history on this device, just for this store." products={normalizeProducts(discovery.recentlyViewed)} navigate={navigate} viewAllLabel="Clear history" onHeaderAction={() => clearRecentProducts(storeSlug)} /></section></div>}
      <ThemedDesktopSection config={websiteConfig} id="reviews"><TestimonialSection section={getHomepageSection(websiteConfig, 'reviews')} reviews={customerReviews} /></ThemedDesktopSection>
      <ThemedDesktopSection config={websiteConfig} id="newsletter"><NewsletterSection section={getHomepageSection(websiteConfig, 'newsletter')} /></ThemedDesktopSection>
      <StorefrontCustomBlocks blocks={websiteConfig?.homepage?.blocks || []} catalog={catalog} categories={categories} navigate={navigate} storeSlug={storeSlug} />
    </div>
  );
}

function TrustPoint({ icon: IconComponent, title, text }) {
  return (
    <div className={styles.trustPoint}>
      <span><IconComponent size={18} stroke={1.7} /></span>
      <div><strong>{title}</strong><small>{text}</small></div>
    </div>
  );
}

function CategorySection({ categories, products, navigate, section }) {
  const railRef = useRef(null);
  const [railState, setRailState] = useState({ previous: false, next: categories.length > 8 });
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return undefined;
    const update = () => setRailState({
      previous: rail.scrollLeft > 4,
      next: rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 4,
    });
    update();
    rail.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      rail.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [categories.length]);
  const slide = (direction) => railRef.current?.scrollBy({
    left: direction * Math.max(520, railRef.current.clientWidth * 0.72),
    behavior: 'smooth',
  });
  return (
    <section className={styles.categorySection}>
      <div className={styles.sectionTitleDecorated}><span /><h2>{section?.heading || 'Shop by Category'}</h2><span /></div>
      <p>{section?.description || 'Curated styles for every occasion'}</p>
      <div className={styles.categoryRail}>
        {categories.length > 8 && <button type="button" className={`${styles.categoryArrow} ${styles.categoryArrowPrevious}`} aria-label="Previous categories" disabled={!railState.previous} onClick={() => slide(-1)}><IconChevronLeft size={22} /></button>}
        <div className={styles.categoryGrid} ref={railRef}>
          {categories.map((category) => {
            const categoryId = category._id || category.id || category.slug || category.name;
            const matchingProduct = products.find((product) => normalizeName(product.category).includes(normalizeName(category.name)));
            const image = category.image ? normalizeImageUrl(category.image) : getProductImage(matchingProduct || products[0]);
            return (
              <button key={categoryId} type="button" className={styles.categoryItem} onClick={() => navigate(`/products?category=${encodeURIComponent(categoryId)}`)}>
                <span className={styles.categoryImageWrap}>
                  {image ? <img loading="lazy" decoding="async" src={image} alt={category.name} /> : <span className={styles.imageFallback}>{String(category.name || 'SC').slice(0, 2)}</span>}
                </span>
                <strong title={category.name}>{category.name}</strong>
              </button>
            );
          })}
        </div>
        {categories.length > 8 && <button type="button" className={`${styles.categoryArrow} ${styles.categoryArrowNext}`} aria-label="Next categories" disabled={!railState.next} onClick={() => slide(1)}><IconChevronRight size={22} /></button>}
      </div>
    </section>
  );
}

function EditorialGrid({ products, navigate, section }) {
  return (
    <div className={styles.editorialGrid}>
      <EditorialCard
        className={styles.featureCardLarge}
        product={products[0]}
        eyebrow={section?.heading || 'Festive Edit'}
        text={section?.description || 'Graceful styles for celebration season'}
        action={section?.buttonText || 'Explore Festive Wear'}
        actionPath={section?.buttonLink}
        imageOverride={section?.image}
        navigate={navigate}
      />
      <EditorialCard
        className={styles.featureCardSmall}
        product={products[1]}
        eyebrow="Wedding Collection"
        text="Timeless looks for your special day"
        action="Shop Now"
        navigate={navigate}
      />
      <EditorialCard
        className={styles.featureCardSmall}
        product={products[2]}
        eyebrow="Everyday Elegance"
        text="Comfort meets style for every day"
        action="Shop Now"
        navigate={navigate}
      />
    </div>
  );
}

function EditorialCard({ className, product, eyebrow, text, action, navigate, actionPath, imageOverride }) {
  const brand = useBrandIdentity();
  const productId = getProductId(product);
  const image = imageOverride ? normalizeImageUrl(imageOverride) : getProductImage(product);
  return (
    <article className={className}>
      {image ? <img loading="lazy" decoding="async" src={image} alt={product?.name || eyebrow} /> : <div className={styles.imageFallback}>{brand.websiteName}</div>}
      <div className={styles.editorialOverlay} />
      <div className={styles.editorialCopy}>
        <h3>{eyebrow}</h3>
        <p>{text}</p>
        <button type="button" onClick={() => navigate(actionPath || (productId ? `/product?id=${encodeURIComponent(productId)}` : '/products'))}>{action} <span aria-hidden="true">&rarr;</span></button>
      </div>
    </article>
  );
}

function ProductSection({ eyebrow, title, subtitle, products = [], navigate, viewAllPath, viewAllLabel = 'View All', compact = false, className = '', emptyMessage = '', onHeaderAction }) {
  const scrollerRef = useRef(null);
  const hasSlider = products.length > 4;

  const slideSection = (direction) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollBy({ left: direction * scroller.clientWidth * 0.92, behavior: 'smooth' });
  };

  return (
    <div className={`${styles.productSection} ${className}`}>
      <div className={styles.productSectionHeader}>
        <div><span>{eyebrow}</span><h2>{title}</h2><p>{subtitle}</p></div>
        <div className={styles.sectionControls}>
          {hasSlider && (
            <>
              <button type="button" className={styles.sectionArrow} onClick={() => slideSection(-1)} aria-label={`Slide ${title} left`}><IconChevronLeft /></button>
              <button type="button" className={styles.sectionArrow} onClick={() => slideSection(1)} aria-label={`Slide ${title} right`}><IconChevronRight /></button>
            </>
          )}
          <button type="button" className={styles.viewAllButton} onClick={() => onHeaderAction ? onHeaderAction() : navigate(viewAllPath)}>{viewAllLabel || 'View All'}</button>
        </div>
      </div>
      <div ref={scrollerRef} className={`${styles.productGrid} ${compact ? styles.productGridCompact : ''} ${!products.length ? styles.productGridEmpty : ''}`}>
        {products.length ? products.map((product) => <LuxuryProductCard key={getProductId(product)} product={product} navigate={navigate} large={!compact} />) : (
          <div className={styles.emptyCollection}>
            <p>{emptyMessage || `No ${title.toLowerCase()} are published yet.`}</p>
            <button type="button" onClick={() => navigate('/products')}>Browse all products</button>
          </div>
        )}
      </div>
    </div>
  );
}

const LuxuryProductCard = memo(function LuxuryProductCard({ product, navigate, large }) {
  const [imageIndex, setImageIndex] = useState(0);
  const [quickOpen, setQuickOpen] = useState(false);
  const cart = useCart();
  const wishlist = useWishlist();
  const productId = getProductId(product);
  const productImages = useMemo(() => getProductImages(product), [product]);
  const image = productImages[imageIndex] || getProductImage(product);
  const price = Number(product.sellingPrice ?? product.price ?? 0);
  const originalPrice = Number(product.originalPrice ?? price);
  const discount = Number(product.discountPercentage) || (originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0);
  const wishlisted = wishlist.items.some((item) => getProductId(item) === productId);
  const rental = product.commerceMode === 'RENTAL_ONLY';
  const unavailable = !rental && (isUnavailable(product) || wishlistStock(product) === 0);
  const needsSize = getSelectableSizes(product).length > 0;

  const toggleWishlist = async (event) => {
    event.stopPropagation();
    await wishlist.toggleWishlist(product);
  };

  const addToCart = (event) => {
    event.stopPropagation();
    if (rental || needsSize) navigate(`/product?id=${encodeURIComponent(productId)}`);
    else cart.addToCart(product);
  };

  const slideImage = (event, direction) => {
    event.stopPropagation();
    setImageIndex((current) => (current + direction + productImages.length) % productImages.length);
  };

  return (
    <article className={`${styles.productCard} ${large ? styles.productCardLarge : ''}`} onClick={() => navigate(`/product?id=${encodeURIComponent(productId)}`)} data-theme-product-card>
      <div className={styles.productImageWrap} data-theme-product-media>
        <img loading="lazy" decoding="async" src={image} alt={product.name} />
        {(product.isNewArrival || product.isBestSeller) && <span className={styles.productBadge}>{product.isBestSeller ? 'Bestseller' : 'New'}</span>}
        <button type="button" className={styles.wishlistButton} onClick={toggleWishlist} disabled={wishlist.loading} aria-label="Toggle wishlist" data-card-field="wishlist"><IconHeart fill={wishlisted ? '#7b1834' : 'none'} /></button>
        <button type="button" className={styles.cartButton} onClick={addToCart} disabled={unavailable || (!rental && cart.loading)} aria-label={rental ? 'Check rental dates' : unavailable ? 'Out of stock' : needsSize ? 'Select a size' : 'Add to cart'} data-card-field="cart"><IconShoppingBag /></button>
        <button type="button" data-card-field="quick-view" className="absolute bottom-3 right-3 z-20 rounded-lg bg-white/95 px-3 py-2 text-[10px] font-black uppercase text-wine shadow" onClick={(event) => { event.stopPropagation(); setQuickOpen(true); }}>Quick view</button>
        {productImages.length > 1 && (
          <>
            <button type="button" className={`${styles.productImageArrow} ${styles.productImageArrowLeft}`} onClick={(event) => slideImage(event, -1)} aria-label="Previous product image"><IconChevronLeft /></button>
            <button type="button" className={`${styles.productImageArrow} ${styles.productImageArrowRight}`} onClick={(event) => slideImage(event, 1)} aria-label="Next product image"><IconChevronRight /></button>
            <div className={styles.productImageDots}>
              {productImages.slice(0, 6).map((productImage, index) => (
                <button
                  key={`${productImage}-${index}`}
                  type="button"
                  className={index === imageIndex ? styles.productImageDotActive : ''}
                  onClick={(event) => {
                    event.stopPropagation();
                    setImageIndex(index);
                  }}
                  aria-label={`Show product image ${index + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
      <h3 data-card-field="title" title={product.name}>{product.name}</h3>
      <p className={styles.productCategory}>{formatCategory(product.category) || product.fabric || 'Collection'}</p>
      <div className={styles.priceRow} data-card-field="price">
        <strong>{rental ? 'Check rental rates' : `Rs. ${formatPrice(price)}`}</strong>
        {!rental && originalPrice > price && <del>Rs. {formatPrice(originalPrice)}</del>}
        {!rental && discount > 0 && <span data-card-field="discount">{discount}% OFF</span>}
      </div>
      {Number(product.numReviews) > 0 && <div className={styles.ratingRow} data-card-field="rating">
        <span><IconStarFilled />{Number(product.rating || 0).toFixed(1)}</span>
        <small>({product.numReviews})</small>
      </div>}
      {quickOpen && <LazyBoundary><Suspense fallback={<p role="status" className="p-3 text-sm text-slate-600">Loading quick view…</p>}><QuickViewModal product={product} onClose={() => setQuickOpen(false)} onOpenFull={() => { setQuickOpen(false); navigate(`/product?id=${encodeURIComponent(productId)}`); }} /></Suspense></LazyBoundary>}
    </article>
  );
});

function SaleBanner({ banner, fallbackProduct, navigate, section }) {
  const brand = useBrandIdentity();
  const engagementRef = useBannerEngagement(banner);
  const image = section?.image ? normalizeImageUrl(section.image) : banner?.image ? normalizeImageUrl(banner.image) : getProductImage(fallbackProduct);
  return (
    <section ref={engagementRef} className={`${styles.luxuryContainer} ${styles.saleBanner}`}>
      <div className={styles.saleCopy}><span>{brand.websiteName}</span><h2>{section?.heading || banner?.title || 'Season Sale'}</h2><p>{section?.description || 'Discover current offers'}</p></div>
      <button type="button" className="site-theme-button" onClick={() => banner?._id ? openBanner({ ...banner, link: section?.buttonLink || banner.link }, navigate) : navigate(section?.buttonLink || '/products?discount=20')}>{section?.buttonText || banner?.buttonText || 'Shop Sale'}</button>
      <div className={styles.saleVisual}>{image && <img loading="lazy" decoding="async" src={image} alt={banner?.title || 'Festive sale'} />}</div>
    </section>
  );
}

function ServiceStrip() {
  return (
    <section className={`${styles.luxuryContainer} ${styles.serviceStrip}`}>
      {services.map(({ title, text, icon: IconComponent }) => (
        <div key={title} className={styles.serviceItem}>
          <span><IconComponent /></span>
          <div><strong>{title}</strong><small>{text}</small></div>
        </div>
      ))}
    </section>
  );
}

function TestimonialSection({ section, reviews }) {
  const averageRating = reviews.length ? (reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length).toFixed(1) : '—';
  return (
    <section className={`${styles.luxuryContainer} ${styles.testimonialSection}`}>
      <div className={styles.testimonialIntro}>
        <span>{reviews.length ? `${reviews.length} featured customer ${reviews.length === 1 ? 'story' : 'stories'}` : 'Customer stories'}</span>
        <h2>{section?.heading || 'Loved for Fit, Fabric & Finish'}</h2>
        <div className={styles.testimonialRating}>{[0, 1, 2, 3, 4].map((star) => <IconStarFilled key={star} />)} <strong>{averageRating}/5</strong></div>
        <p>{section?.description || 'Trusted by women who value thoughtful design, comfort, and beautiful craftsmanship.'}</p>
      </div>
      <div className={styles.reviewGrid}>
        {reviews.length ? reviews.map((review) => (
          <article key={review._id} className={styles.reviewCard}>
            <div>{Array.from({ length: Math.max(1, Math.min(5, Number(review.rating || 5))) }).map((_, star) => <IconStarFilled key={star} />)}</div>
            <p>“{review.comment}”</p>
            <strong>{review.user?.name || 'Verified customer'}</strong>
            <small>Verified Buyer</small>
          </article>
        )) : <article className={styles.reviewCard}><p>Customer reviews will appear here after they are approved.</p></article>}
      </div>
    </section>
  );
}

function NewsletterSection({ section }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false);

  const submit = async (event) => {
    event.preventDefault();
    if (submitLock.current) return;
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setStatus('Please enter your email.');
      return;
    }
    submitLock.current = true; setSubmitting(true);
    setStatus('');
    try {
      const data = await api.post('/newsletter/subscribe', { email: trimmedEmail, source: 'homepage' });
      setStatus(data.message || 'Thank you for subscribing.');
      setEmail('');
    } catch (error) {
      setStatus(error.message || 'Unable to subscribe right now.');
    } finally {
      submitLock.current = false; setSubmitting(false);
    }
  };

  return (
    <section className={`${styles.luxuryContainer} ${styles.newsletterSection}`}>
      <div><span>Stay in style</span><h2>{section?.heading || 'Join Jassi Circle'}</h2><p>{section?.description || 'Get early access to new drops, offers, and styling updates.'}</p></div>
      <form onSubmit={submit}>
        <input
          type="email"
          value={email}
          disabled={submitting}
          onChange={(event) => {
            setEmail(event.target.value);
            if (status) setStatus('');
          }}
          placeholder="Enter your email address"
          aria-label="Email address"
        />
        <button type="submit" className="site-theme-button" disabled={submitting}>{submitting ? 'Subscribing...' : (section?.buttonText || 'Subscribe')}</button>
        {status ? <small>{status}</small> : null}
      </form>
    </section>
  );
}

function ThemedDesktopSection({ config, id, children }) {
  const section = getHomepageSection(config, id);
  if (!section?.visible) return null;
  const background = normalizeImageUrl(section.backgroundImage);
  return <div className="themed-home-section" data-section-background={Boolean(background)} style={{ '--home-section-order': section.order, ...(background ? { backgroundImage: `url(${background})`, backgroundSize: 'cover', backgroundPosition: section.imagePosition || 'center' } : {}) }}>{children}</div>;
}

function uniqueProducts(products) {
  const seen = new Set();
  return products.filter((product) => {
    const id = getProductId(product);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function industryLabel(industry) {
  const labels = { mobile: 'Mobile', electronics: 'Electronics', jewellery: 'Jewellery', cosmetics: 'Beauty', art: 'Art', bakery: 'Bakery', footwear: 'Footwear', home: 'Home & Decor' };
  return labels[industry] || 'Product';
}

function getProductId(product) {
  return String(product?._id || product?.id || product?.slug || '');
}

function getProductImage(product) {
  return normalizeImageUrl(getPrimaryImageUrl(product?.images));
}

function getProductImages(product) {
  const entries = normalizeImageEntries(product?.images || []);
  const primary = entries.find((image) => image.primary);
  const ordered = primary ? [primary, ...entries.filter((image) => image !== primary)] : entries;
  return ordered.map((image) => normalizeImageUrl(image.url)).filter(Boolean).slice(0, 6);
}

function normalizeName(value) {
  return String(value || '').trim().toLowerCase();
}

function formatCategory(category) {
  return typeof category === 'string' ? category : category?.name || category?.title || '';
}

function formatPrice(value) {
  return Number(value || 0).toLocaleString('en-IN');
}

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
