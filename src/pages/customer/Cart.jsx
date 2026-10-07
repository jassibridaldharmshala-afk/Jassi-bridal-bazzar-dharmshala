import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronDown, CircleAlert, Heart, ImageOff, LoaderCircle, LockKeyhole, MapPin, Minus, Plus, RotateCcw, ShoppingBag, Truck, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useStorefront } from '../../context/StorefrontContext';
import api from '../../services/api';
import { getPrimaryImageUrl, normalizeProduct, normalizeProducts } from '../../services/normalize';
import { couponApplyBody } from '../../utils/couponApply';
import { readPricingSettings } from '../../utils/priceBreakdown';
import { bagIssue, bagKey, bagStock, bagTotals, chosenVariant, selectedBagItems } from '../../utils/bag';
import { wishlistOptions, wishlistPrice } from '../../utils/wishlist';
import { activeVariants } from '../../utils/variants';
import { productHref } from '../../utils/routing';
import { getSizeChartColumns } from '../../utils/productSizing';
import CouponSelector from '../../components/coupon/CouponSelector';
import './Cart.css';
import '../../styles/MobileShoppingTheme.css';
import { SETTINGS_CHANGED_EVENT, SETTINGS_STORAGE_KEY } from '../../config/storeSettings';
import StorefrontBannerSlot from '../../components/banners/StorefrontBannerSlot';
import MobileOverlayLoader from '../../components/ui/MobileOverlayLoader';

const money = value => '₹' + Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
export default function Cart({ navigate, route = '' }) {
  const cart = useCart(), wishlist = useWishlist(); const { user } = useAuth(); const { storeSlug } = useStorefront();
  const [storefrontBanners, setStorefrontBanners] = useState([]);
  const [settings, setSettings] = useState(null), [settingsError, setSettingsError] = useState(''), [reload, setReload] = useState(0);
  const [addresses, setAddresses] = useState([]), [addressId, setAddressId] = useState(''), [addressOpen, setAddressOpen] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [editing, setEditing] = useState(null), [removing, setRemoving] = useState(null), [notice, setNotice] = useState(null);
  const [actionBusy, setActionBusy] = useState(false), [checking, setChecking] = useState(false);
  const [coupons, setCoupons] = useState([]), [bestCode, setBestCode] = useState(''), [couponBusy, setCouponBusy] = useState(''), [couponFeedback, setCouponFeedback] = useState(''), [couponChecking, setCouponChecking] = useState(false);
  const actionLock = useRef(false), signatureRef = useRef(''), couponRequest = useRef(0), linkedCouponTried = useRef('');
  const selected = useMemo(() => selectedBagItems(cart.items), [cart.items]);
  const address = addresses.find(row => row._id === addressId);
  const linkedCouponCode = useMemo(() => {
    const query = String(route || '').split('?')[1] || '';
    return String(new URLSearchParams(query).get('coupon') || '').trim().toUpperCase();
  }, [route]);
  const totals = bagTotals(selected, cart.coupon, settings || {});
  const signature = selected.map(item => [bagKey(item), item.quantity, item.price ?? item.product.price].join(':')).join('|');
  signatureRef.current = signature;
  const busy = Boolean(cart.pendingCount || actionBusy || checking || couponBusy);
  const selectedIssues = selected.some(item => bagIssue(item));
  const storeOrderIssue = settings?.acceptingOrders === false ? settings.orderPauseMessage || 'The store is temporarily not accepting new orders.' : totals.sellingTotal < Number(settings?.minimumOrderAmount || 0) ? 'Add items worth ' + money(Number(settings.minimumOrderAmount) - totals.sellingTotal) + ' more to reach the minimum order value.' : '';
  const canContinue = selected.length > 0 && selected.length <= 50 && !selectedIssues && !storeOrderIssue && !busy && !cart.loading && !cart.error && Boolean(settings) && !couponChecking;
  const checkoutPath = '/checkout' + (addressId ? '?addressId=' + encodeURIComponent(addressId) : '');
  const goCheckout = () => navigate(user ? checkoutPath : '/login?redirect=' + encodeURIComponent(checkoutPath));
  const shop = storeSlug ? '/store/' + storeSlug + '/products' : '/products';
  const refreshBag = cart.refresh;

  useEffect(() => { refreshBag?.(); }, [refreshBag]);
  useEffect(() => {
    const refresh = () => setReload(value => value + 1);
    const storage = event => { if (event.key === SETTINGS_STORAGE_KEY) refresh(); };
    window.addEventListener(SETTINGS_CHANGED_EVENT, refresh); window.addEventListener('storage', storage);
    return () => { window.removeEventListener(SETTINGS_CHANGED_EVENT, refresh); window.removeEventListener('storage', storage); };
  }, []);

  useEffect(() => {
    let alive = true; setSettingsError('');
    const query = storeSlug ? `?store=${encodeURIComponent(storeSlug)}` : '';
    api.get(`/settings${query}`, { silent: true, cacheFirst: true, forceRefetch: reload > 0 }).then(data => { if (alive) setSettings(data); }).catch(() => { if (alive) setSettingsError('Could not load delivery charges. Retry before continuing.'); });
    return () => { alive = false; };
  }, [reload, storeSlug]);
  useEffect(() => {
    let alive = true;
    const scope = storeSlug ? `&store=${encodeURIComponent(storeSlug)}` : '';
    api.get(`/products?sort=rating&limit=8${scope}`, { silent: true, cacheFirst: true }).then(data => { if (alive) setRecommendations(normalizeProducts(data).slice(0, 6)); }).catch(() => {});
    return () => { alive = false; };
  }, [storeSlug]);
  useEffect(() => {
    let alive = true;
    const query = storeSlug ? `?store=${encodeURIComponent(storeSlug)}` : '';
    api.get(`/banners${query}`, { silent: true, cacheFirst: true }).then(data => { if (alive) setStorefrontBanners(Array.isArray(data) ? data : []); }).catch(() => {});
    return () => { alive = false; };
  }, [storeSlug]);
  useEffect(() => {
    let alive = true; setAddresses([]); setAddressId('');
    if (user) api.get('/user/addresses', { silent: true, cacheFirst: true, cacheScope: String(user._id || user.id || user.phone || '') }).then(data => {
      if (!alive) return; const rows = Array.isArray(data) ? data : []; setAddresses(rows); setAddressId((rows.find(row => row.isDefault) || rows[0])?._id || '');
    }).catch(() => {});
    return () => { alive = false; };
  }, [user?._id, user?.phone]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let alive = true;
    const request = ++couponRequest.current;
    if (!selected.length) { setCoupons([]); setBestCode(''); setCouponChecking(false); return undefined; }
    const body = couponApplyBody({ cart: { items: selected, sellingTotal: totals.sellingTotal }, shippingAddress: address, deliveryCharge: Number(settings?.deliveryCharge || 0) });
    api.post('/coupons/available', body).then(data => {
      if (alive) { setCoupons(data.items || []); setBestCode(data.bestCouponCode || ''); }
    }).catch(() => { if (alive) { setCoupons([]); setBestCode(''); } });
    if (cart.coupon?.code) {
      setCouponChecking(true);
      api.post('/coupons/apply', { ...body, code: cart.coupon.code }).then(data => {
        if (alive && request === couponRequest.current) cart.setCoupon(couponFromResponse(data, cart.coupon.code));
      }).catch(failure => {
        if (alive && request === couponRequest.current) { cart.setCoupon(null); setCouponFeedback('Coupon removed: ' + failure.message); }
      }).finally(() => { if (alive && request === couponRequest.current) setCouponChecking(false); });
    } else setCouponChecking(false);
    return () => { alive = false; };
  }, [signature, cart.coupon?.code, address?.pincode, settings?.deliveryCharge]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyCoupon = async code => {
    if (couponBusy || busy || !selected.length) return false;
    const current = signature; const request = ++couponRequest.current; setCouponBusy(code); setCouponFeedback('');
    try {
      const data = await api.post('/coupons/apply', couponApplyBody({ code, cart: { items: selected, sellingTotal: totals.sellingTotal }, shippingAddress: address, deliveryCharge: Number(settings?.deliveryCharge || 0) }));
      if (signatureRef.current !== current || couponRequest.current !== request) { setCouponFeedback('Your bag changed. Please apply the coupon again.'); return false; }
      cart.setCoupon(couponFromResponse(data, code)); setCouponFeedback(data.message || `${data.couponCode || code} applied.`); return true;
    } catch (failure) { setCouponFeedback(failure.message); return false; }
    finally { setCouponBusy(''); setCouponChecking(false); }
  };
  useEffect(() => {
    if (!linkedCouponCode || !selected.length || cart.coupon?.code || linkedCouponTried.current === linkedCouponCode) return;
    linkedCouponTried.current = linkedCouponCode;
    applyCoupon(linkedCouponCode);
  }, [linkedCouponCode, selected.length, cart.coupon?.code]); // eslint-disable-line react-hooks/exhaustive-deps
  const removeCoupon = () => { couponRequest.current += 1; cart.setCoupon(null); setCouponFeedback('Coupon removed.'); setCouponChecking(false); };
  const performRemoval = async move => {
    if (actionLock.current || !removing?.length) return;
    actionLock.current = true; setActionBusy(true);
    const rows = removing; const safe = []; let failed = 0;
    for (const item of rows) {
      if (!move) safe.push(item);
      else { const result = await wishlist.addToWishlist(item.product); if (result?.ok) safe.push(item); else failed += 1; }
    }
    const result = safe.length ? await cart.removeItems(safe) : { ok: false };
    if (result.ok) {
      setRemoving(null);
      setNotice({ text: move ? (failed ? 'Some items moved to your wishlist. The others remain in your bag.' : 'Moved to your wishlist. Ready whenever you are.') : 'Removed from your bag.', wishlist: move, undo: move ? null : safe });
    } else setNotice({ text: move ? 'Could not finish moving these items. Your bag items are still here; please retry.' : result.message || 'Could not remove these items. Please retry.', error: true });
    actionLock.current = false; setActionBusy(false);
  };
  const undo = async () => {
    if (actionLock.current) return; actionLock.current = true; setActionBusy(true);
    const failed = [];
    for (const item of notice.undo) {
      const result = await cart.addToCartConfirmed(item.product, item.size, item.color, item.variantId, item.quantity);
      if (!result?.ok) failed.push(item);
    }
    setNotice(failed.length ? { text: 'Some items could not be restored at their current availability. You can retry.', undo: failed, error: true } : { text: 'Added back to your bag at the current price.' });
    actionLock.current = false; setActionBusy(false);
  };
  const continueCheckout = async () => {
    if (!canContinue) return; setChecking(true);
    const result = await cart.refresh();
    setChecking(false);
    if (!result?.ok || selectedBagItems(result.items || []).some(bagIssue)) { setNotice({ text: 'Please review your bag. Availability may have changed.', error: true }); return; }
    const fresh = selectedBagItems(result.items || []);
    if (!fresh.length) return;
    if (fresh.map(item => [bagKey(item), item.quantity, item.price ?? item.product.price].join(':')).join('|') !== signature) { setNotice({ text: 'Your bag has been updated. Review the latest prices and selections, then continue.' }); return; }
    goCheckout();
  };
  const rules = readPricingSettings(settings || {});
  const shippingRemaining = Math.max(0, rules.freeShippingMinAmount - totals.sellingTotal);
  const allSelected = cart.items.length > 0 && selected.length === cart.items.length;
  const initialLoading = !cart.items.length && (cart.loading || !cart.hydrated);
  const loadFailed = !cart.items.length && !initialLoading && cart.error;
  const bagCount = initialLoading ? 'Loading bag…' : loadFailed ? 'Unable to load' : `${cart.itemCount} items`;
  const recommended = recommendations.filter(product => !cart.items.some(item => String(item.product._id) === String(product._id))).slice(0, 4);

  return <section className="sc-bag">
    <header className="sc-bag__mobile-header"><button onClick={() => navigate(shop)} aria-label="Continue shopping"><ArrowLeft size={21} /></button><div><h1>Shopping bag</h1><span>{bagCount}</span></div><button onClick={() => navigate('/wishlist')} aria-label="Open wishlist"><Heart size={21} /></button></header>
    <div className="sc-bag__shell">
      <div className="sc-bag__top"><div><h1>Shopping bag <span>{bagCount}</span></h1></div><p className="sc-bag__secure"><LockKeyhole size={15} /> Secure checkout</p></div>
      <nav className="sc-bag__steps" aria-label="Checkout progress"><span aria-current="step"><b>1</b> Bag</span><i /><span><b>2</b> Address</span><i /><span><b>3</b> Payment</span></nav>
      {cart.error && <div className="sc-bag__alert" role="alert"><p>{cart.error}</p><button onClick={cart.refresh} disabled={busy || cart.loading}>Retry</button></div>}
      {storeOrderIssue && <div className="sc-bag__alert" role="status"><p>{storeOrderIssue}</p></div>}
      {notice && <div className={'sc-bag__alert ' + (notice.error ? '' : 'is-success')} role="status"><p>{notice.text}</p>{notice.undo && <button onClick={undo} disabled={busy}>Undo</button>}{notice.wishlist && <button onClick={() => navigate('/wishlist')}>View wishlist</button>}<button onClick={() => setNotice(null)} aria-label="Dismiss message"><X size={17} /></button></div>}
      {initialLoading ? <><MobileOverlayLoader label="Bringing your bag up to date" /><div className="sc-bag__loading" role="status"><LoaderCircle className="sc-bag__spin" size={24} /><p>Bringing your bag up to date…</p></div></> : loadFailed ? <div className="sc-bag__empty"><div><CircleAlert size={30} strokeWidth={1.5} /></div><h2>We couldn’t load your bag</h2><p>Retry to retrieve your saved items.<br />Your bag hasn’t been cleared.</p></div> : !cart.items.length ? <div className="sc-bag__empty"><div><ShoppingBag size={30} strokeWidth={1.5} /></div><h2>Your shopping bag is empty</h2><p>Add products or move your favourites from your wishlist.</p><button className="sc-bag__primary" onClick={() => navigate('/wishlist')}>Explore your wishlist <Heart size={17} /></button><button className="sc-bag__text" onClick={() => navigate(shop)}>Continue shopping <ArrowRight size={16} /></button></div> : <>
        <div className="sc-bag__layout"><main className="sc-bag__main">
          <section className="sc-bag__address sc-bag__panel"><MapPin size={20} /><div><strong>{address ? 'Deliver to ' + address.fullName + ', ' + address.pincode : 'Where should we deliver?'}</strong><p>{address ? [address.houseNo, address.area, address.city].filter(Boolean).join(', ') : 'Choose your delivery address at checkout.'}</p></div><button className="sc-bag__outline" onClick={() => addresses.length ? setAddressOpen(true) : goCheckout()}>{address ? 'Change' : 'Add address'}</button></section>
          {!user && <div className="sc-bag__signin"><LockKeyhole size={16} /><p>Sign in to access saved addresses and finish your order.</p><button onClick={goCheckout}>Sign in</button></div>}
          {settings && selected.length > 0 && rules.shippingFreeAboveEnabled && rules.deliveryCharge > 0 && <section className="sc-bag__shipping"><Truck size={20} /><div><p>{shippingRemaining > 0 ? <>You’re <strong>{money(shippingRemaining)}</strong> away from free delivery</> : <><strong>Free delivery</strong> on your selected items</>}</p>{shippingRemaining > 0 && <div className="sc-bag__progress"><span style={{ width: Math.min(100, totals.sellingTotal / rules.freeShippingMinAmount * 100) + '%' }} /></div>}<small>Based on item total before coupon discounts</small></div></section>}
          <section className="sc-bag__selection"><label><input type="checkbox" checked={allSelected} ref={element => { if (element) element.indeterminate = selected.length > 0 && !allSelected; }} onChange={() => cart.selectItems(cart.items, !allSelected)} disabled={busy || cart.loading} aria-label="Select all bag items" /><strong>{selected.length} / {cart.items.length} items selected</strong></label><div><button onClick={() => setRemoving(selected)} disabled={!selected.length || busy}>Remove</button><button onClick={() => setRemoving(selected)} disabled={!selected.length || busy} aria-label="Move selected items to wishlist"><Heart size={17} /><span>Move to wishlist</span></button></div></section>
          <div className="sc-bag__items">{cart.items.map(item => <BagItem key={bagKey(item)} item={item} busy={busy || cart.loading} settings={settings} onSelect={() => cart.selectItems([item], item.selected === false)} onEdit={() => setEditing(item)} onRemove={() => setRemoving([item])} onQuantity={quantity => cart.updateQuantity(bagKey(item), quantity, { cartKey: bagKey(item) })} onOpen={() => navigate(productHref(item.product, storeSlug))} />)}</div>
          <button className="sc-bag__wishlist-link sc-bag__panel" onClick={() => navigate('/wishlist')}><Heart size={19} /><span>Add more from your wishlist</span><ArrowRight size={19} /></button>
          <p className="sc-bag__reservation"><LockKeyhole size={13} /> Items stay in your bag but stock is only reserved during checkout.</p>
        </main><aside className="sc-bag__aside">
          <div className="sc-bag__summary-stack">
            <div className="sc-bag__coupon"><h2>COUPONS & OFFERS</h2><CouponSelector coupons={selected.length ? coupons : []} bestCouponCode={bestCode} appliedCoupon={selected.length ? cart.coupon : null} busyCode={couponBusy || (couponChecking ? 'checking' : '')} feedback={couponFeedback || (!selected.length ? 'Select an item to apply a coupon.' : '')} onApply={applyCoupon} onRemove={removeCoupon} /></div>
            <section id="bag-price-details" className="sc-bag__prices sc-bag__panel"><h2>PRICE DETAILS <span>({totals.itemCount} {totals.itemCount === 1 ? 'item' : 'items'})</span></h2>
              <PriceRow label="Total MRP" value={money(totals.totalMRP)} /><PriceRow label="Discount on MRP" value={'− ' + money(totals.discount)} good />
              <PriceRow label="Coupon discount" value={couponChecking ? 'Checking…' : totals.couponDiscount ? '− ' + money(totals.couponDiscount) : '—'} good={totals.couponDiscount > 0} />
              <PriceRow label="Delivery charge" value={!settings ? 'Checking…' : rules.shippingPricingMode === 'weight' && (!rules.shippingFreeAboveEnabled || shippingRemaining > 0) ? 'At checkout' : totals.deliveryCharge ? money(totals.deliveryCharge) : 'FREE'} good={Boolean(settings) && !totals.deliveryCharge} />
              <PriceRow label="Platform fee" value={!settings ? 'Checking…' : money(totals.platformFee)} />
              <div className="sc-bag__total"><strong>Estimated total</strong><strong>{settings ? money(totals.finalAmount) : '—'}</strong></div>
              {totals.discount + totals.couponDiscount > 0 && <p className="sc-bag__savings"><Check size={15} /> You save {money(totals.discount + totals.couponDiscount)} on this bag</p>}
              <p className="sc-bag__tax">Includes {money(totals.taxAmount)} GST ({totals.taxRate}%). Payment-specific charges or offers are confirmed at checkout.</p>
              {settingsError && <div className="sc-bag__alert" role="alert"><p>{settingsError}</p><button onClick={() => setReload(value => value + 1)}>Retry</button></div>}
              {(selectedIssues || !selected.length || selected.length > 50) && <p className="sc-bag__issue" role="status">{selectedIssues ? 'Update or uncheck unavailable items to continue.' : !selected.length ? 'Select at least one item to continue.' : 'Select up to 50 items per order.'}</p>}
              <button className="sc-bag__primary sc-bag__desktop-continue" onClick={continueCheckout} disabled={!canContinue}>{checking ? 'Checking your bag…' : 'Continue to address'}<ArrowRight size={17} /></button>
              <p className="sc-bag__next">You can review your order before payment.</p>
            </section>
            <div className="sc-bag__help"><span>Need a hand with your order?</span><button onClick={() => navigate('/contact')}>Contact us <ArrowRight size={14} /></button></div>
          </div>
        </aside></div>
        {recommended.length > 0 && <section className="sc-bag__recommendations"><div><h2>You may also like</h2></div><div>{recommended.map(product => <button key={product._id || product.id} onClick={() => navigate(productHref(product, storeSlug))}><div><BagImage product={product} /></div><span>{product.name}</span><strong>{money(product.price)}</strong><small>View style <ArrowRight size={12} /></small></button>)}</div></section>}
        <div className="sc-bag__mobile-continue"><div><strong>{settings ? money(totals.finalAmount) : '—'}</strong><button onClick={() => document.getElementById('bag-price-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>View price details</button></div><button className="sc-bag__primary" onClick={continueCheckout} disabled={!canContinue}>{checking ? <LoaderCircle size={18} className="sc-bag__spin" /> : 'Continue'}<ArrowRight size={17} /></button></div>
      </>}
      <StorefrontBannerSlot banners={storefrontBanners} position="Cart - Bottom" navigate={navigate} compact className="max-w-[1320px]" />
      <footer className="sc-bag__footer"><span><LockKeyhole size={16} /> Secure checkout</span><button onClick={() => navigate('/shipping-policy')}>Shipping policy</button><button onClick={() => navigate('/return-policy')}>Return policy</button><button onClick={() => navigate('/privacy-policy')}>Privacy policy</button></footer>
    </div>
    {editing && <EditBagItem item={editing} cart={cart} onClose={() => setEditing(null)} />}
    {removing && <BagDialog title={removing.length === 1 ? 'Keep it for later?' : 'Update selected items'} onClose={() => setRemoving(null)} busy={actionBusy}><div className="sc-bag-dialog__body"><div className="sc-bag-dialog__heart"><Heart size={28} /></div><p>{removing.length === 1 ? removing[0].product.name : removing.length + ' selected items'}</p><p className="sc-bag-dialog__muted">Move favourites to your wishlist, or remove them from your bag.</p></div><footer className="sc-bag-dialog__actions"><button className="sc-bag__outline" onClick={() => performRemoval(false)} disabled={actionBusy}>Remove</button><button className="sc-bag__primary" onClick={() => performRemoval(true)} disabled={actionBusy || removing.some(item => item.product.isActive === false)}>{actionBusy ? 'Updating…' : 'Move to wishlist'}</button></footer></BagDialog>}
    {addressOpen && <BagDialog title="Choose delivery address" onClose={() => setAddressOpen(false)}><div className="sc-bag-dialog__body sc-bag__addresses">{addresses.map(row => <label key={row._id}><input type="radio" name="bag-address" checked={row._id === addressId} onChange={() => setAddressId(row._id)} /><div><strong>{row.fullName} <small>{row.addressType}</small></strong><p>{[row.houseNo, row.area, row.city, row.state, row.pincode].filter(Boolean).join(', ')}</p><span>{row.mobile}</span></div></label>)}</div><footer className="sc-bag-dialog__actions"><button className="sc-bag__outline" onClick={goCheckout}>Add new address</button><button className="sc-bag__primary" onClick={() => setAddressOpen(false)}>Deliver here</button></footer></BagDialog>}
  </section>;
}
function PriceRow({ label, value, good }) { return <div className="sc-bag__price-row"><span>{label}</span><span className={good ? 'is-good' : ''}>{value}</span></div>; }
function couponFromResponse(data, fallbackCode) { return { code: data?.couponCode || fallbackCode, discount: Number(data?.discountAmount || 0), benefitType: data?.coupon?.benefitType || 'DISCOUNT', savingAmount: Number(data?.coupon?.effectiveSaving ?? (Number(data?.discountAmount || 0) + Number(data?.coupon?.estimatedDeliverySaving || 0))) }; }
function BagImage({ product }) {
  const [failed, setFailed] = useState(false); const image = getPrimaryImageUrl(product.images);
  return image && !failed ? <img src={image} alt={product.name} onError={() => setFailed(true)} loading="lazy" /> : <span className="sc-bag__image-empty"><ImageOff size={27} /><small>Image unavailable</small></span>;
}
function BagItem({ item, busy, settings, onSelect, onEdit, onRemove, onQuantity, onOpen }) {
  const product = item.product, stock = bagStock(item), issue = bagIssue(item);
  const { discount } = wishlistPrice({ ...product, price: item.price ?? product.price, originalPrice: item.originalPrice ?? product.originalPrice });
  const unavailable = product.isActive === false || product.unavailable;
  const returnText = product.returnPolicy || settings?.returnPolicy || (settings?.returnWindowDays > 0 ? settings.returnWindowDays + '-day returns, subject to store policy' : '');
  return <article className={'sc-bag-item sc-bag__panel' + (item.selected === false ? ' is-unselected' : '')} aria-label={product.name}>
    <div className="sc-bag-item__picture"><button onClick={onOpen} disabled={unavailable} aria-label={'View ' + product.name}><BagImage product={product} /></button><input type="checkbox" checked={item.selected !== false} onChange={onSelect} disabled={busy || item.localOnly} aria-label={'Select ' + product.name} /></div>
    <div className="sc-bag-item__body"><p className="sc-bag-item__brand">{product.brand || 'Jassi General Store'}</p><button className="sc-bag-item__name" onClick={onOpen} disabled={unavailable}>{product.name}</button><p className="sc-bag-item__seller">Sold by {product.sellerName || 'Jassi General Store'}</p>
      <div className="sc-bag-item__options"><button onClick={onEdit} disabled={busy || unavailable || item.localOnly} aria-label={'Change size and colour for ' + product.name}>Size: <strong>{item.size || 'One size'}</strong><ChevronDown size={13} /></button>{item.color && <span>{item.color}</span>}<div className="sc-bag-item__quantity"><button onClick={() => onQuantity(item.quantity - 1)} disabled={busy || item.quantity <= 1 || item.localOnly} aria-label={'Decrease quantity for ' + product.name}><Minus size={13} /></button><span aria-label={'Quantity ' + item.quantity}>Qty: {item.quantity}</span><button onClick={() => onQuantity(item.quantity + 1)} disabled={busy || item.quantity >= 20 || stock === 0 || (stock !== null && item.quantity >= stock) || item.localOnly} aria-label={'Increase quantity for ' + product.name}><Plus size={13} /></button></div></div>
      <div className="sc-bag-item__price"><strong>{money((item.price ?? product.price) * item.quantity)}</strong>{discount > 0 && <><del>{money((item.originalPrice ?? product.originalPrice) * item.quantity)}</del><span>{discount}% OFF</span></>}</div>
      {item.quantity > 1 && <p className="sc-bag-item__unit">{money(item.price ?? product.price)} each</p>}
      {issue ? <p className="sc-bag__issue">{issue}</p> : stock > 0 && stock <= 5 ? <p className="sc-bag-item__low">Only {stock} left in this selection</p> : null}
      {item.previousPrice > 0 && item.previousPrice !== item.price && <p className="sc-bag-item__price-change">Price updated from {money(item.previousPrice)} to {money(item.price)} each</p>}
      {returnText && !unavailable && <p className="sc-bag-item__return"><RotateCcw size={13} />{returnText}</p>}
    </div><button className="sc-bag-item__remove" onClick={onRemove} disabled={busy} aria-label={'Remove ' + product.name}><X size={19} /></button>
  </article>;
}
function BagDialog({ title, children, onClose, busy }) {
  const ref = useRef(null);
  useEffect(() => {
    const element = ref.current, overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; element.showModal?.(); if (!element.showModal) element.setAttribute('open', '');
    return () => { document.body.style.overflow = overflow; element.close?.(); };
  }, []);
  return <dialog ref={ref} className="sc-bag-dialog" aria-label={title} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} onClick={event => {
    if (event.target !== event.currentTarget || busy) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
  }}><header><div><p>YOUR SHOPPING BAG</p><h2>{title}</h2></div><button onClick={onClose} disabled={busy} aria-label="Close dialog"><X size={21} /></button></header>{children}</dialog>;
}
function EditBagItem({ item, cart, onClose }) {
  const [product, setProduct] = useState(item.product), [size, setSize] = useState(item.size || ''), [color, setColor] = useState(item.color || ''), [quantity, setQuantity] = useState(item.quantity);
  const [loading, setLoading] = useState(true), [ready, setReady] = useState(false), [error, setError] = useState(''), [saving, setSaving] = useState(false), [retry, setRetry] = useState(0);
  const lock = useRef(false);
  useEffect(() => {
    let alive = true; setLoading(true); setReady(false); setError('');
    api.post('/wishlist/resolve', { ids: [String(item.productId || item.product._id || item.product.id)] }).then(data => {
      if (alive) { setProduct(normalizeProduct(data[0] || { ...item.product, unavailable: true })); setReady(true); }
    }).catch(failure => { if (alive) setError(failure.message); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [item, retry]);
  const options = wishlistOptions(product), variant = options.managed ? chosenVariant(product, size, color) : null;
  const stock = bagStock({ product, size, color, variantId: variant?._id });
  const possible = ready && !loading && (!options.managed || variant) && options.sizes.includes(size) && options.colors.includes(color) && stock !== 0 && (stock === null || quantity <= stock) && quantity > 0 && quantity <= 20;
  const availableSize = value => !options.managed || activeVariants(product).some(row => row.size === value && row.stock > 0);
  const availableColor = value => !options.managed || activeVariants(product).some(row => row.color === value && row.stock > 0);
  const changeSize = value => {
    setSize(value); setError('');
    if (options.managed && !activeVariants(product).some(row => row.size === value && row.color === color && row.stock > 0)) {
      const colors = [...new Set(activeVariants(product).filter(row => row.size === value && row.stock > 0).map(row => row.color))];
      setColor(colors.length === 1 ? colors[0] : '');
    }
  };
  const save = async () => {
    if (!possible || lock.current) return; lock.current = true; setSaving(true); setError('');
    const result = await cart.updateItemOptions(bagKey(item), { cartKey: bagKey(item), size, color, variantId: variant?._id || '', quantity });
    if (result?.ok) onClose(); else setError(result?.message || 'Could not update this item. Your original selection is still in the bag.');
    lock.current = false; setSaving(false);
  };
  const columns = getSizeChartColumns(product).filter(column => product.sizeChart?.rows?.some(row => Number(row[column.key]) > 0));
  return <BagDialog title="Choose your perfect fit" onClose={onClose} busy={saving}><div className="sc-bag-dialog__body">
    <div className="sc-bag-dialog__product"><div><BagImage product={product} /></div><section><small>{product.brand || 'Jassi General Store'}</small><h3>{product.name}</h3><strong>{money(wishlistPrice(product, variant).price)}</strong><p>Price per item, inclusive of taxes</p></section></div>
    {loading ? <p role="status">Checking available sizes and colours…</p> : <>
      <fieldset><legend>Select size</legend><div className="sc-bag-dialog__choices">{options.sizes.map(value => <button key={value} aria-label={'Size ' + (value || 'One size')} aria-pressed={value === size} disabled={!ready || saving || !availableSize(value)} onClick={() => changeSize(value)}>{value || 'One size'}</button>)}</div></fieldset>
      {options.colors.some(Boolean) && <fieldset><legend>Select colour</legend><div className="sc-bag-dialog__choices">{options.colors.map(value => <button key={value} aria-pressed={value === color} disabled={!ready || saving || !availableColor(value)} onClick={() => { setColor(value); setError(''); if (options.managed && !activeVariants(product).some(row => row.size === size && row.color === value && row.stock > 0)) setSize(''); }}>{value || 'As shown'}</button>)}</div></fieldset>}
      <label className="sc-bag-dialog__quantity">Quantity <select value={quantity} disabled={saving || !ready} onChange={event => { setQuantity(Number(event.target.value)); setError(''); }} aria-label="Choose quantity">{Array.from({ length: Math.min(20, Math.max(quantity, stock ?? 20, 1)) }, (_, index) => index + 1).map(value => <option key={value} disabled={stock !== null && value > stock} value={value}>{value}</option>)}</select></label>
      {(stock === 0 || (stock !== null && quantity > stock)) && <p className="sc-bag__issue">{stock ? 'Only ' + stock + ' left. Choose a lower quantity.' : 'This combination is unavailable. Choose another size or colour.'}</p>}
      {columns.length > 0 && <details className="sc-bag-dialog__guide"><summary>Size guide · {product.sizeChart.unit || 'in'}</summary><div><table><thead><tr><th>Size</th>{columns.map(column => <th key={column.key}>{column.shortLabel}</th>)}</tr></thead><tbody>{product.sizeChart.rows.map(row => <tr key={row.size}><th>{row.size}</th>{columns.map(column => <td key={column.key}>{row[column.key] || '—'}</td>)}</tr>)}</tbody></table></div></details>}
    </>}
    {error && <div className="sc-bag__alert" role="alert"><p>{error}</p><button onClick={() => setRetry(value => value + 1)} disabled={saving}>Retry</button></div>}
  </div><footer><p className="sc-bag-dialog__muted">If this size and colour are already in your bag, quantities will be combined.</p><button className="sc-bag__primary" onClick={save} disabled={!possible || saving || Boolean(error)}>{saving ? 'Saving changes…' : 'Save changes'}</button></footer></BagDialog>;
}
