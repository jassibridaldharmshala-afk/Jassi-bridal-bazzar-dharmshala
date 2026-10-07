import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ClientInstallations from './ClientInstallations';
import api from '../../services/api';

jest.mock('../../services/api', () => ({ get: jest.fn(), post: jest.fn(), patch: jest.fn() }));
const mockNotify = jest.fn();
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ notify: mockNotify }) }));

const plan = { id: 'PROFESSIONAL', name: 'Professional', features: ['catalog', 'analytics'], limits: { products: 1000, ordersPerMonth: 2000 }, prices: { monthly: 1999, yearly: 19990, lifetime: 49999 } };
const client = {
  id: '68c2b22e48c154cd49395001', installationId: 'client_safe_001', revision: 0,
  companyName: 'Riya Fashion', projectName: 'Riya Fashion', projectSlug: 'riya-fashion', industry: 'fashion',
  status: 'TRIAL', plan: 'PROFESSIONAL', billingCycle: 'TRIAL', startsAt: '2026-09-01T00:00:00.000Z', endsAt: '2026-10-01T00:00:00.000Z', daysRemaining: 20,
  features: ['catalog', 'analytics'], limits: { products: 1000, ordersPerMonth: 2000 }, limitOverrides: { products: null, ordersPerMonth: null }, featureOverrides: [], disabledFeatures: [],
  appVersion: '1.0.0', targetVersion: '1.0.0', updateChannel: 'stable', lastValidatedVersion: '1.0.0', lastProtocolVersion: 1,
  lastSeenAt: '2026-09-11T00:00:00.000Z', deploymentUrl: '', notes: '', contact: { ownerName: 'Riya', phone: '9999999991', email: 'riya@example.com', billingEmail: '', accountManager: '' }, tags: [],
  usage: { products: 12, ordersPerMonth: 8 }, health: { status: 'ONLINE', databaseStatus: 'CONNECTED', serviceStatus: 'HEALTHY', paymentReady: true, mediaStorageReady: true, shippingProvider: 'bluedart' },
  deployment: { hasHook: false, provider: 'RENDER', repository: 'owner/store', branch: 'main', environment: 'production', phase: null }, keyRotation: null,
  createdAt: '2026-09-01T00:00:00.000Z',
};
const list = { installations: [client], summary: { total: 1, active: 0, trials: 1, expiring: 1, offline: 0, monthlyRevenue: 0 }, pagination: { page: 1, limit: 12, total: 1, pages: 1 }, plans: [plan], pricing: { taxMode: 'INCLUSIVE', gstPercent: 18 }, releases: [], industryOptions: [{ industry: 'fashion', name: 'Fashion' }], controlPlane: { signingReady: true, deploymentHooksReady: true } };
const operations = { installation: client, payments: [], paymentTotal: 0, operations: [], operationPagination: { page: 1, limit: 50, total: 0, pages: 1 }, activity: [] };

beforeEach(() => {
  jest.clearAllMocks();
  api.get.mockImplementation(async (path) => path.includes('/operations') ? operations : list);
});

async function openClient() {
  render(<ClientInstallations />);
  expect(await screen.findByText('Client control')).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole('button', { name: 'Manage' })[0]);
  expect(await screen.findByRole('dialog', { name: 'Manage Riya Fashion' })).toBeInTheDocument();
}

test('profile save sends only profile fields with the current revision', async () => {
  api.patch.mockResolvedValue({ installation: { ...client, revision: 1, contact: { ...client.contact, ownerName: 'Riya Sharma' } } });
  await openClient();
  fireEvent.change(screen.getByLabelText('Owner name'), { target: { value: 'Riya Sharma' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save overview' }));
  await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1));
  const [path, body] = api.patch.mock.calls[0];
  expect(path).toBe(`/master/installations/${client.id}/profile`);
  expect(body).toEqual(expect.objectContaining({ baseRevision: 0, contact: expect.objectContaining({ ownerName: 'Riya Sharma' }), tags: '', notes: '' }));
  expect(body).not.toHaveProperty('plan');
  expect(body).not.toHaveProperty('featureOverrides');
  expect(body).not.toHaveProperty('targetVersion');
});

test('manual grant requires a reason and sends an idempotent narrow payload', async () => {
  api.post.mockResolvedValue({ installation: { ...client, revision: 1, status: 'ACTIVE', billingCycle: 'MONTHLY' }, duplicate: false });
  await openClient();
  fireEvent.click(screen.getByRole('button', { name: 'Subscription' }));
  expect(screen.getByText('Monthly ₹1,999 · Yearly ₹19,990')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '1 month' }));
  const dialog = screen.getByRole('alertdialog');
  expect(within(dialog).getByRole('button', { name: 'Confirm' })).toBeDisabled();
  fireEvent.change(within(dialog).getByLabelText('Reason'), { target: { value: 'Manual bank payment received' } });
  fireEvent.change(within(dialog).getByLabelText('Payment/reference (optional)'), { target: { value: 'bank-1001' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  const [path, body] = api.post.mock.calls[0];
  expect(path).toBe(`/master/installations/${client.id}/subscription/grants`);
  expect(body).toEqual(expect.objectContaining({ baseRevision: 0, plan: 'PROFESSIONAL', billingCycle: 'MONTHLY', reason: 'Manual bank payment received', reference: 'bank-1001' }));
  expect(body.idempotencyKey).toMatch(/^grant:/);
  expect(body).not.toHaveProperty('contact');
  expect(body).not.toHaveProperty('limitOverrides');
});

test('suspending a client uses the protected lifecycle endpoint', async () => {
  api.patch.mockResolvedValue({ installation: { ...client, revision: 1, status: 'SUSPENDED' } });
  await openClient();
  fireEvent.click(screen.getByRole('button', { name: 'Suspend' }));
  const dialog = screen.getByRole('alertdialog');
  fireEvent.change(within(dialog).getByLabelText('Reason'), { target: { value: 'Payment investigation in progress' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));
  await waitFor(() => expect(api.patch).toHaveBeenCalledWith(`/master/installations/${client.id}/lifecycle`, { baseRevision: 0, action: 'SUSPEND', reason: 'Payment investigation in progress' }));
});

test('expired clients have a direct renewal action using the protected access grant', async () => {
  const expired = { ...client, status: 'EXPIRED', billingCycle: 'YEARLY', daysRemaining: 0 };
  api.get.mockImplementation(async (path) => path.includes('/operations') ? { ...operations, installation: expired } : { ...list, installations: [expired] });
  api.post.mockResolvedValue({ installation: { ...expired, revision: 1, status: 'ACTIVE' }, duplicate: false });
  render(<ClientInstallations />);
  fireEvent.click((await screen.findAllByRole('button', { name: 'Renew access' }))[0]);
  expect(await screen.findByText('Client access has expired')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Renew 1 year' }));
  const dialog = screen.getByRole('alertdialog');
  expect(within(dialog).getByText('Renew 1 year access?')).toBeInTheDocument();
  fireEvent.change(within(dialog).getByLabelText('Grant source'), { target: { value: 'MANUAL_PAYMENT' } });
  fireEvent.change(within(dialog).getByLabelText('Reason'), { target: { value: 'Annual renewal payment confirmed' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith(`/master/installations/${client.id}/subscription/grants`, expect.objectContaining({ baseRevision: 0, billingCycle: 'YEARLY', source: 'MANUAL_PAYMENT', reason: 'Annual renewal payment confirmed' })));
});

test('a failed renewal retains its reason and operation key for an idempotent retry', async () => {
  api.post.mockRejectedValueOnce(new Error('Connection interrupted')).mockResolvedValueOnce({ installation: { ...client, revision: 1, status: 'ACTIVE' }, duplicate: true });
  await openClient(); fireEvent.click(screen.getByRole('button', { name: 'Subscription' }));
  fireEvent.click(screen.getByRole('button', { name: '1 month' }));
  fireEvent.change(within(screen.getByRole('alertdialog')).getByLabelText('Reason'), { target: { value: 'Renewal received through bank transfer' } });
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Confirm' }));
  await waitFor(() => expect(mockNotify).toHaveBeenCalledWith('Connection interrupted', 'error', 'Client control'));
  const operationKey = api.post.mock.calls[0][1].idempotencyKey;
  expect(within(screen.getByRole('alertdialog')).getByLabelText('Reason')).toHaveValue('Renewal received through bank transfer');
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Confirm' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
  expect(api.post.mock.calls[1][1].idempotencyKey).toBe(operationKey);
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
});
