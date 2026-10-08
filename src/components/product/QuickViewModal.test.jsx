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
test('a mixed product keeps rental dates accessible when sale stock is empty', () => {
  const onOpenFull = jest.fn(), onRental = jest.fn();
  render(<QuickViewModal onRental={onRental} product={{ _id: 'bridal', name: 'Bridal lehenga', commerceMode: 'SALE_AND_RENTAL', stock: 0, price: 9000 }} onClose={jest.fn()} onOpenFull={onOpenFull} />);
  expect(screen.getByText('Buy · Rs. 9,000')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Out of stock' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: /Rent this item/ }));
  expect(onRental).toHaveBeenCalledWith('/store/bridal/rental-book?product=bridal');
  expect(onOpenFull).not.toHaveBeenCalled();
});
test('mixed product quick view shows its independent sale and rental prices', () => {
  render(<QuickViewModal product={{ _id: 'bridal', name: 'Bridal lehenga', commerceMode: 'SALE_AND_RENTAL', stock: 2, price: 9000, rentalPreview: { dailyRatePaise: 75000, depositPaise: 200000 } }} onClose={jest.fn()} onOpenFull={jest.fn()} />);
  expect(screen.getByText('Buy · Rs. 9,000')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Rent from Rs. 750 \/ day/ })).toBeInTheDocument();
});
