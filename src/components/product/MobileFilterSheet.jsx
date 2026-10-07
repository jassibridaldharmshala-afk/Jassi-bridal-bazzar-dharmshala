import { useEffect, useMemo, useRef, useState } from 'react';
import { Boxes, CalendarHeart, ChevronDown, Grid3X3, Palette, Percent, Ruler, SlidersHorizontal, Sparkles, Star, Tag, X } from 'lucide-react';
import { splitFilterValues, toggleFilterValue } from '../../store/catalogSlice';
import { getColorSwatch } from '../../utils/catalogFacets';
import { normalizeImageUrl } from '../../services/normalize';
import './MobileFilterSheet.css';

const navItems = [
  { key: 'category', label: 'Category', icon: Grid3X3 },
  { key: 'size', label: 'Size', icon: Ruler },
  { key: 'price', label: 'Price', icon: SlidersHorizontal },
  { key: 'color', label: 'Color', icon: Palette },
  { key: 'fabric', label: 'Fabric', icon: Sparkles },
  { key: 'occasion', label: 'Occasion', icon: CalendarHeart },
  { key: 'discount', label: 'Discount', icon: Percent },
  { key: 'rating', label: 'Rating', icon: Star },
  { key: 'stock', label: 'Availability', icon: Boxes },
  { key: 'sort', label: 'Sort By', icon: Tag },
];

const filterConfig = {
  sort: [
    { value: 'newest', label: 'Latest' },
    { value: 'bestSeller', label: 'Popular' },
    { value: 'priceLowHigh', label: 'Price Low to High' },
    { value: 'priceHighLow', label: 'Price High to Low' },
    { value: 'discount', label: 'Discount' },
    { value: 'rating', label: 'Rating' },
  ],
};

export default function MobileFilterSheet({ open, onClose, categories = [], params, applyDraftFilters, dynamicFacets = [], facets = {}, totalResults = 0 }) {
  const [activeSection, setActiveSection] = useState('category');
  const [draft, setDraft] = useState(() => buildDraft(params));
  const dialogRef = useRef(null);
  const overlayRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [expanded, setExpanded] = useState({
    size: true,
    price: true,
    color: false,
    fabric: false,
    discount: false,
    sort: false,
  });

  useEffect(() => {
    if (!open) return;
    setDraft(buildDraft(params));
    setActiveSection('category');
  }, [open, params]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => dialogRef.current?.focus(), 0);
    // Mobile keyboards (especially iOS) can resize the visual viewport without
    // resizing the layout viewport. Keep the footer above the keyboard.
    const viewport = window.visualViewport;
    const syncViewport = () => {
      if (!overlayRef.current || !viewport) return;
      const unzoomed = !viewport.scale || viewport.scale === 1;
      overlayRef.current.style.height = unzoomed ? `${viewport.height}px` : '';
      overlayRef.current.style.top = unzoomed ? `${viewport.offsetTop}px` : '';
    };
    syncViewport();
    viewport?.addEventListener('resize', syncViewport);
    viewport?.addEventListener('scroll', syncViewport);
    const desktop = window.matchMedia?.('(min-width: 1024px)');
    const closeOnDesktop = (event) => { if (event.matches) closeRef.current?.(); };
    desktop?.addEventListener?.('change', closeOnDesktop);
    const onKeyDown = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current?.(); return; }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      const outside = !dialogRef.current.contains(document.activeElement) || document.activeElement === dialogRef.current;
      if (event.shiftKey && (document.activeElement === first || outside)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || outside)) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', onKeyDown);
      viewport?.removeEventListener('resize', syncViewport);
      viewport?.removeEventListener('scroll', syncViewport);
      desktop?.removeEventListener?.('change', closeOnDesktop);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, [open]);

  const selectedCount = useMemo(() => {
    const multiKeys = ['category', 'size', 'color', 'fabric', 'occasion', ...dynamicFacets.map((facet) => `attr_${facet.key}`)];
    const multiCount = multiKeys.reduce((count, key) => count + splitFilterValues(draft[key]).length, 0);
    const singleCount = ['discount', 'rating', 'stock'].reduce((count, key) => count + (draft[key] ? 1 : 0), 0);
    return multiCount + singleCount + (draft.minPrice || draft.maxPrice ? 1 : 0);
  }, [draft, dynamicFacets]);
  const visibleNavItems = [...navItems.filter((item) => {
    if (['price', 'sort', 'category'].includes(item.key)) return true;
    const facetKey = item.key === 'stock' ? 'availability' : `${item.key}s`;
    return (facets[facetKey] || []).some((option) => option.count > 0 || splitFilterValues(draft[item.key]).includes(String(option.value)));
  }), ...dynamicFacets.map((facet) => ({ key: `attr_${facet.key}`, label: facet.label, icon: Tag }))];

  if (!open) return null;

  const applyFilters = () => {
    applyDraftFilters?.(draft);
    onClose?.();
  };

  const resetFilters = () => {
    // Apply merges this draft with URL filters: explicit empty values are needed
    // to clear custom attributes as well as the built-in filters.
    setDraft((current) => ({
      ...buildDraft(new URLSearchParams()),
      ...Object.fromEntries([
        ...Object.keys(current).filter((key) => key.startsWith('attr_')),
        ...dynamicFacets.map((facet) => `attr_${facet.key}`),
      ].map((key) => [key, ''])),
    }));
  };

  return (
    <div ref={overlayRef} className="mobile-filter-overlay z-[80] bg-black/40 lg:hidden" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="mobile-filter-title" className="mobile-filter-sheet bg-white shadow-2xl outline-none">
        <header className="mobile-filter__header">
          <div className="flex justify-center pt-2">
            <div className="h-1 w-12 rounded-full bg-slate-200" />
          </div>

          <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 pb-3 pt-3">
            <div className="min-w-0">
              <h2 id="mobile-filter-title" className="text-[22px] font-bold text-charcoal">Filters</h2>
              <p className="mt-1 text-[11px] text-slate-500">{selectedCount} selected · {totalResults} current results</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" onClick={resetFilters} className="min-h-11 text-[11px] font-bold text-wine">
                Clear All
              </button>
              <button type="button" onClick={onClose} aria-label="Close filters" className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-500">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        <div className="mobile-filter__body">
          <aside className="mobile-filter__nav border-r border-slate-100 bg-ivory px-2 py-3" aria-label="Filter sections">
            <div className="space-y-1.5">
              {visibleNavItems.map((item) => {
                const active = activeSection === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setActiveSection(item.key)}
                    className={`flex min-h-11 w-full items-center gap-2 rounded-xl px-2 py-2.5 text-left ${active ? 'bg-blush text-wine' : 'text-charcoal'}`}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="mobile-filter__label text-[11px] font-semibold">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="mobile-filter__content px-4 py-3" key={activeSection}>
            {activeSection === 'category' && (
              <FilterSection title="Category">
                <div className="space-y-2">
                  {categories.map((category) => {
                    const value = category._id || category.id || category.slug || category.name;
                    const selected = splitFilterValues(draft.category).includes(String(value));
                    const count = Number((facets.categories || []).find((item) => String(item.value) === String(value))?.count || 0);
                    return (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={selected}
                        disabled={!count && !selected}
                        onClick={() => setDraft((current) => ({ ...current, category: toggleFilterValue(current.category, value) }))}
                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2.5 text-left disabled:opacity-40"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          {category.image ? <img src={normalizeImageUrl(category.image)} alt="" className="h-10 w-8 shrink-0 rounded-md bg-blush object-cover" /> : <div className="h-10 w-8 shrink-0 rounded-md bg-blush" />}
                          <span className="mobile-filter__label text-[13px] font-medium text-charcoal">{category.name} <small className="text-slate-400">({count})</small></span>
                        </div>
                        <span className={`mobile-filter__mark grid h-4 w-4 place-items-center rounded-[4px] border ${selected ? 'border-wine bg-wine' : 'border-slate-300 bg-white'}`}>
                          {selected ? <span className="h-1.5 w-1.5 rounded-[2px] bg-white" /> : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </FilterSection>
            )}

            {activeSection === 'size' && (
              <FilterSection>
                <Accordion title="Size" open={expanded.size} onToggle={() => toggleExpanded('size', setExpanded)}>
                  <SelectionCardList
                    items={facets.sizes || []}
                    value={draft.size}
                    onChange={(value) => setDraft((current) => ({ ...current, size: toggleFilterValue(current.size, value) }))}
                  />
                </Accordion>
              </FilterSection>
            )}

            {activeSection === 'price' && (
              <FilterSection>
                <Accordion title="Price" open={expanded.price} onToggle={() => toggleExpanded('price', setExpanded)}>
                  <div className="mobile-filter__prices">
                    <PriceInput label="Min Price" value={draft.minPrice} onChange={(value) => setDraft((current) => ({ ...current, minPrice: digitsOnly(value) }))} />
                    <PriceInput label="Max Price" value={draft.maxPrice} onChange={(value) => setDraft((current) => ({ ...current, maxPrice: digitsOnly(value) }))} />
                  </div>
                </Accordion>
              </FilterSection>
            )}

            {activeSection === 'color' && (
              <FilterSection>
                <Accordion title="Color" open={expanded.color} onToggle={() => toggleExpanded('color', setExpanded)}>
                  <ColorOptionList
                    items={facets.colors || []}
                    value={draft.color}
                    onChange={(value) => setDraft((current) => ({ ...current, color: toggleFilterValue(current.color, value) }))}
                  />
                </Accordion>
              </FilterSection>
            )}

            {activeSection === 'fabric' && (
              <FilterSection>
                <Accordion title="Fabric" open={expanded.fabric} onToggle={() => toggleExpanded('fabric', setExpanded)}>
                  <CheckboxList
                    items={facets.fabrics || []}
                    value={draft.fabric}
                    onChange={(value) => setDraft((current) => ({ ...current, fabric: toggleFilterValue(current.fabric, value) }))}
                  />
                </Accordion>
              </FilterSection>
            )}

            {activeSection === 'occasion' && <FilterSection title="Occasion"><DynamicFilterOptions items={facets.occasions || []} value={draft.occasion} onChange={(value) => setDraft((current) => ({ ...current, occasion: toggleFilterValue(current.occasion, value) }))} /></FilterSection>}

            {activeSection === 'discount' && (
              <FilterSection>
                <Accordion title="Discount" open={expanded.discount} onToggle={() => toggleExpanded('discount', setExpanded)}>
                  <CheckboxList
                    items={facets.discounts || []}
                    value={draft.discount}
                    onChange={(value) => setDraft((current) => ({ ...current, discount: current.discount === value ? '' : value }))}
                  />
                </Accordion>
              </FilterSection>
            )}

            {activeSection === 'rating' && <FilterSection title="Customer rating"><CheckboxList items={facets.ratings || []} value={draft.rating} onChange={(value) => setDraft((current) => ({ ...current, rating: current.rating === value ? '' : value }))} /></FilterSection>}

            {activeSection === 'stock' && <FilterSection title="Availability"><CheckboxList items={facets.availability || []} value={draft.stock} onChange={(value) => setDraft((current) => ({ ...current, stock: current.stock === value ? '' : value }))} /></FilterSection>}

            {activeSection === 'sort' && (
              <FilterSection>
                <Accordion title="Sort By" open={expanded.sort} onToggle={() => toggleExpanded('sort', setExpanded)}>
                  <CheckboxList
                    items={filterConfig.sort}
                    value={draft.sort}
                    onChange={(value) => setDraft((current) => ({ ...current, sort: current.sort === value ? '' : value }))}
                  />
                </Accordion>
              </FilterSection>
            )}

            {dynamicFacets.map((facet) => activeSection === `attr_${facet.key}` ? (
              <FilterSection key={facet.key} title={facet.label}>
                <DynamicFilterOptions
                  items={facet.options}
                  value={draft[`attr_${facet.key}`] || ''}
                  onChange={(value) => setDraft((current) => ({ ...current, [`attr_${facet.key}`]: toggleFilterValue(current[`attr_${facet.key}`], value) }))}
                />
              </FilterSection>
            ) : null)}
          </div>
        </div>

        <footer className="mobile-filter__footer grid grid-cols-2 gap-3 border-t border-slate-100 bg-white px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
          <button type="button" onClick={resetFilters} className="min-h-12 min-w-0 rounded-lg border border-slate-300 px-2 py-3 text-[14px] font-semibold text-charcoal">
            Reset
          </button>
          <button type="button" onClick={applyFilters} className="min-h-12 min-w-0 rounded-lg bg-wine px-2 py-3 text-[14px] font-semibold text-white">
            Apply Filters
          </button>
        </footer>
      </div>
    </div>
  );
}

function FilterSection({ title, children }) {
  return (
    <section className="min-w-0">
      {title ? <h3 className="mobile-filter__label mb-3 text-[11px] font-bold uppercase tracking-[0.08em] text-charcoal">{title}</h3> : null}
      {children}
    </section>
  );
}

function Accordion({ title, open, onToggle, children }) {
  return (
    <div className="border-b border-slate-100">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-h-11 w-full items-center justify-between gap-2 py-3 text-left text-[13px] font-semibold text-charcoal">
        <span className="mobile-filter__label">{title}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? <div className="pb-3">{children}</div> : null}
    </div>
  );
}

function CheckboxList({ items, value, onChange }) {
  return (
    <div className="space-y-2">
      {items.map((item) => {
        const selected = value === item.value;
        return (
          <button
            key={item.value || 'all'}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(item.value)}
            className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-1 py-1.5 text-left"
          >
            <span className="mobile-filter__label text-[13px] text-charcoal">{item.label}</span>
            <span className={`mobile-filter__mark grid h-4 w-4 place-items-center rounded-[4px] border ${selected ? 'border-wine bg-wine' : 'border-slate-300 bg-white'}`}>
              {selected ? <span className="h-1.5 w-1.5 rounded-[2px] bg-white" /> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function SelectionCardList({ items, value, onChange }) {
  const selectedValues = new Set(splitFilterValues(value).map((item) => item.toLowerCase()));
  return (
    <div className="space-y-2.5">
      {items.map((item) => {
        const selected = selectedValues.has(String(item.value).toLowerCase());
        const disabled = !item.count && !selected;
        return (
          <button
            key={item.value}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onChange(item.value)}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#f0e7e2] bg-white px-4 py-3 text-left shadow-[0_2px_8px_rgba(15,23,42,0.03)] disabled:opacity-40"
          >
            <span className="mobile-filter__label text-[13px] font-medium text-charcoal">{item.label} <small className="text-slate-400">({item.count || 0})</small></span>
            <span className={`mobile-filter__mark grid h-4 w-4 place-items-center rounded-[4px] border ${selected ? 'border-wine bg-wine' : 'border-slate-300 bg-white'}`}>
              {selected ? <span className="h-1.5 w-1.5 rounded-[2px] bg-white" /> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ColorOptionList({ items, value, onChange }) {
  const selectedValues = new Set(splitFilterValues(value).map((item) => item.toLowerCase()));
  return (
    <div className="space-y-2">
      {items.map((item) => {
        const selected = selectedValues.has(String(item.value).toLowerCase());
        const disabled = !item.count && !selected;
        return (
          <button
            key={item.value}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onChange(item.value)}
            className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-1 py-1.5 text-left disabled:opacity-40"
          >
            <span className="flex min-w-0 flex-1 items-center gap-3">
              <span
                className={`h-4 w-4 shrink-0 rounded-full border border-white shadow-sm ring-1 ${selected ? 'ring-wine' : 'ring-slate-300'}`}
                style={{ backgroundColor: getColorSwatch(item.value) }}
              />
              <span className="mobile-filter__label text-[13px] text-charcoal">{item.label} <small className="text-slate-400">({item.count || 0})</small></span>
            </span>
            <span className={`mobile-filter__mark grid h-4 w-4 place-items-center rounded-[4px] border ${selected ? 'border-wine bg-wine' : 'border-slate-300 bg-white'}`}>
              {selected ? <span className="h-1.5 w-1.5 rounded-[2px] bg-white" /> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function PriceInput({ label, value, onChange }) {
  return (
    <label className="grid min-w-0 gap-1">
      <span className="mobile-filter__label text-[11px] font-medium text-slate-500">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mobile-filter__price-input h-11 rounded-lg border border-slate-200 px-3 text-charcoal"
        placeholder="0"
        inputMode="numeric"
      />
    </label>
  );
}

function DynamicFilterOptions({ items = [], value, onChange }) {
  const selected = new Set(splitFilterValues(value).map((item) => item.toLowerCase()));
  return <div className="space-y-2">{items.map((item) => {
    const active = selected.has(String(item.value).toLowerCase());
    return <button key={item.value} type="button" aria-pressed={active} disabled={!item.count && !active} onClick={() => onChange(item.value)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-3 text-left disabled:opacity-40"><span className="mobile-filter__label text-[13px] text-charcoal">{item.label} <small className="text-slate-400">({item.count})</small></span><span className={`mobile-filter__mark grid h-4 w-4 place-items-center rounded-[4px] border ${active ? 'border-wine bg-wine' : 'border-slate-300 bg-white'}`}>{active ? <span className="h-1.5 w-1.5 rounded-[2px] bg-white" /> : null}</span></button>;
  })}</div>;
}

function buildDraft(params) {
  const draft = {
    category: params?.get?.('category') || '',
    size: params?.get?.('size') || '',
    color: params?.get?.('color') || '',
    fabric: params?.get?.('fabric') || '',
    occasion: params?.get?.('occasion') || '',
    discount: params?.get?.('discount') || '',
    rating: params?.get?.('rating') || '',
    stock: params?.get?.('stock') || '',
    sort: params?.get?.('sort') || '',
    minPrice: params?.get?.('minPrice') || '',
    maxPrice: params?.get?.('maxPrice') || '',
  };
  if (params?.entries) Array.from(params.entries()).forEach(([key, value]) => { if (key.startsWith('attr_')) draft[key] = value; });
  return draft;
}

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function toggleExpanded(key, setExpanded) {
  setExpanded((current) => ({ ...current, [key]: !current[key] }));
}
