import '@testing-library/jest-dom';
import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DeliverySettings from './DeliverySettings';
import api from '../../services/api';
import { settingsForm, settingsPayload } from '../../config/storeSettings';

jest.mock('../../services/api', () => ({ get: jest.fn() }));

function Harness({ initial = {} }) {
  const [form, setForm] = useState(initial);
  return <DeliverySettings form={form} update={(key, value) => setForm(current => ({ ...current, [key]: value }))} />;
}

beforeEach(() => {
  jest.clearAllMocks();
  api.get.mockResolvedValue({ providers: [
    { name: 'manual', label: 'Manual / self delivery', configured: true, missing: [], mode: 'manual', rateQuotes: false },
    { name: 'shiprocket', label: 'Shiprocket', configured: false, missing: ['SHIPROCKET_EMAIL'], rateQuotes: true, note: 'Courier account setup required' },
  ] });
});

test('manual courier is the legacy default and does not advertise mandatory courier setup', async () => {
  render(<Harness />);
  await waitFor(() => expect(api.get).toHaveBeenCalled());
  expect(screen.getByLabelText(/Default manual delivery method/)).toHaveValue('COURIER');
  expect(screen.getByText('Manual courier is ready — no connection needed')).toBeInTheDocument();
  expect(screen.queryByText(/Backend setup required/)).not.toBeInTheDocument();
  expect(screen.queryByText('Setup needed')).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Dispatch address (optional)' })).toBeInTheDocument();
});

test('self delivery explains manual progress and needs no AWB or live tracking', async () => {
  render(<Harness />);
  fireEvent.change(screen.getByLabelText(/Default manual delivery method/), { target: { value: 'SELF' } });
  expect(screen.getByText('Self delivery is ready — no connection needed')).toBeInTheDocument();
  expect(screen.getByText(/No courier AWB is generated or required/)).toBeInTheDocument();
  expect(screen.getByText(/no automatic courier status sync or live GPS tracking/)).toBeInTheDocument();
  expect(screen.getByText(/COD collection is separate/)).toBeInTheDocument();
  await waitFor(() => expect(api.get).toHaveBeenCalled());
});

test('selecting manual mode resets unsupported live rates but preserves available pricing and integrated settings', async () => {
  render(<Harness initial={{ shippingProvider: 'shiprocket', shippingPricingMode: 'carrier' }} />);
  expect(await screen.findByText(/Backend setup required/)).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Pickup address' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/Active delivery provider/), { target: { value: 'manual' } });
  expect(screen.getByLabelText(/Customer delivery pricing/)).toHaveValue('fixed');
  expect(screen.queryByRole('option', { name: 'Selected courier live rate' })).not.toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Destination and weight rate card' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/Customer delivery pricing/), { target: { value: 'weight' } });
  expect(screen.getByRole('button', { name: 'Add PIN zone' })).toBeInTheDocument();
  expect(screen.getByLabelText(/Free delivery offer/)).toBeInTheDocument();
});

test('manual configuration stays available when a courier readiness request fails', async () => {
  api.get.mockRejectedValue(new Error('Courier connection temporarily unavailable'));
  render(<Harness initial={{ manualDeliveryMode: 'SELF' }} />);
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
  expect(screen.getByText('Self delivery is ready — no connection needed')).toBeInTheDocument();
  expect(screen.queryByText('Courier connection temporarily unavailable')).not.toBeInTheDocument();
});

test('settings form and payload carry the new default without clearing saved fields', () => {
  const legacy = settingsForm({ storeName: 'Store', shippingPickup: { city: 'Delhi' } });
  expect(legacy.manualDeliveryMode).toBe('COURIER');
  const payload = settingsPayload({ ...legacy, manualDeliveryMode: 'SELF' });
  expect(payload.manualDeliveryMode).toBe('SELF');
  expect(payload.shippingPickup).toEqual({ city: 'Delhi' });
});
