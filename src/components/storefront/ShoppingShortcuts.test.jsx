import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ShoppingShortcuts from './ShoppingShortcuts';
jest.mock('../../utils/analytics', () => ({ trackEvent: jest.fn() }));
test('sale-only and empty stores do not show rental or occasion placeholders', () => {
  const { container } = render(<ShoppingShortcuts data={{ rentalEnabled: false, occasions: [] }} navigate={jest.fn()} />);
  expect(container).toBeEmptyDOMElement();
});
test('shortcuts encode real occasion names and respect feature switches', () => {
  const navigate = jest.fn(); const data = { rentalEnabled: false, occasions: [{ key: 'party', label: 'Party & evening' }] };
  const { rerender } = render(<ShoppingShortcuts data={data} navigate={navigate} />);
  fireEvent.click(screen.getByRole('button', { name: 'Party & evening' }));
  expect(navigate).toHaveBeenCalledWith('/products?occasion=Party%20%26%20evening');
  rerender(<ShoppingShortcuts data={{ ...data, occasionShoppingEnabled: false }} navigate={navigate} />);
  expect(screen.queryByText('Shop by occasion')).not.toBeInTheDocument();
});
test('rental-only stores never advertise buying and mixed stores offer both journeys', () => {
  const navigate = jest.fn(); const { rerender } = render(<ShoppingShortcuts data={{ rentalEnabled: true, mode: 'RENTAL_ONLY', occasions: [] }} navigate={navigate} />);
  expect(screen.queryByRole('button', { name: 'Shop to buy' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Explore rentals/ })); expect(navigate).toHaveBeenCalledWith('/rental-book');
  rerender(<ShoppingShortcuts data={{ rentalEnabled: true, mode: 'SALE_AND_RENTAL', occasions: [] }} navigate={navigate} />);
  fireEvent.click(screen.getByRole('button', { name: 'Shop to buy' })); expect(navigate).toHaveBeenCalledWith('/products');
});
