import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Orders from './Orders';
import RentalOrders from './RentalOrders';
import api from '../../services/api';

jest.mock('../../services/api', () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn() }));
jest.mock('../../components/rentals/RentalProofPanel', () => () => null);
jest.mock('../../components/rentals/RentalTrialDesk', () => () => null);
jest.mock('../../components/rentals/RentalPaymentRecovery', () => () => null);
const permissions = { 'orders.read': true, 'orders.write': true, 'returns.refund': true, 'returns.qc': true, 'inventory.read': true };
const config = { mode: 'SALE_AND_RENTAL', policy: { timezone: 'Asia/Kolkata', deliveryModes: ['STORE_PICKUP'] } };
const booking = () => ({ _id: 'booking1', number: 'R-1001', revision: 4, status: 'READY', customer: { name: 'Meera', phone: '9000000001' }, policy: config.policy,
  schedule: { pickupAt: '2030-01-09T04:30Z', returnDueAt: '2030-01-11T04:30Z', days: 1, billingBasis: 'USE_DAYS', useDates: ['2030-01-10'] },
  quote: { items: [{ title: 'Bridal lehenga', quantity: 1, listingId: 'offer1' }], rentalPaise: 150000, depositPaise: 200000, paymentPlan: 'PICKUP' },
  financial: { balancePaise: 0, collectedPaise: 350000, refundedPaise: 0, refundablePaise: 0 }, allocations: [{ assetId: 'piece1', code: 'BRIDAL-001', label: 'Lehenga' }], requests: [], events: [], ledger: [], assessments: [] });
let current, access;
beforeEach(() => {
  jest.clearAllMocks(); current = booking(); access = permissions;
  api.get.mockImplementation(async path => path.endsWith('/daily-desk?day=' ) ? { counts: {} } : path.includes('/daily-desk') ? { counts: {} } : path.includes('/bookings?') ? { rows: [current], total: 1, pages: 1, page: 1 } : path.includes('/bookings/') ? current : { configuration: config, permissions: access, readiness: { transactions: true } });
  api.post.mockImplementation(async (path, input) => ({ ...current, revision: 5, status: input.action === 'HANDOVER' ? 'OUT' : 'CONFIRMED', financial: { ...current.financial, balancePaise: 0 } }));
});

test('the rental Orders tab loads all future bookings without mounting sale order queries or setup tools', async () => {
  const navigate = jest.fn(); render(<Orders route="/admin/orders?type=rental&storeId=shop1" navigate={navigate} />);
  const list = await screen.findByRole('list', { name: 'Rental bookings' });
  expect(screen.getByRole('link', { name: 'Sale orders' })).toHaveAttribute('href', '/admin/orders?type=sale&storeId=shop1');
  expect(screen.getByRole('link', { name: 'Rental bookings' })).toHaveAttribute('aria-current', 'page');
  expect(screen.queryByLabelText('Operations date (Asia/Kolkata)')).not.toBeInTheDocument();
  expect(screen.queryByRole('navigation', { name: 'Rental workspace' })).not.toBeInTheDocument();
  expect(api.get.mock.calls.some(([path]) => path.startsWith('/admin/orders'))).toBe(false);
  expect(api.get.mock.calls.find(([path]) => path.includes('/bookings?'))[0]).toContain('view=all');
  fireEvent.click(within(list).getByRole('button', { name: 'Manage R-1001' }));
  expect(navigate).toHaveBeenCalledWith('/admin/orders?storeId=shop1&type=rental&booking=booking1');
});

test('handover waits for the actual piece checklist, then reuses the revision-protected rental operation', async () => {
  render(<RentalOrders route="/admin/orders?type=rental&booking=booking1" navigate={jest.fn()} />);
  const region = await screen.findByRole('region', { name: 'Manage booking R-1001' });
  const save = region.querySelector('.rental-order-save'); expect(save).toBeDisabled();
  fireEvent.click(within(region).getByLabelText('BRIDAL-001 · Lehenga'));
  fireEvent.change(within(region).getByLabelText('Note'), { target: { value: 'Customer received the checked piece.' } });
  fireEvent.click(save);
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/rentals/bookings/booking1/operation', expect.objectContaining({ action: 'HANDOVER', revision: 4, assetIds: ['piece1'] }), { silent: true }));
  expect(await screen.findByText('With customer', { selector: 'span' })).toBeInTheDocument();
});

test('held bookings are confirmed by real recorded payment rather than a status-only confirm button', async () => {
  current = { ...current, status: 'HELD', expiresAt: '2030-01-01T10:00Z', financial: { ...current.financial, balancePaise: 350000 }, quote: { ...current.quote, paymentPlan: 'ADVANCE' } };
  render(<RentalOrders route="/admin/orders?type=rental&booking=booking1" />);
  const region = await screen.findByRole('region', { name: 'Manage booking R-1001' }); const save = region.querySelector('.rental-order-save');
  expect(save).toBeDisabled(); expect(screen.queryByRole('button', { name: 'Confirm booking' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Amount (₹)'), { target: { value: '2450' } });
  fireEvent.change(screen.getByLabelText('Actual receipt / bank transaction reference'), { target: { value: 'SHOP-RECEIPT-1' } }); fireEvent.click(save);
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/rentals/bookings/booking1/collection', expect.objectContaining({ amountPaise: 245000, method: 'CASH', reference: 'SHOP-RECEIPT-1', revision: 4 }), { silent: true }));
});

test('read-only staff see the booking and allowed history, with mutation actions disabled', async () => {
  access = { ...permissions, 'orders.write': false, 'returns.qc': false, 'returns.refund': false, 'inventory.read': false };
  render(<RentalOrders route="/seller/orders?type=rental&booking=booking1" />);
  const region = await screen.findByRole('region', { name: 'Manage booking R-1001' }); expect(region.querySelector('.rental-order-save')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Hand over' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Rental setup & pieces' })).not.toBeInTheDocument(); expect(api.post).not.toHaveBeenCalled();
});

test('an interrupted operation retries the same operation ID without losing its payment data', async () => {
  current = { ...current, status: 'HELD', expiresAt: '2030-01-01T10:00Z', financial: { ...current.financial, balancePaise: 350000 } };
  api.post.mockRejectedValueOnce(new Error('Connection interrupted'));
  render(<RentalOrders route="/admin/orders?type=rental&booking=booking1" />);
  const region = await screen.findByRole('region', { name: 'Manage booking R-1001' });
  fireEvent.change(screen.getByLabelText('Amount (₹)'), { target: { value: '2450' } }); fireEvent.change(screen.getByLabelText('Actual receipt / bank transaction reference'), { target: { value: 'SHOP-RECEIPT-2' } });
  fireEvent.click(region.querySelector('.rental-order-save')); expect(await screen.findByRole('alert')).toHaveTextContent('Connection interrupted');
  fireEvent.click(region.querySelector('.rental-order-save')); await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
  expect(api.post.mock.calls[1][1]).toEqual(api.post.mock.calls[0][1]);
});

test('search and status survive refresh and a trip into a booking in the same shop', async () => {
  const route = '/admin/orders?type=rental', navigate = jest.fn();
  const view = render(<RentalOrders route={route} navigate={navigate} />);
  await screen.findByRole('list', { name: 'Rental bookings' });
  fireEvent.change(screen.getByLabelText('Search bookings'), { target: { value: 'Meera' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Status' }), { target: { value: 'READY' } });
  await waitFor(() => expect(api.get.mock.calls.some(([path]) => path.includes('search=Meera') && path.includes('status=READY'))).toBe(true));
  fireEvent.click(screen.getByRole('button', { name: 'Refresh rental orders' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh rental orders' })).toBeEnabled());
  expect(screen.getByLabelText('Search bookings')).toHaveValue('Meera');
  expect(screen.getByRole('combobox', { name: 'Status' })).toHaveValue('READY');
  view.rerender(<RentalOrders route={route + '&booking=booking1'} navigate={navigate} />);
  await screen.findByRole('region', { name: 'Manage booking R-1001' });
  view.rerender(<RentalOrders route={route} navigate={navigate} />);
  await screen.findByRole('list', { name: 'Rental bookings' });
  expect(screen.getByLabelText('Search bookings')).toHaveValue('Meera');
  expect(screen.getByRole('combobox', { name: 'Status' })).toHaveValue('READY');
});

test('a refreshed provider-confirmed booking switches from payment to preparation without remounting its detail', async () => {
  current = { ...current, status: 'HELD', expiresAt: '2030-01-01T10:00Z', financial: { ...current.financial, balancePaise: 350000 } };
  render(<RentalOrders route="/admin/orders?type=rental&booking=booking1" />);
  await screen.findByRole('region', { name: 'Manage booking R-1001' });
  expect(screen.getByLabelText('Amount (₹)')).toBeInTheDocument();
  current = { ...current, revision: 5, status: 'CONFIRMED', financial: { ...current.financial, balancePaise: 0 } };
  fireEvent.click(screen.getByRole('button', { name: 'Refresh rental orders' }));
  await waitFor(() => expect(document.querySelector('.rental-order-save')).toHaveTextContent('Start preparation'));
  expect(screen.queryByLabelText('Amount (₹)')).not.toBeInTheDocument();
});

test('an invalid booking response shows a recovery route and does not permit writes', async () => {
  const navigate = jest.fn(); api.get.mockImplementation(async path => path.includes('/bookings/') ? {} : { configuration: config, permissions, readiness: { transactions: true } });
  render(<RentalOrders route="/seller/orders?type=rental&booking=missing&storeId=shop1" navigate={navigate} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('This rental booking could not be loaded');
  fireEvent.click(screen.getByRole('button', { name: 'All rental bookings' }));
  expect(navigate).toHaveBeenCalledWith('/seller/orders?storeId=shop1&type=rental');
  expect(document.querySelector('.rental-order-save')).toBeNull(); expect(api.post).not.toHaveBeenCalled();
});

test('cancellation records the merchant retention decision and refund then requires the original receipt and actual reference', async () => {
  current = { ...current, ledger: [{ operationId: 'payment1', kind: 'COLLECTION', method: 'CASH', reference: 'RECEIPT-1', amountPaise: 350000 }] };
  api.post.mockImplementation(async (path, input) => {
    if (input.action === 'CANCEL') current = { ...current, status: 'CANCELLED', revision: 5, adjustedRentalPaise: 50000, financial: { ...current.financial, refundablePaise: 300000 } };
    else current = { ...current, revision: 6, financial: { ...current.financial, refundablePaise: 0, refundedPaise: 300000 } };
    return current;
  });
  render(<RentalOrders route="/admin/orders?type=rental&booking=booking1" />);
  const region = await screen.findByRole('region', { name: 'Manage booking R-1001' });
  fireEvent.click(screen.getByText('Other booking actions'));
  fireEvent.change(screen.getByLabelText('Operation'), { target: { value: 'CANCEL' } });
  expect(region.querySelector('.rental-order-save')).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Rental charge to retain (₹, optional)'), { target: { value: '500' } });
  fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Customer cancelled; agreed retention ₹500.' } });
  fireEvent.click(region.querySelector('.rental-order-save'));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/rentals/bookings/booking1/operation', expect.objectContaining({ action: 'CANCEL', retainedRentalPaise: 50000, revision: 4 }), { silent: true }));
  await screen.findByLabelText('Original payment receipt');
  expect(screen.getByLabelText('Note')).toHaveValue('');
  fireEvent.change(screen.getByLabelText('Amount (₹)'), { target: { value: '3001' } });
  expect(region.querySelector('.rental-order-save')).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Amount (₹)'), { target: { value: '3000' } });
  fireEvent.change(screen.getByLabelText('Original payment receipt'), { target: { value: 'RECEIPT-1' } });
  fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Returned remaining paid rent and deposit.' } });
  expect(region.querySelector('.rental-order-save')).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Cash/bank refund receipt (online refunds use original provider)'), { target: { value: 'REFUND-1' } });
  fireEvent.click(region.querySelector('.rental-order-save'));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/rentals/bookings/booking1/refund', expect.objectContaining({ amountPaise: 300000, paymentReference: 'RECEIPT-1', refundReference: 'REFUND-1', revision: 5 }), { silent: true }));
});

test('store-fault full refund disables retention and always submits zero retained rent', async () => {
  render(<RentalOrders route="/admin/orders?type=rental&booking=booking1" />);
  const region = await screen.findByRole('region', { name: 'Manage booking R-1001' });
  fireEvent.click(screen.getByText('Other booking actions'));
  fireEvent.change(screen.getByLabelText('Operation'), { target: { value: 'CANCEL' } });
  fireEvent.change(screen.getByLabelText('Rental charge to retain (₹, optional)'), { target: { value: '500' } });
  fireEvent.click(screen.getByLabelText('Owner cannot fulfil — refund full advance/deposit'));
  expect(screen.getByLabelText('Rental charge to retain (₹, optional)')).toBeDisabled();
  expect(screen.getByLabelText('Rental charge to retain (₹, optional)')).toHaveValue(0);
  fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Shop cannot fulfil; full refund agreed.' } });
  fireEvent.click(region.querySelector('.rental-order-save'));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/rentals/bookings/booking1/operation', expect.objectContaining({ action: 'CANCEL', ownerFault: true, retainedRentalPaise: 0 }), { silent: true }));
});

test('handover waits for the named person check as well as the piece checklist', async () => {
  current = { ...current, bookingDetails: { pickupContact: { name: 'Sister', phone: '9000000002', authorised: true } } };
  render(<RentalOrders route="/admin/orders?type=rental&booking=booking1" />);
  const region = await screen.findByRole('region', { name: 'Manage booking R-1001' });
  fireEvent.click(screen.getByLabelText('BRIDAL-001 · Lehenga'));
  expect(region.querySelector('.rental-order-save')).toBeDisabled();
  fireEvent.click(screen.getByLabelText('I checked the named contact and customer authorisation for this handover / return'));
  expect(region.querySelector('.rental-order-save')).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent('Record the handover acknowledgement');
  fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Named contact received the checked piece.' } });
  expect(region.querySelector('.rental-order-save')).toBeEnabled();
});

test('an unresolved provider refund shows a waiting state and prevents closing or refunding its reserved money', async () => {
  current = { ...current, status: 'RETURNED', financial: { ...current.financial, refundablePaise: 0 }, allocations: [{ ...current.allocations[0], receivedAt: '2030-01-11T04:30Z', disposition: 'CLEANING', readyAt: '2030-01-11T08:30Z' }], ledger: [{ operationId: 'refund1', kind: 'REFUND', amountPaise: 200000, status: 'REVIEW' }] };
  render(<RentalOrders route="/admin/orders?type=rental&booking=booking1" />);
  const region = await screen.findByRole('region', { name: 'Manage booking R-1001' });
  expect(screen.getByRole('heading', { name: 'Awaiting refund confirmation' })).toBeInTheDocument();
  expect(region.querySelector('.rental-order-save')).toBeNull();
  expect(screen.queryByLabelText('Note')).not.toBeInTheDocument();
  expect(within(screen.getByLabelText('Operation')).queryByRole('option', { name: 'Close completed booking' })).not.toBeInTheDocument();
});

test('partial returns show outstanding pieces and continue inspection then cleaning in the same booking', async () => {
  current = { ...current, status: 'OUT', allocations: [
    { assetId: 'piece1', code: 'BRIDAL-001', label: 'Lehenga', receivedAt: '2030-01-11T04:30Z' },
    { assetId: 'piece2', code: 'JEWEL-002', label: 'Jewellery', receivedAt: '2030-01-11T04:30Z', disposition: 'CLEANING' },
    { assetId: 'piece3', code: 'BANGLE-003', label: 'Bangles' },
  ] };
  api.post.mockImplementation(async (path, input) => {
    current = { ...current, revision: current.revision + 1, allocations: current.allocations.map(piece => piece.assetId === input.assetId ? { ...piece, disposition: input.disposition } : piece) };
    return current;
  });
  render(<RentalOrders route="/admin/orders?type=rental&booking=booking1" />);
  const region = await screen.findByRole('region', { name: 'Manage booking R-1001' });
  const summary = screen.getByRole('region', { name: 'Physical piece return status' });
  expect(within(summary).getByText('Awaiting return')).toBeInTheDocument();
  expect(within(summary).getByText('Inspection pending')).toBeInTheDocument();
  const pieces = screen.getByRole('combobox', { name: 'Returned piece' });
  expect([...pieces.options].map(o => o.value)).toEqual(['', 'piece1']);
  expect(screen.getByRole('combobox', { name: 'Inspection result' })).toHaveValue('CLEANING');
  expect(screen.getByRole('option', { name: 'Needs cleaning' })).toHaveValue('CLEANING');
  fireEvent.change(pieces, { target: { value: 'piece1' } });
  expect(region.querySelector('.rental-order-save')).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Embroidery intact; cleaning required.' } });
  fireEvent.click(region.querySelector('.rental-order-save'));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/rentals/bookings/booking1/operation', expect.objectContaining({ action: 'INSPECT', assetId: 'piece1', disposition: 'CLEANING', revision: 4 }), { silent: true }));
  await waitFor(() => expect(region.querySelector('.rental-order-save')).toHaveTextContent('Verify cleaning or repair and release'));
  expect([...screen.getByLabelText('Returned piece').options].map(o => o.value)).toEqual(['', 'piece1', 'piece2']);
  fireEvent.change(screen.getByLabelText('Returned piece'), { target: { value: 'piece1' } });
  expect(region.querySelector('.rental-order-save')).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Record return', exact: true }));
  expect(screen.queryByLabelText('BRIDAL-001 · Lehenga')).not.toBeInTheDocument();
  expect(screen.getByLabelText('BANGLE-003 · Bangles')).toBeInTheDocument();
});

test('cleaning release excludes uninspected and previously released pieces but includes confirmed lost pieces', async () => {
  current = { ...current, status: 'RETURNED', allocations: [
    { assetId: 'inspect', code: 'UNINSPECTED', receivedAt: '2030-01-11T04:30Z' },
    { assetId: 'clean', code: 'CLEANING', receivedAt: '2030-01-11T04:30Z', disposition: 'CLEANING' },
    { assetId: 'done', code: 'RELEASED', receivedAt: '2030-01-11T04:30Z', disposition: 'REPAIR', readyAt: '2030-01-11T04:30Z' },
    { assetId: 'lost', code: 'LOST', lostAt: '2030-01-11T04:30Z', disposition: 'LOST' },
  ] };
  render(<RentalOrders route="/admin/orders?type=rental&booking=booking1" />);
  await screen.findByRole('region', { name: 'Manage booking R-1001' });
  fireEvent.click(screen.getByText('Other booking actions'));
  expect(within(screen.getByLabelText('Operation')).queryByRole('option', { name: 'Settle refundable balance' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Operation'), { target: { value: 'RELEASE' } });
  expect([...screen.getByLabelText('Returned piece').options].map(o => o.value)).toEqual(['', 'clean', 'lost']);
});

test('refund entry uses the selected receipt remaining amount and explains a pending provider refund', async () => {
  current = { ...current, status: 'CANCELLED', financial: { ...current.financial, refundablePaise: 200000 }, ledger: [
    { operationId: 'cash', kind: 'COLLECTION', method: 'CASH', reference: 'CASH-1', amountPaise: 100000 },
    { operationId: 'bank', kind: 'COLLECTION', method: 'BANK', reference: 'BANK-2', amountPaise: 200000 },
    { operationId: 'refund1', kind: 'REFUND', reference: 'CASH-1', amountPaise: 60000, status: 'PROCESSED' },
    { operationId: 'refund2', kind: 'REFUND', reference: 'CASH-1', amountPaise: 20000, status: 'REVIEW' },
  ] };
  render(<RentalOrders route="/admin/orders?type=rental&booking=booking1" />);
  const region = await screen.findByRole('region', { name: 'Manage booking R-1001' });
  expect(screen.getByText(/is awaiting provider confirmation/)).toHaveTextContent('₹200');
  fireEvent.change(screen.getByLabelText('Original payment receipt'), { target: { value: 'CASH-1' } });
  fireEvent.change(screen.getByLabelText('Amount (₹)'), { target: { value: '201' } });
  fireEvent.change(screen.getByLabelText('Cash/bank refund receipt (online refunds use original provider)'), { target: { value: 'REFUND-CASH-3' } });
  fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Refund from this original cash receipt.' } });
  expect(region.querySelector('.rental-order-save')).toBeDisabled();
  expect(screen.getByText(/The refund cannot exceed this receipt/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Amount (₹)'), { target: { value: '200' } });
  fireEvent.click(region.querySelector('.rental-order-save'));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/rentals/bookings/booking1/refund', expect.objectContaining({ paymentReference: 'CASH-1', amountPaise: 20000, refundReference: 'REFUND-CASH-3' }), { silent: true }));
});

test('closed settlements require an explicit reason to reopen and cannot directly refund', async () => {
  current = { ...current, status: 'CLOSED', closedFromStatus: 'CANCELLED', financial: { ...current.financial, refundablePaise: 10000 } };
  render(<RentalOrders route="/admin/orders?type=rental&booking=booking1" />);
  const region = await screen.findByRole('region', { name: 'Manage booking R-1001' });
  fireEvent.click(screen.getByText('Other booking actions'));
  expect(within(screen.getByLabelText('Operation')).queryByRole('option', { name: 'Settle refundable balance' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Operation'), { target: { value: 'REOPEN_SETTLEMENT' } });
  expect(region.querySelector('.rental-order-save')).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Additional agreed refund needs review.' } });
  expect(region.querySelector('.rental-order-save')).toBeEnabled();
});

test('request review requires a recorded decision before resolving the request', async () => {
  current = { ...current, requests: [{ operationId: 'request1', type: 'CANCEL', status: 'PENDING', note: 'Event cancelled.' }] };
  render(<RentalOrders route="/admin/orders?type=rental&booking=booking1" />);
  const region = await screen.findByRole('region', { name: 'Manage booking R-1001' });
  fireEvent.change(screen.getByLabelText('Related customer request'), { target: { value: 'request1' } });
  expect(region.querySelector('.rental-order-save')).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Customer agreed cancellation review.' } });
  expect(region.querySelector('.rental-order-save')).toBeEnabled();
});
