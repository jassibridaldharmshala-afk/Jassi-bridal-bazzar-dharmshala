import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RentalPaymentRecovery from './RentalPaymentRecovery';
import api from '../../services/api';
jest.mock('../../services/api', () => ({ get: jest.fn(), post: jest.fn() }));
const booking = { _id: 'booking1', revision: 2, policy: { timezone: 'Asia/Kolkata' } };
const payment = { _id: 'payment1', state: 'REVIEW', setupFailure: 'UNKNOWN', amountPaise: 560000, createdAt: '2030-01-10T04:30Z' };
beforeEach(() => jest.clearAllMocks());
test('financial staff can recheck a provider attempt without starting another charge', async () => {
  api.get.mockResolvedValue([payment]);
  const recovered = { ...booking, revision: 3, status: 'CONFIRMED' };
  api.post.mockResolvedValue({ booking: recovered, payments: [{ ...payment, state: 'CAPTURED' }] });
  const onRecovered = jest.fn();
  render(<RentalPaymentRecovery base="/seller/rentals" booking={booking} onRecovered={onRecovered} run={work => work()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Recheck provider' }));
  await waitFor(() => expect(onRecovered).toHaveBeenCalledWith(recovered));
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(api.post).toHaveBeenCalledWith('/seller/rentals/bookings/booking1/payments/payment1/reconcile', {}, { silent: true });
});
test('an explicitly rejected setup shows its result without offering another provider recheck', async () => {
  api.get.mockResolvedValue([{ ...payment, state: 'FAILED', setupFailure: 'REJECTED' }]);
  render(<RentalPaymentRecovery base="/admin/rentals" booking={booking} run={work => work()} onRecovered={jest.fn()} />);
  expect(await screen.findByText('Could not be completed')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Recheck provider' })).not.toBeInTheDocument();
});
