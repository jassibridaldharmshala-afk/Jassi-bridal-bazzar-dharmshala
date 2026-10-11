import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Dashboard from './Dashboard';
import api from '../../services/api';

jest.mock('../../services/api', () => ({ get: jest.fn() }));

const desk = { day: '2026-10-11', timezone: 'Asia/Kolkata', counts: { pickups: 3, returns: 2, overdue: 1, balance: 4, refunds: 1 } };
function overview(path) {
  const query = new URLSearchParams(path.split('?')[1]);
  const days = Number((query.get('range') || '30d').replace('d', ''));
  const toDate = '2026-10-11', fromDate = new Date(Date.parse(toDate) - (days - 1) * 86400000).toISOString().slice(0, 10);
  const metric = value => ({ value, previous: 0, delta: null });
  return {
    schemaVersion: 2, generatedAt: '2026-10-11T08:00:00Z',
    range: { from: fromDate + 'T00:00:00+05:30', to: '2026-10-12T00:00:00+05:30', fromDate, toDate, days, preset: query.get('range') || '30d', granularity: 'day', timezone: 'Asia/Kolkata' },
    scopes: { performance: 'period', attention: query.get('attentionScope') || 'period', inventory: 'live' },
    stats: { sales: metric(2500), revenue: metric(2500), orders: metric(1), customers: metric(1), average: metric(2500), products: metric(2) },
    salesOverview: Array.from({ length: days }, (_, index) => ({ key: new Date(Date.parse(fromDate) + index * 86400000).toISOString().slice(0, 10), orders: index === days - 1 ? 1 : 0, value: index === days - 1 ? 2500 : 0 })),
    orderOverview: [{ label: 'Confirmed', value: 1 }],
    recentOrders: [{ _id: 'sale-order-1', user: { name: 'Jassi User 0907' }, customer: { name: 'Sale customer', email: 'buyer@example.com' }, invoiceNumber: 'JB-101', finalAmount: 2500, createdAt: '2026-10-11T08:00:00Z', itemsCount: 1, orderStatus: 'Confirmed', paymentMethod: 'Online', paymentStatus: 'Paid' }],
    recentPagination: { page: 1, totalPages: 1, total: 1, limit: Number(query.get('orderLimit') || 5) }, topProducts: [],
    attention: Object.fromEntries(['pending', 'packing', 'dispatch', 'transit', 'cod', 'collection', 'returns'].map(key => [key, { value: 0 }])),
    inventory: { active: 2, total: 2, alerts: 0, out: 0, products: [] },
  };
}
beforeEach(() => {
  api.get.mockReset();
  api.get.mockImplementation(async path => path.startsWith('/admin/dashboard/overview') ? overview(path) : desk);
});
const metricFor = (region, label) => within(region).getAllByRole('article').find(article => within(article).queryByText(label));

test('dashboard shows sale performance and rental activity together with both order shortcuts', async () => {
  render(<Dashboard />);
  const sales = await screen.findByRole('region', { name: 'Sale performance' });
  const rentals = screen.getByRole('region', { name: 'Rental activity' });
  await within(rentals).findByText('Pickups today');
  expect(screen.getByRole('link', { name: 'Sale orders', exact: true })).toHaveAttribute('href', '/admin/orders?type=sale');
  expect(screen.getByRole('link', { name: 'Rental bookings', exact: true })).toHaveAttribute('href', '/admin/orders?type=rental');
  expect(metricFor(sales, 'Booked order value')).toHaveTextContent('₹2,500.00');
  expect(within(metricFor(sales, 'Total orders')).getByText('1', { exact: true })).toBeInTheDocument();
  for (const [label, count, scope] of [['Pickups today', 3, 'Today'], ['Returns today', 2, 'Today'], ['Overdue returns', 1, 'All dates'], ['Bookings with balance', 4, 'All dates']]) {
    const metric = metricFor(rentals, label);
    expect(within(metric).getByText(String(count), { exact: true })).toBeInTheDocument();
    expect(metric).toHaveTextContent(scope);
  }
  expect(screen.getByRole('heading', { name: 'Recent sale orders' })).toBeInTheDocument();
  expect(screen.getByText('Sale customer')).toBeInTheDocument();
  expect(screen.queryByText('Jassi User 0907')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Export sales CSV' })).toBeEnabled();
});

test('rental read failures stay within the rental panel and retry without hiding sale data or showing invented zeros', async () => {
  let attempts = 0;
  api.get.mockImplementation(async path => {
    if (path.startsWith('/admin/dashboard/overview')) return overview(path);
    if (++attempts === 1) throw new Error('Rental desk unavailable');
    return desk;
  });
  render(<Dashboard />);
  const sales = await screen.findByRole('region', { name: 'Sale performance' });
  const rentals = screen.getByRole('region', { name: 'Rental activity' });
  expect(await within(rentals).findByRole('alert')).toHaveTextContent('Rental desk unavailable');
  expect(within(rentals).queryByText('Pickups today')).not.toBeInTheDocument();
  expect(metricFor(sales, 'Booked order value')).toHaveTextContent('₹2,500.00');
  fireEvent.click(within(rentals).getByRole('button', { name: 'Retry rental activity' }));
  expect(await within(rentals).findByText('Pickups today')).toBeInTheDocument();
});

test('sale periods do not relabel rental activity as period totals and Refresh updates both data sources', async () => {
  render(<Dashboard />);
  await screen.findByRole('region', { name: 'Sale performance' });
  await screen.findByText('Pickups today');
  const rentalCalls = () => api.get.mock.calls.filter(([path]) => path === '/admin/rentals/daily-desk').length;
  expect(rentalCalls()).toBe(1);
  fireEvent.change(screen.getByLabelText('Dashboard period'), { target: { value: '7d' } });
  await waitFor(() => expect(api.get).toHaveBeenCalledWith(expect.stringContaining('range=7d'), expect.any(Object)));
  await screen.findByRole('region', { name: 'Sale performance' });
  expect(rentalCalls()).toBe(1);
  expect(screen.getByText('Pickups today')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Refresh', exact: true }));
  await waitFor(() => expect(rentalCalls()).toBe(2));
  await screen.findByText('Pickups today');
});

test('a late rental read cannot replace the result of a newer dashboard refresh', async () => {
  let resolveOld, attempts = 0;
  api.get.mockImplementation(path => {
    if (path.startsWith('/admin/dashboard/overview')) return Promise.resolve(overview(path));
    if (++attempts === 1) return new Promise(resolve => { resolveOld = resolve; });
    return Promise.resolve({ ...desk, counts: { ...desk.counts, pickups: 8 } });
  });
  render(<Dashboard />);
  await screen.findByRole('region', { name: 'Sale performance' });
  fireEvent.click(screen.getByRole('button', { name: 'Refresh', exact: true }));
  const rentals = screen.getByRole('region', { name: 'Rental activity' });
  await within(rentals).findByText('Pickups today');
  await act(async () => { resolveOld(desk); });
  expect(within(metricFor(rentals, 'Pickups today')).getByText('8', { exact: true })).toBeInTheDocument();
});
