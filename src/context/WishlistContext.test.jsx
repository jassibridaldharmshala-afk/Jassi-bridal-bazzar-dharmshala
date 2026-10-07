import '@testing-library/jest-dom';
import { act, renderHook, waitFor } from '@testing-library/react';
import { WishlistProvider, useWishlist } from './WishlistContext';
import api from '../services/api';
let mockUser = null;
const mockNotify = jest.fn();
jest.mock('./AuthContext', () => ({ useAuth: () => ({ user: mockUser, notify: mockNotify }) }));
jest.mock('../services/api', () => ({ get: jest.fn(), post: jest.fn(), delete: jest.fn() }));
jest.mock('../utils/analytics', () => ({ trackEvent: jest.fn() }));
const a = { _id: 'a', name: 'Saree A', price: 899, images: [], stock: 3 };
const b = { ...a, _id: 'b', name: 'Saree B' };
const storage = 'samira_wishlist_guest';
beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); mockUser = null; api.get.mockResolvedValue([]); api.post.mockImplementation(async (path, body) => path === '/wishlist/resolve' ? body.ids.map(id => id === 'a' ? a : b) : []); });
const wrapper = ({ children }) => <WishlistProvider>{children}</WishlistProvider>;

test('guest saves survive first render, rapid additions and storage events from another tab', async () => {
  localStorage.setItem(storage, JSON.stringify([a]));
  const { result } = renderHook(useWishlist, { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.items.map(row => row._id)).toEqual(['a']);
  await act(async () => { await Promise.all([result.current.addToWishlist(b), result.current.addToWishlist(a)]); });
  expect(JSON.parse(localStorage.getItem(storage))).toHaveLength(2);
  act(() => { localStorage.setItem(storage, JSON.stringify([b])); window.dispatchEvent(new StorageEvent('storage', { key: storage })); });
  expect(result.current.items.map(row => row._id)).toEqual(['b']);
});

test('authenticated operations serialize so quick saves cannot overwrite each other', async () => {
  mockUser = { _id: 'user' }; let remote = [];
  api.post.mockImplementation(async path => { remote = [...remote, path.endsWith('/a') ? a : b]; return remote; });
  const { result } = renderHook(useWishlist, { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => { await Promise.all([result.current.addToWishlist(a), result.current.addToWishlist(b)]); });
  expect(result.current.items.map(row => row._id)).toEqual(['a', 'b']);
  api.delete.mockRejectedValue(new Error('Server could not save the change'));
  let outcome; await act(async () => { outcome = await result.current.removeFromWishlist(a); });
  expect(outcome.ok).toBe(false); expect(result.current.items).toHaveLength(2);
  expect(result.current.error).toMatch(/Server could not save/);
});

test('failed guest merging preserves unsynced items and the account wishlist', async () => {
  mockUser = { _id: 'user' }; localStorage.setItem(storage, JSON.stringify([a, b]));
  api.get.mockResolvedValue([a]); api.post.mockRejectedValue(new Error('Offline'));
  const { result } = renderHook(useWishlist, { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.items.map(row => row._id)).toEqual(['a']);
  expect(JSON.parse(localStorage.getItem(storage)).map(row => row._id)).toEqual(['b']);
  expect(result.current.error).toMatch(/could not sync/);
  api.post.mockResolvedValue([a, b]);
  await act(async () => { await result.current.refresh(); });
  expect(result.current.items).toHaveLength(2); expect(JSON.parse(localStorage.getItem(storage))).toEqual([]);
});

test('a failed refresh keeps the previous list rather than pretending it is empty', async () => {
  mockUser = { _id: 'user' }; api.get.mockResolvedValue([a]);
  const { result } = renderHook(useWishlist, { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  api.get.mockRejectedValue(new Error('Connection unavailable'));
  await act(async () => { await result.current.refresh(); });
  expect(result.current.items).toHaveLength(1); expect(result.current.error).toBe('Connection unavailable');
});

test('responses arriving after unmount cannot consume guest saves for a new account', async () => {
  mockUser = { _id: 'user' }; localStorage.setItem(storage, JSON.stringify([a]));
  let resolve; api.get.mockImplementation(() => new Promise(done => { resolve = done; }));
  const { unmount } = renderHook(useWishlist, { wrapper });
  await waitFor(() => expect(api.get).toHaveBeenCalled()); unmount();
  await act(async () => { resolve([]); });
  expect(JSON.parse(localStorage.getItem(storage))).toHaveLength(1); expect(api.post).not.toHaveBeenCalled();
});

test('a guest refresh preserves additions and removals from another tab during its request', async () => {
  localStorage.setItem(storage, JSON.stringify([a]));
  let resolve; api.post.mockImplementation(() => new Promise(done => { resolve = done; }));
  const { result } = renderHook(useWishlist, { wrapper });
  await waitFor(() => expect(api.post).toHaveBeenCalled());
  act(() => { localStorage.setItem(storage, JSON.stringify([b])); window.dispatchEvent(new StorageEvent('storage', { key: storage })); });
  await act(async () => { resolve([{ ...a, price: 999 }]); });
  expect(result.current.items.map(row => row._id)).toEqual(['b']);
  expect(JSON.parse(localStorage.getItem(storage)).map(row => row._id)).toEqual(['b']);
});

test('blocked browser storage retains all saves in memory and reports the limitation', async () => {
  const write = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage is full'); });
  try {
    const { result } = renderHook(useWishlist, { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.addToWishlist(a); await result.current.addToWishlist(b); await result.current.refresh(); });
    expect(result.current.items.map(row => row._id)).toEqual(['a', 'b']);
    expect(result.current.error).toMatch(/browser could not save/);
  } finally { write.mockRestore(); }
});
