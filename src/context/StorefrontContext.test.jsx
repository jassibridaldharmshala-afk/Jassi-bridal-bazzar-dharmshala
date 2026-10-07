import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { StorefrontProvider, useStorefront } from './StorefrontContext';
import api from '../services/api';
jest.mock('../services/api', () => ({ get: jest.fn() }));
jest.mock('../utils/analytics', () => ({ trackEvent: jest.fn() }));
function State() {
  const { store, storeSlug, error, loading, retry } = useStorefront();
  return <><p>{loading ? 'Opening store' : error || store?.name || 'Main shop'}</p><span>{storeSlug}</span><button onClick={retry}>Try again</button></>;
}
const page = route => <StorefrontProvider route={route}><State /></StorefrontProvider>;
beforeEach(() => { jest.resetAllMocks(); sessionStorage.clear(); api.get.mockResolvedValue({ isDefault: true }); });
test('boutique read failure has retry and does not become an unpublished or empty catalog', async () => {
  api.get.mockRejectedValueOnce(new Error('Database unavailable')).mockResolvedValueOnce({ slug: 'silk', name: 'Silk boutique' });
  render(page('/store/silk'));
  expect(await screen.findByText('Database unavailable')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('Silk boutique')).toBeInTheDocument();
});
test('a late boutique response cannot replace the next store or leave main home loading', async () => {
  let finishOld;
  api.get.mockImplementation(path => path === '/stores/old' ? new Promise(resolve => { finishOld = resolve; }) : Promise.resolve(path === '/stores/new' ? { slug: 'new', name: 'New boutique' } : { isDefault: true }));
  const { rerender } = render(page('/store/old'));
  rerender(page('/store/new'));
  expect(await screen.findByText('New boutique')).toBeInTheDocument();
  await act(async () => finishOld({ slug: 'old', name: 'Old boutique' }));
  expect(screen.queryByText('Old boutique')).not.toBeInTheDocument();
  rerender(page('/'));
  expect(await screen.findByText('Main shop')).toBeInTheDocument();
  expect(screen.queryByText('Opening store')).not.toBeInTheDocument();
});
