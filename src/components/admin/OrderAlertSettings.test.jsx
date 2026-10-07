import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import OrderAlertSettings from './OrderAlertSettings';
import api from '../../services/api';
jest.mock('../../services/api', () => ({ get: jest.fn(), put: jest.fn(), post: jest.fn() }));
const initial = { revision: 1, storefrontUrl: 'https://shop.example', email: { enabled: true, recipient: 'owner@example.com', senderEmail: 'orders@example.com', senderName: 'Store', hasApiKey: true }, whatsapp: { enabled: false, recipient: '', phoneNumberId: '', templateName: '', language: 'en', consent: false, hasAccessToken: false }, deliveries: [] };
beforeEach(() => { jest.clearAllMocks(); api.get.mockResolvedValue(initial); });
test('loads masked configuration without sending, and disabled channels cannot be tested', async () => {
  render(<OrderAlertSettings />);
  expect(await screen.findByLabelText('Owner notification email')).toHaveValue('owner@example.com');
  expect(screen.getByLabelText('Brevo API key')).toHaveValue('');
  expect(screen.getByLabelText('Brevo API key')).toHaveAttribute('type', 'password');
  expect(screen.getByRole('button', { name: 'Send test WhatsApp' })).toBeDisabled();
  expect(api.post).not.toHaveBeenCalled();
});
test('dirty settings cannot test; save submits revision and clears secrets', async () => {
  api.put.mockResolvedValue({ ...initial, revision: 2 }); const dirty = jest.fn();
  render(<OrderAlertSettings onDirtyChange={dirty} />);
  fireEvent.change(await screen.findByLabelText('Brevo API key'), { target: { value: 'new-secret' } });
  expect(screen.getByRole('button', { name: 'Send test email' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Save order alerts' }));
  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/admin/settings/order-alerts', expect.objectContaining({ revision: 1, email: expect.objectContaining({ apiKey: 'new-secret' }) }), { silent: true }));
  await waitFor(() => expect(screen.getByLabelText('Brevo API key')).toHaveValue(''));
  expect(dirty).toHaveBeenLastCalledWith(false);
});
test('save failure preserves draft; discard restores saved values', async () => {
  api.put.mockRejectedValue(new Error('Reload changed settings'));
  render(<OrderAlertSettings apiBase="/seller/settings" />);
  fireEvent.change(await screen.findByLabelText('Owner notification email'), { target: { value: 'changed@example.com' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save order alerts' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Reload changed settings');
  expect(screen.getByLabelText('Owner notification email')).toHaveValue('changed@example.com');
  fireEvent.click(screen.getByRole('button', { name: 'Discard alert changes' }));
  expect(screen.getByLabelText('Owner notification email')).toHaveValue('owner@example.com');
});
test('uncertain alert needs explicit confirmation and accepted is not labelled delivered', async () => {
  const data = { ...initial, deliveries: [{ _id: 'job-1', channel: 'EMAIL', status: 'UNCERTAIN', attempts: 1, createdAt: new Date().toISOString() }] };
  api.get.mockResolvedValue(data); api.post.mockResolvedValue({ ...data, deliveries: [{ ...data.deliveries[0], status: 'QUEUED' }] });
  render(<OrderAlertSettings />);
  fireEvent.click(await screen.findByRole('button', { name: 'Retry alert' })); expect(api.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /I checked the provider/ }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/settings/order-alerts/job-1/retry', { confirmUncertain: true }, { silent: true }));
  expect(await screen.findByText('Queued')).toBeInTheDocument();
});
