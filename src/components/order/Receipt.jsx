import logo from '../../assets/generated-brand-logo.svg';
import { invoiceMoney, receiptView } from '../../utils/receiptData';
import './Receipt.css';
import { normalizeImageUrl } from '../../services/normalize';
import StoreLogo from '../ui/StoreLogo';

export default function Receipt({ receipt }) {
  const view = receiptView(receipt);
  return <article id="samira-receipt" className="sc-invoice" aria-label={`Invoice ${view.number}`}>
    <div className="sc-invoice__header">
      <div className="sc-invoice__brand"><StoreLogo src={normalizeImageUrl(view.logoUrl) || logo} name={view.storeName} /><div><h2>{view.sellerName}</h2>{view.sellerAddress.map((value, index) => <p key={index}>{value}</p>)}{view.sellerContact.map((value) => <p key={value}>{value}</p>)}{view.gstin && <p className="sc-invoice__gst">GSTIN: {view.gstin}</p>}</div></div>
      <div className="sc-invoice__identity"><p>Invoice</p><strong>{view.number}</strong><span>Issued {view.date}</span></div>
    </div>
    <div className="sc-invoice__addresses"><Address title="Bill to" lines={[...view.billing, ...(view.customerEmail ? [view.customerEmail] : [])]} /><Address title="Ship to" lines={view.shipping} /></div>
    <div className="sc-invoice__reference"><span>Order: {view.orderId || view.number}</span><span>Ordered {view.orderDate}</span></div>
    <table className="sc-invoice__items"><caption className="sr-only">Invoice items, quantities and amounts in Indian rupees</caption><thead><tr><th scope="col">#</th><th scope="col">Item / Description</th><th scope="col">Qty</th><th scope="col">Unit price</th><th scope="col">Amount</th></tr></thead>
      <tbody>{view.items.map((item) => <tr key={item.number}><td>{item.number}</td><td><strong>{item.name}</strong>{item.variant && <span>{item.variant}</span>}{item.sku && <span>SKU: {item.sku}</span>}</td><td data-label="Qty">{item.quantity}</td><td data-label="Unit price">{invoiceMoney(item.price)}</td><td data-label="Amount"><strong>{invoiceMoney(item.total)}</strong></td></tr>)}</tbody>
    </table>
    <p className="sc-invoice__item-note">{view.items.length} item{view.items.length === 1 ? '' : 's'} · {view.quantity} unit{view.quantity === 1 ? '' : 's'} · All amounts in INR. Unit prices include product savings.</p>
    <div className="sc-invoice__summary"><section className="sc-invoice__payment"><h3>Payment information</h3><strong>{view.paymentMethod}</strong><p>Status: <span className={view.paymentStatus === 'Paid' ? 'is-paid' : ''}>{view.paymentStatus}</span></p>{view.paymentProvider && <p>Provider: {view.paymentProvider}</p>}{view.transactionId && <p>Transaction: {view.transactionId}</p>}{view.paymentNote && <p className="sc-invoice__muted">{view.paymentNote}</p>}<p className="sc-invoice__order-status">Order status: <strong>{view.orderStatus}</strong></p>{view.tracking && <p>Tracking: {view.tracking}</p>}</section>
      <div><dl className="sc-invoice__totals">{view.totals.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{name === 'Delivery' && value === 0 ? 'FREE' : invoiceMoney(value)}</dd></div>)}<div className="sc-invoice__grand-total"><dt>Invoice total</dt><dd>{invoiceMoney(view.total)}</dd></div></dl>{view.taxNote && <p className="sc-invoice__tax">{view.taxNote}</p>}<p className="sc-invoice__words">{view.totalWords}</p></div>
    </div>
    <div className="sc-invoice__notes"><h3>Returns & support</h3><p>{view.policy}</p>{view.invoiceNote && <p>{view.invoiceNote}</p>}<strong>Thank you for shopping with {view.storeName}.</strong><p>Computer-generated invoice. Please retain a copy for your records.</p></div>
  </article>;
}
function Address({ title, lines }) {
  return <section><h3>{title}</h3>{lines.map((value, index) => <p key={index}>{value}</p>)}</section>;
}
