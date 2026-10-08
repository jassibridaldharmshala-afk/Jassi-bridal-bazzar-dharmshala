import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProductForm from '../../components/admin/ProductForm';
import CategoryForm from '../../components/admin/CategoryForm';
import VariantGroups from './VariantGroups';
import Returns from './Returns';
import Reports from './Reports';
import Settings from './Settings';
import ContextualHelp from '../../components/help/ContextualHelp';
import api from '../../services/api';
const mockVariantRefetch = jest.fn();
const mockVariantArchive = jest.fn();
const mockVariantCreate = jest.fn();
const mockVariantUpdate = jest.fn();
const mockVariantDelete = jest.fn();
const mockVariantRestore = jest.fn();
const mockVariantReconcile = jest.fn();
let mockVariantResponse;
jest.mock('../../services/api', () => ({ get: jest.fn(), put: jest.fn(), post: jest.fn(), delete: jest.fn() }));
jest.mock('../../store/apiSlice', () => ({
  useGetVariantGroupsQuery: () => ({ data: mockVariantResponse, isLoading: false, isFetching: false, error: null, refetch: mockVariantRefetch }),
  useGetVariantGroupCandidatesQuery: () => ({ data: { items: [], totalPages: 1 }, isLoading: false, isFetching: false, error: null, refetch: jest.fn() }),
  useGetManagementCategoriesQuery: () => ({ data: [] }),
  useCreateVariantGroupMutation: () => [mockVariantCreate, { isLoading: false }],
  useUpdateVariantGroupMutation: () => [mockVariantUpdate, { isLoading: false }],
  useDeleteVariantGroupMutation: () => [mockVariantDelete, { isLoading: false }],
  useArchiveVariantGroupMutation: () => [mockVariantArchive, { isLoading: false }],
  useRestoreVariantGroupMutation: () => [mockVariantRestore, { isLoading: false }],
  useReconcileVariantGroupMutation: () => [mockVariantReconcile, { isLoading: false }],
}));
jest.mock('../../components/admin/ImageUploader', () => ({ label, value = [], onChange }) => <div>Photo picker{value[0]?.url ? <><span>{value[0].url}</span><button type="button" aria-label={`Remove ${label}`} onClick={() => onChange([])}>Remove</button></> : null}</div>);
jest.mock('../../components/admin/VideoUploader', () => () => <div>Video picker</div>);
jest.mock('../../utils/catalogOptions', () => ({ fetchCategories: async () => [{ _id: 'cat', name: 'Sarees' }], fetchSubcategories: async () => [] }));
beforeEach(() => {
  jest.clearAllMocks(); localStorage.clear(); api.get.mockResolvedValue({ features: { sizing: false }, attributes: [] }); jest.spyOn(window, 'confirm').mockReturnValue(true);
  mockVariantResponse = { data: [], meta: { page: 1, totalPages: 1, total: 0, summary: { total: 0, active: 0, draft: 0, archived: 0 } } };
  [mockVariantArchive, mockVariantCreate, mockVariantUpdate, mockVariantDelete, mockVariantRestore, mockVariantReconcile].forEach((mock) => mock.mockReturnValue({ unwrap: () => Promise.resolve({ message: 'Saved' }) }));
});
afterEach(() => jest.restoreAllMocks());

test('contextual manual opens the correct page guide and keeps full help searchable', async () => {
  const navigate = jest.fn();
  render(<ContextualHelp route="/admin/returns?status=Requested" navigate={navigate} />);
  fireEvent.click(screen.getByRole('button', { name: 'Open help for this page' }));
  expect(await screen.findByRole('heading', { name: 'Returns & Exchange Center' })).toBeInTheDocument();
  expect(screen.getByText(/create the reverse pickup from the customer pickup address/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: 'Complete manual' }));
  const search = screen.getByPlaceholderText('Search the manual…');
  fireEvent.change(search, { target: { value: 'refund' } });
  expect(screen.getByText(/guide(s)? for this workspace/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Contact support' }));
  expect(navigate).toHaveBeenCalledWith('/admin/support');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('missing product or category edit IDs never turn into create forms', () => {
  const view = render(<ProductForm mode="Update" />);
  expect(screen.getByRole('alert')).toHaveTextContent('Choose a product');
  expect(screen.queryByRole('button', { name: 'Update Product' })).not.toBeInTheDocument();
  view.unmount();
  render(<CategoryForm mode="Update" />);
  expect(screen.getByRole('alert')).toHaveTextContent('Choose a category');
  expect(api.post).not.toHaveBeenCalled();
});

test('failed product loads preserve cached edits and retry without exposing an empty editor', async () => {
  localStorage.setItem('samira-admin-product-draft:product-a', JSON.stringify({ name: 'Protected local draft' }));
  let fail = true;
  api.get.mockImplementation(async path => {
    if (path === '/catalog-configuration') return { features: { sizing: false }, attributes: [] };
    if (fail) throw new Error('Product could not load');
    return { _id: 'product-a', name: 'Server saree', images: [], sizes: [], colors: [], tags: [] };
  });
  render(<ProductForm mode="Update" productId="product-a" />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Product could not load');
  expect(screen.queryByPlaceholderText('Product name')).not.toBeInTheDocument();
  expect(localStorage.getItem('samira-admin-product-draft:product-a')).toContain('Protected local draft');
  fail = false; fireEvent.click(screen.getByRole('button', { name: 'Retry loading product' }));
  expect(await screen.findByRole('button', { name: 'Update Product' })).toBeInTheDocument();
});

test('late product reads cannot replace another selected edit target', async () => {
  let firstRead;
  api.get.mockImplementation(path => path === '/catalog-configuration' ? Promise.resolve({ features: { sizing: false }, attributes: [] }) : path.endsWith('/a')
    ? new Promise(resolve => { firstRead = resolve; }) : Promise.resolve({ name: 'Current green saree', sizes: [], colors: [], tags: [], images: [] }));
  const view = render(<ProductForm mode="Update" productId="a" />);
  view.rerender(<ProductForm mode="Update" productId="b" />);
  await screen.findByDisplayValue('Current green saree');
  await act(async () => { firstRead({ name: 'Stale rose saree', sizes: [], colors: [], tags: [], images: [] }); });
  expect(screen.queryByDisplayValue('Stale rose saree')).not.toBeInTheDocument();
  expect(screen.getByDisplayValue('Current green saree')).toBeInTheDocument();
});

test('mixed commerce product saves the sale price and selected rental price together', async () => {
  const rentalOffers = [{ _id: 'offer-1', title: 'Bridal saree', active: true, revision: 3, dailyRatePaise: 75000, depositPaise: 200000 }];
  api.get.mockImplementation(async path => path === '/catalog-configuration' ? { industry: 'boutique', features: { sizing: false }, attributes: [] } : path.includes('duplicate-check') ? { conflicts: [] } : { name: 'Bridal saree', description: 'Bridal saree with an embroidered border.', sku: 'BRIDAL-1', category: 'cat', price: 5000, originalPrice: 6000, stock: 2, lowStockAlert: 5, commerceMode: 'SALE_AND_RENTAL', rentalOffers, sizes: [], colors: [], tags: [], images: [{ url: '/uploads/saree.jpg', primary: true }] });
  api.put.mockResolvedValue({});
  render(<ProductForm mode="Update" productId="prod1" />);
  const rate = await screen.findByLabelText('Rental price per day (₹)');
  expect(rate).toHaveValue(750);
  fireEvent.change(rate, { target: { value: '900' } });
  fireEvent.change(screen.getByLabelText(/Selling price/), { target: { value: '5500' } });
  fireEvent.click(screen.getByRole('button', { name: 'Update Product' }));
  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/admin/products/prod1', expect.objectContaining({ price: 5500, rentalPricing: expect.objectContaining({ listingId: 'offer-1', revision: 3, dailyRatePaise: 90000, depositPaise: 200000 }) })));
});

test('category editing retries reads, preserves both images and only removes the chosen image', async () => {
  api.get.mockRejectedValueOnce(new Error('Category unavailable')).mockResolvedValueOnce({ name: 'Sarees', slug: 'sarees', image: '/uploads/category.jpg', socialImage: '/uploads/category-social.jpg', isActive: true });
  api.put.mockResolvedValue({});
  render(<CategoryForm mode="Update" categoryId="cat" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Retry loading category' }));
  fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Festive sarees' } });
  expect(screen.getByText('/uploads/category.jpg')).toBeInTheDocument();
  expect(screen.getByText('/uploads/category-social.jpg')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Update Category' }));
  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/admin/categories/cat', expect.objectContaining({ name: 'Festive sarees', image: '/uploads/category.jpg', socialImage: '/uploads/category-social.jpg', isActive: true })));
  expect(api.put.mock.calls[0][1]).not.toHaveProperty('removeImage');
  expect(api.put.mock.calls[0][1]).not.toHaveProperty('removeSocialImage');
  fireEvent.click(screen.getByRole('button', { name: 'Remove Choose Category Image' }));
  fireEvent.click(screen.getByRole('button', { name: 'Update Category' }));
  await waitFor(() => expect(api.put).toHaveBeenLastCalledWith('/admin/categories/cat', expect.objectContaining({ image: '', removeImage: true, socialImage: '/uploads/category-social.jpg' })));
  expect(api.put.mock.calls.at(-1)[1]).not.toHaveProperty('removeSocialImage');
  expect(api.post).not.toHaveBeenCalled();
});

test('variant family archive failures are actionable and preserve the family for retry', async () => {
  mockVariantResponse = { data: [{ _id: 'group', name: 'Rose family', products: [{ _id: 'p1', name: 'Rose saree', images: [], stock: 2 }], members: [], optionDefinitions: [], status: 'draft', isArchived: false, health: { state: 'review', score: 70, issues: [], warnings: ['Add an option'] } }], meta: { page: 1, totalPages: 1, total: 1, summary: { total: 1, active: 0, draft: 1, archived: 0 } } };
  mockVariantArchive.mockReturnValueOnce({ unwrap: () => Promise.reject({ data: { message: 'Family archive failed' } }) }).mockReturnValueOnce({ unwrap: () => Promise.resolve({ message: 'Family archived' }) });
  render(<VariantGroups />);
  fireEvent.click(screen.getByRole('button', { name: 'Archive Rose family' }));
  fireEvent.click(screen.getByRole('button', { name: 'Archive family' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Family archive failed');
  expect(screen.getByRole('heading', { name: 'Rose family' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Archive Rose family' }));
  fireEvent.click(screen.getByRole('button', { name: 'Archive family' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Family archived');
  expect(mockVariantArchive).toHaveBeenCalledTimes(2);
});

test('a partial bulk return failure preserves the successful update and reports the failed case', async () => {
  let cases = [
    { _id: 'return-a', status: 'Requested', type: 'return', quantity: 1, revision: 0, allowedStatuses: ['Approved', 'Rejected'] },
    { _id: 'return-b', status: 'Requested', type: 'return', quantity: 1, revision: 0, allowedStatuses: ['Approved', 'Rejected'] },
  ];
  api.get.mockImplementation(path => Promise.resolve(path.includes('/returns/stats')
    ? { total: cases.length, pending: cases.filter(item => item.status === 'Requested').length }
    : { items: cases, total: cases.length, page: 1, totalPages: 1 }));
  api.put.mockImplementation(path => {
    if (path.includes('return-a')) return Promise.reject(new Error('First request failed'));
    cases = cases.map(item => item._id === 'return-b' ? { ...item, status: 'Approved', revision: 1, allowedStatuses: ['Pickup Scheduled'] } : item);
    return Promise.resolve(cases[1]);
  });
  render(<Returns />);
  await screen.findByRole('button', { name: '#RETURN-A' });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select page' }));
  fireEvent.click(screen.getByRole('button', { name: 'Approve eligible' }));
  expect(await screen.findByRole('status')).toHaveTextContent('1 request(s) approved; 1 need individual review');
  expect(api.put).toHaveBeenCalledWith('/admin/returns/return-a/status', expect.objectContaining({ status: 'Approved', revision: 0 }));
  expect(api.put).toHaveBeenCalledWith('/admin/returns/return-b/status', expect.objectContaining({ status: 'Approved', revision: 0 }));
  expect(await screen.findByRole('button', { name: 'Mark pickup scheduled' })).toBeInTheDocument();
});

test('report range changes ignore late results and show the selected range', async () => {
  const late = [];
  const summary = value => ({ currency: 'INR', timezone: 'Asia/Kolkata', generatedAt: new Date().toISOString(), range: { fromDate: '2026-09-04', toDate: '2026-09-10' }, capabilities: { sections: { summary: true, products: true, customers: true, marketing: true, fulfillment: true } }, data: { metrics: { bookedValue: { value }, recognizedRevenue: { value }, orders: { value: 1 }, averageOrderValue: { value }, customers: { value: 1 }, units: { value: 1 } }, current: { allOrders: 1, orders: 1 }, series: [], statusBreakdown: [], paymentBreakdown: [] } });
  api.get.mockImplementation(path => {
    if (path.includes('/reports/options')) return Promise.resolve({ capabilities: { canExport: true, canManage: true, sections: { summary: true, products: true, customers: true, marketing: true, fulfillment: true } } });
    if (path.includes('/reports/views')) return Promise.resolve({ items: [] });
    if (path.includes('/center/summary') && path.includes('range=30d')) return new Promise(resolve => late.push(resolve));
    if (path.includes('/center/summary')) return Promise.resolve(summary(700));
    return Promise.resolve({ data: {} });
  });
  render(<Reports />);
  fireEvent.click(screen.getByRole('button', { name: '7 days' }));
  expect((await screen.findAllByText('₹700.00')).length).toBeGreaterThan(0);
  await act(async () => { late.forEach(resolve => resolve(summary(3000))); });
  expect(screen.getAllByText('₹700.00').length).toBeGreaterThan(0);
  expect(screen.queryByText('₹3,000.00')).not.toBeInTheDocument();
});

test('optional payment readiness failure leaves settings editable and reports successful saves accurately', async () => {
  api.get.mockImplementation(async path => { if (path.endsWith('/payment-readiness')) throw new Error('Gateway check unavailable'); return { storeName: 'My shop', returnWindowDays: 0, gstRate: 5.5 }; });
  api.put.mockResolvedValue({ storeName: 'Updated shop', returnWindowDays: 0, gstRate: 5.5 });
  render(<Settings />);
  fireEvent.change(await screen.findByLabelText('Store Name'), { target: { value: 'Updated shop' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }));
  expect(await screen.findByText('Settings saved successfully.')).toBeInTheDocument();
  expect(api.put).toHaveBeenCalledWith('/admin/settings', expect.objectContaining({ storeName: 'Updated shop', returnWindowDays: 0, gstRate: 5.5 }));
  expect(screen.getByRole('button', { name: 'Retry payment check' })).toBeInTheDocument();
});

test('OTP settings are available in the admin sidebar and never mix credentials into general settings saves', async () => {
  api.get.mockImplementation(async path => path.endsWith('/sms') ? {
    revision: 0, active: { provider: 'twofactor', source: 'environment', configured: true }, pending: null,
    providers: [{ id: 'twofactor', label: '2Factor', fields: [{ key: 'apiKey', label: 'API key', required: true }] }],
    environment: { configured: true, provider: 'twofactor', label: '2Factor' }, phoneMasked: '••••••3210',
  } : { storeName: 'My shop', returnWindowDays: 7, gstRate: 5 });
  api.put.mockResolvedValue({ storeName: 'Updated shop', returnWindowDays: 7, gstRate: 5 });
  render(<Settings />);
  fireEvent.click(await screen.findByRole('button', { name: 'OTP & SMS' }));
  fireEvent.change(await screen.findByLabelText('API key'), { target: { value: 'not-for-general-settings' } });
  expect(screen.queryByRole('button', { name: 'Save Settings' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Brand & identity' }));
  fireEvent.change(screen.getByLabelText('Store Name'), { target: { value: 'Updated shop' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }));
  await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
  expect(JSON.stringify(api.put.mock.calls)).not.toContain('not-for-general-settings');
  fireEvent.click(screen.getByRole('button', { name: 'OTP & SMS' }));
  expect(await screen.findByLabelText('API key')).toHaveValue('not-for-general-settings');
});

test('store-scoped sellers do not get a deployment OTP settings control', async () => {
  api.get.mockResolvedValue({ storeName: 'Seller store', returnWindowDays: 7 });
  render(<Settings route="/seller/settings" />);
  await screen.findByLabelText('Store Name');
  expect(screen.queryByRole('button', { name: 'OTP & SMS' })).not.toBeInTheDocument();
  expect(api.get.mock.calls.some(([path]) => path.endsWith('/sms'))).toBe(false);
});
