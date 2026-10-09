import { useEffect, useState } from 'react';
import { Search, SlidersHorizontal, ShoppingBag } from 'lucide-react';
import api from '../../services/api';
import { useStorefront } from '../../context/StorefrontContext';
import { useRentalBag } from '../../context/RentalBagContext';
import { rentalUrl } from '../../utils/rentals';
import { storefrontPath } from '../../utils/routing';
import ProductGrid from '../../components/product/ProductGrid';
import ShoppingModeTabs from '../../components/rentals/ShoppingModeTabs';

export default function RentalShop({ navigate, route = '/rental-book' }) {
  const { storeSlug } = useStorefront(); const bag = useRentalBag();
  const query = new URLSearchParams(route.split('?')[1] || '');
  const search = query.get('search') || '', category = query.get('category') || '', colour = query.get('colour') || '', sort = query.get('sort') || 'title', minRent = query.get('minRent') || '', maxRent = query.get('maxRent') || '';
  const [page, setPage] = useState(1), [data, setData] = useState(null), [rows, setRows] = useState([]), [error, setError] = useState(''), [retry, setRetry] = useState(0), [loading, setLoading] = useState(false), [filtersOpen, setFiltersOpen] = useState(false), [categories, setCategories] = useState([]);
  const [searchText, setSearchText] = useState(search);
  const filterKey = `${storeSlug}:${search}:${category}:${colour}:${sort}:${minRent}:${maxRent}`;
  const [loadedKey, setLoadedKey] = useState('');
  useEffect(() => { setPage(1); setRows([]); setData(null); setError(''); setSearchText(search); }, [filterKey, search]);
  useEffect(() => { let alive = true; api.get(rentalUrl('/categories', storeSlug), { silent: true }).then(value => { if (alive) setCategories(Array.isArray(value) ? value : value?.rows || value?.categories || []); }).catch(() => {}); return () => { alive = false; }; }, [storeSlug]);
  useEffect(() => {
    let alive = true; setError(''); setLoading(true);
    const params = new URLSearchParams({ page: String(page), ...(search ? { search } : {}), ...(category ? { category } : {}), ...(colour ? { colour } : {}), ...(minRent ? { minRent } : {}), ...(maxRent ? { maxRent } : {}), sort });
    api.get(rentalUrl('/rentals/catalogue?' + params, storeSlug), { silent: true, forceRefetch: true }).then(value => {
      if (!Array.isArray(value?.rows)) throw new Error('Rental products could not be loaded.');
      if (alive) { setData(value); setLoadedKey(filterKey); setRows(previous => page === 1 ? value.rows : [...new Map([...previous, ...value.rows].map(row => [row._id, row])).values()]); }
    }).catch(e => { if (alive) setError(e.message); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [filterKey, search, category, colour, sort, minRent, maxRent, storeSlug, page, retry]);
  const change = (key, value) => { const params = new URLSearchParams(route.split('?')[1] || ''); params.delete('mode'); if (value) params.set(key, value); else params.delete(key); navigate(storefrontPath('/rental-book' + (params.size ? '?' + params : ''), storeSlug)); };
  const products = loadedKey === filterKey ? rows.map(offer => ({ ...offer.product, id: offer.productId, _id: offer.productId, name: offer.product?.name || offer.title, rentalOffer: offer, rentalPreview: { listingId: offer._id, dailyRatePaise: offer.dailyRatePaise, depositPaise: offer.depositPaise } })) : [];
  return <section className="rental-shop">
    <ShoppingModeTabs mode="rent" navigate={navigate} />
    <header className="rental-shop__heading"><div><h1>Rental collection</h1><p>Choose your look. Book your occasion.</p></div><button type="button" className="rental-shop__bag" onClick={() => navigate(storefrontPath('/rental-cart', storeSlug))}><ShoppingBag size={19} />Bag{bag.itemCount > 0 && <span>{bag.itemCount}</span>}</button></header>
    <form className="rental-shop__search" onSubmit={event => { event.preventDefault(); change('search', searchText.trim()); }}><Search size={19} /><input aria-label="Search rental products" placeholder="Search outfits, jewellery & more" value={searchText} onChange={event => setSearchText(event.target.value)} /><button type="submit">Search</button></form>
    <div className="rental-shop__layout"><aside className={'rental-shop__filters' + (filtersOpen ? ' is-open' : '')}><div><h2>Filters</h2><button type="button" className="lg:hidden" onClick={() => setFiltersOpen(false)}>Done</button></div><label>Category<select value={category} onChange={e => change('category', e.target.value)}><option value="">All categories</option>{categories.filter(c => c.isActive !== false).map(c => <option key={c._id || c.id} value={c._id || c.id}>{c.name}</option>)}</select></label><label>Colour<input key={colour} defaultValue={colour} placeholder="Any colour" onBlur={e => { if (e.target.value.trim() !== colour) change('colour', e.target.value.trim()); }} /></label><label>Minimum rent / use day (₹)<input key={'min' + minRent} type="number" min="0" step="1" defaultValue={minRent} placeholder="No minimum" onBlur={e => { if (e.target.value !== minRent) change('minRent', e.target.value); }} /></label><label>Maximum rent / use day (₹)<input key={'max' + maxRent} type="number" min="0" step="1" defaultValue={maxRent} placeholder="No maximum" onBlur={e => { if (e.target.value !== maxRent) change('maxRent', e.target.value); }} /></label><button type="button" onClick={() => navigate(storefrontPath('/rental-book', storeSlug))}>Clear filters</button></aside>
    <div className="rental-shop__results"><div className="rental-shop__toolbar"><span>{data && loadedKey === filterKey ? `${data.total || 0} rental options` : 'Rental products'}</span><button type="button" className="rental-shop__filter-button" onClick={() => setFiltersOpen(true)}><SlidersHorizontal size={17} />Filter</button><select aria-label="Sort rentals" value={sort} onChange={e => change('sort', e.target.value)}><option value="title">Recommended</option><option value="priceLowHigh">Rent: low to high</option><option value="priceHighLow">Rent: high to low</option></select></div>
    {error ? <div className="rental-shop__notice" role="alert"><p>{error}</p><button type="button" onClick={() => setRetry(v => v + 1)}>Retry</button></div> : !data || loadedKey !== filterKey ? <p role="status">Loading rental collection…</p> : <><ProductGrid products={products} navigate={navigate} shoppingMode="rental" priorityCount={4} />{page < data.pages && <button className="rental-shop__more" type="button" disabled={loading} onClick={() => setPage(p => p + 1)}>{loading ? 'Loading…' : 'Show more rentals'}</button>}</>}
    </div></div>
  <div className="rental-checkout-utilities" data-rental-checkout-utilities /></section>;
}
