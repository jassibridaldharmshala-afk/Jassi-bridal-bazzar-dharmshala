import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CompleteLook from './CompleteLook';
import api from '../../services/api';
jest.mock('../../services/api', () => ({ get: jest.fn() }));
const mockAdd = jest.fn();
jest.mock('../../context/CartContext', () => ({ useCart: () => ({ items: [], getCartItem: () => null, addToCart: mockAdd, loading: false }) }));
jest.mock('../../context/WishlistContext', () => ({ useWishlist: () => ({ items: [], toggleWishlist: jest.fn() }) }));
const product = { _id: 'abcdef0123456789abcdef01', name: 'Matching necklace', price: 900, stock: 10, sizes: [], sizingMode: 'free-size', images: [] };
beforeEach(() => { jest.clearAllMocks(); });
test('optional suggestions load independently, are store scoped and never auto-add to cart', async () => {
  api.get.mockResolvedValue({ enabled: true, products: [product] });
  const navigate = jest.fn(); render(<CompleteLook productId="source" storeSlug="nishaya" navigate={navigate} />);
  expect(await screen.findByRole('heading', { name: 'Complete the look' })).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledWith('/products/source/complete-look?store=nishaya', { silent: true, cacheScope: 'complete-look:nishaya:source:0' });
  expect(mockAdd).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Add to Cart' })); expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({ _id: product._id }));
});
test('rental recommendations show actual rates and deposits, and go to date checking not cart', async () => {
  api.get.mockResolvedValue({ enabled: true, products: [{ ...product, stock: 0, discoveryPurchase: 'RENTAL', rentalPreview: { dailyRatePaise: 25000, depositPaise: 100000 } }] });
  const navigate = jest.fn(); render(<CompleteLook productId="source" navigate={navigate} />);
  const dates = await screen.findByRole('button', { name: 'Check rental dates' }); expect(dates).toBeEnabled();
  expect(screen.getByText('₹250 / day')).toBeInTheDocument(); expect(screen.getByText('Refundable deposit: ₹1,000')).toBeInTheDocument();
  fireEvent.click(dates); expect(navigate).toHaveBeenCalledWith(`/rental-book?product=${product._id}`); expect(mockAdd).not.toHaveBeenCalled();
});
test('disabled, empty or failed recommendations hide without affecting the product page', async () => {
  api.get.mockResolvedValue({ enabled: false, products: [product] }); const { container, rerender } = render(<CompleteLook productId="one" navigate={jest.fn()} />);
  await waitFor(() => expect(api.get).toHaveBeenCalled()); expect(container).toBeEmptyDOMElement();
  api.get.mockRejectedValue(new Error('offline')); rerender(<CompleteLook productId="two" navigate={jest.fn()} />);
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2)); expect(container).toBeEmptyDOMElement();
});
