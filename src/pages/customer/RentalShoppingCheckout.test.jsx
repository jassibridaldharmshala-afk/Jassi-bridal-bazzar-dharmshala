import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import RentalShoppingCheckout from './RentalShoppingCheckout';
import api from '../../services/api';
import { openRentalPayment } from '../../utils/rentals';
const listingId = '700000000000000000000001', productId = '600000000000000000000001';
let mockUser, mockBag;
jest.mock('../../services/api', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('../../context/StorefrontContext', () => ({ useStorefront: () => ({ storeSlug: 'bridal-shop' }) }));
jest.mock('../../context/RentalBagContext', () => ({ useRentalBag: () => mockBag }));
jest.mock('../../context/BrandIdentityContext', () => ({ useBrandIdentity: () => ({ websiteName: 'Bridal shop' }) }));
jest.mock('@mantine/hooks', () => ({ useMediaQuery: () => true }));
jest.mock('../../utils/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('../../utils/rentals', () => ({ ...jest.requireActual('../../utils/rentals'), openRentalPayment: jest.fn() }));
const config = { mode: 'SALE_AND_RENTAL', policy: { timezone: 'Asia/Kolkata', slotMinutes: 60, pickupStart: '10:00', pickupEnd: '18:00', deliveryModes: ['STORE_PICKUP', 'SELF_DELIVERY'], paymentPlans: ['ADVANCE', 'FULL', 'PICKUP'], terms: 'Return on time.' }, contact: {} };
const offer = { _id: listingId, productId, title: 'Bridal lehenga', dailyRatePaise: 150000, depositPaise: 200000, product: { name: 'Bridal lehenga' } };
function quoted(body) { const due = body.paymentPlan === 'PICKUP' ? 0 : body.paymentPlan === 'FULL' ? 350000 : 245000; return { quoteFingerprint: body.paymentPlan, policyRevision: 1, timezone: 'Asia/Kolkata', terms: config.policy.terms, schedule: { days: body.useDates.length }, quote: { items: [{ title: 'Bridal lehenga', listingId, rentPaise: 150000, feesPaise: 0 }], totalPaise: 350000, dueNowPaise: due, remainingPaise: 350000 - due, depositPaise: 200000, paymentPlan: body.paymentPlan } }; }
beforeEach(() => {
  sessionStorage.clear(); jest.clearAllMocks(); window.scrollTo = jest.fn();
  mockUser = { _id: 'customer', name: 'Meera', phone: '9000000001', isPhoneVerified: true }; mockBag = { ready: true, items: [{ listingId, quantity: 1 }], consume: jest.fn() };
  api.get.mockImplementation(path => Promise.resolve(path.includes('/configuration') ? config : path.includes('/payment-methods') ? [{ key: 'UPI', label: 'UPI', enabled: true }] : path.includes('/catalogue') ? { rows: [offer] } : []));
  api.post.mockImplementation((path, body) => Promise.resolve(path.includes('/quote') ? quoted(body) : path.endsWith('/bookings?store=bridal-shop') ? { _id: 'booking', status: 'CONFIRMED', quote: quoted(body).quote } : {}));
});
async function dates() { await screen.findByLabelText('Use day / occasion date'); fireEvent.change(screen.getByLabelText('Use day / occasion date'), { target: { value: '2030-01-10' } }); fireEvent.change(screen.getByLabelText('Pickup date & time'), { target: { value: '2030-01-09T10:00' } }); fireEvent.change(screen.getByLabelText('Return date & time'), { target: { value: '2030-01-11T10:00' } }); fireEvent.click(screen.getByRole('button', { name: 'Continue' })); await screen.findByRole('button', { name: /Pay at pickup/ }); }
test('pickup payment uses a fresh accepted quote, preserves only use days, and creates one confirmed booking', async () => {
  const navigate = jest.fn(); render(<RentalShoppingCheckout navigate={navigate} />); await dates();
  fireEvent.click(screen.getByRole('button', { name: /Pay at pickup/ }));
  expect(screen.getByLabelText(/I have reviewed/)).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Update total' }));
  await waitFor(() => expect(api.post.mock.calls.filter(([path]) => path.includes('/quote'))).toHaveLength(2));
  fireEvent.click(screen.getByLabelText(/I have reviewed/)); fireEvent.click(screen.getByRole('button', { name: 'Confirm booking' }));
  await waitFor(() => expect(navigate).toHaveBeenCalledWith('/store/bridal-shop/rental-success?id=booking'));
  const request = api.post.mock.calls.find(([path]) => path.includes('/bookings?'))[1];
  expect(request.useDates).toEqual(['2030-01-10']); expect(request.paymentPlan).toBe('PICKUP'); expect(request.quoteFingerprint).toBe('PICKUP'); expect(request.pickupAt).toBe('2030-01-09T04:30:00.000Z'); expect(mockBag.consume).toHaveBeenCalledWith(mockBag.items, 'booking'); expect(openRentalPayment).not.toHaveBeenCalled();
});
test('guest can quote without contact controls; sign-in preserves the same rental checkout and excludes contacts from URL', async () => {
  mockUser = null; const navigate = jest.fn(); render(<RentalShoppingCheckout navigate={navigate} />); await dates();
  expect(screen.queryByLabelText('Booking name')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Sign in to book' })); expect(navigate).toHaveBeenCalledWith('/store/bridal-shop/login?redirect=%2Fstore%2Fbridal-shop%2Frental-checkout');
  expect(api.post.mock.calls.some(([path]) => path.includes('/bookings'))).toBe(false);
});
test('checkout supports separately selected occasion days and validates delivery address before quoting', async () => {
  render(<RentalShoppingCheckout navigate={jest.fn()} />); await screen.findByLabelText('Use day / occasion date');
  fireEvent.change(screen.getByLabelText('Receive your rental'), { target: { value: 'SELF_DELIVERY' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' })); expect(await screen.findByRole('alert')).toHaveTextContent('Complete the delivery');
  fireEvent.change(screen.getByLabelText('Receive your rental'), { target: { value: 'STORE_PICKUP' } });
  fireEvent.change(screen.getByLabelText('Use day / occasion date'), { target: { value: '2030-01-10' } }); fireEvent.click(screen.getByRole('button', { name: '+ Add another use day' })); fireEvent.change(screen.getByLabelText('Additional use day 1'), { target: { value: '2030-01-12' } });
  fireEvent.change(screen.getByLabelText('Pickup date & time'), { target: { value: '2030-01-09T10:00' } }); fireEvent.change(screen.getByLabelText('Return date & time'), { target: { value: '2030-01-13T10:00' } }); fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await screen.findByRole('button', { name: /Pay at pickup/ }); expect(api.post.mock.calls[0][1].useDates).toEqual(['2030-01-10', '2030-01-12']);
});

test('full payment opens the existing gateway using server payment data and retains a pending hold when payment fails', async () => {
  const navigate = jest.fn(), payment = { provider: 'Razorpay', orderId: 'server-order', amountPaise: 350000 };
  api.post.mockImplementation((path, body) => Promise.resolve(path.includes('/quote') ? quoted(body) : path.includes('/payment?') ? payment : path.includes('/bookings?') ? { _id: 'booking', status: 'HELD', quote: quoted(body).quote } : {}));
  openRentalPayment.mockRejectedValueOnce(new Error('Payment window closed'));
  render(<RentalShoppingCheckout navigate={navigate} />); await dates();
  fireEvent.click(screen.getByRole('button', { name: /Pay in full/ })); fireEvent.click(screen.getByRole('button', { name: 'Update total' }));
  await waitFor(() => expect(screen.getByLabelText(/I have reviewed/)).toBeEnabled());
  fireEvent.click(screen.getByLabelText(/I have reviewed/)); fireEvent.click(screen.getByRole('button', { name: 'Pay ₹3,500.00' }));
  await waitFor(() => expect(navigate).toHaveBeenCalledWith('/store/bridal-shop/rental-success?id=booking&payment=pending'));
  expect(openRentalPayment.mock.calls[0][0]).toBe(payment);
  expect(api.post.mock.calls.find(([path]) => path.includes('/bookings?'))[1].paymentPlan).toBe('FULL');
  expect(mockBag.consume).toHaveBeenCalledTimes(1);
});

test('an unknown reservation outcome retries the identical accepted request without a second booking attempt', async () => {
  const navigate = jest.fn(); let reservationCalls = 0;
  api.post.mockImplementation((path, body) => {
    if (path.includes('/quote')) return Promise.resolve(quoted(body));
    if (path.includes('/bookings?') && ++reservationCalls === 1) return Promise.reject(new Error('Connection interrupted'));
    return Promise.resolve({ _id: 'booking', status: 'CONFIRMED', quote: quoted(body).quote });
  });
  render(<RentalShoppingCheckout navigate={navigate} />); await dates();
  fireEvent.click(screen.getByRole('button', { name: /Pay at pickup/ })); fireEvent.click(screen.getByRole('button', { name: 'Update total' }));
  await waitFor(() => expect(screen.getByLabelText(/I have reviewed/)).toBeEnabled());
  fireEvent.click(screen.getByLabelText(/I have reviewed/)); fireEvent.click(screen.getByRole('button', { name: 'Confirm booking' }));
  const recover = await screen.findByRole('button', { name: 'Recover booking' }); expect(mockBag.consume).not.toHaveBeenCalled();
  fireEvent.click(recover); await waitFor(() => expect(navigate).toHaveBeenCalledWith('/store/bridal-shop/rental-success?id=booking'));
  const requests = api.post.mock.calls.filter(([path]) => path.includes('/bookings?')).map(([, body]) => body);
  expect(requests).toHaveLength(2); expect(requests[1]).toEqual(requests[0]); expect(mockBag.consume).toHaveBeenCalledTimes(1);
});

test('saved delivery addresses send only permitted address fields, excluding database and account metadata', async () => {
  const saved = { _id: 'address-id', userId: 'customer', isDefault: true, fullName: 'Meera', mobile: '9000000001', houseNo: '24', area: 'Market', landmark: '', city: 'Dharamshala', state: 'Himachal Pradesh', pincode: '176215' };
  const get = api.get.getMockImplementation();
  api.get.mockImplementation(path => path.startsWith('/user/addresses') ? Promise.resolve([saved]) : get(path));
  render(<RentalShoppingCheckout navigate={jest.fn()} />); await screen.findByLabelText('Use day / occasion date');
  fireEvent.change(screen.getByLabelText('Receive your rental'), { target: { value: 'SELF_DELIVERY' } });
  fireEvent.change(await screen.findByLabelText('Use a saved address'), { target: { value: saved._id } });
  fireEvent.change(screen.getByLabelText('Use day / occasion date'), { target: { value: '2030-01-10' } });
  fireEvent.change(screen.getByLabelText('Pickup date & time'), { target: { value: '2030-01-09T10:00' } });
  fireEvent.change(screen.getByLabelText('Return date & time'), { target: { value: '2030-01-11T10:00' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' })); await screen.findByRole('button', { name: /Pay at pickup/ });
  const sent = api.post.mock.calls.find(([path]) => path.includes('/quote'))[1].bookingDetails;
  expect(sent.deliveryAddress).toEqual({ fullName: 'Meera', mobile: '9000000001', houseNo: '24', area: 'Market', landmark: '', city: 'Dharamshala', state: 'Himachal Pradesh', pincode: '176215' });
  expect(sent.collectionAddress).toEqual(sent.deliveryAddress);
});
