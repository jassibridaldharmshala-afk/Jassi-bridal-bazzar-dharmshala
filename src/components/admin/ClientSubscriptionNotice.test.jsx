import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import api from '../../services/api';
import ClientSubscriptionNotice from './ClientSubscriptionNotice';
import { publishSubscriptionStatus, SUBSCRIPTION_REQUIRED_EVENT } from '../../utils/subscriptionNotice';

jest.mock('../../services/api', () => ({ get: jest.fn(), post: jest.fn() }));
let mockUser;
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
const snapshot = (changes = {}) => ({
  managed: true, installationId: 'client_nishaya', companyName: 'Nishaya Jewellery',
  status: 'EXPIRED', billingCycle: 'TRIAL', plan: 'PROFESSIONAL',
  endsAt: new Date(Date.now() - 1000).toISOString(), serverNow: new Date().toISOString(),
  platformReachable: true, renewalMessage: 'Contact your account manager to renew.', ...changes,
});
const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };

beforeEach(() => {
  jest.clearAllMocks(); sessionStorage.clear();
  window.history.replaceState(null, '', '/admin');
  mockUser = { _id: 'client-admin', role: 'admin', activeMode: 'admin' };
  api.get.mockResolvedValue(snapshot());
  api.post.mockImplementation(async () => snapshot({ status: 'ACTIVE', billingCycle: 'YEARLY', endsAt: new Date(Date.now() + 365 * 86400000).toISOString() }));
});
afterEach(() => { jest.useRealTimers(); document.body.style.overflow = ''; });

test.each([
  ['TRIAL', 'Your free trial has ended', 'Free trial'],
  ['MONTHLY', 'Your monthly subscription has expired', 'Monthly subscription'],
  ['YEARLY', 'Your yearly subscription has expired', 'Yearly subscription'],
])('%s expiry shows a branded, accessible notice with renewal actions', async (billingCycle, title, period) => {
  api.get.mockResolvedValue(snapshot({ billingCycle }));
  render(<ClientSubscriptionNotice />);
  const dialog = await screen.findByRole('alertdialog', { name: title });
  expect(dialog).toHaveAttribute('aria-modal', 'true');
  expect(within(dialog).getByText(period)).toBeInTheDocument();
  expect(within(dialog).getByText('Expired on')).toBeInTheDocument();
  expect(within(dialog).getByText(/Nishaya Jewellery/)).toBeInTheDocument();
  expect(within(dialog).getByText('Contact your account manager to renew.')).toBeInTheDocument();
  expect(within(dialog).getByRole('link', { name: 'View renewal options' })).toHaveAttribute('href', '/admin/system');
  expect(api.get).toHaveBeenCalledWith('/system/license?summary=1', expect.objectContaining({ silent: true, cacheScope: 'subscription:client-admin' }));
});

test('dismissal lasts for this session and period, with a persistent reminder and details button', async () => {
  const first = render(<ClientSubscriptionNotice />);
  fireEvent.click(await screen.findByRole('button', { name: 'Dismiss subscription notice' }));
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Subscription access notice' })).toBeInTheDocument();
  first.unmount();
  render(<ClientSubscriptionNotice />); await flush();
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'View details' }));
  expect(screen.getByRole('alertdialog')).toBeInTheDocument();
});

test('a new access period produces a new notice even after an earlier dismissal', async () => {
  render(<ClientSubscriptionNotice />);
  fireEvent.click(await screen.findByRole('button', { name: 'Dismiss subscription notice' }));
  act(() => publishSubscriptionStatus(snapshot({ billingCycle: 'MONTHLY', endsAt: new Date(Date.now() - 5000).toISOString() }), mockUser));
  expect(screen.getByRole('alertdialog', { name: 'Your monthly subscription has expired' })).toBeInTheDocument();
});

test('verified master renewal closes the popup and removes the restricted reminder without logging out', async () => {
  render(<ClientSubscriptionNotice />);
  fireEvent.click(await screen.findByRole('button', { name: 'Check renewal' }));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  expect(api.post).toHaveBeenCalledWith('/system/license/refresh?summary=1', {}, expect.objectContaining({ silent: true }));
  expect(screen.queryByRole('region', { name: 'Subscription access notice' })).not.toBeInTheDocument();
  expect(mockUser.activeMode).toBe('admin');
  expect(sessionStorage.getItem('samira_subscription_notice:client-admin')).toBeNull();
});

test('failed renewal verification retains the verified restriction and gives an actionable error', async () => {
  api.post.mockRejectedValue(new Error('Unable to reach the platform. Please try again.'));
  render(<ClientSubscriptionNotice />);
  fireEvent.click(await screen.findByRole('button', { name: 'Check renewal' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to reach the platform');
  expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Check renewal' })).toBeEnabled();
});

test('offline cached access is not presented as a successful renewal', async () => {
  api.post.mockResolvedValue(snapshot({ platformReachable: false }));
  render(<ClientSubscriptionNotice />);
  fireEvent.click(await screen.findByRole('button', { name: 'Check renewal' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('The platform is currently unreachable');
  expect(screen.getByRole('alertdialog')).toBeInTheDocument();
});

test.each([
  { managed: false },
  snapshot({ status: 'ACTIVE', endsAt: new Date(Date.now() + 86400000).toISOString() }),
  { success: false, code: 'SERVICE_UNAVAILABLE' },
])('unmanaged, valid and unverified states never fabricate an expiry popup', async (response) => {
  api.get.mockResolvedValue(response);
  render(<ClientSubscriptionNotice />); await flush();
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
});

test.each([
  { _id: 'buyer', role: 'customer', activeMode: 'customer' },
  { _id: 'owner', role: 'admin', activeMode: 'customer' },
  { _id: 'offline-admin', role: 'admin', activeMode: 'admin', offlineSession: true },
  null,
])('buyers, customer mode, offline sessions and signed-out users do not run license checks', async (user) => {
  mockUser = user; render(<ClientSubscriptionNotice />); await flush();
  expect(api.get).not.toHaveBeenCalled(); expect(api.post).not.toHaveBeenCalled();
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
});

test('billing stays usable without an automatic overlay but retains access guidance', async () => {
  window.history.replaceState(null, '', '/admin/system');
  render(<ClientSubscriptionNotice />);
  expect(await screen.findByRole('region', { name: 'Subscription access notice' })).toBeInTheDocument();
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'View details' }));
  expect(screen.getByRole('alertdialog')).toBeInTheDocument();
});

test('popup supports keyboard dismissal, focus containment and scroll restoration', async () => {
  render(<><button type="button">Previous control</button><ClientSubscriptionNotice /></>);
  const dialog = await screen.findByRole('alertdialog');
  expect(within(dialog).getByRole('link', { name: 'View renewal options' })).toHaveFocus();
  expect(document.body).toHaveClass('client-access-dialog-open');
  const last = within(dialog).getByRole('button', { name: 'Continue reviewing existing records' });
  last.focus(); fireEvent.keyDown(document, { key: 'Tab' });
  expect(within(dialog).getByRole('button', { name: 'Dismiss subscription notice' })).toHaveFocus();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(document.body.style.overflow).toBe('');
  expect(document.body).not.toHaveClass('client-access-dialog-open');
});

test('expiry is noticed while an admin tab is open using server time, not a skewed device clock', async () => {
  jest.useFakeTimers();
  const serverNow = Date.now() - 3600000;
  api.get.mockResolvedValue(snapshot({ status: 'TRIAL', serverNow: new Date(serverNow).toISOString(), endsAt: new Date(serverNow + 2000).toISOString() }));
  api.post.mockResolvedValue(snapshot({ status: 'EXPIRED', serverNow: new Date(serverNow + 2500).toISOString(), endsAt: new Date(serverNow + 2000).toISOString() }));
  render(<ClientSubscriptionNotice />); await flush();
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  await act(async () => { jest.advanceTimersByTime(2500); });
  expect(screen.getByRole('alertdialog', { name: 'Your free trial has ended' })).toBeInTheDocument();
  expect(api.post).toHaveBeenCalledTimes(1);
});

test('restricted access polls for master renewal in the background', async () => {
  jest.useFakeTimers(); render(<ClientSubscriptionNotice />); await flush();
  expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  await act(async () => { jest.advanceTimersByTime(60000); });
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(api.post).toHaveBeenCalledTimes(1);
});

test('renewal before the cached deadline prevents a false expiry popup', async () => {
  jest.useFakeTimers();
  api.get.mockResolvedValue(snapshot({ status: 'TRIAL', endsAt: new Date(Date.now() + 2000).toISOString() }));
  render(<ClientSubscriptionNotice />); await flush();
  await act(async () => { jest.advanceTimersByTime(2500); });
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
});

test('a connection failure at the known expiry falls back to its verified end without retry loops', async () => {
  jest.useFakeTimers();
  api.get.mockResolvedValue(snapshot({ status: 'TRIAL', endsAt: new Date(Date.now() + 2000).toISOString() }));
  api.post.mockRejectedValue(new Error('Platform unreachable'));
  render(<ClientSubscriptionNotice />); await flush();
  await act(async () => { jest.advanceTimersByTime(2500); });
  expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  await act(async () => { jest.advanceTimersByTime(5000); });
  expect(api.post).toHaveBeenCalledTimes(1);
});

test('the popup scroll lock does not overwrite another overlay or survive switching to customer mode', async () => {
  document.body.style.overflow = 'hidden';
  const view = render(<ClientSubscriptionNotice />); await screen.findByRole('alertdialog');
  mockUser = { ...mockUser, activeMode: 'customer' };
  view.rerender(<ClientSubscriptionNotice />);
  expect(document.body).not.toHaveClass('client-access-dialog-open');
  expect(document.body.style.overflow).toBe('hidden');
});

test('a forced check is queued behind a cached read instead of accepting it as renewal verification', async () => {
  jest.useFakeTimers();
  let resolve;
  api.get.mockReturnValue(new Promise((done) => { resolve = done; }));
  render(<ClientSubscriptionNotice />);
  act(() => window.dispatchEvent(new CustomEvent(SUBSCRIPTION_REQUIRED_EVENT, { detail: { userId: mockUser._id } })));
  await act(async () => resolve(snapshot()));
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
});

test('billing status wins over an older in-flight background response', async () => {
  let resolve;
  api.get.mockReturnValue(new Promise((done) => { resolve = done; }));
  render(<ClientSubscriptionNotice />);
  act(() => publishSubscriptionStatus(snapshot({ status: 'ACTIVE', endsAt: new Date(Date.now() + 86400000).toISOString() }), mockUser));
  await act(async () => resolve(snapshot()));
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
});

test('status updates are scoped to the current user and installation', async () => {
  render(<ClientSubscriptionNotice />); await screen.findByRole('alertdialog');
  const active = snapshot({ status: 'ACTIVE', endsAt: new Date(Date.now() + 86400000).toISOString() });
  act(() => publishSubscriptionStatus(active, { _id: 'other-admin' }));
  act(() => publishSubscriptionStatus({ ...active, installationId: 'other-installation' }, mockUser));
  expect(screen.getByRole('alertdialog')).toBeInTheDocument();
});

test('subscription-required errors refresh verified state without taking action on billing', async () => {
  jest.useFakeTimers();
  api.get.mockResolvedValue(snapshot({ status: 'ACTIVE', endsAt: new Date(Date.now() + 86400000).toISOString() }));
  api.post.mockResolvedValue(snapshot());
  render(<ClientSubscriptionNotice />); await flush();
  await act(async () => {
    jest.advanceTimersByTime(11000);
    window.dispatchEvent(new CustomEvent(SUBSCRIPTION_REQUIRED_EVENT, { detail: { userId: mockUser._id } }));
  });
  expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  expect(api.post).toHaveBeenCalledTimes(1);
});

test.each(['SUSPENDED', 'REVOKED'])('%s explains restoration, without claiming payment alone restores access', async (status) => {
  api.get.mockResolvedValue(snapshot({ status, billingCycle: 'YEARLY' }));
  render(<ClientSubscriptionNotice />);
  const dialog = await screen.findByRole('alertdialog');
  expect(within(dialog).getByRole('link', { name: 'Review access' })).toBeInTheDocument();
  expect(within(dialog).queryByRole('link', { name: 'View renewal options' })).not.toBeInTheDocument();
});
