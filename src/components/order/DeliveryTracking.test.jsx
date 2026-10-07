import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import DeliveryTracking from './DeliveryTracking';
import api from '../../services/api';
jest.mock('../../services/api', () => ({ __esModule: true, default: { get: jest.fn() } }));
const manual = { provider: 'manual', status: 'IN_TRANSIT', courierName: 'Postal service', trackingNumber: 'TRACK1', trackingUrl: 'https://courier.example/track/TRACK1' };
beforeEach(() => { jest.resetAllMocks(); Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: jest.fn().mockResolvedValue() } }); });

test('manual courier presents safe tracking, a copy fallback and store-maintained progress', async () => {
  api.get.mockResolvedValue({ shipment: { ...manual, customerNote: 'Delivery tomorrow', events: [{ status: 'IN_TRANSIT', note: 'Dispatched from store', date: '2026-09-29T10:00:00Z' }] } });
  render(<DeliveryTracking orderId="1" />);
  const link = await screen.findByRole('link', { name: 'Track with courier' });
  expect(link).toHaveAttribute('href', manual.trackingUrl);
  expect(link).toHaveAttribute('target', '_blank');
  expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  expect(screen.getByText(/store updates delivery progress/i)).toBeInTheDocument();
  expect(screen.getByText('Dispatched from store')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Copy tracking ID' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Tracking ID copied');
  expect(navigator.clipboard.writeText).toHaveBeenCalledWith('TRACK1');
});

test('self delivery shows an internal reference, contact and estimate without an AWB or external tracking', async () => {
  api.get.mockResolvedValue({ shipment: { provider: 'manual', fulfillmentMode: 'SELF', status: 'OUT_FOR_DELIVERY', deliveryReference: 'DLV-123', awb: 'IGNORED', trackingUrl: manual.trackingUrl, expectedDeliveryAt: '2026-10-01', deliveryContact: { name: 'Store driver', phone: '+91 98765 43210' }, customerNote: 'We will call on arrival' } });
  render(<DeliveryTracking orderId="1" />);
  expect(await screen.findByText('Delivery reference: DLV-123')).toBeInTheDocument();
  expect(screen.getByText(/not live location tracking/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '+919876543210' })).toHaveAttribute('href', 'tel:+919876543210');
  expect(screen.queryByText(/IGNORED/)).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Track with courier' })).not.toBeInTheDocument();
  expect(screen.getByText(/Estimated delivery:/)).toBeInTheDocument();
});

// Exercise malicious legacy input; it must never become a clickable link.
// eslint-disable-next-line no-script-url
test.each(['javascript:alert(1)', 'http://courier.example/track', 'https://user:secret@courier.example/track'])('does not link unsafe saved URL %s', async value => {
  api.get.mockResolvedValue({ shipment: { ...manual, trackingUrl: value } });
  render(<DeliveryTracking orderId="1" />);
  await screen.findByText('Tracking ID: TRACK1');
  expect(screen.queryByRole('link', { name: 'Track with courier' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Copy tracking ID' })).toBeInTheDocument();
});

test('refresh reads the server and propagates updated order status without a courier mutation', async () => {
  const onUpdate = jest.fn();
  api.get.mockResolvedValueOnce({ shipment: manual }).mockResolvedValueOnce({ shipment: { ...manual, status: 'DELIVERED' }, order: { orderStatus: 'Delivered', revision: 9 } });
  render(<DeliveryTracking orderId="1" onUpdate={onUpdate} />);
  await screen.findByText('Tracking ID: TRACK1');
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  await screen.findByText('delivered');
  expect(api.get).toHaveBeenLastCalledWith('/orders/1/delivery?refresh=1', { silent: true, cache: 'no-store' });
  expect(onUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ order: { orderStatus: 'Delivered', revision: 9 } }));
});

test('integrated carrier still shows carrier status and sandbox warning', async () => {
  api.get.mockResolvedValue({ shipment: { provider: 'delhivery', awb: 'AWB1', status: 'IN_TRANSIT', providerStatus: 'Arrived at destination hub', environment: 'sandbox' } });
  render(<DeliveryTracking orderId="1" />);
  await screen.findByText('Tracking ID: AWB1');
  expect(screen.getByText('Delhivery delivery')).toBeInTheDocument();
  expect(screen.getByText('Arrived at destination hub')).toBeInTheDocument();
  expect(screen.getByText('Test shipment · no real delivery')).toBeInTheDocument();
  expect(screen.queryByText(/store updates delivery progress/i)).not.toBeInTheDocument();
});

test('navigation ignores stale responses and clears previous delivery data', async () => {
  let resolveOld;
  api.get.mockImplementation(path => path.includes('/1/') ? new Promise(resolve => { resolveOld = resolve; }) : Promise.resolve({ shipment: { ...manual, trackingNumber: 'NEW' } }));
  const view = render(<DeliveryTracking orderId="1" initialShipment={manual} />);
  view.rerender(<DeliveryTracking orderId="2" />);
  await screen.findByText('Tracking ID: NEW');
  await act(async () => resolveOld({ shipment: { ...manual, trackingNumber: 'OLD' } }));
  expect(screen.queryByText('Tracking ID: OLD')).not.toBeInTheDocument();
  expect(screen.queryByText('Tracking ID: TRACK1')).not.toBeInTheDocument();
});

test('a refresh failure retains saved tracking details and reports the error', async () => {
  api.get.mockRejectedValue(new Error('Temporarily unavailable'));
  render(<DeliveryTracking orderId="1" initialShipment={manual} />);
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Temporarily unavailable'));
  expect(screen.getByText('Tracking ID: TRACK1')).toBeInTheDocument();
});

test.each(['RTO_IN_TRANSIT', 'RETURNED'])('manual %s clearly explains return to store without an arrival estimate or automatic refund claim', async status => {
  api.get.mockResolvedValue({ shipment: { ...manual, status, expectedDeliveryAt: '2026-10-01' } });
  render(<DeliveryTracking orderId="1" />);
  await screen.findByText(status === 'RTO_IN_TRANSIT' ? 'Returning to store' : 'Returned to store');
  expect(screen.queryByText(/Estimated delivery:/)).not.toBeInTheDocument();
  expect(screen.getByText(status === 'RTO_IN_TRANSIT' ? /Delivery could not be completed/ : /any applicable refund are handled separately/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Track with courier' })).toBeInTheDocument();
});
