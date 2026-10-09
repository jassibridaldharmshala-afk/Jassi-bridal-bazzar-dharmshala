import { ChevronRight } from 'lucide-react';
import { RentalStatus } from './RentalUi';
import { rentalCopy } from '../../utils/rentalCopy';
import { rentalDate, rentalMoney } from '../../utils/rentals';

export default function RentalOrderRows({ rows, onOpen }) {
  return <div className="rental-order-list" role="list" aria-label="Rental bookings">{rows.map(b => <article className="rental-order-row" role="listitem" key={b._id}>
    <div className="rental-order-row__customer"><small>{b.number}</small><h3>{b.customer.name}</h3><p>{b.customer.phone}</p><p className="rental-order-row__items">{b.quote?.items?.map(item => item.title + ' × ' + item.quantity).join(', ')}</p></div>
    <div className="rental-order-row__state"><RentalStatus value={b.status} label={b.status === 'OUT' ? 'With customer' : rentalCopy(b.status)} />{b.overdue && <p>Return overdue</p>}{b.requests?.some(request => request.status === 'PENDING') && <p>Customer request to review</p>}</div>
    <dl className="rental-order-row__dates"><div><dt>Pickup</dt><dd>{rentalDate(b.schedule.pickupAt, b.policy.timezone)}</dd></div><div><dt>Return by</dt><dd>{rentalDate(b.schedule.returnDueAt, b.policy.timezone)}</dd></div></dl>
    <dl className="rental-order-row__money"><div><dt>Rent & services</dt><dd>{rentalMoney(b.adjustedRentalPaise ?? b.quote?.rentalPaise)}</dd></div><div><dt>Balance due</dt><dd>{rentalMoney(b.financial.balancePaise)}</dd></div>{b.financial.refundablePaise > 0 && <div><dt>Refund available</dt><dd>{rentalMoney(b.financial.refundablePaise)}</dd></div>}</dl>
    <button type="button" className="admin-btn-ghost rental-order-row__open" aria-label={'Manage ' + b.number} onClick={() => onOpen(b._id)}>View booking<ChevronRight size={16} /></button>
  </article>)}</div>;
}
