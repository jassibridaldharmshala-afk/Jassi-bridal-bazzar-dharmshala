import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../../services/api';
import { localDateTime, rentalDate, rentalMoney, rentalUrl } from '../../utils/rentals';
import './Rentals.css';

function times(policy) {
  const minute = time => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  const result = [];
  for (let at = minute(policy.pickupStart); at < minute(policy.pickupEnd); at += policy.slotMinutes) result.push(`${String(Math.floor(at / 60)).padStart(2, '0')}:${String(at % 60).padStart(2, '0')}`);
  return result;
}
export default function RentalAvailabilityCalendar({ listing, items, title, policy, storeSlug, quantity = 1, deliveryMode, onChoose, apiBase = '/rentals', initialSchedule }) {
  const today = localDateTime(new Date(), policy.timezone).slice(0, 10);
  const maxMonth = localDateTime(Date.now() + policy.maximumAdvanceDays * 86400000, policy.timezone).slice(0, 7);
  const slotTimes = useMemo(() => times(policy), [policy]);
  const requestedPickup = initialSchedule?.pickupAt, requestedReturn = initialSchedule?.returnDueAt;
  const scheduledMonth = requestedPickup?.slice(0, 7), scheduledDays = Math.round((Date.parse((requestedReturn?.slice(0, 10) || '') + 'T12:00Z') - Date.parse((requestedPickup?.slice(0, 10) || '') + 'T12:00Z')) / 86400000);
  const [month, setMonth] = useState(scheduledMonth >= today.slice(0, 7) && scheduledMonth <= maxMonth ? scheduledMonth : today.slice(0, 7)), [days, setDays] = useState(scheduledDays >= policy.minimumDays && scheduledDays <= policy.maximumDays ? scheduledDays : policy.minimumDays);
  const [pickupTime, setPickupTime] = useState(slotTimes.includes(requestedPickup?.slice(11)) ? requestedPickup.slice(11) : policy.pickupStart), [returnTime, setReturnTime] = useState(slotTimes.includes(requestedReturn?.slice(11)) ? requestedReturn.slice(11) : policy.pickupStart);
  const [data, setData] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [reload, setReload] = useState(0), [selected, setSelected] = useState('');
  const itemsKey = items ? JSON.stringify(items) : '';
  const key = JSON.stringify({ listingId: listing?._id, itemsKey, month, days, quantity, pickupTime, returnTime, deliveryMode, storeSlug, apiBase });
  const [loadedKey, setLoadedKey] = useState('');
  const fetching = useRef(false);
  useEffect(() => {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(requestedPickup || '') || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(requestedReturn || '')) return;
    const selectedMonth = requestedPickup.slice(0, 7), period = Math.round((Date.parse(requestedReturn.slice(0, 10) + 'T12:00Z') - Date.parse(requestedPickup.slice(0, 10) + 'T12:00Z')) / 86400000);
    if (selectedMonth >= today.slice(0, 7) && selectedMonth <= maxMonth) setMonth(selectedMonth);
    if (period >= policy.minimumDays && period <= policy.maximumDays) setDays(period);
    if (slotTimes.includes(requestedPickup.slice(11))) setPickupTime(requestedPickup.slice(11));
    if (slotTimes.includes(requestedReturn.slice(11))) setReturnTime(requestedReturn.slice(11));
  }, [requestedPickup, requestedReturn, maxMonth, today, policy.minimumDays, policy.maximumDays, slotTimes]);
  useEffect(() => {
    let alive = true;
    fetching.current = true; setBusy(true); setError(''); setSelected('');
    const query = new URLSearchParams({ month, days: String(days), quantity: String(quantity), pickupTime, returnTime, ...(deliveryMode ? { deliveryMode } : {}) });
    const request = itemsKey ? api.post(rentalUrl(`${apiBase}/calendar`, storeSlug), { month, days, pickupTime, returnTime, deliveryMode, items: JSON.parse(itemsKey) }, { silent: true }) : api.get(rentalUrl(`/rentals/calendar/${listing._id}?${query}`, storeSlug), { silent: true, forceRefetch: true });
    Promise.resolve(request)
      .then(value => { if (alive) { if (!Array.isArray(value?.rows)) throw new Error('Availability could not be loaded.'); setData(value); setLoadedKey(key); } })
      .catch(e => { if (alive) setError(e.details || e.message); })
      .finally(() => { if (alive) { fetching.current = false; setBusy(false); } });
    return () => { alive = false; };
  }, [listing?._id, itemsKey, month, days, quantity, pickupTime, returnTime, deliveryMode, storeSlug, reload, key, apiBase]);
  useEffect(() => {
    const refresh = () => { if (!fetching.current && document.visibilityState !== 'hidden') { setLoadedKey(''); setReload(value => value + 1); } };
    const timer = setInterval(refresh, 60000);
    window.addEventListener('focus', refresh); window.addEventListener('online', refresh); document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  const current = loadedKey === key && !busy && !error;
  const row = current ? data.rows.find(item => item.date === selected) : null;
  const offset = new Date(`${month}-01T12:00:00Z`).getUTCDay();
  const monthLabel = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T12:00:00Z`));
  const monthChange = amount => { const date = new Date(`${month}-01T12:00:00Z`); date.setUTCMonth(date.getUTCMonth() + amount); setMonth(date.toISOString().slice(0, 7)); };
  const nextAvailable = current && data.rows.find(item => item.status === 'AVAILABLE' && item.date >= today);
  return <section className="rental-calendar" aria-label={`Availability for ${title || listing?.title || 'your complete rental set'}`} aria-busy={busy}>
    <header><div><span className="rental-eyebrow">PLAN YOUR OCCASION</span><h3>Find your dates</h3></div><button type="button" className="rental-text-button" onClick={() => setReload(value => value + 1)} disabled={busy}>Refresh</button></header>
    <p className="rental-muted">{itemsKey ? `Availability for all ${items.length} selected offers and their quantities together` : `Availability for ${quantity} ${quantity === 1 ? 'set' : 'sets'}`}, for the full period you choose. Times use {policy.timezone}.</p>
    <div className="rental-calendar__controls">
      <label className="rental-field"><span>Rental duration</span><select value={days} onChange={event => setDays(Number(event.target.value))}>{Array.from({ length: policy.maximumDays - policy.minimumDays + 1 }, (_, index) => policy.minimumDays + index).map(day => <option key={day} value={day}>{day} {day === 1 ? 'day' : 'days'}</option>)}</select></label>
      <label className="rental-field"><span>Pickup time</span><select value={pickupTime} onChange={event => setPickupTime(event.target.value)}>{slotTimes.map(time => <option key={time}>{time}</option>)}</select></label>
      <label className="rental-field"><span>Return time</span><select value={returnTime} onChange={event => setReturnTime(event.target.value)}>{slotTimes.map(time => <option key={time}>{time}</option>)}</select></label>
    </div>
    <nav className="rental-calendar__month" aria-label="Calendar month"><button type="button" aria-label="Previous month" disabled={month <= today.slice(0, 7)} onClick={() => monthChange(-1)}>‹</button><strong>{monthLabel}</strong><button type="button" aria-label="Next month" disabled={month >= maxMonth} onClick={() => monthChange(1)}>›</button></nav>
    {error ? <p className="rental-notice" role="alert">{error} Use Refresh to try again.</p> : busy ? <p role="status" className="rental-muted">Checking pieces and reservations…</p> : null}
    {current && <><div className="rental-calendar__days">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <span className="rental-calendar__weekday" key={day}>{day}</span>)}{Array.from({ length: offset }, (_, index) => <span key={`blank-${index}`} />)}{data.rows.map(item => <button type="button" key={item.date} className={`rental-calendar__day rental-calendar__day--${item.status.toLowerCase()}${selected === item.date ? ' is-selected' : ''}`} aria-label={`${item.date}: ${item.status === 'AVAILABLE' ? 'Available' : item.status === 'UNAVAILABLE' ? 'Unavailable for selected period' : item.reason}`} aria-pressed={selected === item.date} disabled={item.status !== 'AVAILABLE'} title={item.reason || 'Available for selected period'} onClick={() => setSelected(item.date)}><span>{Number(item.date.slice(-2))}</span><i aria-hidden="true" /></button>)}</div><div className="rental-calendar__legend"><span><i className="is-available" />Available</span><span><i className="is-unavailable" />Booked / unavailable</span><span><i className="is-unbookable" />Closed / outside booking window</span></div></>}
    {current && <div className="rental-calendar__suggestion">{nextAvailable ? <button type="button" className="rental-text-button" onClick={() => setSelected(nextAvailable.date)}>Next available start this month: {nextAvailable.date} →</button> : <p>No available start dates this month for the selected period.{month < maxMonth && <button type="button" className="rental-text-button" onClick={() => monthChange(1)}>Check next month →</button>}</p>}</div>}
    {row && <div className="rental-calendar__selection" role="status"><strong>{rentalDate(row.pickupAt, policy.timezone)} → {rentalDate(row.returnDueAt, policy.timezone)}</strong>{row.billableDays && <p>Charged duration: {row.billableDays} {row.billableDays === 1 ? 'day' : 'days'} (based on pickup and return times).</p>}<p>Rent & services {rentalMoney(row.rentalPaise)} · refundable deposit {rentalMoney(row.depositPaise)}</p><p>Due to confirm: {rentalMoney(row.dueNowPaise)}</p><button type="button" className="rental-button" onClick={() => onChoose?.({ ...row, ...(listing ? { listingId: listing._id } : { items: JSON.parse(itemsKey) }) })}>Use these dates</button></div>}
    <p className="rental-muted rental-calendar__footnote">{current && data.checkedAt && <>Checked {rentalDate(data.checkedAt, policy.timezone)}. </>}Updates every minute and when you return to this page. {itemsKey && 'Every selected item and quantity is checked together. '}Preparation and cleaning time are included. Availability is checked again before booking; a selected date alone does not reserve a piece.</p>
  </section>;
}
