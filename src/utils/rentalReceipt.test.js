import booking from './__fixtures__/rental-booking.json';
import { buildRentalReceipt, rentalConfirmationState } from './rentalReceipt';
import { receiptView } from './receiptData';
import { buildReceiptDefinition } from './receiptDocument';
import { buildReceiptMessage } from './receiptMessage';

test('rental preview, PDF and summary use the saved booking number, dates, customer and total', () => {
  const receipt = buildRentalReceipt(booking), view = receiptView(receipt);
  expect(view).toMatchObject({ orderId: 'R-JB1024', documentTitle: 'Rental invoice', total: 1500, customerName: 'Priya Sharma', paymentStatus: 'Payment due at pickup', billing: ['Priya Sharma', 'Phone: 9876543210'] });
  expect(view.totals).toEqual([['Item rent', 1000], ['Refundable deposit', 500]]);
  expect(view.scheduleRows.map(([label]) => label)).toEqual(['Pickup / delivery', 'Use days', 'Return by']);
  const definition = buildReceiptDefinition(receipt);
  expect(definition.info).toMatchObject({ title: 'Rental invoice RINV-R-JB1024', subject: 'Booking R-JB1024' });
  const printed = JSON.stringify(definition.content);
  expect(printed).toContain('23 Oct 2026'); expect(printed).toContain('Rent + deposit'); expect(printed).not.toContain('SHIP TO');
  const message = buildReceiptMessage(receipt);
  expect(message).toContain('Booking: R-JB1024'); expect(message).toContain('Balance due: ₹1,500.00'); expect(message).not.toContain('Order ID:');
});

test('line totals retain every paise, and fees, logistics and revisions reconcile to the invoice total', () => {
  const item = { ...booking.documents.invoice.items[0], quantity: 3, rentPaise: 300001, feesPaise: 6000, depositPaise: 150000 };
  const adjusted = { ...booking, adjustedRentalPaise: 315000, documents: { ...booking.documents, deliveryFeePaise: 5000, returnFeePaise: 5000, invoice: { ...booking.documents.invoice, items: [item], rentalPaise: 315000, depositPaise: 150000, totalPaise: 465000, revised: true, taxPaise: 48051, basisPoints: 1800 } } };
  const view = receiptView(buildRentalReceipt(adjusted));
  expect(view.items[0].total).toBe(3000.01);
  expect(view.totals.reduce((sum, [, amount]) => sum + amount, 0)).toBeCloseTo(view.total, 2);
  expect(view.totals).toContainEqual(['Rental adjustment', -10.01]);
  expect(view.taxNote).toContain('deposit is recorded separately');
  expect(view.invoiceNote).toContain('Revised rental amount');
});

test('a hold is a proforma, never a confirmation or payment receipt', () => {
  const held = { ...booking, status: 'HELD', expiresAt: '2099-10-12T00:00:00Z', quote: { ...booking.quote, paymentPlan: 'ADVANCE' }, documents: { ...booking.documents, invoice: { ...booking.documents.invoice, kind: 'PROFORMA', number: 'RPRO-R-JB1024' } } };
  expect(rentalConfirmationState(held)).toMatchObject({ tone: 'warning', title: 'Complete your rental booking' });
  const view = receiptView(buildRentalReceipt(held));
  expect(view.documentTitle).toBe('Rental proforma'); expect(view.paymentNote).toContain('not a confirmed booking or proof of payment'); expect(view.transactions).toEqual([]);
});

test.each(['CANCELLED', 'EXPIRED'])('terminal %s status does not offer a confirmation', status => {
  expect(rentalConfirmationState({ ...booking, status }).tone).toBe('neutral');
  expect(rentalConfirmationState({ ...booking, status: 'CLOSED', closedFromStatus: status }).tone).toBe('neutral');
});

test('processed and pending refunds remain distinct in the document and receipt references survive export', () => {
  const returned = { ...booking, status: 'RETURNED', financial: { ...booking.financial, collectedPaise: 150000, balancePaise: 0, refundedPaise: 10000, refundablePaise: 20000, reservedRefundPaise: 30000 }, documents: { ...booking.documents, receipts: [{ number: 'RRC-JB1024-1', kind: 'COLLECTION', amountPaise: 150000, method: 'UPI', reference: 'PAY-verified', issuedAt: booking.createdAt }, { number: 'RRF-JB1024-2', kind: 'REFUND', amountPaise: 20000, status: 'PROCESSING', reference: 'REF-processing', issuedAt: booking.createdAt }] } };
  const receipt = buildRentalReceipt(returned), view = receiptView(receipt);
  expect(view.paymentRows).toContainEqual(['Refund processed', 100]); expect(view.paymentRows).toContainEqual(['Refund processing', 200]);
  expect(view.transactions[1].status).toBe('Processing');
  expect(JSON.stringify(buildReceiptDefinition(receipt).content)).toContain('PAY-verified');
});

test('missing invoice data fails clearly instead of producing a made-up receipt', () => {
  expect(() => buildRentalReceipt({ ...booking, documents: null })).toThrow('not available yet');
  expect(() => buildRentalReceipt({ ...booking, documents: { invoice: { ...booking.documents.invoice, totalPaise: null } } })).toThrow('not available yet');
});

test('delivery and return collection retain their distinct saved addresses', () => {
  const delivered = { ...booking, quote: { ...booking.quote, deliveryMode: 'LOCAL_DELIVERY' }, bookingDetails: { deliveryAddress: { fullName: 'Priya Sharma', houseNo: '12', area: 'Temple Road', city: 'Dharamshala', state: 'HP', pincode: '176215' }, collectionAddress: { fullName: 'Priya Sharma', houseNo: '24', area: 'Market Road', city: 'Dharamshala', state: 'HP', pincode: '176215' } } };
  const view = receiptView(buildRentalReceipt(delivered));
  expect(view.shipping.join(' ')).toContain('12, Temple Road');
  expect(view.scheduleRows.find(([label]) => label === 'Return collection address')[1]).toContain('24, Market Road');
});
