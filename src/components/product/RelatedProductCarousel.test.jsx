import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import RelatedProductCarousel from './RelatedProductCarousel';

const mockAdd = jest.fn();
jest.mock('../../context/CartContext', () => ({ useCart: () => ({ getCartItem: () => null, addToCart: mockAdd, loading: false }) }));
jest.mock('../../context/WishlistContext', () => ({ useWishlist: () => ({ items: [], toggleWishlist: jest.fn() }) }));
const mixed = { _id: 'orange', slug: 'orange-lehenga', name: 'Orange Lehenga', commerceMode: 'SALE_AND_RENTAL', price: 2999, stock: 0, rentalPreview: { listingId: 'offer-orange', dailyRatePaise: 100000, depositPaise: 50000 } };
beforeEach(() => mockAdd.mockReset());

test('a mixed recommendation follows the selected mode and keeps sale stock separate from rental', () => {
  const navigate = jest.fn();
  const { rerender } = render(<RelatedProductCarousel products={[mixed]} navigate={navigate} />);
  const card = screen.getByRole('article', { name: mixed.name });
  expect(within(card).getByText('₹2,999')).toBeInTheDocument();
  expect(within(card).getByRole('button', { name: 'Out of stock' })).toBeDisabled();
  expect(within(card).queryByText('Available for rental')).not.toBeInTheDocument();
  expect(within(card).queryByText('Rental', { exact: true })).not.toBeInTheDocument();
  rerender(<RelatedProductCarousel products={[mixed]} navigate={navigate} purchaseMode="rent" />);
  expect(within(card).getByText('Rental', { exact: true })).toBeInTheDocument();
  expect(within(card).getByText('₹1,000', { exact: false })).toBeInTheDocument();
  expect(within(card).getByText('/ use day')).toBeInTheDocument();
  expect(within(card).queryByText('₹2,999')).not.toBeInTheDocument();
  expect(within(card).getByRole('button', { name: 'View rental details' })).toBeEnabled();
  fireEvent.click(within(card).getByRole('button', { name: 'View rental details' }));
  expect(navigate).toHaveBeenCalledWith('/product/orange-lehenga?mode=rent&listing=offer-orange');
  expect(mockAdd).not.toHaveBeenCalled();
});

test('a rental-only recommendation opens product details instead of adding sale stock or skipping to checkout', () => {
  const navigate = jest.fn();
  render(<RelatedProductCarousel products={[{ ...mixed, commerceMode: 'RENTAL_ONLY' }]} navigate={navigate} />);
  expect(screen.getByText('Rental', { exact: true })).toBeInTheDocument();
  expect(screen.getByText('/ use day')).toBeInTheDocument();
  expect(screen.queryByText('₹2,999')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'View rental details' }));
  expect(navigate).toHaveBeenCalledWith('/product/orange-lehenga?mode=rent&listing=offer-orange');
  expect(mockAdd).not.toHaveBeenCalled();
});

test('a missing rental rate never falls back to the sale price', () => {
  render(<RelatedProductCarousel products={[{ ...mixed, rentalPreview: null }]} navigate={jest.fn()} purchaseMode="rent" />);
  expect(screen.getByText('Check rental rates')).toBeInTheDocument();
  expect(screen.queryByText('₹2,999')).not.toBeInTheDocument();
});
