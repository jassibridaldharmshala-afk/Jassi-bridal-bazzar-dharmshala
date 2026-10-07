import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Products from './Products';
import Crm from './Crm';
import Dashboard from './Dashboard';
import Analytics from './Analytics';
import BusinessCenter from './BusinessCenter';
import api from '../../services/api';
const mockNotify = jest.fn();
jest.mock('../../services/api', () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn() }));
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { activeMode: 'seller' }, notify: mockNotify }) }));
beforeEach(() => jest.resetAllMocks());
test.each([[Products, '/seller/products', 'Product unavailable'], [Crm, '/seller/crm', 'Customers unavailable']])('seller list recovers after failed load without retaining the error', async (Page, path, message) => {
  let attempts = 0;
  api.get.mockImplementation(async (requestPath) => {
    if (!requestPath.startsWith(path)) return [];
    attempts += 1;
    if (attempts === 1) throw new Error(message);
    return [];
  });
  render(<Page navigate={jest.fn()} />);
  expect(await screen.findByText(message)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(screen.queryByText(message)).not.toBeInTheDocument());
  await waitFor(() => expect(api.get.mock.calls.filter(([requestPath]) => requestPath.startsWith(path))).toHaveLength(2));
});
test('malformed seller products show recovery rather than crashing or claiming the catalog is empty', async () => {
  let attempts = 0;
  api.get.mockImplementation(async path => {
    if (!path.startsWith('/seller/products?')) return [];
    attempts += 1;
    return attempts === 1 ? { wrong: [] } : { items: [], total: 0, totalPages: 1 };
  });
  render(<Products navigate={jest.fn()} />);
  expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('No products yet')).toBeInTheDocument();
});
test('dashboard retries both data dependencies and renders confirmed store statistics', async () => {
  let recover = false;
  api.get.mockImplementation(async path => {
    if (!recover) throw new Error('Store data unavailable');
    return path === '/seller/dashboard/stats' ? { products: 8, orders: 2, revenue: 900, returns: 0 } : { store: { name: 'Silk boutique', slug: 'silk', status: 'LIVE' } };
  });
  const navigate = jest.fn(); render(<Dashboard navigate={navigate} />);
  const retry = await screen.findByRole('button', { name: 'Try again' });
  recover = true; fireEvent.click(retry);
  expect(await screen.findByRole('heading', { name: 'Silk boutique' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Orders' }));
  expect(navigate).toHaveBeenCalledWith('/seller/orders');
});
test('analytics updates the chosen period and can retry that exact failed period', async () => {
  api.get.mockResolvedValueOnce({ events: { PRODUCT_VIEW: 5 } }).mockRejectedValueOnce(new Error('Analytics unavailable')).mockResolvedValueOnce({ events: { PRODUCT_VIEW: 12 }, note: 'Last seven days' });
  render(<Analytics />);
  fireEvent.change(await screen.findByRole('combobox', { name: 'Analytics period' }), { target: { value: '7d' } });
  fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('Last seven days')).toBeInTheDocument();
  expect(screen.getByRole('combobox')).toHaveValue('7d');
  expect(api.get).toHaveBeenLastCalledWith('/seller/analytics/funnel?range=7d');
});

test('business center changes live periods and links to the unified campaign workspace', async () => {
  const overview = {
    store: { id: 'store-1', name: 'Silk boutique', slug: 'silk' },
    platform: { name: 'Premium', status: 'ACTIVE', features: ['businessAssistant', 'abandonedCart', 'festival'] },
    festivalCampaign: { enabled: false, preset: 'diwali', campaignKey: 'diwali', title: 'Diwali edit', badgeText: 'Limited time', couponCode: '', effects: true },
    health: {
      score: 78, grade: 'Mostly ready', period: { key: '30d', label: 'Last 30 days' }, generatedAt: '2026-09-09T10:00:00Z',
      performance: { current: { bookedRevenue: 2400, paidRevenue: 1800, orders: 3, delivered: 1, cancelled: 0, averageOrderValue: 800, conversionRate: 4 }, previous: {}, change: { bookedRevenue: 20, paidRevenue: 10, orders: 50, averageOrderValue: -5 } },
      priorities: [{ id: 'fulfilment', title: 'Prepare customer orders', count: 2, severity: 'urgent', detail: '2 orders need packing.', route: 'orders' }],
      checks: [{ id: 'identity', label: 'Store identity', weight: 12, earned: 0, passed: false, recommendation: 'Add contact details.', route: 'settings' }],
      recovery: { remindersSent: 1, recoveredOrders: 1, recoveredRevenue: 800 }, campaign: { orders: 0, revenue: 0, couponUses: 0 }, assistantHistory: [], activeCoupons: [],
      metrics: { abandonedCarts: 0 },
    },
  };
  api.get.mockImplementation(async path => path.includes('/overview') ? { ...overview, health: { ...overview.health, period: { key: path.includes('7d') ? '7d' : '30d', label: path.includes('7d') ? 'Last 7 days' : 'Last 30 days' } } } : { items: [] });
  api.post.mockResolvedValue({ question: 'What should I restock?', answer: 'Two products need stock.', actions: ['Review inventory.'], generatedAt: '2026-09-09T10:01:00Z' });
  render(<BusinessCenter />);
  expect(await screen.findByRole('heading', { name: "Today's priorities" })).toBeInTheDocument();
  expect(screen.getByText('Rs. 2,400')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '7 days' }));
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/seller/business/overview?range=7d'));
  fireEvent.change(screen.getByRole('textbox', { name: 'Business question' }), { target: { value: 'What should I restock?' } });
  fireEvent.click(screen.getByRole('button', { name: 'Analyse live data' }));
  expect(await screen.findByText('Two products need stock.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Open campaigns/ })).toHaveAttribute('href', '/seller/campaigns');
  expect(screen.queryByRole('button', { name: 'Schedule campaign' })).not.toBeInTheDocument();
});
