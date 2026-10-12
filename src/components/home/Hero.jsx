import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui';
import { responsiveImage } from '../../utils/responsiveImages';

export default function Hero({ navigate, banner, banners = [] }) {
  const slides = useMemo(() => {
    if (Array.isArray(banners) && banners.length) return banners;
    if (banner) return [banner];
    return [];
  }, [banner, banners]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [slides.length]);

  const current = slides[index] || banner || {};
  const image = current?.image ? responsiveImage(current.imageMedia || current.image, 'hero') : null;

  const goTo = (nextIndex) => {
    if (!slides.length) return;
    const total = slides.length;
    setIndex((nextIndex + total) % total);
  };

  return (
    <section className="relative overflow-hidden bg-[color:var(--site-accent-soft)]">
      <div className="grid min-h-[460px] xl:grid-cols-[1.02fr_0.98fr]">
        <div className="relative flex items-center px-6 py-10 lg:px-12 lg:py-14">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,color-mix(in_srgb,var(--site-surface)_95%,transparent),transparent_36%),linear-gradient(90deg,var(--site-background),var(--site-surface-alt))]" />
          <div className="relative max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[color:var(--site-accent)] lg:text-[12px]">
              New festive collection ’24
            </p>
            <h1 className="mt-4 text-[36px] font-semibold leading-[1.02] text-charcoal lg:text-[64px]">
              {current?.title || 'Crafted for Moments'}
              <span className="block italic text-wine">That Matter</span>
            </h1>
            <p className="mt-4 max-w-lg text-[15px] leading-7 text-[color:var(--site-muted)] lg:text-[18px]">
              {current?.subtitle || 'Premium fabrics. Timeless designs. Made for every celebration.'}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button onClick={() => navigate(current?.link || '/products')} className="rounded-full bg-wine px-6 text-[14px] font-black uppercase tracking-[0.08em] text-[color:var(--site-on-fill)] shadow-[0_12px_28px_rgb(var(--site-shadow-rgb)/0.18)]">
                {current?.buttonText || 'Shop Collection'}
              </Button>
              <Button onClick={() => navigate('/category')} variant="outline" className="rounded-full border-[color:var(--site-accent-border)] bg-[color:var(--site-surface)] px-6 text-[14px] font-black uppercase tracking-[0.08em] text-wine">
                Explore Categories
              </Button>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <HeroStat title="Premium quality" subtitle="Finest fabrics & craftsmanship" />
              <HeroStat title="Easy returns" subtitle="Hassle-free return policy" />
              <HeroStat title="Fast delivery" subtitle="Across India in 2-5 days" />
            </div>
          </div>
        </div>

        <div className="relative min-h-[460px] overflow-hidden bg-gradient-to-br from-[color:var(--site-tint)] via-[color:var(--site-tint)] to-[color:var(--site-tint)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,color-mix(in_srgb,var(--site-surface)_45%,transparent),transparent_34%),radial-gradient(circle_at_bottom_left,var(--site-tint),transparent_26%)]" />
          <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[color:var(--site-tint)] to-transparent" />
          <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-[color:var(--site-tint)] to-transparent" />

          {image ? (
            <img {...image} fetchPriority="high" decoding="async" alt={current?.title || 'Festive collection'} className="absolute inset-0 h-full w-full object-cover object-center" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-center">
              <div>
                <p className="text-[12px] font-black uppercase tracking-[0.28em] text-wine">Jassi Bridal Bazar Dharmshala</p>
                <p className="mt-2 text-[18px] font-semibold text-charcoal">Premium festive showcase</p>
              </div>
            </div>
          )}

          <div className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-[color:color-mix(in_srgb,var(--site-surface)_70%,transparent)] px-4 py-2 backdrop-blur">
            {slides.length > 1 ? slides.map((slide, dotIndex) => (
              <button
                key={slide._id || slide.title || dotIndex}
                type="button"
                onClick={() => setIndex(dotIndex)}
                className={`h-1.5 rounded-full transition-all ${dotIndex === index ? 'w-6 bg-wine' : 'w-1.5 bg-[color:var(--site-tint)]'}`}
                aria-label={`Show slide ${dotIndex + 1}`}
              />
            )) : <span className="h-1.5 w-6 rounded-full bg-wine" />}
          </div>

          {slides.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => goTo(index - 1)}
                className="absolute left-4 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-[color:var(--site-surface)] text-charcoal shadow-[0_10px_24px_rgb(var(--site-shadow-rgb)/0.12)]"
                aria-label="Previous hero slide"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => goTo(index + 1)}
                className="absolute right-4 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-[color:var(--site-surface)] text-charcoal shadow-[0_10px_24px_rgb(var(--site-shadow-rgb)/0.12)]"
                aria-label="Next hero slide"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function HeroStat({ title, subtitle }) {
  return (
    <div className="rounded-[20px] border border-theme-border bg-[color:color-mix(in_srgb,var(--site-surface)_85%,transparent)] px-4 py-3 shadow-[0_8px_22px_rgb(var(--site-shadow-rgb)/0.04)] backdrop-blur-sm">
      <p className="text-[12px] font-bold text-charcoal">{title}</p>
      <p className="mt-1 text-[11px] text-[color:var(--site-muted)]">{subtitle}</p>
    </div>
  );
}
