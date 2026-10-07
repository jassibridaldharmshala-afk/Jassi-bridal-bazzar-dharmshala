import { useEffect, useRef, useState } from 'react';
import { ChevronRight, Search, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { OrderItem, OrderShell, OrderState, StatusBadge } from '../../components/order/OrderUi';
import { money, ORDER_STATUSES, orderCode, orderDate, paymentLabel } from '../../utils/orderPresentation';

export default function MyOrders({ navigate, route = '/orders' }) {
  const { user } = useAuth();
  const params = new URLSearchParams(route.split('?')[1] || '');
  const search = params.get('search') || '';
  const status = params.get('status') || '';
  const days = params.get('days') || '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [draft, setDraft] = useState(search);
  const [data, setData] = useState({ items: [], total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const refreshVersion = useRef(reload);
  useEffect(() => setDraft(search), [search]);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    const query = new URLSearchParams({ page: String(page), limit: '12' });
    if (search) query.set('search', search);
    if (status) query.set('status', status);
    if (days) query.set('days', days);
    if (!user) { setLoading(false); return undefined; }
    const forceRefetch = refreshVersion.current !== reload;
    refreshVersion.current = reload;
    api.get(`/orders/my-orders?${query}`, { cacheFirst: true, cacheScope: String(user?._id || user?.id || user?.phone || ''), forceRefetch }).then((result) => {
      if (!active) return;
      const next = Array.isArray(result) ? { items: result, total: result.length, totalPages: 1 } : result;
      if (!Array.isArray(next?.items) || next.items.some((item) => !item || !item._id)) {
        throw new Error('Your orders could not be loaded. Please try again.');
      }
      setData({ ...next, totalPages: Math.max(1, Number(next.totalPages) || 1), total: Number(next.total) || next.items.length });
    }).catch((err) => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [search, status, days, page, reload, user]);
  const change = (values) => {
    const next = new URLSearchParams(route.split('?')[1] || '');
    next.delete('page');
    Object.entries(values).forEach(([key, value]) => value ? next.set(key, String(value)) : next.delete(key));
    navigate(`/orders${next.toString() ? `?${next}` : ''}`);
  };
  return <OrderShell title="My Orders" navigate={navigate}>
    <div className="sc-orders__tools">
      <form className="sc-orders__search" onSubmit={(event) => { event.preventDefault(); change({ search: draft.trim() }); }}>
        <Search size={19} /><input aria-label="Search orders" placeholder="Search by product or order ID" value={draft} maxLength={100} onChange={(event) => setDraft(event.target.value)} /><button type="submit">Search</button>
      </form>
      <div className="sc-orders__filters"><SlidersHorizontal size={17} aria-hidden="true" />
        <select aria-label="Order status" value={status} onChange={(event) => change({ status: event.target.value })}><option value="">All statuses</option>{ORDER_STATUSES.map((value) => <option key={value}>{value}</option>)}</select>
        <select aria-label="Order date" value={days} onChange={(event) => change({ days: event.target.value })}><option value="">All time</option><option value="30">Last 30 days</option><option value="180">Last 6 months</option><option value="365">Last year</option></select>
        <button className="sc-orders__refresh" disabled={loading} aria-label="Refresh orders" onClick={() => setReload((value) => value + 1)}><RefreshCw size={17} /></button>
      </div>
    </div>
    {!user ? <OrderState title="Sign in to view your orders"><button className="sc-orders__button" onClick={() => navigate('/login?redirect=/orders')}>Sign in</button></OrderState>
      : loading ? <OrderState loading /> : error ? <OrderState title="Unable to load orders" error={error} retry={() => setReload((value) => value + 1)} />
        : <>
          <div className="sc-orders__results"><p>{data.total} {data.total === 1 ? 'order' : 'orders'}{search || status || days ? ' found' : ''}</p>{(search || status || days) && <button className="sc-orders__text" onClick={() => navigate('/orders')}>Clear filters</button>}</div>
          {!data.items.length ? <OrderState title={search || status || days ? 'No matching orders' : 'No orders yet'}><p>{search || status || days ? 'Try a different search or clear your filters.' : 'Your purchases and delivery updates will appear here.'}</p><button className="sc-orders__button" onClick={() => search || status || days ? navigate('/orders') : navigate('/products')}>{search || status || days ? 'View all orders' : 'Explore the collection'}</button></OrderState>
            : <div className="sc-orders__list">{data.items.map((order) => <article className="sc-order-card" key={order._id} aria-label={`Order ${orderCode(order)}`}>
              <header className="sc-order-card__meta"><div><span>ORDER PLACED</span><p>{orderDate(order.createdAt) || 'Date unavailable'}</p></div><div><span>ORDER TOTAL</span><p>{money(order.finalAmount)}</p></div><div className="sc-order-card__id"><span>ORDER ID</span><p>#{orderCode(order)}</p></div></header>
              <div className="sc-order-card__status"><StatusBadge status={order.orderStatus} /><span>{paymentLabel(order)}</span></div>
              <div className="sc-order-card__items">{(order.orderItems || []).map((item, index) => <OrderItem key={item._id || index} item={item} onOpen={() => navigate(`/order-detail?id=${order._id}`)} />)}</div>
              <footer><p>Deliver to <strong>{order.shippingAddress?.fullName || 'Saved delivery address'}</strong></p><button className="sc-orders__text" onClick={() => navigate(`/order-detail?id=${order._id}`)}>View order details<ChevronRight size={16} /></button></footer>
            </article>)}</div>}
          {data.totalPages > 1 && <nav className="sc-orders__pagination" aria-label="Order pages"><button className="sc-orders__outline" disabled={page <= 1} onClick={() => change({ page: page - 1 })}>Previous</button><span>Page {page} of {data.totalPages}</span><button className="sc-orders__outline" disabled={page >= data.totalPages} onClick={() => change({ page: page + 1 })}>Next</button></nav>}
        </>}
  </OrderShell>;
}
