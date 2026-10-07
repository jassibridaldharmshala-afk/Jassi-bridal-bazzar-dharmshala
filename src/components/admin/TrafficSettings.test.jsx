import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TrafficSettings from './TrafficSettings';
import api from '../../services/api';
jest.mock('../../services/api', () => ({ get: jest.fn(), put: jest.fn(), post: jest.fn() }));
const data = { enabled: true, consentRequired: true, timezone: 'Asia/Kolkata', sessionTimeoutMinutes: 30, rawRetentionDays: 90, summaryRetentionDays: 365, attributionDays: 7, excludedPaths: [], excludedReferrers: [], excludeLocalhost: true, ga4Enabled: false, ga4MeasurementId: '', revision: 1 };
beforeEach(() => { jest.clearAllMocks(); api.get.mockResolvedValue(data); api.put.mockResolvedValue({ ...data, revision: 2 }); });
test('store-scoped traffic settings save only editable analytics fields and the expected revision', async () => {
  render(<TrafficSettings apiBase="/seller/settings" />);
  fireEvent.change(await screen.findByLabelText('Traffic timezone'), { target: { value: 'Asia/Dubai' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save traffic settings' }));
  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/seller/settings/traffic', expect.objectContaining({ timezone: 'Asia/Dubai', expectedRevision: 1 }), { silent: true }));
});
test('retention reduction and complete analytics deletion require deliberate confirmation', async () => {
  render(<TrafficSettings />); await screen.findByLabelText('Traffic timezone');
  fireEvent.change(screen.getByLabelText('Detailed event retention (days)'), { target: { value: '7' } });
  expect(screen.getByRole('button', { name: 'Save traffic settings' })).toBeDisabled();
  fireEvent.click(screen.getByLabelText(/I understand that reducing retention/)); expect(screen.getByRole('button', { name: 'Save traffic settings' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Permanently delete analytics' })).toBeDisabled();
  expect(api.post).not.toHaveBeenCalled();
});
