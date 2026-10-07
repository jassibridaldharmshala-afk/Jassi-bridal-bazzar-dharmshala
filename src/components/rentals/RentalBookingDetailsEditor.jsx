import { useEffect, useRef, useState } from 'react';
import api from '../../services/api';
import { RentalField } from './RentalUi';
import { RentalBookingDetailsFields } from './RentalBookingDetails';
import { editableRentalDetails, rentalDetailsPayload, validateRentalDetails } from '../../utils/rentalDetails';
import { rentalOperation } from '../../utils/rentals';
const legacyOutbound = booking => booking.status === 'OUT' && booking.quote.deliveryMode !== 'STORE_PICKUP' && !booking.bookingDetails?.deliveryAddress && !!booking.logistics?.address;
const editorDetails = booking => ({ ...editableRentalDetails(booking.bookingDetails, booking.customer), ...(legacyOutbound(booking) ? { deliveryAddress: null } : {}) });
export default function RentalBookingDetailsEditor({ booking, base, busy, run, onChange, canWrite }) {
  const [details, setDetails] = useState(() => editorDetails(booking));
  const [note, setNote] = useState(''), [approved, setApproved] = useState(false), [error, setError] = useState('');
  const operation = useRef(rentalOperation());
  useEffect(() => { setDetails(editorDetails(booking)); setNote(''); setApproved(false); setError(''); operation.current = rentalOperation(); }, [booking]);
  const editable = ['HELD', 'CONFIRMED', 'PREPARING', 'READY', 'OUT'].includes(booking.status);
  const update = task => { task(); setApproved(false); setError(''); operation.current = rentalOperation(); };
  const save = async () => {
    const validation = validateRentalDetails(details, booking.quote.deliveryMode, { preserveLegacyDelivery: legacyOutbound(booking) });
    if (validation) { setError(validation); return; }
    const result = await run(() => api.post(`${base}/bookings/${booking._id}/operation`, { action: 'DETAILS', bookingDetails: rentalDetailsPayload(details, booking.quote.deliveryMode), customerApproved: approved, note, revision: booking.revision, operationId: operation.current }, { silent: true }));
    if (result) onChange(result);
  };
  if (!canWrite) return null;
  return <section className="rental-card"><h2>Update approved booking details</h2><p className="rental-muted">Changes need customer approval and are recorded in booking activity. Prices, dates, booking ownership and payment details are unchanged. Delivery / pickup and fitting / event details lock after handover; return details can still be updated until receipt. Connected courier addresses lock until that carrier leg is cancelled / reconciled.</p>
    {!editable ? <p className="rental-muted">Details are read-only after return / cancellation / closure. Existing bookings and their original address remain available.</p> : <details><summary>Edit addresses, contacts & instructions</summary>{error && <p role="alert" className="rental-notice">{error}</p>}<fieldset disabled={busy}><RentalBookingDetailsFields value={details} onChange={value => update(() => setDetails(value))} deliveryMode={booking.quote.deliveryMode} outboundLocked={booking.status === 'OUT'} legacyDeliveryAddress={legacyOutbound(booking) ? booking.logistics.address : undefined} /><RentalField label="Reason for booking-detail changes" multiline maxLength="1000" value={note} onChange={value => update(() => setNote(value))} /><label className="rental-check"><input type="checkbox" checked={approved} onChange={e => setApproved(e.target.checked)} />Customer explicitly approved these booking-detail changes</label><button type="button" className="rental-button" disabled={!approved || !note.trim()} onClick={save}>Save approved booking details</button></fieldset></details>}
  </section>;
}
