import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Inbox from './Inbox';
import Orders from './Orders';
import Onboarding from './Onboarding';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

jest.mock('../../services/api', () => ({ get: jest.fn(), put: jest.fn(), post: jest.fn() }));
jest.mock('../../context/AuthContext', () => ({ useAuth: jest.fn() }));
const a = { _id: 'a', subject: 'Ananya order' }, b = { _id: 'b', subject: 'Meera return' };
const existing = { _id: 'order-1', orderStatus: 'Confirmed', paymentStatus: 'Pending', paymentMethod: 'COD', finalAmount: 1299, createdAt: '2026-09-06T00:00:00Z', orderItems: [{ name: 'Rose kurta', quantity: 1 }], shipment: { trackingNumber: 'AWB123' } };
const mine = { store: { id: 'store-1', name: 'My boutique' }, role: 'OWNER', progress: { percent: 50, steps: {} } };
beforeEach(() => { jest.resetAllMocks(); useAuth.mockReturnValue({ user: { role: 'customer' }, refreshProfile: jest.fn() }); });

test('late conversation reads cannot replace the currently selected customer', async () => {
  let oldRead;
  api.get.mockImplementation(path => path === '/seller/inbox' ? Promise.resolve([a, b])
    : path.endsWith('/a') ? new Promise(resolve => { oldRead = resolve; })
      : Promise.resolve({ conversation: b, messages: [{ _id: 'b1', body: 'Meera message' }] }));
  render(<Inbox />);
  fireEvent.click(await screen.findByRole('button', { name: /Ananya order/ }));
  fireEvent.click(screen.getByRole('button', { name: /Meera return/ }));
  await screen.findByText('Meera message');
  fireEvent.change(screen.getByRole('textbox', { name: 'Write an internal note' }), { target: { value: 'Meera draft' } });
  await act(async () => { oldRead({ conversation: a, messages: [{ _id: 'a1', body: 'Ananya message' }] }); });
  expect(screen.queryByText('Ananya message')).not.toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Write an internal note' })).toHaveValue('Meera draft');
});

test('internal note saves cannot duplicate or clear another conversation draft', async () => {
  let completeSend;
  api.get.mockImplementation(path => Promise.resolve(path === '/seller/inbox' ? [a, b] : { conversation: path.endsWith('/a') ? a : b, messages: [] }));
  api.post.mockImplementation(() => new Promise(resolve => { completeSend = resolve; }));
  render(<Inbox />);
  fireEvent.click(await screen.findByRole('button', { name: /Ananya order/ }));
  fireEvent.change(await screen.findByRole('textbox', { name: 'Write an internal note' }), { target: { value: 'Reply A' } });
  const form = screen.getByRole('button', { name: 'Save note' }).closest('form');
  fireEvent.submit(form); fireEvent.submit(form);
  expect(api.post).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: /Meera return/ }));
  const input = await screen.findByRole('textbox', { name: 'Write an internal note' });
  fireEvent.change(input, { target: { value: 'Reply B draft' } });
  await act(async () => { completeSend({ message: { _id: 'sent-a', body: 'Reply A', authorRole: 'seller' } }); });
  expect(input).toHaveValue('Reply B draft');
  expect(screen.queryByText('Reply A')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save note' })).toBeEnabled();
});

test('saved notes are identified as internal and customer delivery is never implied', async () => {
  let finishSave;
  api.get.mockImplementation(path => Promise.resolve(path === '/seller/inbox' ? [a] : { conversation: a, messages: [] }));
  api.post.mockImplementation(() => new Promise(resolve => { finishSave = resolve; }));
  render(<Inbox />);
  fireEvent.click(await screen.findByRole('button', { name: /Ananya order/ }));
  const input = await screen.findByRole('textbox', { name: 'Write an internal note' });
  expect(input).toHaveAccessibleDescription('Saved in this workspace only. Contact the customer separately to share an update.');
  expect(screen.queryByRole('button', { name: 'Send', exact: true })).not.toBeInTheDocument();
  fireEvent.change(input, { target: { value: 'Customer asked for the navy size M.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save note' }));
  expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  expect(screen.queryByText('Internal note')).not.toBeInTheDocument();
  await act(async () => finishSave({ message: { _id: 'note-1', body: 'Customer asked for the navy size M.', authorRole: 'seller' } }));
  expect(screen.getByText('Internal note')).toBeInTheDocument();
  expect(screen.getByText('Customer asked for the navy size M.')).toBeInTheDocument();
  expect(input).toHaveValue('');
});

test('seller order actions use the same safe workflow and remain retryable', async () => {
  api.get.mockImplementation(async path => path.includes('workspace-summary') ? {} : path.startsWith('/seller/orders?') ? [existing] : {});
  api.put.mockRejectedValueOnce(new Error('Temporary order failure')).mockResolvedValueOnce({ ...existing, orderStatus: 'Packed' });
  render(<Orders />);
  fireEvent.click(await screen.findByRole('button', { name: 'Mark packed' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Temporary order failure');
  expect(api.put).toHaveBeenCalledWith('/seller/orders/order-1/status', expect.objectContaining({ orderStatus: 'Packed', revision: 0 }));
  fireEvent.click(screen.getByRole('button', { name: 'Mark packed' }));
  await waitFor(() => expect(screen.queryByText('Temporary order failure')).not.toBeInTheDocument());
  expect(api.put).toHaveBeenCalledTimes(2);
});

test('seller order load retry clears stale errors once the orders arrive', async () => {
  let fail = true;
  api.get.mockImplementation(async path => {
    if (path.includes('workspace-summary')) return {};
    if (!path.startsWith('/seller/orders?')) return {};
    if (fail) throw new Error('Orders unavailable');
    return [existing];
  });
  render(<Orders />);
  const retry = await screen.findByRole('button', { name: 'Try again' });
  fail = false; fireEvent.click(retry);
  expect(await screen.findByRole('button', { name: 'Mark packed' })).toBeInTheDocument();
  expect(screen.queryByText('Orders unavailable')).not.toBeInTheDocument();
});

test('store read failures do not offer accidental store creation and can recover', async () => {
  api.get.mockRejectedValueOnce(new Error('Database unavailable')).mockResolvedValueOnce(mine);
  render(<Onboarding />);
  fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
  expect(await screen.findByDisplayValue('My boutique')).toBeInTheDocument();
  api.put.mockResolvedValue(mine);
  fireEvent.click(screen.getByRole('button', { name: 'Save', exact: true }));
  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/stores/me/current', expect.objectContaining({ name: 'My boutique' })));
  expect(api.post).not.toHaveBeenCalled();
});

test('unprovisioned customers cannot attempt master-only store creation', async () => {
  api.get.mockRejectedValue(Object.assign(new Error('Seller access required'), { status: 403 }));
  render(<Onboarding />);
  expect(await screen.findByText(/must provision your seller workspace/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Save', exact: true })).not.toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalled();
});

test('master creation is allowed only after a confirmed missing membership and cannot publish before save', async () => {
  useAuth.mockReturnValue({ user: { systemRole: 'MASTER_OWNER', activeMode: 'admin' }, refreshProfile: jest.fn() });
  api.get.mockRejectedValue(Object.assign(new Error('Seller access required'), { status: 403 }));
  api.post.mockResolvedValue(mine);
  render(<Onboarding />);
  const save = await screen.findByRole('button', { name: 'Save', exact: true });
  expect(screen.getByRole('button', { name: 'Publish storefront' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Boutique name'), { target: { value: 'New boutique' } });
  fireEvent.click(save);
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/stores', expect.objectContaining({ name: 'New boutique' })));
});

test('store staff without settings permission can view but cannot edit or publish onboarding', async () => {
  api.get.mockResolvedValue({ ...mine, role: 'SUPPORT' });
  render(<Onboarding />);
  expect(await screen.findByLabelText('Boutique name')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Publish storefront' })).toBeDisabled();
});
