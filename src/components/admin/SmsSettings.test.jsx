import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import SmsSettings from './SmsSettings';
import api from '../../services/api';

jest.mock('../../services/api', () => ({ get: jest.fn(), put: jest.fn(), post: jest.fn() }));
const providers = [
  { id: 'twilio', label: 'Twilio', fields: [{ key: 'accountSid', label: 'Account SID', required: true }, { key: 'authToken', label: 'Auth token', required: true }, { key: 'from', label: 'SMS sender / phone number', required: true }] },
  { id: 'twofactor', label: '2Factor', fields: [{ key: 'apiKey', label: 'API key', required: true }, { key: 'templateName', label: 'Approved template name', required: false }] },
  { id: 'msg91', label: 'MSG91', fields: [{ key: 'apiKey', label: 'Auth key', required: true }, { key: 'templateId', label: 'OTP template ID', required: true }] },
  { id: 'fast2sms', label: 'Fast2SMS', fields: [{ key: 'apiKey', label: 'API key', required: true }] },
];
const initial = { revision: 0, active: { provider: 'twilio', source: 'environment', configured: true, savedFields: [] }, pending: null, challenge: null, providers, environment: { provider: 'twilio', label: 'Twilio', configured: true }, phoneMasked: '••••••3210', retryAfter: 0 };
const pending = { ...initial, revision: 1, pending: { provider: 'twofactor', source: 'settings', savedFields: ['apiKey'] } };
beforeEach(() => { jest.clearAllMocks(); api.get.mockResolvedValue(initial); });

test('loads safe status and exposes all provider choices without sending a message', async () => {
  render(<SmsSettings />);
  expect(await screen.findByText('Active provider: Twilio')).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledWith('/admin/settings/sms', expect.objectContaining({ cache: 'no-store' }));
  for (const name of ['Twilio', '2Factor', 'MSG91', 'Fast2SMS']) expect(screen.getByRole('option', { name })).toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalled(); expect(api.put).not.toHaveBeenCalled();
});

test('saving encryptable draft sends only selected provider inputs and clears secrets after save', async () => {
  api.put.mockResolvedValue(pending);
  const dirty = jest.fn(); render(<SmsSettings onDirtyChange={dirty} />);
  fireEvent.change(await screen.findByLabelText('OTP provider'), { target: { value: 'twofactor' } });
  fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'private-test-key' } });
  expect(screen.getByLabelText('API key')).toHaveAttribute('type', 'password');
  fireEvent.click(screen.getByRole('button', { name: 'Save provider draft' }));
  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/admin/settings/sms', { revision: 0, source: 'settings', provider: 'twofactor', credentials: { apiKey: 'private-test-key' } }));
  await waitFor(() => expect(screen.getByLabelText('API key')).toHaveValue(''));
  expect(screen.getByText('Active provider: Twilio')).toBeInTheDocument();
  expect(screen.getByLabelText('API key')).toHaveAttribute('placeholder', 'Saved securely — leave blank to keep');
  expect(api.post).not.toHaveBeenCalled(); expect(dirty).toHaveBeenLastCalledWith(false);
});

test('requires credentials and does not reuse another provider masked fields', async () => {
  api.get.mockResolvedValue(pending); render(<SmsSettings />);
  fireEvent.change(await screen.findByLabelText('OTP provider'), { target: { value: 'msg91' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save provider draft' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Fill all required'); expect(api.put).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Auth key').placeholder).not.toMatch(/Saved securely/);
});

test('sending requires charge consent and activation requires received OTP with challenge and revision', async () => {
  api.get.mockResolvedValue(pending);
  const tested = { ...pending, challenge: { id: 'test-challenge', expiresAt: new Date(Date.now() + 300000).toISOString() }, retryAfter: 60 };
  api.post.mockResolvedValueOnce(tested).mockResolvedValueOnce({ ...initial, revision: 2, active: { ...pending.pending, configured: true, verifiedAt: new Date().toISOString() } });
  render(<SmsSettings />);
  const testButton = await screen.findByRole('button', { name: 'Send test OTP' }); expect(testButton).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox', { name: /Send a real test SMS/ })); fireEvent.click(testButton);
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/settings/sms/test', { revision: 1 }));
  const verify = await screen.findByRole('button', { name: 'Verify OTP and activate' }); expect(verify).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Test OTP'), { target: { value: '654321' } }); fireEvent.click(verify);
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/settings/sms/activate', { revision: 1, challengeId: 'test-challenge', otp: '654321' }));
  expect(await screen.findByText('Active provider: 2Factor')).toBeInTheDocument();
  expect(screen.queryByLabelText('Test OTP')).not.toBeInTheDocument();
});

test('unsaved edits block testing an older draft, and failed save keeps input for correction', async () => {
  api.get.mockResolvedValue(pending); api.put.mockRejectedValue(new Error('Settings changed. Reload first.'));
  render(<SmsSettings />);
  fireEvent.change(await screen.findByLabelText('API key'), { target: { value: 'replacement-key' } });
  fireEvent.click(screen.getByRole('checkbox', { name: /Send a real test SMS/ }));
  expect(screen.getByRole('button', { name: 'Send test OTP' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Save provider draft' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Settings changed. Reload first.');
  expect(screen.getByLabelText('API key')).toHaveValue('replacement-key'); expect(api.post).not.toHaveBeenCalled();
});

test('environment rollback has no browser credentials and requires same safe activation flow', async () => {
  api.put.mockResolvedValue({ ...initial, revision: 1, pending: { source: 'environment', provider: 'twilio', savedFields: [] } });
  render(<SmsSettings />);
  fireEvent.change(await screen.findByLabelText('Configuration source'), { target: { value: 'environment' } });
  expect(screen.queryByLabelText('Auth token')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Save provider draft' }));
  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/admin/settings/sms', { revision: 0, source: 'environment' }));
  expect(await screen.findByRole('button', { name: 'Send test OTP' })).toBeDisabled();
});

test('a slow mutation is not submitted twice and cannot submit an enclosing Settings form', async () => {
  let resolve; api.put.mockImplementation(() => new Promise(done => { resolve = done; }));
  const parentSubmit = jest.fn(event => event.preventDefault());
  render(<form onSubmit={parentSubmit}><SmsSettings /></form>);
  fireEvent.change(await screen.findByLabelText('OTP provider'), { target: { value: 'twofactor' } });
  fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'test-key' } });
  const button = screen.getByRole('button', { name: 'Save provider draft' }); fireEvent.click(button); fireEvent.click(button);
  expect(api.put).toHaveBeenCalledTimes(1); expect(parentSubmit).not.toHaveBeenCalled();
  await act(async () => resolve(pending));
});

test('demo and emergency override are clearly shown and do not advertise live customer OTP mode', async () => {
  api.get.mockResolvedValue({ ...pending, demoMode: true, environmentOverride: true });
  render(<SmsSettings />);
  expect(await screen.findByText(/Customer OTP demo mode is enabled/)).toBeInTheDocument();
  expect(screen.getByText(/Emergency backend override is enabled/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox', { name: /Send a real test SMS/ }));
  expect(screen.getByRole('button', { name: 'Send test OTP' })).toBeDisabled();
});

test('read errors permit a safe retry without showing credential controls', async () => {
  api.get.mockRejectedValueOnce(new Error('Deployment administrator required')).mockResolvedValueOnce(initial);
  render(<SmsSettings />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Deployment administrator required');
  expect(screen.queryByLabelText('OTP provider')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Reload OTP settings' }));
  expect(await screen.findByLabelText('OTP provider')).toBeInTheDocument();
});
