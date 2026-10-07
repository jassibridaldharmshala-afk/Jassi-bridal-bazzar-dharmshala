import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ManualShipmentForm from './ManualShipmentForm';
import ShipmentPanel from './ShipmentPanel';
import api from '../../services/api';

jest.mock('../../services/api', () => ({ __esModule: true, default: { get: jest.fn(), put: jest.fn(), post: jest.fn() } }));
const order = { _id: 'order1', revision: 7, orderStatus: 'Confirmed', shipment: null };
const submit = () => fireEvent.submit(screen.getByRole('form', { name: 'Manage manual delivery' }));
beforeEach(() => jest.resetAllMocks());

test('self delivery uses the store default and submits a revision without a fake AWB or lifecycle status', async () => {
  const onSave = jest.fn().mockResolvedValue(true);
  render(<ManualShipmentForm order={order} defaultMode="SELF" onSave={onSave} />);
  expect(screen.getByLabelText('Delivery method')).toHaveValue('SELF');
  expect(screen.queryByLabelText('AWB / tracking number')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Estimated delivery date (optional)'), { target: { value: '2026-10-02' } });
  fireEvent.change(screen.getByLabelText('Delivery contact name (optional)'), { target: { value: 'Store driver' } });
  fireEvent.change(screen.getByLabelText(/Delivery contact phone/), { target: { value: '+91 98765 43210' } });
  submit();
  await screen.findByRole('status');
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ fulfillmentMode: 'SELF', revision: 7, courierName: '', trackingNumber: '', trackingUrl: '', expectedDeliveryAt: '2026-10-02', deliveryContact: { name: 'Store driver', phone: '+919876543210' } }));
  expect(onSave.mock.calls[0][0]).not.toHaveProperty('status');
  expect(onSave.mock.calls[0][0]).not.toHaveProperty('awb');
});

test('legacy manual shipments retain courier mode even with a self-delivery default', () => {
  render(<ManualShipmentForm order={{ ...order, shipment: { provider: 'manual', courierName: 'Postal service', awb: 'TRACK1' } }} defaultMode="SELF" onSave={jest.fn()} />);
  expect(screen.getByLabelText('Delivery method')).toHaveValue('COURIER');
  expect(screen.getByLabelText('AWB / tracking number')).toHaveValue('TRACK1');
});

// Exercise malicious legacy input; it must never become a link or API request.
// eslint-disable-next-line no-script-url
test.each(['http://courier.example/track', 'javascript:alert(1)', 'https://name:secret@courier.example/track'])('blocks unsafe tracking URL %s', value => {
  const onSave = jest.fn();
  render(<ManualShipmentForm order={order} onSave={onSave} />);
  fireEvent.change(screen.getByLabelText(/Secure tracking URL/), { target: { value } });
  submit();
  expect(screen.getByRole('alert')).toHaveTextContent('secure https://');
  expect(onSave).not.toHaveBeenCalled();
});

test('preserves entered data on errors and prevents duplicate submission', async () => {
  let reject;
  const onSave = jest.fn(() => new Promise((resolve, rejectPromise) => { reject = rejectPromise; }));
  render(<ManualShipmentForm order={order} onSave={onSave} />);
  fireEvent.change(screen.getByLabelText('Courier name'), { target: { value: 'Courier A' } });
  submit(); submit();
  expect(onSave).toHaveBeenCalledTimes(1);
  await act(async () => reject(new Error('Order changed. Refresh first.')));
  expect(await screen.findByRole('alert')).toHaveTextContent('Order changed');
  expect(screen.getByLabelText('Courier name')).toHaveValue('Courier A');
});

test('after dispatch locks parcel identity and requires a customer message for a delivery delay', async () => {
  const onSave = jest.fn().mockResolvedValue(true);
  render(<ManualShipmentForm order={{ ...order, orderStatus: 'Shipped', shipment: { provider: 'manual', courierName: 'Courier A', trackingNumber: 'TRACK1' } }} onSave={onSave} />);
  ['Delivery method', 'Courier name', 'AWB / tracking number'].forEach(label => expect(screen.getByLabelText(label)).toBeDisabled());
  fireEvent.change(screen.getByLabelText(/Delivery timeline update/), { target: { value: 'EXCEPTION' } }); submit();
  expect(screen.getByRole('alert')).toHaveTextContent('customer message');
  fireEvent.change(screen.getByLabelText(/Message for the customer/), { target: { value: 'Road closure. Our team will call to arrange tomorrow.' } }); submit();
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ deliveryEvent: 'EXCEPTION', customerNote: 'Road closure. Our team will call to arrange tomorrow.', revision: 7 })));
});

test('out-for-delivery resumption cannot regress to in transit and terminal edits are disabled', () => {
  const view = render(<ManualShipmentForm order={{ ...order, orderStatus: 'Out for Delivery', shipment: { provider: 'manual', fulfillmentMode: 'SELF' } }} onSave={jest.fn()} />);
  expect(screen.queryByRole('option', { name: 'In transit / delivery resumed' })).not.toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Out for delivery / delivery resumed' })).toBeInTheDocument();
  view.rerender(<ManualShipmentForm order={{ ...order, orderStatus: 'Delivered' }} onSave={jest.fn()} />);
  expect(screen.getByRole('button', { name: 'Save manual shipment' })).toBeDisabled();
});

test('manual panel saves through the API with revision and never offers courier booking', async () => {
  api.get.mockResolvedValue({ order, shipment: null, manualDefaultMode: 'SELF', selectedProvider: { name: 'manual' } });
  api.put.mockResolvedValue({ shipment: { fulfillmentMode: 'SELF', deliveryReference: 'DLV-1' }, revision: 8 });
  render(<ShipmentPanel orderId="order1" />);
  await screen.findByRole('form', { name: 'Manage manual delivery' });
  submit();
  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/admin/orders/order1/shipment', expect.objectContaining({ revision: 7, fulfillmentMode: 'SELF' })));
  expect(api.post).not.toHaveBeenCalled();
  expect(screen.queryByText(/Select and connect a courier/)).not.toBeInTheDocument();
});

test('existing integrated shipments retain booking controls and never expose manual editing', async () => {
  api.get.mockResolvedValue({ order, shipment: { provider: 'delhivery' }, selectedProvider: { name: 'delhivery', liveBooking: true } });
  render(<ShipmentPanel orderId="order1" order={order} />);
  expect(await screen.findByRole('button', { name: 'Create shipment' })).toBeInTheDocument();
  expect(screen.queryByRole('form', { name: 'Manage manual delivery' })).not.toBeInTheDocument();
});

test('a bare manual placeholder does not hide the selected integrated courier booking', async () => {
  api.get.mockResolvedValue({ order, shipment: { provider: 'manual', fulfillmentMode: 'COURIER', status: 'READY_TO_SHIP' }, selectedProvider: { name: 'delhivery', liveBooking: true } });
  render(<ShipmentPanel orderId="order1" order={order} />);
  expect(await screen.findByRole('button', { name: 'Create shipment' })).toBeInTheDocument();
  expect(screen.queryByRole('form', { name: 'Manage manual delivery' })).not.toBeInTheDocument();
});

test('return to origin is available only after dispatch and requires a customer message', async () => {
  const onSave = jest.fn().mockResolvedValue(true);
  const view = render(<ManualShipmentForm order={order} defaultMode="SELF" onSave={onSave} />);
  expect(screen.queryByRole('option', { name: /Delivery unsuccessful/ })).not.toBeInTheDocument();
  view.rerender(<ManualShipmentForm order={{ ...order, orderStatus: 'Shipped', shipment: { provider: 'manual', fulfillmentMode: 'SELF', status: 'IN_TRANSIT' } }} onSave={onSave} />);
  fireEvent.change(screen.getByLabelText(/Delivery timeline update/), { target: { value: 'RTO_IN_TRANSIT' } }); submit();
  expect(screen.getByRole('alert')).toHaveTextContent('customer message');
  fireEvent.change(screen.getByLabelText(/Message for the customer/), { target: { value: 'Delivery was refused. Our team is bringing the parcel back.' } }); submit();
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ deliveryEvent: 'RTO_IN_TRANSIT', customerNote: 'Delivery was refused. Our team is bringing the parcel back.', revision: 7 })));
  expect(onSave.mock.calls[0][0]).not.toHaveProperty('confirmReturned');
  expect(onSave.mock.calls[0][0]).not.toHaveProperty('paymentStatus');
  expect(onSave.mock.calls[0][0]).not.toHaveProperty('restock');
});

test('returning parcels freeze delivery settings and require explicit physical receipt confirmation', async () => {
  const onSave = jest.fn().mockResolvedValue(true);
  const shipment = { provider: 'manual', status: 'RTO_IN_TRANSIT', fulfillmentMode: 'COURIER', courierName: 'Postal service', trackingNumber: 'TRACK1', trackingUrl: 'https://courier.example/track/TRACK1', deliveryContact: { name: 'Courier office', phone: '+91 98765 43210' } };
  render(<ManualShipmentForm order={{ ...order, orderStatus: 'Shipped', shipment }} onSave={onSave} />);
  ['Delivery method', 'Courier name', 'AWB / tracking number', /Secure tracking URL/, 'Estimated delivery date (optional)', 'Delivery contact name (optional)', /Delivery contact phone/].forEach(label => expect(screen.getByLabelText(label)).toBeDisabled());
  const updates = screen.getByLabelText(/Delivery timeline update/);
  expect(Array.from(updates.options).map(option => option.value)).toEqual(['NONE', 'RETURNED']);
  fireEvent.change(updates, { target: { value: 'RETURNED' } }); submit();
  expect(screen.getByRole('alert')).toHaveTextContent('customer message');
  fireEvent.change(screen.getByLabelText(/Message for the customer/), { target: { value: 'Parcel received back at our warehouse; inspection pending.' } }); submit();
  expect(screen.getByRole('alert')).toHaveTextContent('physically arrived');
  expect(onSave).not.toHaveBeenCalled();
  fireEvent.click(screen.getByLabelText('I confirm this parcel has physically arrived back at the store')); submit();
  await waitFor(() => expect(onSave).toHaveBeenCalledWith({ revision: 7, deliveryEvent: 'RETURNED', confirmReturned: true, customerNote: 'Parcel received back at our warehouse; inspection pending.', note: 'Manual delivery details updated by staff' }));
  expect(screen.getByText(/does not restock inventory or issue a refund/)).toBeInTheDocument();
});

test('panel uses the latest return state and closes the editor after physical return', async () => {
  const previous = { ...order, orderStatus: 'Shipped', shipment: { provider: 'manual', fulfillmentMode: 'SELF', status: 'IN_TRANSIT' } };
  api.get.mockResolvedValue({ order: { ...order, orderStatus: 'Shipped', revision: 8 }, shipment: { provider: 'manual', fulfillmentMode: 'SELF', status: 'RTO_IN_TRANSIT' }, selectedProvider: { name: 'manual' } });
  render(<ShipmentPanel orderId="order1" order={previous} />);
  const updates = await screen.findByLabelText(/Delivery timeline update/);
  expect(Array.from(updates.options).map(option => option.value)).toEqual(['NONE', 'RETURNED']);
  api.get.mockResolvedValue({ order: { ...order, orderStatus: 'Shipped', revision: 9 }, shipment: { provider: 'manual', fulfillmentMode: 'SELF', status: 'RETURNED' }, selectedProvider: { name: 'manual' } });
  fireEvent.click(screen.getByRole('button', { name: 'Refresh tracking' }));
  await waitFor(() => expect(screen.queryByRole('form', { name: 'Manage manual delivery' })).not.toBeInTheDocument());
});
