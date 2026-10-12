import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import TrafficTracking from './TrafficTracking';
import TrafficPrivacyPolicy from './TrafficPrivacyPolicy';
import api from '../../services/api';
import { flushTraffic, getTrafficContext, resetTrafficRuntime, setTrafficConsent } from '../../utils/trafficTracker';
let mockStorefront; let mockUser;
jest.mock('../../services/api', () => ({ get: jest.fn() }));
jest.mock('../../context/StorefrontContext', () => ({ useStorefront: () => mockStorefront }));
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('../../config/websiteDesigner', () => ({ isWebsitePreview: () => false }));
const config = { storeKey: 'default-store', privacyGeneration: 1, enabled: true, consentRequired: false, sessionTimeoutMinutes: 30, attributionDays: 7, excludeLocalhost: false, excludedPaths: [], ga4Enabled: false };
let savedFetch; let sequence = 0;
beforeAll(() => Object.defineProperty(window, 'crypto', { configurable: true, value: { randomUUID: () => `privacy_test_${String(++sequence).padStart(24, '0')}` } }));
beforeEach(() => {
  jest.clearAllMocks(); localStorage.clear(); sessionStorage.clear(); resetTrafficRuntime(); mockUser = null;
  mockStorefront = { store: null, storeSlug: '', loading: false, hostResolved: true };
  api.get.mockResolvedValue(config); savedFetch = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ accepted: 20 }) });
});
afterEach(() => { resetTrafficRuntime(); global.fetch = savedFetch; });
test('basic visitor statistics run in the background with no shopping controls or consent prompt', async () => {
  const page = render(<><div>Shopping is ready</div><TrafficTracking route="/" /></>);
  expect(screen.getByText('Shopping is ready')).toBeInTheDocument();
  await waitFor(() => expect(getTrafficContext()).toBeDefined());
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  await act(async () => { await flushTraffic(); });
  page.rerender(<><div>Shopping is ready</div><TrafficTracking route="/products?token=never-retain" /></>);
  await act(async () => { await flushTraffic(); });
  page.rerender(<><div>Shopping is ready</div><TrafficTracking route="/" /></>);
  await act(async () => { await flushTraffic(); });
  const events = global.fetch.mock.calls.flatMap(([, options]) => JSON.parse(options.body).events || []);
  expect(events.filter(event => event.name === 'PAGE_VIEW').map(event => event.path)).toEqual(['/', '/products', '/']);
  expect(JSON.stringify(events)).not.toContain('never-retain');
  expect(api.get).toHaveBeenCalledTimes(1);
});
test('host resolution and analytics outages do not block storefront content or manufacture another-store visits', async () => {
  mockStorefront.hostResolved = false;
  const page = render(<><span>Shop content</span><TrafficTracking route="/" /></>);
  expect(api.get).not.toHaveBeenCalled(); expect(screen.getByText('Shop content')).toBeInTheDocument();
  mockStorefront = { store: { _id: 'brand-b' }, storeSlug: 'brand-b', loading: false, hostResolved: true };
  api.get.mockRejectedValue(new Error('Analytics unavailable'));
  page.rerender(<><span>Shop content</span><TrafficTracking route="/" /></>);
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/analytics/config?store=brand-b', expect.objectContaining({ silent: true })));
  expect(screen.getByText('Shop content')).toBeInTheDocument(); expect(getTrafficContext()).toBeUndefined(); expect(global.fetch).not.toHaveBeenCalled();
});
test('saved opt-out and internal-admin mode never record a customer visit', async () => {
  localStorage.setItem('traffic:default-store:consent', JSON.stringify({ value: 'denied' }));
  const page = render(<TrafficTracking route="/products" />);
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
  await act(async () => { await flushTraffic(); });
  expect(getTrafficContext()).toBeUndefined(); expect(global.fetch).not.toHaveBeenCalled();
  mockUser = { activeMode: 'admin' }; page.rerender(<TrafficTracking route="/products/one" />);
  await flushTraffic(); expect(global.fetch).not.toHaveBeenCalled(); expect(screen.queryByRole('button', { name: 'Allow analytics' })).not.toBeInTheDocument();
});

test.each(['/product/item', '/cart', '/rental-bag', '/store/brand-a/rental-checkout', '/orders', '/order-detail?id=one'])('tracking adds no floating or inline preferences on %s', async route => {
  render(<><div data-rental-checkout-utilities /><TrafficTracking route={route} /></>);
  await waitFor(() => expect(getTrafficContext()).toBeDefined());
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(document.querySelector('[data-rental-checkout-utilities]').children).toHaveLength(0);
  expect(document.querySelector('.traffic-privacy')).toBeNull();
});

test('privacy policy keeps opt-out and deletion controls inside the policy only', async () => {
  render(<><TrafficTracking route="/privacy-policy" /><TrafficPrivacyPolicy /></>);
  const stop = await screen.findByRole('button', { name: 'Stop & delete my visitor statistics' });
  expect(stop.closest('section')).toHaveClass('traffic-policy');
  await act(async () => { await flushTraffic(); });
  global.fetch.mockClear();
  await act(async () => { fireEvent.click(stop); });
  expect(getTrafficContext()).toBeUndefined();
  expect(await screen.findByText(/Visitor statistics stopped/)).toBeInTheDocument();
  expect(global.fetch.mock.calls.some(([url]) => url.includes('/forget'))).toBe(true);
  expect(global.fetch.mock.calls.some(([url]) => url.includes('/collect'))).toBe(false);
});

test('optional GA4 cannot start until a visitor explicitly allows it inside Privacy Policy', async () => {
  api.get.mockResolvedValue({ ...config, consentRequired: true, ga4Enabled: true, ga4MeasurementId: 'G-ABCDEF' });
  const view = render(<TrafficTracking route="/product/item" />);
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
  await act(async () => { await flushTraffic(); });
  expect(getTrafficContext()).toBeUndefined();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  view.rerender(<><TrafficTracking route="/privacy-policy" /><TrafficPrivacyPolicy /></>);
  fireEvent.click(await screen.findByRole('button', { name: 'Allow visitor statistics' }));
  await waitFor(() => expect(getTrafficContext()).toBeDefined());
  await act(async () => { await setTrafficConsent(false, true); });
  expect(getTrafficContext()).toBeUndefined();
  document.getElementById('store-analytics-tag')?.remove(); delete window.gtag; delete window.dataLayer;
});
