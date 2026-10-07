import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import QuickViewModal from './QuickViewModal';
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
