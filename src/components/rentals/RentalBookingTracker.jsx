import { rentalDate, rentalMoney } from '../../utils/rentals';
import './Rentals.css';

const steps = [
  ['HELD', 'Dates held'], ['CONFIRMED', 'Confirmed'], ['PREPARING', 'Preparing'], ['READY', 'Ready'],
  ['OUT', 'Dispatched / with you'], ['RETURNED', 'Returned & inspection'], ['CLOSED', 'Settlement closed'],
];
export default function RentalBookingTracker({ booking, checkedAt }) {
  const timezone = booking.policy?.timezone || 'Asia/Kolkata';
  const expired = booking.status === 'EXPIRED' || (booking.status === 'HELD' && new Date(booking.expiresAt).getTime() <= Date.now());
  const cancelled = booking.status === 'CANCELLED' || (booking.status === 'CLOSED' && ['CANCELLED', 'EXPIRED'].includes(booking.closedFromStatus));
  const position = expired || cancelled ? -1 : steps.findIndex(([status]) => status === booking.status);
  const financial = booking.financial || {};
  const terminal = expired || cancelled || ['RETURNED', 'CLOSED'].includes(booking.status);
  const overdue = booking.status === 'OUT' && new Date(booking.schedule.returnDueAt).getTime() < Date.now();
  const explanation = expired ? 'This payment hold expired. Choose dates again to start a new booking.' : cancelled ? 'This booking was cancelled. Any approved refund is tracked below.' : ({
    HELD: 'Your dates are temporarily held. Complete the required payment before the hold expires.',
    CONFIRMED: booking.quote?.paymentPlan === 'PICKUP' ? 'Your rental dates are confirmed. Payment is due at pickup.' : 'Your payment is verified and your rental dates are confirmed.',
    PREPARING: 'The store is preparing your reserved pieces.',
    READY: 'Your pieces are ready for pickup or dispatch. Follow the collection details below.',
    OUT: 'Your rental is underway. Return every piece by the deadline shown below.',
    RETURNED: 'Your return is recorded. Inspection and deposit settlement are being completed.',
    CLOSED: 'The store has closed this booking and its settlement.',
  })[booking.status] || 'Check the latest booking updates below.';
  const lastEvent = booking.events?.[booking.events.length - 1];
  return <section className="rental-card rental-tracker" aria-label="Rental booking progress">
    <header><div><span className="rental-eyebrow">YOUR RENTAL JOURNEY</span><h2>{expired ? 'Hold expired' : cancelled ? 'Booking cancelled' : 'Every step, in one place'}</h2></div><span className="rental-tracker__live">{checkedAt ? `Checked ${new Date(checkedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'Booking updates'}</span></header>
    <p>{explanation}</p>
    {!expired && !cancelled && <ol className="rental-tracker__steps">{steps.map(([status, label], index) => <li key={status} className={index < position ? 'is-complete' : index === position ? 'is-current' : ''} aria-current={index === position ? 'step' : undefined}><span aria-hidden="true">{index < position ? '✓' : index + 1}</span><strong>{label}</strong></li>)}</ol>}
    {overdue && <p className="rental-notice" role="status">Return deadline has passed. Contact the store to arrange your return. Any late charge is subject to the agreed policy and assessment.</p>}
    <div className="rental-tracker__milestones"><div><span>Pickup / delivery</span><strong>{rentalDate(booking.schedule.pickupAt, timezone)}</strong></div><div><span>Return deadline</span><strong>{rentalDate(booking.schedule.returnDueAt, timezone)}</strong></div>{booking.status === 'HELD' && !expired && <div><span>Pay before hold expires</span><strong>{rentalDate(booking.expiresAt, timezone)}</strong></div>}{!terminal && <div><span>Outstanding balance</span><strong>{rentalMoney(financial.balancePaise)}</strong><small>{rentalDate(booking.schedule.balanceDueAt, timezone)}</small></div>}</div>
    {terminal && <div className="rental-tracker__settlement"><strong>Deposit & settlement</strong><p>Refund available {rentalMoney(financial.refundablePaise)} · refund processed {rentalMoney(financial.refundedPaise)}</p>{Math.max(0, (financial.reservedRefundPaise || 0) - (financial.refundedPaise || 0)) > 0 && <p>Refund processing: {rentalMoney(financial.reservedRefundPaise - financial.refundedPaise)}</p>}{booking.refundDueAt && <p>Settlement due: {rentalDate(booking.refundDueAt, timezone)}</p>}</div>}
    {lastEvent && <p className="rental-muted">Latest update: {String(lastEvent.type).replace(/_/g, ' ').toLowerCase()} · {rentalDate(lastEvent.at, timezone)}</p>}
    <p className="rental-muted">Updates refresh automatically while this page is open. Collection, courier details and requests appear below.</p>
  </section>;
}
