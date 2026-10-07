import { splitFilterValues, toggleFilterValue } from '../../store/catalogSlice';

const filterGroups = [
  { title: 'Size', param: 'size', items: ['XS', 'S', 'M', 'L', 'XL', 'Free Size'] },
  { title: 'Color', param: 'color', items: ['Wine', 'Blush', 'Gold', 'Ivory', 'Black', 'Emerald', 'Navy', 'Rose'] },
  { title: 'Fabric', param: 'fabric', items: ['Silk', 'Cotton', 'Georgette', 'Organza', 'Velvet', 'Rayon', 'Crepe', 'Net'] },
  { title: 'Occasion', param: 'occasion', items: ['Wedding', 'Festive', 'Daily Wear', 'Party'] },
  { title: 'Discount', param: 'discount', items: [['10', '10% and above'], ['20', '20% and above'], ['40', '40% and above']] },
  { title: 'Rating', param: 'rating', items: [['4', '4 star and above'], ['3', '3 star and above']] },
];

export default function ProductFilters({ categories = [], params = new URLSearchParams(), updateParam, clearFilters }) {
  const visibleCategories = categories || [];
  const setFilter = (param, value) => {
    updateParam?.(param, value);
  };

  return (
    <aside className="w-full shrink-0 rounded-2xl bg-white p-4 shadow-sm lg:w-64 xl:w-72 xl:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-black uppercase tracking-[0.2em] text-charcoal">Filters</h2>
        <button type="button" onClick={clearFilters} className="text-xs font-black text-rose">Clear</button>
      </div>
      <div className="mt-5 space-y-6">
        <FilterGroup
          title="Category"
          param="category"
          active={params.get('category') || ''}
          items={visibleCategories.map((category) => [category._id || category.id || category.slug || category.name, category.name])}
          onChange={setFilter}
          multiple
        />
        {filterGroups.map((group) => (
          <FilterGroup
            key={group.param}
            title={group.title}
            param={group.param}
            active={params.get(group.param) || ''}
            items={group.items}
            onChange={setFilter}
          />
        ))}
        <label className="flex items-center gap-3 text-sm font-semibold text-slate-600">
          <input
            type="checkbox"
            checked={params.get('stock') === 'in'}
            onChange={(event) => setFilter('stock', event.target.checked ? 'in' : '')}
            className="accent-rose"
          />
          In stock only
        </label>
      </div>
    </aside>
  );
}

function FilterGroup({ title, param, active, items, onChange, multiple = false }) {
  const selectedValues = new Set(splitFilterValues(active));
  return (
    <div>
      <h3 className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-slate-500">{title}</h3>
      <div className="grid gap-2">
        {items.map((item) => {
          const value = String(Array.isArray(item) ? item[0] : item);
          return (
            <label key={value} className="flex items-center gap-3 text-sm font-semibold text-slate-600">
              <input
                type="checkbox"
                checked={multiple ? selectedValues.has(value) : active === value}
                onChange={(event) => onChange(param, multiple ? toggleFilterValue(active, value) : (event.target.checked ? value : ''))}
                className="accent-rose"
              />
              {Array.isArray(item) ? item[1] : item}
            </label>
          );
        })}
      </div>
    </div>
  );
}
