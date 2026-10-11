import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import QuickViewModal from './QuickViewModal';
jest.mock('../../context/StorefrontContext', () => ({ useStorefront: () => ({ storeSlug: 'bridal' }) }));
const mockAdd = jest.fn();
jest.mock('../../context/CartContext', () => ({ useCart: () => ({ addToCart: mockAdd }) }));
test('quick view keeps unavailable items out of the bag while still opening full details', () => {
  const onOpenFull = jest.fn();
  render(<QuickViewModal product={{ _id: 'saree', name: 'Silk saree', stock: 0, price: 1599 }} onClose={jest.fn()} onOpenFull={onOpenFull} />);
  fireEvent.click(screen.getByRole('button', { name: 'Out of stock' }));
  expect(mockAdd).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'View full details' }));
  expect(onOpenFull).toHaveBeenCalledTimes(1);
});
test('a mixed product in Buy stays out of stock without replacing the sale action with rental', () => {
  const onOpenFull = jest.fn(), onRental = jest.fn();
  render(<QuickViewModal onRental={onRental} product={{ _id: 'bridal', name: 'Bridal lehenga', commerceMode: 'SALE_AND_RENTAL', stock: 0, price: 9000 }} onClose={jest.fn()} onOpenFull={onOpenFull} />);
  expect(screen.getByText('Rs. 9,000')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Out of stock' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: /Rent this item|rental pricing/i })).not.toBeInTheDocument();
  expect(onRental).not.toHaveBeenCalled();
  expect(onOpenFull).not.toHaveBeenCalled();
});
test('mixed product quick view uses the price and action of the selected shopping section', () => {
  const product = { _id: 'bridal', name: 'Bridal lehenga', commerceMode: 'SALE_AND_RENTAL', stock: 2, price: 9000, rentalPreview: { dailyRatePaise: 75000, depositPaise: 200000 } };
  const onClose = jest.fn(), onOpenFull = jest.fn(), onRental = jest.fn();
  const { rerender } = render(<QuickViewModal product={product} onClose={onClose} onOpenFull={onOpenFull} />);
  expect(screen.getByText('Rs. 9,000')).toBeInTheDocument();
  expect(screen.queryByText(/Rent from/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
  expect(mockAdd).toHaveBeenCalledWith(product);
  rerender(<QuickViewModal product={product} shoppingMode="rental" onRental={onRental} onClose={onClose} onOpenFull={onOpenFull} />);
  expect(screen.getByText('Rent from Rs. 750 / day')).toBeInTheDocument();
  expect(screen.queryByText('Rs. 9,000')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Check rental dates' }));
  expect(onRental).toHaveBeenCalledWith('/store/bridal/products/bridal?mode=rent');
});
