import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import api from '../../services/api';
import DraftBatchSmartFill from './DraftBatchSmartFill';

jest.mock('../../services/api', () => ({ get: jest.fn(), post: jest.fn() }));
let mockAuth = { user: { _id: 'owner', activeMode: 'admin' } };
jest.mock('../../context/AuthContext', () => ({ useAuth: () => mockAuth }));
const structure = { industry: 'boutique', features: { sizing: true }, attributes: [] };
const makeDraft = (index, count = 1) => ({ _id: `draft-${index}`, status: 'draft', revision: 2, name: `Product ${index}`, sellingPrice: 1200, originalPrice: 1500, highlights: [], colors: [], tags: [],
  commerceMode: 'SALE_AND_RENTAL', rentalPricing: { dailyRatePaise: 45000, depositPaise: 100000 },
  images: Array.from({ length: count }, (_, view) => ({ url: `/uploads/${index}-${view}.webp`, primary: view === 0 })) });
const suggestion = { suggestion: { name: 'AI name', description: 'Visible floral embroidery', highlights: ['Gold embroidery'], sizes: ['M'], sizingMode: 'sized', price: 900 },
  fieldSources: { price: { source: 'caption', quote: 'Sale price: 900' } }, analysisStatus: 'completed', mode: 'ai', warnings: [] };
let latest;
let status;
let onSave;
let onBusyChange;
function show(drafts, props = {}) {
  latest = new Map(drafts.map(draft => [draft._id, draft]));
  return render(<DraftBatchSmartFill drafts={drafts} categories={[]} structure={structure} apiPrefix="/admin" onSave={onSave} onBusyChange={onBusyChange} onClose={jest.fn()} {...props} />);
}
async function run(count) {
  const button = await screen.findByRole('button', { name: `Run Smart Fill for ${count} drafts` });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
}
beforeEach(() => {
  jest.clearAllMocks(); sessionStorage.clear();
  mockAuth = { user: { _id: 'owner', activeMode: 'admin' } };
  status = { enabled: true, maxPhotos: 6, requestIntervalMs: 0 };
  api.get.mockImplementation(async path => path.endsWith('/status') ? status : { data: latest.get(decodeURIComponent(path.split('/').pop())) });
  api.post.mockResolvedValue(suggestion);
  onSave = jest.fn(async form => ({ ...form, revision: form.revision + 1 }));
  onBusyChange = jest.fn();
});
afterEach(() => jest.useRealTimers());

test('one action analyses all 30 drafts with isolated photo groups; saving is reviewed and preserves prices and rental configuration', async () => {
  const drafts = Array.from({ length: 30 }, (_, index) => makeDraft(index, [4, 6, 2][index % 3]));
  show(drafts);
  await run(30);
  await screen.findByText('30/30 products analysed · 0 saved', {}, { timeout: 10000 });
  expect(api.post).toHaveBeenCalledTimes(30);
  api.post.mock.calls.forEach(([path, body], index) => {
    expect(path).toBe('/admin/products/smart-fill');
    expect(body.imageUrls).toEqual(drafts[index].images.map(image => image.url));
    expect(body.existing.name).toBe(drafts[index].name);
  });
  expect(onSave).not.toHaveBeenCalled();
  expect(screen.queryByLabelText('Available sizes for product 1')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Product name for product 1')).toBeDisabled();
  expect(screen.getByLabelText('Selling price for product 1')).not.toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'Save selected details for 30 drafts' }));
  await screen.findByText('30/30 products analysed · 30 saved', {}, { timeout: 10000 });
  expect(onSave).toHaveBeenCalledTimes(30);
  onSave.mock.calls.forEach(([form, options], index) => {
    expect(form).toMatchObject({ ...drafts[index], description: suggestion.suggestion.description, highlights: suggestion.suggestion.highlights });
    expect(form).not.toHaveProperty('sizes');
    expect(options).toEqual({ silent: true });
  });
});

test('a failed product does not stop the others; resume retries only failed products and uses refreshed draft revisions', async () => {
  show([makeDraft(1), makeDraft(2), makeDraft(3)]);
  api.post.mockRejectedValueOnce(new Error('Unreadable photo'));
  await run(3);
  const resume = await screen.findByRole('button', { name: 'Resume 1 remaining drafts' });
  await waitFor(() => expect(resume).toBeEnabled());
  expect(api.post).toHaveBeenCalledTimes(3);
  latest.set('draft-1', { ...makeDraft(1), revision: 7, description: 'New manual description' });
  fireEvent.click(resume);
  await screen.findByText('3/3 products analysed · 0 saved');
  expect(api.post).toHaveBeenCalledTimes(4);
  expect(api.post.mock.calls[3][1].existing.name).toBe('Product 1');
  fireEvent.click(screen.getByRole('button', { name: 'Save selected details for 3 drafts' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(3));
  expect(onSave.mock.calls[0][0]).toMatchObject({ revision: 7, description: 'New manual description' });
});

test('per-product notes stay separate and notes-only mode works without photo AI', async () => {
  status.enabled = false;
  show([makeDraft(1), makeDraft(2)]);
  fireEvent.change(screen.getByLabelText('Notes for product 1'), { target: { value: 'Care: Dry clean only' } });
  fireEvent.change(screen.getByLabelText('Notes for product 2'), { target: { value: 'Fabric: Cotton' } });
  await run(2);
  await screen.findByText('2/2 products analysed · 0 saved');
  expect(api.post.mock.calls.map(call => call[1].notes)).toEqual(['Care: Dry clean only', 'Fabric: Cotton']);
});

test('provider quota failure pauses the batch and retains completed suggestions', async () => {
  show([makeDraft(1), makeDraft(2), makeDraft(3)]);
  api.post.mockResolvedValueOnce(suggestion).mockResolvedValueOnce({ ...suggestion, analysisStatus: 'failed', errorCode: 'AI_QUOTA_EXCEEDED', analysisError: 'Provider quota exhausted' });
  await run(3);
  const resume = await screen.findByRole('button', { name: 'Resume 2 remaining drafts' });
  await waitFor(() => expect(resume).toBeEnabled());
  expect(api.post).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('alert')).toHaveTextContent('Provider quota exhausted');
  expect(screen.getByRole('button', { name: 'Save selected details for 1 drafts' })).toBeEnabled();
  fireEvent.click(resume);
  await screen.findByText('3/3 products analysed · 0 saved');
  expect(api.post).toHaveBeenCalledTimes(4);
});

test('stop aborts the active request and resume keeps completed products without duplicate runs', async () => {
  show([makeDraft(1), makeDraft(2), makeDraft(3)]);
  let requestSignal;
  api.post.mockResolvedValueOnce(suggestion).mockImplementationOnce((_path, _body, options) => new Promise((_resolve, reject) => {
    requestSignal = options.signal;
    options.signal.addEventListener('abort', () => reject(new Error('Cancelled')), { once: true });
  }));
  await run(3);
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
  fireEvent.click(screen.getByRole('button', { name: 'Stop analysis' }));
  const resume = await screen.findByRole('button', { name: 'Resume 2 remaining drafts' });
  await waitFor(() => expect(resume).toBeEnabled());
  expect(requestSignal.aborted).toBe(true);
  fireEvent.click(resume);
  await screen.findByText('3/3 products analysed · 0 saved');
  expect(api.post.mock.calls.map(call => call[1].existing.name)).toEqual(['Product 1', 'Product 2', 'Product 2', 'Product 3']);
});

test('save conflicts require fresh analysis and do not prevent other draft saves', async () => {
  show([makeDraft(1), makeDraft(2)]);
  await run(2);
  await screen.findByText('2/2 products analysed · 0 saved');
  onSave.mockRejectedValueOnce({ status: 409, data: { code: 'DRAFT_STALE', message: 'Someone edited this draft' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save selected details for 2 drafts' }));
  await screen.findByText('2/2 products analysed · 1 saved');
  expect(onSave).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('alert')).toHaveTextContent('Someone edited this draft');
  latest.set('draft-1', { ...makeDraft(1), revision: 8 });
  fireEvent.click(screen.getByRole('button', { name: 'Re-analyse this draft' }));
  fireEvent.click(screen.getByRole('button', { name: 'Resume 1 remaining drafts' }));
  await screen.findByText('2/2 products analysed · 1 saved');
  const save = screen.getByRole('button', { name: 'Save selected details for 1 drafts' });
  await waitFor(() => expect(save).toBeEnabled());
  fireEvent.click(save);
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(3));
  expect(onSave.mock.calls[2][0].revision).toBe(8);
});

test('session changes abort pending analysis and clear suggestions from the previous account', async () => {
  const props = { drafts: [makeDraft(1)], categories: [], structure, apiPrefix: '/admin', onSave, onBusyChange };
  latest = new Map([['draft-1', makeDraft(1)]]);
  let finish;
  let signal;
  api.post.mockImplementation((_path, _body, options) => { signal = options.signal; return new Promise(resolve => { finish = resolve; }); });
  const view = render(<DraftBatchSmartFill {...props} />);
  await run(1);
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  mockAuth = { user: { _id: 'other-owner', activeMode: 'admin' } };
  view.rerender(<DraftBatchSmartFill {...props} />);
  expect(signal.aborted).toBe(true);
  expect(screen.queryByRole('article', { name: 'Smart Fill product 1' })).not.toBeInTheDocument();
  await act(async () => finish(suggestion));
  expect(onSave).not.toHaveBeenCalled();
});

test('the queue respects server pacing and ignores repeated run clicks', async () => {
  jest.useFakeTimers({ now: 100000 }); status.requestIntervalMs = 5100;
  show([makeDraft(1), makeDraft(2)]);
  await act(async () => {});
  const start = screen.getByRole('button', { name: 'Run Smart Fill for 2 drafts' });
  await act(async () => { fireEvent.click(start); fireEvent.click(start); });
  expect(api.post).toHaveBeenCalledTimes(1);
  await act(async () => jest.advanceTimersByTime(5099));
  expect(api.post).toHaveBeenCalledTimes(1);
  await act(async () => jest.advanceTimersByTime(1));
  expect(api.post).toHaveBeenCalledTimes(2);
  expect(screen.getByText('2/2 products analysed · 0 saved')).toBeInTheDocument();
});

test('429 waits once and automatically resumes the same draft without rerunning completed drafts', async () => {
  jest.useFakeTimers({ now: 100000 });
  show([makeDraft(1), makeDraft(2)]);
  api.post.mockResolvedValueOnce(suggestion).mockRejectedValueOnce({ status: 429, message: 'Wait a minute' });
  await act(async () => {});
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Run Smart Fill for 2 drafts' })));
  expect(api.post).toHaveBeenCalledTimes(2);
  await act(async () => jest.advanceTimersByTime(60999));
  expect(api.post).toHaveBeenCalledTimes(2);
  await act(async () => jest.advanceTimersByTime(1));
  expect(api.post).toHaveBeenCalledTimes(3);
  expect(screen.getByText('2/2 products analysed · 0 saved')).toBeInTheDocument();
  expect(screen.queryByText(/Waiting for the Smart Fill request limit to reset/)).not.toBeInTheDocument();
});

test('existing detail replacement and financial suggestions require explicit selection per product', async () => {
  show([makeDraft(1)]);
  await run(1); await screen.findByText('1/1 products analysed · 0 saved');
  const product = within(screen.getByRole('article', { name: 'Smart Fill product 1' }));
  fireEvent.click(product.getByLabelText('Allow replacing selected existing details for this product'));
  fireEvent.click(product.getByLabelText('Product name for product 1'));
  fireEvent.click(product.getByLabelText('Selling price for product 1'));
  fireEvent.click(screen.getByRole('button', { name: 'Save selected details for 1 drafts' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  expect(onSave.mock.calls[0][0]).toMatchObject({ name: 'AI name', sellingPrice: '900', originalPrice: 1500 });
});

test('an empty sale price is never selected automatically from an AI suggestion', async () => {
  show([{ ...makeDraft(1), sellingPrice: 0, originalPrice: 0 }]);
  await run(1); await screen.findByText('1/1 products analysed · 0 saved');
  expect(screen.getByLabelText('Selling price for product 1')).toBeEnabled();
  expect(screen.getByLabelText('Selling price for product 1')).not.toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'Save selected details for 1 drafts' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  expect(onSave.mock.calls[0][0].sellingPrice).toBe(0);
});

test('a repeated 429 pauses for manual resume instead of retrying indefinitely', async () => {
  jest.useFakeTimers({ now: 100000 });
  show([makeDraft(1), makeDraft(2)]);
  api.post.mockRejectedValue({ status: 429, message: 'Request limit is still active' });
  await act(async () => {});
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Run Smart Fill for 2 drafts' })));
  await act(async () => jest.advanceTimersByTime(61000));
  expect(api.post).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('button', { name: 'Resume 2 remaining drafts' })).toBeEnabled();
  await act(async () => jest.advanceTimersByTime(61000));
  expect(api.post).toHaveBeenCalledTimes(2);
});
