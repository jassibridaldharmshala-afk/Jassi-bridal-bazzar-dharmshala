import { invoiceAddress, invoiceMoney } from './receiptData';
import { rentalCopy } from './rentalCopy';
import { rentalUseDayLabel } from './rentalShopping';
import { rentalDate } from './rentals';
import { customerName } from './customerIdentity';

const rupees = value => Number(value || 0) / 100;
const methods = { PICKUP: 'Pay at pickup', ADVANCE: 'Advance payment', FULL: 'Full payment' };

export function rentalConfirmationState(booking, now = Date.now()) {
  const expired = booking.status === 'EXPIRED' || (booking.status === 'HELD' && +new Date(booking.expiresAt) <= now);
  const cancelled = booking.status === 'CANCELLED' || (booking.status === 'CLOSED' && ['CANCELLED', 'EXPIRED'].includes(booking.closedFromStatus));
  if (expired || (cancelled && booking.closedFromStatus === 'EXPIRED')) return { tone: 'neutral', title: 'Your booking hold expired', label: 'Hold expired', message: 'Choose dates again to check the latest availability.' };
  if (cancelled) return { tone: 'neutral', title: 'Your rental was cancelled', label: 'Booking cancelled', message: 'Check your booking for any approved refund and settlement updates.' };
  if (booking.status === 'HELD') return { tone: 'warning', title: 'Complete your rental booking', label: 'Payment pending', message: 'Your items are held temporarily. Complete the required payment before the hold expires.' };
  const stages = { CONFIRMED: 0, PREPARING: 1, READY: 1, OUT: 2, RETURNED: 3, CLOSED: 3 };
  const titles = { CONFIRMED: 'Your rental is booked!', PREPARING: 'We’re preparing your rental', READY: 'Your rental is ready', OUT: 'Your rental is with you', RETURNED: 'Your rental has been returned', CLOSED: 'Your rental is complete' };
  const messages = { CONFIRMED: booking.quote?.paymentPlan === 'PICKUP' ? 'Your dates are reserved. Payment is due at pickup.' : 'Your dates are reserved. Your payment and collection details are below.', PREPARING: 'The store is preparing your booked items.', READY: 'Follow your collection details below.', OUT: 'Please return your items by the date shown below.', RETURNED: 'Return inspection and deposit settlement are being completed.', CLOSED: 'Your booking and settlement have been closed.' };
  return { tone: stages[booking.status] !== undefined ? 'success' : 'neutral', title: titles[booking.status] || 'Your rental booking', label: rentalCopy(booking.status) || 'Booking details', message: messages[booking.status] || 'Check the latest booking information below.', step: stages[booking.status] };
}

// Use the saved invoice and booking snapshot, never the current catalogue price.
// The same data powers the preview, PDF, print and customer summary.
export function buildRentalReceipt(booking) {
  const docs = booking.documents, invoice = docs?.invoice;
  if (!invoice?.number || !Array.isArray(invoice.items) || !invoice.items.length || !Number.isFinite(invoice.totalPaise)) throw new Error('Your rental invoice is not available yet. Refresh the booking and try again.');
  const schedule = booking.schedule || {}, finance = booking.financial || {};
  const timezone = booking.policy?.timezone || 'Asia/Kolkata';
  const state = rentalConfirmationState(booking);
  const pickup = booking.quote?.deliveryMode === 'STORE_PICKUP';
  const customer = invoice.customer || booking.customer || {};
  const seller = invoice.seller || {};
  const rent = invoice.items.reduce((sum, item) => sum + Number(item.rentPaise || 0), 0);
  const services = invoice.items.reduce((sum, item) => sum + Number(item.feesPaise || 0), 0);
  const totals = [['Item rent', rupees(rent)]];
  if (services) totals.push(['Cleaning & alteration', rupees(services)]);
  if (docs.deliveryFeePaise) totals.push(['Delivery service', rupees(docs.deliveryFeePaise)]);
  if (docs.returnFeePaise) totals.push(['Return service', rupees(docs.returnFeePaise)]);
  const adjustment = invoice.rentalPaise - rent - services - (docs.deliveryFeePaise || 0) - (docs.returnFeePaise || 0);
  if (adjustment) totals.push(['Rental adjustment', rupees(adjustment)]);
  totals.push(['Refundable deposit', rupees(invoice.depositPaise)]);
  const settled = ['RETURNED', 'CLOSED', 'CANCELLED', 'EXPIRED'].includes(booking.status);
  const paid = finance.balancePaise === 0 && finance.collectedPaise > 0;
  const paymentStatus = state.tone === 'neutral' ? 'See settlement below' : paid ? 'Paid' : finance.collectedPaise > 0 ? 'Partially paid' : booking.quote?.paymentPlan === 'PICKUP' && booking.status !== 'HELD' ? 'Payment due at pickup' : 'Payment pending';
  const paymentRows = [['Payment received', rupees(finance.collectedPaise)], ['Balance due', rupees(finance.balancePaise)]];
  if (finance.deductionsPaise) paymentRows.push(['Approved charges', rupees(finance.deductionsPaise)]);
  if (settled || finance.refundedPaise) paymentRows.push(['Refund processed', rupees(finance.refundedPaise)], ['Approved refund available', rupees(finance.refundablePaise)]);
  if (finance.reservedRefundPaise > finance.refundedPaise) paymentRows.push(['Refund processing', rupees(finance.reservedRefundPaise - finance.refundedPaise)]);
  const scheduleRows = [
    ['Pickup / delivery', rentalDate(schedule.pickupAt, timezone)],
    ...(schedule.useDates?.length ? [['Use days', schedule.useDates.map(rentalUseDayLabel).join(', ')]] : []),
    ['Return by', rentalDate(schedule.returnDueAt, timezone)],
    ...(!pickup && booking.bookingDetails?.collectionAddress ? [['Return collection address', invoiceAddress(booking.bookingDetails.collectionAddress).join(', ')]] : []),
  ];
  const collection = pickup ? [seller.storeName || 'Jassi Bridal Bazar Dharmshala', ...invoiceAddress(seller.billingAddress || seller.address)] : invoiceAddress(booking.bookingDetails?.deliveryAddress || booking.logistics?.address);
  const billing = [customerName(customer.name) || 'Customer', ...(customer.phone ? [`Phone: ${customer.phone}`] : [])];
  const dayCount = schedule.days || 1;
  const days = `${dayCount} ${schedule.billingBasis === 'USE_DAYS' ? 'use' : 'rental'} day${dayCount === 1 ? '' : 's'}`;
  const date = value => value ? new Intl.DateTimeFormat('en-IN', { timeZone: timezone, dateStyle: 'medium' }).format(new Date(value)) : 'Not available';
  return {
    type: 'RENTAL', orderId: booking._id, invoiceNumber: invoice.number, invoiceDate: invoice.issuedAt, orderDate: booking.createdAt,
    customer, storeDetails: seller, finalAmount: rupees(invoice.totalPaise), paymentMethod: methods[booking.quote?.paymentPlan] || 'Rental payment', paymentStatus, orderStatus: state.label,
    items: invoice.items.map(item => ({ name: item.title, quantity: item.quantity, price: rupees(item.rentPaise) / item.quantity, lineAmount: rupees(item.rentPaise), description: `${days}${item.feesPaise ? ` · Services ${invoiceMoney(rupees(item.feesPaise))}` : ''} · Deposit ${invoiceMoney(rupees(item.depositPaise))}` })),
    rentalDetails: {
      documentTitle: invoice.kind === 'PROFORMA' ? 'Rental proforma' : 'Rental invoice', referenceLabel: 'Booking', orderId: booking.number, date: date(invoice.issuedAt), orderDate: date(booking.createdAt), issuedLabel: 'Booked', billToLabel: 'Customer', collectionLabel: pickup ? 'Store pickup & return' : 'Delivery address', billing, shipping: collection.length ? collection : ['See your booking for collection details.'],
      unitLabel: 'Rent / unit', totalLabel: 'Rent + deposit', itemNote: `Rent is for ${days}. All amounts are in INR. Services and refundable deposit are listed separately.`, totals, scheduleRows, timezone, paymentRows,
      paymentNote: invoice.kind === 'PROFORMA' ? 'This proforma is not a confirmed booking or proof of payment.' : state.tone === 'neutral' ? 'Check your booking for the current settlement and any approved refund.' : paid ? 'Payment received is recorded below. Keep the payment references for your records.' : 'This invoice is not proof of full payment. The outstanding balance is shown below.',
      transactions: (docs.receipts || []).map(row => ({ number: row.number, kind: row.kind === 'REFUND' ? 'Refund' : 'Payment receipt', amount: rupees(row.amountPaise), status: row.status ? rentalCopy(row.status) : row.kind === 'COLLECTION' ? 'Received' : 'Not recorded', method: rentalCopy(row.method) || 'Not recorded', reference: row.reference || '', date: rentalDate(row.issuedAt, timezone) })),
      taxNote: invoice.taxPaise > 0 ? `Includes ${invoiceMoney(rupees(invoice.taxPaise))} tax (${invoice.basisPoints / 100}%). Tax is included in rental charges; the deposit is recorded separately.` : '',
      policyHeading: 'Rental terms & support', policy: booking.policy?.terms || 'Return the items by the agreed deadline. The refundable deposit is settled after return inspection. Contact the store with your booking number for support.',
      invoiceNote: [invoice.serviceCode && `Service code: ${invoice.serviceCode}`, invoice.policyRevision !== undefined && `Policy revision: ${invoice.policyRevision}`, invoice.revised && 'Revised rental amount. Your original accepted quote is preserved in the booking.'].filter(Boolean).join(' · '),
      thankYou: `Thank you for booking with ${seller.storeName || 'Jassi Bridal Bazar Dharmshala'}.`,
      filename: `Rental-${invoice.kind === 'PROFORMA' ? 'Proforma' : 'Invoice'}-${invoice.number.replace(/[^a-zA-Z0-9_-]/g, '-')}.pdf`,
    },
  };
}
