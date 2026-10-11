import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import BagTypeTabs from './BagTypeTabs';

let mockBuyCount, mockRentalCount;
jest.mock('../../context/CartContext', () => ({ useCart: () => ({ itemCount: mockBuyCount }) }));
jest.mock('../../context/RentalBagContext', () => ({ useRentalBag: () => ({ itemCount: mockRentalCount }) }));
beforeEach(() => { mockBuyCount = 2; mockRentalCount = 3; });

test('both bag counts stay visible and switching uses the same store', () => {
  const navigate = jest.fn(), view = render(<BagTypeTabs active="buy" storeSlug="bridal-shop" navigate={navigate} />);
  const tabs = within(screen.getByRole('navigation', { name: 'Bag type' }));
  expect(tabs.getByRole('link', { name: 'Buy bag, 2 items' })).toHaveAttribute('aria-current', 'page');
  const rental = tabs.getByRole('link', { name: 'Rental bag, 3 items' });
  expect(rental).toHaveAttribute('href', '/store/bridal-shop/rental-cart');
  fireEvent.click(rental);
  expect(navigate).toHaveBeenCalledWith('/store/bridal-shop/rental-cart');
  view.rerender(<BagTypeTabs active="rent" storeSlug="bridal-shop" navigate={navigate} />);
  expect(tabs.getAllByRole('link', { current: 'page' })).toHaveLength(1);
  expect(rental).toHaveAttribute('aria-current', 'page');
  fireEvent.click(tabs.getByRole('link', { name: 'Buy bag, 2 items' }));
  expect(navigate).toHaveBeenLastCalledWith('/store/bridal-shop/cart');
});

test('an empty bag still exposes the other bag and only the changed count updates', () => {
  const navigate = jest.fn(), view = render(<BagTypeTabs active="rent" navigate={navigate} />);
  mockRentalCount = 0;
  view.rerender(<BagTypeTabs active="rent" navigate={navigate} />);
  expect(screen.getByRole('link', { name: 'Rental bag, 0 items' })).toHaveAttribute('aria-current', 'page');
  fireEvent.click(screen.getByRole('link', { name: 'Buy bag, 2 items' }));
  expect(navigate).toHaveBeenCalledWith('/cart');
});
