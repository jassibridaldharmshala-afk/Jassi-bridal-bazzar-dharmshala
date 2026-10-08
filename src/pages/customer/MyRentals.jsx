import RentalCustomerBooking from '../../components/rentals/RentalCustomerBooking';
import { ArrowLeft, CalendarDays, ChevronRight } from 'lucide-react';
import { rentalCopy } from '../../utils/rentalCopy';
import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../services/api';
import { useBrandIdentity } from '../../context/BrandIdentityContext';
import { useStorefront } from '../../context/StorefrontContext';
import { storefrontPath } from '../../utils/routing';
import RentalWaitlist from '../../components/rentals/RentalWaitlist';
import { readRentalSession, saveRentalSession, clearRentalSession } from '../../utils/rentalPlan';
import { openRentalPayment, rentalDate, rentalInstant, rentalMoney, rentalOperation, rentalUrl } from '../../utils/rentals';
export default function MyRentals({ route = '/rentals', navigate: navigateRoute, success = false }) {
  const { storeSlug } = useStorefront();
  const navigate = path => navigateRoute(storefrontPath(path, storeSlug));
  const brand = useBrandIdentity(); const bookingId = new URLSearchParams(route.split('?')[1] || '').get('id');
  const actor = bookingId || '';
  const [data, setData] = useState(null), [booking, setBooking] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [page, setPage] = useState(1), [message, setMessage] = useState('');
  const [request, setRequest] = useState({ type: 'RETURN_COLLECTION', note: '', pickupAt: '', returnDueAt: '' });
  const [methods, setMethods] = useState([]), [method, setMethod] = useState('');
  const [methodError, setMethodError] = useState(''), [methodsLoading, setMethodsLoading] = useState(false), [contact, setContact] = useState({});
  const methodsGeneration = useRef(0);
  const loadMethods = useCallback(async () => {
    const scope = ++methodsGeneration.current; setMethodsLoading(true); setMethodError('');
    try { const value = await api.get(rentalUrl('/rentals/payment-methods', storeSlug), { silent: true, forceRefetch: true }); if (!Array.isArray(value)) throw new Error('Payment options could not be loaded.'); if (scope !== methodsGeneration.current) return; const enabled = value.filter(m => m.enabled); setMethods(enabled); setMethod(old => enabled.some(m => m.key === old) ? old : enabled[0]?.key || ''); if (!enabled.length) setMethodError('Online payment is currently unavailable. Contact the store to arrange payment for your existing booking.'); }
    catch (e) { if (scope === methodsGeneration.current) { setMethods([]); setMethod(''); setMethodError(e.details || e.message); } }
    finally { if (scope === methodsGeneration.current) setMethodsLoading(false); }
  }, [storeSlug]);
  useEffect(() => { loadMethods(); api.get(rentalUrl('/rentals/configuration', storeSlug), { silent: true }).then(value => setContact(value.contact || {})).catch(() => {}); return () => { methodsGeneration.current += 1; }; }, [loadMethods, storeSlug]);
  const lock = useRef(false), paymentOperation = useRef(rentalOperation());
  const [checkedAt, setCheckedAt] = useState(null), [clockNow, setClockNow] = useState(Date.now());
  useEffect(() => { if (booking?.status !== 'HELD') return undefined; setClockNow(Date.now()); const timer = setInterval(() => setClockNow(Date.now()), 1000); return () => clearInterval(timer); }, [booking?.status, booking?.expiresAt]);
  const generation = useRef(0), refreshLock = useRef(null);
  const load = useCallback(async () => {
    const scope = generation.current;
    if (refreshLock.current === scope) return;
    refreshLock.current = scope;
    try {
      const value = await api.get(rentalUrl(bookingId ? `/rentals/bookings/${bookingId}` : `/rentals/bookings?page=${page}`, storeSlug), { silent: true, forceRefetch: true });
      if (scope !== generation.current) return;
      if (bookingId) setBooking(value); else setData(value);
      setCheckedAt(Date.now()); setError('');
    } catch (e) { if (scope === generation.current) setError(e.details || e.message); }
    finally { if (refreshLock.current === scope) refreshLock.current = null; }
  }, [bookingId, page, storeSlug]);
  useEffect(() => {
    generation.current += 1; setBooking(null); setData(null); setCheckedAt(null);
    load(); paymentOperation.current = readRentalSession('payment', storeSlug, actor)?.bookingId === bookingId ? readRentalSession('payment', storeSlug, actor).operationId : rentalOperation();
    const refresh = () => { if (!document.hidden && !lock.current && navigator.onLine !== false) load(); };
    const timer = window.setInterval(refresh, bookingId ? 20000 : 45000);
    window.addEventListener('focus', refresh); window.addEventListener('online', refresh); document.addEventListener('visibilitychange', refresh);
    return () => { generation.current += 1; window.clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [load, bookingId, actor, storeSlug]);
  const pay = async () => {
    if (lock.current) return; lock.current = true; const scope = ++generation.current; setBusy(true); setError('');
    try { const pendingPayment = readRentalSession('payment', storeSlug, actor); const paymentMethod = pendingPayment?.operationId === paymentOperation.current ? pendingPayment.method || method : method; saveRentalSession('payment', storeSlug, { bookingId: booking._id, operationId: paymentOperation.current, method: paymentMethod }, actor); const payment = await api.post(rentalUrl(`/rentals/bookings/${booking._id}/payment`, storeSlug), { operationId: paymentOperation.current, method: paymentMethod }, { silent: true }); const result = await openRentalPayment(payment, { ...booking, storeName: brand.websiteName }, response => api.post(rentalUrl(`/rentals/bookings/${booking._id}/verify`, storeSlug), response, { silent: true })); if (scope !== generation.current) return; if (result) { setCheckedAt(Date.now()); setBooking(result); clearRentalSession('payment', storeSlug, actor); paymentOperation.current = rentalOperation(); } else { setMessage('Payment window closed. Checking the latest booking status…'); await load(); } }
    catch (e) { if (scope !== generation.current) return; if (e.code === 'PAYMENT_SETUP_REJECTED') { clearRentalSession('payment', storeSlug, actor); paymentOperation.current = rentalOperation(); } setError(e.details || e.message); }
    finally { lock.current = false; setBusy(false); }
  };
  const sendRequest = async () => {
    if (lock.current) return; lock.current = true; const scope = ++generation.current; setBusy(true); setError('');
    try { const payload = { type: request.type, note: request.note, revision: booking.revision, operationId: rentalOperation(), ...(request.pickupAt ? { pickupAt: rentalInstant(request.pickupAt, booking.policy.timezone) } : {}), ...(request.returnDueAt ? { returnDueAt: rentalInstant(request.returnDueAt, booking.policy.timezone) } : {}) }; const updated = await api.post(rentalUrl(`/rentals/bookings/${booking._id}/requests`, storeSlug), payload, { silent: true }); if (scope !== generation.current) return; setCheckedAt(Date.now()); setBooking(updated); setMessage('Request received. Existing dates remain unchanged until the store approves the change.'); }
    catch (e) { if (scope === generation.current) setError(e.details || e.message); }
    finally { lock.current = false; setBusy(false); }
  };
  return <main className="rental-shopping-page rental-my-bookings"><header className="rental-shopping-header"><button type="button" aria-label="Back" onClick={() => navigate(bookingId ? '/rentals' : '/profile')}><ArrowLeft size={22} /></button><h1>{bookingId ? 'Rental booking' : 'My bookings'}</h1><button type="button" className="rental-shopping-link" disabled={busy} onClick={() => { load(); loadMethods(); }}>Refresh</button></header>
    {error && <p role="alert" className="rental-shopping-notice">{error}</p>}{message && <p role="status" className="rental-shopping-notice">{message}</p>}
    {bookingId ? !booking ? <p role="status">{error ? 'Booking could not be loaded. Use Refresh to retry.' : 'Loading booking…'}</p> : <RentalCustomerBooking key={booking._id} booking={booking} checkedAt={checkedAt} clockNow={clockNow} busy={busy} methods={methods} method={method} setMethod={setMethod} methodError={methodError} methodsLoading={methodsLoading} loadMethods={loadMethods} pay={pay} request={request} setRequest={setRequest} sendRequest={sendRequest} contact={contact} storeSlug={storeSlug} navigate={navigate} onChange={setBooking} success={success} />
    : !data ? <p role="status">{error ? 'Your bookings could not be loaded. Use Refresh to retry.' : 'Loading your bookings…'}</p> : <><div className="rental-bookings-list">{data.rows.map(b => <button type="button" className="rental-booking-list-card" key={b._id} onClick={() => navigate('/rentals?id=' + b._id)}><span className="rental-booking-list-card__icon"><CalendarDays size={25} /></span><div><span className={'rental-status rental-status--' + b.status.toLowerCase()}>{rentalCopy(b.status)}</span><h2>{b.quote.items.map(i => i.title).join(', ')}</h2><p>{b.number}</p><p>Pickup {rentalDate(b.schedule.pickupAt, b.policy.timezone)}</p><p>Return {rentalDate(b.schedule.returnDueAt, b.policy.timezone)}</p><strong>{rentalMoney(b.quote.totalPaise)}</strong></div><ChevronRight size={19} /></button>)}</div>{!data.rows.length && <section className="rental-shopping-empty"><CalendarDays size={35} /><h2>No bookings yet</h2><p>Choose your rental look and book your occasion.</p><button type="button" className="rental-shopping-primary" onClick={() => navigate('/rental-book')}>Explore rentals</button></section>}{data.pages > 1 && <div className="rental-actions"><button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button><span>Page {page} of {data.pages}</span><button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}>Next</button></div>}<details className="rental-shopping-card"><summary>Availability alerts</summary><RentalWaitlist storeSlug={storeSlug} navigate={navigate} /></details></>}
  </main>;
}
