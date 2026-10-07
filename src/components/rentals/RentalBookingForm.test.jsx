import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import RentalBookingForm from './RentalBookingForm';
import api from '../../services/api';
jest.mock('../../services/api', () => ({ post: jest.fn() }));
const configuration = { policy: { timezone: 'Asia/Kolkata', slotMinutes: 60, deliveryModes: ['STORE_PICKUP'] } };
const listing = { _id: 'list1', productId: 'prod1', title: 'Bridal lehenga M', dailyRatePaise: 100000, depositPaise: 500000, packages: [] };
test('booking needs a reviewed quote and terms; dates sent with explicit timezone', async () => {
  const onBooked = jest.fn(); api.post.mockResolvedValueOnce({ quoteFingerprint: 'reviewed_price', policyRevision: 3, timezone: 'Asia/Kolkata', terms: 'Return by noon.', schedule: { pickupAt: '2030-01-10T04:30Z', returnDueAt: '2030-01-12T04:30Z' }, quote: { rentalPaise: 200000, depositPaise: 500000, dueNowPaise: 560000 } }).mockResolvedValueOnce({ _id: 'booking1' });
  render(<RentalBookingForm listings={[listing]} configuration={configuration} user={{ name: 'Buyer', phone: '9000000001' }} onBooked={onBooked} />);
  fireEvent.click(screen.getByLabelText('Select Bridal lehenga M'));
  fireEvent.change(screen.getByLabelText('Pickup / delivery time'), { target: { value: '2030-01-10T10:00' } });
  fireEvent.change(screen.getByLabelText('Return deadline'), { target: { value: '2030-01-12T10:00' } });
  fireEvent.click(screen.getByRole('button', { name: 'Check dates & review price' }));
  const reserve = await screen.findByRole('button', { name: 'Reserve rental' }); expect(reserve).toBeDisabled();
  fireEvent.click(screen.getByLabelText(/I accept these rental terms/)); fireEvent.click(reserve);
  await waitFor(() => expect(onBooked).toHaveBeenCalledWith({ _id: 'booking1' }));
  expect(api.post.mock.calls[1][1]).toEqual(expect.objectContaining({ pickupAt: '2030-01-10T04:30:00.000Z', policyRevision: 3, quoteFingerprint: 'reviewed_price', acceptTerms: true }));
});

test('a changed quote clears acceptance and requires another review instead of silently booking', async () => {
  api.post.mockReset();
  api.post.mockResolvedValueOnce({ quoteFingerprint: 'old_price', policyRevision: 1, terms: 'Accepted terms', schedule: {}, quote: { rentalPaise: 200000, depositPaise: 500000, dueNowPaise: 560000 } });
  api.post.mockRejectedValueOnce(Object.assign(new Error('Review the new price.'), { code: 'RENTAL_QUOTE_CHANGED' }));
  const onBooked = jest.fn();
  render(<RentalBookingForm listings={[listing]} configuration={configuration} user={{ name: 'Buyer', phone: '9000000001' }} onBooked={onBooked} />);
  fireEvent.click(screen.getByLabelText('Select Bridal lehenga M'));
  fireEvent.change(screen.getByLabelText('Pickup / delivery time'), { target: { value: '2030-01-10T10:00' } });
  fireEvent.change(screen.getByLabelText('Return deadline'), { target: { value: '2030-01-12T10:00' } });
  fireEvent.click(screen.getByRole('button', { name: 'Check dates & review price' }));
  fireEvent.click(await screen.findByLabelText(/I accept these rental terms/));
  fireEvent.click(screen.getByRole('button', { name: 'Reserve rental' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Review the new price.');
  expect(screen.queryByRole('button', { name: 'Reserve rental' })).not.toBeInTheDocument(); expect(onBooked).not.toHaveBeenCalled();
});
