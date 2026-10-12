import { responsiveImage } from '../../utils/responsiveImages';

export default function CategoryStrip({ navigate, categories = [] }) {
  const rootCategories = (categories || []).filter((category) => !category.parent);
  const visibleCategories = (rootCategories.length ? rootCategories : categories || []).slice(0, 8);

  return (
    <section className="grid gap-3 xl:grid-cols-[150px_1fr_120px] xl:items-stretch">
      <div className="flex items-center justify-center rounded-[16px] border border-[color:var(--site-accent-border)] bg-[color:var(--site-accent-soft)] px-4 py-4 text-center shadow-[0_6px_16px_rgb(var(--site-shadow-rgb)/0.03)]">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-wine xl:text-[11px]">Shop by</p>
          <h2 className="mt-2 text-[23px] font-semibold leading-[1] text-charcoal xl:text-[27px]">Category</h2>
          <div className="mx-auto mt-3 h-px w-16 bg-[color:var(--site-tint)]" />
        </div>
      </div>

      <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-1">
        {visibleCategories.map((category) => {
          const categoryId = category._id || category.id || category.slug || '';
          return (
            <button
              key={categoryId || category.name}
              type="button"
              onClick={() => navigate(`/products?category=${categoryId}`)}
              className="group min-w-[94px] max-w-[94px] flex-1 text-left xl:min-w-[102px] xl:max-w-[102px]"
            >
              <div className="overflow-hidden rounded-[12px] border border-[color:var(--site-accent-border)] bg-[color:var(--site-accent-soft)] shadow-[0_6px_14px_rgb(var(--site-shadow-rgb)/0.03)]">
                <div className="aspect-[0.95]">
                  {category.image ? (
                    <img {...responsiveImage(category.imageMedia || category.image, 'category')} loading="lazy" decoding="async" alt={category.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-[color:var(--site-tint)] to-[color:var(--site-tint)] text-[11px] font-bold uppercase tracking-[0.08em] text-wine xl:text-[12px]">
                      {String(category.name || 'SC').slice(0, 2)}
                    </div>
                  )}
                </div>
              </div>
              <p className="mt-2 truncate text-center text-[10px] font-semibold text-charcoal xl:text-[12px]">{category.name}</p>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => navigate('/products?discount=50')}
        className="overflow-hidden rounded-[16px] border border-theme-border bg-wine px-4 py-4 text-left text-[color:var(--site-on-fill)] shadow-[0_10px_20px_rgb(var(--site-shadow-rgb)/0.14)]"
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[color:color-mix(in_srgb,var(--site-on-fill)_65%,transparent)] xl:text-[11px]">Sale</p>
        <h3 className="mt-2 text-[22px] font-semibold leading-[1.02] xl:text-[26px]">Up to 50% off</h3>
        <p className="mt-2 text-[11px] leading-4 text-[color:color-mix(in_srgb,var(--site-on-fill)_82%,transparent)] xl:text-[12px]">View all categories & festive offers</p>
      </button>
    </section>
  );
}
