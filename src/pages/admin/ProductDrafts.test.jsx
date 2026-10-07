import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ProductDrafts, { normalizeDraftBody } from './ProductDrafts';
import api from '../../services/api';

jest.mock('../../services/api', () => ({ get: jest.fn(), post: jest.fn(), upload: jest.fn() }));
jest.mock('../../hooks/useDesktopFeedback', () => () => ({ notify: () => false }));
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ notify: jest.fn() }) }));
jest.mock('../../utils/imageQuality', () => ({ inspectProductImage: async () => null }));
jest.mock('../../services/imageCompression', () => ({
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
