import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import api from '../../services/api';
import RentalStudioNavigation from './RentalStudioNavigation';
import RentalSetupWizard from './RentalSetupWizard';
import RentalBookingDesk from './RentalBookingDesk';
import RentalRecordPager from './RentalRecordPager';
jest.mock('../../services/api', () => ({ get: jest.fn(), post: jest.fn() }));
const configuration = { mode: 'SALE_AND_RENTAL', policy: { timezone: 'Asia/Kolkata' } };
beforeEach(() => jest.clearAllMocks());

test('daily navigation keeps extra tools behind a labelled menu and respects staff permissions', () => {
  const onTab = jest.fn();
  render(<RentalStudioNavigation configuration={configuration} hasOffers permissions={{ 'reports.read': false, configure: false }} tab="bookings" onTab={onTab} catalogueHref="/seller/product-drafts?storeId=shop1" />);
  expect(screen.queryByRole('button', { name: 'Rental reports' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'More tools' }));
  expect(screen.getByText('Add prices, register pieces and activate an offer')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Policies & settings' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Needs setup/ }));
  expect(onTab).toHaveBeenCalledWith('readiness');
  expect(screen.getByRole('button', { name: 'More tools' })).toHaveAttribute('aria-expanded', 'false');
  expect(screen.getByRole('link', { name: 'Open product drafts →' })).toHaveAttribute('href', '/seller/product-drafts?storeId=shop1');
});

test('linked product setup resolves the exact product and registers only the owner-counted new quantity', async () => {
  const product = { _id: 'product1', name: 'Bridal lehenga', commerceMode: 'SALE_AND_RENTAL' };
  let listing, count = 0;
  api.get.mockImplementation(async path => {
    if (path.includes('/manage/products')) return { rows: [product], total: 1, pages: 1 };
    if (path.includes('/setup/')) return { listing, ready: count > 0, checks: [{ key: 'pieces', label: 'Actual pieces registered', ready: count > 0 }], components: [{ ...listing.requirements[0], configured: count, required: 1, readyNow: count }], shopEnabled: true, onlinePayments: true, acceptingOrders: true };
    return { rows: listing ? [listing] : [], total: listing ? 1 : 0, pages: 1 };
  });
  api.post.mockImplementation(async (path, body) => {
    if (path.endsWith('/pieces')) { count += body.quantity; return { rows: [], quantity: body.quantity }; }
    listing = { ...body, _id: 'offer1', revision: 1 }; return listing;
  });
  const dirty = jest.fn();
  render(<RentalSetupWizard base="/admin/rentals" initialProductId="product1" configuration={configuration} readiness={{ transactions: true }} run={work => work()} onTab={jest.fn()} onDirtyChange={dirty} />);
  await waitFor(() => expect(screen.getByLabelText('Offer title')).toHaveValue('Bridal lehenga'));
  fireEvent.change(screen.getByLabelText('Rental price per day (₹)'), { target: { value: '500' } });
  fireEvent.change(screen.getByLabelText(/^Refundable security deposit/), { target: { value: '1000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save price & continue' }));
  await screen.findByRole('heading', { name: 'How many do you own?' });
  expect(api.post).toHaveBeenCalledWith('/admin/rentals/listings', expect.objectContaining({ productId: 'product1', title: 'Bridal lehenga', active: false, dailyRatePaise: 50000, depositPaise: 100000, requirements: [{ productId: 'product1', poolKey: 'product-product1', label: 'Bridal lehenga', quantity: 1 }] }));
  fireEvent.change(screen.getByLabelText('Quantity to add'), { target: { value: '3' } });
  await waitFor(() => expect(dirty).toHaveBeenLastCalledWith(true));
  fireEvent.click(screen.getByRole('button', { name: 'Save quantity & continue' }));
  await screen.findByRole('heading', { name: 'Confirm & start rentals' });
  expect(api.post).toHaveBeenCalledWith('/admin/rentals/setup/offer1/pieces', expect.objectContaining({ quantity: 3, revision: 1, componentIndex: 0, operationId: expect.any(String) }));
  await waitFor(() => expect(dirty).toHaveBeenLastCalledWith(false));
  expect(screen.getByRole('button', { name: 'Start accepting rentals' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: /1.*Product & price/ }));
  fireEvent.change(screen.getByLabelText('Rental price per day (₹)'), { target: { value: '600' } });
  fireEvent.click(screen.getByRole('button', { name: /3.*Confirm/ }));
  expect(screen.getByRole('button', { name: 'Start accepting rentals' })).toBeDisabled();
  expect(screen.getByText(/Save price changes in step 1/)).toBeInTheDocument();
});

test('unavailable linked products cannot create an offer with an invisible or missing component', async () => {
  api.get.mockResolvedValue({ rows: [], total: 0, pages: 1 });
  render(<RentalSetupWizard base="/seller/rentals" initialProductId="removed" configuration={configuration} readiness={{ transactions: true }} run={work => work()} onTab={jest.fn()} />);
  await screen.findByText(/This product is unavailable in your shop/);
  fireEvent.change(screen.getByLabelText('Rental price per day (₹)'), { target: { value: '500' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save price & continue' }));
  expect(screen.getByText('Choose a catalogue product first.')).toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalled();
});

test('booking records expose labelled dates and money in a single card with staff-oriented status copy', async () => {
  api.get.mockImplementation(async path => path.includes('/daily-desk') ? { counts: { pickups: 1 } } : { page: 1, pages: 1, total: 1, rows: [{ _id: 'booking1', number: 'RENT-01', status: 'OUT', customer: { name: 'Bride', phone: '9000000001' }, policy: { timezone: 'Asia/Kolkata' }, schedule: { pickupAt: '2030-01-10T04:30Z', returnDueAt: '2030-01-12T04:30Z' }, financial: { balancePaise: 50000, refundablePaise: 100000 } }] });
  const onOpen = jest.fn();
  render(<RentalBookingDesk base="/admin/rentals" timezone="Asia/Kolkata" onOpen={onOpen} />);
  const list = await screen.findByRole('list', { name: 'Rental bookings' });
  expect(within(list).getAllByRole('listitem')).toHaveLength(1);
  ['Pickup', 'Return by', 'Balance due', 'Refund available', 'With customer'].forEach(label => expect(within(list).getByText(label)).toBeInTheDocument());
  fireEvent.click(within(list).getByRole('button', { name: 'Manage RENT-01' }));
  expect(onOpen).toHaveBeenCalledWith('booking1');
  fireEvent.click(screen.getByText('More filters'));
  expect(screen.getByLabelText('Booking status').querySelector('option[value="OUT"]')).toHaveTextContent('With customer');
});

test('inventory search recovers from an incomplete response and keeps internal API names out of merchant controls', async () => {
  api.get.mockResolvedValueOnce({ success: true }).mockResolvedValueOnce({ rows: [{ _id: 'piece1' }], page: 1, pages: 1, total: 1 });
  const loaded = jest.fn();
  render(<RentalRecordPager base="/admin/rentals" kind="assets" onLoaded={loaded} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('The pieces list could not be loaded');
  expect(loaded).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Retry pieces' }));
  await waitFor(() => expect(loaded).toHaveBeenCalledWith([{ _id: 'piece1' }]));
  expect(screen.getByLabelText('Search pieces')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Previous pieces' })).not.toBeInTheDocument();
  expect(api.get).toHaveBeenCalledWith('/admin/rentals/manage/assets?page=1&search=', expect.any(Object));
});
