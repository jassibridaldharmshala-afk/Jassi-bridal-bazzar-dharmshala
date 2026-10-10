import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import RentalShoppingCheckout from './RentalShoppingCheckout';
import api from '../../services/api';
import { openRentalPayment } from '../../utils/rentals';
const listingId = '700000000000000000000001', productId = '600000000000000000000001';
let mockUser, mockBag;
const mockSend = jest.fn(), mockResend = jest.fn(), mockVerify = jest.fn();
jest.mock('../../services/api', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: mockUser, sendOtp: mockSend, resendOtp: mockResend, verifyOtp: mockVerify }) }));
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
  api.get.mockImplementation(path => Promise.resolve(path.includes('/configuration') ? config : path.includes('/payment-methods') ? [{ key: 'UPI', label: 'UPI', enabled: true }] : path.includes('/catalogue') ? { rows: [offer] } : path.includes('/slots') ? { rows: [{ time: '10:00', available: true }, { time: '11:00', available: true }, { time: '17:00', available: false }] } : []));
  api.post.mockImplementation((path, body) => Promise.resolve(path.includes('/quote') ? quoted(body) : path.endsWith('/bookings?store=bridal-shop') ? { _id: 'booking', status: 'CONFIRMED', quote: quoted(body).quote } : {}));
});
async function contactReview() { fireEvent.click(await screen.findByRole('button', { name: 'Review booking' })); await screen.findByRole('button', { name: /Pay at pickup/ }); await waitFor(() => expect(screen.getByLabelText(/I have reviewed/)).toBeEnabled()); }
async function chooseDates() {
  await screen.findByLabelText('Use day / occasion date');
  fireEvent.change(screen.getByLabelText('Use day / occasion date'), { target: { value: '2030-01-10' } });
  fireEvent.change(screen.getByLabelText('Pickup date'), { target: { value: '2030-01-09' } });
  fireEvent.change(screen.getByLabelText('Return date'), { target: { value: '2030-01-11' } });
  await waitFor(() => expect(screen.getByLabelText('Return time')).toHaveValue('10:00'));
}
async function dates(review = true) {
  await chooseDates();
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await screen.findByLabelText('Full name'); if (review) await contactReview();
}

const existingBookingId = '800000000000000000000001';
const ownerConflict = () => Object.assign(new Error("You've already booked this lehenga for these dates."), { code: 'RENTAL_ALREADY_BOOKED', booking: { id: existingBookingId } });

test('an existing owner booking has a scoped booking link and changed dates require a fresh quote', async () => {
  const navigate = jest.fn(); api.post.mockRejectedValueOnce(ownerConflict());
  render(<RentalShoppingCheckout navigate={navigate} />); await chooseDates();
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Already in your bookings');
  expect(mockBag.consume).not.toHaveBeenCalled(); expect(openRentalPayment).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'View your booking' }));
  expect(navigate).toHaveBeenCalledWith('/store/bridal-shop/rentals?id=' + existingBookingId);
  fireEvent.click(screen.getByRole('button', { name: 'Choose other dates' }));
  expect(screen.queryByRole('button', { name: 'View booking' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Use day / occasion date'), { target: { value: '2030-01-11' } });
  fireEvent.change(screen.getByLabelText('Return date'), { target: { value: '2030-01-12' } });
  await waitFor(() => expect(screen.getByLabelText('Return time')).toHaveValue('10:00'));
  fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
  await screen.findByLabelText('Full name'); expect(api.post.mock.calls.at(-1)[1].useDates).toEqual(['2030-01-11']);
});

test('booked dates explain the shortage without someone else\'s booking link; rechecking can recover released capacity', async () => {
  api.post.mockRejectedValueOnce(Object.assign(new Error('This lehenga is already booked for these dates. Choose other dates.'), { code: 'OUT_OF_STOCK' }));
  render(<RentalShoppingCheckout navigate={jest.fn()} />); await chooseDates();
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Dates unavailable');
  expect(screen.queryByRole('button', { name: 'View your booking' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Check dates again' }));
  await screen.findByLabelText('Full name'); expect(api.post.mock.calls.filter(([path]) => path.includes('/bookings'))).toHaveLength(0);
});

test.each(['OUT_OF_STOCK', 'RENTAL_ALREADY_BOOKED'])('final %s rejection clears the stale quote and pending attempt without charging or consuming the bag', async code => {
  api.post.mockImplementation((path, body) => path.includes('/quote') ? Promise.resolve(quoted(body)) : Promise.reject(code === 'RENTAL_ALREADY_BOOKED' ? ownerConflict() : Object.assign(new Error('Already booked for these dates.'), { code })));
  const navigate = jest.fn(); render(<RentalShoppingCheckout navigate={navigate} />); await dates();
  fireEvent.click(screen.getByRole('button', { name: /Pay at pickup/ }));
  await waitFor(() => expect(screen.getByLabelText(/I have reviewed/)).toBeEnabled());
  fireEvent.click(screen.getByLabelText(/I have reviewed/)); fireEvent.click(screen.getByRole('button', { name: 'Confirm booking' }));
  await screen.findByRole('alert');
  expect(screen.queryByRole('button', { name: 'Recover booking' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Confirm booking' })).not.toBeInTheDocument();
  expect(sessionStorage.getItem('rental-reserve:bridal-shop:customer')).toBeNull();
  expect(mockBag.consume).not.toHaveBeenCalled(); expect(openRentalPayment).not.toHaveBeenCalled(); expect(navigate).not.toHaveBeenCalled();
  expect(api.post.mock.calls.filter(([path]) => path.includes('/bookings?'))).toHaveLength(1);
});

test('guest date planning rechecks identity after OTP and detects an existing booking before payment', async () => {
  mockUser = null; mockSend.mockResolvedValue({ otpLength: 6, resendAfterSeconds: 60 });
  mockVerify.mockImplementation(async () => { mockUser = { _id: 'customer', phone: '9000000001', isPhoneVerified: true }; return { user: mockUser }; });
  api.post.mockImplementationOnce((_path, body) => Promise.resolve(quoted(body))).mockRejectedValueOnce(ownerConflict());
  render(<RentalShoppingCheckout navigate={jest.fn()} />); await dates(false);
  fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Priya' } });
  fireEvent.change(screen.getByLabelText('Mobile number'), { target: { value: '9000000001' } });
  fireEvent.click(screen.getByLabelText(/I agree to the/)); fireEvent.click(screen.getByRole('button', { name: 'Send OTP' }));
  fireEvent.change(await screen.findByLabelText('OTP digit 1'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Verify & continue' }));
  await screen.findByRole('button', { name: 'View your booking' });
  expect(api.post.mock.calls.filter(([path]) => path.includes('/bookings'))).toHaveLength(0);
  expect(openRentalPayment).not.toHaveBeenCalled();
});

test('pickup payment uses a fresh accepted quote, preserves only use days, and creates one confirmed booking', async () => {
  const navigate = jest.fn(); render(<RentalShoppingCheckout navigate={navigate} />); await dates();
  fireEvent.click(screen.getByRole('button', { name: /Pay at pickup/ }));
  expect(screen.getByLabelText(/I have reviewed/)).toBeDisabled();

  await waitFor(() => expect(api.post.mock.calls.filter(([path]) => path.includes('/quote'))).toHaveLength(3));
  fireEvent.click(screen.getByLabelText(/I have reviewed/)); fireEvent.click(screen.getByRole('button', { name: 'Confirm booking' }));
  await waitFor(() => expect(navigate).toHaveBeenCalledWith('/store/bridal-shop/rental-success?id=booking'));
  const request = api.post.mock.calls.find(([path]) => path.includes('/bookings?'))[1];
  expect(request.useDates).toEqual(['2030-01-10']); expect(request.paymentPlan).toBe('PICKUP'); expect(request.quoteFingerprint).toBe('PICKUP'); expect(request.pickupAt).toBe('2030-01-09T04:30:00.000Z'); expect(mockBag.consume).toHaveBeenCalledWith(mockBag.items, 'booking'); expect(openRentalPayment).not.toHaveBeenCalled();
});
test('guest quotes first, then verifies inline without losing the bag or navigating to login', async () => {
  mockUser = null; mockSend.mockResolvedValue({ otpLength: 6, resendAfterSeconds: 60 });
  mockVerify.mockImplementation(async () => { mockUser = { _id: 'customer', phone: '9000000001', isPhoneVerified: true }; return { user: mockUser }; });
  const navigate = jest.fn(); render(<RentalShoppingCheckout navigate={navigate} />); await dates(false);
  expect(api.post.mock.calls.some(([path]) => path.includes('/bookings'))).toBe(false);
  fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Priya' } });
  fireEvent.change(screen.getByLabelText('Mobile number'), { target: { value: '9000000001' } });
  fireEvent.click(screen.getByLabelText(/I agree to the/)); fireEvent.click(screen.getByRole('button', { name: 'Send OTP' }));
  fireEvent.change(await screen.findByLabelText('OTP digit 1'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Verify & continue' }));
  await screen.findByRole('heading', { name: 'Review your booking' });
  expect(navigate).not.toHaveBeenCalled(); expect(mockVerify).toHaveBeenCalledWith(expect.objectContaining({ navigateOnSuccess: false, otp: '123456' }));
  expect(screen.getByLabelText(/I have reviewed/)).not.toBeChecked(); expect(mockBag.consume).not.toHaveBeenCalled();
  expect(JSON.stringify(sessionStorage)).not.toContain('123456');
});

test('checkout supports separately selected occasion days and validates delivery address at the Contact step', async () => {
  render(<RentalShoppingCheckout navigate={jest.fn()} />); await screen.findByLabelText('Use day / occasion date');
  fireEvent.change(screen.getByLabelText('Receive your rental'), { target: { value: 'SELF_DELIVERY' } });
  fireEvent.change(screen.getByLabelText('Receive your rental'), { target: { value: 'STORE_PICKUP' } });
  fireEvent.change(screen.getByLabelText('Use day / occasion date'), { target: { value: '2030-01-10' } }); fireEvent.click(screen.getByRole('button', { name: '+ Add another use day' })); fireEvent.change(screen.getByLabelText('Additional use day 1'), { target: { value: '2030-01-12' } });
  fireEvent.change(screen.getByLabelText('Pickup date'), { target: { value: '2030-01-09' } }); fireEvent.change(screen.getByLabelText('Return date'), { target: { value: '2030-01-13' } }); await waitFor(() => expect(screen.getByLabelText('Return time')).toHaveValue('10:00')); fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await contactReview(); expect(api.post.mock.calls[0][1].useDates).toEqual(['2030-01-10', '2030-01-12']);
});

test('full payment opens the existing gateway using server payment data and retains a pending hold when payment fails', async () => {
  const navigate = jest.fn(), payment = { provider: 'Razorpay', orderId: 'server-order', amountPaise: 350000 };
  api.post.mockImplementation((path, body) => Promise.resolve(path.includes('/quote') ? quoted(body) : path.includes('/payment?') ? payment : path.includes('/bookings?') ? { _id: 'booking', status: 'HELD', quote: quoted(body).quote } : {}));
  openRentalPayment.mockRejectedValueOnce(new Error('Payment window closed'));
  render(<RentalShoppingCheckout navigate={navigate} />); await dates();
  fireEvent.click(screen.getByRole('button', { name: /Pay in full/ }));
  await waitFor(() => expect(screen.getByLabelText(/I have reviewed/)).toBeEnabled());
  fireEvent.click(screen.getByLabelText(/I have reviewed/)); fireEvent.click(screen.getByRole('button', { name: 'Continue to payment' }));
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
  fireEvent.click(screen.getByRole('button', { name: /Pay at pickup/ }));
  await waitFor(() => expect(screen.getByLabelText(/I have reviewed/)).toBeEnabled());
  fireEvent.click(screen.getByLabelText(/I have reviewed/)); fireEvent.click(screen.getByRole('button', { name: 'Confirm booking' }));
  const recover = await screen.findByRole('button', { name: 'Recover booking' }); expect(mockBag.consume).not.toHaveBeenCalled();
  fireEvent.click(recover); await waitFor(() => expect(navigate).toHaveBeenCalledWith('/store/bridal-shop/rental-success?id=booking'));
  const requests = api.post.mock.calls.filter(([path]) => path.includes('/bookings?')).map(([, body]) => body);
  expect(requests).toHaveLength(2); expect(requests[1]).toEqual(requests[0]); expect(mockBag.consume).toHaveBeenCalledTimes(1);
});

test('delivery addresses are entered at Contact, sanitized, and re-quoted after editing', async () => {
  const saved = { _id: 'address-id', userId: 'customer', isDefault: true, fullName: 'Meera', mobile: '9000000001', houseNo: '24', area: 'Market', landmark: '', city: 'Dharamshala', state: 'Himachal Pradesh', pincode: '176215' };
  const get = api.get.getMockImplementation(); api.get.mockImplementation(path => path.startsWith('/user/addresses') ? Promise.resolve([saved]) : get(path));
  render(<RentalShoppingCheckout navigate={jest.fn()} />); await screen.findByLabelText('Receive your rental');
  fireEvent.change(screen.getByLabelText('Receive your rental'), { target: { value: 'SELF_DELIVERY' } }); await dates(false);
  fireEvent.click(screen.getByRole('button', { name: 'Review booking' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Complete the delivery');
  fireEvent.change(screen.getByLabelText('Use a saved address'), { target: { value: saved._id } }); await contactReview();
  const sent = api.post.mock.calls.filter(([path]) => path.includes('/quote')).at(-1)[1].bookingDetails;
  expect(sent.deliveryAddress).toEqual({ fullName: 'Meera', mobile: '9000000001', houseNo: '24', area: 'Market', landmark: '', city: 'Dharamshala', state: 'Himachal Pradesh', pincode: '176215' });
  expect(sent.collectionAddress).toEqual(sent.deliveryAddress); expect(sent.deliveryAddress.userId).toBeUndefined();
  fireEvent.click(screen.getByRole('button', { name: /Edit contact/ }));
  fireEvent.change(screen.getByLabelText('House / building'), { target: { value: '25' } }); await contactReview();
  expect(api.post.mock.calls.filter(([path]) => path.includes('/quote')).at(-1)[1].bookingDetails.deliveryAddress.houseNo).toBe('25');
  expect(screen.getByLabelText(/I have reviewed/)).not.toBeChecked();
});

test('unavailable saved 11 PM times must be corrected using real shop slots before quoting', async () => {
  sessionStorage.setItem('rental-checkout-dates:bridal-shop:', JSON.stringify({ savedAt: Date.now(), useStart: '2030-01-10', pickupAt: '2030-01-09T23:00', returnDueAt: '2030-01-11T23:00' }));
  render(<RentalShoppingCheckout navigate={jest.fn()} />);
  await screen.findByText(/saved pickup time is unavailable/);
  expect(screen.getByLabelText('Pickup time')).toHaveValue('');
  expect(screen.queryByRole('option', { name: /11:00 pm/i })).not.toBeInTheDocument();
  await screen.findByRole('button', { name: 'Continue' });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('available pickup time during shop hours');
  expect(api.post).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Pickup time'), { target: { value: '10:00' } });
  fireEvent.change(screen.getByLabelText('Return time'), { target: { value: '11:00' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await contactReview();
  expect(api.post.mock.calls[0][1].pickupAt).toBe('2030-01-09T04:30:00.000Z');
});

test('no online provider still permits an enabled pickup-payment booking', async () => {
  const get = api.get.getMockImplementation(), navigate = jest.fn();
  api.get.mockImplementation(path => path.includes('/payment-methods') ? Promise.resolve([]) : get(path));
  render(<RentalShoppingCheckout navigate={navigate} />); await dates();
  expect(screen.getByRole('button', { name: /Pay advance/ })).toBeDisabled();
  expect(screen.getByText(/Confirm your booking now and pay at the shop/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Pay at pickup/ })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByLabelText(/I have reviewed/)); fireEvent.click(screen.getByRole('button', { name: 'Confirm booking' }));
  await waitFor(() => expect(navigate).toHaveBeenCalledWith('/store/bridal-shop/rental-success?id=booking'));
  expect(openRentalPayment).not.toHaveBeenCalled();
});

test('closed/full shop dates and a failed slot lookup have actionable correction and retry', async () => {
  const get = api.get.getMockImplementation(); let failed = false;
  api.get.mockImplementation(path => {
    if (path.includes('/slots') && path.includes('kind=pickup') && !failed) { failed = true; return Promise.reject(new Error('Offline')); }
    if (path.includes('/slots') && path.includes('date=2030-01-09')) return Promise.resolve({ rows: [] });
    return get(path);
  });
  render(<RentalShoppingCheckout navigate={jest.fn()} />); await screen.findByLabelText('Use day / occasion date');
  fireEvent.change(screen.getByLabelText('Use day / occasion date'), { target: { value: '2030-01-10' } });
  fireEvent.click(await screen.findByRole('button', { name: 'Retry pickup times' }));
  await screen.findByText(/No pickup times are available/);
  await screen.findByRole('button', { name: 'Continue' });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(api.post).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Pickup date'), { target: { value: '2030-01-08' } });
  await waitFor(() => expect(screen.getByLabelText('Pickup time')).toHaveValue('10:00'));
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await contactReview();
});

test('changing bag quantities invalidates an in-flight quote and its acceptance', async () => {
  let resolveQuote; api.post.mockImplementation(() => new Promise(resolve => { resolveQuote = resolve; }));
  const view = render(<RentalShoppingCheckout navigate={jest.fn()} />);
  await screen.findByLabelText('Use day / occasion date'); fireEvent.change(screen.getByLabelText('Use day / occasion date'), { target: { value: '2030-01-10' } });
  await waitFor(() => expect(screen.getByLabelText('Return time')).toHaveValue('10:00'));
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  mockBag = { ...mockBag, items: [{ listingId, quantity: 2 }] }; view.rerender(<RentalShoppingCheckout navigate={jest.fn()} />);
  resolveQuote(quoted(api.post.mock.calls[0][1]));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled());
  expect(screen.queryByLabelText(/I have reviewed/)).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Booking summary' })).not.toBeInTheDocument();
});

test('duplicate use days fail with a specific correction before any quote or reservation', async () => {
  render(<RentalShoppingCheckout navigate={jest.fn()} />); await screen.findByLabelText('Use day / occasion date');
  fireEvent.change(screen.getByLabelText('Use day / occasion date'), { target: { value: '2030-01-10' } });
  fireEvent.click(screen.getByRole('button', { name: '+ Add another use day' }));
  fireEvent.change(screen.getByLabelText('Additional use day 1'), { target: { value: '2030-01-10' } });
  await waitFor(() => expect(screen.getByLabelText('Return time')).toHaveValue('10:00'));
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('only once');
  expect(api.post).not.toHaveBeenCalled();
});

test('refresh on Review re-quotes the same schedule and never restores rental-policy acceptance', async () => {
  const first = render(<RentalShoppingCheckout navigate={jest.fn()} />); await dates();
  fireEvent.click(screen.getByLabelText(/I have reviewed/)); first.unmount();
  const posts = api.post.mock.calls.length; render(<RentalShoppingCheckout navigate={jest.fn()} />);
  await screen.findByRole('heading', { name: 'Review your booking' });
  expect(api.post.mock.calls.length).toBeGreaterThan(posts); expect(screen.getByLabelText(/I have reviewed/)).not.toBeChecked();
  expect(api.post.mock.calls.at(-1)[1].useDates).toEqual(['2030-01-10']); expect(screen.getByRole('button', { name: 'Continue to payment' })).toBeDisabled();
});
test('a changed quote at reservation clears consent and requires date/price review without consuming the bag', async () => {
  const post = api.post.getMockImplementation();
  api.post.mockImplementation((path, body) => path.includes('/bookings?') ? Promise.reject(Object.assign(new Error('The price or policy changed. Review again.'), { code: 'RENTAL_QUOTE_CHANGED' })) : post(path, body));
  render(<RentalShoppingCheckout navigate={jest.fn()} />); await dates();
  fireEvent.click(screen.getByRole('button', { name: /Pay at pickup/ })); await waitFor(() => expect(screen.getByLabelText(/I have reviewed/)).toBeEnabled());
  fireEvent.click(screen.getByLabelText(/I have reviewed/)); fireEvent.click(screen.getByRole('button', { name: 'Confirm booking' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('price or policy changed');
  expect(screen.getByRole('heading', { name: 'Choose your dates' })).toBeInTheDocument(); expect(mockBag.consume).not.toHaveBeenCalled();
  expect(sessionStorage.getItem('rental-reserve:bridal-shop:customer')).toBeNull(); expect(screen.queryByLabelText(/I have reviewed/)).not.toBeInTheDocument();
});
test('a recovered reservation after refresh uses the identical attempt and accepted payload even if fresh quotes are unavailable', async () => {
  const navigate = jest.fn(); const post = api.post.getMockImplementation();
  api.post.mockImplementation((path, body) => path.includes('/bookings?') ? Promise.reject(new Error('Unknown network outcome')) : post(path, body));
  const first = render(<RentalShoppingCheckout navigate={navigate} />); await dates();
  fireEvent.click(screen.getByRole('button', { name: /Pay at pickup/ })); await waitFor(() => expect(screen.getByLabelText(/I have reviewed/)).toBeEnabled());
  fireEvent.click(screen.getByLabelText(/I have reviewed/)); fireEvent.click(screen.getByRole('button', { name: 'Confirm booking' }));
  await screen.findByRole('button', { name: 'Recover booking' });
  const accepted = api.post.mock.calls.find(([path]) => path.includes('/bookings?'))[1]; first.unmount();
  api.post.mockImplementation((path, body) => path.includes('/quote') ? Promise.reject(new Error('Store paused')) : Promise.resolve({ _id: 'booking', status: 'CONFIRMED', quote: quoted(body).quote }));
  render(<RentalShoppingCheckout navigate={navigate} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Recover booking' })).toBeEnabled()); fireEvent.click(screen.getByRole('button', { name: 'Recover booking' }));
  await waitFor(() => expect(navigate).toHaveBeenCalledWith('/store/bridal-shop/rental-success?id=booking'));
  expect(api.post.mock.calls.filter(([path]) => path.includes('/bookings?')).at(-1)[1]).toEqual(accepted);
});

test('verified inline-login remount restores the intended contact, re-quotes and clears the temporary handoff', async () => {
  sessionStorage.setItem('rental-checkout-dates:bridal-shop:', JSON.stringify({ savedAt: Date.now(), step: 1, useStart: '2030-01-10', pickupAt: '2030-01-09T10:00', returnDueAt: '2030-01-11T10:00', paymentPlan: 'PICKUP' }));
  sessionStorage.setItem('rental-verification-return:bridal-shop:', JSON.stringify({ savedAt: Date.now(), phone: '9000000001', expiresAt: Date.now() + 300000 }));
  sessionStorage.setItem('rental-guest-contact:bridal-shop:', JSON.stringify({ savedAt: Date.now(), customer: { name: 'Priya Sharma', email: 'priya@example.test' } }));
  render(<RentalShoppingCheckout navigate={jest.fn()} />);
  await screen.findByRole('heading', { name: 'Review your booking' });
  expect(screen.getByText('Priya Sharma')).toBeInTheDocument(); expect(screen.getByLabelText(/I have reviewed/)).not.toBeChecked();
  expect(sessionStorage.getItem('rental-verification-return:bridal-shop:')).toBeNull();
  expect(sessionStorage.getItem('rental-guest-contact:bridal-shop:')).toBeNull();
});

test('a verified phone change from another session clears the reviewed contact and acceptance', async () => {
  const view = render(<RentalShoppingCheckout navigate={jest.fn()} />); await dates(); fireEvent.click(screen.getByLabelText(/I have reviewed/));
  mockUser = { ...mockUser, phone: '9000000002' }; view.rerender(<RentalShoppingCheckout navigate={jest.fn()} />);
  await screen.findByRole('heading', { name: 'Contact details' }); expect(screen.getByLabelText('Mobile number')).toHaveValue('9000000002');
  expect(screen.queryByLabelText(/I have reviewed/)).not.toBeInTheDocument(); expect(mockBag.consume).not.toHaveBeenCalled();
});
