import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RentalPolicyControls from './RentalPolicyControls';
import RentalProofPanel from './RentalProofPanel';
import RentalDocuments from './RentalDocuments';
import RentalCourierPanel from './RentalCourierPanel';
import api from '../../services/api';
import { compressImageFile } from '../../services/imageCompression';
jest.mock('../../services/api', () => ({ get: jest.fn(), post: jest.fn(), upload: jest.fn() }));
jest.mock('../../services/imageCompression', () => ({ compressImageFile: jest.fn() }));
const booking = { _id: 'booking1', number: 'R-1', status: 'READY', revision: 4, policy: { timezone: 'Asia/Kolkata' }, customer: { name: 'Bride', phone: '9000000001' }, schedule: { pickupAt: '2030-01-10T04:30:00Z' }, allocations: [{ assetId: 'piece1', code: 'OUTFIT-001', label: 'Lehenga M' }], acknowledgements: [] };
beforeEach(() => { jest.clearAllMocks(); api.get.mockResolvedValue({ photos: [], pieces: booking.allocations }); });
test('owner controls have positive advance limits and independent deposit timing', () => {
  const onChange = jest.fn(); const { rerender } = render(<RentalPolicyControls policy={{ advancePercent: 30 }} onChange={onChange} />);
  expect(screen.getByLabelText('Compulsory advance (%)')).toHaveAttribute('min', '1');
  fireEvent.change(screen.getByLabelText('Advance calculation'), { target: { value: 'FIXED' } }); expect(onChange).toHaveBeenCalledWith('advanceMode', 'FIXED');
  rerender(<RentalPolicyControls policy={{ advanceMode: 'FIXED', advanceAmountPaise: 10000 }} onChange={onChange} />);
  fireEvent.change(screen.getByLabelText('Compulsory fixed advance (₹)'), { target: { value: '250.50' } }); expect(onChange).toHaveBeenCalledWith('advanceAmountPaise', 25050);
  fireEvent.change(screen.getByLabelText('Security deposit collection'), { target: { value: 'PICKUP' } }); expect(onChange).toHaveBeenCalledWith('depositTiming', 'PICKUP');
});
test('customer evidence uses the current storefront and an explicit acknowledgement', async () => {
  const onChange = jest.fn(); api.post.mockResolvedValue({ ...booking, revision: 5 });
  render(<RentalProofPanel booking={booking} base="/rentals" storeSlug="nishaya" onChange={onChange} />);
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/rentals/bookings/booking1/proofs?store=nishaya', expect.anything()));
  expect(screen.getByRole('button', { name: 'Acknowledge piece condition' })).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox', { name: /I reviewed and acknowledge/ })); fireEvent.click(screen.getByRole('button', { name: 'Acknowledge piece condition' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/rentals/bookings/booking1/acknowledgements?store=nishaya', expect.objectContaining({ accepted: true, revision: 4, assetIds: ['piece1'], stage: 'HANDOVER' }), { silent: true }));
  await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ revision: 5 })));
});
test('staff evidence uses multipart upload with consent, stage, piece and revision', async () => {
  const onChange = jest.fn(), photo = new File(['photo'], 'photo.webp', { type: 'image/webp' });
  compressImageFile.mockResolvedValue(photo); api.upload.mockResolvedValue({ booking: { ...booking, revision: 5 }, photos: [] });
  render(<RentalProofPanel booking={booking} base="/admin/rentals" staff canUpload onChange={onChange} />);
  fireEvent.change(screen.getByLabelText('Piece being photographed'), { target: { value: 'piece1' } });
  fireEvent.click(screen.getByRole('checkbox', { name: /Customer consent/ }));
  fireEvent.change(screen.getByLabelText('Upload private condition photos'), { target: { files: [photo] } });
  await waitFor(() => expect(api.upload).toHaveBeenCalledWith('/admin/rentals/bookings/booking1/proofs', [photo], { silent: true, fields: { stage: 'HANDOVER', assetId: 'piece1', revision: 4, consent: 'true' } }));
  expect(api.post).not.toHaveBeenCalled();
});
test('held/closed customers cannot acknowledge a piece that is not awaiting handover', async () => {
  render(<RentalProofPanel booking={{ ...booking, status: 'HELD' }} base="/rentals" />);
  await screen.findByText(/Private condition evidence/);
  expect(screen.queryByRole('button', { name: 'Acknowledge piece condition' })).not.toBeInTheDocument();
});
test('partial return acknowledgement includes only customer-selected unreturned pieces', async () => {
  const allocations = [...booking.allocations, { assetId: 'piece2', code: 'OUTFIT-002', label: 'Accessory' }];
  api.get.mockResolvedValue({ photos: [], pieces: allocations }); api.post.mockResolvedValue({ ...booking, status: 'OUT', revision: 5 });
  render(<RentalProofPanel booking={{ ...booking, status: 'OUT', allocations }} base="/rentals" onChange={jest.fn()} />);
  fireEvent.change(screen.getByLabelText('Evidence stage'), { target: { value: 'RETURN' } });
  await screen.findByText('Pieces you are returning now');
  fireEvent.click(screen.getByRole('checkbox', { name: /OUTFIT-001/ })); fireEvent.click(screen.getByRole('checkbox', { name: /I reviewed and acknowledge/ })); fireEvent.click(screen.getByRole('button', { name: 'Acknowledge piece condition' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/rentals/bookings/booking1/acknowledgements', expect.objectContaining({ stage: 'RETURN', assetIds: ['piece1'] }), { silent: true }));
});
test('uncertain courier writes are disabled while owner reconciliation remains available', async () => {
  api.get.mockResolvedValue([{ direction: 'outbound', status: 'REVIEW', provider: 'bluedart', awb: '12345678901', uncertainOperation: 'pickup' }]);
  render(<RentalCourierPanel booking={booking} base="/admin/rentals" canWrite owner onChange={jest.fn()} />);
  await screen.findByText('Review');
  expect(screen.getByRole('button', { name: 'Request carrier pickup' })).toBeDisabled(); expect(screen.getByRole('button', { name: 'Book connected courier' })).toBeDisabled();
  expect(screen.getByText('Owner-only carrier reconciliation')).toBeInTheDocument(); expect(api.post).not.toHaveBeenCalled();
});
test('invoice printing targets only the invoice and resets the print state', () => {
  const print = jest.spyOn(window, 'print').mockImplementation(() => expect(document.body.dataset.rentalPrint).toBe('documents'));
  const docs = { invoice: { kind: 'RENTAL_INVOICE', number: 'RINV-R-1', seller: { storeName: 'Nishaya' }, customer: booking.customer, items: [], basisPoints: 0 }, receipts: [], note: 'Deposit separate' };
  render(<RentalDocuments booking={{ ...booking, documents: docs }} />); fireEvent.click(screen.getByRole('button', { name: 'Print invoice / receipts' }));
  expect(print).toHaveBeenCalledTimes(1); expect(document.body.dataset.rentalPrint).toBeUndefined(); print.mockRestore();
});
