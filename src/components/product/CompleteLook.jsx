import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronRight, RefreshCw, ShoppingBag } from 'lucide-react';
import api from '../../services/api';
import { normalizeProducts } from '../../services/normalize';
import { useRentalBag } from '../../context/RentalBagContext';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { rentalMoney, rentalUrl } from '../../utils/rentals';
import { clearRentalSession, readRentalSession, saveRentalSession } from '../../utils/rentalPlan';
import { validateRentalCheckoutDates } from '../../utils/rentalShopping';
import { responsiveImage } from '../../utils/responsiveImages';
import './CompleteLook.css';

const GROUPS = { necklace: 'Jewellery & necklace sets', bangles: 'Bangles', earrings: 'Earrings', tikka: 'Maang tikka', bag: 'Potli & bags', footwear: 'Footwear' };
function matchingProducts(data, mode) {
  const valid = Array.isArray(data?.products) && (!data.mode || data.mode === mode) && data.products.every(p => {
    const look = p?.look;
    return p && (p._id || p.id) && GROUPS[look?.group] && Array.isArray(look.options) && look.options.length > 0
      && ['AVAILABLE', 'DATES_REQUIRED', 'UNAVAILABLE', 'CHECK_FAILED', 'IN_STOCK'].includes(look.availability)
      && look.options.some(o => o?.id === look.selectedOptionId)
      && look.options.every(o => o && typeof o.id === 'string' && (o.mode === 'rent'
        ? /^[a-f\d]{24}$/i.test(o.listingId || '') && Number.isSafeInteger(o.dailyRatePaise) && o.dailyRatePaise > 0 && Number.isSafeInteger(o.depositPaise) && o.depositPaise >= 0
        : o.mode === 'buy' && Number.isFinite(Number(o.price)) && Number(o.price) >= 0));
  });
  if (!valid) throw new Error('Matching accessories are temporarily unavailable. Please try again shortly.');
  return normalizeProducts(data.products);
}
function checkedDates(dates, policy) { try { return policy ? validateRentalCheckoutDates(dates, policy) : {}; } catch (e) { return { error: e.message }; } }
export default function CompleteLook({ productId, storeSlug = '', navigate, mode = 'buy', colour = '', variantId = '', quantity = 1, rental }) {
  const bag = useRentalBag(), cart = useCart();
  const user = useAuth()?.user;
  const actor = user?._id || user?.id || '';
  const currentActor = useRef(actor); currentActor.current = actor;
  const previousActor = useRef('');
  const scope = `${storeSlug}:${productId}:${mode}:${variantId}:${colour}:${mode === 'rent' ? rental?.listingId || '' : ''}`;
  const selectionScope = `${scope}:${actor}`;
  const scopeReady = mode !== 'rent' || Boolean(rental?.listingId && bag.ready);
  const currentSelectionScope = useRef(selectionScope); currentSelectionScope.current = selectionScope;
  const [dates, setDates] = useState(() => readRentalSession('checkout-dates', storeSlug) || {});
  const [editingDates, setEditingDates] = useState(false), [retry, setRetry] = useState(0);
  const [response, setResponse] = useState(null), [failure, setFailure] = useState('');
  const [selected, setSelected] = useState({}), [choices, setChoices] = useState({});
  const [hydratedScope, setHydratedScope] = useState('');
  const [quoted, setQuoted] = useState(null), [quoteError, setQuoteError] = useState(''), [quoteBusy, setQuoteBusy] = useState(false);
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState(''), [addedModes, setAddedModes] = useState([]);
  const generation = useRef(0), actionLock = useRef(false);
  const dateResult = mode === 'rent' ? checkedDates(dates, rental?.data?.policy) : {};
  const validDates = Boolean(dateResult.useDates?.length);
  const schedule = validDates ? { ...dateResult, deliveryMode: dates.deliveryMode || 'STORE_PICKUP', paymentPlan: dates.paymentPlan || rental?.data?.policy?.paymentPlans?.[0] || 'ADVANCE' } : null;
  const selectedItems = Object.entries(selected).map(([id, optionId]) => response?.products?.find(p => String(p._id || p.id) === id)?.look.options.find(o => o.id === optionId)).filter(o => o?.mode === 'rent').map(o => ({ listingId: o.listingId, quantity: 1 }));
  const buyProductIds = [...new Set((cart.items || []).map(item => String(item.product?._id || item.productId || item._id || '')).filter(id => /^[a-f\d]{24}$/i.test(id)))].slice(0, 40);
  const selectedBuyProductIds = Object.entries(selected).filter(([id, optionId]) => response?.products?.find(p => String(p._id || p.id) === id)?.look.options.find(o => o.id === optionId)?.mode === 'buy').map(([id]) => id);
  const context = { variantId, colour, quantity, choices: Object.values(choices).filter(id => /^[a-f\d]{24}$/i.test(id)), buyProductIds, selectedBuyProductIds, ...(mode === 'rent' ? { sourceListingId: rental?.listingId || '', items: bag.items, selectedItems, ...schedule } : {}) };
  const actionContext = JSON.stringify({ selectionScope, quantity, dates, bag: bag.items });
  const currentActionContext = useRef(actionContext); currentActionContext.current = actionContext;
  const key = JSON.stringify({ storeSlug, productId, mode, context, retry });
  useEffect(() => {
    if (!scopeReady) return;
    const stored = readRentalSession('look-selection', storeSlug, actor) || (actor && !previousActor.current ? readRentalSession('look-selection', storeSlug) : null);
    setSelected(stored?.scope === scope ? stored.selected || {} : {});
    setChoices(stored?.scope === scope ? stored.choices || {} : {});
    setNotice(''); setAddedModes([]); setHydratedScope(selectionScope);
    previousActor.current = actor;
  }, [scopeReady, scope, selectionScope, storeSlug, actor]);
  useEffect(() => { if (hydratedScope !== selectionScope || !scopeReady) return; saveRentalSession('look-selection', storeSlug, { scope, selected, choices }, actor); if (actor) clearRentalSession('look-selection', storeSlug); }, [storeSlug, scope, selectionScope, hydratedScope, scopeReady, selected, choices, actor]);
  useEffect(() => {
    if (!productId || !scopeReady || hydratedScope !== selectionScope) return undefined;
    const controller = new AbortController(); let alive = true;
    setFailure('');
    const timer = window.setTimeout(() => {
      const query = new URLSearchParams({ store: storeSlug, mode, context: JSON.stringify(JSON.parse(key).context) });
      api.get(`/products/${encodeURIComponent(productId)}/complete-look?${query}`, { silent: true, signal: controller.signal, cacheScope: key, forceRefetch: retry > 0 }).then(data => {
        if (!alive) return;
        const products = matchingProducts(data, mode);
        setResponse({ key, scope, enabled: data.enabled, products });
        setSelected(current => Object.fromEntries(Object.entries(current).filter(([id, optionId]) => products.some(p => String(p._id || p.id) === id && p.look.options.some(o => o.id === optionId) && !['UNAVAILABLE', 'CHECK_FAILED'].includes(p.look.availability)))));
      }).catch(error => { if (alive && !controller.signal.aborted) setFailure(error.message || 'Matching accessories could not be loaded.'); });
    }, 300);
    return () => { alive = false; controller.abort(); window.clearTimeout(timer); };
  }, [key, scope, mode, scopeReady, hydratedScope, selectionScope, productId, retry, storeSlug]);
  const waiting = !response || response.key !== key;
  const rows = response?.scope === scope ? response.products : [];
  const chosen = rows.filter(p => selected[String(p._id || p.id)]).map(p => ({ product: p, option: p.look.options.find(o => o.id === selected[String(p._id || p.id)]) })).filter(row => row.option);
  const rentalItems = chosen.filter(row => row.option.mode === 'rent').map(row => ({ listingId: row.option.listingId, quantity: 1 }));
  const sourceItem = mode === 'rent' && rental?.listingId && !bag.items.some(item => item.listingId === rental.listingId) ? [{ listingId: rental.listingId, quantity }] : [];
  const quoteItems = [...bag.items, ...sourceItem, ...rentalItems];
  const quoteKey = JSON.stringify({ scope, items: quoteItems, schedule, retry });
  useEffect(() => {
    setQuoted(null); setQuoteError(''); setQuoteBusy(false);
    if (mode !== 'rent' || !validDates || !chosen.length || response?.key !== key) return undefined;
    const version = ++generation.current, controller = new AbortController();
    const input = { ...schedule, items: quoteItems };
    const timer = window.setTimeout(() => {
      setQuoteBusy(true);
      api.post(rentalUrl('/rentals/quote', storeSlug), input, { silent: true, signal: controller.signal }).then(result => { if (version === generation.current && !controller.signal.aborted) { if (!result?.quote || !result.quoteFingerprint) throw new Error('The combined rental total could not be verified.'); setQuoted({ key: quoteKey, ...result }); } }).catch(error => { if (version === generation.current && !controller.signal.aborted) setQuoteError(error.message || 'The rental total could not be checked.'); }).finally(() => { if (version === generation.current && !controller.signal.aborted) setQuoteBusy(false); });
    }, 350);
    return () => { generation.current = version + 1; controller.abort(); window.clearTimeout(timer); };
    // The serialized key includes the full bag, exact offers, dates and payment plan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteKey, key, response?.key, chosen.length]);
  const freshQuote = quoted?.key === quoteKey ? quoted.quote : null;
  const changeDates = (field, value) => { setDates(current => { const next = { ...current, [field]: value }; saveRentalSession('checkout-dates', storeSlug, next); return next; }); setSelected({}); setNotice(''); };
  const add = async () => {
    if (actionLock.current || !chosen.length) return;
    actionLock.current = true; setBusy(true); setNotice('');
    const actionScope = selectionScope;
    const actionActor = actor;
    const actionPlan = actionContext;
    try {
      // The quote and subsequent hold both check the complete physical selection.
      if (rentalItems.length && validDates) { const result = await api.post(rentalUrl('/rentals/quote', storeSlug), { ...schedule, items: quoteItems }, { silent: true }); if (!result?.quote || !result.quoteFingerprint) throw new Error('The combined rental total could not be verified.'); }
      const assertCurrent = () => { if (currentSelectionScope.current !== actionScope || currentActor.current !== actionActor || currentActionContext.current !== actionPlan) throw new Error('Your account or product selection changed. Review the current look before adding it.'); };
      assertCurrent();
      const bought = [];
      for (const row of chosen.filter(item => item.option.mode === 'buy')) {
        assertCurrent();
        const result = await cart.addToCartConfirmed(row.product, row.option.size, row.option.colour, row.option.variantId || '', 1);
        if (!result?.ok) throw new Error(result?.message || 'The sale accessory could not be added.');
        bought.push(String(row.product._id || row.product.id));
        setSelected(current => { const next = { ...current }; delete next[String(row.product._id || row.product.id)]; return next; });
      }
      assertCurrent();
      if (rentalItems.length && !bag.addMany([...sourceItem, ...rentalItems])) throw new Error('Your rental bag holds up to ten options. Review it before adding this look.');
      if (currentSelectionScope.current === actionScope) { setSelected({}); setAddedModes([...(rentalItems.length ? ['rent'] : []), ...(bought.length ? ['buy'] : [])]); setNotice(`${rentalItems.length ? 'Accessories added to the same rental bag. Your outfit and dates are kept.' : 'Accessories added to your buy bag.'}${bought.length && mode === 'rent' ? ' Sale accessories use separate sale checkout.' : ''}`); setRetry(v => v + 1); }
    } catch (error) { setNotice(error.message); }
    finally { actionLock.current = false; setBusy(false); }
  };
  if (!productId || (response?.scope === scope && response?.key === key && response?.enabled === false) || (mode === 'rent' && !rental?.listingId)) return null;
  return <section className="bridal-look" aria-label="Complete your bridal look" aria-busy={busy}>
    <header className="bridal-look__heading"><div><h2>Complete your bridal look</h2><p>Optional accessories coordinated with your selection.</p></div><button type="button" className="rental-shopping-link" disabled={busy} onClick={() => setRetry(v => v + 1)} aria-label="Refresh matching accessories"><RefreshCw size={16} /></button></header>
    {mode === 'rent' && <div className="bridal-look__dates"><button type="button" className="rental-shopping-link" aria-expanded={editingDates} onClick={() => setEditingDates(v => !v)}><CalendarDays size={16} />{validDates ? 'Edit rental dates' : 'Choose dates to check availability'}</button>{editingDates && <div className="bridal-look__date-fields">
      <label className="rental-checkout-field">Use day<input type="date" value={dates.useStart || ''} onChange={e => changeDates('useStart', e.target.value)} /></label>
      <label className="rental-checkout-field">Pickup date & time<input type="datetime-local" value={dates.pickupAt || ''} onChange={e => changeDates('pickupAt', e.target.value)} /></label>
      <label className="rental-checkout-field">Return date & time<input type="datetime-local" value={dates.returnDueAt || ''} onChange={e => changeDates('returnDueAt', e.target.value)} /></label>
      <label className="rental-checkout-field">Additional use days (comma separated)<input value={(dates.additionalUseDates || []).join(', ')} placeholder="YYYY-MM-DD, YYYY-MM-DD" onChange={e => changeDates('additionalUseDates', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} /></label>
      {(dates.useStart || dates.pickupAt || dates.returnDueAt) && !validDates && <p role="status">{dateResult.error || 'Complete the use day, pickup and return times.'}</p>}
    </div>}</div>}
    {waiting && rows.length > 0 && <p role="status">Updating your selected look…</p>}
    {failure ? <div role="alert"><p>{failure}</p><button className="rental-shopping-secondary" onClick={() => setRetry(v => v + 1)}>Retry matching accessories</button></div> : waiting && !rows.length ? <p role="status" className="bridal-look__state">Finding coordinated accessories…</p> : !rows.length ? <p className="bridal-look__state">No suitable accessories for this selection yet.</p> : <div className="bridal-look__groups">{Object.entries(GROUPS).map(([group, label]) => {
      const products = rows.filter(p => p.look.group === group); if (!products.length) return null;
      return <div className="bridal-look__group" key={group}><h3>{label}</h3><div className="bridal-look__cards">{products.map(p => {
        const id = String(p._id || p.id), look = p.look, option = look.options.find(o => o.id === (choices[id] || look.selectedOptionId)) || look.options[0];
        const needsSize = group === 'bangles' && !choices[id] && option.size && !/adjustable/i.test(option.size);
        const unavailable = ['UNAVAILABLE', 'CHECK_FAILED'].includes(look.availability);
        const disabled = busy || waiting || unavailable || needsSize;
        const states = { UPDATING: 'Updating your selection…', AVAILABLE: 'Available for selected dates · rechecked at booking', DATES_REQUIRED: 'Choose dates to check availability', UNAVAILABLE: 'Unavailable for these dates', CHECK_FAILED: 'Availability could not be checked', IN_STOCK: mode === 'rent' ? 'In stock · buy separately' : 'In stock' };
        return <article className={'bridal-look__card' + (selected[id] ? ' is-selected' : '')} key={id}>
          <button type="button" className="bridal-look__photo" onClick={() => navigate(`/product/${p.slug || id}?${new URLSearchParams({ id, mode: option.mode, ...(option.listingId ? { listing: option.listingId } : {}) })}`)} aria-label={`View ${p.name}`}><img {...responsiveImage(p.images?.find(image => image.primary) || p.images?.[0], 'card')} alt={p.name} loading="lazy" /></button>
          <div className="bridal-look__card-body"><h4>{p.name}</h4><p className="bridal-look__reason">{option.reason || look.reason}</p><strong>{option.mode === 'rent' ? <>{rentalMoney(option.dailyRatePaise)}<small> / use day</small></> : rentalMoney(Math.round(Number(option.price) * 100))}</strong>
            <small>{option.mode === 'rent' ? `Refundable deposit ${rentalMoney(option.depositPaise)}` : mode === 'rent' ? 'Sale item · separate buy checkout' : 'Buy accessory'}{option.unit ? ` · 1 ${option.unit}` : ''}</small>
            {(look.options.length > 1 || group === 'bangles' || option.size) && <label className="rental-checkout-field">{group === 'bangles' ? 'Bangle size' : 'Size / colour'}<select value={needsSize ? '' : option.id} disabled={busy} onChange={e => { const optionId = e.target.value; setChoices(current => ({ ...current, [id]: optionId })); setSelected(current => { const next = { ...current }; delete next[id]; return next; }); }}><option value="" disabled>Choose a size</option>{look.options.map(o => <option key={o.id} value={o.id}>{[o.size, o.colour, o.unit].filter(Boolean).join(' · ') || 'Standard option'}</option>)}</select></label>}
            <p className={'bridal-look__availability' + (unavailable ? ' is-unavailable' : '')}>{states[waiting ? 'UPDATING' : look.availability]}{needsSize ? ' · Select your bangle size' : ''}</p>
            <label className="bridal-look__select"><input type="checkbox" disabled={disabled} checked={Boolean(selected[id])} onChange={e => setSelected(current => { const next = { ...current }; if (e.target.checked) next[id] = option.id; else delete next[id]; return next; })} /><span>{selected[id] ? 'Selected' : 'Add to my look'}</span></label>
          </div></article>;
      })}</div></div>;
    })}</div>}
    {chosen.length > 0 && <div className="bridal-look__summary" aria-live="polite"><div><strong>{chosen.length} optional {chosen.length === 1 ? 'accessory' : 'accessories'} selected</strong>{quoteBusy && <p role="status">Checking your complete rental total…</p>}{quoteError && <p role="alert">{quoteError} <button className="rental-shopping-link" onClick={() => setRetry(v => v + 1)}>Retry quote</button></p>}{freshQuote && <dl>{[['Period rent & services', 'rentalPaise'], ['Refundable deposit', 'depositPaise'], ['Total rental bag', 'totalPaise'], ['Pay now', 'dueNowPaise'], ['Remaining at pickup', 'remainingPaise']].map(([label, field]) => <div key={field}><dt>{label}</dt><dd>{rentalMoney(freshQuote[field])}</dd></div>)}</dl>}{rentalItems.length > 0 && !validDates && <p>Choose dates for the complete rental total.</p>}</div><button type="button" className="rental-shopping-primary" disabled={busy || waiting || (rentalItems.length > 0 && !bag.ready) || (rentalItems.length > 0 && validDates && (!freshQuote || quoteBusy || Boolean(quoteError)))} onClick={add}><ShoppingBag size={17} />{busy ? 'Adding accessories…' : 'Add selected accessories'}</button></div>}
    {notice && <div className="bridal-look__notice" role="status"><p>{notice}</p>{addedModes.map(addedMode => <button key={addedMode} className="rental-shopping-link" onClick={() => navigate(addedMode === 'rent' ? '/rental-cart' : '/cart')}>View {addedMode === 'rent' ? 'rental' : 'buy'} bag <ChevronRight size={16} /></button>)}</div>}
  </section>;
}
