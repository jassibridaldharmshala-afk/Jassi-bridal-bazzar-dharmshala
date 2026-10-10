import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Clock3, Search, X } from 'lucide-react';
import api from '../../services/api';
import { getPrimaryImageUrl, normalizeImageUrl, normalizeProducts } from '../../services/normalize';

const recentStorageKey = 'samira_recent_searches';

export default function MobileSearchOverlay({ initialValue = '', navigate, onClose, storeSlug = '', shoppingMode = 'buy' }) {
  const [query, setQuery] = useState(initialValue);
  const [results, setResults] = useState([]);
  const [recent, setRecent] = useState(readRecentSearches);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const inputRef = useRef(null);
  const requestSequence = useRef(0);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    inputRef.current?.focus();
    const escape = event => { if (event.key === 'Escape') closeRef.current?.(); };
    window.addEventListener('keydown', escape);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', escape); requestSequence.current += 1; };
  }, []);

  useEffect(() => {
    const value = query.trim();
    const sequence = ++requestSequence.current;
    if (value.length < 2) {
      setResults([]);
      setLoading(false);
      setSearched(false);
      setError('');
      return undefined;
    }

    setLoading(true);
    setError('');
    const timer = window.setTimeout(async () => {
      try {
        const response = await api.get(`/products?search=${encodeURIComponent(value)}&page=1&limit=8${shoppingMode === 'rental' ? '&mode=rent' : ''}${storeSlug ? `&store=${encodeURIComponent(storeSlug)}` : ''}`, { cacheFirst: true });
        if (sequence !== requestSequence.current) return;
        const items = Array.isArray(response) ? response : response?.products || response?.items || [];
        setResults(normalizeProducts(items));
        setSearched(true);
      } catch {
        if (sequence !== requestSequence.current) return;
        setResults([]);
        setSearched(true);
        setError('Unable to search right now. Please try again.');
      } finally {
        if (sequence === requestSequence.current) setLoading(false);
      }
    }, 280);

    return () => window.clearTimeout(timer);
  }, [query, attempt, storeSlug, shoppingMode]);

  const remember = (value) => {
    const next = [value, ...recent.filter((item) => item.toLowerCase() !== value.toLowerCase())].slice(0, 6);
    setRecent(next);
    try { localStorage.setItem(recentStorageKey, JSON.stringify(next)); } catch { /* storage is optional */ }
  };

  const submit = (value = query) => {
    const search = String(value || '').trim();
    if (!search) return;
    remember(search);
    onClose?.();
    navigate(`${shoppingMode === 'rental' ? '/rental-book' : '/search'}?search=${encodeURIComponent(search)}`);
  };

  const openProduct = (product) => {
    const productId = product._id || product.id || product.slug;
    if (!productId) return;
    if (query.trim()) remember(query.trim());
    onClose?.();
    navigate(`/product?id=${encodeURIComponent(productId)}${shoppingMode === 'rental' ? '&mode=rent' : ''}`);
  };

  return (
    <section className="fixed inset-0 z-[90] flex flex-col bg-white lg:hidden" role="dialog" aria-modal="true" aria-label="Search products">
      <form
        className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-2 pb-3 pt-[calc(env(safe-area-inset-top)+10px)] shadow-sm"
        onSubmit={(event) => { event.preventDefault(); submit(); }}
      >
        <button type="button" onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-slate-600" aria-label="Close search">
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </button>
        <label className="sc-field-shell flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl bg-[#f4f1ec] px-3 text-slate-500 ring-1 ring-transparent focus-within:ring-wine/25">
          <Search className="h-4.5 w-4.5 shrink-0" strokeWidth={2} />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-charcoal outline-none placeholder:text-slate-400"
            placeholder="Search sarees, suits, kurtis..."
            autoComplete="off"
            inputMode="search"
            enterKeyHint="search"
            aria-label="Search products"
          />
          {query && <button type="button" onClick={() => setQuery('')} className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-slate-400" aria-label="Clear search"><X className="h-4 w-4" /></button>}
        </label>
        <button type="submit" disabled={!query.trim()} className="h-11 shrink-0 px-2 text-[11px] font-black uppercase tracking-[.06em] text-wine disabled:text-slate-300">Search</button>
      </form>

      <div className="min-h-0 flex-1 overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+24px)]">
        {query.trim().length < 2 ? (
          <div className="p-4">
            {recent.length > 0 ? (
              <div>
                <div className="flex items-center justify-between"><h2 className="text-[12px] font-black uppercase tracking-[.12em] text-slate-500">Recent searches</h2><button type="button" onClick={() => { setRecent([]); try { localStorage.removeItem(recentStorageKey); } catch { /* optional */ } }} className="text-[10px] font-black uppercase text-wine">Clear all</button></div>
                <div className="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white">
                  {recent.map((item) => <button key={item} type="button" onClick={() => submit(item)} className="flex h-12 w-full items-center gap-3 px-3 text-left text-[13px] font-semibold text-slate-700"><Clock3 className="h-4 w-4 text-slate-400" /><span className="truncate">{item}</span></button>)}
                </div>
              </div>
            ) : (
              <div className="grid min-h-64 place-items-center px-8 text-center"><div><span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-blush text-wine"><Search className="h-6 w-6" /></span><h2 className="mt-4 text-[14px] font-black text-charcoal">Find your next style</h2><p className="mt-2 text-[11px] leading-5 text-slate-500">Search by product name, category, fabric, or collection.</p></div></div>
            )}
          </div>
        ) : loading ? (
          <div className="grid min-h-64 place-items-center"><span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-wine" aria-label="Searching" /></div>
        ) : error ? (
          <div className="grid min-h-64 place-items-center px-8 text-center" role="alert"><div><h2 className="text-[14px] font-black text-charcoal">Search is unavailable</h2><p className="mt-2 text-[11px] leading-5 text-slate-500">{error}</p><button type="button" className="mt-3 rounded-xl border px-4 py-3 text-sm font-bold" onClick={() => setAttempt(value => value + 1)}>Try again</button></div></div>
        ) : results.length > 0 ? (
          <div className="p-3">
            <p className="px-1 pb-2 text-[10px] font-black uppercase tracking-[.12em] text-slate-400">Products</p>
            <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white">
              {results.map((product) => <SearchResult key={product.id || product.slug} product={product} shoppingMode={shoppingMode} onClick={() => openProduct(product)} />)}
            </div>
            <button type="button" onClick={() => submit()} className="mt-3 h-12 w-full rounded-xl border border-theme-border bg-[#fffaf5] text-[11px] font-black uppercase tracking-[.08em] text-wine">View all results for “{query.trim()}”</button>
          </div>
        ) : searched ? (
          <div className="grid min-h-64 place-items-center px-8 text-center"><div><h2 className="text-[14px] font-black text-charcoal">No products found</h2><p className="mt-2 text-[11px] leading-5 text-slate-500">Try a product name, category, fabric, or a shorter search.</p></div></div>
        ) : null}
      </div>
    </section>
  );
}

function SearchResult({ product, onClick, shoppingMode }) {
  const image = normalizeImageUrl(getPrimaryImageUrl(product.images));
  const rental = shoppingMode === 'rental';
  const rentalRate = Number(product.rentalPreview?.dailyRatePaise);
  const price = rental ? rentalRate / 100 : Number(product.sellingPrice ?? product.price ?? 0);
  return <button type="button" onClick={onClick} className="flex w-full items-center gap-3 p-3 text-left">
    <span className="h-16 w-[52px] shrink-0 overflow-hidden rounded-xl bg-blush">{image ? <img src={image} alt="" className="h-full w-full object-cover object-top" /> : null}</span>
    <span className="min-w-0 flex-1"><strong className="block truncate text-[12px] text-charcoal">{product.name}</strong><small className="mt-1 block truncate text-[10px] text-slate-500">{product.category || product.fabric || 'Collection'}</small><span className="mt-1.5 block text-[12px] font-black text-charcoal">{rental && !(rentalRate > 0) ? 'Check rental availability' : <>Rs. {price.toLocaleString('en-IN')}{rental ? ' / use day' : ''}</>}</span></span>
    <span className="text-lg text-slate-300" aria-hidden="true">›</span>
  </button>;
}

function readRecentSearches() {
  try {
    const value = JSON.parse(localStorage.getItem(recentStorageKey) || '[]');
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim()).slice(0, 6) : [];
  } catch {
    return [];
  }
}
