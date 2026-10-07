import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import SocialWorkspace from './SocialWorkspace';
import api from '../../services/api';

jest.mock('../../services/api', () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() }));
const photo = 'https://media.example.test/kurta.jpg';
const product = { _id: 'product-1', name: 'Rose cotton kurta', price: 1299, url: 'https://shop.example.test/product/rose', images: [photo, 'https://media.example.test/detail.jpg'] };
const account = { _id: 'account-1', name: 'Jassi General Store', provider: 'instagram', status: 'connected', subscribed: true, capabilities: { inbox: true, publish: true } };
const thread = { _id: 'thread-1', connectionId: account._id, provider: 'instagram', participantId: 'customer-1', participantName: 'Ananya', preview: 'Is medium available?', lastMessageAt: '2026-09-06T09:00:00Z', lastInboundAt: '2026-09-06T09:00:00Z', unread: true, canReply: true };
const status = { configured: true, missing: [], mediaStorage: 'r2', store: { id: 'store-1', name: 'Jassi General Store' }, stores: [], accounts: [account], permissions: { connect: true, inbox: true, reply: true, publish: true, catalog: true } };
let fixtureStatus, fixtureThread, drafts, messageList;
beforeEach(() => {
  jest.clearAllMocks(); window.history.replaceState({}, '', '/admin/social'); window.scrollTo = jest.fn(); sessionStorage.removeItem('samira_seller_store_id');
  fixtureStatus = { ...status }; fixtureThread = { ...thread }; drafts = [];
  messageList = [{ _id: 'message-1', text: 'Is medium available?', direction: 'inbound', sentAt: '2026-09-06T09:00:00Z' }];
  api.get.mockImplementation(async path => {
    const route = path.split('?')[0];
    if (route === '/social/status') return fixtureStatus;
    if (route === '/social/threads') return { threads: [fixtureThread], unread: 1, hasMore: false };
    if (route === '/social/threads/thread-1') return { thread: fixtureThread, messages: messageList, hasMore: false };
    if (route === '/social/products') return { products: [product], hasMore: false };
    if (route === '/social/posts') return { posts: drafts, hasMore: false };
    if (route === '/social/posts/draft-1') return { post: drafts[0] };
    throw new Error('Unexpected test GET: ' + route);
  });
  api.patch.mockResolvedValue({ success: true });
  const save = async (_path, body) => { drafts = [{ _id: 'draft-1', productId: product._id, productName: product.name, productPrice: product.price, productUrl: product.url, images: body.images, caption: body.caption, kind: body.kind, status: 'draft', videoStatus: 'none', targets: [], createdAt: '2026-09-06T09:00:00Z' }]; return { post: drafts[0] }; };
  api.put.mockImplementation(save);
  api.post.mockImplementation(async (path, body) => {
    const route = path.split('?')[0];
    if (route === '/social/posts') return save(path, body);
    if (route === '/social/posts/draft-1/publish') { drafts[0] = { ...drafts[0], status: 'queued', targets: [{ connectionId: account._id, provider: 'instagram', name: account.name, status: 'queued' }] }; return { post: drafts[0] }; }
    if (route === '/social/threads/thread-1/reply') { const message = { _id: 'sent-1', text: body.text, direction: 'outbound', status: 'sent', sentAt: '2026-09-06T09:02:00Z' }; messageList.push(message); return { message }; }
    return { success: true };
  });
});

test('seller workspace opens the store selected in the seller shell', async () => {
  sessionStorage.setItem('samira_seller_store_id', 'store-2');
  window.history.replaceState({}, '', '/seller/social');
  render(<SocialWorkspace />);
  await screen.findByRole('button', { name: /Ananya/ });
  expect(api.get).toHaveBeenCalledWith('/social/status?storeId=store-2', { silent: true });
});
async function openComposer() {
  render(<SocialWorkspace />);
  fireEvent.click(await screen.findByRole('button', { name: /Create & publish/i }));
  fireEvent.click(await screen.findByRole('button', { name: 'Choose a product' }));
  const dialog = await screen.findByRole('dialog', { name: 'Choose a product' });
  fireEvent.click(await within(dialog).findByRole('button', { name: /Rose cotton kurta/ }));
}

test('product selection fills a draft without publishing; publishing requires a destination and final confirmation', async () => {
  await openComposer();
  const caption = screen.getByLabelText('Main caption', { exact: false });
  expect(caption.value).toContain(product.name); expect(caption.value).toContain('1,299'); expect(caption.value).toContain(product.url);
  expect(api.post).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Review & publish' })).toBeDisabled();
  fireEvent.change(caption, { target: { value: 'New season. Rose cotton kurta.' } });
  fireEvent.click(screen.getByRole('checkbox', { name: /Jassi General Store instagram/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Review & publish' }));
  const confirmation = await screen.findByRole('dialog', { name: 'Ready to share?' });
  expect(api.post.mock.calls.filter(([path]) => path.includes('/publish'))).toHaveLength(0);
  fireEvent.click(within(confirmation).getByRole('button', { name: 'Publish now' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith(expect.stringContaining('/posts/draft-1/publish'), { connectionIds: [account._id] }));
  expect(api.post.mock.calls.filter(([path]) => path.includes('/publish'))).toHaveLength(1);
});

test('reel creation saves the draft and queues a preview before allowing publication', async () => {
  await openComposer(); fireEvent.click(screen.getByRole('button', { name: 'Product reel' }));
  api.post.mockImplementationOnce(async (_path, body) => { drafts = [{ _id: 'draft-1', productId: product._id, productName: product.name, images: body.images, caption: body.caption, kind: body.kind, status: 'draft', videoStatus: 'none', targets: [] }]; return { post: drafts[0] }; });
  api.post.mockImplementationOnce(async () => ({ post: { ...drafts[0], videoStatus: 'queued' } }));
  fireEvent.click(screen.getByRole('button', { name: 'Create video preview' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith(expect.stringContaining('/posts/draft-1/video'), {}));
  expect(screen.getByRole('button', { name: 'Review & publish' })).toBeDisabled();
  expect(api.post.mock.calls.some(([path]) => path.includes('/publish'))).toBe(false);
});

test('shared inbox opens a customer thread and sends only the explicit reply', async () => {
  render(<SocialWorkspace />);
  fireEvent.click(await screen.findByRole('button', { name: /Ananya/ }));
  const textarea = await screen.findByRole('textbox', { name: 'Write your reply' });
  fireEvent.change(textarea, { target: { value: 'Yes, medium is available.' } });
  expect(api.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Send reply' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith(expect.stringContaining('/threads/thread-1/reply'), expect.objectContaining({ text: 'Yes, medium is available.', clientId: expect.any(String) })));
  await waitFor(() => expect(textarea).toHaveValue(''));
});
test('order Smart Fill stays scoped to the social workspace and fills only a reviewed unsent reply', async () => {
  fixtureStatus = { ...status, workspace: 'admin', permissions: { ...status.permissions, customerContext: true } };
  const get = api.get.getMockImplementation(), post = api.post.getMockImplementation();
  api.get.mockImplementation(path => path.includes('/threads/thread-1/context')
    ? Promise.resolve({ customer: { _id: 'customer-one' }, orders: [{ _id: 'order-one', invoiceNumber: 'INV-ONE' }] }) : get(path));
  api.post.mockImplementation((path, body) => path.startsWith('/admin/smart-fill/preview')
    ? Promise.resolve({ suggestions: [{ path: 'reply', label: 'Customer reply', value: 'Order INV-ONE is confirmed.', source: 'database' }, { path: 'summary', label: 'Private summary', value: 'INV-ONE confirmed.', source: 'database' }] }) : post(path, body));
  render(<SocialWorkspace />); fireEvent.click(await screen.findByRole('button', { name: /Ananya/ }));
  fireEvent.click(await screen.findByRole('button', { name: /Order support Smart Fill/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Suggest draft fields' }));
  await screen.findByText('Order INV-ONE is confirmed.');
  fireEvent.click(screen.getByRole('button', { name: /Apply 2/ }));
  expect(screen.getByRole('textbox', { name: 'Write your reply' })).toHaveValue('Order INV-ONE is confirmed.');
  expect(api.post).toHaveBeenCalledWith('/admin/smart-fill/preview?storeId=store-1', expect.objectContaining({ workflow: 'support', context: { orderId: 'order-one', threadId: 'thread-1' } }), expect.objectContaining({ silent: true }));
  expect(api.post.mock.calls.filter(([path]) => path.includes('/reply') && !path.includes('reply-presence'))).toHaveLength(0);
});

test('expired reply window disables sending and provides the Meta inbox link', async () => {
  fixtureThread.canReply = false;
  render(<SocialWorkspace />); fireEvent.click(await screen.findByRole('button', { name: /Ananya/ }));
  expect(await screen.findByRole('textbox', { name: 'Write your reply' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Send reply' })).toBeDisabled();
  expect(screen.getByRole('link', { name: /Meta inbox/ })).toHaveAttribute('href', 'https://business.facebook.com/latest/inbox');
});

test('unknown delivery remains visible and is not blindly resubmitted', async () => {
  api.post.mockResolvedValue({ message: { status: 'unknown', error: 'Check Meta before sending again.' } });
  render(<SocialWorkspace />); fireEvent.click(await screen.findByRole('button', { name: /Ananya/ }));
  fireEvent.change(await screen.findByRole('textbox', { name: 'Write your reply' }), { target: { value: 'Your product link' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send reply' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Check Meta before sending again.');
  expect(screen.getByRole('button', { name: 'Send reply' })).toBeDisabled();
  expect(api.post.mock.calls.filter(([path]) => path.split('?')[0].endsWith('/reply'))).toHaveLength(1);
});

test('unconfigured accounts explain setup instead of showing a working login button', async () => {
  fixtureStatus = { ...status, configured: false, accounts: [], missing: ['META_APP_ID', 'META_APP_SECRET'] };
  render(<SocialWorkspace />); fireEvent.click(await screen.findByRole('button', { name: 'Accounts' }));
  expect(await screen.findByRole('button', { name: 'Continue with Facebook' })).toBeDisabled();
  expect(screen.getByText(/Missing: META_APP_ID/)).toBeInTheDocument();
});

test('a late reply result cannot replace another customer conversation or its unsent reply', async () => {
  const second = { ...thread, _id: 'thread-2', participantName: 'Meera', participantId: 'customer-2' };
  const originalGet = api.get.getMockImplementation();
  api.get.mockImplementation(path => path.split('?')[0] === '/social/threads'
    ? Promise.resolve({ threads: [thread, second], unread: 2, hasMore: false })
    : path.split('?')[0] === '/social/threads/thread-2'
      ? Promise.resolve({ thread: second, messages: [{ _id: 'message-2', text: 'Any blue sarees?', direction: 'inbound' }], hasMore: false })
      : originalGet(path));
  let finishReply;
  api.post.mockImplementation((path) => path.includes('/reply-presence') || path.includes('/read') ? Promise.resolve({ success: true }) : new Promise(resolve => { finishReply = resolve; }));
  render(<SocialWorkspace />);
  fireEvent.click(await screen.findByRole('button', { name: /Ananya/ }));
  fireEvent.change(await screen.findByRole('textbox', { name: 'Write your reply' }), { target: { value: 'Reply for Ananya' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send reply' }));
  fireEvent.click(screen.getByRole('button', { name: /Meera/ }));
  await screen.findByText('Any blue sarees?');
  fireEvent.change(screen.getByRole('textbox', { name: 'Write your reply' }), { target: { value: 'Draft for Meera' } });
  await act(async () => { finishReply({ message: { status: 'sent' } }); });
  expect(screen.getByRole('heading', { name: 'Meera' })).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Write your reply' })).toHaveValue('Draft for Meera');
  expect(screen.getByRole('button', { name: 'Send reply' })).toBeEnabled();
  expect(api.post.mock.calls.filter(([path]) => path.split('?')[0].endsWith('/reply'))).toHaveLength(1);
});

test('a confirmed sent reply clears before a subsequent refresh failure', async () => {
  render(<SocialWorkspace />);
  fireEvent.click(await screen.findByRole('button', { name: /Ananya/ }));
  const textarea = await screen.findByRole('textbox', { name: 'Write your reply' });
  fireEvent.change(textarea, { target: { value: 'Your order is ready.' } });
  api.get.mockRejectedValueOnce(new Error('Unable to refresh messages'));
  fireEvent.click(screen.getByRole('button', { name: 'Send reply' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to refresh messages');
  expect(textarea).toHaveValue('');
  expect(api.post.mock.calls.filter(([path]) => path.split('?')[0].endsWith('/reply'))).toHaveLength(1);
});
