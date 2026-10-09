import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import api from '../../services/api';
import RentalAvailabilityCalendar from './RentalAvailabilityCalendar';
import RentalBookingDesk from './RentalBookingDesk';
import RentalPieceTimeline from './RentalPieceTimeline';
import RentalSetupWizard from './RentalSetupWizard';
import { localDateTime } from '../../utils/rentals';
jest.mock('../../services/api', () => ({ get: jest.fn(), post: jest.fn() }));
const policy = { timezone: 'Asia/Kolkata', minimumDays: 1, maximumDays: 30, maximumAdvanceDays: 180, pickupStart: '10:00', pickupEnd: '18:00', slotMinutes: 60, customerEmail: false, customerWhatsapp: false };
const today = localDateTime(new Date(), policy.timezone).slice(0, 10), month = today.slice(0, 7);
const row = { date: today, status: 'AVAILABLE', pickupAt: `${today}T04:30:00.000Z`, returnDueAt: new Date(Date.parse(`${today}T04:30:00.000Z`) + 86400000).toISOString(), rentalPaise: 100000, depositPaise: 200000, dueNowPaise: 230000 };
const offer = { _id: 'offer1', productId: 'product1', revision: 0, active: false, title: 'Bridal outfit', dailyRatePaise: 100000, depositPaise: 200000, advanceMode: 'STORE', requirements: [{ poolKey: 'outfit', label: 'Outfit', quantity: 1, productId: 'product1' }], fitting: { adjustable: true, alterationsAvailable: true, instructions: '' }, cleaningFeePaise: 0, alterationFeePaise: 0, packages: [] };
beforeEach(() => { jest.clearAllMocks(); });
test('complete-set calendar sends every quantity together and discards the previous selection when items change', async () => {
  api.post.mockResolvedValue({ rows: [row] });
  const choose = jest.fn(), items = [{ listingId: 'outfit', quantity: 1 }, { listingId: 'jewellery', quantity: 2 }];
  const view = render(<RentalAvailabilityCalendar items={items} policy={policy} storeSlug="shop" onChoose={choose} />);
  fireEvent.click(await screen.findByRole('button', { name: `${today}: Available` }));
  fireEvent.click(screen.getByRole('button', { name: 'Use these dates' }));
  expect(api.post).toHaveBeenCalledWith('/rentals/calendar?store=shop', expect.objectContaining({ items, month }), expect.anything());
  expect(choose).toHaveBeenCalledWith({ ...row, items });
  const next = [...items.slice(0, 1), { listingId: 'jewellery', quantity: 3 }];
  view.rerender(<RentalAvailabilityCalendar items={next} policy={policy} storeSlug="shop" onChoose={choose} />);
  expect(screen.queryByRole('button', { name: 'Use these dates' })).not.toBeInTheDocument();
  await waitFor(() => expect(api.post.mock.calls.at(-1)[1].items).toEqual(next));
});
test('complete-set calendar starts with the booking period and times already chosen by the customer', async () => {
  api.post.mockResolvedValue({ rows: [] });
  const start = localDateTime(new Date(Date.now() + 10 * 86400000), policy.timezone).slice(0, 10), end = new Date(Date.parse(`${start}T12:00Z`) + 6 * 86400000).toISOString().slice(0, 10);
  render(<RentalAvailabilityCalendar items={[{ listingId: 'outfit', quantity: 1 }]} policy={policy} initialSchedule={{ pickupAt: `${start}T12:00`, returnDueAt: `${end}T13:00` }} />);
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/rentals/calendar', expect.objectContaining({ month: start.slice(0, 7), days: 6, pickupTime: '12:00', returnTime: '13:00' }), expect.anything()));
  expect(api.post).toHaveBeenCalledTimes(1);
});
test('calendar refreshes on focus and minute ticks, clearing stale dates while the new check is pending', async () => {
  jest.useFakeTimers();
  try {
    api.get.mockResolvedValue({ rows: [row] });
    render(<RentalAvailabilityCalendar listing={offer} policy={policy} />);
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: `${today}: Available` }));
    expect(screen.getByRole('button', { name: 'Use these dates' })).toBeInTheDocument();
    let finish; api.get.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    fireEvent(window, new Event('focus'));
    expect(screen.queryByRole('button', { name: 'Use these dates' })).not.toBeInTheDocument();
    await act(async () => finish({ rows: [] }));
    expect(screen.getByText(/No available start dates this month/)).toBeInTheDocument();
    await act(async () => { jest.advanceTimersByTime(60000); });
    expect(api.get).toHaveBeenCalledTimes(3);
  } finally { jest.useRealTimers(); }
});
test('booking desk retains search and view across pagination and opens the chosen booking', async () => {
  const b = { _id: 'booking1', number: 'RENT-01', customer: { name: 'Bride', phone: '7831880907' }, status: 'CONFIRMED', policy, schedule: { pickupAt: row.pickupAt, returnDueAt: row.returnDueAt }, financial: { balancePaise: 10000, refundablePaise: 0 } };
  api.get.mockImplementation(path => Promise.resolve(path.includes('daily-desk') ? { counts: { pickups: 1, returns: 0, overdue: 0, balance: 1, refunds: 0 } } : { rows: [b], total: 31, page: new URLSearchParams(path.split('?')[1]).get('page'), pages: 2 }));
  const open = jest.fn(); render(<RentalBookingDesk base="/admin/rentals" timezone={policy.timezone} onOpen={open} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Manage RENT-01' })); expect(open).toHaveBeenCalledWith('booking1');
  fireEvent.click(screen.getByRole('button', { name: /Pending balance/ }));
  fireEvent.change(screen.getByLabelText('Search customer name, mobile or booking number'), { target: { value: '7831880907' } });
  fireEvent.click(screen.getByRole('button', { name: 'Search bookings' }));
  await waitFor(() => expect(api.get.mock.calls.some(([path]) => path.includes('view=balance') && path.includes('search=7831880907'))).toBe(true));
  await screen.findByRole('button', { name: 'Next bookings' }); fireEvent.click(screen.getByRole('button', { name: 'Next bookings' }));
  await waitFor(() => expect(api.get.mock.calls.some(([path]) => path.includes('page=2') && path.includes('view=balance') && path.includes('search=7831880907'))).toBe(true));
});
test('guided setup blocks activation, registers the exact component piece, then enables activation', async () => {
  let count = 0;
  const setup = () => ({ listing: offer, ready: count > 0, shopEnabled: true, checks: [{ key: 'pieces', label: 'Actual pieces registered', ready: count > 0 }], components: [{ ...offer.requirements[0], required: 1, configured: count, readyNow: count }] });
  api.get.mockImplementation(path => Promise.resolve(path.includes('/setup/') ? setup() : path.includes('/manage/products') ? { rows: [{ _id: 'product1', name: 'Bridal outfit' }], total: 1, page: 1, pages: 1 } : { rows: [offer], total: 1, page: 1, pages: 1 }));
  api.post.mockImplementation((path, input) => { if (path.endsWith('/assets')) { count++; return Promise.resolve({ _id: 'piece1' }); } return Promise.resolve({ ...offer, ...input }); });
  render(<RentalSetupWizard base="/admin/rentals" initialListingId="offer1" configuration={{ policy }} readiness={{ transactions: true }} run={work => work()} onTab={jest.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: /3.*Confirm/ }));
  expect(screen.getByRole('button', { name: 'Start accepting rentals' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: /2.*Quantity/ }));
  fireEvent.change(screen.getByLabelText('Unique physical piece code'), { target: { value: 'OUTFIT-01' } });
  fireEvent.click(screen.getByRole('button', { name: 'Register this piece' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/rentals/assets', expect.objectContaining({ productId: 'product1', poolKey: 'outfit', code: 'OUTFIT-01' })));
  await screen.findByText(/1 registered/);
  fireEvent.click(screen.getByRole('button', { name: 'Continue with registered pieces' }));
  expect(screen.getByRole('button', { name: 'Start accepting rentals' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Start accepting rentals' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/rentals/listings', expect.objectContaining({ _id: 'offer1', revision: 0, active: true })));
});
test('piece timeline displays booked and cleaning intervals and opens only linked bookings', async () => {
  api.get.mockResolvedValue({ dates: [today], rows: [{ _id: 'piece1', code: 'OUTFIT-01', label: 'Outfit', status: 'READY', segments: [{ kind: 'BOOKED', from: row.pickupAt, to: row.returnDueAt, bookingId: 'booking1', number: 'RENT-01' }, { kind: 'CLEANING', from: row.pickupAt, to: row.returnDueAt, needsRelease: true }] }], total: 1, page: 1, pages: 1, timezone: policy.timezone, checkedAt: new Date().toISOString(), note: 'Planning view' });
  const open = jest.fn(); render(<RentalPieceTimeline base="/admin/rentals" timezone={policy.timezone} onOpen={open} />);
  fireEvent.click(await screen.findByRole('button', { name: /BOOKED.*RENT-01/ })); expect(open).toHaveBeenCalledWith('booking1');
  expect(screen.getByRole('button', { name: 'CLEANING' })).toBeDisabled();
  expect(screen.queryByText('Available')).not.toBeInTheDocument();
});
