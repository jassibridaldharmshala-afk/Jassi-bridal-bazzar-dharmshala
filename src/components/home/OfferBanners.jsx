import { responsiveImage } from '../../utils/responsiveImages';

const offers = [
  ['Festive Sale', 'Flat 20% off with FESTIVE20', 'from-wine to-rose', null, '/products?discount=20'],
  ['New User Deal', 'Extra 15% off with NEWUSER15', 'from-charcoal to-wine', null, '/cart'],
  ['Free Shipping', 'Orders above Rs. 999', 'from-[color:var(--site-primary)] to-[color:var(--site-primary-dark)]', null, '/products'],
];

export default function OfferBanners({ navigate, banners }) {
  const list = banners?.length ? banners.map((banner) => [banner.title, banner.subtitle, 'from-wine to-rose', banner.imageMedia || banner.image, banner.link]) : offers;
  return (
    <section className="container-page bg-[color:var(--site-surface)] pb-5 md:bg-transparent md:pb-8">
      <div className="hide-scrollbar flex gap-3 overflow-x-auto md:gap-4">
        {list.map(([title, subtitle, gradient, image, link]) => (
          <button key={title} onClick={() => navigate(link || '/products')} className={`relative min-w-[220px] flex-1 overflow-hidden rounded-xl bg-gradient-to-br ${gradient} p-4 text-left text-[color:var(--site-on-fill)] shadow-lg md:min-w-[280px] md:rounded-2xl md:p-6`}>
            {image && <img {...responsiveImage(image, 'card')} loading="lazy" decoding="async" alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />}
            <span className="relative block">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[color:color-mix(in_srgb,var(--site-on-fill)_70%,transparent)] md:text-xs md:tracking-[0.22em]">Offer</p>
            <h3 className="mt-2 text-lg font-black md:mt-3 md:text-2xl">{title}</h3>
            <p className="mt-2 text-sm font-semibold text-[color:color-mix(in_srgb,var(--site-on-fill)_80%,transparent)]">{subtitle}</p>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
