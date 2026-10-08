import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Heart, ImageOff, LoaderCircle, RefreshCw, Search, ShoppingBag, X } from 'lucide-react';
import { useWishlist } from '../../context/WishlistContext';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useStorefront } from '../../context/StorefrontContext';
import api from '../../services/api';
import { getPrimaryImageUrl, normalizeProduct } from '../../services/normalize';
import { rentalShoppingRoute } from '../../utils/rentalShopping';
import { rentalProductHref, productHref } from '../../utils/routing';
import { activeVariants, findProductVariant } from '../../utils/variants';
import { getSizeChartColumns } from '../../utils/productSizing';
import { isUnavailable, wishlistId, wishlistOptions, wishlistPrice, wishlistStock } from '../../utils/wishlist';
import './Wishlist.css';
import '../../styles/MobileShoppingTheme.css';

const cardPrice = product => product.commerceMode === 'RENTAL_ONLY' ? (product.rentalPreview?.dailyRatePaise ?? Number.MAX_SAFE_INTEGER) / 100 : wishlistPrice(product).price;
const money = value => `₹${Number(value || 0).toLocaleString('en-IN')}`;

export default function Wishlist({ navigate, route = '/wishlist' }) {
  const wishlist = useWishlist(); const cart = useCart(); const { user } = useAuth(); const { storeSlug } = useStorefront();
  const rentalShopping = rentalShoppingRoute(route);
  const [search, setSearch] = useState(''); const [filter, setFilter] = useState('all'); const [sort, setSort] = useState('recent');
  const [category, setCategory] = useState(''); const [limit, setLimit] = useState(40);
  const [selected, setSelected] = useState(null); const [notice, setNotice] = useState(null); const [undoBusy, setUndoBusy] = useState(false);
  const [movedIds, setMovedIds] = useState([]);
  const shop = storeSlug ? `/store/${storeSlug}/${rentalShopping ? 'rental-book' : 'products'}` : rentalShopping ? '/rental-book' : '/products';
  const categories = useMemo(() => [...new Set(wishlist.items.filter(product => !isUnavailable(product)).map(product => typeof product.category === 'string' ? product.category : product.category?.name).filter(Boolean))].sort(), [wishlist.items]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rows = [...wishlist.items].reverse().filter(product => {
      const categoryName = typeof product.category === 'string' ? product.category : product.category?.name;
      return (!rentalShopping || ['RENTAL_ONLY', 'SALE_AND_RENTAL'].includes(product.commerceMode)) && (!query || [product.name, product.brand, categoryName, ...(product.colors || [])].join(' ').toLowerCase().includes(query))
        && (!category || categoryName === category)
        && (filter !== 'stock' || (product.commerceMode !== 'RENTAL_ONLY' && wishlistStock(product) > 0))
        && (filter !== 'sale' || (product.commerceMode !== 'RENTAL_ONLY' && !isUnavailable(product) && wishlistPrice(product).discount > 0));
    });
    if (sort === 'low') rows.sort((a, b) => rentalShopping ? Number(a.rentalPreview?.dailyRatePaise || 0) - Number(b.rentalPreview?.dailyRatePaise || 0) : cardPrice(a) - cardPrice(b));
    if (sort === 'high') rows.sort((a, b) => rentalShopping ? Number(b.rentalPreview?.dailyRatePaise || 0) - Number(a.rentalPreview?.dailyRatePaise || 0) : cardPrice(b) - cardPrice(a));
    if (sort === 'discount') rows.sort((a, b) => wishlistPrice(b).discount - wishlistPrice(a).discount);
    return rows;
  }, [wishlist.items, search, category, filter, sort, rentalShopping]);
  useEffect(() => { setLimit(40); }, [search, filter, sort, category]);
  const remove = async product => {
    const result = await wishlist.removeFromWishlist(product);
    if (result?.ok) setNotice({ text: 'Removed from your wishlist.', undo: isUnavailable(product) ? null : product });
  };
  const undo = async () => {
    setUndoBusy(true);
    const result = await wishlist.addToWishlist(notice.undo);
    if (result?.ok) setNotice({ text: 'Added back to your wishlist.' });
    setUndoBusy(false);
  };
  const moved = async product => {
    setMovedIds(current => [...current, wishlistId(product)]);
    const result = await wishlist.removeFromWishlist(product);
    setSelected(null);
    setNotice({ text: result?.ok ? 'Moved to your bag. Your selected size and colour are saved.' : 'Added to your bag. The wishlist copy could not be removed; you can remove it later.', bag: true });
  };
  const count = wishlist.items.length;
  const bagCount = cart.itemCount || cart.items?.length || 0;
  return <section className="sc-wishlist">
    <div className="sc-wishlist__shell">
      <header className="sc-wishlist__heading">
        <button className="sc-wishlist__back sc-wishlist__icon" onClick={() => navigate(shop)} aria-label="Back to shopping"><ArrowLeft size={21} /></button>
        <div><h1>My wishlist <span>{count} {count === 1 ? 'item' : 'items'}</span></h1></div>
        <button className="sc-wishlist__bag sc-wishlist__outline" onClick={() => navigate('/cart')} aria-label={`View bag, ${bagCount} items`}><ShoppingBag size={19} /><span>View bag</span>{bagCount > 0 && <b>{bagCount > 99 ? '99+' : bagCount}</b>}</button>
      </header>
      {!user && <div className="sc-wishlist__signin"><Heart size={19} /><p>Sign in to save your wishlist across devices.</p><button onClick={() => navigate('/login?redirect=%2Fwishlist')}>Sign in <ArrowRight size={15} /></button></div>}
      {wishlist.error && <div className="sc-wishlist__error" role="alert"><p>{wishlist.error}</p><button onClick={wishlist.refresh} disabled={wishlist.loading}>Retry</button></div>}
      {notice && <div className="sc-wishlist__notice" role="status"><Check size={18} /><p>{notice.text}</p>{notice.undo && <button onClick={undo} disabled={undoBusy}>{undoBusy ? 'Restoring…' : 'Undo'}</button>}{notice.bag && <button onClick={() => navigate('/cart')}>View bag</button>}<button className="sc-wishlist__icon" onClick={() => setNotice(null)} aria-label="Dismiss message"><X size={18} /></button></div>}
      {count > 0 && <div className="sc-wishlist__tools">
        <div className="sc-wishlist__toolrow"><label className="sc-wishlist__search"><Search size={18} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search your saved styles" aria-label="Search wishlist" />{search && <button onClick={() => setSearch('')} aria-label="Clear search"><X size={16} /></button>}</label>
          <label className="sc-wishlist__sort"><span>Sort by</span><select value={sort} onChange={event => setSort(event.target.value)} aria-label="Sort wishlist"><option value="recent">Recently saved</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option><option value="discount">Biggest discount</option></select></label>
          <button className="sc-wishlist__refresh sc-wishlist__icon" onClick={wishlist.refresh} disabled={wishlist.loading} aria-label="Refresh prices and availability"><RefreshCw size={18} className={wishlist.loading ? 'sc-wishlist__spin' : ''} /></button>
        </div>
        <div className="sc-wishlist__filters"><div aria-label="Filter wishlist">{(rentalShopping ? [['all', 'Rental items']] : [['all', 'All items'], ['stock', 'In stock'], ['sale', 'On sale']]).map(([value, label]) => <button key={value} aria-pressed={filter === value} className={filter === value ? 'is-active' : ''} onClick={() => setFilter(value)}>{label}</button>)}</div>{categories.length > 1 && <select aria-label="Filter by category" value={category} onChange={event => setCategory(event.target.value)}><option value="">All categories</option>{categories.map(name => <option key={name}>{name}</option>)}</select>}</div>
      </div>}
      {wishlist.loading && !count ? <div className="sc-wishlist__loading" role="status" aria-label="Loading wishlist"><div className="sc-wishlist__grid">{[1, 2, 3, 4].map(value => <div className="sc-wishlist__skeleton" key={value}><div /><span /><span /></div>)}</div><p>Loading your wishlist…</p></div> : !count ? <div className="sc-wishlist__empty"><div className="sc-wishlist__empty-icon"><Heart size={30} strokeWidth={1.5} /></div><h2>Your wishlist is empty</h2><p>Tap the heart on a product to save it here.</p><button className="sc-wishlist__primary" onClick={() => navigate(shop)}>Explore the collection <ArrowRight size={18} /></button></div> : <>
        <p className="sc-wishlist__results">{filtered.length} saved {filtered.length === 1 ? 'style' : 'styles'}{wishlist.loading ? ' · Updating availability…' : ''}</p>
        {!filtered.length ? <div className="sc-wishlist__empty sc-wishlist__empty--filtered"><Search size={30} /><h2>No matching styles</h2><p>Try a different search or clear your filters.</p><button className="sc-wishlist__outline" onClick={() => { setSearch(''); setCategory(''); setFilter('all'); }}>Clear filters</button></div> : <div className="sc-wishlist__grid">{filtered.slice(0, limit).map(product => <WishlistCard key={wishlistId(product)} product={product} rentalShopping={rentalShopping} pending={wishlist.pendingIds?.includes(wishlistId(product))} moved={movedIds.includes(wishlistId(product))} onRemove={() => remove(product)} onMove={() => (rentalShopping || product.commerceMode === 'RENTAL_ONLY') ? navigate(rentalProductHref(product, storeSlug)) : setSelected(product)} onBag={() => navigate('/cart')} onOpen={() => navigate(rentalShopping || product.commerceMode === 'RENTAL_ONLY' ? rentalProductHref(product, storeSlug) : productHref(product, storeSlug))} />)}</div>}
        {filtered.length > limit && <button className="sc-wishlist__more sc-wishlist__outline" onClick={() => setLimit(value => value + 40)}>Show more styles</button>}
        <footer className="sc-wishlist__footer"><button onClick={() => navigate(shop)}>Continue shopping <ArrowRight size={16} /></button></footer>
      </>}
    </div>
    {selected && <MoveToBag product={selected} cart={cart} onClose={() => setSelected(null)} onMoved={moved} onBag={() => navigate('/cart')} onRental={() => navigate(rentalProductHref(selected, storeSlug))} />}
  </section>;
}

function ProductImage({ product }) {
  const [failed, setFailed] = useState(false); const src = getPrimaryImageUrl(product.images || []);
  return src && !failed ? <img src={src} alt={product.name} loading="lazy" onError={() => setFailed(true)} /> : <span className="sc-wishlist__image-empty"><ImageOff size={30} /><span>Image unavailable</span></span>;
}
function Price({ product, variant, saleSelection = false, rentalShopping = false }) {
  const { price, original, discount } = wishlistPrice(product, variant);
  const rental = rentalShopping || product.commerceMode === 'RENTAL_ONLY', mixed = product.commerceMode === 'SALE_AND_RENTAL';
  if (rental) return <div className="sc-wishlist__price"><strong>{product.rentalPreview?.dailyRatePaise ? `Rent from ${money(product.rentalPreview.dailyRatePaise / 100)} / day` : 'Rental pricing & dates'}</strong></div>;
  return <><div className="sc-wishlist__price"><strong>{mixed ? 'Sale · ' : ''}{money(price)}</strong>{original > price && <del>{money(original)}</del>}{discount > 0 && <span>{discount}% off</span>}</div>{mixed && !saleSelection && <p className="sc-wishlist__rental-price">{product.rentalPreview?.dailyRatePaise ? `Rent from ${money(product.rentalPreview.dailyRatePaise / 100)} / day` : 'Rental pricing & dates'}</p>}</>;
}
function WishlistCard({ product, rentalShopping = false, pending, moved, onRemove, onMove, onBag, onOpen }) {
  const unavailable = isUnavailable(product); const stock = wishlistStock(product); const options = wishlistOptions(product);
  const rental = rentalShopping || product.commerceMode === 'RENTAL_ONLY', mixed = !rental && product.commerceMode === 'SALE_AND_RENTAL';
  return <article className={`sc-wish-card${unavailable ? ' is-unavailable' : ''}`} aria-label={product.name}>
    <div className="sc-wish-card__visual"><button className="sc-wish-card__image" onClick={onOpen} disabled={unavailable} aria-label={`View ${product.name}`}><ProductImage product={product} /></button><button className="sc-wish-card__remove" onClick={onRemove} disabled={pending} aria-label={`Remove ${product.name} from wishlist`}>{pending ? <LoaderCircle size={17} className="sc-wishlist__spin" /> : <X size={18} />}</button>{!unavailable && !rental && stock === 0 && <span className="sc-wish-card__badge is-sold">{mixed ? 'Sale out of stock' : 'Out of stock'}</span>}{!unavailable && !rental && stock > 0 && stock <= 5 && <span className="sc-wish-card__badge">Only {stock} left</span>}</div>
    <div className="sc-wish-card__details"><p className="sc-wish-card__brand">{unavailable ? 'NO LONGER AVAILABLE' : product.brand || 'Jassi General Store'}</p><button onClick={onOpen} disabled={unavailable} className="sc-wish-card__name" title={product.name}>{product.name}</button>{!unavailable && <Price product={product} rentalShopping={rentalShopping} />}<p className="sc-wish-card__options">{unavailable ? 'You can remove this saved item.' : [product.rentalPreview?.fitting?.adjustable ? 'Adjustable fitting' : options.sizes.length === 1 ? options.sizes[0] || 'One size' : options.sizes.length ? `${options.sizes.length} sizes` : rental ? 'Fitting details' : 'View size details', options.colors.filter(Boolean).length > 1 ? `${options.colors.length} colours` : options.colors[0]].filter(Boolean).join(' · ')}</p></div>
    <button className="sc-wish-card__move" onClick={rental ? onOpen : moved ? onBag : onMove} disabled={pending || unavailable || (!rental && stock === 0)}>{rental ? 'Check rental dates' : moved ? 'View in bag' : unavailable ? 'Unavailable' : stock === 0 ? 'Out of stock' : 'Move to bag'}{!unavailable && !rental && stock !== 0 && <ShoppingBag size={16} />}</button>
    {mixed && !unavailable && <button type="button" className="sc-wish-card__rental" disabled={pending} onClick={onOpen}>Check rental dates →</button>}
  </article>;
}

function MoveToBag({ product: saved, cart, onClose, onMoved, onBag, onRental }) {
  const dialog = useRef(null); const mounted = useRef(true); const submitting = useRef(false);
  const [product, setProduct] = useState(saved); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [size, setSize] = useState(null); const [color, setColor] = useState(null); const [busy, setBusy] = useState(false); const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    mounted.current = true;
    const element = dialog.current; const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; if (element.showModal) element.showModal(); else element.setAttribute('open', '');
    return () => { mounted.current = false; document.body.style.overflow = previous; element.close?.(); };
  }, []);
  useEffect(() => {
    let alive = true; setLoading(true); setReady(false); setError('');
    api.post('/wishlist/resolve', { ids: [wishlistId(saved)] }).then(response => {
      if (!alive) return;
      const latest = normalizeProduct(response[0] || { ...saved, unavailable: true });
      setProduct(latest); setReady(true); const options = wishlistOptions(latest);
      setSize(options.sizes.length === 1 ? options.sizes[0] : null);
      const inStockColors = options.managed ? options.colors.filter(value => activeVariants(latest).some(variant => variant.color === value && variant.stock > 0)) : options.colors;
      setColor(inStockColors.length === 1 ? inStockColors[0] : null);
    }).catch(failure => { if (alive) setError(failure.message || 'Could not check the latest price and availability. Please retry.'); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [saved, attempt]);
  const options = wishlistOptions(product);
  const variant = options.managed && size !== null && color !== null ? findProductVariant(product, { size, color }) : null;
  const bagLoading = cart.loading || cart.hydrated === false;
  const stock = wishlistStock(product, options.managed ? { size, color } : undefined);
  const validSelection = product.commerceMode !== 'RENTAL_ONLY' && ready && size !== null && color !== null && (!options.managed || variant) && stock !== 0 && !isUnavailable(product);
  const alreadyInBag = validSelection && cart.items?.some(item => wishlistId(item.product) === wishlistId(product) && (variant ? String(item.variantId || '') === String(variant._id) : item.size === size && (item.color || '') === color));
  const availableSize = value => ready && (!options.managed || activeVariants(product).some(row => row.size === value && row.stock > 0));
  const availableColor = value => ready && (!options.managed || activeVariants(product).some(row => row.color === value && row.stock > 0));
  const selectSize = value => {
    setSize(value); setError('');
    if (options.managed && !activeVariants(product).some(row => row.size === value && row.color === color && row.stock > 0)) {
      const compatible = [...new Set(activeVariants(product).filter(row => row.size === value && row.stock > 0).map(row => row.color))];
      setColor(compatible.length === 1 ? compatible[0] : null);
    }
  };
  const selectColor = value => {
    setColor(value); setError('');
    if (options.managed && !activeVariants(product).some(row => row.color === value && row.size === size && row.stock > 0)) setSize(null);
  };
  const confirm = async () => {
    if (!validSelection || loading || bagLoading || submitting.current) return;
    if (alreadyInBag) return onBag();
    submitting.current = true; setBusy(true); setError('');
    let result;
    try { result = await cart.addToCartConfirmed(product, size, color, variant?._id || ''); }
    catch (failure) { result = { ok: false, message: failure.message }; }
    if (!mounted.current) return;
    if (result?.ok) await onMoved(product);
    else { setError(result?.message || 'Could not add this item to your bag. Your wishlist is unchanged.'); setBusy(false); submitting.current = false; }
  };
  const columns = getSizeChartColumns(product).filter(column => product.sizeChart?.rows?.some(row => Number(row[column.key]) > 0));
  return <dialog ref={dialog} className="sc-wish-dialog" aria-labelledby="wishlist-size-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} onClick={event => { if (event.target === event.currentTarget && !busy) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); } }}>
    <header><div><p>MAKE IT YOURS</p><h2 id="wishlist-size-title">Move to bag</h2></div><button onClick={onClose} disabled={busy} aria-label="Close size selection"><X size={21} /></button></header>
    <div className="sc-wish-dialog__body"><div className="sc-wish-dialog__product"><div><ProductImage product={product} /></div><section><p>{product.brand || 'Jassi General Store'}</p><h3>{product.name}</h3>{!isUnavailable(product) && <Price product={product} variant={variant} saleSelection />}<small>Inclusive of applicable taxes</small></section></div>
      {loading ? <p className="sc-wish-dialog__loading" role="status"><LoaderCircle size={18} className="sc-wishlist__spin" />Checking price and availability…</p> : <>
        {product.commerceMode === 'RENTAL_ONLY' ? <div className="sc-wish-dialog__error"><p>This item is now available for rental only. Choose rental dates to continue.</p><button type="button" className="sc-wishlist__outline" onClick={onRental}>Open rental dates</button></div> : isUnavailable(product) || wishlistStock(product) === 0 ? <p className="sc-wish-dialog__error">This item is currently unavailable. It will stay in your wishlist.</p> : <>
          <fieldset><legend>Select size {size !== null && <span>— {size || 'One size'}</span>}</legend><div className="sc-wish-dialog__choices">{options.sizes.map(value => <button key={value} disabled={busy || !availableSize(value)} aria-pressed={size === value} onClick={() => selectSize(value)} aria-label={`Size ${value || 'One size'}${!availableSize(value) ? ', out of stock' : ''}`}>{value || 'One size'}</button>)}</div>{!options.sizes.length && <p>Size details are not available yet. Please check the product page.</p>}</fieldset>
          {options.colors.some(Boolean) && <fieldset><legend>Select colour {color !== null && <span>— {color}</span>}</legend><div className="sc-wish-dialog__choices sc-wish-dialog__colors">{options.colors.map(value => <button key={value} disabled={busy || !availableColor(value)} aria-pressed={color === value} onClick={() => selectColor(value)} aria-label={`Colour ${value || 'As shown'}${!availableColor(value) ? ', out of stock' : ''}`}>{value || 'As shown'}</button>)}</div></fieldset>}
          {columns.length > 0 && <details className="sc-wish-dialog__guide"><summary>Size guide <span>Garment measurements ({product.sizeChart.unit || 'in'})</span></summary><div><table><thead><tr><th>Size</th>{columns.map(column => <th key={column.key}>{column.shortLabel}</th>)}</tr></thead><tbody>{product.sizeChart.rows.map(row => <tr key={row.size}><th>{row.size}</th>{columns.map(column => <td key={column.key}>{row[column.key] || '—'}</td>)}</tr>)}</tbody></table></div></details>}
          {validSelection && stock > 0 && stock <= 5 && <p className="sc-wish-dialog__low">Only {stock} left in this selection</p>}
        </>}
      </>}
      {error && <div className="sc-wish-dialog__error" role="alert"><p>{error}</p><button onClick={() => setAttempt(value => value + 1)} disabled={busy}>Check availability again</button></div>}
    </div><footer><p>{bagLoading ? 'Loading your bag…' : alreadyInBag ? 'This selection is already in your bag.' : size === null ? 'Choose your size to continue.' : color === null ? 'Choose your colour to continue.' : 'Your selection will be added to your bag.'}</p><button className="sc-wishlist__primary" onClick={confirm} disabled={!validSelection || loading || bagLoading || busy || Boolean(error)}>{busy ? <LoaderCircle size={18} className="sc-wishlist__spin" /> : <ShoppingBag size={18} />}{busy ? 'Moving to bag…' : alreadyInBag ? 'View bag' : 'Move to bag'}</button></footer>
  </dialog>;
}
