import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { CalendarDays, CalendarX2, CheckCircle2, ChevronLeft, ChevronRight, RotateCw } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { storefrontPath } from '../../utils/routing';
import { localDateTime, rentalDate, rentalMoney, rentalUrl } from '../../utils/rentals';
import './Rentals.css';
import './RentalAvailabilityCalendar.css';

function times(policy) {
  const minute = time => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  const result = [];
  for (let at = minute(policy.pickupStart); at < minute(policy.pickupEnd); at += policy.slotMinutes) result.push(`${String(Math.floor(at / 60)).padStart(2, '0')}:${String(at % 60).padStart(2, '0')}`);
  return result;
}
export default function RentalAvailabilityCalendar({ listing, items, title, policy, storeSlug, quantity = 1, deliveryMode, onChoose, apiBase = '/rentals', initialSchedule, availabilityOnly = false }) {
  const { user } = useAuth() || {};
  const viewer = user?._id || user?.id || '';
  const fieldId = useId();
  const today = localDateTime(new Date(), policy.timezone).slice(0, 10);
  const maxMonth = localDateTime(Date.now() + policy.maximumAdvanceDays * 86400000, policy.timezone).slice(0, 7);
  const slotTimes = useMemo(() => times(policy), [policy]);
  const requestedPickup = initialSchedule?.pickupAt, requestedReturn = initialSchedule?.returnDueAt;
  const scheduledMonth = requestedPickup?.slice(0, 7), scheduledDays = Math.round((Date.parse((requestedReturn?.slice(0, 10) || '') + 'T12:00Z') - Date.parse((requestedPickup?.slice(0, 10) || '') + 'T12:00Z')) / 86400000);
  const [month, setMonth] = useState(scheduledMonth >= today.slice(0, 7) && scheduledMonth <= maxMonth ? scheduledMonth : today.slice(0, 7)), [days, setDays] = useState(scheduledDays >= policy.minimumDays && scheduledDays <= policy.maximumDays ? scheduledDays : policy.minimumDays);
  const [pickupTime, setPickupTime] = useState(slotTimes.includes(requestedPickup?.slice(11)) ? requestedPickup.slice(11) : policy.pickupStart), [returnTime, setReturnTime] = useState(slotTimes.includes(requestedReturn?.slice(11)) ? requestedReturn.slice(11) : policy.pickupStart);
  const [data, setData] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [reload, setReload] = useState(0), [selected, setSelected] = useState('');
  const itemsKey = items ? JSON.stringify(items) : '';
  const key = JSON.stringify({ listingId: listing?._id, itemsKey, month, days, quantity, pickupTime, returnTime, deliveryMode, storeSlug, apiBase, viewer });
  const [loadedKey, setLoadedKey] = useState('');
  const fetching = useRef(false);
  const refreshQueued = useRef(false);
  useEffect(() => { setSelected(''); }, [key]);
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
    fetching.current = true; setBusy(true); setError('');
    const query = new URLSearchParams({ month, days: String(days), quantity: String(quantity), pickupTime, returnTime, ...(deliveryMode ? { deliveryMode } : {}) });
    const request = itemsKey ? api.post(rentalUrl(`${apiBase}/calendar`, storeSlug), { month, days, pickupTime, returnTime, deliveryMode, items: JSON.parse(itemsKey) }, { silent: true }) : api.get(rentalUrl(`/rentals/calendar/${listing._id}?${query}`, storeSlug), { silent: true, forceRefetch: true, cache: 'no-store', cacheScope: viewer });
    Promise.resolve(request)
      .then(value => { if (alive) { if (!Array.isArray(value?.rows)) throw new Error('Availability could not be loaded.'); setData(value); setLoadedKey(key); } })
      .catch(e => { if (alive) setError(e.details || e.message); })
      .finally(() => { if (alive) { fetching.current = false; setBusy(false); if (refreshQueued.current) { refreshQueued.current = false; setLoadedKey(''); setReload(value => value + 1); } } });
    return () => { alive = false; };
  }, [listing?._id, itemsKey, month, days, quantity, pickupTime, returnTime, deliveryMode, storeSlug, reload, key, apiBase, viewer]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'hidden') return; if (fetching.current) { refreshQueued.current = true; return; } setLoadedKey(''); setReload(value => value + 1); };
    const storage = event => { if (event.key === 'samira:rental-availability-changed') refresh(); };
    const timer = setInterval(refresh, 30000);
    window.addEventListener('focus', refresh); window.addEventListener('online', refresh); document.addEventListener('visibilitychange', refresh);
    window.addEventListener('samira:rental-availability-changed', refresh); window.addEventListener('storage', storage);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh); document.removeEventListener('visibilitychange', refresh); window.removeEventListener('samira:rental-availability-changed', refresh); window.removeEventListener('storage', storage); };
  }, []);
  const current = loadedKey === key && !busy && !error;
  const row = current ? data.rows.find(item => item.date === selected) : null;
  const myBookings = current ? [...new Map(data.rows.filter(item => item.ownBooking).map(item => [item.ownBooking.id, item.ownBooking])).values()] : [];
  const offset = new Date(`${month}-01T12:00:00Z`).getUTCDay();
  const monthLabel = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T12:00:00Z`));
  const monthChange = amount => { const date = new Date(`${month}-01T12:00:00Z`); date.setUTCMonth(date.getUTCMonth() + amount); setMonth(date.toISOString().slice(0, 7)); };
  const nextAvailable = current && data.rows.find(item => item.status === 'AVAILABLE' && item.date >= today);
  const timeLabel = time => new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(new Date(`2000-01-01T${time}:00Z`));
  const dateLabel = date => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
  const partial = item => item.status === 'AVAILABLE' && item.availability?.some(stock => stock.bookedQuantity > 0 || stock.blockedQuantity > 0);
  const stockLabel = item => item.status === 'ALREADY_BOOKED' ? 'Booked by you' : item.status === 'AVAILABLE' && item.availability?.length === 1 ? `${item.availability[0].availableQuantity} left` : item.status === 'UNAVAILABLE' ? item.availability?.some(stock => stock.bookedQuantity > 0) ? 'Booked' : 'Blocked' : '';
  const bookingLink = booking => storefrontPath('/rentals?id=' + encodeURIComponent(booking.id), storeSlug);
  const bookingSummary = booking => <><p>{booking.number && <strong>{booking.number} · </strong>}{({ HELD: 'Pending payment', CONFIRMED: 'Confirmed', PREPARING: 'Preparing', READY: 'Ready for pickup', OUT: 'With you' })[booking.status] || 'Booked'}</p><p>Pickup {rentalDate(booking.pickupAt, policy.timezone)} · Return {rentalDate(booking.returnDueAt, policy.timezone)}</p>{booking.useDates?.length > 0 && <p>Use {booking.useDates.map(dateLabel).join(', ')}</p>}{booking.status === 'HELD' && booking.expiresAt && <p>Complete payment by {rentalDate(booking.expiresAt, policy.timezone)}.</p>}<a href={bookingLink(booking)}>View your booking →</a></>;
  return <section className="rental-availability" aria-label={`Availability for ${title || listing?.title || 'your complete rental set'}`} aria-busy={busy}>
    <header className="rental-availability__header">
      <h3><CalendarDays size={19} aria-hidden="true" />Date availability</h3>
      <button type="button" className="rental-availability__refresh" onClick={() => setReload(value => value + 1)} disabled={busy}><RotateCw size={15} aria-hidden="true" />Refresh</button>
    </header>
    <p className="rental-availability__intro">Choose a pickup date. {itemsKey ? `All ${items.length} selected offers and quantities are checked together.` : `Availability is checked for ${quantity} ${quantity === 1 ? 'set' : 'sets'} across the full period.`}</p>
    {!!myBookings.length && !row?.ownBooking && <div className="rental-availability__own-bookings" role="status">{myBookings.map(booking => <div key={booking.id}><strong>{booking.status === 'HELD' ? 'You have a pending hold for this item' : 'You already booked this item'}</strong>{bookingSummary(booking)}</div>)}</div>}
    <div className="rental-availability__controls">
      <div className="rental-availability__field"><label htmlFor={`${fieldId}-duration`}>{availabilityOnly ? 'Pickup-to-return period' : 'Rental duration'}</label><select id={`${fieldId}-duration`} value={days} onChange={event => setDays(Number(event.target.value))}>{Array.from({ length: policy.maximumDays - policy.minimumDays + 1 }, (_, index) => policy.minimumDays + index).map(day => <option key={day} value={day}>{day} {day === 1 ? 'day' : 'days'}</option>)}</select></div>
      <div className="rental-availability__field"><label htmlFor={`${fieldId}-pickup`}>Pickup time</label><select id={`${fieldId}-pickup`} value={pickupTime} onChange={event => setPickupTime(event.target.value)}>{slotTimes.map(time => <option key={time} value={time}>{timeLabel(time)}</option>)}</select></div>
      <div className="rental-availability__field"><label htmlFor={`${fieldId}-return`}>Return time</label><select id={`${fieldId}-return`} value={returnTime} onChange={event => setReturnTime(event.target.value)}>{slotTimes.map(time => <option key={time} value={time}>{timeLabel(time)}</option>)}</select></div>
    </div>
    <nav className="rental-availability__month" aria-label="Calendar month">
      <button type="button" aria-label="Previous month" disabled={month <= today.slice(0, 7)} onClick={() => monthChange(-1)}><ChevronLeft size={18} aria-hidden="true" /></button>
      <strong>{monthLabel}</strong>
      <button type="button" aria-label="Next month" disabled={month >= maxMonth} onClick={() => monthChange(1)}><ChevronRight size={18} aria-hidden="true" /></button>
    </nav>
    {error ? <p className="rental-availability__error" role="alert">{error} Use Refresh to try again.</p> : busy ? <>
      <p role="status" className="rental-availability__loading">Checking pieces and reservations…</p>
      <div className="rental-availability__skeleton" aria-hidden="true">{Array.from({ length: 28 }, (_, index) => <span key={index} />)}</div>
    </> : null}
    {current && <>
      <div className="rental-availability__days">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <span className="rental-availability__weekday" key={day}>{day}</span>)}
        {Array.from({ length: offset }, (_, index) => <span key={`blank-${index}`} />)}
        {data.rows.map(item => <button type="button" key={item.date} className={`rental-availability__day rental-availability__day--${item.status.toLowerCase()}${partial(item) ? ' is-partly-booked' : ''}${selected === item.date ? ' is-selected' : ''}`} aria-label={`${item.date}: ${item.status === 'ALREADY_BOOKED' ? 'Already booked by you' : item.status === 'AVAILABLE' ? partial(item) ? 'Some pieces booked; available' : 'Available' : item.status === 'UNAVAILABLE' ? 'Unavailable for selected period' : item.reason}`} aria-pressed={selected === item.date} disabled={item.status === 'UNBOOKABLE'} title={item.reason || (partial(item) ? 'Some pieces are booked. Check remaining availability.' : 'Available for selected period')} onClick={() => setSelected(item.date)}><span>{Number(item.date.slice(-2))}</span>{stockLabel(item) ? <small>{item.status === 'ALREADY_BOOKED' ? 'Yours' : stockLabel(item)}</small> : <i aria-hidden="true" />}</button>)}
      </div>
      <div className="rental-availability__legend"><span><i className="is-available" aria-hidden="true" />Available</span><span><i className="is-partial" aria-hidden="true" />Some pieces booked</span><span><i className="is-unavailable" aria-hidden="true" />Booked / unavailable</span>{!!myBookings.length && <span><i className="is-yours" aria-hidden="true" />Your booking</span>}<span><i className="is-unbookable" aria-hidden="true" />Closed / outside booking window</span></div>
      <div className="rental-availability__suggestion">{nextAvailable ? <button type="button" onClick={() => setSelected(nextAvailable.date)}>Next available pickup: {dateLabel(nextAvailable.date)} →</button> : <p>No available start dates this month for the selected period.{month < maxMonth && <button type="button" onClick={() => monthChange(1)}>Check next month →</button>}</p>}</div>
    </>}
    {row && <div className={`rental-availability__selection${row.status !== 'AVAILABLE' ? ' rental-availability__selection--unavailable' : ''}`} role="status">
      <strong className="rental-availability__confirmed">{row.status === 'AVAILABLE' ? <CheckCircle2 size={17} aria-hidden="true" /> : <CalendarX2 size={17} aria-hidden="true" />}{row.ownBooking ? row.ownBooking.status === 'HELD' ? 'Your pending hold' : 'Already booked by you' : row.status === 'AVAILABLE' ? 'Available for this period' : 'Unavailable for this period'}</strong>
      {row.ownBooking ? bookingSummary(row.ownBooking) : <>
      <dl className="rental-availability__schedule"><div><dt>Pickup</dt><dd>{rentalDate(row.pickupAt, policy.timezone)}</dd></div><div><dt>Return by</dt><dd>{rentalDate(row.returnDueAt, policy.timezone)}</dd></div></dl>
      {row.status !== 'AVAILABLE' && <p>{row.reason}</p>}
      </>}
      {row.availability?.map(stock => <div key={stock.listingId} className="rental-availability__stock">{row.availability.length > 1 && <strong>{stock.title}</strong>}<dl><div><dt>Available</dt><dd>{stock.availableQuantity}</dd></div><div><dt>Booked / held</dt><dd>{stock.bookedQuantity}</dd></div>{stock.blockedQuantity > 0 && <div><dt>Cleaning / blocked</dt><dd>{stock.blockedQuantity}</dd></div>}</dl></div>)}
      {row.status === 'AVAILABLE' && <>
      {!availabilityOnly && row.billableDays && <p>Charged duration: {row.billableDays} {row.billableDays === 1 ? 'day' : 'days'} (based on pickup and return times).</p>}
      {availabilityOnly ? <p>Select your actual use days at checkout to calculate rent. Extra pickup and return days add no rent.</p> : <><p>Rent & services {rentalMoney(row.rentalPaise)} · refundable deposit {rentalMoney(row.depositPaise)}</p><p>Due to confirm: {rentalMoney(row.dueNowPaise)}</p></>}
      <button type="button" className="rental-availability__choose" onClick={() => onChoose?.({ ...row, ...(listing ? { listingId: listing._id } : { items: JSON.parse(itemsKey) }) })}>Use these dates</button>
      </>}
    </div>}
    <footer className="rental-availability__footer">
      <p>Times in {policy.timezone}.{current && data.checkedAt && <> Checked {rentalDate(data.checkedAt, policy.timezone)}.</>}</p>
      <p>Preparation and cleaning included. Updates every 30 seconds. Rechecked before booking; selecting a date does not reserve a piece.</p>
    </footer>
  </section>;
}
