import { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import RentalBookingDetails, { RentalBookingDetailsFields } from './RentalBookingDetails';
import RentalBookingDetailsEditor from './RentalBookingDetailsEditor';
import RentalBookingForm from './RentalBookingForm';
import RentalPieceMeasurements from './RentalPieceMeasurements';
import RentalCourierPanel from './RentalCourierPanel';
import { editableRentalDetails, rentalDetailsPayload, pieceProfilePayload } from '../../utils/rentalDetails';
import api from '../../services/api';
jest.mock('../../services/api', () => ({ get: jest.fn(), post: jest.fn() }));
const address = { fullName: 'Buyer', mobile: '9876543210', houseNo: '12', area: 'Main road', landmark: 'Near park', city: 'Jaipur', state: 'Rajasthan', pincode: '302001' };
const customer = { name: 'Buyer', phone: '9876543210' };
const booking = { _id: 'booking1', number: 'R-001', revision: 2, customer, status: 'CONFIRMED', policy: { timezone: 'Asia/Kolkata' }, schedule: { pickupAt: '2030-01-10T04:30:00Z', returnDueAt: '2030-01-12T04:30:00Z' }, quote: { deliveryMode: 'COURIER' }, bookingDetails: { ...editableRentalDetails(null, customer), deliveryAddress: address, collectionAddress: { ...address, fullName: 'Return person', city: 'Delhi', pincode: '110001' }, sameAsDelivery: false, occasion: 'Wedding', pickupContact: { name: 'Sister', phone: '9876543211', relationship: 'Family', authorised: true, authorisedAt: '2030-01-01T10:00:00Z', authorisedBy: 'staff' } } };
beforeEach(() => { api.get.mockReset().mockResolvedValue([]); api.post.mockReset(); });
function Fields({ deliveryMode = 'COURIER', initial }) {
  const [value, setValue] = useState(() => editableRentalDetails(initial, customer));
  return <><RentalBookingDetailsFields value={value} onChange={setValue} deliveryMode={deliveryMode} /><output data-testid="payload">{JSON.stringify(rentalDetailsPayload(value, deliveryMode))}</output></>;
}
test('structured addresses expose correct fields, hide unnecessary collection inputs and retain independent values', () => {
  render(<Fields initial={{ deliveryAddress: address }} />);
  expect(screen.getByLabelText('Delivery address — PIN code')).toHaveValue('302001');
  expect(screen.queryByLabelText('Return collection address — PIN code')).not.toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('Return collection address is the same as delivery'));
  fireEvent.change(screen.getByLabelText('Return collection address — City'), { target: { value: 'Delhi' } });
  expect(screen.getByLabelText('Delivery address — City')).toHaveValue('Jaipur');
  fireEvent.click(screen.getByLabelText('Return collection address is the same as delivery'));
  const payload = JSON.parse(screen.getByTestId('payload').textContent); expect(payload.collectionAddress.city).toBe('Jaipur');
  fireEvent.click(screen.getByLabelText('Return collection address is the same as delivery'));
  expect(screen.getByLabelText('Return collection address — City')).toHaveValue('Delhi');
});
test('store pickup does not show or submit stale delivery addresses and delegates require explicit controls', () => {
  render(<Fields deliveryMode="STORE_PICKUP" initial={{ deliveryAddress: address }} />);
  expect(screen.queryByLabelText('Delivery address — PIN code')).not.toBeInTheDocument();
  expect(JSON.parse(screen.getByTestId('payload').textContent).deliveryAddress).toBeNull();
  fireEvent.click(screen.getByText('Alternate contact & authorised pickup / return people'));
  fireEvent.click(screen.getByLabelText('Someone else will handle pickup / delivery'));
  expect(screen.getByLabelText('Customer explicitly authorises this pickup / delivery contact')).not.toBeChecked();
  fireEvent.change(screen.getByLabelText('Pickup / delivery contact — Name'), { target: { value: 'Sister' } });
  expect(JSON.parse(screen.getByTestId('payload').textContent).pickupContact.name).toBe('Sister');
});
test('booking details are displayed safely for customer/admin, with both addresses and optional instructions', () => {
  render(<RentalBookingDetails booking={{ ...booking, bookingDetails: { ...booking.bookingDetails, fittingInstructions: '<script>private instructions</script>', deliveryInstructions: 'Call on arrival' } }} />);
  expect(screen.getByText(/Return person.*Delhi/)).toBeInTheDocument();
  expect(screen.getByText('<script>private instructions</script>')).toBeInTheDocument();
  expect(screen.getByText('Call on arrival')).toBeInTheDocument(); expect(document.querySelector('script')).toBeNull();
  expect(screen.getByText(/Sister.*9876543211/)).toBeInTheDocument();
});
test('customer review is blocked for an incomplete delivery address or an unauthorised delegate', async () => {
  render(<RentalBookingForm listings={[{ _id: 'one', title: 'Lehenga', dailyRatePaise: 10000, depositPaise: 20000 }]} configuration={{ policy: { timezone: 'Asia/Kolkata', slotMinutes: 60, deliveryModes: ['COURIER'] } }} user={customer} onBooked={jest.fn()} />);
  fireEvent.click(screen.getByLabelText('Select Lehenga'));
  fireEvent.click(screen.getByRole('button', { name: 'Check dates & review price' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/Complete the delivery/); expect(api.post).not.toHaveBeenCalled();
});
test('complete customer rental requests include occasion, split addresses and authorisation', async () => {
  const listing = { _id: 'one', title: 'Lehenga', dailyRatePaise: 10000, depositPaise: 20000 };
  api.post.mockResolvedValueOnce({ quoteFingerprint: 'price1', policyRevision: 1, timezone: 'Asia/Kolkata', schedule: {}, quote: {}, terms: 'Return safely' }).mockResolvedValueOnce({ _id: 'booked' });
  render(<RentalBookingForm listings={[listing]} configuration={{ policy: { timezone: 'Asia/Kolkata', slotMinutes: 60, deliveryModes: ['COURIER'] } }} user={customer} onBooked={jest.fn()} />);
  fireEvent.click(screen.getByLabelText('Select Lehenga'));
  fireEvent.change(screen.getByLabelText('Pickup / delivery time'), { target: { value: '2030-01-10T10:00' } }); fireEvent.change(screen.getByLabelText('Return deadline'), { target: { value: '2030-01-12T10:00' } });
  for (const [key, label] of [['houseNo', 'House / building'], ['area', 'Area / street'], ['city', 'City'], ['state', 'State'], ['pincode', 'PIN code']]) fireEvent.change(screen.getByLabelText(`Delivery address — ${label}`), { target: { value: address[key] } });
  fireEvent.click(screen.getByText('Occasion & special instructions (optional)')); fireEvent.change(screen.getByLabelText('Occasion / event type (optional)'), { target: { value: 'Wedding' } });
  fireEvent.click(screen.getByRole('button', { name: 'Check dates & review price' }));
  fireEvent.click(await screen.findByLabelText(/I accept these rental terms/)); fireEvent.click(screen.getByRole('button', { name: 'Reserve rental' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
  expect(api.post.mock.calls[1][1].bookingDetails).toEqual(expect.objectContaining({ occasion: 'Wedding', sameAsDelivery: true, deliveryAddress: expect.objectContaining({ pincode: '302001' }), collectionAddress: expect.objectContaining({ pincode: '302001' }) }));
  fireEvent.change(screen.getByLabelText('Occasion / event type (optional)'), { target: { value: 'Engagement' } }); expect(screen.queryByRole('button', { name: 'Reserve rental' })).not.toBeInTheDocument();
});
test('owner details editor strips old audit metadata, requires approval/reason and sends revision', async () => {
  const onChange = jest.fn(), run = task => task(); api.post.mockResolvedValue({ ...booking, revision: 3 });
  render(<RentalBookingDetailsEditor booking={booking} base="/admin/rentals" canWrite busy={false} run={run} onChange={onChange} />);
  fireEvent.click(screen.getByText('Edit addresses, contacts & instructions'));
  const save = screen.getByRole('button', { name: 'Save approved booking details' }); expect(save).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Reason for booking-detail changes'), { target: { value: 'Customer approved new instructions' } });
  fireEvent.click(screen.getByLabelText('Customer explicitly approved these booking-detail changes')); fireEvent.click(save);
  await waitFor(() => expect(onChange).toHaveBeenCalled());
  const input = api.post.mock.calls[0][1]; expect(input.action).toBe('DETAILS'); expect(input.revision).toBe(2); expect(input.customerApproved).toBe(true); expect(input.bookingDetails.pickupContact.authorisedAt).toBeUndefined();
});
test('after dispatch pickup/address and fitting fields lock but return collection remains editable', () => {
  render(<RentalBookingDetailsEditor booking={{ ...booking, status: 'OUT' }} base="/admin/rentals" canWrite busy={false} run={jest.fn()} onChange={jest.fn()} />);
  expect(screen.getByLabelText('Delivery address — City')).toBeDisabled(); expect(screen.getByLabelText('Return collection address — City')).not.toBeDisabled();
  expect(screen.getByLabelText('Pickup / delivery contact — Name')).toBeDisabled(); expect(screen.getByLabelText('Occasion / event type (optional)')).toBeDisabled();
});
test('piece measurement category fields, unit conversion and clearing values keep valid limits', () => {
  jest.spyOn(window, 'confirm').mockReturnValue(true);
  function Piece() { const [value, setValue] = useState({ kind: 'APPAREL', unit: 'in', values: { waist: 30 }, alterationsAllowed: true, alterationLimits: { waist: { min: 28, max: 34 } }, notes: '' }); return <><RentalPieceMeasurements value={value} onChange={setValue} /><output data-testid="piece">{JSON.stringify(pieceProfilePayload(value))}</output></>; }
  render(<Piece />);
  fireEvent.change(screen.getByLabelText('Piece measurement unit'), { target: { value: 'cm' } });
  expect(screen.getByLabelText('Piece waist (cm)')).toHaveValue(76.2); expect(screen.getByLabelText('Waist alteration minimum (cm)')).toHaveValue(71.12);
  fireEvent.change(screen.getByLabelText('Piece waist (cm)'), { target: { value: '' } }); expect(JSON.parse(screen.getByTestId('piece').textContent).alterationLimits).toEqual({});
  fireEvent.change(screen.getByLabelText('Piece measurement type'), { target: { value: 'JEWELLERY' } }); expect(screen.getByLabelText('Piece bangle inner diameter (cm)')).toBeInTheDocument(); expect(screen.queryByLabelText('Piece waist (cm)')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Piece measurement type'), { target: { value: 'NONE' } }); expect(screen.getByTestId('piece')).toHaveTextContent('null'); window.confirm.mockRestore();
});
test('legacy dispatched delivery supports approved return updates without inventing a structured outbound address', async () => {
  const value = { ...booking, status: 'OUT', bookingDetails: undefined, logistics: { address: 'Original legacy address' } }, run = task => task();
  api.post.mockResolvedValue({ ...value, revision: 3 });
  render(<RentalBookingDetailsEditor booking={value} base="/admin/rentals" canWrite busy={false} run={run} onChange={jest.fn()} />);
  expect(screen.getByText('Original legacy address')).toBeInTheDocument(); expect(screen.queryByLabelText('Delivery address — City')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Edit addresses, contacts & instructions'));
  fireEvent.change(screen.getByLabelText('Reason for booking-detail changes'), { target: { value: 'Customer confirmed return instructions' } });
  fireEvent.click(screen.getByLabelText('Customer explicitly approved these booking-detail changes'));
  fireEvent.click(screen.getByRole('button', { name: 'Save approved booking details' }));
  await waitFor(() => expect(api.post).toHaveBeenCalled()); expect(api.post.mock.calls[0][1].bookingDetails.deliveryAddress).toBeNull();
});
test('courier journey switching uses the matching saved booking contact/address instead of stale outbound fields', async () => {
  render(<RentalCourierPanel booking={booking} base="/admin/rentals" canWrite owner onChange={jest.fn()} />);
  await waitFor(() => expect(screen.getByLabelText('City')).toHaveValue('Jaipur'));
  expect(screen.getByLabelText('City')).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Connected courier journey'), { target: { value: 'inbound' } });
  await waitFor(() => expect(screen.getByLabelText('City')).toHaveValue('Delhi')); expect(screen.getByLabelText('Customer contact')).toHaveValue('Return person');
});
