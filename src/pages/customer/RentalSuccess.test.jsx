import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import RentalSuccess from './RentalSuccess';
import api from '../../services/api';
import booking from '../../utils/__fixtures__/rental-booking.json';
import { downloadReceiptPdf } from '../../utils/printReceipt';

jest.mock('../../services/api', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { _id: 'rental-customer' } }) }));
jest.mock('../../context/StorefrontContext', () => ({ useStorefront: () => ({ storeSlug: 'bridal-shop' }) }));
jest.mock('../../context/BrandIdentityContext', () => ({ useBrandIdentity: () => ({ websiteName: 'Bridal shop' }) }));
jest.mock('../../utils/printReceipt', () => ({ downloadReceiptPdf: jest.fn(), printReceipt: jest.fn() }));
const navigate = jest.fn();
let current;
beforeEach(() => {
  jest.clearAllMocks(); current = booking;
  api.get.mockImplementation(path => Promise.resolve(path.includes('/bookings/') ? current : path.includes('payment-methods') ? [] : { contact: {} }));
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});

test('booking confirmation matches the order structure and shows the complete rental summary', async () => {
  render(<RentalSuccess route="/rental-success?id=one" navigate={navigate} />);
  expect(await screen.findByRole('heading', { name: 'Your rental is booked!' })).toBeInTheDocument();
  expect(screen.getByText('Orange Lehenga Choli')).toBeInTheDocument(); expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
  expect(screen.getByText('23 Oct 2026')).toBeInTheDocument(); expect(screen.getByText('Balance due')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Track booking' }));
  expect(navigate).toHaveBeenCalledWith('/store/bridal-shop/rentals?id=' + booking._id);
});

test('invoice preview includes dates, deposit, payment status and PDF/print actions', async () => {
  render(<RentalSuccess route="/rental-success?id=one" navigate={navigate} />);
  fireEvent.click(await screen.findByRole('button', { name: 'View, print or share' }));
  const dialog = within(screen.getByRole('dialog', { name: 'Rental invoice' }));
  expect(dialog.getByText('Booking: R-JB1024')).toBeInTheDocument();
  expect(dialog.getByRole('button', { name: 'Print invoice' })).toBeInTheDocument();
  expect(dialog.getByRole('button', { name: 'Download invoice (PDF)' })).toBeInTheDocument();
  expect(dialog.getByText('No payment has been recorded yet.')).toBeInTheDocument();
  fireEvent.click(dialog.getByRole('button', { name: 'Close dialog' })); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('failed PDF downloads show an actionable error and can be retried', async () => {
  downloadReceiptPdf.mockRejectedValueOnce(new Error('PDF tools offline')).mockResolvedValueOnce();
  render(<RentalSuccess route="/rental-success?id=one" navigate={navigate} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Download invoice' }));
  expect(await screen.findByText('PDF tools offline')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Download invoice' }));
  await waitFor(() => expect(screen.queryByText('PDF tools offline')).not.toBeInTheDocument());
  expect(downloadReceiptPdf).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'RENTAL', finalAmount: 1500 }));
});

test('a pending hold exposes payment and proforma without claiming the rental is booked', async () => {
  current = { ...booking, status: 'HELD', expiresAt: '2099-10-12T00:00:00Z', documents: { ...booking.documents, invoice: { ...booking.documents.invoice, kind: 'PROFORMA' } } };
  render(<RentalSuccess route="/rental-success?id=one&payment=pending" navigate={navigate} />);
  expect(await screen.findByRole('heading', { name: 'Complete your rental booking' })).toBeInTheDocument();
  expect(screen.queryByText('Your rental is booked!')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Download proforma' })).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Rental booking progress' })).not.toBeInTheDocument();
});

test('booking errors offer a retry and stale responses cannot replace a new booking', async () => {
  let finishOld;
  api.get.mockImplementation(path => path.includes('/bookings/old') ? new Promise(resolve => { finishOld = resolve; }) : path.includes('/bookings/new') ? Promise.reject(new Error('Booking temporarily unavailable')) : Promise.resolve([]));
  const view = render(<RentalSuccess route="/rental-success?id=old" navigate={navigate} />);
  view.rerender(<RentalSuccess route="/rental-success?id=new" navigate={navigate} />);
  expect(await screen.findByText('Booking temporarily unavailable')).toBeInTheDocument();
  await act(async () => finishOld(booking)); expect(screen.queryByText('Your rental is booked!')).not.toBeInTheDocument();
  api.get.mockImplementation(path => Promise.resolve(path.includes('/bookings/') ? { ...booking, _id: 'new', number: 'R-new' } : []));
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('R-new')).toBeInTheDocument();
});
