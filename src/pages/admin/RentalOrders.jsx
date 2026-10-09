import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Plus, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import PageHeader from '../../components/admin/PageHeader';
import AdminOrderTabs from '../../components/admin/AdminOrderTabs';
import RentalBookingDesk from '../../components/rentals/RentalBookingDesk';
import { RentalOperations } from './Rentals';
import { pushAppRoute } from '../../utils/routing';

export default function RentalOrders({ route = '/admin/orders?type=rental', navigate = pushAppRoute }) {
  const base = route.startsWith('/seller') ? '/seller/rentals' : '/admin/rentals';
  const params = new URLSearchParams(route.split('?')[1] || ''), bookingId = params.get('booking') || '', scope = params.get('storeId') || '';
  const [workspace, setWorkspace] = useState(null), [booking, setBooking] = useState(null), [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [refresh, setRefresh] = useState(0);
  const lock = useRef(false), generation = useRef(0), panel = useRef(null), loadedRoute = useRef(''), deskState = useRef(null);
  const [reading, setReading] = useState(true), [readReady, setReadReady] = useState(false);
  const ordersRoute = base.replace('/rentals', '/orders');
  const link = (path, values = {}) => path + '?' + new URLSearchParams({ ...(scope ? { storeId: scope } : {}), ...values });
  const listHref = link(ordersRoute, { type: 'rental' });
  const load = useCallback(() => api.get(base, { silent: true, forceRefetch: true }), [base]);
  useEffect(() => { const current = ++generation.current, identity = base + '|' + scope + '|' + bookingId;
    if (loadedRoute.current !== identity) { setBooking(null); setMessage(''); if (loadedRoute.current.split('|').slice(0, 2).join('|') !== base + '|' + scope) { setWorkspace(null); deskState.current = null; } }
    loadedRoute.current = identity; setError(''); setReading(true); setReadReady(false);
    Promise.all([load(), bookingId ? api.get(`${base}/bookings/${bookingId}`, { silent: true, forceRefetch: true }) : null]).then(([data, selected]) => {
      if (!data?.configuration?.policy || !data?.readiness) throw new Error('Rental orders could not be loaded.');
      if (bookingId && (!selected?._id || String(selected._id) !== bookingId || !Array.isArray(selected?.quote?.items) || !selected?.financial || !selected?.schedule)) throw new Error('This rental booking could not be loaded. Retry or return to all rental bookings.');
      if (current === generation.current) { setWorkspace(data); setBooking(selected); setReadReady(true); }
    }).catch(e => { if (current === generation.current) setError(e.details || e.message); }).finally(() => { if (current === generation.current) setReading(false); });
    return () => { generation.current += 1; };
  }, [load, base, scope, bookingId, refresh]);
  useEffect(() => { if (booking?._id) { panel.current?.focus(); panel.current?.scrollIntoView?.({ block: 'start' }); } }, [booking?._id]);
  const run = async work => {
    if (lock.current || !readReady || !workspace?.readiness.transactions) return null;
    lock.current = true; setBusy(true); setError(''); setMessage(''); const current = generation.current;
    try { const result = await work(); if (current !== generation.current) return null; setMessage('Rental booking updated.'); return result; }
    catch (e) { if (current === generation.current) { setError(e.details || e.message); if (e.status === 409 || e.code === 'REVISION_CONFLICT') setRefresh(value => value + 1); } return null; }
    finally { lock.current = false; setBusy(false); }
  };
  return <section className="rental-workspace rental-admin rental-orders">
    <PageHeader title="Orders" note="Sale deliveries and rental bookings, in one place." kicker={base.startsWith('/seller') ? 'Seller' : 'Admin'}>
      {!bookingId && workspace && workspace.configuration.mode !== 'SALE_ONLY' && workspace.permissions?.['orders.write'] !== false && <a className="admin-btn inline-flex items-center gap-2" href={link(base, { tab: 'counter' })}><Plus size={16} />New rental booking</a>}
    </PageHeader>
    <AdminOrderTabs route={route} mode="rental" />
    {error && <div className="admin-card rental-order-error" role="alert"><p>{error}</p><div>{bookingId && <button type="button" className="admin-btn-ghost" disabled={busy} onClick={() => navigate(listHref)}>All rental bookings</button>}<button type="button" className="admin-btn-ghost" disabled={busy || reading} onClick={() => setRefresh(value => value + 1)}>Retry</button></div></div>}
    {message && <p className="rental-order-note" role="status">{message}</p>}
    {!workspace ? !error && <p role="status">Loading rental bookings…</p> : <>
      <div className="rental-order-toolbar"><div>{bookingId ? <button className="admin-btn-ghost" disabled={busy} onClick={() => navigate(listHref)}><ArrowLeft size={16} />All rental bookings</button> : <p>Open a booking, complete the next step, and track payment and return.</p>}</div><div>{workspace.permissions?.['inventory.read'] !== false && <a href={link(base, { tab: 'setup' })}>Rental setup & pieces</a>}<button className="admin-btn-ghost" aria-label="Refresh rental orders" disabled={busy || reading} onClick={() => setRefresh(value => value + 1)}><RefreshCw size={16} />Refresh</button></div></div>
      {reading && <p role="status" className="rental-muted">Refreshing rental orders…</p>}
      {!workspace.readiness.transactions && <p role="alert" className="rental-order-note">Rental changes are paused until the store’s database setup is complete.</p>}
      {bookingId ? booking && <section ref={panel} tabIndex={-1} className="rental-selected-booking" aria-label={`Manage booking ${booking.number}`}><RentalOperations simple key={booking._id} booking={booking} permissions={workspace.permissions} policy={workspace.configuration.policy} base={base} run={run} onChange={setBooking} busy={busy || !readReady || !workspace.readiness.transactions} onClose={() => navigate(listHref)} /></section> : <RentalBookingDesk simple initialFilters={deskState.current} onFiltersChange={value => { deskState.current = value; }} base={base} timezone={workspace.configuration.policy.timezone} refresh={refresh} onOpen={id => navigate(link(ordersRoute, { type: 'rental', booking: id }))} />}
    </>}
  </section>;
}
