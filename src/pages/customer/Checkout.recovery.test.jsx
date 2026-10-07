import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Checkout from './Checkout';
import api from '../../services/api';
import { openRazorpayCheckout } from '../../utils/razorpayCheckout';
import { pendingPaymentKey, readPendingPayment, savePendingPayment } from '../../utils/pendingPayment';

const mockCart = {}, mockToast = jest.fn();
jest.mock('../../context/CartContext', () => ({ useCart: () => mockCart }));
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { _id: 'user', phone: '9000000081', isPhoneVerified: true }, setToast: mockToast }) }));
jest.mock('../../hooks/useDesktopFeedback', () => () => ({ isDesktop: false, notify: jest.fn(() => false) }));
jest.mock('../../services/api', () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() }));
jest.mock('../../utils/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('../../utils/indiaPincode', () => ({ lookupPincode: jest.fn(async () => null) }));
jest.mock('../../utils/razorpayCheckout', () => ({ openRazorpayCheckout: jest.fn() }));

const address = { _id: 'home', fullName: 'Home Customer', mobile: '9000000081', houseNo: '1', area: 'Garden Road', city: 'New Delhi', state: 'Delhi', pincode: '110001', isDefault: true };
const line = { _id: 'line-a', product: { _id: 'a', name: 'Selected saree', price: 999, images: [] }, quantity: 1, size: 'Free Size', color: '', selected: true };
const quote = { totals: { totalMRP: 999, finalAmount: 1022, platformFee: 23 } };
beforeEach(() => {
  jest.clearAllMocks(); sessionStorage.clear(); localStorage.clear(); window.scrollTo = jest.fn();
  openRazorpayCheckout.mockReset();
  window.matchMedia = jest.fn(query => ({ matches: query.includes('max-width'), addEventListener: jest.fn(), removeEventListener: jest.fn() }));
  Object.assign(mockCart, { items: [line], hydrated: true, loading: false, error: '', pendingCount: 0, coupon: null, setCoupon: jest.fn(), completeCheckout: jest.fn(async () => ({ ok: true })), refresh: jest.fn() });
  api.get.mockImplementation(async path => path === '/user/addresses' ? [address] : { methods: [{ key: 'COD', label: 'Cash on Delivery', enabled: true }] });
  api.post.mockImplementation(async path => path === '/orders/quote' ? quote : path === '/orders/cod' ? { _id: 'new-order' } : { items: [] });
});

test('failed address requests show retry and do not pretend there are no saved addresses', async () => {
  api.get.mockRejectedValueOnce(new Error('Address connection interrupted'));
  render(<Checkout navigate={jest.fn()} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Address connection interrupted');
  expect(screen.queryByText('No saved addresses yet.')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry delivery addresses' }));
  expect(await screen.findByText('Home Customer')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Continue to payment' })).toBeEnabled();
});

test('payment settings failure can recover without reloading the page', async () => {
  let failed = true;
  const originalGet = api.get.getMockImplementation();
  api.get.mockImplementation(path => path === '/settings/payment-methods' && failed ? Promise.reject(new Error('Payment options unavailable')) : originalGet(path));
  render(<Checkout navigate={jest.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Continue to payment' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Payment options unavailable');
  expect(screen.getByRole('button', { name: 'Pay Now' })).toBeDisabled();
  failed = false; fireEvent.click(screen.getByRole('button', { name: 'Retry payment options' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Place COD Order' })).toBeEnabled());
});

test('the server quote replaces stale payment settings for the selected address', async () => {
  const originalPost = api.post.getMockImplementation();
  api.post.mockImplementation((path, body) => path === '/orders/quote'
    ? Promise.resolve({ ...quote, paymentOptions: [
      { key: 'COD', label: 'Cash on Delivery', enabled: false, disabledReason: 'COD is unavailable for this PIN code.' },
      { key: 'UPI', label: 'UPI', enabled: true },
    ] })
    : originalPost(path, body));
  render(<Checkout navigate={jest.fn()} />);

  fireEvent.click(await screen.findByRole('button', { name: 'Continue to payment' }));

  expect(await screen.findByRole('button', { name: 'Pay Now' })).toBeEnabled();
  expect(screen.getByText('COD is unavailable for this PIN code.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Place COD Order' })).not.toBeInTheDocument();
});

test('an order total failure offers retry and blocks submission until the server responds', async () => {
  let failQuote = true;
  const originalPost = api.post.getMockImplementation();
  api.post.mockImplementation((path, body) => path === '/orders/quote' && failQuote ? Promise.reject(new Error('Cannot calculate total')) : originalPost(path, body));
  render(<Checkout navigate={jest.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Continue to payment' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Cannot calculate total');
  expect(screen.getByRole('button', { name: 'Place COD Order' })).toBeDisabled();
  failQuote = false; fireEvent.click(screen.getByRole('button', { name: 'Retry order total' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Place COD Order' })).toBeEnabled());
});

test('checkout selects the newly saved address from the real array response contract', async () => {
  const originalPost = api.post.getMockImplementation();
  api.post.mockImplementation((path, body) => path === '/user/addresses' ? Promise.resolve([address, { ...address, ...body, _id: 'new-address', fullName: 'New Recipient', isDefault: false }]) : originalPost(path, body));
  render(<Checkout navigate={jest.fn()} />);
  await screen.findByText('Home Customer');
  fireEvent.click(screen.getByRole('button', { name: 'Change' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add new address' }));
  fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'New Recipient' } });
  fireEvent.submit(screen.getByRole('button', { name: 'Save Address' }).closest('form'));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Select New Recipient address' })).toHaveAttribute('aria-pressed', 'true'));
  fireEvent.click(screen.getByRole('button', { name: 'Deliver to this address' }));
  expect(screen.getByText('New Recipient')).toBeInTheDocument();
  expect(screen.queryByText('Home Customer')).not.toBeInTheDocument();
});

test('broken attribution data and failed bag cleanup cannot turn a created COD order into a failed order', async () => {
  sessionStorage.setItem('samira_attribution', 'broken json');
  mockCart.completeCheckout.mockRejectedValue(new Error('Bag cleanup connection lost'));
  const navigate = jest.fn(); render(<Checkout navigate={navigate} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Continue to payment' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Place COD Order' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Place COD Order' }));
  await waitFor(() => expect(navigate).toHaveBeenCalledWith('/order-success?id=new-order'));
  expect(api.post).toHaveBeenCalledWith('/orders/cod', expect.objectContaining({ attribution: {} }));
  fireEvent.click(screen.getByRole('button', { name: 'Place COD Order' }));
  expect(api.post.mock.calls.filter(([path]) => path === '/orders/cod')).toHaveLength(1);
});

test('failed initial bag hydration retains the cart and coupon until retry succeeds', async () => {
  Object.assign(mockCart, { items: [], error: 'Bag connection interrupted' });
  const navigate = jest.fn(); const { rerender } = render(<Checkout navigate={navigate} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Bag connection interrupted');
  expect(navigate).not.toHaveBeenCalled(); expect(mockCart.setCoupon).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Retry your bag' }));
  expect(mockCart.refresh).toHaveBeenCalledTimes(1);
  await act(async () => { Object.assign(mockCart, { items: [line], error: '' }); rerender(<Checkout navigate={navigate} />); });
  expect(await screen.findByRole('button', { name: 'Continue to payment' })).toBeEnabled();
});

test('a delayed payment verification retries the receipt without starting or failing a second payment', async () => {
  const originalGet = api.get.getMockImplementation();
  api.get.mockImplementation(path => path === '/settings/payment-methods' ? Promise.resolve({ methods: [{ key: 'UPI', label: 'UPI', enabled: true }] }) : originalGet(path));
  const response = { razorpay_order_id: 'gateway-order', razorpay_payment_id: 'gateway-payment', razorpay_signature: 'test-signature' };
  openRazorpayCheckout.mockImplementation(({ onSuccess }) => onSuccess(response));
  let verifyFails = true;
  const originalPost = api.post.getMockImplementation();
  api.post.mockImplementation((path, body) => path === '/payments/create-order' ? Promise.resolve({ razorpayOrderId: 'gateway-order', keyId: 'test-key', amount: 102200 }) : path === '/payments/verify' ? (verifyFails ? Promise.reject(new Error('Verification connection interrupted')) : Promise.resolve({ order: { _id: 'verified-order' } })) : originalPost(path, body));
  const navigate = jest.fn(); render(<Checkout navigate={navigate} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Continue to payment' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Pay Now' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Pay Now' }));
  await screen.findByRole('heading', { name: 'Payment confirmation pending' });
  expect(navigate).not.toHaveBeenCalledWith('/payment-failed');
  expect(api.post.mock.calls.some(([path]) => path === '/payments/failure')).toBe(false);
  verifyFails = false;
  fireEvent.click(screen.getByRole('button', { name: 'Retry confirmation' }));
  await waitFor(() => expect(navigate).toHaveBeenCalledWith('/order-success?id=verified-order'));
  expect(api.post.mock.calls.filter(([path]) => path === '/payments/create-order')).toHaveLength(1);
  expect(api.post).toHaveBeenCalledWith('/payments/verify', response);
});

test('a lost payment setup response retries the same checkout attempt without cancelling it', async () => {
  const originalGet = api.get.getMockImplementation();
  api.get.mockImplementation(path => path === '/settings/payment-methods' ? Promise.resolve({ methods: [{ key: 'UPI', label: 'UPI', enabled: true }] }) : originalGet(path));
  const originalPost = api.post.getMockImplementation();
  let setupCalls = 0;
  api.post.mockImplementation((path, body) => {
    if (path !== '/payments/create-order') return originalPost(path, body);
    setupCalls += 1;
    if (setupCalls === 1) return Promise.reject(Object.assign(new Error('Connection interrupted'), { status: 'FETCH_ERROR' }));
    return Promise.resolve({ razorpayOrderId: 'recovered-gateway-order', keyId: 'test-key', amount: 102200 });
  });
  openRazorpayCheckout.mockImplementation(() => new Promise(() => {}));
  render(<Checkout navigate={jest.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Continue to payment' }));
  const pay = await screen.findByRole('button', { name: 'Pay Now' });
  await waitFor(() => expect(pay).toBeEnabled());

  fireEvent.click(pay);
  expect(await screen.findByRole('alert')).toHaveTextContent('you will not be charged twice');
  expect(api.post.mock.calls.some(([path]) => path === '/payments/failure')).toBe(false);
  const firstAttempt = api.post.mock.calls.find(([path]) => path === '/payments/create-order')[1].checkoutAttemptId;

  await waitFor(() => expect(pay).toBeEnabled());
  fireEvent.click(pay);
  await waitFor(() => expect(openRazorpayCheckout).toHaveBeenCalled());
  const setupPayloads = api.post.mock.calls.filter(([path]) => path === '/payments/create-order').map(([, body]) => body);
  expect(setupPayloads).toHaveLength(2);
  expect(setupPayloads[1].checkoutAttemptId).toBe(firstAttempt);
  expect(api.post.mock.calls.some(([path]) => path === '/payments/failure')).toBe(false);
});

test('changing the delivery pincode rechecks COD availability before an order can be submitted', async () => {
  const other = { ...address, _id: 'work', fullName: 'Work Customer', pincode: '400001', isDefault: false };
  const originalGet = api.get.getMockImplementation();
  api.get.mockImplementation(path => path === '/user/addresses' ? Promise.resolve([address, other]) : originalGet(path));
  const originalPost = api.post.getMockImplementation();
  api.post.mockImplementation((path, body) => path === '/orders/quote' && body.shippingAddress?.pincode === '400001'
    ? Promise.reject(new Error('Cash on Delivery is not available for this delivery pincode.')) : originalPost(path, body));
  render(<Checkout navigate={jest.fn()} />);
  await screen.findByText('Home Customer');
  fireEvent.click(screen.getByRole('button', { name: 'Change' }));
  fireEvent.click(screen.getByRole('button', { name: 'Select Work Customer address' }));
  fireEvent.click(screen.getByRole('button', { name: 'Deliver to this address' }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue to payment' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('not available for this delivery pincode');
  expect(api.post).toHaveBeenCalledWith('/orders/quote', expect.objectContaining({ shippingAddress: other }));
  expect(screen.getByRole('button', { name: 'Place COD Order' })).toBeDisabled();
  expect(api.post.mock.calls.some(([path]) => path === '/orders/cod')).toBe(false);
});

test('an incomplete server quote cannot enable payment using placeholder bag totals', async () => {
  const originalPost = api.post.getMockImplementation();
  api.post.mockImplementation((path, body) => path === '/orders/quote' ? Promise.resolve({ totals: {} }) : originalPost(path, body));
  render(<Checkout navigate={jest.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Continue to payment' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to calculate order totals');
  expect(screen.getByRole('button', { name: 'Place COD Order' })).toBeDisabled();
});

test('payment confirmation survives checkout remount and an empty bag without charging again', async () => {
  const response = { razorpay_order_id: 'paid-order', razorpay_payment_id: 'paid-payment', razorpay_signature: 'test-signature' };
  const key = pendingPaymentKey({ _id: 'user' });
  savePendingPayment(key, { response, purchased: [line] });
  Object.assign(mockCart, { items: [] });
  const originalPost = api.post.getMockImplementation();
  api.post.mockImplementation((path, body) => path === '/payments/verify' ? Promise.resolve({ order: { _id: 'recovered-order' } }) : originalPost(path, body));
  const navigate = jest.fn(); render(<Checkout navigate={navigate} />);
  await screen.findByRole('heading', { name: 'Payment confirmation pending' });
  expect(navigate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Retry confirmation' }));
  await waitFor(() => expect(navigate).toHaveBeenCalledWith('/order-success?id=recovered-order'));
  expect(api.post).toHaveBeenCalledWith('/payments/verify', response);
  expect(mockCart.completeCheckout).toHaveBeenCalledWith([expect.objectContaining({ productId: 'a', size: 'Free Size' })]);
  expect(api.post.mock.calls.some(([path]) => path === '/payments/create-order' || path === '/orders/cod')).toBe(false);
  expect(readPendingPayment(key)).toBeNull();
});

test('a pending receipt from another account is not displayed or verified', async () => {
  savePendingPayment(pendingPaymentKey({ _id: 'other-account' }), { response: { razorpay_order_id: 'other-order', razorpay_payment_id: 'other-payment', razorpay_signature: 'signature' }, purchased: [line] });
  render(<Checkout navigate={jest.fn()} />);
  expect(await screen.findByRole('button', { name: 'Continue to payment' })).toBeEnabled();
  expect(screen.queryByRole('heading', { name: 'Payment confirmation pending' })).not.toBeInTheDocument();
  expect(api.post.mock.calls.some(([path]) => path === '/payments/verify')).toBe(false);
});

test('recovering a payment preserves bag quantities changed after the purchase', async () => {
  const response = { razorpay_order_id: 'paid-order', razorpay_payment_id: 'paid-payment', razorpay_signature: 'signature' };
  savePendingPayment(pendingPaymentKey({ _id: 'user' }), { response, purchased: [line] });
  mockCart.items = [{ ...line, quantity: 2 }];
  api.post.mockImplementation(async path => path === '/payments/verify' ? { order: { _id: 'recovered-order' } } : path === '/orders/quote' ? quote : { items: [] });
  const navigate = jest.fn(); render(<Checkout navigate={navigate} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Retry confirmation' }));
  await waitFor(() => expect(navigate).toHaveBeenCalledWith('/order-success?id=recovered-order'));
  expect(mockCart.completeCheckout).toHaveBeenCalledWith([]);
  expect(mockToast).toHaveBeenCalledWith(expect.stringContaining('review the remaining quantities'));
});

test('desktop checkout displays the selected address even when more than four are saved', async () => {
  window.matchMedia = jest.fn(() => ({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() }));
  const saved = Array.from({ length: 5 }, (_, index) => ({ ...address, _id: `address-${index}`, fullName: `Recipient ${index + 1}`, isDefault: index === 4 }));
  const originalGet = api.get.getMockImplementation();
  api.get.mockImplementation(path => path === '/user/addresses' ? Promise.resolve(saved) : originalGet(path));
  render(<Checkout navigate={jest.fn()} />);
  expect(await screen.findByText('Recipient 5')).toBeVisible();
  expect(screen.getByText('Recipient 1')).toBeVisible();
});
