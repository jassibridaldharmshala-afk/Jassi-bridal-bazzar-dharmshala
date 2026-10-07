import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCheck, ChevronDown, CircleAlert, Clock3, Copy, CreditCard, Download, FileText, Headphones, MapPin, Package, RefreshCw, ShoppingBag, Truck } from 'lucide-react';
import api from '../../services/api';
import { useStorefront } from '../../context/StorefrontContext';
import { OrderItem, OrderModal } from '../../components/order/OrderUi';
import Receipt from '../../components/order/Receipt';
import ReceiptActions from '../../components/order/ReceiptActions';
import { downloadReceiptPdf } from '../../utils/printReceipt';
import { invoiceAddress } from '../../utils/receiptData';
import { money, orderCode, orderDate, paymentLabel, paymentNote, priceLines } from '../../utils/orderPresentation';
import './OrderSuccess.css';

const steps = [
  { label: 'Order received', Icon: ShoppingBag },
  { label: 'Preparing', Icon: Package },
  { label: 'On the way', Icon: Truck },
  { label: 'Delivered', Icon: CheckCheck },
];
const stageIndex = { Pending: 0, Confirmed: 1, Packed: 1, Shipped: 2, 'Out for Delivery': 2, Delivered: 3 };
const deliveryNotes = {
  Pending: 'Your order is awaiting store confirmation. Follow its progress in your order details.',
  Confirmed: 'Your order is confirmed. Courier tracking will be available after dispatch.',
  Packed: 'Your order is packed. Courier tracking will be available after dispatch.',
  Shipped: 'Your order has been dispatched. Open tracking for the latest delivery updates.',
  'Out for Delivery': 'Your order is out for delivery. Open tracking for the latest courier updates.',
  Delivered: 'Your order has been delivered. You can review items and check return eligibility in your order details.',
};
const methods = { COD: 'Cash on delivery', UPI: 'UPI', CARD: 'Card', Card: 'Card', NETBANKING: 'Net banking', WALLET: 'Wallet', Razorpay: 'Online payment' };

function confirmationState(order) {
  const payment = paymentLabel(order);
  if (order.orderStatus === 'Cancelled') return { tone: 'neutral', label: 'Order cancelled', title: 'This order was cancelled', message: paymentNote(order) || 'You can view this order and its payment history in My orders.' };
  if (/Return|Refund|Exchange/.test(order.orderStatus || '') || /refunded/i.test(payment)) return { tone: 'neutral', label: order.orderStatus || payment, title: 'Your order has an update', message: paymentNote(order) || 'Open your order details to follow its latest status and any return or refund updates.' };
  if (payment === 'Payment failed') return { tone: 'warning', label: 'Payment unsuccessful', title: 'Your payment needs attention', message: order.paymentFailureReason || 'Payment was not completed. Contact support if your account was debited before making another payment.' };
  if (payment === 'Awaiting payment confirmation') return { tone: 'warning', label: 'Checking payment', title: 'Your payment is being confirmed', message: 'Your order is saved, but payment is not confirmed yet. Refresh the status to check before making another payment.' };
  if (order.orderStatus === 'Delivered') return { tone: 'success', label: 'Delivered', title: 'Your order has arrived', message: deliveryNotes.Delivered };
  if (['Shipped', 'Out for Delivery'].includes(order.orderStatus)) return { tone: 'success', label: order.orderStatus === 'Shipped' ? 'Dispatched' : 'Out for delivery', title: 'Your order is on its way', message: deliveryNotes[order.orderStatus] };
  if (Object.prototype.hasOwnProperty.call(stageIndex, order.orderStatus)) return { tone: 'success', label: order.orderStatus === 'Pending' ? 'Order received' : 'Order confirmed', title: 'Thank you for your order!', message: 'Your order has been saved. All your items, payment details and delivery updates are right here.' };
  return { tone: 'neutral', label: 'Order details', title: 'Your order is saved', message: 'Open your order details for the latest status.' };
}

export default function OrderSuccess({ navigate, route = '' }) {
  const orderId = new URLSearchParams(route.split('?')[1] || '').get('id') || '';
  // Keep an old request or open invoice from leaking into a different order.
  return <OrderConfirmation key={orderId} orderId={orderId} navigate={navigate} />;
}

function OrderConfirmation({ orderId, navigate }) {
  const { storeSlug, isHostStore } = useStorefront();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [receipt, setReceipt] = useState(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceError, setInvoiceError] = useState('');
  const [invoiceBusy, setInvoiceBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [copyError, setCopyError] = useState('');
  const active = useRef(false);
  const invoiceLock = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    let current = true;
    setLoading(true); setError(''); setReceipt(null); setInvoiceError('');
    if (!orderId) { setError('This link is missing an order number. Open My orders to find your purchase.'); setLoading(false); return undefined; }
    api.get(`/orders/${encodeURIComponent(orderId)}`, { cacheFirst: true, cacheScope: orderId, forceRefetch: reload > 0 }).then((data) => {
      if (!data?._id || String(data._id) !== orderId || !Array.isArray(data.orderItems)) throw new Error('The order details could not be loaded. Please try again.');
      if (current) setOrder(data);
    }).catch((err) => { if (current) setError(err.message || 'Unable to load your order. Please try again.'); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [orderId, reload]);

  const openOrder = () => navigate(`/order-detail?id=${encodeURIComponent(orderId)}`);
  const shop = () => navigate(storeSlug && !isHostStore ? `/store/${encodeURIComponent(storeSlug)}/products` : '/products');
  const refresh = () => setReload((value) => value + 1);
  const invoiceAction = async (action) => {
    if (invoiceLock.current) return;
    invoiceLock.current = true; setInvoiceBusy(action); setInvoiceError('');
    try {
      const data = receipt || await api.get(`/orders/${encodeURIComponent(orderId)}/receipt`, { cacheFirst: true, cacheScope: orderId });
      if (!active.current) return;
      if (String(data?.orderId || '') !== orderId || !Array.isArray(data.items) || !data.items.length) throw new Error('The invoice could not be loaded. Please try again.');
      setReceipt(data);
      if (action === 'download') {
        await downloadReceiptPdf(data);
        if (active.current) setNotice('Your invoice PDF is ready. Check your downloads.');
      } else setInvoiceOpen(true);
    } catch (err) { if (active.current) setInvoiceError(err.message || 'Unable to prepare your invoice. Please try again.'); }
    finally { invoiceLock.current = false; if (active.current) setInvoiceBusy(''); }
  };
  const copyOrder = async () => {
    setCopyError('');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Copy is unavailable. You can select the order number above.');
      await navigator.clipboard.writeText(orderCode(order));
      if (active.current) setNotice('Order number copied.');
    } catch (err) { if (active.current) setCopyError(err.message || 'Unable to copy the order number.'); }
  };

  if (loading || error || !order) return <section className="sc-confirmation"><div className="sc-confirmation__state" role={loading ? 'status' : 'alert'}>
    {loading ? <Package size={36} /> : <CircleAlert size={36} />}
    <h1>{loading ? 'Finding your order…' : 'We couldn’t open this order'}</h1>
    <p>{loading ? 'Please wait while we check your order details.' : error || 'Your order details are unavailable.'}</p>
    {!loading && <div className="sc-confirmation__actions">{orderId && <button className="sc-confirmation__button" onClick={refresh}>Try again</button>}<button className="sc-confirmation__button sc-confirmation__button--outline" onClick={() => navigate('/orders')}>My orders</button></div>}
  </div></section>;

  const state = confirmationState(order);
  const StatusIcon = state.tone === 'success' ? Check : state.tone === 'warning' ? CircleAlert : FileText;
  const payment = paymentLabel(order);
  const paymentDescription = paymentNote(order);
  const paymentPending = payment === 'Awaiting payment confirmation';
  const collectionUnrecorded = payment === 'Payment due on delivery' && (Boolean(order.deliveredAt) || ['Delivered', 'Return Requested', 'Exchange Requested', 'Returned'].includes(order.orderStatus));
  const codDue = payment === 'Payment due on delivery' && !collectionUnrecorded;
  const currentStep = state.tone === 'success' ? stageIndex[order.orderStatus] : undefined;
  const items = order.orderItems;
  const itemCount = items.reduce((total, item) => total + (Number(item.quantity) || 0), 0);
  const address = invoiceAddress(order.shippingAddress);
  const billing = invoiceAddress(order.billingAddress);
  const savings = ['productDiscount', 'couponDiscount', 'prepaidDiscount'].reduce((total, key) => total + Math.max(0, Number(order[key]) || 0), 0);

  return <section className="sc-confirmation">
    <div className="sc-confirmation__shell">
      <nav className="sc-confirmation__nav" aria-label="Order navigation"><button onClick={() => navigate('/orders')}><ArrowLeft size={16} />My orders</button><span>Your order</span></nav>
      <header className={`sc-confirmation__hero sc-confirmation__hero--${state.tone}`}>
        <div className="sc-confirmation__welcome"><span className="sc-confirmation__seal"><StatusIcon size={32} strokeWidth={1.6} /></span><div><p className="sc-confirmation__eyebrow">{state.label}</p><h1>{state.title}</h1><p className="sc-confirmation__intro">{state.message}</p><p className="sc-confirmation__quick-facts"><strong>{money(order.finalAmount)}</strong><span aria-hidden="true">·</span><span>{methods[order.paymentMethod] || order.paymentMethod || 'Payment details below'}</span></p></div></div>
        <div className="sc-confirmation__actions">
          <button className="sc-confirmation__button" onClick={openOrder}>{currentStep !== undefined && currentStep < 3 ? 'Track order' : 'View order details'}<ArrowRight size={17} /></button>
          <button className="sc-confirmation__button sc-confirmation__button--outline" onClick={shop}>Continue shopping</button>
        </div>
        <div className="sc-confirmation__meta"><div><span>Order</span><strong>#{orderCode(order)}</strong><button aria-label="Copy order number" title="Copy order number" onClick={copyOrder}><Copy size={15} /></button></div><p>{orderDate(order.createdAt, true) ? `Placed on ${orderDate(order.createdAt, true)}` : 'Order date unavailable'}</p><button className="sc-confirmation__link" disabled={!!invoiceBusy} onClick={refresh}><RefreshCw size={14} />Refresh status</button></div>
      </header>
      {notice && <p className="sc-confirmation__notice" role="status"><Check size={16} />{notice}</p>}
      {copyError && <p className="sc-confirmation__error" role="alert">{copyError}</p>}

      {currentStep !== undefined && <section className="sc-confirmation__progress" aria-label="Delivery progress">
        <ol>{steps.map(({ label, Icon }, index) => <li key={label} className={index <= currentStep ? 'is-reached' : ''} aria-current={index === currentStep ? 'step' : undefined}><span className="sc-confirmation__step-icon">{index < currentStep ? <Check size={17} /> : <Icon size={18} />}</span><span>{label}</span><span className="sr-only">{index < currentStep ? ' — completed' : index === currentStep ? ' — current step' : ' — upcoming'}</span></li>)}</ol>
        <p><Clock3 size={15} />{deliveryNotes[order.orderStatus]}</p>
      </section>}

      <div className="sc-confirmation__grid">
        <div className="sc-confirmation__main">
          <section className="sc-confirmation__panel" aria-labelledby="confirmation-items"><header><div><ShoppingBag size={19} /><h2 id="confirmation-items">Your order at a glance</h2></div><span>{itemCount} {itemCount === 1 ? 'item' : 'items'}</span></header>
            <div className="sc-confirmation__items">{items.slice(0, 3).map((item, index) => <OrderItem key={item._id || index} item={item} />)}
              {items.length > 3 && <details className="sc-confirmation__more"><summary>View {items.length - 3} more {items.length - 3 === 1 ? 'product' : 'products'}<ChevronDown size={16} /></summary>{items.slice(3).map((item, index) => <OrderItem key={item._id || index} item={item} />)}</details>}
              {!items.length && <p className="sc-confirmation__muted">Item details are unavailable. Please contact support with your order number.</p>}
            </div>
            <footer className="sc-confirmation__item-footer"><p>Manage your items and check available order actions.</p><button className="sc-confirmation__link" onClick={openOrder}>Order details<ArrowRight size={15} /></button></footer>
          </section>

          <section className="sc-confirmation__panel" aria-labelledby="confirmation-address"><header><div><MapPin size={19} /><h2 id="confirmation-address">Delivery address</h2></div>{(order.shippingAddress?.addressType || order.shippingAddress?.type) && <span className="sc-confirmation__tag">{order.shippingAddress.addressType || order.shippingAddress.type}</span>}</header>
            <address className="sc-confirmation__address">{address.length ? address.map((line, index) => <p key={index}>{index === 0 ? <strong>{line}</strong> : line}</p>) : <p>Delivery address unavailable. Contact support for help.</p>}</address>
            {billing.length > 0 && JSON.stringify(billing) !== JSON.stringify(address) && <details className="sc-confirmation__billing"><summary>Billing address</summary><address>{billing.map((line, index) => <p key={index}>{line}</p>)}</address></details>}
          </section>
        </div>

        <aside className="sc-confirmation__aside" aria-label="Payment and order help">
          <section className="sc-confirmation__panel sc-confirmation__payment" aria-labelledby="confirmation-payment"><header><div><CreditCard size={19} /><h2 id="confirmation-payment">Payment summary</h2></div></header>
            <div className="sc-confirmation__total"><span>Order total</span><strong>{money(order.finalAmount)}</strong></div>
            <div className={`sc-confirmation__payment-status${payment === 'Paid' ? ' is-paid' : ''}`}><span>{payment === 'Paid' ? <Check size={16} /> : codDue || paymentPending ? <Clock3 size={16} /> : <CreditCard size={16} />}{collectionUnrecorded ? 'Payment collection not recorded' : payment}</span><p>{methods[order.paymentMethod] || order.paymentMethod || 'Payment method unavailable'}</p></div>
            {codDue && <p className="sc-confirmation__muted">Pay {money(order.finalAmount)} when your order arrives. No online payment is needed.</p>}
            {collectionUnrecorded && <p className="sc-confirmation__muted">Delivery is recorded, but payment collection has not been updated. If you have already paid, contact support before making another payment.</p>}
            {paymentDescription && <p className="sc-confirmation__muted">{paymentDescription}</p>}
            {paymentPending && <button className="sc-confirmation__link" disabled={!!invoiceBusy} onClick={refresh}><RefreshCw size={14} />Check payment status</button>}
            <details className="sc-confirmation__prices"><summary>Price breakdown<ChevronDown size={16} /></summary><dl>{priceLines(order).map(([label, value]) => <div key={label} className={value < 0 ? 'is-saving' : ''}><dt>{label}{label === 'Coupon discount' && order.coupon?.code ? ` (${order.coupon.code})` : ''}</dt><dd>{label === 'Delivery charge' && Number(value) === 0 ? 'FREE' : money(value)}</dd></div>)}<div className="sc-confirmation__price-total"><dt>Order total</dt><dd>{money(order.finalAmount)}</dd></div></dl>{Number(order.taxAmount) > 0 && <p className="sc-confirmation__muted">Includes {money(order.taxAmount)} GST{order.taxRate ? ` (${order.taxRate}%)` : ''}.</p>}</details>
            {savings > 0 && <p className="sc-confirmation__savings"><Check size={15} />Savings on this order: {money(savings)}</p>}
          </section>

          <section className="sc-confirmation__panel sc-confirmation__invoice" aria-labelledby="confirmation-invoice"><header><div><FileText size={19} /><h2 id="confirmation-invoice">Your invoice</h2></div><span className="sc-confirmation__tag">PDF</span></header><p className="sc-confirmation__muted">Keep a copy for your records. You can also print or share your order summary.</p>
            <button className="sc-confirmation__button sc-confirmation__button--outline" disabled={!!invoiceBusy} onClick={() => invoiceAction('download')}><Download size={17} />{invoiceBusy === 'download' ? 'Preparing invoice…' : 'Download invoice'}</button>
            <button className="sc-confirmation__link" disabled={!!invoiceBusy} onClick={() => invoiceAction('preview')}>{invoiceBusy === 'preview' ? 'Opening invoice…' : 'View, print & share'}<ArrowRight size={15} /></button>
            {invoiceError && <p role="alert" className="sc-confirmation__error">{invoiceError} Use an invoice button to retry.</p>}
          </section>

          <section className="sc-confirmation__help"><Headphones size={23} /><div><h2>Here to help</h2><p>Questions about your order?</p><button className="sc-confirmation__link" onClick={() => navigate(`/contact?order=${encodeURIComponent(orderId)}`)}>Contact support<ArrowRight size={14} /></button></div></section>
        </aside>
      </div>
      <p className="sc-confirmation__footnote"><Package size={16} />You can find this order anytime in <button onClick={() => navigate('/orders')}>My orders</button>.</p>
    </div>
    {invoiceOpen && receipt && <OrderModal title="Invoice preview" className="sc-order-modal--invoice" onClose={() => setInvoiceOpen(false)}><div className="sc-invoice-preview"><ReceiptActions receipt={receipt} /><Receipt receipt={receipt} /></div></OrderModal>}
  </section>;
}
