import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import api from '../../services/api';
import RentalSetupWizard from './RentalSetupWizard';
import RentalProductPicker from './RentalProductPicker';
import ProductSmartFill from '../admin/ProductSmartFill';
jest.mock('../../services/api', () => ({ get: jest.fn(), post: jest.fn() }));
const config = { mode: 'SALE_AND_RENTAL', policy: { timezone: 'Asia/Kolkata', paymentPlans: ['PICKUP'] } };
const product = { _id: 'product1', name: 'Pink bridal lehenga', sku: 'PINK-01', images: [{ url: '/uploads/pink.jpg', primary: true }, { url: '/uploads/back.jpg' }], commerceMode: 'SALE_AND_RENTAL', isActive: true };
const offer = { _id: 'offer1', productId: 'product1', title: product.name, active: false, revision: 2, dailyRatePaise: 50000, depositPaise: 100000, advanceMode: 'STORE', fitting: { adjustable: true, alterationsAvailable: true }, cleaningFeePaise: 0, alterationFeePaise: 0, requirements: [{ productId: 'product1', poolKey: 'outfit', label: product.name, quantity: 1 }] };
const setup = value => ({ listing: value, product, ready: true, checks: [{ key: 'pieces', label: 'Actual quantity registered', ready: true }], components: [{ ...offer.requirements[0], configured: 2, required: 1, readyNow: 2 }], shopEnabled: true, onlinePayments: false, acceptingOrders: true });
beforeEach(() => {
  jest.clearAllMocks();
  api.get.mockImplementation(async path => path.includes('/setup/') ? setup(offer) : path.includes('/manage/products') ? { rows: [{ ...product, rentalOffers: [offer] }], total: 1, pages: 1 } : { rows: [], total: 0, pages: 1 });
  api.post.mockImplementation(async (path, body) => ({ ...body, _id: offer._id, revision: offer.revision + 1 }));
});

test('saved price is reused with real catalogue photos, while optional settings remain closed', async () => {
  render(<RentalSetupWizard base="/admin/rentals" initialProductId="product1" configuration={config} readiness={{ transactions: true }} run={work => work()} onTab={jest.fn()} />);
  await waitFor(() => expect(screen.getByLabelText('Rental price per day (₹)')).toHaveValue(500));
  expect(screen.getByLabelText(/^Refundable security deposit/)).toHaveValue(1000);
  expect(screen.getByText(/Saved rental price reused/)).toBeInTheDocument();
  expect(screen.getAllByRole('img', { name: product.name }).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: 'View product photo 2' }));
  expect(screen.getByRole('link', { name: 'Open original photo' })).toHaveAttribute('href', expect.stringContaining('/uploads/back.jpg'));
  expect(screen.getByText('Advance & fitting (optional)').parentElement).not.toHaveAttribute('open');
  expect(screen.getByText('Offer title & extra charges (optional)').parentElement).not.toHaveAttribute('open');
  expect(screen.getByLabelText('Owner fitting template (optional)')).toHaveValue('OTHER');
  expect(api.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Save price & continue' }));
  await screen.findByRole('heading', { name: 'How many do you own?' });
  expect(api.post).toHaveBeenCalledWith('/admin/rentals/listings', expect.objectContaining({ _id: 'offer1', revision: 2, dailyRatePaise: 50000, active: false }));
});

test('multiple saved options require a deliberate choice instead of inventing another offer', async () => {
  api.get.mockImplementation(async path => path.includes('/manage/products') ? { rows: [{ ...product, rentalOffers: [offer, { ...offer, _id: 'offer2', title: 'Weekend package' }] }], total: 1, pages: 1 } : { rows: [], total: 0, pages: 1 });
  render(<RentalSetupWizard base="/seller/rentals" initialProductId="product1" configuration={config} readiness={{ transactions: true }} run={work => work()} onTab={jest.fn()} />);
  await screen.findByRole('heading', { name: 'Rental prices already saved' });
  expect(screen.getByRole('button', { name: 'Save price & continue' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Create another option for this product' }));
  expect(screen.getByRole('button', { name: 'Save price & continue' })).toBeEnabled();
  expect(api.post).not.toHaveBeenCalled();
});

test('photo choices keep the exact selected product and recover when a photo is missing', async () => {
  const choose = jest.fn();
  api.get.mockResolvedValue({ rows: [product, { ...product, _id: 'product2', name: 'Jewellery set', images: [] }], page: 1, total: 2, pages: 1 });
  render(<RentalProductPicker visual base="/seller/rentals" productId="" onChoose={choose} />);
  const cards = await screen.findByRole('group', { name: 'Choose rental product' });
  fireEvent.click(within(cards).getByRole('button', { name: /Jewellery set/ }));
  expect(choose).toHaveBeenCalledWith(expect.objectContaining({ _id: 'product2' }));
  expect(screen.getAllByText('No photo yet').length).toBeGreaterThan(0);
});

test('AI setup review excludes sale/stock/size guesses and explicitly applies only owner-evidenced rental terms', async () => {
  api.get.mockResolvedValue({ enabled: true, maxPhotos: 6 });
  api.post.mockResolvedValue({ mode: 'ai', suggestion: { name: 'Photo title', price: 9000, sizes: ['M'], stock: 99, rentalPricing: { dailyRatePaise: 60000, depositPaise: 150000, fitting: { includedItems: 'Lehenga, blouse, dupatta' } } }, fieldSources: { 'rentalPricing.dailyRatePaise': { source: 'caption', quote: 'Daily rent: Rs 600' }, 'rentalPricing.depositPaise': { source: 'caption', quote: 'Deposit: Rs 1500' }, 'rentalPricing.fitting.includedItems': { source: 'caption', quote: 'Included items: Lehenga, blouse, dupatta' } }, warnings: [] });
  const apply = jest.fn();
  render(<ProductSmartFill rentalSetup seo={false} form={{ ...product, name: '', rentalPricing: { dailyRatePaise: '', depositPaise: 0, advanceMode: 'STORE' } }} categories={[]} onApply={apply} />);
  fireEvent.click(screen.getByRole('button', { name: /AI setup help/ }));
  await screen.findByText('2/6 selected');
  fireEvent.click(screen.getByRole('button', { name: 'Suggest rental details' }));
  await screen.findByText('Daily rent (owner stated)');
  const rent = screen.getByLabelText(/Daily rent \(owner stated\)/), deposit = screen.getByLabelText(/Refundable security \(owner stated\)/);
  expect(rent).not.toBeChecked(); expect(deposit).not.toBeChecked();
  expect(screen.queryByText('Selling price')).not.toBeInTheDocument(); expect(screen.queryByText('Available sizes')).not.toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('Allow replacing selected existing details'));
  fireEvent.click(rent); fireEvent.click(deposit);
  fireEvent.click(screen.getByRole('button', { name: /Apply .* selected details/ }));
  expect(apply.mock.calls[0][0].map(row => row.key)).toEqual(expect.arrayContaining(['rentalPricing.dailyRatePaise', 'rentalPricing.depositPaise']));
  expect(apply.mock.calls[0][0].every(row => row.key === 'name' || row.key.startsWith('rentalPricing.'))).toBe(true);
  expect(api.post.mock.calls[0][0]).toBe('/admin/products/smart-fill');
  expect(api.post.mock.calls[0][1].imageUrls).toEqual(['/uploads/pink.jpg', '/uploads/back.jpg']);
});

test('activation retains stock, transaction and unsaved-data guards and opens the familiar booking workspace', async () => {
  const open = jest.fn(); let saved = offer;
  api.get.mockImplementation(async path => path.includes('/setup/') ? setup(saved) : path.includes('/manage/products') ? { rows: [product], total: 1, pages: 1 } : { rows: [], total: 0, pages: 1 });
  api.post.mockImplementation(async (path, body) => { saved = { ...body, revision: body.revision + 1 }; return saved; });
  render(<RentalSetupWizard base="/admin/rentals" initialListingId="offer1" configuration={config} readiness={{ transactions: true }} run={work => work()} onTab={jest.fn()} onBookings={open} />);
  await screen.findByRole('heading', { name: 'How many do you own?' });
  fireEvent.click(screen.getByRole('button', { name: 'Continue with registered pieces' }));
  fireEvent.click(screen.getByRole('button', { name: 'Start accepting rentals' }));
  await screen.findByRole('heading', { name: 'This product is open for rentals' });
  fireEvent.click(screen.getByRole('button', { name: 'Open rental bookings' }));
  expect(open).toHaveBeenCalledTimes(1);
});

test('a bundled set stays on quantity until every included component has been owner-counted', async () => {
  let counts = [0, 0];
  const bundled = { ...offer, requirements: [offer.requirements[0], { productId: 'product2', poolKey: 'jewel', label: 'Jewellery', quantity: 1 }] };
  api.get.mockImplementation(async path => path.includes('/setup/') ? { ...setup(bundled), ready: counts.every(count => count > 0), components: bundled.requirements.map((component, index) => ({ ...component, required: 1, configured: counts[index], readyNow: counts[index] })) } : path.includes('/manage/products') ? { rows: [product], total: 1, pages: 1 } : { rows: [], total: 0, pages: 1 });
  api.post.mockImplementation(async (path, input) => { counts[input.componentIndex] += input.quantity; return { rows: [], quantity: input.quantity }; });
  render(<RentalSetupWizard base="/admin/rentals" initialListingId="offer1" configuration={config} readiness={{ transactions: true }} run={work => work()} onTab={jest.fn()} />);
  await screen.findByRole('heading', { name: 'How many do you own?' });
  fireEvent.change(screen.getByLabelText('Quantity to add'), { target: { value: '1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save quantity & continue' }));
  await waitFor(() => expect(screen.getByLabelText('Included item to register')).toHaveValue('1'));
  expect(screen.queryByRole('heading', { name: 'Confirm & start rentals' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Quantity to add'), { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save quantity & continue' }));
  await screen.findByRole('heading', { name: 'Confirm & start rentals' });
  expect(counts).toEqual([1, 2]);
  expect(api.post.mock.calls.map(([, input]) => input.componentIndex)).toEqual([0, 1]);
});
