import { useEffect, useRef, useState } from 'react';
import { Check, ExternalLink, Headphones, MapPin, RefreshCw, ShieldCheck, Star, Truck } from 'lucide-react';
import api from '../../services/api';
import Receipt from '../../components/order/Receipt';
import DeliveryTracking from '../../components/order/DeliveryTracking';
import ReceiptActions from '../../components/order/ReceiptActions';
import ReviewModal from '../../components/product/ReviewModal';
import ReturnRequestForm from '../../components/order/ReturnRequestForm';
import { OrderItem, OrderModal, OrderShell, OrderState, StatusBadge } from '../../components/order/OrderUi';
import { canCancelOrder, canCancelOrderItem, productIdOf } from '../../utils/orderActions';
import { money, orderCode, orderDate, paymentLabel, paymentNote, priceLines } from '../../utils/orderPresentation';

export default function OrderDetail({ route = '', navigate }) {
  const orderId = new URLSearchParams(route.split('?')[1] || '').get('id');
  const scopeRef = useRef({ orderId, active: true, pending: false });
  if (scopeRef.current.orderId !== orderId) scopeRef.current = { orderId, active: true, pending: false };
  const scope = scopeRef.current;
  const isCurrent = () => scopeRef.current === scope && scope.active;
  useEffect(() => {
    scope.active = true;
    return () => { scope.active = false; };
  }, [scope]);
  const [order, setOrder] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [returns, setReturns] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [receiptError, setReceiptError] = useState('');
  const [returnError, setReturnError] = useState('');
  const [reload, setReload] = useState(0);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelComment, setCancelComment] = useState('');
  const [itemCancellation, setItemCancellation] = useState(null);
  const [returnItem, setReturnItem] = useState(null);
  const [reviewItem, setReviewItem] = useState(null);
  const [existingReview, setExistingReview] = useState(null);
  const [verificationOtp, setVerificationOtp] = useState('');
  const [verificationMessage, setVerificationMessage] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setOrder(null); setReturns(null); setReceipt(null); setReturnError(''); setReceiptError('');
    setCancelOpen(false); setItemCancellation(null); setReturnItem(null); setReviewItem(null); setActionError('');
    setBusy(false); setNotice(''); setCancelReason(''); setExistingReview(null);
    setInvoiceOpen(false);
    if (!orderId) { setError('Order not found.'); setLoading(false); return undefined; }
    const cacheOptions = { cacheFirst: true, cacheScope: orderId, forceRefetch: reload > 0 };
    api.get(`/orders/${orderId}`, cacheOptions).then((data) => { if (active) setOrder(data); })
      .catch((err) => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
    api.get(`/orders/${orderId}/receipt`, cacheOptions).then((data) => { if (active) setReceipt(data); }).catch((err) => { if (active) setReceiptError(err.message); });
    api.get(`/returns/order/${orderId}`, cacheOptions).then((data) => { if (active) setReturns(data); }).catch((err) => { if (active) setReturnError(err.message); });
    return () => { active = false; };
  }, [orderId, reload]);
  const refresh = () => setReload((value) => value + 1);
  const help = () => navigate(`/contact?order=${encodeURIComponent(orderId)}`);
  const cancel = async (event) => {
    event.preventDefault(); if (scope.pending || !isCurrent() || !canCancelOrder(order)) return;
    scope.pending = true;
    setBusy(true); setActionError('');
    try { await api.post(`/orders/${orderId}/cancel`, { reason: cancelReason, comment: cancelComment.trim() }); if (!isCurrent()) return; setCancelOpen(false); setCancelComment(''); setNotice('Your order has been cancelled.'); refresh(); }
    catch (err) { if (isCurrent()) setActionError(err.message); } finally { scope.pending = false; if (isCurrent()) setBusy(false); }
  };
  const cancelItem = async (event) => {
    event.preventDefault();
    if (scope.pending || !isCurrent() || !itemCancellation?.item || !canCancelOrderItem(order, itemCancellation.item)) return;
    scope.pending = true; setBusy(true); setActionError('');
    try {
      await api.post(`/orders/${orderId}/items/${itemCancellation.item._id}/cancel`, {
        quantity: Number(itemCancellation.quantity), reasonCode: itemCancellation.reasonCode,
        comment: itemCancellation.comment, operationId: itemCancellation.operationId,
      });
      if (!isCurrent()) return;
      setItemCancellation(null); setNotice('Selected item quantity has been cancelled. Refund progress is shown in payment details.'); refresh();
    } catch (err) { if (isCurrent()) setActionError(err.message); }
    finally { scope.pending = false; if (isCurrent()) setBusy(false); }
  };
  const submitReturn = async (form) => {
    if (scope.pending || !isCurrent()) return;
    scope.pending = true;
    setBusy(true); setActionError('');
    try {
      await api.post('/returns', { ...form, order: orderId, product: productIdOf(returnItem), orderItemId: returnItem._id, variantId: returnItem.variantId, size: returnItem.size, color: returnItem.color });
      if (!isCurrent()) return;
      setReturnItem(null); setNotice(`${form.type === 'exchange' ? 'Exchange' : 'Return'} request submitted. You can follow its progress below.`); refresh();
    } catch (err) { if (isCurrent()) setActionError(err.message); } finally { scope.pending = false; if (isCurrent()) setBusy(false); }
  };
  const cancelReturn = async (request) => {
    if (scope.pending || !isCurrent() || request.status !== 'Requested') return;
    scope.pending = true; setBusy(true); setActionError('');
    try { await api.patch(`/returns/${request._id}/cancel`, { comment: 'Cancelled by customer before approval.' }); if (!isCurrent()) return; setNotice('Your return request has been cancelled.'); refresh(); }
    catch (err) { if (isCurrent()) setActionError(err.message); }
    finally { scope.pending = false; if (isCurrent()) setBusy(false); }
  };
  const openReview = async (item) => {
    if (scope.pending || !isCurrent() || !productIdOf(item)) return;
    scope.pending = true;
    setBusy(true); setActionError('');
    try {
      const eligibility = await api.get(`/reviews/${productIdOf(item)}/eligibility`);
      if (!isCurrent()) return;
      if (!eligibility.canReview) { setActionError(eligibility.message || 'Reviews are available after delivery.'); return; }
      setExistingReview(eligibility.existingReview || null); setReviewItem(item);
    } catch (err) { if (isCurrent()) setActionError(err.message); } finally { scope.pending = false; if (isCurrent()) setBusy(false); }
  };
  const saveReview = async (payload) => {
    const result = existingReview?._id ? await api.put(`/reviews/${existingReview._id}`, payload) : await api.post(`/reviews/${productIdOf(reviewItem)}`, payload);
    return { ...result, message: result.isVisible === false ? 'Your review is awaiting moderation.' : 'Your review has been saved.' };
  };
  const verifyCod = async (event) => {
    event.preventDefault();
    if (scope.pending || !/^\d{6}$/.test(verificationOtp)) return;
    scope.pending = true; setBusy(true); setVerificationMessage('');
    try { const updated = await api.post(`/orders/${orderId}/cod-verification/verify`, { otp: verificationOtp }); if (isCurrent()) { setOrder(updated); setVerificationOtp(''); setNotice('Your COD order is confirmed.'); } }
    catch (err) { if (isCurrent()) setVerificationMessage(err.message); }
    finally { scope.pending = false; if (isCurrent()) setBusy(false); }
  };
  const resendCod = async () => {
    if (scope.pending) return;
    scope.pending = true; setBusy(true); setVerificationMessage('');
    try { const result = await api.post(`/orders/${orderId}/cod-verification/send`, {}); if (isCurrent()) setVerificationMessage(result.demoOtp ? `Demo code: ${result.demoOtp}` : 'A new code has been sent to your registered mobile number.'); }
    catch (err) { if (isCurrent()) setVerificationMessage(err.message); }
    finally { scope.pending = false; if (isCurrent()) setBusy(false); }
  };
  const canReview = order && ['Delivered', 'Return Requested', 'Exchange Requested', 'Returned', 'Refunded'].includes(order.orderStatus);
  const events = [...(order?.statusTimeline || [])];
  const activeReturnEligibility = returns?.items?.find((entry) => entry.orderItemId === String(returnItem?._id));
  return <OrderShell title={order ? `Order #${orderCode(order)}` : 'Order details'} detail navigate={navigate}>
    {loading ? <OrderState loading /> : error ? <OrderState title="Unable to open this order" error={error} retry={orderId ? refresh : undefined}><button className="sc-orders__text" onClick={() => navigate('/orders')}>Back to orders</button></OrderState> : order && <>
      <div className="sc-order-detail__top"><p>Placed on {orderDate(order.createdAt, true) || 'date unavailable'}</p><button className="sc-orders__text" onClick={refresh} disabled={busy}><RefreshCw size={15} />Refresh status</button></div>
      {notice && <p role="status" className="sc-orders__notice"><Check size={17} />{notice}</p>}
      {actionError && !cancelOpen && !itemCancellation && !returnItem && <p role="alert" className="sc-orders__error">{actionError}</p>}
      {order.codVerification?.required && order.codVerification.status === 'PENDING' && <section className="sc-order-panel sc-order-verification"><header><ShieldCheck size={20} /><h2>Confirm your COD order</h2></header><p>Enter the one-time code sent to your registered mobile number before we prepare this parcel.</p><form onSubmit={verifyCod}><input aria-label="6-digit COD verification code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={verificationOtp} onChange={event => setVerificationOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code" /><button className="sc-orders__button" disabled={busy || verificationOtp.length !== 6}>{busy ? 'Checking…' : 'Verify order'}</button></form><button type="button" className="sc-orders__text" onClick={resendCod} disabled={busy}>Resend code</button>{verificationMessage && <p role="status" className="sc-orders__muted">{verificationMessage}</p>}</section>}
      <div className="sc-order-detail__grid"><div className="sc-order-detail__primary">
        <section className="sc-order-panel"><header><Truck size={20} /><h2>Order & delivery status</h2><StatusBadge status={order.orderStatus} /></header>
          {order.rto?.status && order.rto.status !== 'NONE' && <div className="sc-orders__error" role="status"><strong>Return to origin: {String(order.rto.status).replaceAll('_', ' ').toLowerCase()}</strong><p>{order.rto.reason || order.rto.notes || 'The courier is returning this parcel to the store. Refund updates will appear here when applicable.'}</p>{order.paymentMethod !== 'COD' && order.rto.refundStatus && <p>Refund: {String(order.rto.refundStatus).replaceAll('_', ' ').toLowerCase()}{order.rto.refundAmount !== undefined ? ` · ${money(order.rto.refundAmount)}` : ''}{Number(order.rto.refundDeduction || 0) > 0 ? ` after a ${money(order.rto.refundDeduction)} policy deduction` : ''}.</p>}</div>}
          <ol className="sc-order-timeline">{events.length ? events.map((entry, index) => <li key={index} className={index === events.length - 1 ? 'is-current' : ''}><span className="sc-order-timeline__dot" /><div><h3>{entry.status}</h3>{entry.date && <time>{orderDate(entry.date, true)}</time>}{entry.note && <p>{entry.note}</p>}</div></li>) : <li><span className="sc-order-timeline__dot" /><div><h3>{order.orderStatus}</h3><p>Detailed updates will appear here when available.</p></div></li>}</ol>
          {(order.shipment || !['Delivered', 'Cancelled', 'Returned', 'Refunded'].includes(order.orderStatus)) && <DeliveryTracking key={orderId} orderId={orderId} initialShipment={order.shipment} onUpdate={data => setOrder(current => current && ({ ...current, ...(data.order || {}), shipment: data.shipment || current.shipment }))} />}
          <div className="sc-order-panel__actions">{canCancelOrder(order) && <button className="sc-orders__outline" disabled={busy} onClick={() => { setActionError(''); setCancelReason(''); setCancelComment(''); setCancelOpen(true); }}>Cancel order</button>}<button className="sc-orders__outline" onClick={help}><Headphones size={16} />Need help?</button></div>
        </section>
        <section className="sc-order-panel"><header><h2>Items in this order</h2><span>{order.orderItems?.reduce((sum, item) => sum + Math.max(0, Number(item.quantity || 0) - Number(item.cancelledQuantity || 0)), 0)} active items</span></header>
          <div className="sc-order-detail__items">{(order.orderItems || []).map((item, index) => {
            const eligibility = returns?.items?.find((entry) => entry.orderItemId === String(item._id));
            return <OrderItem key={item._id || index} item={item}>
              <div className="sc-order-item__actions">{eligibility?.canRequest && <button className="sc-orders__text" disabled={busy} onClick={() => { setActionError(''); setReturnItem(item); }}>Return / exchange</button>}
                {canCancelOrderItem(order, item) && <button className="sc-orders__text" disabled={busy} onClick={() => { const active = Math.max(1, Number(item.quantity || 1) - Number(item.cancelledQuantity || 0)); setActionError(''); setItemCancellation({ item, quantity: active, reasonCode: '', comment: '', operationId: window.crypto?.randomUUID?.() || `cancel_${Date.now()}_${Math.random().toString(36).slice(2)}` }); }}>Cancel item</button>}
                {canReview && productIdOf(item) && <button className="sc-orders__text" disabled={busy} onClick={() => openReview(item)}><Star size={14} />Rate & review</button>}
                {productIdOf(item) && <button className="sc-orders__text" onClick={() => navigate(`/product?id=${encodeURIComponent(productIdOf(item))}`)}>View product</button>}</div>
              {eligibility && !eligibility.canRequest && <p className="sc-orders__muted">{eligibility.reason}</p>}
            </OrderItem>;
          })}</div>
          {returnError ? <div role="alert" className="sc-orders__error">Return eligibility could not be loaded. <button className="sc-orders__text" onClick={refresh}>Try again</button></div> : !returns ? <p role="status" className="sc-orders__muted">Checking return eligibility...</p> : returns.windowDays === null ? <p className="sc-orders__muted">Eligible products do not have a store-wide return deadline.</p> : returns.deadline && <p className="sc-orders__muted">Return / exchange window: {returns.windowDays} days from delivery, until {orderDate(returns.deadline)}.</p>}
          <button className="sc-orders__text" onClick={() => navigate('/return-policy')}>Read return policy<ChevronRightIcon /></button>
        </section>
        {returns?.requests?.length > 0 && <section className="sc-order-panel"><header><h2>Returns & exchanges</h2></header>{returns.requests.map((request) => {
          const item = order.orderItems.find((entry) => String(entry._id) === request.orderItemId);
          const difference = Number(request.financial?.exchangePriceDifference || 0);
          const adjustmentStatus = String(request.financial?.exchangeAdjustmentStatus || 'NOT_REQUIRED');
          return <article className="sc-order-return" key={request._id}><div><h3>{item?.name || 'Order item'} · {request.type === 'exchange' ? 'Exchange' : 'Return'}</h3><span className="sc-order-status sc-order-status--return">{request.status}</span></div><p>{request.quantity} unit(s) · {request.reason}</p><p>Requested {orderDate(request.createdAt, true)}</p>{request.exchangeSize && <p>Replacement: {request.exchangeSize} {request.exchangeColor}</p>}{difference !== 0 && <p><strong>{difference > 0 ? `Price difference to pay: ${money(difference)}` : `Exchange credit: ${money(Math.abs(difference))}`}</strong> · {adjustmentStatus.replaceAll('_', ' ').toLowerCase()}</p>}{difference > 0 && request.financial?.exchangePaymentLinkUrl && adjustmentStatus !== 'SETTLED' && <a className="sc-orders__button" href={request.financial.exchangePaymentLinkUrl} target="_blank" rel="noreferrer">Pay securely <ExternalLink size={15} /></a>}{request.financial?.exchangeAdjustmentLastError && <p className="sc-orders__error">{request.financial.exchangeAdjustmentLastError}</p>}{request.pickupScheduledAt && <p>Pickup scheduled {orderDate(request.pickupScheduledAt)}</p>}{request.adminComment && <p>{request.adminComment}</p>}<p className="sc-orders__muted">Request #{String(request.caseNumber || request._id).toUpperCase()}</p>{request.status === 'Requested' && <button type="button" className="sc-orders__outline" disabled={busy} onClick={() => cancelReturn(request)}>Cancel request</button>}{request.shipment && <DeliveryTracking returnId={request._id} />}{request.replacementShipment && <DeliveryTracking returnId={request._id} replacement />}</article>;
        })}</section>}
      </div><aside className="sc-order-detail__aside">
        <section className="sc-order-panel"><header><h2>Price details</h2></header><dl className="sc-order-prices">{priceLines(order).map(([label, value]) => <div key={label} className={value < 0 ? 'is-saving' : ''}><dt>{label}{label === 'Coupon discount' && order.coupon?.code ? ` (${order.coupon.code})` : ''}</dt><dd>{label === 'Delivery charge' && Number(value) === 0 ? 'FREE' : money(value)}</dd></div>)}<div className="sc-order-prices__total"><dt>{Number(order.cancellationAdjustment) > 0 ? 'Adjusted order total' : 'Order total'}</dt><dd>{money(order.adjustedFinalAmount ?? order.finalAmount)}</dd></div></dl>{Number(order.taxAmount) > 0 && <p className="sc-orders__muted">Includes {money(order.taxAmount)} GST{order.taxRate ? ` (${order.taxRate}%)` : ''}.</p>}
          <div className="sc-order-payment"><p><strong>{paymentLabel(order)}</strong></p><p>{order.paymentMethod === 'COD' ? 'Cash on delivery' : order.paymentMethod || 'Online payment'}</p>{order.razorpayPaymentId && <p className="sc-orders__muted">Transaction: {order.razorpayPaymentId}</p>}{paymentNote(order) && <p>{paymentNote(order)}</p>}{order.cancellationRefund?.status && order.cancellationRefund.status !== 'NOT_REQUIRED' && <p>{cancellationRefundMessage(order.cancellationRefund)}</p>}{(order.itemCancellationRefunds || []).map(entry => <p key={entry.operationId}>Item cancellation refund {money(entry.amount)}: {String(entry.status || 'PENDING').replaceAll('_', ' ').toLowerCase()}.</p>)}</div>
          {receipt ? <ReceiptActions receipt={receipt} compact showShare={false} onPreview={() => setInvoiceOpen(true)} />
            : receiptError ? <div role="alert" className="sc-orders__error">Invoice unavailable. <button className="sc-orders__text" onClick={refresh}>Retry invoice</button></div> : <p role="status" className="sc-orders__muted">Loading invoice...</p>}
        </section>
        <section className="sc-order-panel"><header><MapPin size={18} /><h2>Delivery address</h2></header><DeliveryAddress address={order.shippingAddress} />{order.billingAddress && <details className="sc-order-billing"><summary>Billing address</summary><DeliveryAddress address={order.billingAddress} /></details>}</section>
        <section className="sc-order-panel sc-order-help"><Headphones size={22} /><h2>Here to help</h2><p>Questions about this delivery, a payment, or a return?</p><button className="sc-orders__text" onClick={help}>Contact us about this order<ChevronRightIcon /></button><p className="sc-orders__muted">Order ID: {order._id}</p>{order.invoiceNumber && <p className="sc-orders__muted">Invoice: {order.invoiceNumber}</p>}</section>
      </aside></div>
      {receipt && invoiceOpen && <OrderModal title="Invoice preview" onClose={() => setInvoiceOpen(false)} className="sc-order-modal--invoice"><div className="sc-invoice-preview"><ReceiptActions receipt={receipt} showShare={false} /><Receipt receipt={receipt} /></div></OrderModal>}
    </>}
    {cancelOpen && <OrderModal title="Cancel this order?" busy={busy} onClose={() => setCancelOpen(false)}><form className="sc-order-form" onSubmit={cancel}><p>This will cancel all items in this order.</p>{order.paymentStatus === 'Paid' && <p>Your refund will start automatically after cancellation and its status will appear in this order.</p>}<label>Reason for cancellation<select required disabled={busy} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)}><option value="">Select a reason</option><option value="ORDERED_BY_MISTAKE">Ordered by mistake</option><option value="CHANGE_SIZE_OR_ADDRESS">Need to change size or address</option><option value="DELIVERY_DELAY">Delivery is taking too long</option><option value="CHANGED_MIND">Changed my mind</option><option value="OTHER">Other</option></select></label><label>Additional note (optional)<textarea maxLength="500" value={cancelComment} onChange={event => setCancelComment(event.target.value)} /></label>{actionError && <p role="alert" className="sc-orders__error">{actionError}</p>}<div className="sc-order-form__actions"><button type="button" className="sc-orders__outline" disabled={busy} onClick={() => setCancelOpen(false)}>Keep order</button><button className="sc-orders__button" disabled={busy}>{busy ? 'Cancelling…' : 'Confirm cancellation'}</button></div></form></OrderModal>}
    {itemCancellation && <OrderModal title="Cancel selected item" busy={busy} onClose={() => setItemCancellation(null)}><form className="sc-order-form" onSubmit={cancelItem}><p><strong>{itemCancellation.item.name || itemCancellation.item.productName}</strong></p><p>The courier booking will be safely updated before this item is removed.</p><label>Quantity<input type="number" min="1" max={Math.max(1, Number(itemCancellation.item.quantity || 1) - Number(itemCancellation.item.cancelledQuantity || 0))} required disabled={busy} value={itemCancellation.quantity} onChange={event => setItemCancellation(current => ({ ...current, quantity: event.target.value }))} /></label><label>Reason<select required disabled={busy} value={itemCancellation.reasonCode} onChange={event => setItemCancellation(current => ({ ...current, reasonCode: event.target.value }))}><option value="">Select a reason</option><option value="ORDERED_BY_MISTAKE">Ordered by mistake</option><option value="CHANGE_SIZE">Need to change size</option><option value="CHANGE_ADDRESS">Need to change delivery address</option><option value="CHANGED_MIND">Changed my mind</option><option value="OTHER">Other</option></select></label><label>Additional note (optional)<textarea maxLength="500" value={itemCancellation.comment} onChange={event => setItemCancellation(current => ({ ...current, comment: event.target.value }))} /></label>{order.paymentStatus === 'Paid' && <p>The eligible amount will be refunded to the original payment method.</p>}{actionError && <p role="alert" className="sc-orders__error">{actionError}</p>}<div className="sc-order-form__actions"><button type="button" className="sc-orders__outline" disabled={busy} onClick={() => setItemCancellation(null)}>Keep item</button><button className="sc-orders__button" disabled={busy || !itemCancellation.reasonCode}>{busy ? 'Cancelling…' : 'Cancel item'}</button></div></form></OrderModal>}
    {returnItem && activeReturnEligibility && <OrderModal title="Return or exchange" busy={busy} onClose={() => setReturnItem(null)}><ReturnRequestForm item={returnItem} eligibility={activeReturnEligibility} paymentMethod={order?.paymentMethod} pickupAddress={order?.shippingAddress} onSubmit={submitReturn} busy={busy} error={actionError} onCancel={() => setReturnItem(null)} /></OrderModal>}
    <ReviewModal key={orderId} open={!!reviewItem} product={reviewItem ? { _id: productIdOf(reviewItem), name: reviewItem.name, images: [reviewItem.image].filter(Boolean) } : null} existingReview={existingReview} onClose={() => setReviewItem(null)} onSubmit={saveReview} />
  </OrderShell>;
}
function ChevronRightIcon() { return <span aria-hidden="true">&rsaquo;</span>; }
function cancellationRefundMessage(refund = {}) {
  if (refund.status === 'PROCESSED') return `Cancellation refund of ${money(refund.amount)} has been processed.`;
  if (refund.status === 'FAILED' || refund.status === 'MANUAL_REQUIRED') return 'Your order is cancelled and the refund needs store support. Please use Need help?';
  return `Cancellation refund of ${money(refund.amount)} is being processed.`;
}
function DeliveryAddress({ address }) {
  if (!address) return <p className="sc-orders__muted">Address information unavailable. Contact support for help.</p>;
  return <address className="sc-order-address"><strong>{address.fullName}</strong><p>{[address.houseNo || address.houseNumber, address.area].filter(Boolean).join(', ')}</p><p>{[address.city, address.state, address.pincode].filter(Boolean).join(', ')}</p>{address.landmark && <p>Landmark: {address.landmark}</p>}<p>Mobile: {address.mobile || address.phone || 'Not provided'}</p>{address.alternateMobile && <p>Alternate: {address.alternateMobile}</p>}</address>;
}
