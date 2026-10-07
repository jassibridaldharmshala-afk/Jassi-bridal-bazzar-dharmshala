import { useEffect, useRef, useState } from 'react';
import api from '../../services/api';
import DeliveryTracking from '../../components/order/DeliveryTracking';
import { OrderItem, OrderShell, OrderState, StatusBadge } from '../../components/order/OrderUi';
import { money, orderDate } from '../../utils/orderPresentation';

export default function MyReturns({ navigate }) {
  const [requests, setRequests] = useState([]);
  const [meta, setMeta] = useState(null);
  const [filters, setFilters] = useState({ status: '', type: '' });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);
  const refreshVersion = useRef(reload);
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    const params = new URLSearchParams({ page: String(page), limit: '12' });
    if (filters.status) params.set('status', filters.status); if (filters.type) params.set('type', filters.type);
    const forceRefetch = refreshVersion.current !== reload;
    refreshVersion.current = reload;
    api.get(`/returns/my-requests?${params}`, { silent: true, cacheFirst: true, forceRefetch }).then(data => {
      const items = Array.isArray(data) ? data : data?.items;
      if (!Array.isArray(items) || items.some(item => !item?._id)) throw new Error('Your return requests could not be loaded.');
      if (active) { setRequests(items); setMeta(Array.isArray(data) ? null : data); }
    }).catch(err => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filters, page, reload]);
  const cancel = async request => {
    if (busy || request.status !== 'Requested') return;
    setBusy(request._id); setError(''); setNotice('');
    try { await api.patch(`/returns/${request._id}/cancel`, { comment: 'Cancelled by customer before approval.' }); setNotice('The request was cancelled.'); setReload(value => value + 1); }
    catch (err) { setError(err.message); } finally { setBusy(''); }
  };
  return <OrderShell title="Returns & exchanges" breadcrumb="Returns & exchanges" detail navigate={navigate}>
    <div className="sc-returns-filter"><select aria-label="Request type" value={filters.type} onChange={event => { setFilters(current => ({ ...current, type: event.target.value })); setPage(1); }}><option value="">Returns + exchanges</option><option value="return">Returns</option><option value="exchange">Exchanges</option></select><select aria-label="Request status" value={filters.status} onChange={event => { setFilters(current => ({ ...current, status: event.target.value })); setPage(1); }}><option value="">All statuses</option>{['Requested', 'Approved', 'Pickup Scheduled', 'Picked Up', 'In Transit', 'Received', 'Inspection Pending', 'Verified', 'Mismatch Found', 'QC Passed', 'QC Failed', 'Refund Initiated', 'Refunded', 'Exchange Allocated', 'Replacement Shipped', 'Replacement Delivered', 'Exchanged', 'Rejected', 'Cancelled', 'Closed'].map(status => <option key={status}>{status}</option>)}</select></div>
    {notice && <p role="status" className="sc-orders__notice">{notice}</p>}{error && requests.length > 0 && <p role="alert" className="sc-orders__error">{error}</p>}
    {loading && !requests.length ? <OrderState loading /> : error && !requests.length ? <OrderState title="Unable to load requests" error={error} retry={() => setReload(value => value + 1)} /> : !requests.length ? <OrderState title="No matching requests"><p>Eligible items can be returned or exchanged from their order details.</p><button className="sc-orders__button" onClick={() => navigate('/orders')}>View orders</button></OrderState> : <div className="sc-orders__list">{requests.map(request => <article className="sc-order-panel sc-return-case" key={request._id}>
      <header><div><small>{request.type === 'exchange' ? 'EXCHANGE' : 'RETURN'} · #{String(request._id).slice(-8).toUpperCase()}</small><h2>{request.productSnapshot?.name || request.product?.name || 'Ordered product'}</h2></div><StatusBadge status={request.status} /></header>
      <OrderItem item={{ name: request.productSnapshot?.name || request.product?.name || 'Ordered product', image: request.productSnapshot?.image || request.product?.images?.[0]?.url || request.product?.images?.[0] || '', size: request.size, color: request.color, quantity: request.quantity, price: request.productSnapshot?.unitPrice }} />
      <div className="sc-return-case__summary"><p><strong>Reason</strong>{request.reason}</p><p><strong>Requested</strong>{orderDate(request.createdAt, true)}</p>{request.type === 'return' && <p><strong>Estimated refund</strong>{money(request.financial?.estimatedRefundAmount)} · {request.financial?.refundStatus || 'Pending review'}{request.refundDestinationSummary?.label ? ` · ${request.refundDestinationSummary.label}` : ''}{request.financial?.expectedBy && request.financial?.refundStatus === 'INITIATED' ? ` · Expected by ${orderDate(request.financial.expectedBy)}` : ''}</p>}{request.exchangeSize && <p><strong>Replacement</strong>{request.exchangeSize} {request.exchangeColor}</p>}{request.type === 'exchange' && <p><strong>{Number(request.financial?.exchangePriceDifference || 0) > 0 ? 'Amount payable' : Number(request.financial?.exchangePriceDifference || 0) < 0 ? 'Credit due' : 'Price difference'}</strong>{money(Math.abs(Number(request.financial?.exchangePriceDifference || 0)))} · {String(request.financial?.exchangeAdjustmentStatus || 'NOT_REQUIRED').replaceAll('_', ' ')}</p>}</div>
      {request.adminComment && <p className="sc-orders__muted">Store update: {request.adminComment}</p>}
      {request.inspection?.status && request.inspection.status !== 'NOT_STARTED' && <p className="sc-orders__muted">Item verification: {String(request.inspection.result || request.inspection.status).replaceAll('_', ' ').toLowerCase()}.</p>}
      {request.refundDecision?.customerMessage && <p className="sc-orders__muted">Review decision: {request.refundDecision.customerMessage}</p>}
      {request.shipment && <DeliveryTracking returnId={request._id} />}
      {request.statusTimeline?.length > 0 && <details className="sc-return-case__timeline"><summary>View activity timeline</summary><ol className="sc-order-timeline">{[...request.statusTimeline].reverse().map((entry, index) => <li key={`${entry.date}-${index}`}><span className="sc-order-timeline__dot" /><div><h3>{entry.status}</h3><time>{orderDate(entry.date, true)}</time>{entry.note && <p>{entry.note}</p>}</div></li>)}</ol></details>}
      <div className="sc-order-panel__actions">{request.status === 'Requested' && <button className="sc-orders__outline" disabled={busy === request._id} onClick={() => cancel(request)}>{busy === request._id ? 'Cancelling…' : 'Cancel request'}</button>}{(request.order?._id || typeof request.order === 'string') && <button className="sc-orders__text" onClick={() => navigate(`/order-detail?id=${encodeURIComponent(request.order?._id || request.order)}`)}>View order details ›</button>}</div>
    </article>)}</div>}
    {meta && meta.totalPages > 1 && <div className="sc-returns-pagination"><button disabled={loading || page <= 1} onClick={() => setPage(value => value - 1)}>Previous</button><span>Page {meta.page} of {meta.totalPages}</span><button disabled={loading || page >= meta.totalPages} onClick={() => setPage(value => value + 1)}>Next</button></div>}
  </OrderShell>;
}
