import { act, renderHook, waitFor } from '@testing-library/react';
import api from '../services/api';
import useShoppingDiscovery from './useShoppingDiscovery';
import { rememberRecentProduct } from '../utils/recentProducts';
import { SETTINGS_CHANGED_EVENT } from '../config/storeSettings';
jest.mock('../services/api', () => ({ get: jest.fn() }));
beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); });
test('store switches hide old data immediately and ignore late responses from the old store', async () => {
  let finish;
  api.get.mockImplementation(path => path.includes('store=first') ? new Promise(resolve => { finish = resolve; }) : Promise.resolve({ mode: 'SALE_ONLY', occasions: [{ label: 'Second occasion' }] }));
  const { result, rerender } = renderHook(({ slug }) => useShoppingDiscovery(slug), { initialProps: { slug: 'first' } });
  rerender({ slug: 'second' });
  await waitFor(() => expect(result.current.data?.occasions[0].label).toBe('Second occasion'));
  await act(async () => { finish({ occasions: [{ label: 'Old store' }] }); });
  expect(result.current.data.occasions[0].label).toBe('Second occasion');
});
test('history changes and saved settings refresh independently from the main home feed', async () => {
  api.get.mockResolvedValue({ occasions: [], recentlyViewed: [] });
  const { result } = renderHook(() => useShoppingDiscovery('nishaya'));
  await waitFor(() => expect(result.current.data).not.toBeNull());
  act(() => rememberRecentProduct('abcdef0123456789abcdef01', 'nishaya'));
  await waitFor(() => expect(result.current.recentIds).toEqual(['abcdef0123456789abcdef01']));
  expect(api.get.mock.calls.at(-1)[0]).toContain('recent=abcdef0123456789abcdef01');
  act(() => window.dispatchEvent(new Event(SETTINGS_CHANGED_EVENT)));
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(3));
  expect(api.get.mock.calls.at(-1)[1]).toEqual(expect.objectContaining({ silent: true, cacheScope: expect.stringMatching(/:1$/) }));
});
