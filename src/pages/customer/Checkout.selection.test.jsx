import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Checkout from './Checkout';
import api from '../../services/api';
import { openRazorpayCheckout } from '../../utils/razorpayCheckout';
const mockCart = {}, mockToast = jest.fn();
jest.mock('../../context/CartContext', () => ({ useCart: () => mockCart }));
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { _id: 'user', phone: '9000000081', isPhoneVerified: true }, setToast: mockToast }) }));
jest.mock('../../hooks/useDesktopFeedback', () => () => ({ isDesktop: true, notify: jest.fn() }));
jest.mock('../../services/api', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../../utils/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('../../utils/razorpayCheckout', () => ({ openRazorpayCheckout: jest.fn() }));
const selected = { _id: 'line-a', product: { _id: 'a', name: 'Selected saree', price: 999, images: [] }, quantity: 1, size: 'Free Size', color: '', selected: true };
const later = { ...selected, _id: 'line-b', product: { ...selected.product, _id: 'b', name: 'Saved for later saree' }, selected: false };
beforeEach(() => {
  jest.clearAllMocks(); sessionStorage.clear(); localStorage.clear(); window.history.replaceState({}, '', '/checkout');
  window.matchMedia = jest.fn(() => ({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() }));
  Object.assign(mockCart, { items: [selected, later], hydrated: true, coupon: null, setCoupon: jest.fn(), completeCheckout: jest.fn(async () => ({ ok: true })), refresh: jest.fn(async () => ({ ok: true })), clearCart: jest.fn() });
  api.get.mockImplementation(async path => path === '/user/addresses' ? [{ _id: 'addr', fullName: 'Test Customer', mobile: '9000000081', houseNo: '1', area: 'Test Road', city: 'Delhi', state: 'Delhi', pincode: '110001', isDefault: true }] : { methods: [{ key: 'COD', label: 'Cash on Delivery', enabled: true }] });
  api.post.mockImplementation(async path => path === '/orders/quote' ? { totals: { totalMRP: 999, finalAmount: 1022, platformFee: 23 } } : path === '/orders/cod' ? { _id: 'order-1' } : { items: [] });
});

function useMobileViewport(width = 390) {
  window.scrollTo = jest.fn();
  window.matchMedia = jest.fn(query => ({ matches: width <= Number(query.match(/max-width: (\d+)/)?.[1] || 0), addEventListener: jest.fn(), removeEventListener: jest.fn() }));
}

test.each([390, 820, 1280])('new checkout address fields use borderless inner controls at %ipx', async width => {
  useMobileViewport(width);
  const savedGet = api.get.getMockImplementation();
  api.get.mockImplementation(path => path === '/user/addresses' ? Promise.resolve([]) : savedGet(path));
  render(<Checkout navigate={jest.fn()} />);
  if (width <= 1023) {
    fireEvent.click(await screen.findByRole('button', { name: 'Select address', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Add new address', exact: true }));
  }
  await screen.findByLabelText('Full name');
  const form = screen.getByLabelText('Full name').closest('form');
  expect(form).toHaveClass('sc-address-form');
  const controls = [...form.querySelectorAll('.sc-address-form__field input, .sc-address-form__field select')];
  expect(controls).toHaveLength(9);
  controls.forEach(control => expect(control.parentElement).toHaveClass('sc-field-shell'));
  expect(screen.getByLabelText('District')).toBeDisabled();
  fireEvent.change(screen.getByLabelText('State'), { target: { value: 'Delhi' } });
  expect(screen.getByLabelText('District')).toBeEnabled();
  expect(screen.getByLabelText('District').parentElement).toHaveClass('sc-field-shell');
  expect(screen.getByLabelText('Make this my default address').closest('.sc-field-shell')).toBeNull();
});

test.each([390, 820, 1280])('editing a checkout address keeps every control in its outer shell at %ipx', async width => {
  useMobileViewport(width);
  render(<Checkout navigate={jest.fn()} />);
  await screen.findByText('Test Customer');
  if (width <= 1023) {
    fireEvent.click(screen.getByRole('button', { name: 'Change', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit', exact: true }));
  } else {
    fireEvent.click(screen.getByRole('button', { name: 'Edit Address' }));
  }
  const name = await screen.findByLabelText('Full name');
  expect(name).toHaveValue('Test Customer');
  const controls = [...name.closest('form').querySelectorAll('.sc-address-form__field input, .sc-address-form__field select')];
  expect(controls).toHaveLength(9);
  controls.forEach(control => {
    expect(control.parentElement).toHaveClass('sc-field-shell');
    if (!control.disabled) {
      act(() => control.focus());
      expect(control).toHaveFocus();
    }
  });
  expect(screen.getByLabelText('District')).toBeEnabled();
  expect(screen.getByLabelText('Full name')).toHaveValue('Test Customer');
});

test('tablet checkout renders the address step and mobile COD submits only selected variants', async () => {
  useMobileViewport(820);
  mockCart.items = [{ ...selected, price: 1199 }, later];
  const navigate = jest.fn(); render(<Checkout navigate={navigate} />);
  await screen.findByRole('heading', { name: 'Delivery address' });
  fireEvent.click(await screen.findByRole('button', { name: 'Continue to payment' }));
  expect(screen.getByRole('heading', { name: 'Payment', exact: true })).toBeInTheDocument();
  expect(screen.getByText('₹1,199')).toBeInTheDocument();
  expect(screen.queryByText('Saved for later saree')).not.toBeInTheDocument();
  const button = screen.getByRole('button', { name: 'Place COD Order' });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
  await waitFor(() => expect(navigate).toHaveBeenCalledWith('/order-success?id=order-1'));
  expect(mockCart.completeCheckout).toHaveBeenCalledWith([expect.objectContaining({ price: 1199 })]);
});

test('mobile address changes are retained when returning from payment', async () => {
  useMobileViewport();
  const address = { _id: 'home', fullName: 'Home Customer', mobile: '9000000081', houseNo: '1', area: 'Road', city: 'Delhi', state: 'Delhi', pincode: '110001', isDefault: true };
  api.get.mockImplementation(async path => path === '/user/addresses' ? [address, { ...address, _id: 'work', fullName: 'Work Customer', isDefault: false, addressType: 'Work' }] : { methods: [{ key: 'COD', label: 'Cash on Delivery', enabled: true }] });
  render(<Checkout navigate={jest.fn()} />);
  await screen.findByText('Home Customer');
  fireEvent.click(screen.getByRole('button', { name: 'Change' }));
  fireEvent.click(screen.getByRole('button', { name: 'Select Work Customer address' }));
  fireEvent.click(screen.getByRole('button', { name: 'Deliver to this address' }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue to payment' }));
  expect(screen.getByText('Work Customer')).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Place COD Order' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Back', exact: true }));
  expect(screen.getByText('Work Customer')).toBeInTheDocument();
  expect(screen.queryByText('Home Customer')).not.toBeInTheDocument();
});

test('mobile payment waits for refreshed fees and starts the selected online method', async () => {
  useMobileViewport();
  const originalGet = api.get.getMockImplementation();
  api.get.mockImplementation(path => path === '/settings/payment-methods' ? Promise.resolve({ methods: [{ key: 'COD', label: 'Cash on Delivery', enabled: true }, { key: 'UPI', label: 'UPI', enabled: true }, { key: 'CARD', label: 'Card', enabled: false, disabledReason: 'Not available' }] }) : originalGet(path));
  let finishQuote;
  const originalPost = api.post.getMockImplementation();
  api.post.mockImplementation((path, body) => path === '/orders/quote' && body.paymentMethod === 'UPI' ? new Promise(resolve => { finishQuote = resolve; }) : path === '/payments/create-order' ? Promise.resolve({ razorpayOrderId: 'payment-qa', keyId: 'test-key', amount: 99900, currency: 'INR' }) : originalPost(path, body));
  render(<Checkout navigate={jest.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Continue to payment' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Place COD Order' })).toBeEnabled());
  expect(screen.getByRole('button', { name: /Card Not available/ })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: /^UPI / }));
  expect(screen.getByRole('button', { name: 'Pay Now' })).toBeDisabled();
  expect(api.post).not.toHaveBeenCalledWith('/payments/create-order', expect.anything());
  await act(async () => finishQuote({ totals: { totalMRP: 999, finalAmount: 999 } }));
  fireEvent.click(screen.getByRole('button', { name: 'Pay Now' }));
  await waitFor(() => expect(openRazorpayCheckout).toHaveBeenCalledWith(expect.objectContaining({ preferredMethod: 'UPI', orderId: 'payment-qa', amount: 99900 })));
});
test('order quotes, COD orders and completion use only checked bag items', async () => {
  const navigate = jest.fn(); render(<Checkout navigate={navigate} />);
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/orders/quote', expect.objectContaining({ orderItems: [expect.objectContaining({ product: 'a' })] })));
  expect(screen.queryByText('Saved for later saree')).not.toBeInTheDocument();
  const button = await screen.findByRole('button', { name: /Place COD Order/i });
  await waitFor(() => expect(button).toBeEnabled()); fireEvent.click(button);
  await waitFor(() => expect(navigate).toHaveBeenCalledWith('/order-success?id=order-1'));
  expect(api.post).toHaveBeenCalledWith('/orders/cod', expect.objectContaining({ orderItems: [expect.objectContaining({ product: 'a' })] }));
  expect(mockCart.completeCheckout).toHaveBeenCalledWith([selected]); expect(mockCart.clearCart).not.toHaveBeenCalled();
});

test('Buy Now checks out only its exact cart line and refreshes the remaining bag', async () => {
  window.history.replaceState({}, '', '/checkout?buyNow=line-b&quantity=1');
  const navigate = jest.fn(); render(<Checkout navigate={navigate} />);

  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/orders/quote', expect.objectContaining({ orderItems: [expect.objectContaining({ product: 'b', quantity: 1 })] })));
  expect(screen.getByText('Saved for later saree')).toBeInTheDocument();
  expect(screen.queryByText('Selected saree')).not.toBeInTheDocument();
  const button = await screen.findByRole('button', { name: /Place COD Order/i });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);

  await waitFor(() => expect(navigate).toHaveBeenCalledWith('/order-success?id=order-1'));
  expect(api.post).toHaveBeenCalledWith('/orders/cod', expect.objectContaining({ orderItems: [expect.objectContaining({ product: 'b', quantity: 1 })] }));
  expect(mockCart.refresh).toHaveBeenCalledTimes(1);
  expect(mockCart.completeCheckout).not.toHaveBeenCalled();
});

test('desktop review shows variant prices and itemizes the server prepaid discount', async () => {
  mockCart.items = [{ ...selected, price: 1199 }];
  const originalPost = api.post.getMockImplementation();
  api.post.mockImplementation((path, body) => path === '/orders/quote' ? Promise.resolve({ totals: { totalMRP: 1199, finalAmount: 1122, platformFee: 23, prepaidDiscount: 100 } }) : originalPost(path, body));
  render(<Checkout navigate={jest.fn()} />);
  expect(await screen.findByText('Prepaid Discount')).toBeInTheDocument();
  expect(screen.getAllByText('₹1,199').length).toBeGreaterThan(0);
  expect(screen.queryByText('₹999')).not.toBeInTheDocument();
  expect(screen.getByText('- ₹100')).toBeInTheDocument();
});
