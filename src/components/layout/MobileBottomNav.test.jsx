import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import MobileBottomNav from './MobileBottomNav';
let mockBuyCount, mockRentalCount;
jest.mock('../../context/CartContext', () => ({ useCart: () => ({ itemCount: mockBuyCount }) }));
jest.mock('../../context/RentalBagContext', () => ({ useRentalBag: () => ({ itemCount: mockRentalCount }) }));
jest.mock('../../context/WishlistContext', () => ({ useWishlist: () => ({ items: [] }) }));

test('cart highlights either bag, counts both and keeps store scope when switching', () => {
  mockBuyCount = 2; mockRentalCount = 1;
  const navigate = jest.fn(), view = render(<MobileBottomNav navigate={navigate} route="/store/bridal-shop/rental-cart" active="/store/bridal-shop/rental-cart" />);
  const cart = screen.getByRole('button', { name: 'Cart, 3 items' });
  expect(cart).toHaveAttribute('aria-current', 'page');
  fireEvent.click(cart);
  expect(navigate).toHaveBeenLastCalledWith('/store/bridal-shop/rental-cart');
  mockRentalCount = 0;
  view.rerender(<MobileBottomNav navigate={navigate} route="/store/bridal-shop/rental-cart" active="/store/bridal-shop/rental-cart" />);
  fireEvent.click(screen.getByRole('button', { name: 'Cart, 2 items' }));
  expect(navigate).toHaveBeenLastCalledWith('/store/bridal-shop/cart');
});
