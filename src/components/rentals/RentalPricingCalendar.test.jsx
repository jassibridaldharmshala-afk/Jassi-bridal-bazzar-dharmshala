import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import api from '../../services/api';
import RentalAvailabilityCalendar from './RentalAvailabilityCalendar';
import RentalOffer from './RentalOffer';
import RentalBookingTracker from './RentalBookingTracker';
import ProductRentalPricing, { pricingFromOffer, rentalPricingError } from '../admin/ProductRentalPricing';
import { localDateTime } from '../../utils/rentals';
jest.mock('../../services/api', () => ({ get: jest.fn() }));
jest.mock('../../context/StorefrontContext', () => ({ useStorefront: () => ({ storeSlug: 'bridal-shop' }) }));
const policy = { timezone: 'Asia/Kolkata', minimumDays: 1, maximumDays: 30, maximumAdvanceDays: 180, pickupStart: '10:00', pickupEnd: '18:00', slotMinutes: 60 };
const listing = { _id: 'offer1', title: 'Bridal look', dailyRatePaise: 75000, depositPaise: 200000, packages: [] };
const month = localDateTime(new Date(), policy.timezone).slice(0, 7);
const available = { date: `${month}-10`, status: 'AVAILABLE', pickupAt: `${month}-10T04:30:00.000Z`, returnDueAt: `${month}-12T04:30:00.000Z`, rentalPaise: 150000, depositPaise: 200000, dueNowPaise: 245000 };
beforeEach(() => jest.clearAllMocks());

test('rental pricing edits integer paise independently and chooses the existing offer', () => {
  const onChange = jest.fn();
  const value = pricingFromOffer({ ...listing, revision: 4 });
  render(<ProductRentalPricing value={value} offers={[listing]} onChange={onChange} apiPrefix="/admin" />);
  expect(screen.getByLabelText('Rental price per day (₹)')).toHaveValue(750);
  fireEvent.change(screen.getByLabelText('Rental price per day (₹)'), { target: { value: '850.50' } });
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ listingId: 'offer1', revision: 4, dailyRatePaise: 85050, depositPaise: 200000 }));
  expect(rentalPricingError({ dailyRatePaise: 0, depositPaise: 0 })).toMatch(/greater than zero/);
  expect(rentalPricingError({ dailyRatePaise: 10, depositPaise: 0, advanceMode: 'PERCENT', advancePercent: 0 })).toMatch(/1 to 100/);
  expect(rentalPricingError({ dailyRatePaise: 10, depositPaise: 0, advanceMode: 'FIXED', advanceAmountPaise: 1 })).toBe('');
});
test('multiple offers are selected explicitly without copying the first price to every offer', () => {
  const other = { ...listing, _id: 'offer2', title: 'Jewellery set', dailyRatePaise: 50000 };
  const onChange = jest.fn();
  render(<ProductRentalPricing value={pricingFromOffer(listing)} offers={[listing, other]} onChange={onChange} apiPrefix="/admin" />);
  fireEvent.change(screen.getByLabelText('Rental offer to price'), { target: { value: 'offer2' } });
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ listingId: 'offer2', dailyRatePaise: 50000 }));
});
test('calendar disables conflicts and passes confirmed timezone dates and totals to booking', async () => {
  api.get.mockResolvedValue({ rows: [available, { date: `${month}-11`, status: 'UNAVAILABLE' }, { date: `${month}-13`, status: 'UNBOOKABLE', reason: 'Shop closed' }] });
  const onChoose = jest.fn();
  render(<RentalAvailabilityCalendar listing={listing} policy={policy} storeSlug="bridal-shop" quantity={2} onChoose={onChoose} />);
  const choose = await screen.findByRole('button', { name: `${month}-10: Available` });
  expect(screen.getByRole('button', { name: `${month}-11: Unavailable for selected period` })).toBeDisabled();
  expect(screen.getByRole('button', { name: /Shop closed/ })).toBeDisabled();
  expect(api.get.mock.calls[0][0]).toContain('quantity=2'); expect(api.get.mock.calls[0][0]).toContain('store=bridal-shop');
  fireEvent.click(choose); fireEvent.click(screen.getByRole('button', { name: 'Use these dates' }));
  expect(onChoose).toHaveBeenCalledWith({ ...available, listingId: 'offer1' });
  fireEvent.change(screen.getByLabelText('Rental duration'), { target: { value: '3' } });
  expect(screen.queryByRole('button', { name: 'Use these dates' })).not.toBeInTheDocument();
  await waitFor(() => expect(api.get.mock.calls.at(-1)[0]).toContain('days=3'));
});
test('an old calendar response cannot replace the newly selected month', async () => {
  let finish;
  api.get.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue({ rows: [] });
  render(<RentalAvailabilityCalendar listing={listing} policy={policy} storeSlug="bridal-shop" />);
  fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  await act(async () => finish({ rows: [available] }));
  expect(screen.queryByRole('button', { name: `${month}-10: Available` })).not.toBeInTheDocument();
});
test('calendar failure keeps stale dates unselectable and supports retry', async () => {
  api.get.mockRejectedValueOnce(new Error('Please retry availability.')).mockResolvedValue({ rows: [available] });
  render(<RentalAvailabilityCalendar listing={listing} policy={policy} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Please retry availability.');
  expect(screen.queryByRole('button', { name: 'Use these dates' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  expect(await screen.findByRole('button', { name: `${month}-10: Available` })).toBeEnabled();
});
test('product rental option discloses rate/deposit and preserves UTC in the booking link', async () => {
  api.get.mockImplementation(path => Promise.resolve(path.includes('/calendar/') ? { rows: [available] } : { enabled: true, timezone: policy.timezone, policy, listings: [listing] }));
  const navigate = jest.fn();
  render(<RentalOffer productId="prod1" commerceMode="SALE_AND_RENTAL" navigate={navigate} />);
  fireEvent.click(await screen.findByRole('button', { name: 'See date availability' }));
  fireEvent.click(await screen.findByRole('button', { name: `${month}-10: Available` }));
  fireEvent.click(screen.getByRole('button', { name: 'Use these dates' }));
  const params = new URLSearchParams(navigate.mock.calls[0][0].split('?')[1]);
  expect(params.get('listing')).toBe('offer1'); expect(params.get('pickup')).toBe(available.pickupAt); expect(params.get('return')).toBe(available.returnDueAt);
  expect(screen.getByText('Refundable deposit')).toBeInTheDocument();
});
test('tracker shows current progress, refund state and expired holds without confirmed milestones', () => {
  const booking = { status: 'OUT', policy, schedule: { pickupAt: available.pickupAt, returnDueAt: '2000-01-01T10:00:00Z' }, financial: { balancePaise: 5000 }, events: [] };
  const view = render(<RentalBookingTracker booking={booking} />);
  expect(screen.getByText('Dispatched / with you').closest('li')).toHaveAttribute('aria-current', 'step');
  expect(screen.getByText(/Return deadline has passed/)).toBeInTheDocument();
  view.rerender(<RentalBookingTracker booking={{ ...booking, status: 'RETURNED', financial: { refundablePaise: 100000, reservedRefundPaise: 50000, refundedPaise: 20000 } }} />);
  expect(screen.getByText(/Refund processing:/)).toBeInTheDocument();
  view.rerender(<RentalBookingTracker booking={{ ...booking, status: 'HELD', expiresAt: '2000-01-01T10:00:00Z' }} />);
  expect(screen.getByRole('heading', { name: 'Hold expired' })).toBeInTheDocument();
  expect(screen.queryByText('Confirmed')).not.toBeInTheDocument();
});
