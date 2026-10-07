import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import MobileSearchOverlay from './MobileSearchOverlay';
import api from '../../services/api';
jest.mock('../../services/api', () => ({ get: jest.fn() }));
beforeEach(() => { jest.resetAllMocks(); jest.useFakeTimers(); localStorage.clear(); });
afterEach(() => jest.useRealTimers());
const runSearch = async () => act(async () => { jest.advanceTimersByTime(300); });
test('failed search retries the same store query and opening a result saves recent searches', async () => {
  api.get.mockRejectedValueOnce(new Error('Search offline')).mockResolvedValueOnce({ items: [{ _id: 'one', name: 'Silk saree', price: 900 }] });
  const navigate = jest.fn(), onClose = jest.fn();
  render(<MobileSearchOverlay initialValue="silk" storeSlug="boutique" navigate={navigate} onClose={onClose} />);
  await runSearch();
  expect(screen.getByRole('alert')).toHaveTextContent('Search is unavailable');
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await runSearch();
  expect(api.get).toHaveBeenLastCalledWith('/products?search=silk&page=1&limit=8&store=boutique', { cacheFirst: true });
  fireEvent.click(screen.getByRole('button', { name: /Silk saree/ }));
  expect(navigate).toHaveBeenCalledWith('/product?id=one');
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(JSON.parse(localStorage.getItem('samira_recent_searches'))).toEqual(['silk']);
});
test('out-of-order results cannot replace the current search', async () => {
  let resolveOld;
  api.get.mockImplementation(path => path.includes('old') ? new Promise(resolve => { resolveOld = resolve; }) : Promise.resolve([{ _id: 'new', name: 'New style' }]));
  render(<MobileSearchOverlay initialValue="old" navigate={jest.fn()} onClose={jest.fn()} />);
  await runSearch();
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'new' } }); await runSearch();
  await act(async () => resolveOld([{ _id: 'old', name: 'Old style' }]));
  expect(screen.getByText('New style')).toBeInTheDocument();
  expect(screen.queryByText('Old style')).not.toBeInTheDocument();
});
test('escape closes search and unmount restores page scrolling', () => {
  const onClose = jest.fn(); document.body.style.overflow = 'auto';
  const { unmount } = render(<MobileSearchOverlay navigate={jest.fn()} onClose={onClose} />);
  expect(document.body.style.overflow).toBe('hidden');
  fireEvent.keyDown(window, { key: 'Escape' }); expect(onClose).toHaveBeenCalledTimes(1);
  unmount(); expect(document.body.style.overflow).toBe('auto');
});
