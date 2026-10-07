import '@testing-library/jest-dom';
import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import MyOrders from './MyOrders';
import OrderDetail from './OrderDetail';
import api from '../../services/api';
import { downloadReceiptPdf } from '../../utils/printReceipt';

const mockUser = { _id: 'customer', name: 'Test Shopper' };
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: mockUser, logout: jest.fn() }) }));
jest.mock('../../services/api', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn(), put: jest.fn() } }));
jest.mock('../../components/order/Receipt', () => () => <div>Printable invoice</div>);
jest.mock('../../utils/printReceipt', () => ({ downloadReceiptPdf: jest.fn(), printReceipt: jest.fn() }));
const first = { _id: 'line1', product: 'product1', name: 'Silk Saree', size: 'Free size', color: 'Wine', quantity: 1, price: 1000 };
const second = { ...first, _id: 'line2', product: 'product2', name: 'Cotton Kurti', size: 'M', quantity: 2, price: 500 };
const base = { _id: '0123456789abcdef01234567', orderStatus: 'Delivered', createdAt: '2026-09-01T10:00:00Z', deliveredAt: '2026-09-04T10:00:00Z', orderItems: [first, second], totalMRP: 2500, productDiscount: 500, finalAmount: 2000, paymentMethod: 'COD', paymentStatus: 'Pending', shippingAddress: { fullName: 'Test Shopper', houseNo: '12A', area: 'Fort', city: 'Mumbai', state: 'Maharashtra', pincode: '400001', mobile: '9876543210' }, statusTimeline: [{ status: 'Confirmed', date: '2026-09-01T10:00:00Z' }, { status: 'Delivered', date: '2026-09-04T10:00:00Z' }] };
const eligibility = { requests: [], windowDays: 7, deadline: '2026-09-11T10:00:00Z', items: [{ orderItemId: 'line1', canRequest: true, canReturn: true, canExchange: true, remainingQuantity: 1 }, { orderItemId: 'line2', canRequest: true, canReturn: true, canExchange: true, remainingQuantity: 2 }] };
const invoice = { orderId: base._id, items: base.orderItems };
function mockDetail(order = base) {
  api.get.mockImplementation(async (path) => path.endsWith('/receipt') ? invoice : path.startsWith('/returns/order/') ? eligibility : path.includes('/eligibility') ? { canReview: true } : order);
}
function ListPage() { const [route, navigate] = useState('/orders'); return <MyOrders route={route} navigate={navigate} />; }
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function close() { this.removeAttribute('open'); };
});
beforeEach(() => jest.resetAllMocks());

test('lists every ordered item with quantities and opens order details', async () => {
  api.get.mockResolvedValue({ items: [base], total: 1, totalPages: 1 });
  const navigate = jest.fn(); render(<MyOrders navigate={navigate} />);
  expect(await screen.findByRole('button', { name: 'Silk Saree' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Cotton Kurti' })).toBeInTheDocument();
  expect(screen.getByText(/Qty: 2/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /View order details/ }));
  expect(navigate).toHaveBeenCalledWith(`/order-detail?id=${base._id}`);
});
test('connects search, date, status and pagination to server queries', async () => {
  api.get.mockResolvedValue({ items: [base], total: 14, totalPages: 2 });
  render(<ListPage />);
  await screen.findByText('14 orders');
  fireEvent.change(screen.getByLabelText('Search orders'), { target: { value: 'silk' } });
  fireEvent.click(screen.getByRole('button', { name: 'Search', exact: true }));
  const cacheOptions = { cacheFirst: true, cacheScope: mockUser._id, forceRefetch: false };
  await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/orders/my-orders?page=1&limit=12&search=silk', cacheOptions));
  fireEvent.change(screen.getByLabelText('Order status'), { target: { value: 'Delivered' } });
  await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/orders/my-orders?page=1&limit=12&search=silk&status=Delivered', cacheOptions));
  fireEvent.change(screen.getByLabelText('Order date'), { target: { value: '30' } });
  await screen.findByRole('button', { name: 'Next' });
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/orders/my-orders?page=2&limit=12&search=silk&status=Delivered&days=30', cacheOptions));
});
test('loading errors show retry instead of an empty order history', async () => {
  api.get.mockRejectedValueOnce(new Error('Unable to reach store')).mockResolvedValue({ items: [base], total: 1, totalPages: 1 });
  render(<ListPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to reach store');
  expect(screen.queryByText('No orders yet')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('button', { name: 'Silk Saree' })).toBeInTheDocument();
});
test('details provide all items and actions without relying on a desktop-only branch', async () => {
  mockDetail(); render(<OrderDetail route={`/order-detail?id=${base._id}`} navigate={jest.fn()} />);
  expect(await screen.findByRole('heading', { name: 'Silk Saree' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Cotton Kurti' })).toBeInTheDocument();
  expect(await screen.findAllByRole('button', { name: 'Return / exchange' })).toHaveLength(2);
  expect(screen.getAllByRole('button', { name: 'Rate & review' })).toHaveLength(2);
  expect(screen.getByText('Payment due on delivery')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Cancel order' })).not.toBeInTheDocument();
});
test('sends selected item identity and quantity for returns, then refreshes status', async () => {
  mockDetail(); api.post.mockResolvedValue({ status: 'Requested' });
  render(<OrderDetail route={`/order-detail?id=${base._id}`} navigate={jest.fn()} />);
  fireEvent.click((await screen.findAllByRole('button', { name: 'Return / exchange' }))[1]);
  const dialog = screen.getByRole('dialog', { name: 'Return or exchange' });
  fireEvent.change(within(dialog).getByLabelText('Quantity'), { target: { value: '2' } });
  fireEvent.change(within(dialog).getByLabelText('Reason'), { target: { value: 'Size or fit issue' } });
  fireEvent.change(within(dialog).getByLabelText('Refund destination'), { target: { value: 'MANUAL' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Review request' }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm request' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/returns', expect.objectContaining({ order: base._id, product: 'product2', orderItemId: 'line2', quantity: 2, type: 'return' })));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByRole('status')).toHaveTextContent('Return request submitted');
});
test('shows actual exchange choices and submits the selected replacement variant', async () => {
  mockDetail(); const detailImplementation = api.get.getMockImplementation();
  api.get.mockImplementation((path) => path === '/products/product1' ? Promise.resolve({ variants: [{ _id: 'variant1', size: 'L', color: 'Gold', stock: 4 }, { _id: 'variant2', size: 'S', color: 'Blue', stock: 0 }] }) : detailImplementation(path));
  api.post.mockResolvedValue({ status: 'Requested' });
  render(<OrderDetail route={`/order-detail?id=${base._id}`} navigate={jest.fn()} />);
  fireEvent.click((await screen.findAllByRole('button', { name: 'Return / exchange' }))[0]);
  fireEvent.click(await screen.findByRole('radio', { name: 'Exchange item' }));
  const select = await screen.findByLabelText('Replacement size / colour');
  expect(screen.getByRole('option', { name: /S \/ Blue/ })).toBeDisabled();
  fireEvent.change(select, { target: { value: 'variant1' } });
  fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Size or fit issue' } });
  fireEvent.click(screen.getByRole('button', { name: 'Review request' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm request' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/returns', expect.objectContaining({ type: 'exchange', exchangeVariantId: 'variant1', exchangeSize: 'L', exchangeColor: 'Gold' })));
});
test('cancellation waits for confirmation, sends reason, and renders server result', async () => {
  mockDetail({ ...base, orderStatus: 'Confirmed' });
  api.post.mockImplementation(async () => { mockDetail({ ...base, orderStatus: 'Cancelled' }); return { ...base, orderStatus: 'Cancelled' }; });
  render(<OrderDetail route={`/order-detail?id=${base._id}`} navigate={jest.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Cancel order' }));
  expect(api.post).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Reason for cancellation'), { target: { value: 'ORDERED_BY_MISTAKE' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm cancellation' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith(`/orders/${base._id}/cancel`, { reason: 'ORDERED_BY_MISTAKE', comment: '' }));
  expect(await screen.findByText('Cancelled')).toBeInTheDocument();
});
test('failed cancellation keeps the order and allows retry', async () => {
  mockDetail({ ...base, orderStatus: 'Confirmed' }); api.post.mockRejectedValue(new Error('Order was just shipped'));
  render(<OrderDetail route={`/order-detail?id=${base._id}`} navigate={jest.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Cancel order' }));
  fireEvent.change(screen.getByLabelText('Reason for cancellation'), { target: { value: 'Other' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm cancellation' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Order was just shipped');
  expect(screen.getByRole('button', { name: 'Confirm cancellation' })).toBeEnabled();
});
test('invoice download and help use the current order', async () => {
  mockDetail(); const navigate = jest.fn();
  render(<OrderDetail route={`/order-detail?id=${base._id}`} navigate={navigate} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Download invoice (PDF)' }));
  expect(downloadReceiptPdf).toHaveBeenCalledWith(invoice);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Download invoice (PDF)' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Need help?' }));
  expect(navigate).toHaveBeenCalledWith(`/contact?order=${base._id}`);
});

test.each([undefined, { success: false }, { items: [null] }])('invalid order data can be retried without an empty history or rendering failure', async (response) => {
  api.get.mockResolvedValueOnce(response).mockResolvedValue({ items: [base], total: 1, totalPages: 1 });
  render(<ListPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Your orders could not be loaded');
  expect(screen.queryByText('No orders yet')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('button', { name: 'Silk Saree' })).toBeInTheDocument();
});

test('invoice preview opens and closes without leaving the order page', async () => {
  mockDetail(); render(<OrderDetail route={`/order-detail?id=${base._id}`} navigate={jest.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'View invoice' }));
  const preview = screen.getByRole('dialog', { name: 'Invoice preview' });
  expect(within(preview).getByText('Printable invoice')).toBeInTheDocument();
  fireEvent.click(within(preview).getByRole('button', { name: 'Close dialog' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
test('courier tracking uses the saved link and exposes the event history', async () => {
  mockDetail({ ...base, shipment: { courierName: 'Test Courier', trackingNumber: 'AWB123', trackingUrl: 'https://courier.example/track/123', events: [{ status: 'IN_TRANSIT', note: 'Arrived at sorting hub', date: '2026-09-02' }] } });
  render(<OrderDetail route={`/order-detail?id=${base._id}`} navigate={jest.fn()} />);
  expect(await screen.findByRole('link', { name: 'Track with courier' })).toHaveAttribute('href', 'https://courier.example/track/123');
  expect(screen.getByText('Arrived at sorting hub')).toBeInTheDocument();
});
test('a stale detail response cannot overwrite a different order after navigation', async () => {
  let resolveOld;
  api.get.mockImplementation((path) => path === `/orders/${base._id}` ? new Promise((resolve) => { resolveOld = resolve; }) : Promise.resolve(path.includes('/returns/') ? eligibility : path.endsWith('/receipt') ? invoice : { ...base, _id: '0123456789abcdef11111111' }));
  const view = render(<OrderDetail route={`/order-detail?id=${base._id}`} navigate={jest.fn()} />);
  view.rerender(<OrderDetail route="/order-detail?id=0123456789abcdef11111111" navigate={jest.fn()} />);
  await screen.findByRole('heading', { name: 'Order #11111111' });
  await act(async () => resolveOld(base));
  expect(screen.getByRole('heading', { name: 'Order #11111111' })).toBeInTheDocument();
});
