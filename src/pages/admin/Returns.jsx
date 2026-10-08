import PrivateEvidenceMedia from '../../components/order/PrivateEvidenceMedia';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, ClipboardCheck, Clock3, Download, Image as ImageIcon, PackageCheck, RefreshCw, RotateCcw, Search, Truck, WalletCards, X } from 'lucide-react';
import PageHeader from '../../components/admin/PageHeader';
import StatusBadge from '../../components/admin/StatusBadge';
import ShipmentPanel from '../../components/admin/ShipmentPanel';
import api from '../../services/api';
import WorkflowSmartFill, { CopySmartDraft } from '../../components/admin/WorkflowSmartFill';
import { normalizeImageUrl } from '../../services/normalize';
import './Returns.css';

const ALL_STATUSES = ['Requested', 'Approved', 'Rejected', 'Cancelled', 'Pickup Scheduled', 'Picked Up', 'In Transit', 'Received', 'Inspection Pending', 'Verified', 'Mismatch Found', 'QC Passed', 'QC Failed', 'Refund Initiated', 'Exchange Allocated', 'Replacement Shipped', 'Replacement Delivered', 'Exchanged', 'Refunded', 'Closed'];
const TERMINAL = new Set(['Rejected', 'Cancelled', 'Refunded', 'Exchanged', 'Closed']);
const money = value => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const dateTime = value => value ? new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Not available';
const shortId = value => String(value || '').slice(-8).toUpperCase();
const actionLabel = status => ({ Approved: 'Approve request', Rejected: 'Reject request', Cancelled: 'Cancel case', 'Pickup Scheduled': 'Mark pickup scheduled', 'Picked Up': 'Mark picked up', 'In Transit': 'Mark in transit', Received: 'Mark received', 'Inspection Pending': 'Start inspection', Verified: 'Mark item verified', 'Mismatch Found': 'Flag mismatch', 'QC Passed': 'Pass quality check', 'QC Failed': 'Fail quality check', 'Refund Initiated': 'Initiate refund', Refunded: 'Record refund', 'Exchange Allocated': 'Allocate replacement', 'Replacement Shipped': 'Mark replacement shipped', 'Replacement Delivered': 'Mark replacement delivered', Exchanged: 'Complete exchange', Closed: 'Close case' }[status] || status);
const queryFromRoute = route => new URLSearchParams(String(route || '').split('?')[1] || '');

function csvCell(value) { return `"${String(value ?? '').replaceAll('"', '""')}"`; }
function downloadCsv(rows) {
  const headers = ['Request ID', 'Order', 'Customer', 'Product', 'Type', 'Reason', 'Quantity', 'Status', 'Refund estimate', 'Created'];
  const body = rows.map(item => [shortId(item._id), item.order?.invoiceNumber || '', item.user?.name || '', item.productSnapshot?.name || item.product?.name || '', item.type, item.reason, item.quantity, item.status, item.financial?.estimatedRefundAmount || 0, item.createdAt]);
  const blob = new Blob([[headers, ...body].map(row => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = `return-cases-${new Date().toISOString().slice(0, 10)}.csv`; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export default function Returns({ route = '' }) {
  const seller = String(route).split('?')[0].startsWith('/seller');
  const apiBase = seller ? '/seller' : '/admin';
  const initial = useMemo(() => queryFromRoute(route), [route]);
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState(() => ({ search: initial.get('search') || '', status: initial.get('status') || '', type: '', qcStatus: '', refundStatus: '', sla: '', attention: '', range: initial.get('range') || '', from: initial.get('from') || '', to: initial.get('to') || '' }));
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pickupOpen, setPickupOpen] = useState(false);
  const [pickupPlan, setPickupPlan] = useState(() => ({ date: new Date(Date.now() + 86400000).toISOString().slice(0, 10), time: '10:00', closeTime: '18:00', confirmed: false }));
  const [actionStatus, setActionStatus] = useState('');
  const [actionForm, setActionForm] = useState({ adminComment: '', inventoryDisposition: 'RESTOCK', receivedQuantity: 1, qcNotes: '', refundAmount: '', refundReference: '', processWithProvider: false, exchangeAdjustmentSettled: false, exchangeAdjustmentReference: '', replacementTrackingReference: '', confirmCarrierDelivery: false, priority: 'NORMAL', tags: '', internalNote: '' });
  const sequence = useRef(0);

  useEffect(() => { const timer = setTimeout(() => { setDebouncedSearch(filters.search.trim()); setPage(1); }, 280); return () => clearTimeout(timer); }, [filters.search]);
  useEffect(() => { setFilters(current => ({ ...current, search: initial.get('search') || '', status: initial.get('status') || '', range: initial.get('range') || '', from: initial.get('from') || '', to: initial.get('to') || '' })); setPage(1); }, [initial]);

  const params = useMemo(() => {
    const result = new URLSearchParams({ page: String(page), limit: '25' });
    Object.entries({ ...filters, search: debouncedSearch }).forEach(([key, value]) => { if (value) result.set(key, value); });
    return result.toString();
  }, [debouncedSearch, filters, page]);

  const load = useCallback(async () => {
    const current = ++sequence.current; setLoading(true); setError('');
    try {
      const statsParams = new URLSearchParams(params); ['page', 'limit', 'search', 'status', 'qcStatus', 'refundStatus', 'sla', 'attention'].forEach(key => statsParams.delete(key));
      const [list, summary] = await Promise.all([api.get(`${apiBase}/returns?${params}`, { silent: true, cache: 'no-store' }), api.get(`${apiBase}/returns/stats?${statsParams}`, { silent: true, cache: 'no-store' })]);
      if (current !== sequence.current) return;
      const items = Array.isArray(list) ? list : list?.items;
      if (!Array.isArray(items)) throw new Error('Return cases could not be read.');
      setRows(items); setMeta(Array.isArray(list) ? null : list); setStats(summary); setSelected(new Set());
    } catch (err) { if (current === sequence.current) setError(err.message); }
    finally { if (current === sequence.current) setLoading(false); }
  }, [apiBase, params]);
  useEffect(() => { load(); return () => { sequence.current += 1; }; }, [load]);

  const openDetail = async (id) => {
    setDetailLoading(true); setError(''); setActionStatus('');
    try {
      const item = await api.get(`${apiBase}/returns/${id}`, { silent: true, cache: 'no-store' });
      setDetail(item); setActionForm({ adminComment: '', inventoryDisposition: 'RESTOCK', receivedQuantity: item.quantity || 1, qcNotes: '', refundAmount: item.financial?.approvedRefundAmount || item.financial?.estimatedRefundAmount || '', refundReference: '', processWithProvider: false, exchangeAdjustmentSettled: item.financial?.exchangeAdjustmentStatus === 'SETTLED', exchangeAdjustmentReference: item.financial?.exchangeAdjustmentReference || '', replacementTrackingReference: item.replacementManualReference || '', confirmCarrierDelivery: false, priority: item.priority || 'NORMAL', tags: (item.tags || []).join(', '), internalNote: '' });
    } catch (err) { setError(err.message); }
    finally { setDetailLoading(false); }
  };

  const updateCase = async (status, source = detail) => {
    if (!source || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const payload = { status, revision: source.revision, adminComment: actionForm.adminComment.trim() };
      if (['QC Passed', 'QC Failed'].includes(status)) Object.assign(payload, { inventoryDisposition: actionForm.inventoryDisposition, receivedQuantity: Number(actionForm.receivedQuantity), qcNotes: actionForm.qcNotes.trim() });
      if (['Refund Initiated', 'Refunded'].includes(status)) Object.assign(payload, { refundAmount: Number(actionForm.refundAmount), refundReference: actionForm.refundReference.trim(), processWithProvider: actionForm.processWithProvider });
      if (status === 'Exchange Allocated') Object.assign(payload, { exchangeAdjustmentSettled: actionForm.exchangeAdjustmentSettled, exchangeAdjustmentReference: actionForm.exchangeAdjustmentReference.trim() });
      if (status === 'Replacement Shipped') payload.replacementTrackingReference = actionForm.replacementTrackingReference.trim();
      if (status === 'Replacement Delivered') payload.confirmCarrierDelivery = actionForm.confirmCarrierDelivery;
      const saved = await api.put(`${apiBase}/returns/${source._id}/status`, payload);
      setNotice(`${source.type === 'exchange' ? 'Exchange' : 'Return'} ${status.toLowerCase()} successfully.`); setActionStatus(''); setDetail(saved);
      await load();
      if (saved?._id) await openDetail(saved._id);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const refundAction = async (action, source = detail) => {
    if (!source || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const saved = await api.post(`${apiBase}/returns/${source._id}/refund/${action}`, { adminComment: actionForm.adminComment.trim() });
      setDetail(saved); setNotice(action === 'retry' ? 'Refund retry submitted safely.' : 'Refund status reconciled with the payment provider.');
      await load(); await openDetail(source._id);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const prepareExchangeAdjustment = async (source = detail) => {
    if (!source || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const saved = await api.post(`${apiBase}/returns/${source._id}/exchange-adjustment/prepare`, {});
      const difference = Number(saved?.financial?.exchangePriceDifference || 0);
      setDetail(saved);
      setNotice(difference > 0 ? 'Secure exchange payment link is ready for the customer.' : 'Exchange credit was submitted to the original payment method.');
      await load(); await openDetail(source._id);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const revealRefundDestination = async (source = detail) => {
    if (!source || busy) return;
    setBusy(true); setError('');
    try {
      const revealed = await api.get(`${apiBase}/returns/${source._id}/refund-destination`, { silent: true, cache: 'no-store' });
      setDetail(current => current?._id === source._id ? { ...current, refundDestination: revealed?.refundDestination || null } : current);
      setNotice('Protected refund details revealed and recorded in the audit log.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const saveMeta = async (source = detail, assignment) => {
    if (!source || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const saved = await api.patch(`${apiBase}/returns/${source._id}/meta`, { priority: actionForm.priority, tags: actionForm.tags, internalNote: actionForm.internalNote.trim(), assignment });
      setDetail(saved); setActionForm(current => ({ ...current, internalNote: '' })); setNotice('Case ownership details saved.');
      await load();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const bulkApprove = async () => {
    const items = rows.filter(row => selected.has(row._id) && row.allowedStatuses?.includes('Approved'));
    if (!items.length || busy) return;
    setBusy(true); setError('');
    const results = await Promise.allSettled(items.map(item => api.put(`${apiBase}/returns/${item._id}/status`, { status: 'Approved', revision: item.revision, adminComment: 'Approved in bulk review.' })));
    const failed = results.filter(result => result.status === 'rejected').length;
    setNotice(`${items.length - failed} request(s) approved${failed ? `; ${failed} need individual review` : ''}.`); setBusy(false); await load();
  };
  const bulkPickup = async () => {
    const items = rows.filter(row => selected.has(row._id) && row.status === 'Approved');
    if (!items.length || busy || !pickupPlan.confirmed) return;
    setBusy(true); setError(''); setNotice(''); let completed = 0; const failures = [];
    for (const item of items) {
      try {
        await api.post(`${apiBase}/returns/${item._id}/delivery/book`, pickupPlan);
        await api.post(`${apiBase}/returns/${item._id}/delivery/pickup`, pickupPlan);
        completed += 1;
      } catch (err) { failures.push(`#${shortId(item._id)}: ${err.message}`); }
    }
    setBusy(false); setPickupOpen(false); setPickupPlan(current => ({ ...current, confirmed: false }));
    setNotice(`${completed} reverse pickup(s) created${failures.length ? `; ${failures.length} need attention` : ''}.`);
    if (failures.length) setError(failures.slice(0, 3).join(' '));
    await load();
  };

  const toggle = id => setSelected(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const summaryCards = [
    ['Awaiting review', stats?.awaitingReview, ClipboardCheck, 'Requested'], ['Pickup due', stats?.pickupDue, Truck, 'Approved'], ['In transit', stats?.inTransit, RotateCcw, 'In Transit'], ['QC pending', stats?.qcPending, PackageCheck, 'Received'], ['Refund pending', stats?.refundPending, WalletCards, 'Refund Initiated'], ['Needs attention', stats?.exceptions, AlertTriangle, '', '1'],
  ];

  return <section className="returns-workspace">
    <PageHeader title="Returns / Exchange" note="Review requests, arrange reverse pickup, inspect stock and reconcile refunds." />
    <div className="returns-summary" aria-label="Return case summary">{summaryCards.map(([label, value, Icon, status, attention = '']) => <button key={label} type="button" onClick={() => { setFilters(current => ({ ...current, status, attention })); setPage(1); }}><Icon size={19} /><span>{label}</span><strong>{Number(value || 0)}</strong></button>)}</div>
    <div className="returns-toolbar">
      <label className="returns-search"><Search size={17} /><input value={filters.search} onChange={event => setFilters(current => ({ ...current, search: event.target.value }))} placeholder="Search request, order, customer, product or courier" /></label>
      <select aria-label="Status" value={filters.status} onChange={event => { setFilters(current => ({ ...current, status: event.target.value })); setPage(1); }}><option value="">All statuses</option>{ALL_STATUSES.map(status => <option key={status}>{status}</option>)}</select>
      <select aria-label="Type" value={filters.type} onChange={event => setFilters(current => ({ ...current, type: event.target.value }))}><option value="">Return + exchange</option><option value="return">Returns</option><option value="exchange">Exchanges</option></select>
      <select aria-label="Quality status" value={filters.qcStatus} onChange={event => setFilters(current => ({ ...current, qcStatus: event.target.value }))}><option value="">All QC states</option><option value="PENDING">QC pending</option><option value="PASSED">QC passed</option><option value="FAILED">QC failed</option></select>
      <select aria-label="Refund status" value={filters.refundStatus} onChange={event => setFilters(current => ({ ...current, refundStatus: event.target.value }))}><option value="">All refund states</option><option value="PENDING">Refund pending</option><option value="INITIATED">Refund initiated</option><option value="PROCESSED">Refund processed</option><option value="FAILED">Refund failed</option><option value="NOT_REQUIRED">No refund required</option></select>
      <label className="returns-date-filter">From<input aria-label="Returns from date" type="date" value={filters.from} max={filters.to || undefined} onChange={event => { setFilters(current => ({ ...current, from: event.target.value })); setPage(1); }} /></label>
      <label className="returns-date-filter">To<input aria-label="Returns to date" type="date" value={filters.to} min={filters.from || undefined} onChange={event => { setFilters(current => ({ ...current, to: event.target.value })); setPage(1); }} /></label>
      <button type="button" className={filters.sla === 'overdue' ? 'is-active' : ''} onClick={() => setFilters(current => ({ ...current, sla: current.sla ? '' : 'overdue' }))}><Clock3 size={16} /> Overdue {stats?.overdue ? `(${stats.overdue})` : ''}</button>
      {Object.values(filters).some(Boolean) && <button type="button" onClick={() => { setFilters({ search: '', status: '', type: '', qcStatus: '', refundStatus: '', sla: '', attention: '', range: '', from: '', to: '' }); setPage(1); }}><X size={16} /> Clear</button>}
      <button type="button" onClick={load} disabled={loading} aria-label="Refresh cases"><RefreshCw size={16} /></button>
    </div>
    {(selected.size > 0 || rows.length > 0) && <div className="returns-bulk"><span><strong>{selected.size}</strong> selected</span><button disabled={busy || !rows.some(row => selected.has(row._id) && row.allowedStatuses?.includes('Approved'))} onClick={bulkApprove}><CheckCircle2 size={16} />Approve eligible</button><button disabled={busy || !rows.some(row => selected.has(row._id) && row.status === 'Approved')} onClick={() => setPickupOpen(value => !value)}><Truck size={16} />Bulk pickup</button><button onClick={() => downloadCsv(selected.size ? rows.filter(row => selected.has(row._id)) : rows)}><Download size={16} />Export CSV</button></div>}
    {pickupOpen && <div className="returns-pickup-plan"><strong>Schedule selected approved returns</strong><label>Pickup date<input type="date" value={pickupPlan.date} onChange={event => setPickupPlan(current => ({ ...current, date: event.target.value }))} /></label><label>Ready from<input type="time" value={pickupPlan.time} onChange={event => setPickupPlan(current => ({ ...current, time: event.target.value }))} /></label><label>Close time<input type="time" value={pickupPlan.closeTime} onChange={event => setPickupPlan(current => ({ ...current, closeTime: event.target.value }))} /></label><label className="returns-pickup-plan__confirm"><input type="checkbox" checked={pickupPlan.confirmed} onChange={event => setPickupPlan(current => ({ ...current, confirmed: event.target.checked }))} /> Create real courier bookings using the connected store account.</label><button className="returns-primary" disabled={busy || !pickupPlan.confirmed || !pickupPlan.date} onClick={bulkPickup}>{busy ? 'Creating pickups…' : 'Create reverse pickups'}</button></div>}
    {notice && <p className="returns-notice" role="status">{notice}</p>}
    {error && <p className="returns-error" role="alert">{error} <button onClick={load}>Try again</button></p>}
    <div className="returns-list" aria-busy={loading}>
      <div className="returns-list__head"><span><input type="checkbox" aria-label="Select page" checked={rows.length > 0 && rows.every(row => selected.has(row._id))} onChange={event => setSelected(event.target.checked ? new Set(rows.map(row => row._id)) : new Set())} /></span><span>Case</span><span>Customer & order</span><span>Product</span><span>Stage</span><span>Next step</span></div>
      {loading && !rows.length ? <div className="returns-empty"><RefreshCw className="animate-spin" /><h2>Loading return cases…</h2></div> : !rows.length ? <div className="returns-empty"><RotateCcw /><h2>No matching return cases</h2><p>New customer requests will appear here.</p></div> : rows.map(item => {
        const overdue = item.slaDueAt && new Date(item.slaDueAt) < new Date() && !TERMINAL.has(item.status);
        const image = normalizeImageUrl(item.productSnapshot?.image || item.product?.images?.[0]?.url || item.product?.images?.[0] || '');
        return <article className="returns-row" key={item._id}>
          <label className="returns-row__check"><input type="checkbox" checked={selected.has(item._id)} onChange={() => toggle(item._id)} aria-label={`Select return ${shortId(item._id)}`} /></label>
          <div><button className="returns-case-link" onClick={() => openDetail(item._id)}>#{shortId(item._id)}</button><p>{item.type === 'exchange' ? 'Exchange' : 'Return'} · {item.quantity} unit</p><time>{dateTime(item.createdAt)}</time>{overdue && <span className="returns-overdue">Review overdue</span>}</div>
          <div><strong>{item.user?.name || 'Customer'}</strong><p>{item.order?.invoiceNumber || `Order ${shortId(item.order?._id || item.order)}`}</p><small>{item.user?.phone || ''}</small></div>
          <div className="returns-product">{image ? <img src={image} alt="" /> : <span><ImageIcon size={18} /></span>}<div><strong title={item.productSnapshot?.name || item.product?.name}>{item.productSnapshot?.name || item.product?.name || 'Ordered product'}</strong><p>{[item.size, item.color].filter(Boolean).join(' · ') || 'Standard item'}</p><small>{item.reason}</small></div></div>
          <div><StatusBadge value={item.status} /><p className="returns-money">{item.type === 'return' ? money(item.financial?.estimatedRefundAmount) : 'Replacement'}</p></div>
          <button className="returns-open" onClick={() => openDetail(item._id)}>{item.allowedStatuses?.length ? actionLabel(item.allowedStatuses[0]) : 'View case'}<ChevronRight size={16} /></button>
        </article>;
      })}
    </div>
    {meta && <div className="returns-pagination"><span>{meta.total} cases · Page {meta.page} of {meta.totalPages}</span><div><button disabled={loading || page <= 1} onClick={() => setPage(value => value - 1)}>Previous</button><button disabled={loading || page >= meta.totalPages} onClick={() => setPage(value => value + 1)}>Next</button></div></div>}
    {(detail || detailLoading) && <div className="returns-drawer-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) setDetail(null); }}><aside className="returns-drawer" aria-label="Return case details">
      <header><div><span>{detail?.type === 'exchange' ? 'EXCHANGE CASE' : 'RETURN CASE'}</span><h2>{detail ? `#${shortId(detail._id)}` : 'Loading case…'}</h2></div><button disabled={busy} onClick={() => setDetail(null)} aria-label="Close case"><X /></button></header>
      {detailLoading && !detail ? <div className="returns-empty"><RefreshCw className="animate-spin" /></div> : detail && <ReturnCaseDetail item={detail} apiBase={apiBase} actionStatus={actionStatus} setActionStatus={setActionStatus} form={actionForm} setForm={setActionForm} busy={busy} onUpdate={updateCase} onRefundAction={refundAction} onPrepareExchangeAdjustment={prepareExchangeAdjustment} onRevealRefundDestination={revealRefundDestination} onSaveMeta={saveMeta} onReload={() => openDetail(detail._id)} />}
    </aside></div>}
  </section>;
}

function ReturnCaseDetail({ item, apiBase, actionStatus, setActionStatus, form, setForm, busy, onUpdate, onRefundAction, onPrepareExchangeAdjustment, onRevealRefundDestination, onSaveMeta, onReload }) {
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const orderItem = item.order?.orderItems?.find(entry => String(entry._id) === item.orderItemId);
  const image = normalizeImageUrl(item.productSnapshot?.image || orderItem?.image || item.product?.images?.[0]?.url || item.product?.images?.[0] || '');
  const address = item.pickupAddress || item.order?.shippingAddress;
  const needsQc = ['QC Passed', 'QC Failed'].includes(actionStatus);
  const needsRefund = ['Refund Initiated', 'Refunded'].includes(actionStatus);
  const needsNote = ['Rejected', 'Cancelled', 'QC Failed'].includes(actionStatus);
  const exchangeDifference = Number(item.financial?.exchangePriceDifference || 0);
  const needsExchangeAdjustment = actionStatus === 'Exchange Allocated' && !['NOT_REQUIRED', 'SETTLED'].includes(item.financial?.exchangeAdjustmentStatus);
  const needsManualReplacementReference = actionStatus === 'Replacement Shipped' && !item.replacementShipment?.awb;
  const needsCarrierDeliveryConfirmation = actionStatus === 'Replacement Delivered' && item.replacementShipment?.awb && item.replacementShipment?.status !== 'DELIVERED';
  const refundNeedsAttention = item.financial?.refundStatus === 'FAILED' || (item.financial?.refundStatus === 'INITIATED' && item.financial?.nextRefundCheckAt && new Date(item.financial.nextRefundCheckAt) < new Date());
  const reservationExpired = item.exchangeReservationExpiresAt && new Date(item.exchangeReservationExpiresAt) < new Date() && !['Replacement Shipped', 'Replacement Delivered', 'Exchanged', 'Closed'].includes(item.status);
  const exchangeAdjustmentStatus = item.financial?.exchangeAdjustmentStatus || 'NOT_REQUIRED';
  const exchangeLinkActive = item.financial?.exchangePaymentLinkUrl && (!item.financial?.exchangePaymentLinkExpiresAt || new Date(item.financial.exchangePaymentLinkExpiresAt) > new Date());
  const canSubmit = actionStatus && (!needsNote || form.adminComment.trim() || form.qcNotes.trim()) && (!needsRefund || Number(form.refundAmount) > 0) && (actionStatus !== 'Refund Initiated' || item.order?.packageVerification?.status === 'NOT_REQUIRED' || !item.order?.fraudProtectionSnapshot?.capturedAt || ['APPROVED', 'PARTIAL'].includes(item.refundDecision?.decision)) && (actionStatus !== 'Refunded' || form.refundReference.trim()) && (!needsExchangeAdjustment || (form.exchangeAdjustmentSettled && form.exchangeAdjustmentReference.trim())) && (!needsManualReplacementReference || form.replacementTrackingReference.trim()) && (!needsCarrierDeliveryConfirmation || form.confirmCarrierDelivery);
  return <div className="returns-drawer__body">
    <section className="returns-detail-hero">{image ? <img src={image} alt={item.productSnapshot?.name || 'Returned product'} /> : <span><PackageCheck /></span>}<div><StatusBadge value={item.status} /><h3>{item.productSnapshot?.name || orderItem?.name || item.product?.name || 'Ordered product'}</h3><p>{[item.size, item.color, `${item.quantity} unit(s)`].filter(Boolean).join(' · ')}</p><p>{item.reason}</p></div></section>
    <section className="returns-detail-grid"><div><small>Case number</small><strong>{item.caseNumber || `RET-${shortId(item._id)}`}</strong></div><div><small>Order</small><strong>{item.order?.invoiceNumber || shortId(item.order?._id || item.order)}</strong></div><div><small>Customer</small><strong>{item.user?.name || 'Customer'}</strong><p>{item.user?.phone}</p></div><div><small>Requested</small><strong>{dateTime(item.createdAt)}</strong></div><div><small>Policy deadline</small><strong>{dateTime(item.policySnapshot?.deadline)}</strong></div><div><small>Next action due</small><strong>{TERMINAL.has(item.status) ? 'Completed' : dateTime(item.slaDueAt)}</strong></div></section>
    <section className="returns-detail-card"><WorkflowSmartFill key={item._id} workflow="returns" form={{ ...form, customerReply: form.customerReply || "" }} onChange={setForm} apiBase={`${apiBase}/smart-fill`} context={{ caseId: String(item._id) }} disabled={busy} />{form.customerReply && <div><label className="admin-field mt-3">Reviewed customer reply (not sent)<textarea className="admin-field__control min-h-24" maxLength={2000} value={form.customerReply} onChange={event => set("customerReply", event.target.value)} /></label><CopySmartDraft value={form.customerReply} /></div>}</section>
    <section className="returns-detail-card"><h3>Case ownership</h3><div className="returns-action-form"><label>Priority<select value={form.priority} onChange={event => set('priority', event.target.value)}><option value="LOW">Low</option><option value="NORMAL">Normal</option><option value="HIGH">High</option><option value="URGENT">Urgent</option></select></label><label>Tags<input maxLength={240} value={form.tags} onChange={event => set('tags', event.target.value)} placeholder="courier, vip, damaged" /></label><label className="is-wide">Private note<textarea value={form.internalNote} maxLength={1000} onChange={event => set('internalNote', event.target.value)} placeholder="Only staff can see this note" /></label><div className="returns-action-buttons is-wide"><button type="button" onClick={() => onSaveMeta(item, 'ME')} disabled={busy}>Assign to me</button>{item.assignee && <button type="button" onClick={() => onSaveMeta(item, 'UNASSIGN')} disabled={busy}>Unassign</button>}<button type="button" className="is-active" onClick={() => onSaveMeta(item)} disabled={busy}>Save case details</button></div></div><p className="admin-note mt-3">Assigned to: {item.assignee?.name || 'Unassigned'}</p>{item.internalNotes?.length > 0 && <details className="mt-3"><summary>Private notes ({item.internalNotes.length})</summary><ol className="returns-timeline mt-3">{[...item.internalNotes].reverse().map((entry, index) => <li key={`${entry.date}-${index}`}><span /><div><p>{entry.text}</p><small>{entry.author?.name || 'Staff'} · {dateTime(entry.date)}</small></div></li>)}</ol></details>}</section>
    {item.comment && <section className="returns-detail-card"><h3>Customer note</h3><p>{item.comment}</p></section>}
    <section className="returns-detail-card"><h3>{item.type === 'exchange' ? 'Exchange & settlement' : 'Refund & resolution'}</h3><dl><div><dt>Original item value</dt><dd>{money(item.financial?.merchandiseAmount)}</dd></div>{item.type === 'return' ? <><div><dt>Allocated discounts</dt><dd>− {money(Number(item.financial?.allocatedCouponDiscount || 0) + Number(item.financial?.allocatedPrepaidDiscount || 0))}</dd></div><div className="is-total"><dt>Estimated refund</dt><dd>{money(item.financial?.estimatedRefundAmount)}</dd></div><div><dt>Method</dt><dd>{item.refundDestinationSummary?.label || item.refundMethod?.replaceAll('_', ' ')}</dd></div><div><dt>Refund state</dt><dd>{item.financial?.refundStatus || 'NOT REQUIRED'}</dd></div></> : <><div><dt>Replacement value</dt><dd>{money(Number(item.financial?.exchangeUnitPrice || 0) * Number(item.quantity || 1))}</dd></div><div className="is-total"><dt>{exchangeDifference > 0 ? 'Customer pays' : exchangeDifference < 0 ? 'Customer credit' : 'Price difference'}</dt><dd>{money(Math.abs(exchangeDifference))}</dd></div><div><dt>Settlement</dt><dd>{String(item.financial?.exchangeAdjustmentStatus || 'NOT_REQUIRED').replaceAll('_', ' ')}</dd></div>{item.financial?.exchangeAdjustmentReference && <div><dt>Reference</dt><dd>{item.financial.exchangeAdjustmentReference}</dd></div>}</>}</dl>
      {item.financial?.expectedBy && item.financial?.refundStatus === 'INITIATED' && <p className="returns-refund-eta"><strong>Expected completion:</strong> {dateTime(item.financial.expectedBy)}</p>}
      {item.refundDestinationSummary && !item.refundDestination && !['ORIGINAL_PAYMENT', 'MANUAL'].includes(item.refundMethod) && <div className="returns-sensitive"><strong>Protected refund details</strong><p>{item.refundDestinationSummary.label || 'Sensitive payment details are hidden.'}</p><button type="button" disabled={busy} onClick={() => onRevealRefundDestination(item)}>Reveal and audit access</button></div>}
      {item.refundDestination && <div className="returns-sensitive"><strong>Protected refund details</strong>{item.refundDestination.vpa && <p>UPI: {item.refundDestination.vpa}</p>}{item.refundDestination.accountHolder && <p>{item.refundDestination.accountHolder} · {item.refundDestination.accountNumber} · {item.refundDestination.ifsc}</p>}</div>}
    </section>
    {item.type === 'exchange' && exchangeDifference !== 0 && item.status === 'QC Passed' && exchangeAdjustmentStatus !== 'SETTLED' && <section className={`returns-detail-card ${exchangeAdjustmentStatus === 'FAILED' ? 'returns-attention' : ''}`}><h3>{exchangeDifference > 0 ? 'Collect exchange difference' : 'Send exchange credit'}</h3><p>{exchangeDifference > 0 ? `The customer must pay ${money(exchangeDifference)} before replacement stock can be allocated.` : `${money(Math.abs(exchangeDifference))} is due back through the original online payment.`}</p>{item.financial?.exchangeAdjustmentLastError && <p role="alert">{item.financial.exchangeAdjustmentLastError}</p>}<div className="returns-action-buttons mt-3">{exchangeDifference > 0 && exchangeLinkActive && <a className="returns-primary" href={item.financial.exchangePaymentLinkUrl} target="_blank" rel="noreferrer">Open payment link</a>}<button type="button" className="is-active" disabled={busy || (exchangeDifference > 0 && exchangeLinkActive && exchangeAdjustmentStatus === 'PAYMENT_LINK_CREATED') || exchangeAdjustmentStatus === 'CREDIT_PROCESSING'} onClick={() => onPrepareExchangeAdjustment(item)}>{busy ? 'Working...' : exchangeDifference > 0 ? (exchangeLinkActive ? 'Payment link ready' : 'Create secure payment link') : exchangeAdjustmentStatus === 'CREDIT_PROCESSING' ? 'Credit processing' : 'Refund price difference'}</button></div>{item.financial?.exchangePaymentLinkExpiresAt && exchangeDifference > 0 && <small>{exchangeLinkActive ? `Link expires ${dateTime(item.financial.exchangePaymentLinkExpiresAt)}.` : 'The previous link expired. Create a new secure link.'}</small>}</section>}
    {item.type === 'return' && [item.financial?.refundableDeliveryCharge, item.financial?.refundablePlatformFee, item.financial?.refundableCodCharge, item.financial?.returnShippingCharge, item.financial?.restockingFee].some(value => Number(value || 0) > 0) && <section className="returns-detail-card"><h3>Refund charge breakdown</h3><dl>{Number(item.financial?.refundableDeliveryCharge || 0) > 0 && <div><dt>Delivery charge returned</dt><dd>+ {money(item.financial.refundableDeliveryCharge)}</dd></div>}{Number(item.financial?.refundablePlatformFee || 0) > 0 && <div><dt>Platform fee returned</dt><dd>+ {money(item.financial.refundablePlatformFee)}</dd></div>}{Number(item.financial?.refundableCodCharge || 0) > 0 && <div><dt>COD charge returned</dt><dd>+ {money(item.financial.refundableCodCharge)}</dd></div>}{Number(item.financial?.returnShippingCharge || 0) > 0 && <div><dt>Return shipping</dt><dd>- {money(item.financial.returnShippingCharge)}</dd></div>}{Number(item.financial?.restockingFee || 0) > 0 && <div><dt>Restocking fee</dt><dd>- {money(item.financial.restockingFee)}</dd></div>}</dl></section>}
    {refundNeedsAttention && <section role="alert" className="returns-detail-card returns-attention"><h3>Refund needs attention</h3><p>{item.financial?.lastRefundError || 'The payment provider has not confirmed this refund yet.'}</p><p>Attempts: {item.financial?.refundAttemptCount || 0}{item.financial?.nextRefundCheckAt ? ` · Next automatic check ${dateTime(item.financial.nextRefundCheckAt)}` : ''}</p><div className="returns-action-buttons mt-3"><button type="button" onClick={() => onRefundAction('reconcile')} disabled={busy || !item.financial?.refundReference}>Check provider status</button><button type="button" className="is-active" onClick={() => onRefundAction('retry')} disabled={busy}>Retry safely</button></div></section>}
    {item.type === 'exchange' && item.exchangeReservationExpiresAt && <section className={`returns-detail-card ${reservationExpired ? 'returns-attention' : ''}`}><h3>Replacement reservation</h3><p>{reservationExpired ? 'Reservation expired and needs allocation review.' : `Reserved until ${dateTime(item.exchangeReservationExpiresAt)}.`}</p></section>}
    {address && <section className="returns-detail-card"><h3>Reverse pickup address</h3><p><strong>{address.fullName}</strong> · {address.mobile}</p><p>{[address.houseNo || address.houseNumber, address.area, address.landmark, address.city, address.state, address.pincode].filter(Boolean).join(', ')}</p></section>}
    {item.photos?.length > 0 && <section className="returns-detail-card"><h3>Customer evidence</h3><div className="returns-evidence">{item.photos.map((photo, index) => <a href={normalizeImageUrl(photo)} target="_blank" rel="noreferrer" key={photo}><img src={normalizeImageUrl(photo)} alt={`Return evidence ${index + 1}`} /></a>)}</div></section>}
    <EvidenceComparison item={item} />
    {['Received', 'Inspection Pending', 'Verified', 'Mismatch Found'].includes(item.status) && <ReturnInspection item={item} apiBase={apiBase} onReload={onReload} />}
    {item.inspection?.status && item.inspection.status !== 'NOT_STARTED' && <RefundDecision item={item} apiBase={apiBase} onReload={onReload} />}
    {item.qc?.status && <section className="returns-detail-card"><h3>Quality inspection</h3><p><strong>{item.qc.status}</strong> · {item.qc.disposition || 'PENDING'} · {item.qc.receivedQuantity ?? 0}/{item.quantity} received</p>{item.qc.notes && <p>{item.qc.notes}</p>}<small>Stock is restored only when QC passes with RESTOCK disposition.</small></section>}
    {['Approved', 'Pickup Scheduled', 'Picked Up', 'In Transit'].includes(item.status) && <ShipmentPanel returnId={item._id} apiBase={apiBase} onChanged={onReload} />}
    {item.type === 'exchange' && ['Exchange Allocated', 'Replacement Shipped', 'Replacement Delivered'].includes(item.status) && <ShipmentPanel returnId={item._id} replacement apiBase={apiBase} onChanged={onReload} />}
    <section className="returns-detail-card"><h3>Activity timeline</h3><ol className="returns-timeline">{[...(item.statusTimeline || [])].reverse().map((entry, index) => <li key={`${entry.date}-${index}`}><span /><div><strong>{entry.status}</strong><p>{entry.note || 'Status updated.'}</p><small>{entry.actor?.name || entry.source || 'System'} · {dateTime(entry.date)}</small></div></li>)}</ol></section>
    {item.allowedStatuses?.length > 0 && <section className="returns-actions"><h3>Choose the next action</h3><div className="returns-action-buttons">{item.allowedStatuses.map(status => <button type="button" className={actionStatus === status ? 'is-active' : ''} onClick={() => setActionStatus(status)} key={status}>{actionLabel(status)}</button>)}</div>
      {actionStatus && <div className="returns-action-form">
        {needsQc && <><label>Inventory disposition<select value={form.inventoryDisposition} onChange={event => set('inventoryDisposition', event.target.value)}><option value="RESTOCK">Restock as sellable</option><option value="QUARANTINE">Quarantine for review</option><option value="DAMAGED">Damaged stock</option><option value="MISSING">Item missing</option><option value="DISPOSE">Dispose / write off</option></select></label><label>Quantity received<input type="number" min={form.inventoryDisposition === 'MISSING' ? 0 : 1} max={item.quantity} value={form.receivedQuantity} onChange={event => set('receivedQuantity', event.target.value)} /></label><label className="is-wide">QC notes<textarea value={form.qcNotes} maxLength={1000} onChange={event => set('qcNotes', event.target.value)} placeholder="Condition, tags, packaging and inspection result" /></label></>}
        {needsRefund && <><label>Approved refund amount<input type="number" min="0.01" step="0.01" max={item.financial?.estimatedRefundAmount} value={form.refundAmount} onChange={event => set('refundAmount', event.target.value)} /></label>{actionStatus === 'Refund Initiated' && item.order?.packageVerification?.status !== 'NOT_REQUIRED' && item.order?.fraudProtectionSnapshot?.capturedAt && !['APPROVED', 'PARTIAL'].includes(item.refundDecision?.decision) && <p role="alert" className="is-wide">Record the refund decision after inspection before initiating payment.</p>}{actionStatus === 'Refund Initiated' && item.refundMethod === 'ORIGINAL_PAYMENT' && String(item.order?.paymentProvider || '').toLowerCase() === 'razorpay' && <label className="returns-provider-check"><input type="checkbox" checked={form.processWithProvider} onChange={event => set('processWithProvider', event.target.checked)} /> Send this refund through Razorpay now</label>}{actionStatus === 'Refunded' && <label>Provider / bank reference<input maxLength={120} value={form.refundReference} onChange={event => set('refundReference', event.target.value)} placeholder="Required after money is sent" /></label>}</>}
        {needsExchangeAdjustment && <><div className="returns-adjustment-summary is-wide"><strong>{exchangeDifference > 0 ? `${money(exchangeDifference)} collected from customer` : `${money(Math.abs(exchangeDifference))} credited to customer`}</strong><span>Confirm the payment or refund before reserving the replacement.</span></div><label className="returns-provider-check is-wide"><input type="checkbox" checked={form.exchangeAdjustmentSettled} onChange={event => set('exchangeAdjustmentSettled', event.target.checked)} /> Price difference is settled</label><label className="is-wide">Payment / refund reference<input maxLength={120} value={form.exchangeAdjustmentReference} onChange={event => set('exchangeAdjustmentReference', event.target.value)} placeholder="Transaction, receipt or approved cash reference" /></label></>}
        {needsManualReplacementReference && <label className="is-wide">Replacement AWB / tracking reference<input maxLength={120} required value={form.replacementTrackingReference} onChange={event => set('replacementTrackingReference', event.target.value)} placeholder="Required when the replacement was booked outside this app" /></label>}
        {needsCarrierDeliveryConfirmation && <label className="returns-provider-check is-wide"><input type="checkbox" checked={form.confirmCarrierDelivery} onChange={event => set('confirmCarrierDelivery', event.target.checked)} /> I verified delivery with the courier before overriding tracking</label>}
        <label className="is-wide">Action note<textarea value={form.adminComment} maxLength={1000} onChange={event => set('adminComment', event.target.value)} placeholder={needsNote ? 'Required for this action' : 'Optional note visible in the case history'} /></label>
        <button type="button" className="returns-primary is-wide" disabled={busy || !canSubmit} onClick={() => onUpdate(actionStatus)}>{busy ? 'Saving…' : actionLabel(actionStatus)}</button>
      </div>}
    </section>}
  </div>;
}

function EvidenceComparison({ item }) {
  const evidence = item.verificationEvidence || [];
  const original = evidence.filter(entry => entry.phase === 'PACKING');
  const returned = evidence.filter(entry => entry.phase !== 'PACKING');
  const inspection = item.inspection || {};
  const media = entries => <div className="returns-evidence">{entries.length ? entries.map(entry => <PrivateEvidenceMedia key={entry._id || entry.fileUrl} entry={entry} />) : <p className="admin-note">No evidence recorded.</p>}</div>;
  return <section className="returns-detail-card"><h3>Dispatch vs returned item</h3><div className="grid gap-4 lg:grid-cols-2"><div><strong>Original dispatch</strong><dl className="mt-2"><div><dt>Unique item ID</dt><dd>{(inspection.expectedUniqueItemIds || item.order?.orderItems?.find(entry => String(entry._id) === item.orderItemId)?.uniqueItemIds || []).join(', ') || 'Legacy order'}</dd></div><div><dt>Seal</dt><dd>{item.order?.packageVerification?.sealId || 'Not recorded'}</dd></div><div><dt>Security tag</dt><dd>{item.order?.packageVerification?.securityTagId || 'Not recorded'}</dd></div><div><dt>Weight</dt><dd>{item.order?.packageVerification?.dispatchWeightGrams ? `${item.order.packageVerification.dispatchWeightGrams} g` : 'Not recorded'}</dd></div></dl>{media(original)}</div><div><strong>Returned item</strong><dl className="mt-2"><div><dt>Scanned ID</dt><dd>{inspection.returnedUniqueItemIds?.join(', ') || 'Waiting for inspection'}</dd></div><div><dt>Seal condition</dt><dd>{inspection.sealCondition?.replaceAll('_', ' ') || 'Not checked'}</dd></div><div><dt>Tag condition</dt><dd>{inspection.tagCondition?.replaceAll('_', ' ') || 'Not checked'}</dd></div><div><dt>Weight</dt><dd>{inspection.returnWeightGrams ? `${inspection.returnWeightGrams} g (${Number(inspection.weightDifferenceGrams || 0) >= 0 ? '+' : ''}${inspection.weightDifferenceGrams || 0} g)` : 'Not recorded'}</dd></div></dl>{media(returned)}</div></div><div className={`mt-4 rounded-xl p-3 ${inspection.result === 'VERIFIED' ? 'bg-emerald-50 text-emerald-800' : inspection.result && inspection.result !== 'NOT_CHECKED' ? 'bg-amber-50 text-amber-900' : 'bg-slate-50'}`}><strong>{inspection.result ? inspection.result.replaceAll('_', ' ') : 'Inspection pending'}</strong>{inspection.flags?.length > 0 && <p>{inspection.flags.map(flag => flag.replaceAll('_', ' ')).join(' · ')}</p>}</div>{item.customerRisk && <p className="admin-note mt-3">Internal customer review signal: <strong>{item.customerRisk.status}</strong> · {item.customerRisk.score}/100. This is a review aid and never an automatic fraud accusation.</p>}</section>;
}

function ReturnInspection({ item, apiBase, onReload }) {
  const [form, setForm] = useState({ returnedUniqueItemIds: (item.inspection?.returnedUniqueItemIds || []).join(', '), returnWeightGrams: item.inspection?.returnWeightGrams || '', returnedSealId: item.inspection?.returnedSealId || '', returnedTagId: item.inspection?.returnedTagId || '', sealCondition: item.inspection?.sealCondition || 'NOT_CHECKED', tagCondition: item.inspection?.tagCondition || 'NOT_CHECKED', condition: item.inspection?.condition || 'GOOD', notes: item.inspection?.notes || '' });
  const [files, setFiles] = useState([]); const [working, setWorking] = useState(false); const [error, setError] = useState('');
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const submit = async event => { event.preventDefault(); if (working) return; setWorking(true); setError(''); try { let evidence = []; if (files.length) { const uploaded = await api.upload(`${apiBase}/returns/evidence/uploads`, files, { fieldName: 'files' }); evidence = (uploaded.files || []).map(file => ({ ...file, type: String(file.mimeType || '').startsWith('video/') ? 'UNBOXING_VIDEO' : 'RETURN_PHOTO' })); } await api.post(`${apiBase}/returns/${item._id}/inspect`, { ...form, revision: Number(item.revision || 0), returnWeightGrams: Number(form.returnWeightGrams) || undefined, evidence }); await onReload(); } catch (err) { setError(err.message); } finally { setWorking(false); } };
  return <section className="returns-detail-card"><h3>Inspect returned parcel</h3><p>Scan the physical item and compare it with the dispatch proof. A mismatch creates a review flag and never rejects a refund automatically.</p><form className="returns-action-form mt-3" onSubmit={submit}><label className="is-wide">Returned unique item ID(s)<input value={form.returnedUniqueItemIds} onChange={event => set('returnedUniqueItemIds', event.target.value)} placeholder="Scan IDs, separated by commas" /></label><label>Return weight (grams)<input type="number" min="1" max="1000000" value={form.returnWeightGrams} onChange={event => set('returnWeightGrams', event.target.value)} /></label><label>Product condition<select value={form.condition} onChange={event => set('condition', event.target.value)}><option value="UNOPENED">Unopened</option><option value="GOOD">Good</option><option value="USED">Used</option><option value="DAMAGED">Damaged</option><option value="DIFFERENT_ITEM">Different item</option><option value="MISSING_ITEM">Missing item</option></select></label><label>Returned seal ID<input value={form.returnedSealId} onChange={event => set('returnedSealId', event.target.value.toUpperCase())} /></label><label>Seal condition<select value={form.sealCondition} onChange={event => set('sealCondition', event.target.value)}><option value="NOT_CHECKED">Not checked</option><option value="INTACT">Intact</option><option value="BROKEN">Broken</option><option value="MISSING">Missing</option><option value="MISMATCH">Mismatch</option></select></label><label>Returned tag ID<input value={form.returnedTagId} onChange={event => set('returnedTagId', event.target.value.toUpperCase())} /></label><label>Tag condition<select value={form.tagCondition} onChange={event => set('tagCondition', event.target.value)}><option value="NOT_CHECKED">Not checked</option><option value="PRESENT">Present</option><option value="REMOVED">Removed</option><option value="MISSING">Missing</option><option value="MISMATCH">Mismatch</option></select></label><label className="is-wide">Inspection photos / unboxing video<input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" multiple onChange={event => { setFiles(Array.from(event.target.files || []).slice(0, 8)); event.target.value = ''; }} /><small>{files.length ? `${files.length} file(s) selected` : 'Attach clear proof before completing inspection.'}</small></label><label className="is-wide">Inspection notes<textarea maxLength={2000} value={form.notes} onChange={event => set('notes', event.target.value)} /></label>{error && <p role="alert" className="is-wide">{error}</p>}<button className="returns-primary is-wide" disabled={working}>{working ? 'Comparing…' : 'Compare and save inspection'}</button></form></section>;
}

function RefundDecision({ item, apiBase, onReload }) {
  const [decision, setDecision] = useState(item.refundDecision?.decision === 'PENDING' ? 'APPROVED' : item.refundDecision?.decision || 'APPROVED'); const [reason, setReason] = useState(''); const [customerMessage, setCustomerMessage] = useState(item.refundDecision?.customerMessage || ''); const [amount, setAmount] = useState(item.financial?.approvedRefundAmount || item.financial?.estimatedRefundAmount || ''); const [working, setWorking] = useState(false); const [error, setError] = useState('');
  const submit = async event => { event.preventDefault(); setWorking(true); setError(''); try { await api.post(`${apiBase}/returns/${item._id}/decision`, { decision, reason, customerMessage, revision: Number(item.revision || 0), refundAmount: decision === 'PARTIAL' ? Number(amount) : undefined }); await onReload(); } catch (err) { setError(err.message); } finally { setWorking(false); } };
  return <section className="returns-detail-card"><h3>Refund decision</h3><p>Verification supports the decision. Staff approval is still required before money moves.</p><form className="returns-action-form mt-3" onSubmit={submit}><label>Decision<select value={decision} onChange={event => setDecision(event.target.value)}><option value="APPROVED">Approve refund</option><option value="PARTIAL">Partial refund</option><option value="REJECTED">Reject refund</option><option value="MORE_INFORMATION_REQUIRED">Request more information</option></select></label>{decision === 'PARTIAL' && <label>Approved amount<input type="number" min="0.01" max={item.financial?.estimatedRefundAmount} step="0.01" value={amount} onChange={event => setAmount(event.target.value)} /></label>}<label className="is-wide">Internal decision reason<textarea required={decision !== 'APPROVED' || item.inspection?.status === 'MISMATCH_FOUND'} maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} placeholder="Required for rejection, partial refund, more information, or mismatch override" /></label><label className="is-wide">Customer-visible message<textarea maxLength={1000} value={customerMessage} onChange={event => setCustomerMessage(event.target.value)} placeholder="Use neutral, clear wording without internal risk details" /></label>{error && <p role="alert" className="is-wide">{error}</p>}<button className="returns-primary is-wide" disabled={working}>{working ? 'Saving…' : 'Save decision'}</button></form></section>;
}
