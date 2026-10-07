import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import api from '../../services/api';
import { openRazorpayCheckout } from '../../utils/razorpayCheckout';
import SystemStatus from './SystemStatus';
import { SUBSCRIPTION_STATUS_EVENT } from '../../utils/subscriptionNotice';

const mockNotify = jest.fn();
jest.mock('../../services/api', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
jest.mock('../../utils/razorpayCheckout', () => ({ openRazorpayCheckout: jest.fn() }));
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ notify: mockNotify, user: { name: 'Client Admin', phone: '9812345678' } }) }));

const status = {
  managed: true, companyName: 'Client Store', installationId: 'client_123456789', source: 'platform', platformReachable: true,
  status: 'TRIAL', plan: 'PROFESSIONAL', billingCycle: 'TRIAL', endsAt: '2099-01-01T00:00:00.000Z',
  limits: { products: 1000, ordersPerMonth: 2000 }, appVersion: '1.0.0', targetVersion: '1.1.0', latestVersion: '1.1.0',
  updateAvailable: true, updateChannel: 'stable', issuedAt: '2026-09-09T00:00:00.000Z', checkout: { configured: true },
  pricing: { revision: 2, currency: 'INR', taxMode: 'EXCLUSIVE', gstPercent: 18 },
  plans: [{ id: 'PROFESSIONAL', name: 'Professional', description: 'Growing store', features: ['catalog', 'orders'], limits: { products: 1000, ordersPerMonth: 2000 }, prices: { monthly: 1999, yearly: 19990, lifetime: 49999 } }],
};

beforeEach(() => {
  jest.clearAllMocks();
  api.get.mockResolvedValue(status);
  api.post.mockImplementation((path) => {
    if (path.endsWith('/checkout')) return Promise.resolve({ keyId: 'rzp_test', orderId: 'order_1', amount: 1999000, currency: 'INR', storeName: 'Client Store' });
    if (path.endsWith('/verify')) return Promise.resolve({ success: true });
    if (path.endsWith('/refresh')) return Promise.resolve({ ...status, status: 'ACTIVE', billingCycle: 'YEARLY' });
    return Promise.resolve({});
  });
  openRazorpayCheckout.mockImplementation(({ onSuccess }) => onSuccess({ razorpay_order_id: 'order_1', razorpay_payment_id: 'pay_1', razorpay_signature: 'signature' }));
});

test('shows signed client status and renews through the local backend proxy', async () => {
  render(<SystemStatus />);
  expect(await screen.findByText('Client Store')).toBeTruthy();
  expect(screen.getByText('Update assigned')).toBeTruthy();
  expect(screen.getByText('₹23,588')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Choose this plan' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/system/subscription/checkout', { plan: 'PROFESSIONAL', billingCycle: 'YEARLY' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/system/subscription/verify', expect.objectContaining({ razorpay_payment_id: 'pay_1' })));
  expect(openRazorpayCheckout).toHaveBeenCalledWith(expect.objectContaining({ orderId: 'order_1', amount: 1999000 }));
});

test('manual billing refresh publishes the verified access status to the global notice', async () => {
  const listener = jest.fn(); window.addEventListener(SUBSCRIPTION_STATUS_EVENT, listener);
  try {
    render(<SystemStatus />); await screen.findByText('Client Store');
    fireEvent.click(screen.getByRole('button', { name: 'Check now' }));
    await waitFor(() => expect(listener).toHaveBeenCalledTimes(2));
    expect(listener.mock.calls[1][0].detail.data).toMatchObject({ managed: true, status: 'ACTIVE', billingCycle: 'YEARLY' });
  } finally { window.removeEventListener(SUBSCRIPTION_STATUS_EVENT, listener); }
});

test('a captured payment with unavailable access verification is not falsely reported as active', async () => {
  api.post.mockImplementation((path) => {
    if (path.endsWith('/checkout')) return Promise.resolve({ keyId: 'rzp_test', orderId: 'order_1', amount: 1999000, currency: 'INR', storeName: 'Client Store' });
    if (path.endsWith('/verify')) return Promise.resolve({ success: true });
    if (path.endsWith('/refresh')) return Promise.reject(new Error('Platform connection is unavailable'));
    return Promise.resolve({});
  });
  render(<SystemStatus />); await screen.findByText('Client Store');
  fireEvent.click(screen.getByRole('button', { name: 'Choose this plan' }));
  await waitFor(() => expect(mockNotify).toHaveBeenCalledWith(expect.stringContaining('before retrying payment'), 'warning', 'Access verification pending'));
  expect(mockNotify).not.toHaveBeenCalledWith('Professional access is active.', 'success', 'Subscription updated');
  expect(api.post.mock.calls.filter(([path]) => path.endsWith('/checkout'))).toHaveLength(1);
});
