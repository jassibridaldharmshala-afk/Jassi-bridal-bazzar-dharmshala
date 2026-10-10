import { forwardRef } from 'react';
import { CalendarX2 } from 'lucide-react';

const RentalBookingConflict = forwardRef(function RentalBookingConflict({ conflict, message, onBooking, onDates, onBrowse }, ref) {
  const mine = conflict.code === 'RENTAL_ALREADY_BOOKED';
  return <section ref={ref} tabIndex={-1} role="alert" className="rental-shopping-notice rental-booking-conflict">
    <div className="rental-booking-conflict__heading"><CalendarX2 size={19} aria-hidden="true" /><h2>{mine ? 'Already in your bookings' : 'Dates unavailable'}</h2></div>
    <p>{message}</p>
    <div className="rental-booking-conflict__actions">
      {mine && conflict.booking?.id && <button type="button" className="rental-shopping-primary" onClick={() => onBooking(conflict.booking.id)}>View your booking</button>}
      {onDates && <button type="button" className="rental-shopping-link" onClick={onDates}>Choose other dates</button>}
      {onBrowse && <button type="button" className="rental-shopping-link" onClick={onBrowse}>Browse other rentals</button>}
    </div>
  </section>;
});
export default RentalBookingConflict;
