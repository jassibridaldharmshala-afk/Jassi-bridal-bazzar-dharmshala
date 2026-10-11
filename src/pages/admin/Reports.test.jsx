import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Reports from './Reports';
import api from '../../services/api';

jest.mock('../../services/api', () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() }));
jest.mock('../../utils/reportExport', () => ({ downloadTextFile: jest.fn(), downloadReportPdf: jest.fn() }));
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({}) }));

const capabilities = { canExport: true, canManage: true, canSchedule: false, sections: { summary: true, products: true, customers: true, marketing: true, fulfillment: true } };
const base = { currency: 'INR', timezone: 'Asia/Kolkata', generatedAt: '2026-09-10T12:00:00.000Z', range: { fromDate: '2026-09-04', toDate: '2026-09-10' }, capabilities };
const responses = {
  summary: { ...base, data: { metrics: { bookedValue: { value: 1100, previous: 1000, delta: 10 }, recognizedRevenue: { value: 900, previous: 800, delta: 12.5 }, orders: { value: 1 }, averageOrderValue: { value: 1100 }, customers: { value: 1 }, units: { value: 1 }, grossSales: { value: 1500 }, discounts: { value: 400 }, refunds: { value: 200 } }, current: { allOrders: 1, orders: 1, paidOrders: 1, grossSales: 1500, productDiscount: 300, couponDiscount: 100, merchandiseSales: 1200, bookedValue: 1100, paymentCollected: 1100, refunds: 200, netCollected: 900, recognizedRevenue: 900, costCoverage: 100 }, series: [{ key: '2026-09-10', label: '2026-09-10', orders: 1, revenue: 1100, refunds: 200, net: 900 }], statusBreakdown: [{ label: 'Confirmed', value: 1 }], paymentBreakdown: [{ label: 'CARD', value: 1 }], definitions: { recognizedRevenue: 'Valid paid order value after refunds.' } } },
  products: { ...base, data: { inventory: { products: 1, units: 9, valueAtRetail: 10800, valueAtCost: 4500, lowStock: 0, outOfStock: 0 }, items: [{ id: 'p1', name: 'Premium Saree', sku: 'SAR-1', units: 1, netUnits: 1, orders: 1, itemRevenue: 900, estimatedProfit: 400, estimatedMargin: 44.4, returnedUnits: 0, returnRate: 0 }], slowMoving: [], stockoutExposure: [] } },
  customers: { ...base, data: { summary: { buyingCustomers: 1, newCustomers: 1, returningCustomers: 0, repeatRate: 0, averageCustomerValue: 900 }, topCustomers: [{ id: 'u1', name: 'Riya', type: 'New', orders: 1, units: 1, netSpend: 900, averageOrderValue: 900 }], locations: [{ city: 'Jaipur', state: 'Rajasthan', pincode: '302001', customers: 1, orders: 1, revenue: 900 }] } },
  marketing: { ...base, data: { conversionRate: 10, sources: [{ source: 'instagram' }], attribution: [{ source: 'instagram', campaign: 'festive', orders: 1, customers: 1, revenue: 900 }], coupons: [], banners: [], funnel: [{ name: 'STORE_VIEW', value: 10, rateFromPrevious: 100 }, { name: 'PURCHASE', value: 1, rateFromPrevious: 10 }], homeEngagement: [{ event: 'HOME_SECTION_VIEW', section: 'featured', action: '', value: 8 }], note: 'First-party events.' } },
  fulfillment: { ...base, data: { summary: { shipments: 1, waitingForShipment: 0, delayed: 0, averageDeliveryHours: 24, rto: 0, codOutstandingAmount: 0, returnRequests: 0, returns: 0, exchanges: 0, refunded: 0, refundPending: 0, overdueReturns: 0 }, providers: [{ provider: 'bluedart', shipments: 1, delivered: 1, deliveryRate: 100, rtoRate: 0, exceptions: 0, charge: 100 }], shipmentStatuses: [{ label: 'DELIVERED', value: 1 }], returnStatuses: [] } },
};

function mockReports(overrides = {}) {
  api.get.mockImplementation((path) => {
    if (path.includes('/reports/options')) return Promise.resolve({ capabilities, products: [], categories: [], stores: [] });
    if (path.includes('/reports/views')) return Promise.resolve({ items: [] });
    const section = Object.keys(responses).find((key) => path.includes(`/center/${key}`));
    if (overrides[section]) return overrides[section];
    return Promise.resolve(responses[section]);
  });
}

beforeEach(() => { jest.clearAllMocks(); mockReports(); });

test('equivalent permission responses do not restart the same report requests', async () => {
  render(<Reports />);
  await screen.findByText('Collections and refund trend');
  await waitFor(() => expect(api.get).toHaveBeenCalledWith(expect.stringContaining('/reports/options'), expect.any(Object)));
  expect(api.get.mock.calls.filter(([path]) => path.includes('/center/summary?'))).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: /^Filters/ }));
  fireEvent.change(screen.getByLabelText('Traffic device'), { target: { value: 'mobile' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  await waitFor(() => expect(api.get.mock.calls.filter(([path]) => path.includes('/center/summary?') && path.includes('device=mobile'))).toHaveLength(1));
  await screen.findByText('Collections and refund trend');
  expect(api.get.mock.calls.filter(([path]) => path.includes('/center/summary?'))).toHaveLength(2);
});

test('a late previous report cannot overwrite the newly filtered totals', async () => {
  let finishOldSummary;
  const oldSummary = new Promise(resolve => { finishOldSummary = resolve; });
  const filteredSummary = { ...responses.summary, data: { ...responses.summary.data, metrics: { ...responses.summary.data.metrics, recognizedRevenue: { value: 12345 } } } };
  mockReports();
  const normalGet = api.get.getMockImplementation();
  api.get.mockImplementation(path => path.includes('/center/summary?')
    ? path.includes('device=mobile') ? Promise.resolve(filteredSummary) : oldSummary
    : normalGet(path));
  render(<Reports />);
  fireEvent.click(screen.getByRole('button', { name: /^Filters/ }));
  fireEvent.change(screen.getByLabelText('Traffic device'), { target: { value: 'mobile' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  expect(await screen.findByText('₹12,345.00')).toBeInTheDocument();
  await act(async () => { finishOldSummary(responses.summary); });
  expect(screen.getByText('₹12,345.00')).toBeInTheDocument();
});

test('seller Reports Center loads every permitted section from seller-scoped APIs', async () => {
  render(<Reports route="/seller/reports" />);
  expect(await screen.findByText('Collections and refund trend')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Sales & finance/i }));
  expect(screen.getByText('Gross-to-net reconciliation')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Products & inventory/i }));
  expect(await screen.findByText('Product performance')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /^Customers$/i }));
  expect(await screen.findByText('Customer locations')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /^Marketing$/i }));
  expect(await screen.findByText('Storefront funnel')).toBeInTheDocument();
  expect(screen.getByText('Mobile home engagement')).toBeInTheDocument();
  expect(screen.getByText('Section viewed')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Shipping & returns/i }));
  expect(await screen.findByText('Courier performance')).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledWith(expect.stringContaining('/seller/reports/center/summary'), expect.any(Object));
});

test('one failed report section does not hide successfully loaded sections', async () => {
  mockReports({ products: Promise.reject(new Error('Product report unavailable')) });
  render(<Reports />);
  expect(await screen.findByText('Collections and refund trend')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Products & inventory/i }));
  expect(await screen.findByText('Product report unavailable')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /^Overview$/i }));
  expect(screen.getByText('Collections and refund trend')).toBeInTheDocument();
});

test('a reusable report view saves the active filters', async () => {
  api.post.mockResolvedValue({ id: 'view-1', name: 'Weekly owner review', filters: { range: '30d' }, sections: Object.keys(responses), schedule: { frequency: 'NONE' } });
  render(<Reports />);
  await screen.findByText('Collections and refund trend');
  fireEvent.click(screen.getByRole('button', { name: /Save view/i }));
  fireEvent.change(screen.getByLabelText('View name'), { target: { value: 'Weekly owner review' } });
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^Save view$/i }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith(expect.stringContaining('/admin/reports/views'), expect.objectContaining({ filters: { range: '30d' } })));
  expect(await screen.findByRole('button', { name: 'Weekly owner review' })).toBeInTheDocument();
});
