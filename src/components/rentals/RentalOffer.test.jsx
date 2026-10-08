import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import RentalOffer from './RentalOffer';
import api from '../../services/api';
jest.mock('../../services/api', () => ({ get: jest.fn() }));
jest.mock('../../context/StorefrontContext', () => ({ useStorefront: () => ({ storeSlug: 'bridal' }) }));
beforeEach(() => jest.clearAllMocks());
test('failed rental details stay visible and retry reveals setup reason and store contact', async () => {
  api.get.mockRejectedValueOnce(new Error('Temporarily offline')).mockResolvedValueOnce({ enabled: true, listings: [], contact: { phone: '9000000001' }, readiness: { reasons: [{ message: 'No physical pieces registered' }] } });
  render(<RentalOffer productId="one" commerceMode="RENTAL_ONLY" navigate={jest.fn()} />);
  expect(screen.getByRole('status')).toHaveTextContent('Loading rental');
  fireEvent.click(await screen.findByRole('button', { name: 'Retry rental details' }));
  expect(await screen.findByText('No physical pieces registered')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Call store' })).toHaveAttribute('href', 'tel:9000000001');
});
