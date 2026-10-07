import { act, renderHook, waitFor } from '@testing-library/react';
import { CartProvider, useCart } from './CartContext';
import api from '../services/api';
let mockUser = null;
jest.mock('./AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('../services/api', () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() }));
jest.mock('../utils/analytics', () => ({ trackEvent: jest.fn() }));
const wrapper = ({ children }) => <CartProvider>{children}</CartProvider>;
const product = { _id: 'product', name: 'Saree', price: 899, originalPrice: 1299, images: [], stock: 3, colors: [] };
beforeEach(() => { jest.resetAllMocks(); mockUser = null; localStorage.clear(); api.get.mockResolvedValue({ items: [] }); });

test('invalid API responses keep saved lines and report an error instead of clearing the bag', async () => {
  const line = { _id: 'saved', product, quantity: 1, size: 'S' };
  api.get.mockResolvedValue({ items: [line] });
  const { result } = renderHook(useCart, { wrapper });
  await waitFor(() => expect(result.current.hydrated).toBe(true));
  const saved = localStorage.getItem('samira_cart_guest');
  for (const response of [undefined, { success: false }, { message: 'Database unavailable' }, { items: [null] }, { items: [{ product: {} }] }]) {
    api.get.mockResolvedValue(response);
    await act(async () => { expect((await result.current.refresh()).ok).toBe(false); });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.error).toMatch(/could not be loaded/i);
    expect(localStorage.getItem('samira_cart_guest')).toBe(saved);
  }
});

test('simultaneous page and provider refreshes share one request', async () => {
  const { result } = renderHook(useCart, { wrapper });
  await waitFor(() => expect(result.current.hydrated).toBe(true));
  api.get.mockClear(); let resolve;
  api.get.mockImplementation(() => new Promise(done => { resolve = done; }));
  let first; let second;
  act(() => { first = result.current.refresh(); second = result.current.refresh(); });
  expect(first).toBe(second);
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
  await act(async () => { resolve({ items: [] }); await first; });
});

test('refreshing a restored login loads the customer bag again', async () => {
  mockUser = { _id: 'customer' };
  const { result } = renderHook(useCart, { wrapper });
  await waitFor(() => expect(result.current.hydrated).toBe(true));
  api.get.mockResolvedValue({ items: [{ _id: 'saved', product, quantity: 2, size: 'S' }] });
  act(() => { window.dispatchEvent(new CustomEvent('samira:session-refreshed', { detail: mockUser })); });
  await waitFor(() => expect(result.current.items).toHaveLength(1));
  expect(result.current.itemCount).toBe(2);
});

test('confirmed bag adds wait for the backend, deduplicate clicks and use the selected SKU price', async () => {
  const { result } = renderHook(useCart, { wrapper });
  await waitFor(() => expect(result.current.hydrated).toBe(true));
  let resolve; api.post.mockImplementation(() => new Promise(done => { resolve = done; }));
  let first; let second;
  act(() => { first = result.current.addToCartConfirmed(product, 'Free Size', '', 'variant'); second = result.current.addToCartConfirmed(product, 'Free Size', '', 'variant'); });
  expect(first).toBe(second); expect(result.current.items).toHaveLength(0); await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  await act(async () => { resolve({ items: [{ _id: 'line', product, price: 1099, quantity: 1, size: 'Free Size', color: '', variantId: 'variant' }] }); await first; });
  expect(result.current.sellingTotal).toBe(1099); expect(result.current.items[0].color).toBe('');
  expect(JSON.parse(localStorage.getItem('samira_cart_guest')).items[0].product.price).toBe(1099);
});

test('quick adds cannot choose the first clothing size automatically', async () => {
  const sizedProduct = { ...product, name: 'Rose dress', category: 'Dresses', sizingMode: 'sized', sizes: ['S', 'M'] };
  const { result } = renderHook(useCart, { wrapper });
  await waitFor(() => expect(result.current.hydrated).toBe(true));

  let outcome;
  act(() => { outcome = result.current.addToCart(sizedProduct); });

  expect(outcome).toEqual({ ok: false, reason: 'missing-size' });
  expect(api.post).not.toHaveBeenCalled();
  expect(result.current.items).toHaveLength(0);
});

test('failed confirmed adds leave the bag unchanged and return failure to the wishlist', async () => {
  const { result } = renderHook(useCart, { wrapper });
  await waitFor(() => expect(result.current.hydrated).toBe(true));
  api.post.mockRejectedValue(new Error('Out of stock'));
  let outcome; await act(async () => { outcome = await result.current.addToCartConfirmed(product, 'Free Size', ''); });
  expect(outcome).toEqual({ ok: false, message: 'Out of stock' }); expect(result.current.items).toHaveLength(0);
});

test('an old bag response cannot write guest storage after its provider unmounts', async () => {
  const { result, unmount } = renderHook(useCart, { wrapper });
  await waitFor(() => expect(result.current.hydrated).toBe(true));
  let resolve; api.post.mockImplementation(() => new Promise(done => { resolve = done; }));
  let pending; act(() => { pending = result.current.addToCartConfirmed(product, 'Free Size', ''); });
  await waitFor(() => expect(api.post).toHaveBeenCalled());
  unmount(); const before = localStorage.getItem('samira_cart_guest');
  let outcome;
  await act(async () => { resolve({ items: [{ product, price: 899, quantity: 1, size: 'Free Size', color: '' }] }); outcome = await pending; });
  expect(outcome.ok).toBe(false); expect(localStorage.getItem('samira_cart_guest')).toBe(before);
});

test('synced guest caches cannot resurrect a remotely removed item during refresh', async () => {
  localStorage.setItem('samira_cart_guest', JSON.stringify({ synced: true, items: [{ _id: 'old', product, quantity: 1, size: 'Free Size', color: '' }] }));
  const { result } = renderHook(useCart, { wrapper });
  await waitFor(() => expect(result.current.hydrated).toBe(true));
  expect(result.current.items).toHaveLength(0); expect(api.post).not.toHaveBeenCalled();
});

test('guest option changes use one server update and failures keep the original selection', async () => {
  const line = { _id: 'line', product, quantity: 1, size: 'S', color: '' };
  api.get.mockResolvedValue({ items: [line] });
  const { result } = renderHook(useCart, { wrapper });
  await waitFor(() => expect(result.current.hydrated).toBe(true));
  api.put.mockRejectedValue(new Error('Out of stock'));
  let outcome; await act(async () => { outcome = await result.current.updateItemOptions(result.current.items[0].cartKey, { size: 'M' }); });
  expect(outcome.ok).toBe(false); expect(result.current.items[0].size).toBe('S');
  expect(api.put).toHaveBeenCalledWith('/cart/line', expect.objectContaining({ size: 'M' }));
  expect(api.delete).not.toHaveBeenCalled();
});

test('order completion removes purchased lines and preserves unchecked items', async () => {
  const purchased = { _id: 'a', product, quantity: 1, size: 'S', color: '', selected: true };
  const later = { ...purchased, _id: 'b', size: 'M', selected: false };
  api.get.mockResolvedValue({ items: [purchased, later] }); api.post.mockResolvedValue({ items: [later] });
  const { result } = renderHook(useCart, { wrapper });
  await waitFor(() => expect(result.current.hydrated).toBe(true));
  await act(async () => { await result.current.completeCheckout([result.current.items[0]]); });
  expect(api.post).toHaveBeenCalledWith('/cart/remove-items', { itemIds: ['a'] });
  expect(result.current.items).toHaveLength(1); expect(result.current.items[0]._id).toBe('b');
});
