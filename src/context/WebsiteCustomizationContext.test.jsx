import { fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import { WebsiteCustomizationProvider, useWebsiteCustomization } from './WebsiteCustomizationContext';
import api from '../services/api';
jest.mock('../services/api', () => ({ get: jest.fn() }));
jest.mock('../store/store', () => ({ store: { dispatch: jest.fn() } }));
jest.mock('../store/apiSlice', () => ({ samiraApi: { util: { invalidateTags: jest.fn() } } }));
function ReadTheme() { const { config, refresh, loading } = useWebsiteCustomization(); return <><span data-testid="colour">{config.colors.primary}</span><span data-testid="loading">{String(loading)}</span><button onClick={() => refresh({ force: true })}>Refresh</button></>; }
beforeEach(() => { jest.clearAllMocks(); window.history.replaceState({}, '', '/'); });

test('an empty config response keeps the last usable theme and a later refresh recovers', async () => {
  api.get.mockResolvedValueOnce(undefined).mockResolvedValueOnce({ config: { colors: { primary: '#123456' } } });
  render(<WebsiteCustomizationProvider route="/store/brand"><ReadTheme /></WebsiteCustomizationProvider>);
  await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
  expect(screen.getByTestId('colour').textContent).toBe('#6d1f34');
  fireEvent.click(screen.getByText('Refresh'));
  await waitFor(() => expect(screen.getByTestId('colour').textContent).toBe('#123456'));
});
test('published refresh bypasses stale cache and boutique changes use explicit scope', async () => {
  api.get.mockResolvedValue({ config: { colors: { primary: '#123456' } } });
  const view = render(<WebsiteCustomizationProvider route="/"><ReadTheme /></WebsiteCustomizationProvider>);
  await waitFor(() => expect(screen.getByTestId('colour').textContent).toBe('#123456'));
  expect(api.get).toHaveBeenCalledWith('/website-config?store=', expect.objectContaining({ cacheFirst: true }));
  api.get.mockResolvedValue({ config: { colors: { primary: '#abcdef' } } });
  fireEvent.click(screen.getByText('Refresh'));
  await waitFor(() => expect(screen.getByTestId('colour').textContent).toBe('#abcdef'));
  expect(api.get).toHaveBeenLastCalledWith('/website-config?store=', expect.objectContaining({ forceRefetch: true }));
  view.rerender(<WebsiteCustomizationProvider route="/store/another"><ReadTheme /></WebsiteCustomizationProvider>);
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/website-config?store=another', expect.anything()));
});
test('seller appearance resolves membership checked store instead of default theme', async () => {
  api.get.mockImplementation(path => Promise.resolve(path === '/stores/me/current' ? { store: { slug: 'seller-brand' } } : { config: { colors: { primary: '#334455' } } }));
  render(<WebsiteCustomizationProvider route="/seller/settings"><ReadTheme /></WebsiteCustomizationProvider>);
  await waitFor(() => expect(screen.getByTestId('colour').textContent).toBe('#334455'));
  expect(api.get).toHaveBeenCalledWith('/website-config?store=seller-brand', expect.anything());
});
test('custom host uses its resolved storefront theme', async () => {
  api.get.mockImplementation(path => Promise.resolve(path.startsWith('/stores/resolve') ? { slug: 'hosted-brand', isDefault: false } : { config: { colors: { primary: '#334455' } } }));
  render(<WebsiteCustomizationProvider route="/"><ReadTheme /></WebsiteCustomizationProvider>);
  await waitFor(() => expect(screen.getByTestId('colour').textContent).toBe('#334455'));
  expect(api.get).toHaveBeenCalledWith('/website-config?store=hosted-brand', expect.anything());
});
test('late previous scope responses cannot overwrite new brand', async () => {
  let old; api.get.mockImplementation(path => path.includes('old') ? new Promise(resolve => { old = resolve; }) : Promise.resolve({ config: { colors: { primary: '#123456' } } }));
  const view = render(<WebsiteCustomizationProvider route="/store/old"><ReadTheme /></WebsiteCustomizationProvider>);
  view.rerender(<WebsiteCustomizationProvider route="/store/new"><ReadTheme /></WebsiteCustomizationProvider>);
  await waitFor(() => expect(screen.getByTestId('colour').textContent).toBe('#123456'));
  await act(async () => { old({ config: { colors: { primary: '#abcdef' } } }); });
  expect(screen.getByTestId('colour').textContent).toBe('#123456');
});
