import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import SocialProductImport from './SocialProductImport';
import api from '../../services/api';
import { fetchCategories } from '../../utils/catalogOptions';
jest.mock('../../services/api', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../../utils/catalogOptions', () => ({ ...jest.requireActual('../../utils/catalogOptions'), fetchCategories: jest.fn().mockResolvedValue([{ _id: 'category-1', name: 'Kurtis' }]) }));
const id = '0123456789abcdef01234567';
const ready = { _id: id, platform: 'instagram', status: 'ready', stage: 'Ready to review', sourceUrl: 'https://www.instagram.com/p/ABC/', createdAt: '2026-09-06T09:00:00.000Z', attempts: 1,
  images: [{ id: 'a', url: '/uploads/a.webp', kind: 'photo' }, { id: 'b', url: '/uploads/b.webp', kind: 'frame', timestamp: 2 }], videos: [],
  suggestion: { name: 'Wine Cotton Kurti', fabric: 'Cotton', colors: ['Wine'], price: 1299 }, warnings: ['Confirm stock.'], caption: 'Name: Wine Cotton Kurti' };
function defaults(path) {
  if (path === '/catalog-configuration') return Promise.resolve({ features: { sizing: true }, attributes: [] });
  if (path.endsWith('/capabilities')) return Promise.resolve({ enabled: true });
  if (path.includes('?page=')) return Promise.resolve({ items: [ready], page: 1, total: 1, totalPages: 1 });
  return Promise.resolve({ data: ready });
}
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function close() { this.removeAttribute('open'); };
});
beforeEach(() => { jest.clearAllMocks(); api.get.mockImplementation(defaults); api.post.mockReset(); fetchCategories.mockResolvedValue([{ _id: 'category-1', name: 'Kurtis' }]); });
test('deleted published products retain import history without a broken edit link or republish form', async () => {
  api.get.mockImplementation(path => path === '/admin/social-imports/' + id ? Promise.resolve({ data: { ...ready, publishedProductId: 'removed-product', publishedProductDeleted: true, draftRemoved: true } }) : defaults(path));
  render(<SocialProductImport route={'/admin/social-import?id=' + id} />);
  expect(await screen.findByRole('heading', { name: 'Published product removed' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /Edit product/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Publish product' })).not.toBeInTheDocument();
});
test('pasting a link starts the backend import and opens the actual review without publishing', async () => {
  const navigate = jest.fn(); api.post.mockResolvedValue({ success: true, data: ready });
  render(<SocialProductImport navigate={navigate} />);
  fireEvent.change(screen.getByLabelText('Instagram or Facebook post link'), { target: { value: ready.sourceUrl } });
  fireEvent.click(screen.getByRole('button', { name: 'Import product' }));
  expect(await screen.findByDisplayValue('Wine Cotton Kurti')).toBeInTheDocument();
  expect(api.post).toHaveBeenCalledWith('/admin/social-imports', { url: ready.sourceUrl });
  expect(navigate).toHaveBeenCalledWith('/admin/social-import?id=' + id);
  expect(api.post.mock.calls.every(([path]) => !path.includes('/products') && !path.includes('publish'))).toBe(true);
});
test('rejects unsupported sources before sending an import request', async () => {
  render(<SocialProductImport />);
  fireEvent.change(screen.getByLabelText('Instagram or Facebook post link'), { target: { value: 'https://instagram.com.evil.test/p/1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Import product' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Use an Instagram or Facebook');
  expect(api.post).not.toHaveBeenCalled();
});
test('gallery selection and cover choice are saved with edited details as a draft', async () => {
  api.post.mockResolvedValue({ success: true, draftId: 'draft-1' });
  render(<SocialProductImport route={'/admin/social-import?id=' + id} />);
  await screen.findByDisplayValue('Wine Cotton Kurti');
  expect(screen.getByLabelText('Stock quantity')).toHaveValue(null);
  fireEvent.change(screen.getByLabelText('Product name *'), { target: { value: 'Edited Product Name' } });
  fireEvent.change(screen.getByLabelText('Stock quantity'), { target: { value: '12' } });
  fireEvent.click(screen.getByLabelText('Select photo 1'));
  fireEvent.click(screen.getByRole('button', { name: 'Save for later' }));
  await screen.findByText(/Your product draft is saved/);
  expect(api.post).toHaveBeenCalledWith(`/admin/social-imports/${id}/review`, expect.objectContaining({ name: 'Edited Product Name', stock: '12', imageIds: ['b'], primaryImageId: 'b' }));
  expect(screen.getByRole('button', { name: 'Publish product' })).toBeEnabled();
  expect(screen.getByDisplayValue('Edited Product Name')).toBeInTheDocument();
});
test('no selected photos or invalid stock prevents saving', async () => {
  render(<SocialProductImport route={'/admin/social-import?id=' + id} />); await screen.findByDisplayValue('Wine Cotton Kurti');
  fireEvent.click(screen.getByLabelText('Select photo 1')); fireEvent.click(screen.getByLabelText('Select photo 2'));
  fireEvent.click(screen.getByRole('button', { name: 'Save for later' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Select at least one product photo');
  expect(api.post).not.toHaveBeenCalled();
});
test('a rejected draft save preserves the review and edits for retry', async () => {
  api.post.mockRejectedValue(new Error('Could not save draft'));
  render(<SocialProductImport route={'/admin/social-import?id=' + id} />); await screen.findByDisplayValue('Wine Cotton Kurti');
  fireEvent.click(screen.getByRole('button', { name: 'Save for later' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save draft');
  expect(screen.getByDisplayValue('Wine Cotton Kurti')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save for later' })).toBeEnabled();
});
test('photo previews open in a dialog with next/previous controls and close cleanly', async () => {
  render(<SocialProductImport route={'/admin/social-import?id=' + id} />); await screen.findByDisplayValue('Wine Cotton Kurti');
  fireEvent.click(screen.getByRole('button', { name: 'Preview photo 1' }));
  const dialog = screen.getByRole('dialog', { name: 'Product photo preview' });
  expect(within(dialog).getByRole('button', { name: 'Previous photo' })).toBeDisabled();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Next photo' }));
  expect(within(dialog).getByText('Photo 2 of 2')).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close photo preview' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
test('failed imports explain the source problem and provide retry and upload alternatives', async () => {
  api.get.mockImplementation((path) => path.endsWith('/' + id) ? Promise.resolve({ data: { ...ready, status: 'failed', error: 'Post is unavailable', draftId: undefined } }) : defaults(path));
  api.post.mockResolvedValue({ data: { ...ready, status: 'queued' } });
  render(<SocialProductImport route={'/admin/social-import?id=' + id} />);
  expect(await screen.findByText('Post is unavailable')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Upload photos' })).toHaveAttribute('href', '/admin/products/quick-add');
  fireEvent.click(screen.getByRole('button', { name: 'Retry import' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith(`/admin/social-imports/${id}/retry`, {}));
});
test('duplicate links open the original import rather than pretending to create another', async () => {
  api.post.mockResolvedValue({ duplicate: true, data: ready });
  render(<SocialProductImport />);
  fireEvent.change(screen.getByLabelText('Instagram or Facebook post link'), { target: { value: ready.sourceUrl } });
  fireEvent.click(screen.getByRole('button', { name: 'Import product' }));
  expect(await screen.findByText(/This link is already in your imports/)).toBeInTheDocument();
});
test('an in-flight import response cannot replace a different history selection', async () => {
  let resolveOld; const newer = { ...ready, _id: '0123456789abcdef01234568', suggestion: { name: 'New selection' } };
  api.get.mockImplementation((path) => path.endsWith('/' + id) ? new Promise((resolve) => { resolveOld = resolve; }) : path.includes('?page=') ? Promise.resolve({ items: [newer] }) : path.endsWith('/' + newer._id) ? Promise.resolve({ data: newer }) : defaults(path));
  render(<SocialProductImport route={'/admin/social-import?id=' + id} />);
  fireEvent.click(await screen.findByRole('button', { name: /Open instagram import/ }));
  await screen.findByDisplayValue('New selection');
  await act(async () => { resolveOld({ data: ready }); });
  expect(screen.queryByDisplayValue('Wine Cotton Kurti')).not.toBeInTheDocument();
});

test('opening a history summary loads every photo and the full suggested product details', async () => {
  const summary = { ...ready, images: ready.images.slice(0, 1), suggestion: undefined, caption: undefined, videos: undefined };
  let resolveDetails;
  api.get.mockImplementation((path) => path.includes('?page=') ? Promise.resolve({ items: [summary] }) : path.endsWith('/' + id) ? new Promise((resolve) => { resolveDetails = resolve; }) : defaults(path));
  render(<SocialProductImport />);
  fireEvent.click(await screen.findByRole('button', { name: /Open instagram import/ }));
  expect(screen.queryByLabelText('Product name *')).not.toBeInTheDocument();
  await act(async () => { resolveDetails({ data: ready }); });
  expect(screen.getByDisplayValue('Wine Cotton Kurti')).toBeInTheDocument();
  expect(screen.getByText('2 of 2 selected · Set the cover photo')).toBeInTheDocument();
});

test('quality recommendations choose the best cover, preserve alternatives, and save a confirmed view', async () => {
  const quality = { ...ready, images: [
    { ...ready.images[0], recommended:false, kind:'frame', selectionVersion:'quality-v1', qualityScore:.65 },
    { ...ready.images[1], recommended:true, recommendedCover:true, selectionVersion:'quality-v1', qualityScore:.9, viewType:'front' },
  ], frameSelections:[{analyzedFrames:40,rejectedFrames:12,duplicateFrames:8}] };
  api.get.mockImplementation((path) => path.endsWith('/'+id) ? Promise.resolve({data:quality}) : defaults(path));
  api.post.mockResolvedValue({success:true,draftId:'quality-draft'});
  render(<SocialProductImport route={'/admin/social-import?id='+id} />);
  await screen.findByDisplayValue('Wine Cotton Kurti');
  expect(screen.getByLabelText('Select photo 1')).not.toBeChecked();
  expect(screen.getByLabelText('Select photo 2')).toBeChecked();
  expect(screen.getByText(/Checked 40 video moments/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Select all'}));
  fireEvent.click(screen.getByRole('button',{name:'Use recommended photos'}));
  expect(screen.getByLabelText('Select photo 1')).not.toBeChecked();
  fireEvent.change(screen.getByLabelText('View for photo 2'),{target:{value:'side'}});
  fireEvent.click(screen.getByRole('button',{name:'Save for later'}));
  await screen.findByText(/Your product draft is saved/);
  expect(api.post).toHaveBeenCalledWith(`/admin/social-imports/${id}/review`,expect.objectContaining({imageIds:['b'],primaryImageId:'b',viewTypes:{a:'unknown',b:'side'}}));
});

test('a filled product needs only stock and publishes directly without opening drafts', async () => {
  const filled = { ...ready, suggestion: { ...ready.suggestion, name: 'Wine Cotton Saree', category: 'category-1', sizingMode: 'free-size', description: 'A wine cotton saree.', fieldSources: { price: { source: 'speech', quote: 'Price is 1299 rupees', timestampSeconds: 4 } } } };
  api.get.mockImplementation((path) => path.endsWith('/' + id) ? Promise.resolve({ data: filled }) : defaults(path));
  api.post.mockResolvedValue({ success: true, draftId: 'draft', productId: 'product', data: { ...filled, draftId: 'draft', publishedProductId: 'product' } });
  render(<SocialProductImport route={'/admin/social-import?id=' + id} />);
  await screen.findByDisplayValue('Wine Cotton Saree');
  expect(screen.getByText('1 essential detail needs your input')).toBeInTheDocument();
  expect(screen.getByLabelText('Selling price (₹)')).toHaveValue(1299);
  expect(screen.getByText(/Found in reel audio at 4.0s/)).toBeInTheDocument();
  expect(screen.getByLabelText('Description')).not.toBeVisible();
  fireEvent.change(screen.getByLabelText('Stock quantity'), { target: { value: '5' } });
  fireEvent.click(screen.getByRole('button', { name: 'Publish product' }));
  await screen.findByText('Your product is published');
  expect(api.post).toHaveBeenCalledWith(`/admin/social-imports/${id}/publish`, expect.objectContaining({ price: 1299, stock: '5', category: 'category-1' }));
  expect(screen.getByRole('link', { name: /Edit product/ })).toHaveAttribute('href', '/admin/products/edit?id=product');
});

test('publishing lists missing essentials instead of silently inventing inventory or sizing', async () => {
  render(<SocialProductImport route={'/admin/social-import?id=' + id} />);
  await screen.findByDisplayValue('Wine Cotton Kurti');
  fireEvent.click(screen.getByRole('button', { name: 'Publish product' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Complete before publishing: Category, Stock quantity.');
  expect(api.post).not.toHaveBeenCalled();
});

test('saved review resumes with later edits and its revision, including additional photos', async () => {
  const resumed = { ...ready, draftId: 'draft', images: [...ready.images, { id: 'c', url: '/uploads/extra.jpg' }], savedReview: { name: 'Manually edited saree', category: 'category-1', price: 1599, stock: 7, sizingMode: 'free-size', imageIds: ['b', 'c'], primaryImageId: 'c', draftUpdatedAt: '2026-09-07T00:00:00Z' } };
  api.get.mockImplementation((path) => path.endsWith('/' + id) ? Promise.resolve({ data: resumed }) : defaults(path));
  api.post.mockRejectedValue(new Error('This draft changed in another screen. Reload this import.'));
  render(<SocialProductImport route={'/admin/social-import?id=' + id} />);
  await screen.findByDisplayValue('Manually edited saree');
  expect(screen.getByLabelText('Selling price (₹)')).toHaveValue(1599);
  expect(screen.getByLabelText('Select photo 1')).not.toBeChecked();
  expect(screen.getByLabelText('Select photo 3')).toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'Publish product' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('This draft changed');
  expect(api.post).toHaveBeenCalledWith(`/admin/social-imports/${id}/publish`, expect.objectContaining({ draftUpdatedAt: '2026-09-07T00:00:00Z', imageIds: ['b', 'c'], primaryImageId: 'c' }));
  expect(screen.getByDisplayValue('Manually edited saree')).toBeInTheDocument();
});

test('an explicitly chosen size requires measured fit while blank sizes remain optional', async () => {
  render(<SocialProductImport route={'/admin/social-import?id=' + id} />);
  await screen.findByDisplayValue('Wine Cotton Kurti');
  expect(screen.getByLabelText('Available sizes (comma separated)')).toHaveValue('');
  fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'category-1' } });
  fireEvent.change(screen.getByLabelText('Stock quantity'), { target: { value: '3' } });
  fireEvent.change(screen.getByLabelText('Available sizes (comma separated)'), { target: { value: 'M' } });
  fireEvent.click(screen.getByRole('button', { name: 'Publish product' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/measurements/i);
  expect(api.post).not.toHaveBeenCalled();
});
