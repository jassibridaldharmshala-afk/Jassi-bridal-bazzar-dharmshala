import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, ChevronRight, Package, RefreshCw, Search, SlidersHorizontal } from 'lucide-react';
import api from '../../services/api';
import { rentalCopy } from '../../utils/rentalCopy';
import { rentalDate, rentalMoney, rentalUrl } from '../../utils/rentals';
import { rentalUseDayLabel } from '../../utils/rentalShopping';
import { responsiveImage } from '../../utils/responsiveImages';
import { orderDate } from '../../utils/orderPresentation';
import { OrderState } from './OrderUi';
import RentalWaitlist from '../rentals/RentalWaitlist';

const statuses = ['HELD', 'CONFIRMED', 'PREPARING', 'READY', 'OUT', 'RETURNED', 'CLOSED', 'CANCELLED', 'EXPIRED'];
const terminal = ['CANCELLED', 'EXPIRED', 'CLOSED'];
function RentalItem({ item }) {
  const [failed, setFailed] = useState(false);
  const image = responsiveImage(item.image, 'thumbnail');
  return <div className="sc-order-item">
    <div className="sc-order-item__image">{image.src && !failed ? <img {...image} alt={item.title || 'Rental item'} loading="lazy" onError={() => setFailed(true)} /> : <Package size={25} aria-label="Product image unavailable" />}</div>
    <div className="sc-order-item__body"><h3>{item.title || 'Rental item'}</h3><p className="sc-order-item__variant">{[item.sizeLabel, item.colour, 'Qty: ' + item.quantity].filter(Boolean).join(' · ')}</p><p className="sc-order-item__price">{rentalMoney(item.rentPaise)} <span className="sc-rental-order__rent-label">rent</span></p></div>
  </div>;
}
function RentalCard({ booking: b, navigate }) {
  const finance = b.financial || {}, timezone = b.policy.timezone;
  const expired = b.status === 'HELD' && b.expiresAt && +new Date(b.expiresAt) <= Date.now();
  const status = expired ? 'EXPIRED' : b.status;
  const pending = b.requests?.find(request => request.status === 'PENDING');
  const payment = status === 'HELD' ? 'Advance payment needed' : terminal.includes(status) ? 'View payment & refund details' : b.quote.paymentPlan === 'PICKUP' && finance.balancePaise > 0 ? 'Payment due at pickup' : finance.balancePaise > 0 ? finance.collectedPaise > 0 ? 'Part payment received' : 'Payment remaining' : 'Payment complete';
  return <article className="sc-order-card sc-rental-order" aria-label={'Rental booking ' + b.number}>
    <header className="sc-order-card__meta"><div><span>BOOKED ON</span><p>{orderDate(b.createdAt) || 'Date unavailable'}</p></div><div><span>{terminal.includes(status) ? 'ORIGINAL TOTAL' : 'BOOKING TOTAL'}</span><p>{rentalMoney(b.quote.totalPaise)}</p></div><div className="sc-order-card__id"><span>BOOKING ID</span><p>{b.number}</p></div></header>
    <div className="sc-order-card__status"><span className={'sc-order-status sc-order-status--' + (['CANCELLED', 'EXPIRED'].includes(status) ? 'cancelled' : ['CONFIRMED', 'READY', 'CLOSED'].includes(status) ? 'success' : 'pending')}><span />{rentalCopy(status)}</span><span>{payment}</span></div>
    <div className="sc-order-card__items">{b.quote.items.map((item, index) => <RentalItem key={item.listingId || index} item={item} />)}</div>
    <div className="sc-rental-order__plan">
      {b.schedule.useDates?.length > 0 && <p className="sc-rental-order__use-days"><CalendarDays size={16} aria-hidden="true" /><span><strong>Use {b.schedule.useDates.length === 1 ? 'day' : 'days'}</strong> · {b.schedule.useDates.map(rentalUseDayLabel).join(', ')}<small>{b.schedule.days} paid {b.schedule.days === 1 ? 'use day' : 'use days'} · Extra pickup and return days add no rent.</small></span></p>}
      <dl className="sc-rental-order__dates"><div><dt>{b.quote.deliveryMode === 'STORE_PICKUP' ? 'Pickup' : 'Delivery'}</dt><dd>{rentalDate(b.schedule.pickupAt, timezone)}</dd></div><div><dt>Return by</dt><dd>{rentalDate(b.schedule.returnDueAt, timezone)}</dd></div></dl>
      <dl className="sc-rental-order__payments"><div><dt>Paid</dt><dd>{rentalMoney(finance.collectedPaise)}</dd></div>{!terminal.includes(status) && <div><dt>Balance due</dt><dd>{rentalMoney(finance.balancePaise)}</dd></div>}<div><dt>Refundable security</dt><dd>{rentalMoney(b.quote.depositPaise)}</dd></div>{finance.refundedPaise > 0 && <div><dt>Refund processed</dt><dd>{rentalMoney(finance.refundedPaise)}</dd></div>}{terminal.includes(status) && finance.refundablePaise > 0 && <div><dt>Refund available</dt><dd>{rentalMoney(finance.refundablePaise)}</dd></div>}</dl>
      {status === 'HELD' && b.expiresAt && <p className="sc-rental-order__notice">Pay before {rentalDate(b.expiresAt, timezone)} to confirm your booking.</p>}
      {b.overdue && <p className="sc-rental-order__notice" role="status">Return overdue. Contact the store to arrange your return.</p>}
      {pending && <p className="sc-rental-order__notice">{pending.type === 'CANCEL' ? 'Cancellation under review' : 'Your request is awaiting store review'}</p>}
    </div>
    <footer><p>{rentalCopy(b.quote.deliveryMode || 'STORE_PICKUP')}</p><button className="sc-orders__text" type="button" onClick={() => navigate('/rentals?id=' + encodeURIComponent(b._id))}>View booking<ChevronRight size={16} aria-hidden="true" /></button></footer>
  </article>;
}
export default function CustomerRentalOrders({ route, navigate, storeSlug }) {
  const params = new URLSearchParams(route.split('?')[1] || '');
  const search = params.get('search') || '', status = params.get('status') || '';
  const page = Math.min(10000, Math.max(1, Math.floor(Number(params.get('page')) || 1)));
  const [draft, setDraft] = useState(search), [data, setData] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [reload, setReload] = useState(0), [alertsOpen, setAlertsOpen] = useState(false);
  useEffect(() => setDraft(search), [search]);
  useEffect(() => setData(null), [page, search, status, storeSlug]);
  const refresh = useCallback(() => setReload(value => value + 1), []);
  useEffect(() => {
    let active = true;
    setError(''); setLoading(true);
    const query = new URLSearchParams({ page: String(page) });
    if (search) query.set('search', search);
    if (status) query.set('status', status);
    api.get(rentalUrl('/rentals/bookings?' + query, storeSlug), { silent: true, forceRefetch: true }).then(value => {
      if (!active) return;
      if (!Array.isArray(value?.rows) || value.rows.some(b => !b?._id || !b.quote || !Array.isArray(b.quote.items) || !b.schedule || !b.policy)) throw new Error('Your rental bookings could not be loaded. Please try again.');
      setData({ ...value, total: Number(value.total) || value.rows.length, pages: Math.max(1, Number(value.pages) || 1) });
    }).catch(e => { if (active) setError(e.details || e.message || 'Unable to load rental bookings.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, search, status, storeSlug, reload]);
  useEffect(() => {
    const update = () => { if (!document.hidden && navigator.onLine !== false) refresh(); };
    const timer = window.setInterval(update, 45000);
    window.addEventListener('focus', update); window.addEventListener('online', update); document.addEventListener('visibilitychange', update);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', update); window.removeEventListener('online', update); document.removeEventListener('visibilitychange', update); };
  }, [refresh]);
  const change = values => {
    const next = new URLSearchParams({ type: 'rental' });
    if (search) next.set('search', search);
    if (status) next.set('status', status);
    Object.entries(values).forEach(([key, value]) => value ? next.set(key, String(value)) : next.delete(key));
    navigate('/orders?' + next);
  };
  const filtered = search || status;
  return <>
    <div className="sc-orders__tools">
      <form className="sc-orders__search" onSubmit={e => { e.preventDefault(); change({ search: draft.trim() }); }}><Search size={19} aria-hidden="true" /><input aria-label="Search rental bookings" placeholder="Search by booking ID or name" value={draft} maxLength={100} onChange={e => setDraft(e.target.value)} /><button type="submit">Search</button></form>
      <div className="sc-orders__filters"><SlidersHorizontal size={17} aria-hidden="true" /><select aria-label="Rental booking status" value={status} onChange={e => change({ status: e.target.value })}><option value="">All booking statuses</option>{statuses.map(value => <option key={value} value={value}>{rentalCopy(value)}</option>)}</select><button className="sc-orders__refresh" type="button" disabled={loading} aria-label="Refresh rental bookings" onClick={refresh}><RefreshCw size={17} aria-hidden="true" /></button></div>
    </div>
    {!data ? loading ? <OrderState loading title="Loading your rental bookings…" /> : <OrderState title="Unable to load rental bookings" error={error} retry={refresh} /> : <>
      {error && <div className="sc-orders__error" role="alert">{error} These updates may be out of date. <button className="sc-orders__text" onClick={refresh}>Try again</button></div>}
      <div className="sc-orders__results" aria-live="polite"><p>{data.total} rental {data.total === 1 ? 'booking' : 'bookings'}{filtered ? ' found' : ''}</p>{filtered && <button className="sc-orders__text" onClick={() => navigate('/orders?type=rental')}>Clear filters</button>}</div>
      {!data.rows.length ? <OrderState title={filtered ? 'No matching rental bookings' : 'No rental bookings yet'}><p>{filtered ? 'Try a different booking ID or status.' : 'Your booked outfits and rental updates will appear here.'}</p><button className="sc-orders__button" onClick={() => navigate(filtered ? '/orders?type=rental' : '/rental-book')}>{filtered ? 'View all bookings' : 'Explore rentals'}</button></OrderState>
        : <div className="sc-orders__list">{data.rows.map(b => <RentalCard key={b._id} booking={b} navigate={navigate} />)}</div>}
      {data.pages > 1 && <nav className="sc-orders__pagination" aria-label="Rental booking pages"><button className="sc-orders__outline" disabled={page <= 1} onClick={() => change({ page: page - 1 })}>Previous</button><span>Page {page} of {data.pages}</span><button className="sc-orders__outline" disabled={page >= data.pages} onClick={() => change({ page: page + 1 })}>Next</button></nav>}
    </>}
    <details className="sc-orders__rental-alerts" onToggle={event => setAlertsOpen(event.currentTarget.open)}><summary>Availability alerts</summary>{alertsOpen && <RentalWaitlist storeSlug={storeSlug} navigate={navigate} />}</details>
  </>;
}
