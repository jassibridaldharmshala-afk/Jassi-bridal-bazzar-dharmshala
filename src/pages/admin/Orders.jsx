import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Clock3, Download, PackageCheck, RotateCcw, Truck, Wallet } from 'lucide-react';
import ConfirmModal from '../../components/admin/ConfirmModal';
import DataTable from '../../components/admin/DataTable';
import OrderWorkflowActions from '../../components/admin/OrderWorkflowActions';
import PageHeader from '../../components/admin/PageHeader';
import SearchFilterBar from '../../components/admin/SearchFilterBar';
import StatusBadge from '../../components/admin/StatusBadge';
import api from '../../services/api';
import { downloadReceiptPdf } from '../../utils/printReceipt';

const orderStatuses = ['', 'Pending', 'Confirmed', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Return Requested', 'Exchange Requested', 'Returned', 'Refunded'];
const paymentStatuses = ['', 'Pending', 'Paid', 'Failed', 'Refunded'];
const taskLabels = { pending: 'New orders', packing: 'To pack', todayPacking: "Today's packing", dispatch: 'To dispatch', transit: 'In transit', exceptions: 'Delivery issues', returns: 'Open returns', collection: 'Delivered COD awaiting collection', resolution: 'Refunds needing attention', rto: 'Open return-to-origin cases' };
const providerNames = { manual: 'Manual', bluedart: 'Blue Dart', shiprocket: 'Shiprocket', delhivery: 'Delhivery', xpressbees: 'Xpressbees' };
const summaryCards = [
  ['pending', 'New orders', Clock3], ['packing', 'To pack', PackageCheck], ['todayPacking', "Today's packing", PackageCheck], ['dispatch', 'Ready to ship', Truck],
  ['transit', 'In transit', Truck], ['exceptions', 'Delivery issues', AlertTriangle], ['returns', 'Returns', RotateCcw], ['codCollection', 'COD to collect', Wallet],
  ['resolution', 'Resolution issues', AlertTriangle], ['rto', 'RTO cases', RotateCcw],
];

function taskIsActive(key, value) {
  const params = new URLSearchParams(value);
  if (key === 'todayPacking') return params.get('attention') === 'packing' && params.get('range') === 'today';
  if (key === 'exceptions') return params.get('deliveryIssue') === '1';
  if (key === 'returns') return params.get('returnOpen') === '1';
  return params.get('attention') === (key === 'codCollection' ? 'collection' : key);
}

function readFilters(route) {
  const params = new URLSearchParams(route.split('?')[1] || '');
  const extra = new URLSearchParams();
  ['range', 'from', 'to', 'attention', 'deliveryStatus', 'deliveryIssue', 'returnOpen'].forEach(key => { if (params.get(key)) extra.set(key, params.get(key)); });
  return {
    search: params.get('search') || '', status: params.get('status') || '', payment: params.get('payment') || '',
    paymentMethod: params.get('paymentMethod') || '', provider: params.get('provider') || '', city: params.get('city') || '', pincode: params.get('pincode') || '', sort: params.get('sort') || 'newest', extra: extra.toString(),
  };
}

export default function Orders({ route = '' }) {
  const seller = route.startsWith('/seller');
  const apiBase = seller ? '/seller' : '/admin';
  const initial = readFilters(route);
  const [orders, setOrders] = useState([]);
  const [query, setQuery] = useState(initial.search);
  const [search, setSearch] = useState(initial.search);
  const [status, setStatus] = useState(initial.status);
  const [payment, setPayment] = useState(initial.payment);
  const [paymentMethod, setPaymentMethod] = useState(initial.paymentMethod);
  const [provider, setProvider] = useState(initial.provider);
  const [city, setCity] = useState(initial.city);
  const [pincode, setPincode] = useState(initial.pincode);
  const [sort, setSort] = useState(initial.sort);
  const [extra, setExtra] = useState(initial.extra);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [pagination, setPagination] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState('');
  const [busyOrder, setBusyOrder] = useState('');
  const [selected, setSelected] = useState([]);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelComment, setCancelComment] = useState('');
  const [codTarget, setCodTarget] = useState(null);
  const [codForm, setCodForm] = useState({ reference: '', note: 'COD payment collected from customer' });
  const [pickupOpen, setPickupOpen] = useState(false);
  const [pickupSlot, setPickupSlot] = useState(() => ({ date: nextPickupDate(), time: '10:00', closeTime: '18:00' }));
  const loadSequence = useRef(0);
  const latestLoad = useRef(null);

  useEffect(() => {
    const filters = readFilters(route);
    setMessage('');
    setQuery(filters.search); setSearch(filters.search); setStatus(filters.status); setPayment(filters.payment);
    setPaymentMethod(filters.paymentMethod); setProvider(filters.provider); setCity(filters.city); setPincode(filters.pincode); setSort(filters.sort); setExtra(filters.extra); setPage(1);
  }, [route]);
  useEffect(() => {
    if (query === search) return undefined;
    const timer = setTimeout(() => { setSearch(query); setPage(1); }, 250);
    return () => clearTimeout(timer);
  }, [query, search]);

  const requestParams = new URLSearchParams(extra);
  requestParams.set('page', page); requestParams.set('limit', limit); requestParams.set('sort', sort);
  if (search.trim()) requestParams.set('search', search.trim());
  if (status) requestParams.set('status', status);
  if (payment) requestParams.set('payment', payment);
  if (paymentMethod) requestParams.set('paymentMethod', paymentMethod);
  if (provider) requestParams.set('provider', provider);
  if (city.trim()) requestParams.set('city', city.trim());
  if (/^\d{6}$/.test(pincode.trim())) requestParams.set('pincode', pincode.trim());
  const requestPath = `${apiBase}/orders?${requestParams}`;

  const loadSummary = useCallback(() => api.get(`${apiBase}/orders/workspace-summary`, { silent: true, cache: 'no-store' }).then(setSummary).catch(() => setSummary(null)), [apiBase]);
  const load = useCallback(() => {
    const sequence = ++loadSequence.current;
    setLoading(true); setLoadError('');
    return api.get(requestPath)
      .then((data) => {
        if (sequence !== loadSequence.current) return;
        const items = Array.isArray(data) ? data : data?.items;
        if (!Array.isArray(items) || items.some(item => !item?._id)) throw new Error('Unable to read orders. Please try again.');
        if (!Array.isArray(data) && page > data.totalPages) { setPage(Math.max(1, data.totalPages)); return; }
        setOrders(items); setPagination(Array.isArray(data) ? null : data); setSelected([]);
      })
      .catch((error) => { if (sequence === loadSequence.current) setLoadError(error.message); })
      .finally(() => { if (sequence === loadSequence.current) setLoading(false); });
  }, [requestPath, page]);
  latestLoad.current = load;
  useEffect(() => { load(); loadSummary(); return () => { loadSequence.current += 1; }; }, [load, loadSummary]);

  const filtered = useMemo(() => pagination ? orders : orders.filter((order) => {
    const itemFields = (order.orderItems || []).flatMap(item => [item.name, item.sku]);
    const haystack = [order._id, order.invoiceNumber, order.user?.name, order.user?.email, order.user?.phone, order.shippingAddress?.fullName, ...itemFields].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(query.toLowerCase()) && (!status || order.orderStatus === status) && (!payment || order.paymentStatus === payment);
  }), [orders, payment, query, status, pagination]);

  const refresh = async () => { await Promise.all([latestLoad.current(), loadSummary()]); };
  const updateOrder = async (order, orderStatus, label) => {
    if (busyOrder) return;
    setBusyOrder(order._id); setMessage('');
    try {
      await api.put(`${apiBase}/orders/${order._id}/status`, { orderStatus, revision: Number(order.revision || 0), note: `${label} by staff` });
      await refresh();
    } catch (error) { setMessage(error.message); if (error.status === 409) latestLoad.current(); }
    finally { setBusyOrder(''); }
  };
  const cancelOrder = async () => {
    const reason = cancelReason.trim();
    if (!reason) throw new Error('Enter the cancellation reason.');
    const note = cancelComment.trim() || `Order cancelled: ${reason.replaceAll('_', ' ').toLowerCase()}`;
    await api.put(`${apiBase}/orders/${cancelTarget._id}/status`, { orderStatus: 'Cancelled', revision: Number(cancelTarget.revision || 0), reasonCode: reason, note });
    setCancelTarget(null); setCancelReason(''); setCancelComment(''); await refresh();
  };
  const collectCod = async () => {
    const note = codForm.note.trim();
    if (!note) throw new Error('Enter a collection note.');
    await api.put(`${apiBase}/orders/${codTarget._id}/payment-status`, { paymentStatus: 'Paid', revision: Number(codTarget.revision || 0), reference: codForm.reference.trim(), note });
    setCodTarget(null); setCodForm({ reference: '', note: 'COD payment collected from customer' }); await refresh();
  };

  const clearFilters = () => { setExtra(''); setQuery(''); setSearch(''); setStatus(''); setPayment(''); setPaymentMethod(''); setProvider(''); setCity(''); setPincode(''); setSort('newest'); setPage(1); };
  const setExtraValue = (key, value) => { const params = new URLSearchParams(extra); if (value) params.set(key, value); else params.delete(key); if (key === 'from' || key === 'to') params.delete('range'); setExtra(params.toString()); setPage(1); };
  const openTask = key => {
    if (key === 'returns') { window.location.href = seller ? '/seller/orders?returnOpen=1' : '/admin/returns?status=Requested'; return; }
    setStatus(''); setPayment('');
    const params = new URLSearchParams();
    if (key === 'exceptions') params.set('deliveryIssue', '1');
    else if (key === 'todayPacking') { params.set('attention', 'packing'); params.set('range', 'today'); }
    else params.set('attention', key === 'codCollection' ? 'collection' : key);
    setExtra(params.toString()); setPage(1);
  };

  const toggle = id => setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const selectedOrders = filtered.filter(order => selected.includes(order._id));
  const packable = filtered.filter(order => selected.includes(order._id) && order.allowedActions?.includes('MARK_PACKED'));
  const labelled = selectedOrders.filter(order => order.shipment?.labelAvailable && order.shipment?.awb && order.shipment?.status !== 'CANCELLED');
  const pickupable = selectedOrders.filter(order => order.shipment?.provider && order.shipment.provider !== 'manual' && order.shipment.bookingState === 'BOOKED' && order.shipment.status === 'READY_TO_SHIP' && !order.shipment.pickup?.token && !order.shipment.operation);
  const markSelectedPacked = async () => {
    if (!packable.length || busyOrder) return;
    setBusyOrder('bulk'); setMessage('');
    try {
      for (const order of packable) await api.put(`${apiBase}/orders/${order._id}/status`, { orderStatus: 'Packed', revision: Number(order.revision || 0), note: 'Marked packed from the fulfilment workspace' });
      setMessage(`${packable.length} order${packable.length === 1 ? '' : 's'} marked packed.`); await refresh();
    } catch (error) { setMessage(error.message); await refresh(); }
    finally { setBusyOrder(''); }
  };
  const exportVisible = () => {
    const cells = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const rows = [['Invoice', 'Order ID', 'Customer', 'Phone', 'Amount', 'Payment', 'Order status', 'Delivery', 'AWB'], ...filtered.map(order => [order.invoiceNumber, order._id, order.user?.name || order.shippingAddress?.fullName, order.user?.phone || order.shippingAddress?.mobile, order.adjustedFinalAmount ?? order.finalAmount, `${order.paymentMethod} ${order.paymentStatus}`, order.orderStatus, order.shipment?.status || 'WAITING', order.shipment?.awb || ''])];
    const blob = new Blob([rows.map(row => row.map(cells).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const printPackingList = () => {
    if (!selectedOrders.length) return;
    const safe = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
    const content = selectedOrders.map(order => `<section><h2>${safe(order.invoiceNumber || order._id)}</h2><p>${safe(order.user?.name || order.shippingAddress?.fullName)} · ${safe(order.shippingAddress?.mobile || order.user?.phone)}</p><p>${safe([order.shippingAddress?.houseNo, order.shippingAddress?.area, order.shippingAddress?.city, order.shippingAddress?.state, order.shippingAddress?.pincode].filter(Boolean).join(', '))}</p><table><thead><tr><th>Product</th><th>SKU</th><th>Option</th><th>Qty</th></tr></thead><tbody>${(order.orderItems || []).map(item => ({ ...item, activeQuantity: Math.max(0, Number(item.quantity || 0) - Number(item.cancelledQuantity || 0)) })).filter(item => item.activeQuantity > 0).map(item => `<tr><td>${safe(item.name)}</td><td>${safe(item.sku)}</td><td>${safe([item.size, item.color].filter(Boolean).join(' / '))}</td><td>${safe(item.activeQuantity)}</td></tr>`).join('')}</tbody></table></section>`).join('');
    const popup = window.open('', '_blank');
    if (!popup) { setMessage('Allow pop-ups to print the packing list.'); return; }
    popup.opener = null;
    popup.document.write(`<html><head><title>Packing list</title><style>body{font:13px Arial;margin:24px;color:#171217}section{break-inside:avoid;border-bottom:2px solid #751d39;padding:0 0 18px;margin:0 0 22px}h1{color:#751d39}h2{margin-bottom:4px}p{margin:4px 0}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #ddd;padding:8px;text-align:left}</style></head><body><h1>Packing list · ${new Date().toLocaleDateString('en-IN')}</h1>${content}</body></html>`);
    popup.document.close(); popup.focus(); popup.print();
  };
  const downloadSelectedInvoices = async () => {
    if (!selectedOrders.length || busyOrder) return;
    setBusyOrder('bulk-invoices'); setMessage('');
    try {
      for (const order of selectedOrders) await downloadReceiptPdf(await api.get(`${apiBase}/orders/${order._id}/receipt`, { cache: 'no-store' }));
      setMessage(`${selectedOrders.length} invoice${selectedOrders.length === 1 ? '' : 's'} prepared. Your browser may ask permission for multiple downloads.`);
    } catch (error) { setMessage(error.message || 'The invoice batch could not be prepared.'); }
    finally { setBusyOrder(''); }
  };
  const downloadSelectedLabels = async () => {
    if (!labelled.length || busyOrder) return;
    setBusyOrder('bulk-labels'); setMessage('');
    try {
      for (const order of labelled) downloadBase64(await api.get(`${apiBase}/orders/${order._id}/delivery/label`, { cache: 'no-store' }));
      setMessage(`${labelled.length} shipping label${labelled.length === 1 ? '' : 's'} downloaded.`);
    } catch (error) { setMessage(error.message || 'The label batch could not be downloaded.'); }
    finally { setBusyOrder(''); }
  };
  const requestSelectedPickups = async () => {
    if (!pickupable.length || busyOrder) return;
    setBusyOrder('bulk-pickup'); setMessage('');
    try {
      for (const order of pickupable) await api.post(`${apiBase}/orders/${order._id}/delivery/pickup`, pickupSlot);
      setPickupOpen(false); setMessage(`${pickupable.length} pickup request${pickupable.length === 1 ? '' : 's'} confirmed.`); await refresh();
    } catch (error) { setMessage(error.message || 'A pickup request could not be completed. Review the selected orders and retry.'); await refresh(); }
    finally { setBusyOrder(''); }
  };

  const hasFilters = Boolean(extra || status || payment || paymentMethod || provider || city || pincode || query || sort !== 'newest');
  return <section className="order-workspace space-y-5">
    <PageHeader title="Orders" kicker={seller ? 'Seller' : 'Admin'} note="Process orders using the next valid step, track delivery and keep payment records accurate.">
      <button type="button" className="admin-btn-ghost" disabled={!filtered.length} onClick={() => setSelected(filtered.map(order => order._id))}>Select visible</button>
      <button type="button" className="admin-btn-ghost inline-flex items-center gap-2" disabled={!filtered.length} onClick={exportVisible}><Download size={15} />Export visible</button>
    </PageHeader>
    <div className="order-task-grid" aria-label="Order task summary">{summaryCards.map(([key, label, Icon]) => <button key={key} type="button" className={`order-task-card ${taskIsActive(key, extra) ? 'is-active' : ''}`} onClick={() => openTask(key)}><span><Icon size={17} />{label}</span><strong>{summary?.[key] ?? '—'}</strong>{key === 'codCollection' && summary?.codCollectionAmount ? <small>₹{Number(summary.codCollectionAmount).toLocaleString('en-IN')} due</small> : null}</button>)}</div>
    {message && <p role="status" className="rounded-xl bg-rose/10 p-3 text-sm font-bold text-rose">{message}</p>}
    {hasFilters && <div className="admin-card flex flex-wrap items-center justify-between gap-3 p-4 text-sm"><span>{taskLabels[new URLSearchParams(extra).get('attention')] || (new URLSearchParams(extra).get('deliveryIssue') ? taskLabels.exceptions : new URLSearchParams(extra).get('returnOpen') ? taskLabels.returns : 'Filtered orders')}</span><button type="button" className="admin-table-action-link" onClick={clearFilters}>Clear all filters</button></div>}
    <SearchFilterBar search={query} onSearch={setQuery} placeholder="Order, customer, phone, product, SKU or AWB">
      <Select value={status} onChange={value => { setStatus(value); setPage(1); }} options={orderStatuses} labels={{ '': 'All order status' }} />
      <Select value={payment} onChange={value => { setPayment(value); setPage(1); }} options={paymentStatuses} labels={{ '': 'All payments' }} />
      <Select value={sort} onChange={value => { setSort(value); setPage(1); }} options={['newest', 'oldest', 'dispatch_sla', 'amount_high', 'amount_low']} labels={{ newest: 'Newest first', oldest: 'Oldest first', dispatch_sla: 'Dispatch SLA: oldest first', amount_high: 'Amount: high to low', amount_low: 'Amount: low to high' }} />
    </SearchFilterBar>
    <details className="admin-card order-advanced-filters"><summary>More filters</summary><div>
      <Select value={paymentMethod} onChange={value => { setPaymentMethod(value); setPage(1); }} options={['', 'COD', 'ONLINE']} labels={{ '': 'All methods', ONLINE: 'Online payment' }} />
      <Select value={provider} onChange={value => { setProvider(value); setPage(1); }} options={['', 'manual', 'bluedart', 'shiprocket', 'delhivery', 'xpressbees']} labels={{ '': 'All couriers', ...providerNames }} />
      <label>City<input type="search" maxLength={100} value={city} onChange={event => { setCity(event.target.value); setPage(1); }} placeholder="Delivery city" /></label>
      <label>PIN code<input inputMode="numeric" maxLength={6} value={pincode} onChange={event => { setPincode(event.target.value.replace(/\D/g, '')); setPage(1); }} placeholder="6 digits" /></label>
      <label>Delivery status<Select value={new URLSearchParams(extra).get('deliveryStatus') || ''} onChange={value => setExtraValue('deliveryStatus', value)} options={['', 'WAITING', 'READY_TO_SHIP', 'PICKUP_SCHEDULED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'EXCEPTION', 'RTO_IN_TRANSIT', 'RETURNED', 'CANCELLED']} labels={{ '': 'All delivery status' }} /></label>
      <label>From<input type="date" value={new URLSearchParams(extra).get('from') || ''} onChange={event => setExtraValue('from', event.target.value)} /></label>
      <label>To<input type="date" value={new URLSearchParams(extra).get('to') || ''} onChange={event => setExtraValue('to', event.target.value)} /></label>
    </div></details>
    {selected.length > 0 && <div className="admin-card order-bulk-bar"><span><strong>{selected.length}</strong> selected · {packable.length} ready to pack · {pickupable.length} pickup ready</span><div><button type="button" className="admin-btn-ghost" disabled={Boolean(busyOrder)} onClick={printPackingList}>Print packing list</button><button type="button" className="admin-btn-ghost" disabled={Boolean(busyOrder)} onClick={downloadSelectedInvoices}>Download invoices</button><button type="button" className="admin-btn-ghost" disabled={!labelled.length || Boolean(busyOrder)} onClick={downloadSelectedLabels}>Download labels ({labelled.length})</button><button type="button" className="admin-btn-ghost" disabled={!pickupable.length || Boolean(busyOrder)} onClick={() => setPickupOpen(true)}>Request pickup ({pickupable.length})</button><button type="button" className="admin-btn" disabled={!packable.length || Boolean(busyOrder)} onClick={markSelectedPacked}><PackageCheck size={15} />Mark selected packed</button><button type="button" className="admin-btn-ghost" onClick={() => setSelected([])}>Clear</button></div></div>}
    <DataTable loading={loading} error={loadError} onRetry={load} emptyTitle="No orders found" title="Order queue" note="Actions are limited to the next safe workflow step." minWidth={1100}
      heads={['Select', 'Order', 'Product', 'Customer', 'Amount', 'Payment', 'Fulfilment', 'Next action']}
      rows={filtered.map(order => <tr key={order._id} className={selected.includes(order._id) ? 'is-selected' : ''}>
        <td className="px-4 py-4"><input type="checkbox" aria-label={`Select ${order.invoiceNumber || order._id}`} checked={selected.includes(order._id)} onChange={() => toggle(order._id)} /></td>
        <td className="px-4 py-4"><strong>{order.invoiceNumber || `#${order._id.slice(-8).toUpperCase()}`}</strong><p className="admin-note">{new Date(order.createdAt).toLocaleString('en-IN')}</p><p className="order-age">{age(order.createdAt)}</p></td>
        <td className="px-4 py-4"><div className="order-product-cell">{order.orderItems?.[0]?.image ? <img src={order.orderItems[0].image} alt="" /> : <span><PackageCheck size={18} /></span>}<div><strong title={order.orderItems?.[0]?.name}>{order.orderItems?.[0]?.name || 'Order items'}</strong><small>{order.orderItems?.length || 0} item{order.orderItems?.length === 1 ? '' : 's'}</small></div></div></td>
        <td className="px-4 py-4"><strong>{order.user?.name || order.shippingAddress?.fullName || 'Customer'}</strong><p className="admin-note">{order.user?.phone || order.shippingAddress?.mobile || order.user?.email}</p><p className="admin-note">{[order.shippingAddress?.city, order.shippingAddress?.pincode].filter(Boolean).join(' · ')}</p></td>
        <td className="px-4 py-4"><strong>₹{Number(order.adjustedFinalAmount ?? order.finalAmount ?? 0).toLocaleString('en-IN')}</strong>{Number(order.cancellationAdjustment || 0) > 0 && <p className="admin-note">₹{Number(order.cancellationAdjustment).toLocaleString('en-IN')} cancelled</p>}</td>
        <td className="px-4 py-4"><StatusBadge value={order.paymentStatus} /><p className="admin-note mt-1">{order.paymentMethod}</p></td>
        <td className="px-4 py-4"><StatusBadge value={order.orderStatus} /><p className="admin-note mt-2">{order.shipment?.status ? order.shipment.status.replaceAll('_', ' ') : 'Waiting for shipment'}</p>{order.shipment?.awb && <p className="admin-note">AWB {order.shipment.awb}</p>}{order.rto?.status && order.rto.status !== 'NONE' && <p className="mt-2 inline-block rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800">RTO {order.rto.status.replaceAll('_', ' ')}</p>}</td>
        <td className="px-4 py-4"><OrderWorkflowActions compact order={order} busy={busyOrder === order._id || busyOrder === 'bulk'} onStatus={updateOrder} onCancel={target => { setCancelTarget(target); setCancelReason(''); setCancelComment(''); }} onCollectCod={setCodTarget} returnHref={seller ? `${apiBase}/orders/detail?id=${order._id}` : `/admin/returns?orderId=${order._id}`} /><a href={`${apiBase}/orders/detail?id=${order._id}`} className="order-view-link">View complete order →</a></td>
      </tr>)} />
    {pagination && !loadError && <div className="admin-card order-pagination"><label>Show <select value={limit} onChange={event => { setLimit(Number(event.target.value)); setPage(1); }}>{[25, 50, 100].map(value => <option key={value}>{value}</option>)}</select></label><span>{pagination.total ? `${(pagination.page - 1) * pagination.limit + 1}–${Math.min(pagination.page * pagination.limit, pagination.total)} of ${pagination.total}` : '0 orders'}</span><div><button type="button" className="admin-btn-ghost" disabled={pagination.page <= 1} onClick={() => setPage(value => value - 1)}>Previous</button><button type="button" className="admin-btn-ghost" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage(value => value + 1)}>Next</button></div></div>}
    <ConfirmModal open={Boolean(cancelTarget)} title="Cancel this order?" message="Cancellation restores reserved inventory. It is unavailable after courier handover." confirmLabel="Cancel order" onClose={() => setCancelTarget(null)} onConfirm={cancelOrder}><div className="grid gap-3"><label className="admin-field">Cancellation reason<select className="admin-field__control" required value={cancelReason} onChange={event => setCancelReason(event.target.value)}><option value="">Select a reason</option><option value="CUSTOMER_REQUEST">Customer requested cancellation</option><option value="OUT_OF_STOCK">Item unavailable</option><option value="ADDRESS_UNSERVICEABLE">Address not serviceable</option><option value="PAYMENT_PROBLEM">Payment problem</option><option value="DUPLICATE_ORDER">Duplicate order</option><option value="OTHER">Other</option></select></label><label className="admin-field">Staff note<textarea className="admin-field__control min-h-20" maxLength={300} value={cancelComment} onChange={event => setCancelComment(event.target.value)} placeholder="Optional context saved to the order timeline" /></label></div></ConfirmModal>
    <ConfirmModal open={Boolean(codTarget)} title="Record COD collection" message="Use this only after cash has been collected for the delivered order." confirmLabel="Record payment" onClose={() => setCodTarget(null)} onConfirm={collectCod}><div className="grid gap-3"><label className="admin-field">Receipt/reference (optional)<input className="admin-field__control" maxLength={120} value={codForm.reference} onChange={event => setCodForm(value => ({ ...value, reference: event.target.value }))} /></label><label className="admin-field">Collection note<textarea className="admin-field__control min-h-20" maxLength={500} value={codForm.note} onChange={event => setCodForm(value => ({ ...value, note: event.target.value }))} /></label></div></ConfirmModal>
    <ConfirmModal open={pickupOpen} title="Request courier pickup" message={`Request pickup for ${pickupable.length} selected shipment${pickupable.length === 1 ? '' : 's'}. Each carrier confirmation is saved separately.`} confirmLabel="Request pickups" onClose={() => setPickupOpen(false)} onConfirm={requestSelectedPickups}><div className="grid gap-3 sm:grid-cols-3"><label className="admin-field">Pickup date<input type="date" className="admin-field__control" value={pickupSlot.date} onChange={event => setPickupSlot(value => ({ ...value, date: event.target.value }))} /></label><label className="admin-field">Ready from<input type="time" className="admin-field__control" value={pickupSlot.time} onChange={event => setPickupSlot(value => ({ ...value, time: event.target.value }))} /></label><label className="admin-field">Closes at<input type="time" className="admin-field__control" value={pickupSlot.closeTime} onChange={event => setPickupSlot(value => ({ ...value, closeTime: event.target.value }))} /></label></div></ConfirmModal>
  </section>;
}

function Select({ value, onChange, options, labels = {} }) {
  return <select aria-label={labels[value] || 'Filter orders'} className="admin-field__control" value={value} onChange={event => onChange(event.target.value)}>{options.map(option => <option value={option} key={option || 'all'}>{labels[option] || option}</option>)}</select>;
}

function age(value) {
  const hours = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 3600000));
  if (hours < 1) return 'Placed just now';
  if (hours < 24) return `${hours}h in queue`;
  return `${Math.floor(hours / 24)}d in queue`;
}

function nextPickupDate() {
  const date = new Date(Date.now() + 86400000);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function downloadBase64(file) {
  const bytes = Uint8Array.from(atob(file.base64), character => character.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: file.mimeType || 'application/pdf' }));
  const link = document.createElement('a'); link.href = url; link.download = file.filename || 'shipping-label.pdf'; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
