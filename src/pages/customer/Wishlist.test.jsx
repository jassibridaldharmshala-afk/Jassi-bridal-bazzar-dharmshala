import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Wishlist from './Wishlist';
import api from '../../services/api';
const mockWishlist = {};
const mockCart = {};
let mockUser;
jest.mock('../../context/WishlistContext', () => ({ useWishlist: () => mockWishlist }));
jest.mock('../../context/CartContext', () => ({ useCart: () => mockCart }));
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('../../context/StorefrontContext', () => ({ useStorefront: () => ({ storeSlug: '' }) }));
jest.mock('../../services/api', () => ({ post: jest.fn() }));
const product = { _id: 'kurti', name: 'Rose cotton kurti', category: 'Kurtis', price: 899, originalPrice: 1299, sizes: ['S', 'M', 'L'], colors: ['Rose', 'Blue'], stock: 5, sizingMode: 'sized', images: [], variants: [
  { _id: 's-rose', size: 'S', color: 'Rose', stock: 2, price: 999 },
  { _id: 'm-blue', size: 'M', color: 'Blue', stock: 3, price: 1099 },
  { _id: 'l-rose', size: 'L', color: 'Rose', stock: 0 },
] };
beforeEach(() => {
  jest.clearAllMocks(); mockUser = { _id: 'user' };
  Object.assign(mockWishlist, { items: [product], loading: false, error: '', pendingIds: [], refresh: jest.fn(), removeFromWishlist: jest.fn(async p => { mockWishlist.items = mockWishlist.items.filter(row => row._id !== p._id); return { ok: true }; }), addToWishlist: jest.fn(async p => { mockWishlist.items = [...mockWishlist.items, p]; return { ok: true }; }) });
  Object.assign(mockCart, { items: [], itemCount: 0, loading: false, hydrated: true, addToCartConfirmed: jest.fn(async () => ({ ok: true })) });
  api.post.mockResolvedValue([product]);
});

test('search, availability filters and sorting use the saved products', () => {
  mockWishlist.items = [product, { ...product, _id: 'sold', name: 'Ivory silk saree', category: 'Sarees', price: 499, originalPrice: 499, variants: [], stock: 0 }];
  render(<Wishlist navigate={jest.fn()} />);
  fireEvent.change(screen.getByLabelText('Sort wishlist'), { target: { value: 'low' } });
  expect(screen.getAllByRole('article')[0]).toHaveAccessibleName('Ivory silk saree');
  fireEvent.click(screen.getByRole('button', { name: 'In stock', exact: true }));
  expect(screen.getAllByRole('article')).toHaveLength(1);
  fireEvent.change(screen.getByLabelText('Search wishlist'), { target: { value: 'not found' } });
  expect(screen.getByText('No matching styles')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  expect(screen.getAllByRole('article')).toHaveLength(2);
});

test('removal can be undone and the saved count stays accurate', async () => {
  render(<Wishlist navigate={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /Remove Rose cotton/ }));
  await screen.findByText('Your wishlist is empty');
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
  await screen.findByRole('article', { name: product.name });
  expect(mockWishlist.addToWishlist).toHaveBeenCalledWith(product);
  expect(screen.getByRole('heading', { name: /My wishlist 1 item/ })).toBeInTheDocument();
});

test('variant price and stock are checked and a move waits for confirmed bag success', async () => {
  let resolveAdd;
  mockCart.addToCartConfirmed.mockImplementation(() => new Promise(resolve => { resolveAdd = resolve; }));
  render(<Wishlist navigate={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Move to bag' }));
  const dialog = screen.getByRole('dialog');
  await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Size L, out of stock' })).toBeDisabled());
  fireEvent.click(within(dialog).getByRole('button', { name: 'Size S', exact: true }));
  expect(within(dialog).getByText('₹999')).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Colour Blue', exact: true }));
  expect(within(dialog).getByRole('button', { name: 'Move to bag' })).toBeDisabled();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Size M', exact: true }));
  expect(within(dialog).getByText('₹1,099')).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Move to bag' }));
  expect(mockCart.addToCartConfirmed).toHaveBeenCalledWith(expect.objectContaining({ _id: 'kurti' }), 'M', 'Blue', 'm-blue');
  expect(mockWishlist.removeFromWishlist).not.toHaveBeenCalled();
  resolveAdd({ ok: true });
  await waitFor(() => expect(mockWishlist.removeFromWishlist).toHaveBeenCalled());
  expect(await screen.findByText(/Moved to your bag/)).toBeInTheDocument();
});

test('a failed bag request keeps the wishlist and shows a useful retry message', async () => {
  mockCart.addToCartConfirmed.mockResolvedValue({ ok: false, message: 'Only 0 items available in stock' });
  render(<Wishlist navigate={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Move to bag' }));
  const dialog = screen.getByRole('dialog');
  await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Size S', exact: true })).toBeEnabled());
  fireEvent.click(within(dialog).getByRole('button', { name: 'Size S', exact: true }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Move to bag' }));
  await screen.findByText('Only 0 items available in stock');
  expect(mockWishlist.removeFromWishlist).not.toHaveBeenCalled();
  expect(screen.getByRole('article')).toBeInTheDocument();
});

test('a failed availability lookup cannot be bypassed by choosing stale sizes', async () => {
  api.post.mockRejectedValue(new Error('Could not check availability'));
  render(<Wishlist navigate={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Move to bag' }));
  const dialog = screen.getByRole('dialog');
  await screen.findByText('Could not check availability');
  expect(within(dialog).getByRole('button', { name: 'Move to bag' })).toBeDisabled();
  expect(within(dialog).getByRole('button', { name: 'Size S, out of stock' })).toBeDisabled();
  expect(mockCart.addToCartConfirmed).not.toHaveBeenCalled();
});

test('free-size products do not invent a size or colour and duplicate bag adds are avoided', async () => {
  const saree = { ...product, _id: 'saree', name: 'Ivory saree', sizingMode: 'free-size', colors: [], sizes: [], variants: [] };
  mockWishlist.items = [saree]; api.post.mockResolvedValue([saree]);
  mockCart.items = [{ product: saree, size: 'Free Size', color: '', quantity: 1 }];
  const navigate = jest.fn(); render(<Wishlist navigate={navigate} />);
  fireEvent.click(screen.getByRole('button', { name: 'Move to bag' }));
  const dialog = screen.getByRole('dialog');
  await within(dialog).findByText('This selection is already in your bag.');
  fireEvent.click(within(dialog).getByRole('button', { name: 'View bag' }));
  expect(navigate).toHaveBeenCalledWith('/cart'); expect(mockCart.addToCartConfirmed).not.toHaveBeenCalled();
});

test('guest wishlist provides optional sign-in while unavailable products remain removable', () => {
  mockUser = null; mockWishlist.items = [{ ...product, unavailable: true }];
  const navigate = jest.fn(); render(<Wishlist navigate={navigate} />);
  fireEvent.click(screen.getByRole('button', { name: /Sign in/ }));
  expect(navigate).toHaveBeenCalledWith('/login?redirect=%2Fwishlist');
  expect(screen.getByRole('button', { name: 'Unavailable', exact: true })).toBeDisabled();
  expect(screen.getByRole('button', { name: /Remove Rose cotton/ })).toBeEnabled();
});

test('moving waits until the bag has loaded to avoid duplicate or overwritten selections', async () => {
  mockCart.loading = true; mockCart.hydrated = false;
  const { rerender } = render(<Wishlist navigate={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Move to bag' }));
  const dialog = screen.getByRole('dialog');
  fireEvent.click(await within(dialog).findByRole('button', { name: 'Size S', exact: true }));
  expect(within(dialog).getByText('Loading your bag…')).toBeInTheDocument();
  expect(within(dialog).getByRole('button', { name: 'Move to bag' })).toBeDisabled();
  mockCart.loading = false; mockCart.hydrated = true; rerender(<Wishlist navigate={jest.fn()} />);
  expect(within(dialog).getByRole('button', { name: 'Move to bag' })).toBeEnabled();
});
