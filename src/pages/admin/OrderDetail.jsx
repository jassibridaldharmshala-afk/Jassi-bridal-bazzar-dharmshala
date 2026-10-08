import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clipboard, FileText, Mail, MapPin, MessageCircle, PackageCheck, Phone, Plus, ReceiptText, ShieldCheck, UserRound } from 'lucide-react';
import Receipt from '../../components/order/Receipt';
import ReceiptActions from '../../components/order/ReceiptActions';
import ConfirmModal from '../../components/admin/ConfirmModal';
import OrderWorkflowActions from '../../components/admin/OrderWorkflowActions';
import PageHeader from '../../components/admin/PageHeader';
import StatusBadge from '../../components/admin/StatusBadge';
import api from '../../services/api';
import ShipmentPanel from '../../components/admin/ShipmentPanel';
import WorkflowSmartFill, { CopySmartDraft } from '../../components/admin/WorkflowSmartFill';

const blankAddress = { fullName: '', mobile: '', alternateMobile: '', houseNo: '', area: '', landmark: '', city: '', state: '', pincode: '', addressType: 'Home' };

export default function OrderDetail({ route = '' }) {
  const orderId = new URLSearchParams(route.split('?')[1] || '').get('id');
  const seller = route.startsWith('/seller');
  const apiBase = seller ? '/seller' : '/admin';
  const [order, setOrder] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [message, setMessage] = useState('');
  const [receiptError, setReceiptError] = useState('');
  const [saving, setSaving] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelComment, setCancelComment] = useState('');
  const [codOpen, setCodOpen] = useState(false);
  const [codForm, setCodForm] = useState({ reference: '', note: 'COD payment collected from customer' });
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundForm, setRefundForm] = useState({ amount: '', reference: '', note: '' });
  const [manualRefundTarget, setManualRefundTarget] = useState(null);
  const [manualRefundForm, setManualRefundForm] = useState({ reference: '', note: '' });
  const [rtoForm, setRtoForm] = useState({ disposition: 'RESTOCK', receivedQuantity: '', notes: '', waiveRefundDeduction: false });
  const [staffNote, setStaffNote] = useState('');
  const [supportDraft, setSupportDraft] = useState({ reply: '', summary: '' });
  useEffect(() => { setSupportDraft({ reply: '', summary: '' }); }, [orderId]);
  const [addressForm, setAddressForm] = useState(blankAddress);
  const [addressReason, setAddressReason] = useState('');
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const loadVersion = useRef(0);
  const mutationVersion = useRef(0);
  const mutationPending = useRef(false);

  const loadReceipt = useCallback(async (version = loadVersion.current) => {
    setReceiptError('');
    try {
      const data = await api.get(`${apiBase}/orders/${orderId}/receipt`);
      if (version === loadVersion.current) setReceipt(data);
    } catch (error) { if (version === loadVersion.current) setReceiptError(error.message || 'Invoice could not load.'); }
  }, [apiBase, orderId]);
  const load = useCallback(async () => {
    if (!orderId) { setMessage('Choose an order from the orders list.'); return; }
    const version = ++loadVersion.current;
    loadReceipt(version);
    try {
      const data = await api.get(`${apiBase}/orders/${orderId}`);
      if (version !== loadVersion.current) return;
      setOrder(data); setMessage('');
      setAddressForm({ ...blankAddress, ...(data.shippingAddress || {}) });
      const activeUnits = (data.orderItems || []).reduce((sum, item) => sum + Math.max(0, Number(item.quantity || 0) - Number(item.cancelledQuantity || 0)), 0);
      setRtoForm(current => ({ ...current, receivedQuantity: String(activeUnits) }));
    } catch (error) { if (version === loadVersion.current) setMessage(error.message); }
  }, [apiBase, orderId, loadReceipt]);
  useEffect(() => {
    setOrder(null); setReceipt(null); setMessage(''); setReceiptError(''); setSaving(false); setCancelOpen(false); setCodOpen(false); setRefundOpen(false); setManualRefundTarget(null); setInvoiceOpen(false); mutationPending.current = false;
    load();
    return () => { loadVersion.current += 1; mutationVersion.current += 1; mutationPending.current = false; };
  }, [load]);

  const mutate = async (path, body, method = 'put') => {
    if (mutationPending.current || !order || order._id !== orderId) return false;
    mutationPending.current = true;
    const version = ++mutationVersion.current;
    setSaving(true); setMessage('');
    try {
      await api[method](`${apiBase}/orders/${orderId}/${path}`, body);
      if (version === mutationVersion.current) await load();
      return version === mutationVersion.current;
    } catch (error) {
      if (version === mutationVersion.current) { setMessage(error.message); if (error.status === 409) await load(); }
      return false;
    } finally { if (version === mutationVersion.current) { mutationPending.current = false; setSaving(false); } }
  };

  const updateStatus = (current, orderStatus, label) => mutate('status', { orderStatus, revision: Number(current.revision || 0), note: `${label} by staff` });
  const cancelOrder = async () => {
    if (!cancelReason.trim()) { setMessage('Enter the cancellation reason.'); return; }
    const note = cancelComment.trim() || `Order cancelled: ${cancelReason.replaceAll('_', ' ').toLowerCase()}`;
    if (await mutate('status', { orderStatus: 'Cancelled', revision: Number(order.revision || 0), reasonCode: cancelReason, note })) { setCancelOpen(false); setCancelReason(''); setCancelComment(''); }
  };
  const collectCod = async () => {
    if (!codForm.note.trim()) { setMessage('Enter a COD collection note.'); return; }
    if (await mutate('payment-status', { paymentStatus: 'Paid', revision: Number(order.revision || 0), reference: codForm.reference.trim(), note: codForm.note.trim() })) { setCodOpen(false); setCodForm({ reference: '', note: 'COD payment collected from customer' }); }
  };
  const recordRefund = async () => {
    const amount = Number(refundForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) { setMessage('Enter the amount returned to the customer.'); return; }
    if (!refundForm.note.trim()) { setMessage('Enter a refund note.'); return; }
    if (await mutate('payment-status', { paymentStatus: 'Refunded', amount, revision: Number(order.revision || 0), reference: refundForm.reference.trim(), note: refundForm.note.trim() })) {
      setRefundOpen(false); setRefundForm({ amount: '', reference: '', note: '' });
    }
  };
  const recordManualResolutionRefund = async () => {
    if (!manualRefundTarget || !manualRefundForm.reference.trim() || !manualRefundForm.note.trim()) { setMessage('Enter the payment reference and refund note.'); return; }
    const path = manualRefundTarget.type === 'cancellation' ? 'cancellation-refund' : manualRefundTarget.type === 'rto' ? 'rto/refund' : 'item-cancellation-refund';
    const body = { manualReference: manualRefundForm.reference.trim(), manualNote: manualRefundForm.note.trim(), ...(manualRefundTarget.operationId ? { operationId: manualRefundTarget.operationId } : {}) };
    if (await mutate(path, body, 'post')) { setManualRefundTarget(null); setManualRefundForm({ reference: '', note: '' }); }
  };
  const openManualRefund = (target, note) => {
    setManualRefundTarget(target);
    setManualRefundForm({ reference: '', note });
  };
  const inspectRto = async event => {
    event.preventDefault();
    if (!rtoForm.notes.trim()) { setMessage('Enter the RTO inspection notes.'); return; }
    const payload = { ...rtoForm, receivedQuantity: Number(rtoForm.receivedQuantity), revision: Number(order.revision || 0), notes: rtoForm.notes.trim() };
    if (await mutate('rto/inspect', payload, 'post')) setRtoForm(current => ({ ...current, notes: '' }));
  };
  const addNote = async event => {
    event.preventDefault();
    if (!staffNote.trim()) return;
    if (await mutate('staff-notes', { text: staffNote.trim(), revision: Number(order.revision || 0) }, 'patch')) setStaffNote('');
  };
  const saveAddress = async event => {
    event.preventDefault();
    if (!addressReason.trim()) { setMessage('Enter why the delivery address is being corrected.'); return; }
    if (await mutate('shipping-address', { shippingAddress: addressForm, reason: addressReason.trim(), revision: Number(order.revision || 0) })) setAddressReason('');
  };

  const timeline = useMemo(() => {
    if (!order) return [];
    const orderEvents = (order.statusTimeline || []).map(item => ({ ...item, group: 'Order', label: item.status }));
    const shipmentEvents = (order.shipment?.events || []).map(item => ({ ...item, group: order.shipment?.provider && order.shipment.provider !== 'manual' ? 'Courier' : 'Delivery', label: String(item.status || '').replaceAll('_', ' ') }));
    const paymentEvents = (order.paymentEvents || []).map(item => ({ ...item, group: 'Payment', label: item.status || item.state }));
    const returns = (order.returnRequests || []).map(item => ({ date: item.updatedAt || item.createdAt, group: item.type === 'exchange' ? 'Exchange' : 'Return', label: item.status, note: item.reason }));
    return [...orderEvents, ...shipmentEvents, ...paymentEvents, ...returns].filter(item => item.date).sort((left, right) => new Date(right.date) - new Date(left.date));
  }, [order]);

  if (message && !order) return <section className="space-y-5"><PageHeader title="Order Detail" /><p role="alert" className="rounded-xl bg-rose/10 p-3 text-sm font-bold text-rose">{message}</p>{orderId && <button className="admin-btn" onClick={load}>Retry loading order</button>}<a className="admin-table-action-link" href={`${apiBase}/orders`}>Back to orders</a></section>;
  if (!order) return <section className="space-y-5"><PageHeader title="Order Detail" /><p className="rounded-xl bg-white p-6 font-bold shadow-sm">Loading order...</p></section>;

  const displayId = order.invoiceNumber || `#${order._id.slice(-8).toUpperCase()}`;
  const address = order.shippingAddress || {};
  const canEditAddress = ['Pending', 'Confirmed', 'Packed'].includes(order.orderStatus) && !order.shipment?.awb && !['BOOKING', 'BOOKED', 'UNKNOWN'].includes(order.shipment?.bookingState);
  const returnHref = seller ? `${apiBase}/orders` : `/admin/returns?orderId=${order._id}`;
  const cancellationRefund = order.cancellationRefund;
  const cancellationRefundNeedsAction = ['FAILED', 'MANUAL_REQUIRED'].includes(cancellationRefund?.status);
  const rto = order.rto || {};
  const rtoExpectedQuantity = (order.orderItems || []).reduce((sum, item) => sum + Math.max(0, Number(item.quantity || 0) - Number(item.cancelledQuantity || 0)), 0);
  const rtoNeedsInspection = ['RECEIVED', 'QC_PENDING'].includes(rto.status);
  const rtoRefundNeedsAction = ['FAILED', 'MANUAL_REQUIRED'].includes(rto.refundStatus);
  const failedItemRefunds = (order.itemCancellationRefunds || []).filter(entry => ['FAILED', 'MANUAL_REQUIRED'].includes(entry.status));

  return <section className="order-detail-workspace space-y-5">
    <div className="admin-card p-4"><WorkflowSmartFill key={orderId} workflow="support" form={supportDraft} onChange={setSupportDraft} apiBase={`${apiBase}/smart-fill`} context={{ orderId }} disabled={saving} />{supportDraft.reply && <div><label className="admin-field mt-3">Reviewed customer reply (not sent)<textarea className="admin-field__control min-h-24" maxLength={2000} value={supportDraft.reply} onChange={event => setSupportDraft(current => ({ ...current, reply: event.target.value }))} /></label><CopySmartDraft value={supportDraft.reply} /></div>}{supportDraft.summary && <p className="mt-3 text-sm text-theme-muted">Private summary: {supportDraft.summary}</p>}</div>
    <PageHeader title={displayId} kicker={seller ? 'Seller / Order' : 'Admin / Order'} note={`Placed ${new Date(order.createdAt).toLocaleString('en-IN')} · Revision ${Number(order.revision || 0)}`}>
      <button type="button" className="admin-btn-ghost inline-flex items-center gap-2" onClick={() => copy(order._id, setMessage)}><Clipboard size={15} />Copy order ID</button>
      <a href={`${apiBase}/orders`} className="admin-btn-ghost">Back to orders</a>
    </PageHeader>
    {message && <p role="alert" className="rounded-xl bg-rose/10 p-3 text-sm font-bold text-rose">{message}</p>}
    {['HIGH', 'MANUAL_REVIEW'].includes(order.customerRisk?.status) && <section role="alert" className="admin-card border border-amber-300 bg-amber-50 p-4"><strong>Manual review recommended · customer risk {String(order.customerRisk.status).toLowerCase().replaceAll('_', ' ')}</strong><p className="admin-note mt-1">Score {Number(order.customerRisk.score || 0)}/100. This is an internal signal only; verify the order and evidence before taking any action.</p>{order.customerRisk.reasons?.length > 0 && <p className="mt-2 text-sm">{order.customerRisk.reasons.join(' · ')}</p>}</section>}
    {cancellationRefundNeedsAction && <section role="alert" className="admin-card flex flex-wrap items-center justify-between gap-3 p-4"><div><strong>Cancellation refund needs attention</strong><p className="admin-note">{cancellationRefund.lastError || 'The automatic refund did not finish. Retry it without creating a second refund.'}</p></div><button type="button" className="admin-btn" disabled={saving} onClick={() => cancellationRefund.status === 'MANUAL_REQUIRED' ? openManualRefund({ type: 'cancellation', amount: cancellationRefund.amount }, 'Cancellation refund completed outside the connected gateway.') : mutate('cancellation-refund', {}, 'post')}>{cancellationRefund.status === 'MANUAL_REQUIRED' ? 'Record manual refund' : saving ? 'Retrying…' : 'Retry refund safely'}</button></section>}
    {rtoRefundNeedsAction && <section role="alert" className="admin-card flex flex-wrap items-center justify-between gap-3 p-4"><div><strong>RTO refund needs attention</strong><p className="admin-note">{rto.lastRefundError || 'The prepaid refund did not finish. Retry uses the same idempotent refund operation.'}</p></div><button type="button" className="admin-btn" disabled={saving} onClick={() => rto.refundStatus === 'MANUAL_REQUIRED' ? openManualRefund({ type: 'rto', amount: rto.refundAmount }, 'RTO refund completed outside the connected gateway.') : mutate('rto/refund', {}, 'post')}>{rto.refundStatus === 'MANUAL_REQUIRED' ? 'Record manual refund' : saving ? 'Retrying…' : 'Retry RTO refund'}</button></section>}
    {failedItemRefunds.map(entry => <section role="alert" key={entry.operationId} className="admin-card flex flex-wrap items-center justify-between gap-3 p-4"><div><strong>Cancelled item refund needs attention</strong><p className="admin-note">₹{Number(entry.amount || 0).toLocaleString('en-IN')} · {entry.lastError || 'The automatic refund did not finish.'}</p></div><button type="button" className="admin-btn" disabled={saving} onClick={() => entry.status === 'MANUAL_REQUIRED' ? openManualRefund({ type: 'item', operationId: entry.operationId, amount: entry.amount }, 'Cancelled item refund completed outside the connected gateway.') : mutate('item-cancellation-refund', { operationId: entry.operationId }, 'post')}>{entry.status === 'MANUAL_REQUIRED' ? 'Record manual refund' : 'Retry item refund'}</button></section>)}
    {receiptError && <p role="alert" className="rounded-xl bg-rose/10 p-3 text-sm font-bold text-rose">{receiptError} <button type="button" className="admin-btn-ghost" onClick={() => loadReceipt()}>Retry invoice</button></p>}

    <section className="admin-card order-detail-summary">
      <div><span>Order</span><strong><StatusBadge value={order.orderStatus} /></strong></div>
      <div><span>Payment</span><strong><StatusBadge value={order.paymentStatus} /></strong><small>{order.paymentMethod}</small></div>
      <div><span>Delivery</span><strong>{order.shipment?.status ? order.shipment.status.replaceAll('_', ' ') : 'Waiting for shipment'}</strong><small>{order.shipment?.fulfillmentMode === 'SELF' ? `Self delivery${order.shipment.deliveryReference ? ` · ${order.shipment.deliveryReference}` : ''}` : order.shipment?.trackingNumber || order.shipment?.awb ? `Tracking ${order.shipment.trackingNumber || order.shipment.awb}` : 'Tracking not assigned'}</small></div>
      <div><span>Order total</span><strong>₹{Number(order.adjustedFinalAmount ?? order.finalAmount ?? 0).toLocaleString('en-IN')}</strong><small>{rtoExpectedQuantity} active units{Number(order.cancellationAdjustment || 0) > 0 ? ` · ₹${Number(order.cancellationAdjustment).toLocaleString('en-IN')} cancelled` : ''}</small></div>
    </section>

    <div className="admin-card order-detail-next-action"><div><p className="admin-kicker">Next safe action</p><h2>Continue fulfilment</h2><p className="admin-note">Only actions allowed by the current payment, order and courier state are available.</p></div><OrderWorkflowActions order={order} busy={saving} onStatus={updateStatus} onCancel={() => { setCancelReason(''); setCancelComment(''); setCancelOpen(true); }} onCollectCod={() => setCodOpen(true)} onRefund={() => { setRefundForm({ amount: Math.max(0, Number(order.adjustedFinalAmount ?? order.finalAmount ?? 0) - Number(order.refundedAmount || 0)).toFixed(2), reference: '', note: '' }); setRefundOpen(true); }} onResolveException={() => document.querySelector('[aria-label="Courier delivery"]')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })} returnHref={returnHref} /></div>

    <div className="order-detail-grid">
      <main className="space-y-5">
        {['Confirmed', 'Packed'].includes(order.orderStatus) && <PackingVerification order={order} apiBase={apiBase} busy={saving} onChanged={load} onMessage={setMessage} />}
        <ShipmentPanel orderId={orderId} order={order} saving={saving} onManualSave={body => mutate('shipment', body)} onChanged={load} apiBase={apiBase} />
        {rto.status && rto.status !== 'NONE' && <section className="admin-card p-5"><header className="order-section-heading"><div><h2>Return to origin</h2><p>Courier return, warehouse inspection, inventory and refund stay separate.</p></div><PackageCheck size={20} /></header><div className="order-facts"><Row label="RTO state" value={String(rto.status).replaceAll('_', ' ')} /><Row label="Inventory" value={rto.disposition || 'Waiting for inspection'} /><Row label="Received" value={rto.receivedQuantity === undefined ? '-' : `${rto.receivedQuantity}/${rtoExpectedQuantity}`} /><Row label="Refund" value={String(rto.refundStatus || 'NOT REQUIRED').replaceAll('_', ' ')} />{rto.refundAmount !== undefined && <Row label="Refund amount" value={`₹${Number(rto.refundAmount || 0).toLocaleString('en-IN')}`} />}{Number(rto.refundDeduction || 0) > 0 && <Row label="Policy deduction" value={`₹${Number(rto.refundDeduction).toLocaleString('en-IN')}`} />}{rto.refundReference && <Row label="Refund reference" value={rto.refundReference} />}</div>{rto.notes && <p className="admin-note mt-3">{rto.notes}</p>}{rto.lastRefundError && <p role="alert" className="admin-note mt-3">Refund error: {rto.lastRefundError}</p>}{rtoNeedsInspection && <form onSubmit={inspectRto} className="mt-4 grid gap-3 sm:grid-cols-2"><label className="admin-field">Disposition<select className="admin-field__control" value={rtoForm.disposition} onChange={event => setRtoForm(value => ({ ...value, disposition: event.target.value, receivedQuantity: event.target.value === 'MISSING' ? '0' : String(rtoExpectedQuantity) }))}><option value="RESTOCK">Restock as sellable</option><option value="QUARANTINE">Quarantine</option><option value="DAMAGED">Damaged</option><option value="MISSING">Parcel missing</option></select></label><label className="admin-field">Units received<input className="admin-field__control" type="number" min="0" max={rtoExpectedQuantity} required value={rtoForm.receivedQuantity} onChange={event => setRtoForm(value => ({ ...value, receivedQuantity: event.target.value }))} placeholder={String(rtoExpectedQuantity)} /></label><label className="admin-field sm:col-span-2">Inspection notes<textarea className="admin-field__control min-h-24" maxLength={1000} required value={rtoForm.notes} onChange={event => setRtoForm(value => ({ ...value, notes: event.target.value }))} placeholder="Parcel condition, received units and QC decision" /></label><label className="admin-field sm:col-span-2"><span><input type="checkbox" checked={rtoForm.waiveRefundDeduction} onChange={event => setRtoForm(value => ({ ...value, waiveRefundDeduction: event.target.checked }))} /> Waive any configured RTO refund deduction</span><small>Use this for courier faults, store faults or any case where the customer should receive the full remaining amount.</small></label><button className="admin-btn sm:col-span-2" type="submit" disabled={saving || !rtoForm.notes.trim() || rtoForm.receivedQuantity === ''}>Complete RTO inspection</button></form>}</section>}
        <section className="admin-card p-5"><header className="order-section-heading"><div><h2>Ordered items</h2><p>{order.orderItems?.length || 0} catalogue line{order.orderItems?.length === 1 ? '' : 's'}</p></div><PackageCheck size={20} /></header><div className="order-item-list">{order.orderItems?.map(item => {
          const request = order.returnRequests?.find(entry => String(entry.orderItemId) === String(item._id));
          return <article key={`${item._id || item.product}-${item.size}-${item.color}`} className="order-item-row">{item.image ? <img src={item.image} alt="" /> : <span className="order-item-placeholder"><PackageCheck size={20} /></span>}<div><h3>{item.name || item.productName}</h3><p>{[item.sku && `SKU ${item.sku}`, item.size, item.color].filter(Boolean).join(' · ') || 'Standard item'}</p><p>{item.quantity} × ₹{Number(item.price || 0).toLocaleString('en-IN')}{item.originalPrice > item.price ? ` · MRP ₹${Number(item.originalPrice).toLocaleString('en-IN')}` : ''}</p>{request && <span className="order-return-chip">{request.type === 'exchange' ? 'Exchange' : 'Return'} · {request.status}</span>}</div><strong>₹{Number(item.price * item.quantity || 0).toLocaleString('en-IN')}</strong></article>;
        })}</div></section>
        <section className="admin-card p-5"><header className="order-section-heading"><div><h2>Complete activity</h2><p>Order, payment, courier and return events in one timeline.</p></div></header><ol className="order-unified-timeline">{timeline.map((item, index) => <li key={`${item.group}-${item.label}-${index}`}><span /><div><small>{item.group}</small><strong>{item.label}</strong>{item.note && <p>{item.note}</p>}<time>{new Date(item.date).toLocaleString('en-IN')}</time></div></li>)}</ol></section>
        {receipt && <section className="admin-card p-5"><button type="button" className="order-invoice-toggle" onClick={() => setInvoiceOpen(value => !value)}><span><ReceiptText size={20} /><span><strong>Invoice and receipt</strong><small>Download, print or review the customer invoice</small></span></span><span>{invoiceOpen ? 'Hide preview' : 'Preview invoice'}</span></button><div className="mt-4"><ReceiptActions receipt={receipt} /></div>{invoiceOpen && <div className="order-invoice-preview"><Receipt receipt={receipt} /></div>}</section>}
      </main>

      <aside className="space-y-5">
        <section className="admin-card p-5"><header className="order-section-heading"><div><h2>Customer verification</h2><p>Checks required before COD fulfilment</p></div><ShieldCheck size={19} /></header><div className="order-facts"><Row label="Phone" value={order.user?.isPhoneVerified ? 'Verified' : 'Pending'} /><Row label="Successful deliveries" value={String(order.codVerification?.successfulDeliveries ?? '—')} /><Row label="Previous RTO" value={String(order.codVerification?.rtoCount ?? '—')} /><Row label="COD verification" value={order.paymentMethod !== 'COD' ? 'Not required · prepaid' : order.codVerification?.status === 'VERIFIED' ? 'Verified' : order.codVerification?.required ? 'Required · waiting for customer' : 'Not required'} /></div>{order.codVerification?.required && order.codVerification?.status !== 'VERIFIED' && <p className="admin-note mt-3">Packing and courier dispatch stay locked until the customer completes the OTP check.</p>}{!order.codVerification?.evaluatedAt && <p className="admin-note mt-3">This historical order predates smart COD verification and continues under its original workflow.</p>}</section>
        <section className="admin-card p-5"><header className="order-section-heading"><div><h2>Customer</h2><p>Contact and delivery identity</p></div><UserRound size={19} /></header><div className="order-contact-card"><strong>{order.user?.name || address.fullName || 'Customer'}</strong>{order.user?.email && <a href={`mailto:${order.user.email}`}><Mail size={15} />{order.user.email}</a>}{(order.user?.phone || address.mobile) && <a href={`tel:+91${order.user?.phone || address.mobile}`}><Phone size={15} />+91 {order.user?.phone || address.mobile}</a>}{(order.user?.phone || address.mobile) && <a href={`https://wa.me/91${order.user?.phone || address.mobile}`} target="_blank" rel="noreferrer"><MessageCircle size={15} />Open WhatsApp</a>}</div></section>
        <section className="admin-card p-5"><header className="order-section-heading"><div><h2>Delivery address</h2><p>Snapshot saved with this order</p></div><MapPin size={19} /></header><address className="order-address"><strong>{address.fullName}</strong><span>{address.houseNo}{address.area ? `, ${address.area}` : ''}</span>{address.landmark && <span>Near {address.landmark}</span>}<span>{address.city}, {address.state} {address.pincode}</span><span>Phone: {address.mobile}</span></address><button type="button" className="order-copy-link" onClick={() => copy(addressText(address), setMessage)}><Clipboard size={14} />Copy address</button>{canEditAddress && <details className="order-edit-address"><summary>Correct address before booking</summary><form onSubmit={saveAddress}><div className="grid gap-3 sm:grid-cols-2">{[['fullName', 'Contact name'], ['mobile', 'Mobile'], ['houseNo', 'House / flat'], ['area', 'Street / area'], ['landmark', 'Landmark'], ['city', 'City'], ['state', 'State'], ['pincode', 'PIN code']].map(([key, label]) => <label key={key}>{label}<input value={addressForm[key] || ''} maxLength={key === 'area' ? 300 : 160} onChange={event => setAddressForm(value => ({ ...value, [key]: event.target.value }))} /></label>)}</div><label>Reason for correction<textarea maxLength={300} value={addressReason} onChange={event => setAddressReason(event.target.value)} /></label><button className="admin-btn w-full" disabled={saving}>Validate and update address</button></form></details>}</section>
        <section className="admin-card p-5"><header className="order-section-heading"><div><h2>Payment record</h2><p>Financial status stays separate from delivery</p></div><FileText size={19} /></header><div className="order-facts"><Row label="Method" value={order.paymentMethod} /><Row label="Provider" value={order.paymentProvider || '-'} /><Row label="State" value={order.paymentState || order.paymentStatus} /><Row label="Refunded" value={`₹${Number(order.refundedAmount || 0).toLocaleString('en-IN')}`} /><Row label="Refundable" value={`₹${Math.max(0, Number(order.finalAmount || 0) - Number(order.refundedAmount || 0)).toLocaleString('en-IN')}`} /><Row label="Razorpay order" value={order.razorpayOrderId || '-'} /><Row label="Payment ID" value={order.razorpayPaymentId || '-'} />{order.paymentFailureReason && <Row label="Failure" value={order.paymentFailureReason} />}</div>{order.refunds?.length > 0 && <details className="mt-4"><summary className="cursor-pointer text-sm font-bold">Refund history ({order.refunds.length})</summary><div className="mt-3 grid gap-2">{order.refunds.map(item => <div key={item.providerRefundId} className="rounded-xl bg-slate-50 p-3 text-xs"><strong>₹{Number(item.amount || 0).toLocaleString('en-IN')} · {item.status}</strong><p>{item.provider || 'payment provider'} · {item.providerRefundId}</p><time>{item.processedAt ? new Date(item.processedAt).toLocaleString('en-IN') : ''}</time></div>)}</div></details>}</section>
        <section className="admin-card p-5"><header className="order-section-heading"><div><h2>Private staff notes</h2><p>Never shown to the customer</p></div><Plus size={19} /></header><form onSubmit={addNote}><textarea className="admin-field__control min-h-24 w-full" maxLength={1000} value={staffNote} onChange={event => setStaffNote(event.target.value)} placeholder="Packing instruction, customer call result or internal follow-up" /><button type="submit" disabled={saving || !staffNote.trim()} className="admin-btn mt-3 w-full">Add private note</button></form><div className="order-staff-notes">{[...(order.staffNotes || [])].reverse().map((item, index) => <article key={`${item.date}-${index}`}><p>{item.text}</p><small>{item.author?.name || 'Staff'} · {item.date ? new Date(item.date).toLocaleString('en-IN') : ''}</small></article>)}{!order.staffNotes?.length && <p className="admin-note">No private notes yet.</p>}</div></section>
      </aside>
    </div>
    <ConfirmModal open={cancelOpen} title="Cancel this order?" message="The cancellation reason will be visible in the order history and inventory will be restored once." confirmLabel="Cancel order" onClose={() => setCancelOpen(false)} onConfirm={cancelOrder}><div className="grid gap-3"><label className="admin-field">Cancellation reason<select className="admin-field__control" required value={cancelReason} onChange={event => setCancelReason(event.target.value)}><option value="">Select a reason</option><option value="CUSTOMER_REQUEST">Customer requested cancellation</option><option value="OUT_OF_STOCK">Item unavailable</option><option value="ADDRESS_UNSERVICEABLE">Address not serviceable</option><option value="PAYMENT_PROBLEM">Payment problem</option><option value="DUPLICATE_ORDER">Duplicate order</option><option value="OTHER">Other</option></select></label><label className="admin-field">Staff note<textarea className="admin-field__control min-h-24" maxLength={300} value={cancelComment} onChange={event => setCancelComment(event.target.value)} placeholder="Optional context for the timeline and audit log" /></label></div></ConfirmModal>
    <ConfirmModal open={codOpen} title="Record COD collection" message="Confirm that cash was collected after delivery. This creates a permanent payment event." confirmLabel="Record payment" onClose={() => setCodOpen(false)} onConfirm={collectCod}><div className="grid gap-3"><label className="admin-field">Receipt/reference (optional)<input className="admin-field__control" value={codForm.reference} onChange={event => setCodForm(value => ({ ...value, reference: event.target.value }))} /></label><label className="admin-field">Collection note<textarea className="admin-field__control min-h-20" value={codForm.note} onChange={event => setCodForm(value => ({ ...value, note: event.target.value }))} /></label></div></ConfirmModal>
    <ConfirmModal open={refundOpen} title="Record COD refund" message="Use this after the return refund is completed. It records money already returned; it does not transfer funds." confirmLabel="Record refund" onClose={() => setRefundOpen(false)} onConfirm={recordRefund}><div className="grid gap-3"><label className="admin-field">Refund amount<input type="number" min="0.01" step="0.01" className="admin-field__control" value={refundForm.amount} onChange={event => setRefundForm(value => ({ ...value, amount: event.target.value }))} /></label><label className="admin-field">Receipt/reference (optional)<input className="admin-field__control" maxLength={120} value={refundForm.reference} onChange={event => setRefundForm(value => ({ ...value, reference: event.target.value }))} /></label><label className="admin-field">Refund note<textarea className="admin-field__control min-h-20" maxLength={500} value={refundForm.note} onChange={event => setRefundForm(value => ({ ...value, note: event.target.value }))} /></label></div></ConfirmModal>
    <ConfirmModal open={Boolean(manualRefundTarget)} title="Record completed manual refund" message={`Confirm that ₹${Number(manualRefundTarget?.amount || 0).toLocaleString('en-IN')} was actually returned to the customer. This records financial history; it does not transfer money.`} confirmLabel="Record refund" onClose={() => setManualRefundTarget(null)} onConfirm={recordManualResolutionRefund}><div className="grid gap-3"><label className="admin-field">Bank / UPI / receipt reference<input required className="admin-field__control" maxLength={120} value={manualRefundForm.reference} onChange={event => setManualRefundForm(value => ({ ...value, reference: event.target.value }))} /></label><label className="admin-field">Refund note<textarea required className="admin-field__control min-h-20" maxLength={500} value={manualRefundForm.note} onChange={event => setManualRefundForm(value => ({ ...value, note: event.target.value }))} /></label></div></ConfirmModal>
  </section>;
}

function Row({ label, value }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
function addressText(address) { return [address.fullName, address.houseNo, address.area, address.landmark, address.city, address.state, address.pincode, address.mobile].filter(Boolean).join(', '); }
async function copy(value, notify) { try { await navigator.clipboard.writeText(String(value || '')); notify('Copied to clipboard.'); } catch { notify('Could not copy automatically. Select and copy the value manually.'); } }

function PackingVerification({ order, apiBase, busy, onChanged, onMessage }) {
  const [form, setForm] = useState({ sealId: order.packageVerification?.sealId || '', securityTagId: order.packageVerification?.securityTagId || '', dispatchWeightGrams: order.packageVerification?.dispatchWeightGrams || '', items: (order.orderItems || []).map((item, index) => ({ orderItemId: String(item._id || item.orderItemId || `line-${index}`), uniqueItemIds: item.uniqueItemIds || [] })) });
  const [files, setFiles] = useState([]);
  const [labels, setLabels] = useState([]);
  const [working, setWorking] = useState(false);
  const required = order.packageVerification?.status === 'PENDING';
  useEffect(() => {
    setForm(current => ({
      ...current,
      sealId: order.packageVerification?.sealId || current.sealId,
      securityTagId: order.packageVerification?.securityTagId || current.securityTagId,
      dispatchWeightGrams: order.packageVerification?.dispatchWeightGrams || current.dispatchWeightGrams,
      items: (order.orderItems || []).map((item, index) => ({ orderItemId: String(item._id || item.orderItemId || `line-${index}`), uniqueItemIds: item.uniqueItemIds || [] })),
    }));
  }, [order]);
  const generate = async () => {
    if (working || busy) return; setWorking(true); onMessage('');
    try { const result = await api.post(`${apiBase}/orders/${order._id}/item-identities/generate`, {}); setLabels(result.items || []); await onChanged(); onMessage('Unique item labels are ready. Print or scan them before sealing the parcel.'); }
    catch (error) { onMessage(error.message); } finally { setWorking(false); }
  };
  const printLabels = () => {
    const popup = window.open('', '_blank', 'width=900,height=700');
    if (!popup) { onMessage('Allow pop-ups once to print the item labels.'); return; }
    popup.opener = null;
    const cards = labels.map(label => `<article><img src="${label.barcodeDataUrl}" alt=""><strong>${label.uniqueItemId}</strong></article>`).join('');
    popup.document.write(`<html><head><title>Item labels</title><style>body{font-family:Arial,sans-serif;display:grid;grid-template-columns:repeat(2,1fr);gap:16px;padding:20px}article{border:1px dashed #777;padding:14px;text-align:center;break-inside:avoid}img{max-width:100%;height:auto}strong{display:block;margin-top:6px;font-size:12px}@media print{body{padding:0}}</style></head><body>${cards}<script>window.onload=()=>window.print()</script></body></html>`);
    popup.document.close();
  };
  const setIds = (orderItemId, value) => setForm(current => ({ ...current, items: current.items.map(item => item.orderItemId === orderItemId ? { ...item, uniqueItemIds: value.split(/[\s,]+/).map(entry => entry.trim().toUpperCase()).filter(Boolean) } : item) }));
  const verify = async event => {
    event.preventDefault(); if (working || busy) return; setWorking(true); onMessage('');
    try {
      let evidence = [];
      if (files.length) { const uploaded = await api.upload(`${apiBase}/orders/evidence/uploads`, files, { fieldName: 'files' }); evidence = (uploaded.files || []).map(file => ({ ...file, type: String(file.mimeType || '').startsWith('video/') ? 'PACKING_VIDEO' : 'PRODUCT_PHOTO' })); }
      await api.post(`${apiBase}/orders/${order._id}/packing/verify`, { ...form, dispatchWeightGrams: Number(form.dispatchWeightGrams) || undefined, evidence });
      setFiles([]); onMessage('Packing verification completed. The order can now move to Packed.'); await onChanged();
    } catch (error) { onMessage(error.message); } finally { setWorking(false); }
  };
  return <section className="admin-card p-5"><header className="order-section-heading"><div><h2>Packing verification</h2><p>{order.fraudProtectionSnapshot?.capturedAt ? 'Match every physical item before dispatch.' : 'Legacy order: verification can be added, but missing historical proof will not block fulfilment.'}</p></div><PackageCheck size={20} /></header>
    <div className="order-facts"><Row label="Verification" value={order.packageVerification?.status || 'Legacy order'} /><Row label="Seal" value={order.packageVerification?.sealId || 'Not assigned'} /><Row label="Security tag" value={order.packageVerification?.securityTagId || 'Not assigned'} /><Row label="Dispatch weight" value={order.packageVerification?.dispatchWeightGrams ? `${order.packageVerification.dispatchWeightGrams} g` : 'Not recorded'} /></div>
    {order.packageVerification?.status !== 'VERIFIED' && <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={verify}><div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2"><p className="admin-note">{required ? 'Required checks must pass before Mark packed.' : 'Optional protection is available for this order.'}</p><button type="button" className="admin-btn-ghost" disabled={working || busy} onClick={generate}>Generate item labels</button></div>
      {(order.orderItems || []).map((item, index) => { const orderItemId = String(item._id || item.orderItemId || `line-${index}`); const row = form.items.find(entry => entry.orderItemId === orderItemId); return <label className="admin-field sm:col-span-2" key={orderItemId}>{item.name || item.productName} · {Math.max(0, Number(item.quantity || 0) - Number(item.cancelledQuantity || 0))} unit(s)<input className="admin-field__control" value={(row?.uniqueItemIds || []).join(', ')} onChange={event => setIds(orderItemId, event.target.value)} placeholder="Scan or enter item IDs, separated by commas" /><small>{[item.sku && `SKU ${item.sku}`, item.size, item.color].filter(Boolean).join(' · ') || 'Standard item'}</small></label>; })}
      <label className="admin-field">Package seal ID<input className="admin-field__control" value={form.sealId} onChange={event => setForm(value => ({ ...value, sealId: event.target.value.toUpperCase() }))} placeholder="SC-SEAL-829184" /></label><label className="admin-field">Return security tag<input className="admin-field__control" value={form.securityTagId} onChange={event => setForm(value => ({ ...value, securityTagId: event.target.value.toUpperCase() }))} placeholder="TAG-SC-829184" /></label><label className="admin-field">Dispatch weight (grams)<input type="number" min="1" max="1000000" className="admin-field__control" value={form.dispatchWeightGrams} onChange={event => setForm(value => ({ ...value, dispatchWeightGrams: event.target.value }))} /></label><label className="admin-field">Packing evidence<input className="admin-field__control" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" multiple onChange={event => { setFiles(Array.from(event.target.files || []).slice(0, 8)); event.target.value = ''; }} /><small>{files.length ? `${files.length} file(s) selected` : 'Photos up to 20 MB, optimized below 100 KB; videos up to 50 MB.'}</small></label><button className="admin-btn sm:col-span-2" disabled={working || busy}>{working ? 'Verifying…' : 'Verify and seal package'}</button></form>}
    {labels.length > 0 && <details className="mt-4" open><summary className="cursor-pointer text-sm font-bold">Printable item labels ({labels.length})</summary><button type="button" className="admin-btn-ghost mt-3" onClick={printLabels}>Print all labels</button><div className="mt-3 flex flex-wrap gap-3">{labels.map(label => <article key={label.uniqueItemId} className="rounded-xl border border-slate-200 bg-white p-3"><img src={label.barcodeDataUrl} alt={`Barcode ${label.uniqueItemId}`} /><strong className="block text-center text-xs">{label.uniqueItemId}</strong><a className="admin-table-action-link mt-2 block text-center" href={label.barcodeDataUrl} download={`${label.uniqueItemId}.svg`}>Download label</a></article>)}</div></details>}
  </section>;
}
