import Receipt from '../order/Receipt';
import ReceiptActions from '../order/ReceiptActions';
import { buildRentalReceipt } from '../../utils/rentalReceipt';
export default function RentalDocuments({ booking }) {
  let receipt;
  try { receipt = buildRentalReceipt(booking); }
  catch (error) { return <p className="sc-invoice-actions__error" role="alert">{error.message}</p>; }
  return <div className="sc-invoice-preview rental-documents">
    <ReceiptActions key={booking._id + ':' + booking.revision} receipt={receipt} />
    <Receipt receipt={receipt} />
  </div>;
}
