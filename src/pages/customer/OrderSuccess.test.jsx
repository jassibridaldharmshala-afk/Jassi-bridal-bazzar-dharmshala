import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import OrderSuccess from './OrderSuccess';
import api from '../../services/api';
import { downloadReceiptPdf, printReceipt } from '../../utils/printReceipt';

const mockStorefront = { storeSlug: '', isHostStore: false };
jest.mock('../../context/StorefrontContext', () => ({ useStorefront: () => mockStorefront }));
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('../../services/api', () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock('../../components/order/Receipt', () => ({ receipt }) => <div>Invoice for {receipt.orderId}</div>);
jest.mock('../../utils/printReceipt', () => ({ downloadReceiptPdf: jest.fn(), printReceipt: jest.fn() }));
const base = {
  _id: '0123456789abcdef01234567', orderStatus: 'Pending', createdAt: '2026-09-06T10:00:00Z',
  orderItems: [{ _id: 'line1', name: 'Floral saree', size: 'Free size', color: 'Ivory', quantity: 2, price: 1000, originalPrice: 1500 }],
  totalMRP: 3000, productDiscount: 1000, couponDiscount: 100, platformFee: 23, deliveryCharge: 0, finalAmount: 1923,
  paymentMethod: 'COD', paymentStatus: 'Pending', paymentState: 'PENDING',
  shippingAddress: { fullName: 'Test Shopper', houseNo: '12A', area: 'Fort', city: 'Mumbai', state: 'Maharashtra', pincode: '400001', mobile: '9000000000', addressType: 'Home' },
};
const invoice = { orderId: base._id, items: base.orderItems, finalAmount: base.finalAmount };
const route = `/order-success?id=${base._id}`;
function mockOrder(overrides = {}) {
  api.get.mockImplementation(async (path) => path.endsWith('/receipt') ? invoice : { ...base, ...overrides });
}
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function close() { this.removeAttribute('open'); };
});
beforeEach(() => {
  jest.resetAllMocks(); mockStorefront.storeSlug = ''; mockStorefront.isHostStore = false;
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: jest.fn().mockResolvedValue() } });
});

test('waits for a real order, shows COD and saved item/address details, and loads the invoice only on demand', async () => {
  let resolve; api.get.mockReturnValue(new Promise((done) => { resolve = done; }));
  render(<OrderSuccess route={route} navigate={jest.fn()} />);
  expect(screen.getByRole('status')).toHaveTextContent('Finding your order');
  expect(screen.queryByText('Thank you for your order!')).not.toBeInTheDocument();
  await act(async () => resolve(base));
  expect(screen.getByRole('heading', { name: 'Thank you for your order!' })).toBeInTheDocument();
  expect(screen.getByText('Payment due on delivery')).toBeInTheDocument();
  expect(screen.getByText(/No online payment is needed/)).toHaveTextContent('₹1,923');
  expect(screen.getByText(/Size: Free size.*Colour: Ivory.*Qty: 2/)).toBeInTheDocument();
  expect(screen.getByText('Mumbai, Maharashtra - 400001')).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(api.get).toHaveBeenCalledTimes(1);
  expect(api.get).toHaveBeenCalledWith(`/orders/${base._id}`, {
    cacheFirst: true,
    cacheScope: base._id,
    forceRefetch: false,
  });
  const progress = screen.getByRole('region', { name: 'Delivery progress' });
  expect(within(progress).getAllByRole('listitem')[0]).toHaveAttribute('aria-current', 'step');
});

test('offers retry on an unavailable order without claiming it succeeded', async () => {
  api.get.mockRejectedValueOnce(new Error('Unable to reach the store')).mockResolvedValue(base);
  render(<OrderSuccess route={route} navigate={jest.fn()} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to reach the store');
  expect(screen.queryByRole('button', { name: 'Track order' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('button', { name: 'Track order' })).toBeInTheDocument();
});

test('a missing order id offers order history without requesting an invalid endpoint', () => {
  const navigate = jest.fn(); render(<OrderSuccess navigate={navigate} />);
  expect(screen.getByRole('alert')).toHaveTextContent('missing an order number');
  expect(api.get).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'My orders' }));
  expect(navigate).toHaveBeenCalledWith('/orders');
});

test.each([null, { ...base, _id: 'another-order' }, { ...base, orderItems: undefined }])('rejects missing or mismatched order responses', async (response) => {
  api.get.mockResolvedValue(response); render(<OrderSuccess route={route} navigate={jest.fn()} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded');
  expect(screen.queryByText('Test Shopper')).not.toBeInTheDocument();
});

test('pending online payment can be checked again and becomes confirmed using the server response', async () => {
  api.get.mockResolvedValueOnce({ ...base, paymentMethod: 'UPI' }).mockResolvedValue({ ...base, paymentMethod: 'UPI', paymentStatus: 'Paid', paymentState: 'PAID', orderStatus: 'Confirmed' });
  render(<OrderSuccess route={route} navigate={jest.fn()} />);
  expect(await screen.findByRole('heading', { name: 'Your payment is being confirmed' })).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Delivery progress' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Check payment status' }));
  expect(await screen.findByText('Paid', { exact: true })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Thank you for your order!' })).toBeInTheDocument();
  expect(within(screen.getByRole('region', { name: 'Delivery progress' })).getAllByRole('listitem')[1]).toHaveAttribute('aria-current', 'step');
});

test.each([
  [{ paymentMethod: 'UPI', paymentStatus: 'Failed', paymentState: 'FAILED' }, 'Your payment needs attention', 'Payment failed'],
  [{ orderStatus: 'Cancelled' }, 'This order was cancelled', 'Not collected'],
  [{ orderStatus: 'Cancelled', paymentStatus: 'Paid', paymentState: 'PAID' }, 'This order was cancelled', 'Paid'],
  [{ orderStatus: 'Refunded', paymentStatus: 'Refunded', paymentState: 'REFUNDED' }, 'Your order has an update', 'Refunded'],
])('shows truthful messaging for unsuccessful and refunded orders', async (overrides, heading, payment) => {
  mockOrder(overrides); render(<OrderSuccess route={route} navigate={jest.fn()} />);
  expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
  expect(screen.getAllByText(payment, { exact: true }).length).toBeGreaterThan(0);
  expect(screen.queryByRole('region', { name: 'Delivery progress' })).not.toBeInTheDocument();
  expect(screen.queryByText(/No online payment is needed/)).not.toBeInTheDocument();
});

test('tracking, support, storefront shopping and copying use the current order', async () => {
  mockOrder(); mockStorefront.storeSlug = 'test-boutique'; const navigate = jest.fn();
  render(<OrderSuccess route={route} navigate={navigate} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Track order' }));
  expect(navigate).toHaveBeenLastCalledWith(`/order-detail?id=${base._id}`);
  fireEvent.click(screen.getByRole('button', { name: 'Contact support' }));
  expect(navigate).toHaveBeenLastCalledWith(`/contact?order=${base._id}`);
  fireEvent.click(screen.getByRole('button', { name: 'Continue shopping' }));
  expect(navigate).toHaveBeenLastCalledWith('/store/test-boutique/products');
  fireEvent.click(screen.getByRole('button', { name: 'Copy order number' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Order number copied');
  expect(navigator.clipboard.writeText).toHaveBeenCalledWith('01234567');
});

test('a delivered COD order with an outdated payment record does not ask the customer to pay again', async () => {
  mockOrder({ orderStatus: 'Delivered', deliveredAt: '2026-09-07T10:00:00Z' });
  render(<OrderSuccess route={route} navigate={jest.fn()} />);
  expect(await screen.findByRole('heading', { name: 'Your order has arrived' })).toBeInTheDocument();
  expect(screen.getByText('Payment collection not recorded')).toBeInTheDocument();
  expect(screen.getByText(/If you have already paid, contact support/)).toBeInTheDocument();
  expect(screen.queryByText('Payment due on delivery')).not.toBeInTheDocument();
  expect(screen.queryByText(/when your order arrives/)).not.toBeInTheDocument();
});

test('invoice download retries after a failure without hiding the order', async () => {
  mockOrder(); api.get.mockImplementation(async (path) => {
    if (path.endsWith('/receipt')) throw new Error('Invoice service unavailable');
    return base;
  });
  render(<OrderSuccess route={route} navigate={jest.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Download invoice', exact: true }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Invoice service unavailable');
  expect(screen.getByRole('button', { name: 'Track order' })).toBeInTheDocument();
  expect(downloadReceiptPdf).not.toHaveBeenCalled();
  mockOrder(); fireEvent.click(screen.getByRole('button', { name: 'Download invoice', exact: true }));
  await waitFor(() => expect(downloadReceiptPdf).toHaveBeenCalledWith(invoice));
  expect(await screen.findByRole('status')).toHaveTextContent('invoice PDF is ready');
});

test('opens an invoice dialog with print and sharing, caches it, and restores focus on close', async () => {
  mockOrder(); render(<OrderSuccess route={route} navigate={jest.fn()} />);
  const trigger = await screen.findByRole('button', { name: 'View, print & share' });
  trigger.focus(); fireEvent.click(trigger);
  const dialog = await screen.findByRole('dialog', { name: 'Invoice preview' });
  expect(within(dialog).getByText(`Invoice for ${base._id}`)).toBeInTheDocument();
  expect(within(dialog).getByRole('button', { name: 'Share order summary' })).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Print invoice' }));
  await waitFor(() => expect(printReceipt).toHaveBeenCalledWith(invoice));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close dialog' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
  fireEvent.click(trigger); await screen.findByRole('dialog');
  expect(api.get.mock.calls.filter(([path]) => path.endsWith('/receipt'))).toHaveLength(1);
});

test('does not show or download another order’s invoice', async () => {
  api.get.mockImplementation(async (path) => path.endsWith('/receipt') ? { ...invoice, orderId: 'other-order' } : base);
  render(<OrderSuccess route={route} navigate={jest.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Download invoice', exact: true }));
  expect(await screen.findByRole('alert')).toHaveTextContent('invoice could not be loaded');
  expect(downloadReceiptPdf).not.toHaveBeenCalled();
});

test('a delayed invoice response is discarded when navigating to a different order', async () => {
  let resolveInvoice;
  const next = { ...base, _id: '1123456789abcdef01234567', shippingAddress: { fullName: 'Another shopper' } };
  api.get.mockImplementation((path) => path.endsWith('/receipt') ? new Promise((resolve) => { resolveInvoice = resolve; }) : Promise.resolve(path.endsWith(next._id) ? next : base));
  const { rerender } = render(<OrderSuccess route={route} navigate={jest.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'View, print & share' }));
  rerender(<OrderSuccess route={`/order-success?id=${next._id}`} navigate={jest.fn()} />);
  await screen.findByText('Another shopper');
  await act(async () => resolveInvoice(invoice));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByText('Test Shopper')).not.toBeInTheDocument();
});

test('large orders disclose all remaining products and preserve quantities and the price breakdown', async () => {
  mockOrder({ orderItems: Array.from({ length: 5 }, (_, index) => ({ ...base.orderItems[0], _id: `line${index}`, name: `Ordered style ${index}` })) });
  render(<OrderSuccess route={route} navigate={jest.fn()} />);
  await screen.findByText('10 items');
  expect(screen.getByRole('heading', { name: 'Ordered style 0' })).toBeVisible();
  expect(screen.getByRole('heading', { name: 'Ordered style 4' })).not.toBeVisible();
  fireEvent.click(screen.getByText('View 2 more products'));
  expect(screen.getByRole('heading', { name: 'Ordered style 4' })).toBeVisible();
  fireEvent.click(screen.getByText('Price breakdown'));
  expect(screen.getByText('Platform fee')).toBeVisible();
  expect(screen.getByText('FREE')).toBeVisible();
  expect(screen.getByText(/^-₹100(?:\.00)?$/)).toBeVisible();
});
