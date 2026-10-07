import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import RentalSettings from './RentalSettings';
import api from '../../services/api';
jest.mock('../../services/api', () => ({ get: jest.fn(), put: jest.fn() }));
const data = { revision: 2, mode: 'SALE_ONLY', policy: { timezone: 'Asia/Kolkata', holdMinutes: 10, minimumDays: 1, maximumDays: 30, advancePercent: 30, minimumLeadHours: 24, maximumAdvanceDays: 180, preparationHours: 24, cleaningHours: 24, balanceDueHours: 24, graceHours: 2, slotMinutes: 60, slotCapacity: 5, lateFeePerDayPaise: 0, deliveryFeePaise: 0, returnFeePaise: 0, pickupStart: '10:00', pickupEnd: '18:00', closedDates: [], closedWeekdays: [], deliveryModes: ['STORE_PICKUP'], cancellationRules: [{ beforeHours: 0, retainPercent: 100 }], terms: 'Return all items.', ownerEmail: false, ownerWhatsapp: false, customerEmail: false, customerWhatsapp: false, whatsappTemplate: '', whatsappLanguage: 'en' } };
beforeEach(() => { jest.clearAllMocks(); api.get.mockResolvedValue(data); api.put.mockResolvedValue({ ...data, mode: 'SALE_AND_RENTAL', revision: 3 }); });
test('rental switches save scoped configuration with optimistic revision and separate stock', async () => {
  render(<RentalSettings apiBase="/seller/rentals" />);
  fireEvent.change(await screen.findByLabelText('Business operations'), { target: { value: 'SALE_AND_RENTAL' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save rental settings' }));
  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/seller/rentals/configuration', expect.objectContaining({ mode: 'SALE_AND_RENTAL', revision: 2 }), { silent: true }));
});
test('conflicting settings retain edits and show an explicit error', async () => {
  api.put.mockRejectedValue(new Error('Rental settings changed. Reload before saving.'));
  render(<RentalSettings />);
  fireEvent.change(await screen.findByLabelText('Business operations'), { target: { value: 'RENTAL_ONLY' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save rental settings' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Rental settings changed');
  expect(screen.getByLabelText('Business operations')).toHaveValue('RENTAL_ONLY');
});

test('explicit storefront switch enables rentals and restores the last enabled mode without touching terms', async () => {
  api.get.mockResolvedValue({ ...data, mode: 'RENTAL_ONLY' });
  render(<RentalSettings />);
  const toggle = await screen.findByRole('checkbox', { name: 'Enable rental shopping' });
  expect(toggle).toBeChecked(); fireEvent.click(toggle);
  expect(screen.getByLabelText('Business operations')).toHaveValue('SALE_ONLY');
  expect(screen.getByText(/Existing bookings, pickup, returns and deposits remain accessible/)).toBeInTheDocument();
  fireEvent.click(toggle); expect(screen.getByLabelText('Business operations')).toHaveValue('RENTAL_ONLY');
  expect(screen.getByLabelText(/Rental terms/)).toHaveValue(data.policy.terms);
});
