import { useEffect, useRef, useState } from 'react';
import api from '../../services/api';
import { localDateTime, rentalUrl } from '../../utils/rentals';
import RentalBookingForm from './RentalBookingForm';
import RentalDateSearch, { RentalAvailabilityHints } from './RentalDateSearch';
import { asCatalogList } from '../../utils/catalogOptions';
export default function RentalCatalogueBrowser({ apiBase = '/rentals', user, counter = false, initialProductId, initialListingId, initialSchedule, initialWaitlistId, storeSlug, onBooked }) {
  const [data, setData] = useState(null), [cache, setCache] = useState({}), [page, setPage] = useState(1), [search, setSearch] = useState(''), [query, setQuery] = useState(''), [error, setError] = useState(''), [reload, setReload] = useState(0);
  const [categories, setCategories] = useState([]), [category, setCategory] = useState('');
  const [applied, setApplied] = useState(null), [dateDraft, setDateDraft] = useState({}), [hasSearched, setHasSearched] = useState(false), [loading, setLoading] = useState(false), [initialItems, setInitialItems] = useState(initialListingId ? [{ listingId: initialListingId, quantity: 1 }] : []);
  const seeded = useRef(false);
  const requestKey = JSON.stringify({ applied, page, query, category });
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
    const path = applied ? apiBase + '/availability?' + new URLSearchParams({ ...applied, page: String(page), search: query, category }) : `${apiBase}/catalogue?${new URLSearchParams({ page: String(page), search: query, category })}`;
    api.get(rentalUrl(path, storeSlug), { silent: true }).then(value => {
      if (!alive) return;
      if (!value?.configuration || !Array.isArray(value.rows)) throw new Error('Rental collection is unavailable. Please retry.');
      setData(value); setLoadedKey(JSON.stringify({ applied, page, query, category })); setCache(old => ({ ...old, ...Object.fromEntries(value.rows.map(row => [row._id, row])) })); setError('');
    }).catch(e => { if (alive) setError(e.details || e.message); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [apiBase, page, query, category, reload, storeSlug, applied]);
  useEffect(() => {
    if (seeded.current || !data?.configuration) return;
    seeded.current = true;
    const timezone = data.configuration.policy.timezone;
    if (initialSchedule?.pickupAt && initialSchedule?.returnDueAt) {
      try { setDateDraft({ pickupAt: localDateTime(initialSchedule.pickupAt, timezone), returnDueAt: localDateTime(initialSchedule.returnDueAt, timezone), deliveryMode: data.configuration.policy.deliveryModes[0] }); } catch { setError('The rental link has invalid dates. Choose fresh dates.'); }
    } else setDateDraft({ deliveryMode: data.configuration.policy.deliveryModes[0] });
  }, [data, initialSchedule]);
  useEffect(() => {
    let alive = true;
    if (!initialWaitlistId || counter || !timezone) return undefined;
    api.get(rentalUrl(apiBase + '/waitlist/' + initialWaitlistId, storeSlug), { silent: true }).then(async row => {
      const offers = await api.get(rentalUrl(apiBase + '/catalogue?listingIds=' + row.items.map(i => i.listingId).join(','), storeSlug), { silent: true });
      if (!alive) return;
      setInitialItems(row.items); setCache(old => ({ ...old, ...Object.fromEntries(offers.rows.map(offer => [offer._id, offer])) }));
      setDateDraft({ pickupAt: localDateTime(row.schedule.pickupAt, timezone), returnDueAt: localDateTime(row.schedule.returnDueAt, timezone), deliveryMode: row.deliveryMode });
    }).catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [apiBase, initialWaitlistId, storeSlug, counter, timezone]);
  useEffect(() => {
    if (!initialListingId) return undefined;
    let alive = true;
    api.get(rentalUrl(apiBase + '/catalogue?listingIds=' + initialListingId, storeSlug), { silent: true }).then(value => { if (alive) setCache(old => ({ ...old, ...Object.fromEntries(value.rows.map(row => [row._id, row])) })); }).catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [apiBase, initialListingId, storeSlug]);
  useEffect(() => {
    if (!initialProductId) return undefined;
    let alive = true;
    api.get(rentalUrl(`${apiBase}/catalogue?productId=${encodeURIComponent(initialProductId)}`, storeSlug), { silent: true }).then(value => { if (alive) setCache(old => ({ ...old, ...Object.fromEntries(value.rows.map(row => [row._id, row])) })); }).catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [apiBase, initialProductId, storeSlug]);
  return <>
    {error && <p role="alert" className="rental-notice">{error}<button type="button" className="rental-button rental-button--secondary" onClick={() => setReload(n => n + 1)}>Retry collection</button></p>}
    {!data ? <p role="status">Loading rental collection…</p> : data.configuration.mode === 'SALE_ONLY' ? <section className="rental-card"><h2>New rentals are disabled</h2><p>Existing bookings remain accessible. The owner can enable rentals in Rental settings.</p></section> : <>
      {data.configuration.policy.dateFirstEnabled && <RentalDateSearch base={apiBase} storeSlug={storeSlug} policy={data.configuration.policy} draft={dateDraft} loading={loading} onChange={(key, value) => { setDateDraft(old => ({ ...old, [key]: value })); setApplied(null); }} onSearch={value => { setApplied(value); setPage(1); setHasSearched(true); }} />}
      <div className="rental-fields"><label className="rental-field"><span>Find an outfit, jewellery or accessory</span><input value={search} onChange={e => setSearch(e.target.value)} /></label><label className="rental-field"><span>Category</span><select value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}><option value="">All categories</option>{categories.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label><button type="button" className="rental-button" onClick={() => { setQuery(search); setPage(1); }}>Search</button></div>
      {(!data.configuration.policy.dateFirstEnabled || hasSearched) && <RentalBookingForm listings={Object.values(cache)} visibleIds={data.rows.map(row => row._id)} configuration={data.configuration} user={user} storeSlug={storeSlug} counter={counter} apiBase={apiBase} initialProductId={initialProductId} initialItems={initialItems} initialSchedule={dateDraft} onScheduleChange={(key, value) => { setDateDraft(old => ({ ...old, [key]: value })); setApplied(null); }} onBooked={onBooked} />}
      {data.configuration.policy.dateFirstEnabled && applied && !loading && !error && loadedKey === requestKey && <RentalAvailabilityHints key={requestKey} rows={data.rows.filter(row => row.availability)} schedule={applied} timezone={data.configuration.policy.timezone} base={apiBase} storeSlug={storeSlug} onDates={schedule => { setDateDraft(old => ({ ...old, pickupAt: localDateTime(schedule.pickupAt, data.configuration.policy.timezone), returnDueAt: localDateTime(schedule.returnDueAt, data.configuration.policy.timezone) })); setApplied({ ...applied, pickupAt: schedule.pickupAt, returnDueAt: schedule.returnDueAt }); setPage(1); }} onChoose={(match, replacedId) => { setCache(old => ({ ...old, [match._id]: match })); setInitialItems([{ listingId: match._id, quantity: 1, replaces: replacedId }]); }} />}
      <div className="rental-actions"><button type="button" disabled={page <= 1} className="rental-button rental-button--secondary" onClick={() => setPage(p => p - 1)}>Previous</button><span>Page {data.page} of {Math.max(1, data.pages)} · selections stay in your rental bag</span><button type="button" disabled={page >= data.pages} className="rental-button rental-button--secondary" onClick={() => setPage(p => p + 1)}>Next</button></div>
    </>}
  </>;
}
