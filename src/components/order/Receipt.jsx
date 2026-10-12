import logo from '../../assets/generated-brand-logo.svg';
import { invoiceMoney, receiptView } from '../../utils/receiptData';
import './Receipt.css';
import { normalizeImageUrl } from '../../services/normalize';
import StoreLogo from '../ui/StoreLogo';

export default function Receipt({ receipt }) {
  const view = receiptView(receipt);
  return <article id="samira-receipt" className="sc-invoice" aria-label={`${view.documentTitle || 'Invoice'} ${view.number}`}>
    <div className="sc-invoice__header">
      <div className="sc-invoice__brand"><StoreLogo src={normalizeImageUrl(view.logoUrl) || logo} name={view.storeName} /><div><h2>{view.sellerName}</h2>{view.sellerAddress.map((value, index) => <p key={index}>{value}</p>)}{view.sellerContact.map((value) => <p key={value}>{value}</p>)}{view.gstin && <p className="sc-invoice__gst">GSTIN: {view.gstin}</p>}</div></div>
      <div className="sc-invoice__identity"><p>{view.documentTitle || 'Invoice'}</p><strong>{view.number}</strong><span>Issued {view.date}</span></div>
    </div>
    <div className="sc-invoice__addresses"><Address title={view.billToLabel || 'Bill to'} lines={[...view.billing, ...(view.customerEmail ? [view.customerEmail] : [])]} /><Address title={view.collectionLabel || 'Ship to'} lines={view.shipping} /></div>
    <div className="sc-invoice__reference"><span>{view.referenceLabel || 'Order'}: {view.orderId || view.number}</span><span>{view.issuedLabel || 'Ordered'} {view.orderDate}</span></div>
    {view.scheduleRows && <section className="sc-invoice__schedule"><h3>Rental dates <span>({view.timezone})</span></h3><dl>{view.scheduleRows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>}
    <table className="sc-invoice__items"><caption className="sr-only">Invoice items, quantities and amounts in Indian rupees</caption><thead><tr><th scope="col">#</th><th scope="col">Item / Description</th><th scope="col">Qty</th><th scope="col">{view.unitLabel || 'Unit price'}</th><th scope="col">Amount</th></tr></thead>
      <tbody>{view.items.map((item) => <tr key={item.number}><td>{item.number}</td><td><strong>{item.name}</strong>{item.variant && <span>{item.variant}</span>}{item.sku && <span>SKU: {item.sku}</span>}{item.description && <span>{item.description}</span>}</td><td data-label="Qty">{item.quantity}</td><td data-label={view.unitLabel || 'Unit price'}>{invoiceMoney(item.price)}</td><td data-label="Amount"><strong>{invoiceMoney(item.total)}</strong></td></tr>)}</tbody>
    </table>
    <p className="sc-invoice__item-note">{view.itemNote || `${view.items.length} item${view.items.length === 1 ? '' : 's'} · ${view.quantity} unit${view.quantity === 1 ? '' : 's'} · All amounts in INR. Unit prices include product savings.`}</p>
    <div className="sc-invoice__summary"><section className="sc-invoice__payment"><h3>Payment information</h3><strong>{view.paymentMethod}</strong><p>Status: <span className={view.paymentStatus === 'Paid' ? 'is-paid' : ''}>{view.paymentStatus}</span></p>{view.paymentProvider && <p>Provider: {view.paymentProvider}</p>}{view.transactionId && <p>Transaction: {view.transactionId}</p>}{view.paymentRows && <dl className="sc-invoice__totals">{view.paymentRows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{invoiceMoney(value)}</dd></div>)}</dl>}{view.paymentNote && <p className="sc-invoice__muted">{view.paymentNote}</p>}<p className="sc-invoice__order-status">{view.referenceLabel || 'Order'} status: <strong>{view.orderStatus}</strong></p>{view.tracking && <p>Tracking: {view.tracking}</p>}</section>
      <div><dl className="sc-invoice__totals">{view.totals.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{name === 'Delivery' && value === 0 ? 'FREE' : invoiceMoney(value)}</dd></div>)}<div className="sc-invoice__grand-total"><dt>{view.totalLabel || 'Invoice total'}</dt><dd>{invoiceMoney(view.total)}</dd></div></dl>{view.taxNote && <p className="sc-invoice__tax">{view.taxNote}</p>}<p className="sc-invoice__words">{view.totalWords}</p></div>
    </div>
    {view.transactions && <section className="sc-invoice__transactions"><h3>Payment receipts & refunds</h3>{view.transactions.length ? view.transactions.map(row => <div key={row.number}><strong>{row.kind} · {invoiceMoney(row.amount)}</strong><p>{row.number}</p><p>{row.status} · {row.method} · {row.date}</p>{row.reference && <p>Reference: {row.reference}</p>}</div>) : <p>No payment has been recorded yet.</p>}</section>}
    <div className="sc-invoice__notes"><h3>{view.policyHeading || 'Returns & support'}</h3><p>{view.policy}</p>{view.invoiceNote && <p>{view.invoiceNote}</p>}<strong>{view.thankYou || `Thank you for shopping with ${view.storeName}.`}</strong><p>Computer-generated document. Please retain a copy for your records.</p></div>
  </article>;
}
function Address({ title, lines }) {
  return <section><h3>{title}</h3>{lines.map((value, index) => <p key={index}>{value}</p>)}</section>;
}
