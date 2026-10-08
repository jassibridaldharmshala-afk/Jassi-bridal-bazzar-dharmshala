import { useEffect, useRef, useState } from 'react';
import api from '../../services/api';
import { readRentalSession } from '../../utils/rentalPlan';
import { localDateTime, rentalInstant, rentalUrl } from '../../utils/rentals';
import RentalBookingForm from './RentalBookingForm';
import RentalDateSearch, { RentalAvailabilityHints } from './RentalDateSearch';
import { asCatalogList } from '../../utils/catalogOptions';
export default function RentalCatalogueBrowser({ apiBase = '/rentals', user, counter = false, initialProductId, initialListingId, initialSchedule, initialWaitlistId, storeSlug, onBooked, onRequireLogin, navigate }) {
  const savedPlan = useRef(!counter ? readRentalSession('plan', storeSlug) : null);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [data, setData] = useState(null), [cache, setCache] = useState({}), [page, setPage] = useState(1), [search, setSearch] = useState(''), [query, setQuery] = useState(''), [error, setError] = useState(''), [reload, setReload] = useState(0);
  const [categories, setCategories] = useState([]), [category, setCategory] = useState('');
  const [applied, setApplied] = useState(null), [dateDraft, setDateDraft] = useState({}), [hasSearched, setHasSearched] = useState(false), [loading, setLoading] = useState(false), [initialItems, setInitialItems] = useState([]);
  const seeded = useRef(false);
  const [linkedError, setLinkedError] = useState('');
  const [recommendations, setRecommendations] = useState([]);
  const requestKey = JSON.stringify({ applied, page, query, category, availableOnly });
  const [loadedKey, setLoadedKey] = useState('');
  const timezone = data?.configuration?.policy?.timezone;
  useEffect(() => {
    let alive = true;
    api.get(rentalUrl('/categories', storeSlug), { silent: true })
      .then(value => { if (alive) setCategories(asCatalogList(value)); })
      .catch(() => {});
    return () => { alive = false; };
  }, [storeSlug]);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    const path = applied ? apiBase + '/availability?' + new URLSearchParams({ ...applied, page: String(page), search: query, category, availableOnly: String(availableOnly) }) : `${apiBase}/catalogue?${new URLSearchParams({ page: String(page), search: query, category })}`;
    api.get(rentalUrl(path, storeSlug), { silent: true }).then(value => {
      if (!alive) return;
      if (!value?.configuration || !Array.isArray(value.rows)) throw new Error('Rental collection is unavailable. Please retry.');
      setData(value); setLoadedKey(JSON.stringify({ applied, page, query, category, availableOnly })); setCache(old => ({ ...old, ...Object.fromEntries(value.rows.map(row => [row._id, row])) })); setError('');
    }).catch(e => { if (alive) setError(e.details || e.message); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [apiBase, page, query, category, reload, storeSlug, applied, availableOnly]);
  useEffect(() => {
    if (seeded.current || !data?.configuration) return;
    seeded.current = true;
    const timezone = data.configuration.policy.timezone;
    const plan = savedPlan.current;
    const planItems = Array.isArray(plan?.items) ? plan.items.filter(item => typeof item?.listingId === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(item.listingId) && Number.isInteger(item.quantity) && item.quantity >= 1 && item.quantity <= 10) : [];
    const planSchedule = Object.fromEntries(['pickupAt', 'returnDueAt', 'eventAt', 'deliveryMode'].filter(key => typeof plan?.schedule?.[key] === 'string').map(key => [key, plan.schedule[key]]));
    if (planSchedule.deliveryMode && !data.configuration.policy.deliveryModes.includes(planSchedule.deliveryMode)) delete planSchedule.deliveryMode;
    if ((planItems.length || planSchedule.pickupAt || planSchedule.returnDueAt || planSchedule.eventAt) && (!initialListingId || planItems.some(item => item.listingId === initialListingId))) {
      setDateDraft(planSchedule);
      if (planSchedule.pickupAt && planSchedule.returnDueAt) {
        try { const pickupAt = rentalInstant(planSchedule.pickupAt, timezone), returnDueAt = rentalInstant(planSchedule.returnDueAt, timezone); if (+new Date(returnDueAt) > +new Date(pickupAt)) { setApplied({ pickupAt, returnDueAt, deliveryMode: planSchedule.deliveryMode || data.configuration.policy.deliveryModes[0] }); setHasSearched(true); } } catch { setLinkedError('Choose valid pickup and return dates.'); }
      }
      if (planItems.length) api.get(rentalUrl(apiBase + '/catalogue?listingIds=' + planItems.map(item => item.listingId).join(','), storeSlug), { silent: true }).then(value => { const available = new Set(value.rows.map(row => row._id)); setInitialItems(planItems.filter(item => available.has(item.listingId))); if (planItems.some(item => !available.has(item.listingId))) setLinkedError('An item in your saved rental bag is no longer offered. Review the available items.'); setCache(old => ({ ...old, ...Object.fromEntries(value.rows.map(row => [row._id, row])) })); }).catch(e => setError(e.message));
      return;
    }
    if (initialSchedule?.pickupAt && initialSchedule?.returnDueAt) {
      try { if (!(+new Date(initialSchedule.returnDueAt) > +new Date(initialSchedule.pickupAt))) throw new Error('Invalid date order'); const schedule = { pickupAt: initialSchedule.pickupAt, returnDueAt: initialSchedule.returnDueAt, deliveryMode: data.configuration.policy.deliveryModes[0] }; setDateDraft({ ...schedule, pickupAt: localDateTime(schedule.pickupAt, timezone), returnDueAt: localDateTime(schedule.returnDueAt, timezone) }); setApplied(schedule); setHasSearched(true); } catch { setError('The rental link has invalid dates. Choose fresh dates.'); }
    } else setDateDraft({ deliveryMode: data.configuration.policy.deliveryModes[0] });
  }, [data, initialSchedule, apiBase, initialListingId, storeSlug]);
  useEffect(() => {
    let alive = true;
    if (!initialWaitlistId || counter || !timezone) return undefined;
    api.get(rentalUrl(apiBase + '/waitlist/' + initialWaitlistId, storeSlug), { silent: true }).then(async row => {
      const offers = await api.get(rentalUrl(apiBase + '/catalogue?listingIds=' + row.items.map(i => i.listingId).join(','), storeSlug), { silent: true });
      if (!alive) return;
      const available = new Set(offers.rows.map(offer => offer._id)); setInitialItems(row.items.filter(item => available.has(item.listingId))); if (row.items.some(item => !available.has(item.listingId))) setLinkedError('An item in this waitlist is no longer offered. Review the available items.'); setCache(old => ({ ...old, ...Object.fromEntries(offers.rows.map(offer => [offer._id, offer])) }));
      setDateDraft({ pickupAt: localDateTime(row.schedule.pickupAt, timezone), returnDueAt: localDateTime(row.schedule.returnDueAt, timezone), deliveryMode: row.deliveryMode });
    }).catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [apiBase, initialWaitlistId, storeSlug, counter, timezone]);
  useEffect(() => {
    if (!initialListingId) return undefined;
    let alive = true;
    api.get(rentalUrl(apiBase + '/catalogue?listingIds=' + initialListingId, storeSlug), { silent: true }).then(value => { if (!alive) return; const valid = value.rows.find(row => row._id === initialListingId && (!initialProductId || String(row.productId) === initialProductId)); if (!valid) { setLinkedError('This rental option is no longer available. Choose an available option from the collection.'); return; } setInitialItems([{ listingId: valid._id, quantity: 1 }]); setCache(old => ({ ...old, [valid._id]: valid })); }).catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [apiBase, initialListingId, initialProductId, storeSlug, reload]);
  useEffect(() => {
    if (!initialProductId) return undefined;
    let alive = true;
    api.get(rentalUrl(`${apiBase}/catalogue?productId=${encodeURIComponent(initialProductId)}`, storeSlug), { silent: true }).then(value => { if (alive) setCache(old => ({ ...old, ...Object.fromEntries(value.rows.map(row => [row._id, row])) })); }).catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [apiBase, initialProductId, storeSlug]);
  useEffect(() => {
    if (counter || !initialProductId) return undefined;
    let alive = true;
    api.get(rentalUrl('/products/' + encodeURIComponent(initialProductId) + '/complete-look?mode=rent', storeSlug), { silent: true }).then(async value => {
      const products = Array.isArray(value?.products) ? value.products : [];
      const ids = products.map(product => product.rentalPreview?.listingId).filter(Boolean).slice(0, 10);
      if (!ids.length) return;
      const offers = await api.get(rentalUrl(apiBase + '/catalogue?listingIds=' + ids.join(','), storeSlug), { silent: true });
      if (!alive || !Array.isArray(offers?.rows)) return;
      setRecommendations(offers.rows);
      setCache(old => ({ ...old, ...Object.fromEntries(offers.rows.map(row => [row._id, row])) }));
    }).catch(() => { /* The full collection remains available when suggestions cannot load. */ });
    return () => { alive = false; };
  }, [counter, initialProductId, apiBase, storeSlug]);
  return <>
    {linkedError && <p role="alert" className="rental-notice">{linkedError}</p>}
    {error && <p role="alert" className="rental-notice">{error}<button type="button" className="rental-button rental-button--secondary" onClick={() => setReload(n => n + 1)}>Retry collection</button></p>}
    {!data ? error ? <p className="rental-muted">The collection could not be loaded. Retry to continue.</p> : <p role="status">Loading rental collection…</p> : data.configuration.mode === 'SALE_ONLY' ? <section className="rental-card"><h2>New rentals are disabled</h2><p>Existing bookings remain accessible. The owner can enable rentals in Rental settings.</p></section> : <>
      {counter && data.configuration.policy.dateFirstEnabled && <RentalDateSearch base={apiBase} storeSlug={storeSlug} policy={data.configuration.policy} draft={dateDraft} loading={loading} onChange={(key, value) => { setDateDraft(old => ({ ...old, [key]: value })); setApplied(null); }} onSearch={value => { setApplied(value); setPage(1); setHasSearched(true); }} />}
      <div className="rental-fields"><label className="rental-field"><span>Find an outfit, jewellery or accessory</span><input value={search} onChange={e => setSearch(e.target.value)} /></label><label className="rental-field"><span>Category</span><select value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}><option value="">All categories</option>{categories.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label><button type="button" className="rental-button" onClick={() => { setQuery(search); setPage(1); }}>Search</button></div>
      {data.configuration.policy.dateFirstEnabled && applied && <label className="rental-check"><input type="checkbox" checked={availableOnly} onChange={e => { setAvailableOnly(e.target.checked); setPage(1); }} />Available for my dates</label>}
      {(!data.configuration.policy.dateFirstEnabled || hasSearched || !counter) && <RentalBookingForm listings={Object.values(cache)} visibleIds={data.rows.map(row => row._id)} configuration={data.configuration} user={user} storeSlug={storeSlug} counter={counter} apiBase={apiBase} initialProductId={initialListingId ? undefined : initialProductId} initialItems={initialItems} initialSchedule={dateDraft} recommendations={recommendations} onDatesReady={value => { setApplied(value); setPage(1); setHasSearched(true); }} onScheduleChange={(key, value) => { setDateDraft(old => ({ ...old, [key]: value })); setApplied(null); }} onBooked={onBooked} onRequireLogin={onRequireLogin} navigate={navigate} />}
      {data.configuration.policy.dateFirstEnabled && applied && !loading && !error && loadedKey === requestKey && <RentalAvailabilityHints key={requestKey} rows={data.rows.filter(row => row.availability)} schedule={applied} timezone={data.configuration.policy.timezone} base={apiBase} storeSlug={storeSlug} onDates={schedule => { setDateDraft(old => ({ ...old, pickupAt: localDateTime(schedule.pickupAt, data.configuration.policy.timezone), returnDueAt: localDateTime(schedule.returnDueAt, data.configuration.policy.timezone) })); setApplied({ ...applied, pickupAt: schedule.pickupAt, returnDueAt: schedule.returnDueAt }); setPage(1); }} onChoose={(match, replacedId) => { setCache(old => ({ ...old, [match._id]: match })); setInitialItems([{ listingId: match._id, quantity: 1, replaces: replacedId }]); }} />}
      <div className="rental-actions"><button type="button" disabled={page <= 1} className="rental-button rental-button--secondary" onClick={() => setPage(p => p - 1)}>Previous</button><span>Page {data.page} of {Math.max(1, data.pages)} · selections stay in your rental bag</span><button type="button" disabled={page >= data.pages} className="rental-button rental-button--secondary" onClick={() => setPage(p => p + 1)}>Next</button></div>
    </>}
  </>;
}
