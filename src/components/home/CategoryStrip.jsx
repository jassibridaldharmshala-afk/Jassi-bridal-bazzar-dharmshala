import { normalizeImageUrl } from '../../services/normalize';

export default function CategoryStrip({ navigate, categories = [] }) {
  const rootCategories = (categories || []).filter((category) => !category.parent);
  const visibleCategories = (rootCategories.length ? rootCategories : categories || []).slice(0, 8);

  return (
    <section className="grid gap-3 xl:grid-cols-[150px_1fr_120px] xl:items-stretch">
      <div className="flex items-center justify-center rounded-[16px] border border-[#f0e1d7] bg-[#fffaf6] px-4 py-4 text-center shadow-[0_6px_16px_rgba(23,22,26,0.03)]">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-wine xl:text-[11px]">Shop by</p>
          <h2 className="mt-2 text-[23px] font-semibold leading-[1] text-charcoal xl:text-[27px]">Category</h2>
          <div className="mx-auto mt-3 h-px w-16 bg-[#d8b8c0]" />
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
              <div className="overflow-hidden rounded-[12px] border border-[#f0e1d7] bg-[#faf4ee] shadow-[0_6px_14px_rgba(23,22,26,0.03)]">
                <div className="aspect-[0.95]">
                  {category.image ? (
                    <img src={normalizeImageUrl(category.image)} alt={category.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-[#f6e6d7] to-[#edd2c1] text-[11px] font-bold uppercase tracking-[0.08em] text-wine xl:text-[12px]">
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
        className="overflow-hidden rounded-[16px] border border-theme-border bg-wine px-4 py-4 text-left text-white shadow-[0_10px_20px_rgba(122,31,54,0.14)]"
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/65 xl:text-[11px]">Sale</p>
        <h3 className="mt-2 text-[22px] font-semibold leading-[1.02] xl:text-[26px]">Up to 50% off</h3>
        <p className="mt-2 text-[11px] leading-4 text-white/82 xl:text-[12px]">View all categories & festive offers</p>
      </button>
    </section>
  );
}
