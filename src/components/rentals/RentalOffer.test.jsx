import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import RentalOffer from './RentalOffer';
import api from '../../services/api';
jest.mock('../../services/api', () => ({ get: jest.fn() }));
jest.mock('../../context/StorefrontContext', () => ({ useStorefront: () => ({ storeSlug: 'bridal' }) }));
beforeEach(() => { jest.clearAllMocks(); window.history.replaceState({}, '', '/'); });
test('failed rental details stay visible and retry reveals setup reason and store contact', async () => {
  api.get.mockRejectedValueOnce(new Error('Temporarily offline')).mockResolvedValueOnce({ enabled: true, listings: [], contact: { phone: '9000000001' }, readiness: { reasons: [{ message: 'No physical pieces registered' }] } });
  render(<RentalOffer productId="one" commerceMode="RENTAL_ONLY" navigate={jest.fn()} />);
  expect(screen.getByRole('status')).toHaveTextContent('Loading rental');
  fireEvent.click(await screen.findByRole('button', { name: 'Retry rental details' }));
  expect(await screen.findByText(/Online rental bookings are not open/)).toBeInTheDocument();
  expect(screen.queryByText('No physical pieces registered')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Call store' })).toHaveAttribute('href', 'tel:9000000001');
});

test('a deleted linked offer requires an explicit alternative and cannot silently book another size', async () => {
  window.history.replaceState({}, '', '/product?id=one&mode=rent&listing=removed');
  api.get.mockResolvedValue({ enabled: true, listings: [{ _id: 'other', title: 'Lehenga', size: 'Free size', dailyRatePaise: 150000, depositPaise: 200000 }] });
  const navigate = jest.fn(); render(<RentalOffer productId="one" commerceMode="RENTAL_ONLY" navigate={navigate} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('linked rental option is no longer available');
  expect(screen.queryByRole('button', { name: 'Book this rental' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Available rental options'), { target: { value: 'other' } });
  fireEvent.click(screen.getByRole('button', { name: 'Book this rental' }));
  expect(navigate).toHaveBeenCalledWith('/rental-book?product=one&listing=other');
  window.history.replaceState({}, '', '/');
});
