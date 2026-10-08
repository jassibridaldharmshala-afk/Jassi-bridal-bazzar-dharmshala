import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import RentalCatalogueBrowser from './RentalCatalogueBrowser';
import api from '../../services/api';
import { saveRentalSession } from '../../utils/rentalPlan';
jest.mock('../../services/api', () => ({ get: jest.fn(), post: jest.fn() }));
const configuration = { mode: 'SALE_AND_RENTAL', policy: { timezone: 'Asia/Kolkata', slotMinutes: 60, deliveryModes: ['STORE_PICKUP'] } };
const lehenga = { _id: 'one', productId: 'product1', title: 'Lehenga M', dailyRatePaise: 100000, depositPaise: 500000 };
const necklace = { ...lehenga, _id: 'two', productId: 'product2', title: 'Necklace' };
beforeEach(() => { jest.clearAllMocks(); sessionStorage.clear(); });
test('changing pages keeps selected outfit, dates and tenant-scoped combined quote', async () => {
  api.get.mockImplementation(async path => ({ configuration, rows: path.includes('page=2') ? [necklace] : [lehenga], page: path.includes('page=2') ? 2 : 1, pages: 2 }));
  api.post.mockResolvedValue({ policyRevision: 1, timezone: 'Asia/Kolkata', terms: 'Return every piece.', schedule: { pickupAt: '2030-01-10T04:30Z', returnDueAt: '2030-01-12T04:30Z' }, quote: { rentalPaise: 400000, depositPaise: 1000000, dueNowPaise: 1120000 } });
  render(<RentalCatalogueBrowser storeSlug="occasion" user={{ name: 'Buyer', phone: '9000000001' }} onBooked={jest.fn()} />);
  fireEvent.click(await screen.findByLabelText('Select Lehenga M'));
  fireEvent.change(screen.getByLabelText('Pickup / delivery time'), { target: { value: '2030-01-10T10:00' } });
  fireEvent.change(screen.getByLabelText('Return deadline'), { target: { value: '2030-01-12T10:00' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue to items' }));
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  fireEvent.click(await screen.findByLabelText('Select Necklace'));
  expect(screen.getByLabelText('Select Lehenga M')).toBeChecked();
  expect(screen.getByLabelText('Pickup / delivery time')).toHaveValue('2030-01-10T10:00');
  fireEvent.click(screen.getByRole('button', { name: 'Check dates & review price' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/rentals/quote?store=occasion', expect.objectContaining({ items: [{ listingId: 'one', quantity: 1 }, { listingId: 'two', quantity: 1 }] }), { silent: true }));
});

test('category selection scopes rental catalogue while keeping its store', async () => {
  api.get.mockImplementation(async path => path.startsWith('/categories')
    ? [{ _id: 'bridal-jewellery', name: 'Bridal Jewellery' }]
    : { configuration, rows: [necklace], page: 1, pages: 1 });
  render(<RentalCatalogueBrowser storeSlug="occasion" user={{ name: 'Buyer', phone: '9000000001' }} onBooked={jest.fn()} />);
  fireEvent.change(await screen.findByLabelText('Category'), { target: { value: 'bridal-jewellery' } });
  await waitFor(() => expect(api.get).toHaveBeenCalledWith(expect.stringContaining('category=bridal-jewellery&store=occasion'), { silent: true }));
});

test('linked dates automatically check availability and a removed exact offer cannot select another offer', async () => {
  api.get.mockImplementation(async path => path.includes('listingIds=removed') ? { rows: [] } : { configuration: { ...configuration, policy: { ...configuration.policy, dateFirstEnabled: true } }, rows: [lehenga], page: 1, pages: 1 });
  render(<RentalCatalogueBrowser storeSlug="occasion" user={null} initialProductId="product1" initialListingId="removed" initialSchedule={{ pickupAt: '2030-01-10T04:30:00.000Z', returnDueAt: '2030-01-12T04:30:00.000Z' }} onBooked={jest.fn()} />);
  await screen.findByText(/This rental option is no longer available/);
  expect(screen.getByLabelText('Select Lehenga M')).not.toBeChecked();
  await waitFor(() => expect(api.get.mock.calls.some(([path]) => path.includes('/availability?pickupAt='))).toBe(true));
  expect(screen.queryByRole('button', { name: 'Reserve rental' })).not.toBeInTheDocument();
});
test('a collection failure ends the loading state and exposes a retry', async () => {
  api.get.mockRejectedValue(new Error('Collection offline'));
  render(<RentalCatalogueBrowser user={null} onBooked={jest.fn()} />);
  await screen.findByRole('button', { name: 'Retry collection' });
  expect(screen.queryByText('Loading rental collection…')).not.toBeInTheDocument();
});


test('reload keeps dates and occasion time even before any rental item is selected', async () => {
  saveRentalSession('plan', 'occasion', { items: [], schedule: { pickupAt: '2030-01-10T10:00', returnDueAt: '2030-01-12T10:00', eventAt: '2030-01-11T12:00', deliveryMode: 'STORE_PICKUP' } });
  api.get.mockResolvedValue({ configuration: { ...configuration, policy: { ...configuration.policy, dateFirstEnabled: true } }, rows: [lehenga], page: 1, pages: 1 });
  render(<RentalCatalogueBrowser storeSlug="occasion" user={null} onBooked={jest.fn()} />);
  expect(await screen.findByRole('button', { name: 'Check dates & review price' })).toBeVisible();
  expect(screen.getByLabelText('Pickup / delivery time')).toHaveValue('2030-01-10T10:00');
  expect(screen.getByLabelText('Return deadline')).toHaveValue('2030-01-12T10:00');
  expect(screen.getByLabelText('Event time (optional)')).toHaveValue('2030-01-11T12:00');
  expect(screen.getByLabelText('Select Lehenga M')).not.toBeChecked();
  expect(api.get.mock.calls.some(([path]) => path.includes('/catalogue?listingIds='))).toBe(false);
});
