import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { normalizeImageUrl } from '../../services/normalize';
import { getApiBaseUrl } from '../../store/apiBaseUrl';
import { readStoreSlug } from '../../utils/attribution';
import { getTrafficContext, recordTrafficEvent, trafficAllowed, TRAFFIC_CHANGE_EVENT } from '../../utils/trafficTracker';

export function bannersForPosition(banners, position, fallbackTypes = []) {
  const positioned = (banners || []).filter((banner) => banner.position === position && banner.image);
  if (positioned.length || !fallbackTypes.length) return positioned;
  return (banners || []).filter((banner) => fallbackTypes.includes(banner.type) && banner.image);
}

export function bannersForHero(banners) {
  const seen = new Set();
  return (banners || []).filter((banner) => {
    if (!banner?.image || (banner.position !== 'Home - Top' && banner.type !== 'Hero')) return false;
    const key = String(banner._id || banner.id || `${banner.image}:${banner.title || ''}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function useBannerEngagement(banner) {
  const ref = useRef(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || !banner?._id || typeof IntersectionObserver === 'undefined') return undefined;
    const key = `traffic_banner_impression_${readStoreSlug() || 'default'}_${banner._id}`;
    let alreadySeen = false;
    try { alreadySeen = sessionStorage.getItem(key) === '1'; } catch { /* storage is optional */ }
    if (alreadySeen) return undefined;
    let visible = false;
    const trackVisible = () => {
      if (!visible || !trafficAllowed()) return;
      try { sessionStorage.setItem(key, '1'); } catch { /* storage is optional */ }
      trackBannerEvent(banner._id, 'impression');
      observer.disconnect();
      window.removeEventListener(TRAFFIC_CHANGE_EVENT, trackVisible);
    };
    const observer = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5);
      trackVisible();
    }, { threshold: [0.5] });
    observer.observe(element);
    window.addEventListener(TRAFFIC_CHANGE_EVENT, trackVisible);
    return () => { observer.disconnect(); window.removeEventListener(TRAFFIC_CHANGE_EVENT, trackVisible); };
  }, [banner?._id]);
  return ref;
}

export function openBanner(banner, navigate) {
  if (!banner) return;
  trackBannerEvent(banner._id, 'click');
  const target = withCampaign(banner.link || '/products', banner.campaignKey);
  if (/^https:\/\//i.test(target)) window.location.assign(target);
  else navigate?.(target);
}

function trackBannerEvent(bannerId, event) {
  if (!bannerId || typeof fetch !== 'function' || !trafficAllowed()) return;
  const context = getTrafficContext();
  if (!context) return;
  recordTrafficEvent(event === 'impression' ? 'BANNER_IMPRESSION' : 'BANNER_CLICK', { metadata: { bannerId: String(bannerId) } });
  const storeSlug = readStoreSlug();
  fetch(`${getApiBaseUrl()}/banners/${encodeURIComponent(bannerId)}/events`, {
    method: 'POST',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
      ...(storeSlug ? { 'x-store-slug': storeSlug } : {}),
    },
    body: JSON.stringify({ event, sessionId: context.sessionId, consent: true, trafficHandled: true }),
  }).catch(() => null);
}

export default function StorefrontBannerSlot({ banners = [], position, navigate, className = '', compact = false }) {
  const slides = useMemo(() => bannersForPosition(banners, position), [banners, position]);
  const [slideIndex, setSlideIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const banner = slides[slideIndex % Math.max(1, slides.length)];
  const ref = useBannerEngagement(banner);

  useEffect(() => {
    setSlideIndex((current) => current % Math.max(1, slides.length));
  }, [slides.length]);

  useEffect(() => {
    if (slides.length < 2 || paused || prefersReducedMotion()) return undefined;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') setSlideIndex((current) => (current + 1) % slides.length);
    }, 5200);
    return () => window.clearInterval(timer);
  }, [paused, slides.length]);

  if (!banner) return null;
  const focal = banner.focalPoint || 'center';
  const activeIndex = slideIndex % slides.length;
  const move = (direction) => setSlideIndex((current) => (current + direction + slides.length) % slides.length);
  return (
    <section
      ref={ref}
      className={`relative mx-auto w-full px-3 py-3 md:px-6 lg:px-8 ${className}`}
      data-banner-position={position}
      aria-label={`${position} offers`}
      aria-roledescription="carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}
    >
      <button
        type="button"
        onClick={() => openBanner(banner, navigate)}
        className={`group relative block w-full overflow-hidden rounded-2xl bg-[#f8eee9] text-left shadow-[0_12px_30px_rgba(76,24,42,0.10)] md:rounded-[26px] ${compact ? 'min-h-[112px] md:min-h-[150px]' : 'min-h-[150px] md:min-h-[230px]'}`}
        aria-label={`${banner.title || position}, slide ${activeIndex + 1} of ${slides.length}`}
      >
        <picture className="absolute inset-0 block h-full w-full">
          {banner.mobileImage ? <source media="(max-width: 639px)" srcSet={normalizeImageUrl(banner.mobileImage)} /> : null}
          {banner.tabletImage ? <source media="(max-width: 1023px)" srcSet={normalizeImageUrl(banner.tabletImage)} /> : null}
          <img src={normalizeImageUrl(banner.image)} alt={banner.altText || banner.title || ''} loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]" style={{ objectPosition: focal }} />
        </picture>
        <span className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent" />
        <span className={`relative flex max-w-xl flex-col items-start justify-center text-white ${compact ? 'min-h-[112px] p-5 md:min-h-[150px] md:p-8' : 'min-h-[150px] p-5 md:min-h-[230px] md:p-10'}`}>
          <small className="text-[10px] font-black uppercase tracking-[0.22em] text-white/80">{position}</small>
          <strong className="mt-2 font-serif text-xl leading-tight md:text-4xl">{banner.title}</strong>
          {banner.subtitle ? <span className="mt-2 line-clamp-2 text-xs font-semibold text-white/90 md:text-base">{banner.subtitle}</span> : null}
          {banner.buttonText ? <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black text-wine shadow-sm">{banner.buttonText}<ArrowRight className="h-3.5 w-3.5" /></span> : null}
        </span>
      </button>
      {slides.length > 1 && <>
        <button type="button" onClick={() => move(-1)} aria-label={`Previous ${position} offer`} className="absolute left-5 top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-white/60 bg-white/90 text-wine shadow-md transition hover:bg-white md:left-9 md:h-11 md:w-11"><ChevronLeft className="h-4 w-4 md:h-5 md:w-5" /></button>
        <button type="button" onClick={() => move(1)} aria-label={`Next ${position} offer`} className="absolute right-5 top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-white/60 bg-white/90 text-wine shadow-md transition hover:bg-white md:right-9 md:h-11 md:w-11"><ChevronRight className="h-4 w-4 md:h-5 md:w-5" /></button>
        <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/25 px-2.5 py-1.5 md:bottom-8" aria-label={`Choose ${position} offer`}>
          {slides.map((slide, index) => <button key={slide._id || slide.id || index} type="button" onClick={() => setSlideIndex(index)} aria-label={`Show ${position} offer ${index + 1}`} aria-current={index === activeIndex ? 'true' : undefined} className={`h-1.5 rounded-full transition-all ${index === activeIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/60 hover:bg-white/85'}`} />)}
        </div>
      </>}
    </section>
  );
}

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function withCampaign(link, campaign) {
  const value = String(link || '/products');
  if (!campaign) return value;
  try {
    const url = new URL(value, window.location.origin);
    url.searchParams.set('utm_source', 'banner');
    url.searchParams.set('utm_campaign', campaign);
    return url.origin === window.location.origin ? `${url.pathname}${url.search}${url.hash}` : url.toString();
  } catch { return value; }
}
