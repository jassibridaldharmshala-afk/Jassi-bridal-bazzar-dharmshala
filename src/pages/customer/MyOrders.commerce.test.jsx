import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import MyOrders from './MyOrders';
import MyRentals from './MyRentals';
import api from '../../services/api';
import { rentalShoppingRoute } from '../../utils/rentalShopping';

let mockUser = { _id: 'customer-one', name: 'Priya' };
let mockStoreSlug = '';
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: mockUser, logout: jest.fn() }) }));
jest.mock('../../context/StorefrontContext', () => ({ useStorefront: () => ({ storeSlug: mockStoreSlug }) }));
jest.mock('../../services/api', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../../components/rentals/RentalWaitlist', () => () => <div>Saved availability alerts</div>);

const sale = { _id: 'sale-one', createdAt: '2026-10-10T06:00:00Z', orderStatus: 'Confirmed', finalAmount: 2500, orderItems: [{ name: 'Gold bangles', quantity: 1, price: 2500 }], shippingAddress: { fullName: 'Priya' }, paymentStatus: 'Paid', paymentMethod: 'UPI' };
const rental = { _id: 'rental-one', number: 'RB-001', createdAt: '2026-10-10T06:00:00Z', status: 'CONFIRMED', policy: { timezone: 'Asia/Kolkata' }, schedule: { useDates: ['2026-10-17'], days: 1, pickupAt: '2026-10-16T05:30Z', returnDueAt: '2026-10-18T05:30Z' }, quote: { totalPaise: 150000, depositPaise: 50000, paymentPlan: 'PICKUP', deliveryMode: 'STORE_PICKUP', items: [{ listingId: 'offer-one', title: 'Orange Lehenga Choli', quantity: 1, rentPaise: 100000, image: '/lehenga.jpg' }] }, financial: { balancePaise: 150000, collectedPaise: 0 }, requests: [] };
const rentalList = rows => ({ rows, total: rows.length, page: 1, pages: 1 });
test.each(['/orders?type=rental', '/store/jassi/orders?type=rental', '/rentals?id=booking'])('rental history keeps rental cart and wishlist navigation for %s', route => {
  expect(rentalShoppingRoute(route)).toBe(true);
});
test.each(['/orders', '/orders?type=sale', '/store/jassi/orders'])('purchase history retains sale navigation for %s', route => {
  expect(rentalShoppingRoute(route)).toBe(false);
});
function Page({ initial = '/orders' }) { const [route, navigate] = useState(initial); return <MyOrders route={route} navigate={navigate} />; }
beforeEach(() => { jest.resetAllMocks(); mockUser = { _id: 'customer-one', name: 'Priya' }; mockStoreSlug = ''; api.get.mockImplementation(path => Promise.resolve(path.startsWith('/orders/') ? { items: [sale], total: 1, totalPages: 1 } : rentalList([rental]))); });

test('My Orders switches sale and rental history and mounts only the selected list', async () => {
  render(<Page />);
  expect(await screen.findByRole('button', { name: 'Gold bangles' })).toBeInTheDocument();
  const tabs = screen.getByRole('navigation', { name: 'Order types' });
  expect(within(tabs).getByRole('link', { name: 'Sale' })).toHaveAttribute('aria-current', 'page');
  expect(api.get.mock.calls.some(([path]) => path.startsWith('/rentals/'))).toBe(false);
  fireEvent.click(within(tabs).getByRole('link', { name: 'Rental' }));
  expect(await screen.findByRole('heading', { name: 'Orange Lehenga Choli' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Gold bangles' })).not.toBeInTheDocument();
  expect(within(tabs).getByRole('link', { name: 'Rental' })).toHaveAttribute('aria-current', 'page');
  expect(screen.queryByRole('button', { name: 'Returns & exchanges' })).not.toBeInTheDocument();
  fireEvent.click(within(tabs).getByRole('link', { name: 'Sale' }));
  expect(await screen.findByRole('button', { name: 'Gold bangles' })).toBeInTheDocument();
});
test('rental card shows use-day billing, custody dates, security and actual payment balance', async () => {
  const navigate = jest.fn(); render(<MyOrders route="/orders?type=rental" navigate={navigate} />);
  const card = await screen.findByRole('article', { name: 'Rental booking RB-001' });
  expect(within(card).getByText(/17 Oct 2026/)).toBeInTheDocument();
  expect(within(card).getByText(/1 paid use day.*Extra pickup and return days add no rent/)).toBeInTheDocument();
  expect(within(card).getByText(/16 Oct 2026/)).toBeInTheDocument();
  expect(within(card).getByText(/18 Oct 2026/)).toBeInTheDocument();
  expect(within(card).getByText('Payment due at pickup')).toBeInTheDocument();
  expect(within(card).getByText('Refundable security')).toBeInTheDocument();
  expect(within(card).getByRole('img', { name: rental.quote.items[0].title })).toBeInTheDocument();
  fireEvent.click(within(card).getByRole('button', { name: 'View booking' }));
  expect(navigate).toHaveBeenCalledWith('/rentals?id=rental-one');
});
test('legacy My rentals entry opens the same unified history and scoped links stay in the boutique', async () => {
  mockStoreSlug = 'jassi'; const navigate = jest.fn();
  render(<MyRentals navigate={navigate} route="/store/jassi/rentals" />);
  expect(await screen.findByRole('heading', { name: 'My Orders' })).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledWith('/rentals/bookings?page=1&store=jassi', expect.objectContaining({ forceRefetch: true }));
  expect(screen.getByRole('link', { name: 'Sale' })).toHaveAttribute('href', '/store/jassi/orders');
  fireEvent.click(await screen.findByRole('button', { name: 'View booking' }));
  expect(navigate).toHaveBeenCalledWith('/store/jassi/rentals?id=rental-one');
  fireEvent.click(screen.getByRole('link', { name: 'Sale' }));
  expect(navigate).toHaveBeenCalledWith('/store/jassi/orders');
});
test('rental filters and paging use server totals, without sale filters leaking to a different tab', async () => {
  api.get.mockResolvedValue({ ...rentalList([rental]), total: 31, pages: 2 });
  render(<Page initial="/orders?type=rental" />);
  await screen.findByText('31 rental bookings');
  fireEvent.change(screen.getByLabelText('Search rental bookings'), { target: { value: 'RB-001' } });
  fireEvent.click(screen.getByRole('button', { name: 'Search', exact: true }));
  await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/rentals/bookings?page=1&search=RB-001&store=', expect.any(Object)));
  fireEvent.change(screen.getByLabelText('Rental booking status'), { target: { value: 'READY' } });
  await screen.findByText('31 rental bookings found');
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/rentals/bookings?page=2&search=RB-001&status=READY&store=', expect.any(Object)));
  expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('link', { name: 'Sale' }));
  await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/orders/my-orders?page=1&limit=12&store=', expect.any(Object)));
});
test.each([undefined, { rows: [null] }, { rows: [{ _id: 'broken' }] }])('incomplete rental responses show retry instead of crashing or claiming empty history', async response => {
  api.get.mockResolvedValueOnce(response).mockResolvedValue(rentalList([rental]));
  render(<Page initial="/orders?type=rental" />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Your rental bookings could not be loaded');
  expect(screen.queryByText('No rental bookings yet')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('heading', { name: 'Orange Lehenga Choli' })).toBeInTheDocument();
});
test('zero rental bookings have their own shopping action and the sale tab remains available', async () => {
  api.get.mockResolvedValue(rentalList([])); const navigate = jest.fn();
  render(<MyOrders route="/orders?type=rental" navigate={navigate} />);
  expect(await screen.findByText('No rental bookings yet')).toBeInTheDocument();
  expect(screen.getByText('0 rental bookings')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Explore rentals' }));
  expect(navigate).toHaveBeenCalledWith('/rental-book');
  expect(screen.getByRole('link', { name: 'Sale' })).toBeInTheDocument();
});
test('account change discards the previous customer data and ignores their late response', async () => {
  let finishOld;
  api.get.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; })).mockResolvedValue(rentalList([{ ...rental, _id: 'new-rental', number: 'RB-NEW', quote: { ...rental.quote, items: [{ ...rental.quote.items[0], title: 'New customer rental' }] } }]));
  const view = render(<MyOrders route="/orders?type=rental" navigate={jest.fn()} />);
  mockUser = { _id: 'customer-two', name: 'Other customer' };
  view.rerender(<MyOrders route="/orders?type=rental" navigate={jest.fn()} />);
  await screen.findByRole('heading', { name: 'New customer rental' });
  await act(async () => finishOld(rentalList([rental])));
  expect(screen.queryByRole('article', { name: 'Rental booking RB-001' })).not.toBeInTheDocument();
});
test('expired holds, cancellation review and refund states use truthful customer labels', async () => {
  api.get.mockResolvedValue(rentalList([
    { ...rental, _id: 'held', number: 'RB-HELD', status: 'HELD', expiresAt: '2020-01-01T00:00Z' },
    { ...rental, _id: 'pending', number: 'RB-PENDING', requests: [{ type: 'CANCEL', status: 'PENDING' }] },
    { ...rental, _id: 'cancelled', number: 'RB-CANCELLED', status: 'CANCELLED', financial: { collectedPaise: 150000, refundablePaise: 120000, refundedPaise: 20000 } }
  ]));
  render(<Page initial="/orders?type=rental" />);
  const held = await screen.findByRole('article', { name: 'Rental booking RB-HELD' });
  expect(within(held).getByText('Reservation expired')).toBeInTheDocument();
  expect(screen.getByText('Cancellation under review')).toBeInTheDocument();
  const cancelled = screen.getByRole('article', { name: 'Rental booking RB-CANCELLED' });
  expect(within(cancelled).getByText('Refund processed')).toBeInTheDocument();
  expect(within(cancelled).queryByText('Balance due')).not.toBeInTheDocument();
  expect(within(cancelled).getByText('Refund available')).toBeInTheDocument();
});
test('a refresh failure retains the last bookings with a stale warning and can recover', async () => {
  api.get.mockResolvedValueOnce(rentalList([rental])).mockRejectedValueOnce(new Error('Network unavailable')).mockResolvedValue(rentalList([rental]));
  render(<Page initial="/orders?type=rental" />);
  await screen.findByRole('heading', { name: 'Orange Lehenga Choli' });
  fireEvent.click(screen.getByRole('button', { name: 'Refresh rental bookings' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('These updates may be out of date');
  expect(screen.getByRole('heading', { name: 'Orange Lehenga Choli' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
});
test('signed-out order history makes no private requests and sign-in preserves the rental tab and store', () => {
  mockUser = null; mockStoreSlug = 'jassi'; const navigate = jest.fn();
  render(<MyOrders route="/orders?type=rental" navigate={navigate} />);
  expect(api.get).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(navigate).toHaveBeenCalledWith('/store/jassi/login?redirect=' + encodeURIComponent('/store/jassi/orders?type=rental'));
});
