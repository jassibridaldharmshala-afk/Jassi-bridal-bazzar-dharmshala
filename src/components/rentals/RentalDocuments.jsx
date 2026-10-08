import { rentalUseDayLabel } from '../../utils/rentalShopping';
import { rentalDate, rentalMoney } from '../../utils/rentals';
import { invoiceAddress } from '../../utils/receiptData';
import RentalBookingDetails from './RentalBookingDetails';
function printInvoice() {
  document.body.dataset.rentalPrint = 'documents';
  const cleanup = () => { delete document.body.dataset.rentalPrint; window.removeEventListener('afterprint', cleanup); };
  window.addEventListener('afterprint', cleanup);
  try { window.print(); } finally { cleanup(); }
}
export default function RentalDocuments({ booking }) {
  const docs = booking.documents;
  if (!docs) return null;
  const invoice = docs.invoice, tz = booking.policy.timezone;
  return <section className="rental-card rental-documents">
    <h2>{invoice.kind === 'PROFORMA' ? 'Rental proforma' : 'Rental invoice'} · {invoice.number}</h2>
    <p>{invoice.seller?.storeName} {invoice.seller?.legalBusinessName} · {invoice.customer?.name}</p>
    {invoiceAddress(invoice.seller?.billingAddress || invoice.seller?.address).map((line, index) => <p className="rental-muted" key={index}>{line}</p>)}
    <p className="rental-muted">{invoice.seller?.contactPhone} {invoice.seller?.contactEmail} · Customer: {invoice.customer?.phone} {invoice.customer?.email}</p>
    <p className="rental-muted">Pickup {rentalDate(booking.schedule.pickupAt, tz)} · return by {rentalDate(booking.schedule.returnDueAt, tz)}</p>
    {booking.schedule.useDates?.length > 0 && <p className="rental-muted">Charged use days: {booking.schedule.useDates.map(rentalUseDayLabel).join(', ')}</p>}
    {invoice.seller?.gstin && <p>Business tax ID: {invoice.seller.gstin}</p>}
    <p className="rental-muted">Issued {rentalDate(invoice.issuedAt, tz)} · {invoice.serviceCode && `Classification ${invoice.serviceCode} · `}Policy {invoice.policyRevision}{invoice.revised ? ' · Revised rental amount (original accepted quote preserved)' : ''}</p>
    <div className="rental-table-wrap"><table className="rental-table"><thead><tr><th>Item</th><th>Qty</th><th>Rent</th><th>Services</th><th>Deposit</th></tr></thead><tbody>{invoice.items.map(i => <tr key={i.listingId}><td>{i.title}</td><td>{i.quantity}</td><td>{rentalMoney(i.rentPaise)}</td><td>{rentalMoney(i.feesPaise)}</td><td>{rentalMoney(i.depositPaise)}</td></tr>)}</tbody></table></div>
    <p>Rental charges: {rentalMoney(invoice.rentalPaise)} · taxable base: {rentalMoney(invoice.taxablePaise)} · included tax ({invoice.basisPoints / 100}%): {rentalMoney(invoice.taxPaise)}</p>
    <p>Delivery services: {rentalMoney(docs.deliveryFeePaise)} · return services: {rentalMoney(docs.returnFeePaise)}{docs.adjustmentPaise !== 0 && docs.adjustmentPaise !== undefined && ` · Rental adjustment against accepted line prices: ${rentalMoney(docs.adjustmentPaise)}`}</p>
    <p>Refundable deposit: {rentalMoney(invoice.depositPaise)} · rent + deposit: {rentalMoney(invoice.totalPaise)}</p>
    <div className="rental-print-only"><RentalBookingDetails booking={booking} /></div>
    <h3>Payment receipts / refund documents</h3>{docs.receipts.map(r => <p className="rental-muted" key={r.number}>{r.number} · {r.kind} · {rentalMoney(r.amountPaise)} · {r.status} · {r.reference} · {rentalDate(r.issuedAt, tz)}</p>)}
    <p className="rental-muted">{docs.note}</p><button type="button" className="rental-button rental-button--secondary" onClick={printInvoice}>Print invoice / receipts</button>
  </section>;
}
