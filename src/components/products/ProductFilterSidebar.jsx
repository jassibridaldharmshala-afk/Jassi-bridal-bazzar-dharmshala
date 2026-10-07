import { useMemo, useState } from 'react';
import { ChevronDown, Filter, Search, Star, X } from 'lucide-react';
import { splitFilterValues, toggleFilterValue } from '../../store/catalogSlice';
import { getColorSwatch } from '../../utils/catalogFacets';
import './ProductFilterSidebar.css';

const MULTI_FILTERS = ['category', 'size', 'color', 'fabric', 'occasion'];

export default function ProductFilterSidebar({
  facets = {},
  filters = {},
  onFilterChange,
  onFiltersChange,
  onClearAll,
  dynamicFacets = [],
}) {
  const [categorySearch, setCategorySearch] = useState('');
  const [colorSearch, setColorSearch] = useState('');
  const selected = useMemo(() => ({
    category: toSelectionSet(filters.category),
    size: toSelectionSet(filters.size),
    color: toSelectionSet(filters.color),
    fabric: toSelectionSet(filters.fabric),
    occasion: toSelectionSet(filters.occasion),
  }), [filters.category, filters.size, filters.color, filters.fabric, filters.occasion]);
  const appliedFilters = useMemo(() => buildAppliedFilters(filters, facets, dynamicFacets), [filters, facets, dynamicFacets]);
  const activeCount = appliedFilters.length;
  const update = (key, value) => onFilterChange?.(key, value);
  const updateMany = (values) => {
    if (onFiltersChange) onFiltersChange(values);
    else Object.entries(values).forEach(([key, value]) => update(key, value));
  };
  const toggleMulti = (key, value) => update(key, toggleFilterValue(filters[key], value));
  const removeAppliedFilter = (item) => {
    if (item.key === 'price') {
      updateMany({ minPrice: '', maxPrice: '' });
      return;
    }
    if (MULTI_FILTERS.includes(item.key) || item.key.startsWith('attr_')) {
      toggleMulti(item.key, item.value);
      return;
    }
    update(item.key, '');
  };

  const visibleCategories = filterOptions(facets.categories, categorySearch);
  const visibleColors = filterOptions(facets.colors, colorSearch);
  const activePrice = filters.minPrice || filters.maxPrice
    ? `${filters.minPrice || ''}:${filters.maxPrice || ''}`
    : '';

  return (
    <aside className="sc-filter" aria-label="Product filters">
      <div className="sc-filter__header">
        <div className="sc-filter__title">
          <Filter aria-hidden="true" />
          <span>Filters</span>
          {activeCount ? <span className="sc-filter__active-count">{activeCount}</span> : null}
        </div>
        {activeCount ? (
          <button type="button" className="sc-filter__clear" onClick={onClearAll}>Clear all</button>
        ) : null}
      </div>

      {appliedFilters.length ? (
        <div className="sc-filter__applied" aria-label="Applied filters">
          <p>Applied filters</p>
          <div className="sc-filter__chips">
            {appliedFilters.map((item) => (
              <button
                type="button"
                key={`${item.key}-${item.value}`}
                className="sc-filter__chip"
                onClick={() => removeAppliedFilter(item)}
                aria-label={`Remove ${item.label} filter`}
              >
                <span>{item.label}</span>
                <X aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {facets.categories?.length ? (
        <FilterSection title="Categories" defaultOpen>
          {facets.categories.length > 6 ? (
            <FilterSearch label="Search categories" value={categorySearch} onChange={setCategorySearch} />
          ) : null}
          <CheckboxList
            options={visibleCategories}
            selected={selected.category}
            onToggle={(value) => toggleMulti('category', value)}
            emptyText="No matching categories"
            limit={8}
          />
        </FilterSection>
      ) : null}

      {facets.prices?.length ? (
        <FilterSection title="Price" defaultOpen>
          <RadioList
            name="desktop-price"
            options={facets.prices}
            selected={activePrice}
            onSelect={(option) => {
              if (activePrice === option.value) updateMany({ minPrice: '', maxPrice: '' });
              else updateMany({ minPrice: String(option.min), maxPrice: String(option.max) });
            }}
          />
        </FilterSection>
      ) : null}

      {facets.discounts?.some((option) => option.count > 0) ? (
        <FilterSection title="Discount range" defaultOpen>
          <RadioList
            name="desktop-discount"
            options={facets.discounts}
            selected={filters.discount || ''}
            onSelect={(option) => update('discount', filters.discount === option.value ? '' : option.value)}
          />
        </FilterSection>
      ) : null}

      {facets.sizes?.length ? (
        <FilterSection title="Size" defaultOpen>
          <div className="sc-filter__sizes">
            {facets.sizes.map((option) => {
              const isSelected = selected.size.has(normalizeKey(option.value));
              return (
                <label key={option.value} className={`sc-filter__size${isSelected ? ' is-selected' : ''}${!option.count && !isSelected ? ' is-disabled' : ''}`}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={!option.count && !isSelected}
                    onChange={() => toggleMulti('size', option.value)}
                  />
                  <span>{option.label}</span>
                  <small>({option.count})</small>
                </label>
              );
            })}
          </div>
        </FilterSection>
      ) : null}

      {facets.colors?.length ? (
        <FilterSection title="Color" defaultOpen>
          {facets.colors.length > 7 ? (
            <FilterSearch label="Search colors" value={colorSearch} onChange={setColorSearch} />
          ) : null}
          <CheckboxList
            options={visibleColors}
            selected={selected.color}
            onToggle={(value) => toggleMulti('color', value)}
            emptyText="No matching colors"
            limit={8}
            renderLeading={(option) => (
              <span
                className="sc-filter__color-dot"
                style={{ backgroundColor: getColorSwatch(option.label) }}
                aria-hidden="true"
              />
            )}
          />
        </FilterSection>
      ) : null}

      {facets.fabrics?.length ? (
        <FilterSection title="Fabric">
          <CheckboxList
            options={facets.fabrics}
            selected={selected.fabric}
            onToggle={(value) => toggleMulti('fabric', value)}
            limit={7}
          />
        </FilterSection>
      ) : null}

      {facets.occasions?.length ? (
        <FilterSection title="Occasion">
          <CheckboxList
            options={facets.occasions}
            selected={selected.occasion}
            onToggle={(value) => toggleMulti('occasion', value)}
            limit={7}
          />
        </FilterSection>
      ) : null}

      {dynamicFacets.map((facet) => (
        <FilterSection key={facet.key} title={facet.label}>
          <CheckboxList
            options={facet.options}
            selected={toSelectionSet(filters[`attr_${facet.key}`])}
            onToggle={(value) => toggleMulti(`attr_${facet.key}`, value)}
            limit={8}
          />
        </FilterSection>
      ))}

      {facets.ratings?.some((option) => option.count > 0) ? (
        <FilterSection title="Customer ratings">
          <RadioList
            name="desktop-rating"
            options={facets.ratings}
            selected={filters.rating || ''}
            onSelect={(option) => update('rating', filters.rating === option.value ? '' : option.value)}
            renderLabel={(option) => (
              <span className="sc-filter__rating-label">
                {option.value}<Star aria-hidden="true" /> & above
              </span>
            )}
          />
        </FilterSection>
      ) : null}

      <FilterSection title="Availability">
        <RadioList
          name="desktop-stock"
          options={facets.availability || []}
          selected={filters.stock || ''}
          onSelect={(option) => update('stock', filters.stock === option.value ? '' : option.value)}
        />
      </FilterSection>
    </aside>
  );
}

function FilterSection({ title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = `desktop-filter-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <section className={`sc-filter__section${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="sc-filter__summary"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{title}</span>
        <ChevronDown aria-hidden="true" />
      </button>
      {open ? <div id={panelId} className="sc-filter__panel">{children}</div> : null}
    </section>
  );
}

function CheckboxList({ options = [], selected, onToggle, renderLeading, emptyText = '', limit = 0 }) {
  const [showAll, setShowAll] = useState(false);
  const displayedOptions = limit && !showAll ? options.slice(0, limit) : options;

  if (!options.length) return emptyText ? <p className="sc-filter__empty">{emptyText}</p> : null;

  return (
    <div className="sc-filter__list">
      {displayedOptions.map((option) => {
        const isSelected = selected.has(normalizeKey(option.value));
        const disabled = !option.count && !isSelected;
        return (
          <label key={option.value} className={`sc-filter__row${disabled ? ' is-disabled' : ''}`}>
            <span className="sc-filter__row-main">
              <input
                type="checkbox"
                checked={isSelected}
                disabled={disabled}
                onChange={() => onToggle(option.value)}
              />
              <span className="sc-filter__checkbox" aria-hidden="true" />
              {renderLeading?.(option)}
              <span className="sc-filter__option-label">{option.label}</span>
            </span>
            <span className="sc-filter__count">({option.count})</span>
          </label>
        );
      })}
      {limit && options.length > limit ? (
        <button type="button" className="sc-filter__more" onClick={() => setShowAll((current) => !current)}>
          {showAll ? 'Show less' : `+ ${options.length - limit} more`}
        </button>
      ) : null}
    </div>
  );
}

function RadioList({ options = [], selected, onSelect, name, renderLabel }) {
  return (
    <div className="sc-filter__list">
      {options.map((option) => {
        const isSelected = selected === option.value;
        const disabled = !option.count && !isSelected;
        return (
          <label key={option.value} className={`sc-filter__row${disabled ? ' is-disabled' : ''}`}>
            <span className="sc-filter__row-main">
              <input
                type="radio"
                name={name}
                checked={isSelected}
                disabled={disabled}
                onClick={() => isSelected && onSelect(option)}
                onChange={() => !isSelected && onSelect(option)}
              />
              <span className="sc-filter__radio" aria-hidden="true" />
              <span className="sc-filter__option-label">{renderLabel ? renderLabel(option) : option.label}</span>
            </span>
            <span className="sc-filter__count">({option.count})</span>
          </label>
        );
      })}
    </div>
  );
}

function FilterSearch({ label, value, onChange }) {
  return (
    <label className="sc-filter__search">
      <Search aria-hidden="true" />
      <span className="sr-only">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={label} />
      {value ? (
        <button type="button" aria-label={`Clear ${label.toLowerCase()}`} onClick={() => onChange('')}>
          <X aria-hidden="true" />
        </button>
      ) : null}
    </label>
  );
}

function filterOptions(options = [], query = '') {
  const term = query.trim().toLowerCase();
  if (!term) return options;
  return options.filter((option) => option.label.toLowerCase().includes(term));
}

function buildAppliedFilters(filters, facets, dynamicFacets = []) {
  const labelsByKey = {
    category: toLabelMap(facets.categories),
    size: toLabelMap(facets.sizes),
    color: toLabelMap(facets.colors),
    fabric: toLabelMap(facets.fabrics),
    occasion: toLabelMap(facets.occasions),
  };
  const applied = [];

  MULTI_FILTERS.forEach((key) => {
    splitFilterValues(filters[key]).forEach((value) => {
      applied.push({ key, value, label: labelsByKey[key].get(normalizeKey(value)) || value });
    });
  });

  dynamicFacets.forEach((facet) => {
    const filterKey = `attr_${facet.key}`;
    const labels = toLabelMap(facet.options);
    splitFilterValues(filters[filterKey]).forEach((value) => {
      applied.push({ key: filterKey, value, label: `${facet.label}: ${labels.get(normalizeKey(value)) || value}` });
    });
  });

  if (filters.minPrice || filters.maxPrice) {
    const minimum = filters.minPrice ? `₹${formatIndian(filters.minPrice)}` : 'Any';
    const maximum = filters.maxPrice ? `₹${formatIndian(filters.maxPrice)}` : 'Any';
    applied.push({ key: 'price', value: `${filters.minPrice}:${filters.maxPrice}`, label: `${minimum} – ${maximum}` });
  }
  if (filters.discount) applied.push({ key: 'discount', value: filters.discount, label: `${filters.discount}%+ off` });
  if (filters.rating) applied.push({ key: 'rating', value: filters.rating, label: `${filters.rating}★ & above` });
  if (filters.stock) applied.push({ key: 'stock', value: filters.stock, label: filters.stock === 'in' ? 'In stock' : 'Out of stock' });

  return applied;
}

function toLabelMap(options = []) {
  return new Map(options.map((option) => [normalizeKey(option.value), option.label]));
}

function toSelectionSet(value) {
  return new Set(splitFilterValues(value).map(normalizeKey));
}

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase();
}

function formatIndian(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number.toLocaleString('en-IN') : value;
}
