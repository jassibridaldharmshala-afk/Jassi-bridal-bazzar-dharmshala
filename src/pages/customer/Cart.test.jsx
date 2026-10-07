import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Cart from './Cart';
import api from '../../services/api';
import { bagKey } from '../../utils/bag';
const mockCart = {}, mockWishlist = {}; let mockUser;
jest.mock('../../context/CartContext', () => ({ useCart: () => mockCart }));
jest.mock('../../context/WishlistContext', () => ({ useWishlist: () => mockWishlist }));
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('../../context/StorefrontContext', () => ({ useStorefront: () => ({ storeSlug: '' }) }));
jest.mock('../../services/api', () => ({ get: jest.fn(), post: jest.fn() }));
const product = { _id: 'kurti', name: 'Rose cotton kurti', price: 999, originalPrice: 1599, stock: 7, sizingMode: 'sized', sizes: ['S', 'M', 'L'], colors: ['Rose'], images: [], variants: [{ _id: 's', size: 'S', color: 'Rose', price: 999, stock: 3 }, { _id: 'm', size: 'M', color: 'Rose', price: 1199, stock: 4 }, { _id: 'l', size: 'L', color: 'Rose', stock: 0 }] };
const line = { _id: 'line', product, quantity: 1, size: 'S', color: 'Rose', variantId: 's', price: 999, originalPrice: 1599, selected: true };
beforeEach(() => {
  jest.clearAllMocks(); mockUser = { _id: 'u' };
  Object.assign(mockCart, { items: [line], itemCount: 1, pendingCount: 0, loading: false, hydrated: true, error: '', coupon: null, setCoupon: jest.fn(), refresh: jest.fn(async () => ({ ok: true, items: mockCart.items })), selectItems: jest.fn(), updateQuantity: jest.fn(), updateItemOptions: jest.fn(async () => ({ ok: true })), removeItems: jest.fn(async () => ({ ok: true })), addToCartConfirmed: jest.fn(async () => ({ ok: true })) });
  Object.assign(mockWishlist, { addToWishlist: jest.fn(async () => ({ ok: true })) });
  api.get.mockImplementation(async path => path === '/settings' ? { platformFee: 23, gstRate: 5, deliveryCharge: 99, freeShippingMinAmount: 999, returnWindowDays: 7 } : []);
  api.post.mockImplementation(async path => path === '/wishlist/resolve' ? [product] : { items: [], discountAmount: 100, couponCode: 'SAVE100' });
});
test('selection controls use real bag lines and continuing rechecks prices before navigation', async () => {
  const navigate = jest.fn(); render(<Cart navigate={navigate} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Continue to address' })).toBeEnabled());
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select Rose cotton kurti' }));
  expect(mockCart.selectItems).toHaveBeenCalledWith([line], false);
  fireEvent.click(screen.getByRole('button', { name: 'Continue to address' }));
  await waitFor(() => expect(navigate).toHaveBeenCalledWith('/checkout'));
  expect(mockCart.refresh).toHaveBeenCalledTimes(2); // Opening the bag, then validating checkout.
});
test('no selection and unavailable selected products block checkout', async () => {
  mockCart.items = [{ ...line, selected: false }]; const { rerender } = render(<Cart navigate={jest.fn()} />);
  await screen.findByText('Select at least one item to continue.');
  expect(screen.getByRole('button', { name: 'Continue to address' })).toBeDisabled();
  mockCart.items = [{ ...line, availableStock: 0 }]; rerender(<Cart navigate={jest.fn()} />);
  await screen.findByText('Update or uncheck unavailable items to continue.');
  expect(screen.getByText('This selection is out of stock.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Continue to address' })).toBeDisabled();
});
test('size changes show live SKU prices, exclude sold sizes and wait for confirmation', async () => {
  render(<Cart navigate={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /Change size and colour/ }));
  const dialog = screen.getByRole('dialog');
  expect(await within(dialog).findByRole('button', { name: 'Size L' })).toBeDisabled();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Size M' }));
  expect(within(dialog).getByText('₹1,199')).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(mockCart.updateItemOptions).toHaveBeenCalledWith(bagKey(line), expect.objectContaining({ size: 'M', variantId: 'm', quantity: 1 })));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});
test('failed wishlist saves cannot remove bag items; successful moves remove only saved items', async () => {
  mockWishlist.addToWishlist.mockResolvedValue({ ok: false });
  render(<Cart navigate={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Remove Rose cotton kurti' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Move to wishlist' }));
  await screen.findByText(/Could not finish moving/); expect(mockCart.removeItems).not.toHaveBeenCalled();
  mockWishlist.addToWishlist.mockResolvedValue({ ok: true });
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Move to wishlist' }));
  await waitFor(() => expect(mockCart.removeItems).toHaveBeenCalledWith([line]));
});
test('removal requires confirmation and undo restores the exact size, colour and quantity', async () => {
  render(<Cart navigate={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Remove Rose cotton kurti' }));
  expect(mockCart.removeItems).not.toHaveBeenCalled();
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove', exact: true }));
  fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
  await waitFor(() => expect(mockCart.addToCartConfirmed).toHaveBeenCalledWith(product, 'S', 'Rose', 's', 1));
});
test('fresh price changes require review instead of navigating with an outdated total', async () => {
  const navigate = jest.fn(); mockCart.refresh.mockResolvedValue({ ok: true, items: [{ ...line, price: 1099 }] });
  render(<Cart navigate={navigate} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Continue to address' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Continue to address' }));
  await screen.findByText(/Review the latest prices/); expect(navigate).not.toHaveBeenCalled();
});
test('guest sign-in keeps the checkout destination, and loading does not flash an empty bag', async () => {
  mockUser = null; const navigate = jest.fn(); const { rerender } = render(<Cart navigate={navigate} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Continue to address' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Continue to address' }));
  await waitFor(() => expect(navigate).toHaveBeenCalledWith('/login?redirect=%2Fcheckout'));
  mockCart.items = []; mockCart.loading = true; rerender(<Cart navigate={navigate} />);
  expect(screen.getByText('Bringing your bag up to date…')).toBeInTheDocument(); expect(screen.queryByText('Your shopping bag is empty')).not.toBeInTheDocument();
});

test('a failed bag load offers retry without an empty-bag message or a zero item count', async () => {
  Object.assign(mockCart, { items: [], itemCount: 0, error: 'Unable to reach the store' });
  const { rerender } = render(<Cart navigate={jest.fn()} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to reach the store');
  expect(screen.getByRole('heading', { name: 'We couldn’t load your bag' })).toBeInTheDocument();
  expect(screen.queryByText('Your shopping bag is empty')).not.toBeInTheDocument();
  expect(screen.queryByText('0 items')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry', exact: true }));
  expect(mockCart.refresh).toHaveBeenCalledTimes(2);
  Object.assign(mockCart, { items: [line], itemCount: 1, error: '' });
  rerender(<Cart navigate={jest.fn()} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Continue to address' })).toBeEnabled());
  expect(screen.getByRole('button', { name: 'Rose cotton kurti' })).toBeInTheDocument();
});
test('a campaign coupon in the cart URL is applied automatically once items are ready', async () => {
  render(<Cart route="/cart?coupon=SAVE100" navigate={jest.fn()} />);
  await waitFor(() => expect(mockCart.setCoupon).toHaveBeenCalledWith(expect.objectContaining({ code: 'SAVE100', discount: 100 })));
  expect(api.post.mock.calls.filter(([path]) => path === '/coupons/apply')).toHaveLength(1);
});
