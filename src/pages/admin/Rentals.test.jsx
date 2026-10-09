import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Rentals from './Rentals';
import api from '../../services/api';
jest.mock('../../services/api', () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() }));
const booking = { _id: 'booking1', number: 'R-EXAMPLE', revision: 3, status: 'READY', customer: { name: 'Bride', phone: '9000000001' }, policy: { timezone: 'Asia/Kolkata', deliveryModes: ['STORE_PICKUP'] }, schedule: { pickupAt: '2030-01-10T04:30Z', returnDueAt: '2030-01-12T04:30Z' }, quote: { rentalPaise: 200000, depositPaise: 500000, dueNowPaise: 560000, items: [{ listingId: 'listing1', title: 'Lehenga', quantity: 1, rentPaise: 200000, depositPaise: 500000 }] }, financial: { balancePaise: 0 }, allocations: [{ assetId: 'asset1', code: 'LEHENGA-001', label: 'Lehenga M' }], requests: [], events: [], ledger: [], assessments: [] };
const workspace = { configuration: { mode: 'SALE_AND_RENTAL', policy: { timezone: 'Asia/Kolkata' } }, listings: [], assets: [], bookings: { rows: [booking], page: 1, pages: 1, total: 1 }, jobs: [], blocks: [], counts: {}, overdue: 0, readiness: { transactions: true } };

test('a physical piece opens the exact linked product setup and keeps the selected store', async () => {
  const piece = { _id: 'piece1', productId: 'product1', code: 'LEHENGA-001', label: 'Orange Lehenga', status: 'READY' };
  api.get.mockImplementation(async path => path.includes('/manage/assets') ? { rows: [piece], page: 1, total: 1, pages: 1 } : { ...workspace, assets: [piece] });
  const navigate = jest.fn();
  render(<Rentals route="/seller/rentals?tab=pieces&storeId=shopA" navigate={navigate} />);
  fireEvent.click(await screen.findByRole('button', { name: 'View linked product' }));
  expect(navigate).toHaveBeenCalledWith('/seller/rentals?tab=setup&productId=product1&storeId=shopA');
  expect(screen.getByText(/Ready means the piece is in usable condition/)).toBeInTheDocument();
});

test('direct settings links render and saving rental mode refreshes the studio warning without reloading', async () => {
  const configuration = { mode: 'SALE_AND_RENTAL', revision: 1, policy: { timezone: 'Asia/Kolkata', deliveryModes: ['STORE_PICKUP'], closedWeekdays: [], closedDates: [], cancellationRules: [], lateFeePerDayPaise: 0, deliveryFeePaise: 0, returnFeePaise: 0, terms: 'Existing shop terms' } };
  api.get.mockImplementation(async path => path.endsWith('/configuration') ? configuration : path.includes('/manage/') ? { rows: [], total: 0, pages: 1 } : path.includes('/daily-desk') ? { counts: {} } : path.includes('/bookings?') ? { rows: [], total: 0, pages: 1, page: 1 } : { ...workspace, configuration });
  api.put.mockResolvedValue({ ...configuration, mode: 'SALE_ONLY', revision: 2 });
  render(<Rentals route="/admin/rentals?tab=settings" />);
  expect(await screen.findByRole('heading', { name: 'Policies & settings' })).toBeInTheDocument();
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Enable rental shopping' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save rental settings' }));
  expect(await screen.findByText('Rental booking is switched off')).toBeInTheDocument();
  expect(api.put).toHaveBeenCalledWith('/admin/rentals/configuration', expect.objectContaining({ mode: 'SALE_ONLY', revision: 1 }), { silent: true });
});
test('scanner input accumulates a complete piece code and sends one acknowledged handover', async () => {
  api.get.mockImplementation(async path => path.includes('/bookings/') ? booking : workspace);
  api.post.mockResolvedValue({ ...booking, status: 'OUT', revision: 4 });
  render(<Rentals route="/admin/rentals?id=booking1" />);
  const scan = await screen.findByLabelText('Scan or enter piece code');
  fireEvent.change(scan, { target: { value: 'LEHENGA-001' } });
  expect(scan).toHaveValue('LEHENGA-001');
  fireEvent.keyDown(scan, { key: 'Enter' });
  expect(await screen.findByText('LEHENGA-001 confirmed.')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Operation note / acknowledgement / assessment reason'), { target: { value: 'Customer acknowledged the complete piece and condition.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply operation' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/rentals/bookings/booking1/operation', expect.objectContaining({ action: 'HANDOVER', revision: 3, assetIds: ['asset1'] }), { silent: true }));
});
test('named contact checks are explicit and reset after approved booking details change', async () => {
  const original = { ...booking, quote: { ...booking.quote, deliveryMode: 'STORE_PICKUP' }, bookingDetails: { pickupContact: { name: 'Sister', phone: '9876543211', authorised: true } } };
  api.get.mockImplementation(async path => path.includes('/bookings/') ? original : workspace);
  api.post.mockResolvedValue({ ...original, revision: 4, bookingDetails: { pickupContact: { name: 'Brother', phone: '9876543212', authorised: true } } });
  const view = render(<Rentals route="/admin/rentals?id=booking1" />);
  const check = await screen.findByLabelText('I checked the named contact and customer authorisation for this handover / return');
  expect(check).not.toBeChecked(); fireEvent.click(check); expect(check).toBeChecked();
  fireEvent.click(screen.getByText('Edit addresses, contacts & instructions'));
  fireEvent.change(screen.getByLabelText('Pickup / delivery contact — Name'), { target: { value: 'Brother' } });
  fireEvent.change(screen.getByLabelText('Pickup / delivery contact — Mobile number'), { target: { value: '9876543212' } });
  fireEvent.change(screen.getByLabelText('Reason for booking-detail changes'), { target: { value: 'Customer authorised brother instead' } });
  fireEvent.click(screen.getByLabelText('Customer explicitly approved these booking-detail changes')); fireEvent.click(screen.getByRole('button', { name: 'Save approved booking details' }));
  await waitFor(() => expect(screen.getByLabelText('Pickup / delivery contact — Name')).toHaveValue('Brother'));
  await waitFor(() => expect(screen.getByLabelText('I checked the named contact and customer authorisation for this handover / return')).not.toBeChecked());
  view.unmount();
});

test('rescheduling a use-day booking sends the explicitly agreed occasion dates and accepted total', async () => {
  const current = { ...booking, schedule: { ...booking.schedule, billingBasis: 'USE_DAYS', useDates: ['2030-01-11'] } };
  api.get.mockImplementation(async path => path.includes('/bookings/') ? current : workspace); api.post.mockResolvedValue(current);
  render(<Rentals route="/admin/rentals?id=booking1" />);
  fireEvent.change(await screen.findByLabelText('Operation'), { target: { value: 'DATES' } });
  expect(screen.getByLabelText('Agreed use days (YYYY-MM-DD, separated by commas)')).toHaveValue('2030-01-11');
  fireEvent.change(screen.getByLabelText('New pickup (leave blank for extension)'), { target: { value: '2030-02-09T10:00' } });
  fireEvent.change(screen.getByLabelText('New return deadline'), { target: { value: '2030-02-12T10:00' } });
  fireEvent.change(screen.getByLabelText('Agreed use days (YYYY-MM-DD, separated by commas)'), { target: { value: '2030-02-10, 2030-02-11' } });
  fireEvent.change(screen.getByLabelText('Explicitly accepted new total including deposit (₹)'), { target: { value: '9000' } });
  fireEvent.change(screen.getByLabelText('Operation note / acknowledgement / assessment reason'), { target: { value: 'Customer agreed to these use days and amount.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply operation' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/rentals/bookings/booking1/reschedule', expect.objectContaining({ useDates: ['2030-02-10', '2030-02-11'], acceptPricePaise: 900000, pickupAt: '2030-02-09T04:30:00.000Z', returnDueAt: '2030-02-12T04:30:00.000Z' }), { silent: true }));
});

test('switching shops clears the previous rental product and ignores a late workspace response', async () => {
  let resolveOld, resolveNew, calls = 0;
  api.get.mockImplementation(path => {
    if (path === '/seller/rentals') { calls++; return new Promise(resolve => { if (calls === 1) resolveOld = resolve; else resolveNew = resolve; }); }
    return Promise.resolve({ rows: [], total: 0, pages: 1, page: 1 });
  });
  const view = render(<Rentals route="/seller/rentals?tab=setup&storeId=shopA" />);
  await waitFor(() => expect(calls).toBe(1));
  view.rerender(<Rentals route="/seller/rentals?tab=setup&storeId=shopB" />);
  await waitFor(() => expect(calls).toBe(2));
  resolveNew({ ...workspace, configuration: { ...workspace.configuration, mode: 'SALE_ONLY' } });
  expect(await screen.findByText('Rental booking is switched off')).toBeInTheDocument();
  resolveOld(workspace);
  await waitFor(() => expect(screen.getByText('Rental booking is switched off')).toBeInTheDocument());
});
