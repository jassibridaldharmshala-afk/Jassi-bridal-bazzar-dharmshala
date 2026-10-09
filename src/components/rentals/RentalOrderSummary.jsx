import { rentalPendingRefundAmount } from '../../utils/rentalActions';
import { rentalCopy } from '../../utils/rentalCopy';
import { rentalDate, rentalMoney } from '../../utils/rentals';
import { rentalUseDayLabel } from '../../utils/rentalShopping';
import { RentalStatus } from './RentalUi';

export default function RentalOrderSummary({ booking: b }) {
  const stages = ['Booked', 'Ready', 'With customer', 'Returned', 'Completed'];
  const stage = { CONFIRMED: 0, PREPARING: 0, READY: 1, OUT: 2, RETURNED: 3, CLOSED: 4 }[b.status];
  const pieces = b.allocations || [];
  const returns = [
    ['Awaiting return', pieces.filter(piece => !piece.receivedAt && !piece.lostAt).length],
    ['Inspection pending', pieces.filter(piece => piece.receivedAt && !piece.disposition && !piece.readyAt).length],
    ['Cleaning / repair', pieces.filter(piece => ['CLEANING', 'REPAIR'].includes(piece.disposition) && !piece.readyAt).length],
    ['Lost / unreturned', pieces.filter(piece => piece.lostAt || piece.disposition === 'LOST').length],
    ['Released / retired', pieces.filter(piece => piece.readyAt).length],
  ];
  const pendingRefund = rentalPendingRefundAmount(b);
  return <section className="rental-order-summary">
    <div className="rental-order-summary__heading"><div><p className="rental-muted">{b.number}</p><h3>{b.customer.name}</h3><a href={'tel:' + b.customer.phone}>{b.customer.phone}</a></div><RentalStatus value={b.status} label={b.status === 'OUT' ? 'With customer' : rentalCopy(b.status)} /></div>
    {stage !== undefined && !['CANCELLED', 'EXPIRED'].includes(b.closedFromStatus) && <ol className="rental-order-progress" aria-label="Rental progress">{stages.map((label, index) => <li key={label} className={index <= stage ? 'is-done' : ''} aria-current={index === stage ? 'step' : undefined}><span>{index + 1}</span>{label}</li>)}</ol>}
    <div className="rental-order-summary__items">{b.quote.items.map(item => <p key={item.listingId}><strong>{item.title}</strong><span>Qty {item.quantity}</span></p>)}</div>
    <dl className="rental-order-schedule"><div><dt>Pickup</dt><dd>{rentalDate(b.schedule.pickupAt, b.policy.timezone)}</dd></div><div><dt>Return by</dt><dd>{rentalDate(b.schedule.returnDueAt, b.policy.timezone)}</dd></div></dl>
    <p className="rental-muted">Payment plan: {{ PICKUP: 'Pay at pickup', FULL: 'Full payment', ADVANCE: 'Advance, then balance at pickup' }[b.quote.paymentPlan] || 'Advance, then balance at pickup'}</p>
    {b.schedule.useDates?.length > 0 && <p className="rental-muted">Use days: {b.schedule.useDates.map(rentalUseDayLabel).join(', ')}</p>}
    {['OUT', 'RETURNED'].includes(b.status) && pieces.length > 0 && <section className="rental-order-return-status" aria-label="Physical piece return status"><h3>Pieces & returns</h3><dl>{returns.filter(([, count]) => count > 0).map(([label, count]) => <div key={label}><dt>{label}</dt><dd>{count} of {pieces.length}</dd></div>)}</dl><p className="rental-muted">Lost pieces are tracked separately; release means cleaned, repaired or retired.</p></section>}
    <dl className="rental-order-totals">{[['Rent & services', b.adjustedRentalPaise ?? b.quote.rentalPaise], ['Refundable security', b.quote.depositPaise], ['Paid', b.financial.collectedPaise], ['Balance due', b.financial.balancePaise], ...(b.financial.deductionsPaise > 0 ? [['Approved deductions', b.financial.deductionsPaise]] : []), ['Refund available', b.financial.refundablePaise], ['Refund processed', b.financial.refundedPaise]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{rentalMoney(value)}</dd></div>)}</dl>
    {pendingRefund > 0 && <p className="rental-order-note" role="status">Refund of {rentalMoney(pendingRefund)} is awaiting provider confirmation. This amount is already reserved; refresh this booking to check its status before closing.</p>}
    {b.status === 'HELD' && <p className="rental-order-note">Awaiting payment. Booking confirms after the required advance is received; this hold expires {rentalDate(b.expiresAt, b.policy.timezone)}.</p>}
    {b.quote.paymentPlan === 'PICKUP' && b.financial.balancePaise > 0 && <p className="rental-order-note">Pay-at-pickup booking. Record the actual payment before handover.</p>}
    {b.overdue && <p role="alert" className="rental-order-note">Return overdue. Contact the customer; any late-charge deduction needs review.</p>}
  </section>;
}
