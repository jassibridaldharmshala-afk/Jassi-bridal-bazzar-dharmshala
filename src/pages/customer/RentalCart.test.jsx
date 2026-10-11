import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import RentalCart from './RentalCart';

let mockBag, mockOffers;
jest.mock('../../context/StorefrontContext', () => ({ useStorefront: () => ({ storeSlug: 'bridal-shop' }) }));
jest.mock('../../context/RentalBagContext', () => ({ useRentalBag: () => mockBag }));
jest.mock('../../context/CartContext', () => ({ useCart: () => ({ itemCount: 2 }) }));
jest.mock('../../hooks/useRentalOffers', () => ({ __esModule: true, default: () => mockOffers }));
const orange = { _id: 'orange-offer', productId: 'orange-product', title: 'Orange Lehenga', size: 'Free size', dailyRatePaise: 100000, depositPaise: 50000, product: { name: 'Orange Lehenga', slug: 'orange-lehenga', images: [] } };
const pink = { _id: 'pink-offer', productId: 'pink-product', title: 'Pink Lehenga', dailyRatePaise: 150000, depositPaise: 10000, product: { name: 'Pink Lehenga', images: [] } };
beforeEach(() => {
  mockBag = { ready: true, items: [{ listingId: orange._id, quantity: 3 }, { listingId: pink._id, quantity: 1 }], itemCount: 4, update: jest.fn(), remove: jest.fn() };
  mockOffers = { rows: [orange, pink], loading: false, error: '', reload: jest.fn() };
});

test('rent and refundable deposit are separate quantity totals and update when the bag changes', () => {
  const view = render(<RentalCart navigate={jest.fn()} />);
  const summary = within(screen.getByRole('complementary'));
  expect(summary.getByText('₹4,500.00')).toBeInTheDocument();
  expect(summary.getByText('₹1,600.00')).toBeInTheDocument();
  expect(summary.getByText('Estimated total')).toBeInTheDocument();
  expect(summary.getByText('₹6,100.00')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Increase quantity of Orange Lehenga' }));
  expect(mockBag.update).toHaveBeenCalledWith(orange._id, 4);
  mockBag = { ...mockBag, items: [{ listingId: orange._id, quantity: 4 }, { listingId: pink._id, quantity: 1 }], itemCount: 5 };
  view.rerender(<RentalCart navigate={jest.fn()} />);
  expect(summary.getByText('₹5,500.00')).toBeInTheDocument();
  expect(summary.getByText('₹2,100.00')).toBeInTheDocument();
  expect(summary.getByText('₹7,600.00')).toBeInTheDocument();
});

test('the rental item image opens its exact offer and continue uses the same store checkout', () => {
  const navigate = jest.fn(); render(<RentalCart navigate={navigate} />);
  const tabs = within(screen.getByRole('navigation', { name: 'Bag type' }));
  expect(tabs.getByRole('link', { name: 'Rental bag, 4 items' })).toHaveAttribute('aria-current', 'page');
  fireEvent.click(tabs.getByRole('link', { name: 'Buy bag, 2 items' }));
  expect(navigate).toHaveBeenLastCalledWith('/store/bridal-shop/cart');
  navigate.mockClear();
  fireEvent.click(screen.getByRole('button', { name: 'View Orange Lehenga' }));
  const href = navigate.mock.calls[0][0];
  expect(href).toContain('/store/bridal-shop/products/orange-lehenga');
  expect(new URLSearchParams(href.split('?')[1]).get('listing')).toBe(orange._id);
  fireEvent.click(within(screen.getByRole('complementary')).getByRole('button', { name: 'Continue to dates' }));
  expect(navigate).toHaveBeenLastCalledWith('/store/bridal-shop/rental-checkout');
});

test('an empty rental bag keeps the populated buy bag accessible', () => {
  mockBag = { ...mockBag, items: [], itemCount: 0 };
  const navigate = jest.fn(); render(<RentalCart navigate={navigate} />);
  expect(screen.getByRole('heading', { name: 'Your rental bag is empty' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('link', { name: 'Buy bag, 2 items' }));
  expect(navigate).toHaveBeenCalledWith('/store/bridal-shop/cart');
});

test('a missing offer blocks checkout and can be removed before continuing', () => {
  mockOffers.rows = [orange];
  const view = render(<RentalCart navigate={jest.fn()} />);
  const summary = within(screen.getByRole('complementary'));
  expect(summary.getByRole('button', { name: 'Continue to dates' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Remove item' }));
  expect(mockBag.remove).toHaveBeenCalledWith(pink._id);
  mockBag = { ...mockBag, items: [mockBag.items[0]], itemCount: 3 };
  view.rerender(<RentalCart navigate={jest.fn()} />);
  expect(summary.getByRole('button', { name: 'Continue to dates' })).toBeEnabled();
  expect(summary.getByText('₹3,000.00')).toBeInTheDocument();
  expect(summary.getByText('₹1,500.00')).toBeInTheDocument();
});
