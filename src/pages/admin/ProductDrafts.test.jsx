import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ProductDrafts, { normalizeDraftBody } from './ProductDrafts';
import api from '../../services/api';

jest.mock('../../services/api', () => ({ get: jest.fn(), post: jest.fn(), upload: jest.fn() }));
jest.mock('../../hooks/useDesktopFeedback', () => () => ({ notify: () => false }));
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ notify: jest.fn() }) }));
jest.mock('../../utils/imageQuality', () => ({ inspectProductImage: async () => null }));
jest.mock('../../services/imageCompression', () => ({
  PHOTO_SOURCE_MAX_BYTES: 20 * 1024 * 1024,
  compressImageFile: async (file) => file,
  isSupportedImageFile: (file) => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type),
}));
jest.mock('../../utils/catalogOptions', () => ({ fetchCategories: async () => [{ _id: 'cat', name: 'Sarees' }], fetchSubcategories: async () => [] }));

let mockQuery;
let mockSave;
let mockArchive;
let mockRestore;
let mockDelete;
let mockPublish;
let mockUpload;
jest.mock('../../store/apiSlice', () => ({
  useGetProductDraftsQuery: () => mockQuery,
  useUpdateProductDraftMutation: () => [mockSave, { isLoading: false }],
  useArchiveProductDraftMutation: () => [mockArchive, { isLoading: false }],
  useRestoreProductDraftMutation: () => [mockRestore, { isLoading: false }],
  useDeleteProductDraftMutation: () => [mockDelete, { isLoading: false }],
  usePublishSelectedDraftsMutation: () => [mockPublish, { isLoading: false }],
  useBulkUploadProductDraftsMutation: () => [mockUpload, { isLoading: false }],
}));

const draft = {
  _id: 'draft-a', name: 'Rose saree', category: { _id: 'cat', name: 'Sarees' },
  price: 1000, sellingPrice: 1000, originalPrice: 1200, stock: 2,
  sizes: [], colors: [], images: [{ url: '/uploads/a.jpg', primary: true }],
  sizingMode: 'free-size', revision: 2, status: 'draft', updatedAt: '2026-09-10T10:00:00.000Z',
  readiness: { state: 'review', score: 87, issues: [], warnings: ['Add packed weight'] },
};

test('photo draft editor keeps sale and rental prices separate', async () => {
  render(<ProductDrafts route="/admin/product-drafts" />);
  fireEvent.click((await screen.findAllByRole('button', { name: 'Review' }))[0]);
  fireEvent.change(screen.getByLabelText('Available for'), { target: { value: 'SALE_AND_RENTAL' } });
  fireEvent.change(screen.getByLabelText('Rental price per day (₹)'), { target: { value: '600' } });
  expect(screen.getByLabelText(/Selling price/)).toHaveValue(1000);
  expect(screen.getByLabelText('Rental price per day (₹)')).toHaveValue(600);
  expect(normalizeDraftBody({ ...draft, commerceMode: 'SALE_AND_RENTAL', rentalPricing: { dailyRatePaise: 60000, depositPaise: 100000 } })).toEqual(expect.objectContaining({ price: 1000, rentalPricing: { dailyRatePaise: 60000, depositPaise: 100000 } }));
});

test('draft commerce options stay visible in Inventory and blank sizes publish as Free Size', async () => {
  render(<ProductDrafts />);
  fireEvent.click((await screen.findAllByRole('button', { name: 'Review' }))[0]);
  fireEvent.change(screen.getByLabelText('Available for'), { target: { value: 'SALE_AND_RENTAL' } });
  fireEvent.change(screen.getByLabelText('Rental price per day (₹)'), { target: { value: '500' } });
  fireEvent.click(screen.getByRole('button', { name: 'Inventory' }));
  expect(screen.getByLabelText('Available for')).toHaveValue('SALE_AND_RENTAL');
  const sizes = screen.getByLabelText('Available sizes');
  expect(sizes).toHaveValue(''); expect(sizes).not.toBeRequired();
  fireEvent.change(screen.getByLabelText('Sizing mode'), { target: { value: 'sized' } });
  expect(screen.queryByLabelText('M Bust')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Save & publish' }));
  await waitFor(() => expect(mockPublish).toHaveBeenCalledWith({ ids: ['draft-a'], apiPrefix: '/admin' }));
  expect(mockSave.mock.calls[0][0].body).toMatchObject({ commerceMode: 'SALE_AND_RENTAL', sellingPrice: 1000, rentalPricing: { dailyRatePaise: 50000 }, sizingMode: 'free-size', sizes: [], sizeChart: { rows: [] } });
});

test('draft sizes can be entered manually even when shop sizing is disabled and clearing them preserves stock', async () => {
  render(<ProductDrafts />);
  fireEvent.click((await screen.findAllByRole('button', { name: 'Review' }))[0]);
  fireEvent.click(screen.getByRole('button', { name: 'Inventory' }));
  fireEvent.change(screen.getByLabelText('Available sizes'), { target: { value: 'M' } });
  expect(screen.getByLabelText('Sizing mode')).toHaveValue('sized');
  expect(screen.getByLabelText('M Bust')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
  await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1));
  expect(mockSave.mock.calls[0][0].body).toMatchObject({ sizes: ['M'], sizingMode: 'sized', stock: 2 });
  fireEvent.change(screen.getByLabelText('Available sizes'), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
  await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(2));
  expect(mockSave.mock.calls[1][0].body).toMatchObject({ sizes: [], sizingMode: 'free-size', stock: 2 });
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(window, 'confirm').mockReturnValue(true);
  localStorage.clear();
  api.get.mockResolvedValue({ features: { sizing: false }, attributes: [] });
  mockQuery = {
    data: { data: [draft, { ...draft, _id: 'draft-b', name: 'Green saree' }], meta: { page: 1, total: 2, totalPages: 1, summary: { draft: 2, published: 0, archived: 0, incomplete: 0, ready: 0, review: 2 } } },
    isLoading: false, isFetching: false, refetch: jest.fn(),
  };
  mockSave = jest.fn(({ body }) => ({ unwrap: async () => ({ success: true, data: { ...body, _id: 'draft-a', revision: 3 } }) }));
  mockArchive = jest.fn(() => ({ unwrap: async () => ({ success: true }) }));
  mockRestore = jest.fn(() => ({ unwrap: async () => ({ success: true }) }));
  mockDelete = jest.fn(() => ({ unwrap: async () => ({ success: true }) }));
  mockPublish = jest.fn(() => ({ unwrap: async () => ({ success: true, message: 'Selected drafts published successfully', data: { results: [{ id: 'draft-a', status: 'published' }] } }) }));
  mockUpload = jest.fn(() => ({ unwrap: async () => ({ success: true, data: { drafts: [{}] } }) }));
});
afterEach(() => jest.restoreAllMocks());

test.each(['/admin/product-drafts', '/seller/product-drafts'])('selected draft Smart Fill runs and saves the whole batch on %s', async route => {
  const prefix = route.startsWith('/seller') ? '/seller' : '/admin';
  const all = mockQuery.data.data;
  api.get.mockImplementation(async path => path.endsWith('/smart-fill/status') ? { enabled: true, maxPhotos: 6, requestIntervalMs: 0 }
    : path.includes('/product-drafts/') ? { data: all.find(item => path.endsWith(item._id)) } : { industry: 'boutique', features: { sizing: false }, attributes: [] });
  api.post.mockResolvedValue({ suggestion: { name: 'Suggested product name', description: 'Visible embroidery' }, analysisStatus: 'completed', warnings: [] });
  render(<ProductDrafts route={route} />);
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Select page' }));
  const open = screen.getByRole('button', { name: 'Smart Fill selected' });
  await waitFor(() => expect(open).toBeEnabled()); fireEvent.click(open);
  const run = screen.getByRole('button', { name: 'Run Smart Fill for 2 drafts' });
  await waitFor(() => expect(run).toBeEnabled()); fireEvent.click(run);
  await screen.findByText('2/2 products analysed · 0 saved');
  expect(mockSave).not.toHaveBeenCalled();
  expect(api.post.mock.calls.map(call => call[0])).toEqual([`${prefix}/products/smart-fill`, `${prefix}/products/smart-fill`]);
  expect(screen.getByRole('button', { name: 'Publish selected' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Save selected details for 2 drafts' }));
  await screen.findByText('2/2 products analysed · 2 saved');
  expect(mockSave.mock.calls.map(call => call[0].id)).toEqual(['draft-a', 'draft-b']);
  expect(mockSave.mock.calls[0][0]).toMatchObject({ apiPrefix: prefix, body: { name: 'Rose saree', sellingPrice: 1000, baseRevision: 2, saveMode: 'auto', description: 'Visible embroidery' } });
  expect(mockQuery.refetch).toHaveBeenCalled();
});

test('selection across pages supports more than 24 drafts and deselecting a page preserves other pages', async () => {
  const all = Array.from({ length: 30 }, (_, index) => ({ ...draft, _id: `page-draft-${index}`, name: `Page product ${index}` }));
  mockQuery.data = { data: all.slice(0, 24), meta: { page: 1, total: 30, totalPages: 2 } };
  const view = render(<ProductDrafts />);
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Select page' }));
  expect(screen.getByText('24 selected')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  mockQuery = { ...mockQuery, data: { data: all.slice(24), meta: { page: 2, total: 30, totalPages: 2 } } };
  view.rerender(<ProductDrafts />);
  expect(screen.getByText('24 selected')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select page' }));
  expect(screen.getByText('30 selected')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select page' }));
  expect(screen.getByText('24 selected')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select page' }));
  const open = screen.getByRole('button', { name: 'Smart Fill selected' });
  await waitFor(() => expect(open).toBeEnabled()); fireEvent.click(open);
  expect(screen.getAllByRole('article', { name: /Smart Fill product/ })).toHaveLength(30);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Run Smart Fill for 30 drafts' })).toBeEnabled());
});

test('category assignment includes selected drafts from earlier pages', async () => {
  const first = mockQuery.data.data;
  const view = render(<ProductDrafts />);
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Select page' }));
  mockQuery = { ...mockQuery, data: { data: [{ ...draft, _id: 'draft-c', name: 'Another product' }], meta: { page: 1, total: 3, totalPages: 2 } } };
  view.rerender(<ProductDrafts />);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select page' }));
  fireEvent.change(screen.getByLabelText('Category for selected drafts'), { target: { value: 'cat' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
  await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(3));
  expect(mockSave.mock.calls.map(call => call[0].id)).toEqual([...first.map(item => item._id), 'draft-c']);
});

test('30 newly uploaded product drafts are offered as one batch even when the list shows only the first page', async () => {
  URL.createObjectURL = jest.fn(() => 'blob:batch-preview'); URL.revokeObjectURL = jest.fn();
  const created = Array.from({ length: 30 }, (_, index) => ({ ...draft, _id: `new-${index}`, name: `Uploaded product ${index}` }));
  mockUpload.mockImplementation(() => ({ unwrap: async () => ({ data: { drafts: created } }) }));
  render(<ProductDrafts />);
  fireEvent.click(await screen.findByRole('button', { name: 'Create from photos' }));
  fireEvent.click(screen.getByRole('radio', { name: /One draft per photo/ }));
  fireEvent.change(screen.getByLabelText('Choose product photos'), { target: { files: Array.from({ length: 30 }, (_, index) => new File(['photo'], `item-${index}.webp`, { type: 'image/webp' })) } });
  fireEvent.click(screen.getByRole('button', { name: 'Create 30 drafts' }));
  const run = await screen.findByRole('button', { name: 'Run Smart Fill for 30 drafts' });
  await waitFor(() => expect(run).toBeEnabled());
  expect(screen.getByText('30 selected')).toBeInTheDocument();
  expect(screen.getAllByRole('article', { name: /Smart Fill product/ })).toHaveLength(30);
  expect(api.post).not.toHaveBeenCalled();
});

test('creates three drafts from product photo groups with 4, 6 and 2 views', async () => {
  URL.createObjectURL = jest.fn(() => 'blob:photo-preview');
  URL.revokeObjectURL = jest.fn();
  mockQuery.data.meta.photoGrouping = { version: 1, maxPhotos: 30 };
  mockUpload.mockImplementation(() => ({ unwrap: async () => ({ success: true, data: { drafts: [{}, {}, {}] } }) }));
  render(<ProductDrafts />);
  fireEvent.click(await screen.findByRole('button', { name: 'Create from photos' }));
  fireEvent.click(screen.getByRole('radio', { name: /Several products, grouped photos/ }));
  const photos = Array.from({ length: 12 }, (_, index) => new File([`photo-${index}`], `photo-${index}.webp`, { type: 'image/webp' }));
  fireEvent.change(screen.getByLabelText('Choose product photos'), { target: { files: photos } });
  for (const [start, count] of [[0, 4], [4, 6], [10, 2]]) {
    for (let index = start; index < start + count; index += 1) fireEvent.click(screen.getByRole('checkbox', { name: `Select photo ${index + 1}: photo-${index}.webp` }));
    fireEvent.click(screen.getByRole('button', { name: 'Create product group' }));
  }
  expect(screen.getByRole('region', { name: 'Product group 1' })).toHaveTextContent('4 photos');
  expect(screen.getByRole('region', { name: 'Product group 2' })).toHaveTextContent('6 photos');
  expect(screen.getByRole('region', { name: 'Product group 3' })).toHaveTextContent('2 photos');
  fireEvent.change(screen.getByLabelText('Product name for group 1'), { target: { value: 'Red lehenga' } });
  const secondPhoto = screen.getByLabelText('Select photo 2: photo-1.webp').closest('figure');
  fireEvent.click(within(secondPhoto).getByRole('button', { name: 'Make cover' }));
  fireEvent.click(screen.getByRole('button', { name: 'Create 3 drafts' }));
  await waitFor(() => expect(mockUpload).toHaveBeenCalledWith({ files: photos, groupMode: 'grouped', apiPrefix: '/admin', photoGroups: [
    { name: 'Red lehenga', photoIndexes: [0, 1, 2, 3], coverIndex: 1 },
    { name: '', photoIndexes: [4, 5, 6, 7, 8, 9], coverIndex: 4 },
    { name: '', photoIndexes: [10, 11], coverIndex: 10 },
  ] }));
  expect(await screen.findByText('3 product drafts created.')).toBeInTheDocument();
});

test('removing a photo preserves other assignments and a failed grouped upload can retry', async () => {
  URL.createObjectURL = jest.fn(() => 'blob:photo-preview'); URL.revokeObjectURL = jest.fn();
  mockQuery.data.meta.photoGrouping = { version: 1 };
  mockUpload.mockImplementationOnce(() => ({ unwrap: async () => { throw new Error('Network interrupted'); } }));
  render(<ProductDrafts route="/seller/product-drafts" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Create from photos' }));
  fireEvent.click(screen.getByRole('radio', { name: /Several products, grouped photos/ }));
  const photos = Array.from({ length: 3 }, (_, index) => new File(['photo'], `view-${index}.webp`, { type: 'image/webp' }));
  fireEvent.change(screen.getByLabelText('Choose product photos'), { target: { files: photos } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select photo 1: view-0.webp' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select photo 2: view-1.webp' }));
  fireEvent.click(screen.getByRole('button', { name: 'Create product group' }));
  expect(screen.getByRole('button', { name: 'Create one draft' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Remove photo 1: view-0.webp' }));
  fireEvent.change(screen.getByLabelText('Product group for photo 2: view-2.webp'), { target: { value: screen.getByLabelText('Product group for photo 1: view-1.webp').value } });
  fireEvent.click(screen.getByRole('button', { name: 'Create one draft' }));
  await screen.findByText('Network interrupted');
  expect(screen.getByRole('region', { name: 'Product group 1' })).toHaveTextContent('2 photos');
  fireEvent.click(screen.getByRole('button', { name: 'Create one draft' }));
  await waitFor(() => expect(mockUpload).toHaveBeenCalledTimes(2));
  expect(mockUpload.mock.calls[0][0]).toEqual(mockUpload.mock.calls[1][0]);
  expect(mockUpload.mock.calls[1][0]).toMatchObject({ apiPrefix: '/seller', files: [photos[1], photos[2]], photoGroups: [{ photoIndexes: [0, 1], coverIndex: 0 }] });
});

test('grouped uploads stay unavailable when the server has not advertised support', async () => {
  render(<ProductDrafts />);
  fireEvent.click(await screen.findByRole('button', { name: 'Create from photos' }));
  expect(screen.getByRole('radio', { name: /Several products, grouped photos/ })).toBeDisabled();
  expect(screen.getByRole('radio', { name: /One product, multiple photos/ })).toBeEnabled();
  expect(screen.getByRole('radio', { name: /One draft per photo/ })).toBeEnabled();
});

test.each(['/admin/product-drafts', '/seller/product-drafts'])('adds multiple photos to an existing draft from its card on %s', async (route) => {
  const original = { url: '/uploads/a.jpg', publicId: 'original', primary: true, sourceFrame: { viewType: 'front' } };
  mockQuery.data.data = [{ ...draft, images: [original] }];
  api.upload.mockResolvedValue({ files: [
    { url: '/uploads/back.webp', publicId: 'back' },
    { url: '/uploads/detail.webp', publicId: 'detail' },
  ] });
  render(<ProductDrafts route={route} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Add photos' }));
  const editor = within(screen.getByRole('dialog'));
  expect(editor.getByRole('button', { name: /Photos & video/ })).toHaveAttribute('aria-current', 'page');
  expect(editor.getByText('1 / 30 photos')).toBeInTheDocument();
  expect(editor.getByLabelText('Add photos to this draft')).toHaveAttribute('multiple');
  fireEvent.change(editor.getByLabelText('Add photos to this draft'), { target: { files: [
    new File(['back'], 'back.webp', { type: 'image/webp' }),
    new File(['detail'], 'detail.webp', { type: 'image/webp' }),
  ] } });
  await editor.findByText('3 / 30 photos');
  expect(api.upload.mock.calls[0][0]).toBe(`${route.startsWith('/seller') ? '/seller' : '/admin'}/uploads?folder=products`);
  expect(api.upload.mock.calls[0][1]).toHaveLength(2);
  expect(mockUpload).not.toHaveBeenCalled();
  fireEvent.click(editor.getAllByRole('button', { name: 'Main' })[1]);
  fireEvent.click(editor.getByRole('button', { name: 'Move image 2 earlier' }));
  fireEvent.click(editor.getAllByRole('button', { name: 'Remove' })[2]);
  fireEvent.click(editor.getByRole('button', { name: 'Save draft' }));
  await waitFor(() => expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({
    id: 'draft-a', apiPrefix: route.startsWith('/seller') ? '/seller' : '/admin',
    body: expect.objectContaining({ image: '/uploads/back.webp', baseRevision: 2, images: [
      expect.objectContaining({ url: '/uploads/back.webp', publicId: 'back', primary: true }),
      { ...original, primary: false },
    ] }),
  })));
});

test('keeps a pending photo upload in the editor until it completes', async () => {
  let finishUpload;
  api.upload.mockImplementation(() => new Promise((resolve) => { finishUpload = resolve; }));
  render(<ProductDrafts />);
  fireEvent.click((await screen.findAllByRole('button', { name: 'Add photos' }))[0]);
  const editor = within(screen.getByRole('dialog'));
  fireEvent.change(editor.getByLabelText('Add photos to this draft'), { target: { files: [new File(['photo'], 'new.webp', { type: 'image/webp' })] } });
  await waitFor(() => expect(api.upload).toHaveBeenCalledTimes(1));
  expect(editor.getByRole('button', { name: 'Close draft editor' })).toBeDisabled();
  expect(editor.getByRole('button', { name: 'Basics' })).toBeDisabled();
  expect(editor.getByRole('button', { name: 'Save draft' })).toBeDisabled();
  expect(editor.getByRole('button', { name: 'Save & publish' })).toBeDisabled();
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(mockSave).not.toHaveBeenCalled();
  expect(mockPublish).not.toHaveBeenCalled();
  await act(async () => finishUpload({ files: [{ url: '/uploads/new.webp' }] }));
  expect(editor.getByText('2 / 30 photos')).toBeInTheDocument();
  expect(editor.getByRole('button', { name: 'Close draft editor' })).toBeEnabled();
  expect(editor.getByRole('button', { name: 'Save draft' })).toBeEnabled();
});

test('a failed photo batch can be retried after changing tabs without replacing the existing cover', async () => {
  api.upload.mockRejectedValueOnce(new Error('Network interrupted')).mockResolvedValue({ files: [{ url: '/uploads/retry.webp' }] });
  render(<ProductDrafts />);
  fireEvent.click((await screen.findAllByRole('button', { name: 'Add photos' }))[0]);
  const editor = within(screen.getByRole('dialog'));
  const photo = new File(['photo'], 'retry.webp', { type: 'image/webp' });
  fireEvent.change(editor.getByLabelText('Add photos to this draft'), { target: { files: [photo] } });
  await editor.findByText('Network interrupted');
  expect(editor.getByText('1 / 30 photos')).toBeInTheDocument();
  expect(editor.getByRole('button', { name: 'Save draft' })).toBeDisabled();
  fireEvent.click(editor.getByRole('button', { name: 'Basics' }));
  fireEvent.click(editor.getByRole('button', { name: /Photos & video/ }));
  fireEvent.change(editor.getByLabelText('Add photos to this draft'), { target: { files: [photo] } });
  await editor.findByText('2 / 30 photos');
  expect(api.upload.mock.calls[0][2].idempotencyKey).toBe(api.upload.mock.calls[1][2].idempotencyKey);
  fireEvent.click(editor.getByRole('button', { name: 'Save draft' }));
  await waitFor(() => expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ body: expect.objectContaining({
    image: '/uploads/a.jpg', images: [
      expect.objectContaining({ url: '/uploads/a.jpg', primary: true }),
      expect.objectContaining({ url: '/uploads/retry.webp', primary: false }),
    ],
  }) })));
});

test('draft galleries larger than twelve photos can still receive more photos', async () => {
  mockQuery.data.data = [{ ...draft, images: Array.from({ length: 15 }, (_, index) => ({ url: `/uploads/${index}.jpg`, primary: index === 4 })) }];
  api.upload.mockResolvedValue({ files: [{ url: '/uploads/extra.webp' }] });
  render(<ProductDrafts />);
  fireEvent.click(await screen.findByRole('button', { name: 'Add photos' }));
  const editor = within(screen.getByRole('dialog'));
  fireEvent.change(editor.getByLabelText('Add photos to this draft'), { target: { files: [new File(['photo'], 'extra.webp', { type: 'image/webp' })] } });
  await editor.findByText('16 / 30 photos');
  fireEvent.click(editor.getByRole('button', { name: 'Save draft' }));
  await waitFor(() => expect(mockSave).toHaveBeenCalled());
  expect(mockSave.mock.calls[0][0].body.images).toHaveLength(16);
  expect(mockSave.mock.calls[0][0].body.image).toBe('/uploads/4.jpg');
});

test('rejects a photo batch beyond the draft limit without dropping any saved photos', async () => {
  mockQuery.data.data = [{ ...draft, images: Array.from({ length: 29 }, (_, index) => ({ url: `/uploads/${index}.jpg`, primary: index === 0 })) }];
  render(<ProductDrafts />);
  fireEvent.click(await screen.findByRole('button', { name: 'Add photos' }));
  const editor = within(screen.getByRole('dialog'));
  fireEvent.change(editor.getByLabelText('Add photos to this draft'), { target: { files: [
    new File(['photo'], 'front.webp', { type: 'image/webp' }),
    new File(['photo'], 'back.webp', { type: 'image/webp' }),
  ] } });
  expect(editor.getByRole('alert')).toHaveTextContent('Maximum 30 images allowed');
  expect(editor.getByText('29 / 30 photos')).toBeInTheDocument();
  expect(api.upload).not.toHaveBeenCalled();
  expect(mockSave).not.toHaveBeenCalled();
});

test('removing all draft photos does not restore a previously saved cover', async () => {
  mockQuery.data.data = [{ ...draft, images: [], image: '/uploads/legacy.jpg' }];
  render(<ProductDrafts />);
  fireEvent.click(await screen.findByRole('button', { name: 'Add photos' }));
  const editor = within(screen.getByRole('dialog'));
  fireEvent.click(editor.getByRole('button', { name: 'Remove' }));
  expect(editor.getByText('0 / 30 photos')).toBeInTheDocument();
  fireEvent.click(editor.getByRole('button', { name: 'Save draft' }));
  await waitFor(() => expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ body: expect.objectContaining({ image: '', images: [] }) })));
});

test('keeps legacy draft photos and normalizes a single cover without dropping photo metadata', () => {
  expect(normalizeDraftBody({ ...draft, images: [], image: '/uploads/legacy.jpg' }).images).toEqual([{ url: '/uploads/legacy.jpg', primary: true }]);
  const body = normalizeDraftBody({ ...draft, images: ['/uploads/string.jpg', { url: '/uploads/cover.jpg', publicId: 'cover', primary: true }, { url: '/uploads/other.jpg', primary: true }] });
  expect(body.image).toBe('/uploads/cover.jpg');
  expect(body.images.filter((photo) => photo.primary)).toHaveLength(1);
  expect(body.images[1].publicId).toBe('cover');
  expect(normalizeDraftBody({ ...draft, images: [], image: '' }).images).toEqual([]);
});

test('opens a focused editor, applies reviewed Smart Fill values, and saves with revision protection', async () => {
  mockQuery.data.data = [{ ...draft, name: '', price: 0, sellingPrice: 0 }];
  api.post.mockResolvedValue({ mode: 'notes', suggestion: { name: 'Wine saree', price: 899, description: 'Wine saree with a floral border.' }, fieldSources: { price: { source: 'caption', quote: 'Price 899' } } });
  render(<ProductDrafts />);
  fireEvent.click((await screen.findAllByRole('button', { name: 'Review' }))[0]);
  fireEvent.click(screen.getByRole('button', { name: /Smart fill/i }));
  fireEvent.change(screen.getByLabelText('Supplier notes or product details'), { target: { value: 'Name: Wine saree\nPrice: 899' } });
  fireEvent.click(screen.getByRole('button', { name: 'Suggest details' }));
  await screen.findByText('Review suggestions');
  fireEvent.click(screen.getByRole('button', { name: /Apply \d+ selected details?/ }));
  expect(screen.getByLabelText(/Product name/)).toHaveValue('Wine saree');
  fireEvent.click(screen.getByRole('button', { name: /Save draft/i }));
  await waitFor(() => expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({
    id: 'draft-a', apiPrefix: '/admin', body: expect.objectContaining({ name: 'Wine saree', sellingPrice: 899, baseRevision: 2 }),
  })));
});

test('bulk selection publishes through the structured batch endpoint and keeps failed rows selected', async () => {
  mockPublish.mockImplementation(() => ({ unwrap: async () => ({ success: true, message: '1 draft published; 1 needs attention.', data: { results: [{ id: 'draft-a', status: 'published' }, { id: 'draft-b', status: 'failed', message: 'Add price' }] } }) }));
  render(<ProductDrafts />);
  const boxes = await screen.findAllByRole('checkbox', { name: /Select .*saree/ });
  fireEvent.click(boxes[0]); fireEvent.click(boxes[1]);
  fireEvent.click(screen.getByRole('button', { name: /Publish selected/ }));
  await waitFor(() => expect(mockPublish).toHaveBeenCalledWith({ ids: ['draft-a', 'draft-b'], apiPrefix: '/admin' }));
  expect(await screen.findByRole('status')).toHaveTextContent('1 draft published; 1 needs attention.');
  expect(boxes[0]).not.toBeChecked();
  expect(boxes[1]).toBeChecked();
});

test('archives an active draft instead of deleting it directly', async () => {
  render(<ProductDrafts />);
  const archiveButtons = await screen.findAllByRole('button', { name: 'Archive draft' });
  fireEvent.click(archiveButtons[0]);
  await waitFor(() => expect(mockArchive).toHaveBeenCalledWith({ id: 'draft-a', apiPrefix: '/admin' }));
  expect(screen.getByRole('status')).toHaveTextContent('Draft archived');
  expect(mockDelete).not.toHaveBeenCalled();
});

test('shows a stale-edit recovery action when another tab updated the draft', async () => {
  mockSave.mockImplementation(() => ({ unwrap: async () => { throw { data: { code: 'DRAFT_STALE', message: 'This draft changed in another tab.' } }; } }));
  render(<ProductDrafts />);
  fireEvent.click((await screen.findAllByRole('button', { name: 'Review' }))[0]);
  fireEvent.change(screen.getByLabelText(/Product name/), { target: { value: 'Changed name' } });
  fireEvent.click(screen.getByRole('button', { name: /Save draft/i }));
  expect(await screen.findByRole('button', { name: 'Reload' })).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('This draft changed');
});

test('archived drafts require typed confirmation before permanent deletion', async () => {
  const archived = { ...draft, status: 'archived', readiness: { state: 'archived', score: 0, issues: [], warnings: [] } };
  mockQuery.data = { data: [archived], meta: { page: 1, total: 1, totalPages: 1, summary: { draft: 0, published: 0, archived: 1 } } };
  render(<ProductDrafts />);
  fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
  const confirmation = screen.getByLabelText(/Type Rose saree to confirm/);
  expect(screen.getByRole('button', { name: 'Delete permanently' })).toBeDisabled();
  fireEvent.change(confirmation, { target: { value: 'Rose saree' } });
  fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }));
  await waitFor(() => expect(mockDelete).toHaveBeenCalledWith({ id: 'draft-a', confirm: 'Rose saree', baseRevision: 2, apiPrefix: '/admin' }));
});

test('load errors keep retry available', async () => {
  mockQuery = { ...mockQuery, error: { data: { message: 'Draft database unavailable' } } };
  render(<ProductDrafts />);
  expect(screen.getByRole('alert')).toHaveTextContent('Draft database unavailable');
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(mockQuery.refetch).toHaveBeenCalledTimes(1);
  await screen.findByText('Rose saree');
});

test('draft queue count excludes published records and exposes separate published history', async () => {
  mockQuery.data.meta.summary = { draft: 2, published: 4, archived: 0 };
  render(<ProductDrafts />);
  expect(await screen.findByRole('button', { name: 'Draft queue 2' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Published history 4' }));
  expect(screen.getByRole('button', { name: 'Published history 4' })).toHaveClass('is-active');
});

test('published draft cleanup explains product safety and requires typed confirmation', async () => {
  mockQuery.data = { data: [{ ...draft, status: 'published', publishedProductId: 'product-a' }], meta: { summary: { published: 1 } } };
  render(<ProductDrafts />);
  expect(await screen.findByRole('link', { name: 'Edit product' })).toHaveAttribute('href', '/admin/products/edit?id=product-a');
  fireEvent.click(screen.getByRole('button', { name: 'Remove draft' }));
  expect(screen.getByRole('dialog')).toHaveTextContent('product, images and inventory remain unchanged');
  const button = screen.getByRole('button', { name: 'Delete permanently' });
  expect(button).toBeDisabled();
  fireEvent.change(screen.getByLabelText(/Type Rose saree to confirm/), { target: { value: draft.name } });
  fireEvent.click(button);
  await waitFor(() => expect(mockDelete).toHaveBeenCalledWith({ id: 'draft-a', confirm: draft.name, baseRevision: 2, apiPrefix: '/admin' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Its product is unchanged');
});

test('archived published draft history is also removable without restoring its product', async () => {
  mockQuery.data.data = [{ ...draft, status: 'archived', publishedProductId: 'product-a' }];
  render(<ProductDrafts />);
  expect(await screen.findByRole('button', { name: 'Delete' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(mockDelete).not.toHaveBeenCalled();
});

test('published history does not offer an edit link to a permanently deleted product', async () => {
  mockQuery.data.data = [{ ...draft, status: 'published', publishedProductId: 'product-a', publishedProductDeleted: true }];
  render(<ProductDrafts />);
  expect(await screen.findByText('Product permanently removed')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Edit product' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Remove draft' })).toBeEnabled();
});
