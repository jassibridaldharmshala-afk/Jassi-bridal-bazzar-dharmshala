import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import api from '../../services/api';
import RentalStudioSettings from './RentalStudioSettings';
import RentalMeasurements from './RentalMeasurements';
import RentalTrialDesk from './RentalTrialDesk';
import RentalWorkshop from './RentalWorkshop';
import RentalStudioWorkspace from './RentalStudioWorkspace';
import RentalCatalogueBrowser from './RentalCatalogueBrowser';
import RentalBookingForm from './RentalBookingForm';
import RentalWaitlist, { RentalWaitlistJoin } from './RentalWaitlist';
jest.mock('../../services/api', () => ({ get: jest.fn(), post: jest.fn() }));
const policy = { timezone: 'Asia/Kolkata', slotMinutes: 60, deliveryModes: ['STORE_PICKUP'], dateFirstEnabled: true, waitlistEnabled: true, tailoringEnabled: true, measurementProfilesEnabled: true };
const configuration = { mode: 'SALE_AND_RENTAL', policy };
const listing = { _id: 'one', productId: 'product1', title: 'Bridal lehenga', dailyRatePaise: 100000, depositPaise: 500000 };
const booking = { _id: 'book1', revision: 1, status: 'CONFIRMED', policy, allocations: [{ assetId: 'asset1', code: 'PIECE-001' }], schedule: { pickupAt: '2030-01-10T04:30Z', returnDueAt: '2030-01-12T04:30Z' } };
const run = async work => work();
beforeEach(() => jest.clearAllMocks());
test('all optional studio controls are exposed and default to off without touching sale mode', () => {
  const onChange = jest.fn(); render(<RentalStudioSettings policy={{ timezone: 'Asia/Kolkata' }} onChange={onChange} />);
  const switches = screen.getAllByRole('checkbox'); expect(switches).toHaveLength(7); switches.forEach(toggle => expect(toggle).not.toBeChecked());
  fireEvent.click(screen.getByRole('checkbox', { name: /Date-first rental shopping/ }));
  expect(onChange).toHaveBeenCalledWith('dateFirstEnabled', true);
  expect(screen.getByText(/Trial availability safety is always enforced/)).toBeInTheDocument();
});
test.each([390, 820, 1280])('date-first browsing at %ipx keeps normal review and compulsory advance flow', async width => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  api.get.mockImplementation(async path => ({ configuration, rows: [{ ...listing, ...(path.includes('/availability?') ? { availability: 'AVAILABLE' } : {}) }], page: 1, pages: 1 }));
  render(<RentalCatalogueBrowser storeSlug="boutique" user={{ name: 'Buyer', phone: '9000000001' }} onBooked={jest.fn()} />);
  await screen.findByRole('heading', { name: 'Start with your occasion dates' });
  expect(screen.queryByLabelText('Select Bridal lehenga')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Search pickup / delivery date'), { target: { value: '2030-01-10T10:00' } });
  fireEvent.change(screen.getByLabelText('Search return deadline'), { target: { value: '2030-01-12T10:00' } });
  fireEvent.click(screen.getByRole('button', { name: 'Find rentals for these dates' }));
  expect(await screen.findByText('One set available for these dates')).toBeInTheDocument();
  expect(screen.getByLabelText('Pickup / delivery time')).toHaveValue('2030-01-10T10:00');
  const call = api.get.mock.calls.find(([path]) => path.includes('/availability?'))[0];
  expect(new URL('https://test.local' + call).searchParams.get('pickupAt')).toBe('2030-01-10T04:30:00.000Z');
  expect(call).toContain('store=boutique'); expect(api.post).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Reserve rental' })).not.toBeInTheDocument();
});
test('measurement approval needs consent and explicit fitting approval and sends a structured revision', async () => {
  api.get.mockResolvedValue({ enabled: true, profile: null });
  api.post.mockResolvedValue({ profile: { revision: 1, versions: [{ number: 1, unit: 'in', values: { waist: 32.34 }, measuredAt: '2026-01-01T00:00Z', status: 'APPROVED' }] }, booking: { ...booking, measurementSnapshot: { number: 1, unit: 'in' } } });
  const onChange = jest.fn(); render(<RentalMeasurements booking={booking} base="/seller/rentals" enabled run={run} onChange={onChange} />);
  await screen.findByLabelText('Waist');
  expect(screen.getByRole('button', { name: 'Approve measurement revision' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Waist'), { target: { value: '32.34' } });
  fireEvent.click(screen.getByLabelText(/Customer consent to store/));
  expect(screen.getByRole('button', { name: 'Approve measurement revision' })).toBeDisabled();
  fireEvent.click(screen.getByLabelText(/Customer explicitly approved/));
  fireEvent.click(screen.getByRole('button', { name: 'Approve measurement revision' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/seller/rentals/bookings/book1/measurements', expect.objectContaining({ consent: true, customerApproved: true, status: 'APPROVED', unit: 'in', values: { waist: 32.34 }, revision: 0 }), { silent: true }));
  expect(onChange).toHaveBeenCalled();
});
test('trial outcomes use the booking revision and do not change payment or collection state', async () => {
  const value = { ...booking, trial: { at: '2030-01-03T04:30Z', until: '2030-01-03T05:30Z', status: 'SCHEDULED' } };
  api.post.mockResolvedValue({ ...value, trial: { ...value.trial, status: 'CANCELLED' }, revision: 2 });
  const onChange = jest.fn(); render(<RentalTrialDesk booking={value} base="/admin/rentals" canWrite run={run} onChange={onChange} />);
  expect(screen.getByRole('button', { name: 'Cancel trial' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Trial outcome note'), { target: { value: 'Customer rescheduled fitting' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cancel trial' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/rentals/bookings/book1/operation', expect.objectContaining({ action: 'TRIAL_UPDATE', status: 'CANCELLED', revision: 1 }), { silent: true }));
  expect(onChange).toHaveBeenCalled();
});
test('workshop completion needs verification and expense fields are hidden from non-cost staff', async () => {
  const task = { _id: 'task1', revision: 2, status: 'IN_PROGRESS', type: 'ALTERATION', piece: { code: 'PIECE-001' }, assetId: 'asset1', assignee: 'Tailor', dueAt: '2030-01-05T04:30Z', events: [] };
  api.get.mockResolvedValue({ rows: [task], page: 1, pages: 1, total: 1 }); api.post.mockResolvedValue({ ...task, status: 'COMPLETED' });
  render(<RentalWorkshop base="/seller/rentals" policy={policy} permissions={{ 'inventory.write': true, 'inventory.cost.read': false }} run={run} />);
  await screen.findByLabelText('Next status for PIECE-001');
  expect(screen.queryByLabelText(/Actual incurred cost/)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Work update note for PIECE-001'), { target: { value: 'Customer approved fit' } });
  expect(screen.getByRole('button', { name: 'Update workshop job' })).toBeDisabled();
  fireEvent.click(screen.getByLabelText('Fitting explicitly approved by customer'));
  fireEvent.click(screen.getByRole('button', { name: 'Update workshop job' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/seller/rentals/tasks/task1', expect.objectContaining({ revision: 2, status: 'COMPLETED', fittingApproved: true }), { silent: true }));
  expect(api.post.mock.calls[0][1]).not.toHaveProperty('actualCostPaise');
});
test('refund desk shows overdue/provider balances and opens existing settlement controls', async () => {
  api.get.mockImplementation(async path => path.includes('/refund-queue') ? { summary: { total: 1, overdue: 1, refundablePaise: 10000, pendingPaise: 5000 }, rows: [{ _id: 'book1', number: 'R-REFUND', customer: 'Buyer', ageHours: 80, dueAt: '2026-01-01T00:00Z', refundablePaise: 10000, pendingPaise: 5000, overdue: true }], page: 1, pages: 1 } : { rows: [], total: 0, pages: 0 });
  const onOpen = jest.fn(); render(<RentalStudioWorkspace base="/admin/rentals" policy={{ ...policy, refundDashboardEnabled: true }} permissions={{ 'inventory.read': false, 'returns.refund': true }} run={run} onOpen={onOpen} />);
  await screen.findByText('Settlement deadline passed');
  fireEvent.click(screen.getByRole('button', { name: 'Review settlement' }));
  expect(onOpen).toHaveBeenCalledWith('book1'); expect(api.post).not.toHaveBeenCalled();
});
test('waitlist join is consented, tenant-scoped and never calls the booking/payment APIs', async () => {
  api.post.mockResolvedValue({ _id: 'wait1' });
  const request = { pickupAt: '2030-01-10T04:30Z', returnDueAt: '2030-01-12T04:30Z', items: [{ listingId: 'one', quantity: 1 }] };
  render(<RentalWaitlistJoin request={request} user={{ email: 'buyer@example.com' }} storeSlug="boutique" />);
  expect(screen.getByRole('button', { name: 'Join date-specific waitlist' })).toBeDisabled();
  fireEvent.click(screen.getByLabelText(/I request availability updates/)); fireEvent.click(screen.getByRole('button', { name: 'Join date-specific waitlist' }));
  expect(await screen.findByText(/Waitlist request saved/)).toBeInTheDocument();
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(api.post).toHaveBeenCalledWith('/rentals/waitlist?store=boutique', expect.objectContaining({ consent: true, items: request.items, emailConsent: false, whatsappConsent: false }), { silent: true });
});
test('a failed availability quote exposes waitlist but never a reserve button', async () => {
  api.post.mockRejectedValue(Object.assign(new Error('Unavailable for your dates'), { code: 'OUT_OF_STOCK' }));
  render(<RentalBookingForm listings={[listing]} configuration={configuration} user={{ name: 'Buyer', phone: '9000000001' }} onBooked={jest.fn()} />);
  fireEvent.click(screen.getByLabelText('Select Bridal lehenga'));
  fireEvent.change(screen.getByLabelText('Pickup / delivery time'), { target: { value: '2030-01-10T10:00' } });
  fireEvent.change(screen.getByLabelText('Return deadline'), { target: { value: '2030-01-12T10:00' } });
  fireEvent.click(screen.getByRole('button', { name: 'Check dates & review price' }));
  await screen.findByRole('button', { name: 'Join date-specific waitlist' });
  expect(screen.queryByRole('button', { name: 'Reserve rental' })).not.toBeInTheDocument();
});
test('existing waitlist remains cancellable when new requests are disabled', async () => {
  const row = { _id: 'wait1', revision: 2, status: 'WAITING', schedule: booking.schedule, items: [{ title: 'Lehenga', quantity: 1 }] };
  api.get.mockImplementation(async path => path.includes('/configuration') ? { policy: { waitlistEnabled: false } } : { rows: [row], total: 1, pages: 1 });
  api.post.mockResolvedValue({ ...row, status: 'CANCELLED' });
  render(<RentalWaitlist storeSlug="boutique" navigate={jest.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Cancel availability request' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/rentals/waitlist/wait1/cancel?store=boutique', { revision: 2 }, { silent: true }));
});

test('a failed new date search never labels old availability as a fresh result', async () => {
  let dateChecks = 0;
  api.get.mockImplementation(async path => {
    if (path.includes('/availability?') && ++dateChecks === 2) throw new Error('Date service unavailable');
    return { configuration, rows: [{ ...listing, ...(path.includes('/availability?') ? { availability: 'AVAILABLE' } : {}) }], page: 1, pages: 1 };
  });
  render(<RentalCatalogueBrowser user={{ name: 'Buyer', phone: '9000000001' }} onBooked={jest.fn()} />);
  await screen.findByRole('heading', { name: 'Start with your occasion dates' });
  fireEvent.change(screen.getByLabelText('Search pickup / delivery date'), { target: { value: '2030-01-10T10:00' } });
  fireEvent.change(screen.getByLabelText('Search return deadline'), { target: { value: '2030-01-12T10:00' } });
  fireEvent.click(screen.getByRole('button', { name: 'Find rentals for these dates' }));
  await screen.findByText('One set available for these dates');
  fireEvent.change(screen.getByLabelText('Search return deadline'), { target: { value: '2030-01-13T10:00' } });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Find rentals for these dates' })).not.toBeDisabled());
  fireEvent.click(screen.getByRole('button', { name: 'Find rentals for these dates' }));
  await screen.findByText('Date service unavailable');
  expect(screen.queryByText('One set available for these dates')).not.toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalled();
});

test('trial scheduling honours owner duration and explicitly chooses physical pieces', async () => {
  api.post.mockResolvedValue({ ...booking, revision: 2, trial: { at: '2030-01-03T04:30Z', status: 'SCHEDULED' } });
  const onChange = jest.fn(); render(<RentalTrialDesk booking={booking} policy={{ ...policy, trialMinutes: 45 }} base="/admin/rentals" canWrite run={run} onChange={onChange} />);
  expect(screen.getByLabelText('Reserved trial duration (minutes)')).toHaveValue(45);
  fireEvent.change(screen.getByLabelText('Reserved trial date/time'), { target: { value: '2030-01-03T10:00' } });
  fireEvent.click(screen.getByRole('button', { name: 'Reserve trial pieces & slot' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/rentals/bookings/book1/operation', expect.objectContaining({ action: 'TRIAL', at: '2030-01-03T04:30:00.000Z', minutes: 45, assetIds: ['asset1'], revision: 1 }), { silent: true }));
  expect(onChange).toHaveBeenCalled();
});
