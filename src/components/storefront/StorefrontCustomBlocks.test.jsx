import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import StorefrontCustomBlocks from './StorefrontCustomBlocks';
test('custom home products keep sale and rental actions distinct and use display derivatives', () => {
  const navigate = jest.fn();
  render(<StorefrontCustomBlocks storeSlug="bridal" navigate={navigate} blocks={[{ id: 'b', type: 'product-grid', productIds: ['p', 'r'] }]} catalog={[
    { _id: 'p', name: 'Mixed outfit', commerceMode: 'SALE_AND_RENTAL', price: 2000, images: [{ url: '/uploads/master.jpg', variants: [{ url: '/uploads/display.webp', width: 640 }] }] },
    { _id: 'r', name: 'Rental jewellery', commerceMode: 'RENTAL_ONLY', price: 0, images: [] },
  ]} />);
  expect(screen.getByAltText('Mixed outfit')).toHaveAttribute('srcset', expect.stringContaining('640w'));
  fireEvent.click(screen.getByRole('button', { name: 'Rent Mixed outfit · check dates' }));
  expect(navigate).toHaveBeenLastCalledWith('/store/bridal/rental-book?product=p');
  fireEvent.click(screen.getByRole('button', { name: /Rental jewellery/ }));
  expect(navigate).toHaveBeenLastCalledWith('/store/bridal/rental-book?product=r');
});
