import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WebsiteCustomizer, { MultiSelect } from './WebsiteCustomizer';
import api from '../../services/api';
import { mergeWebsiteConfig } from '../../config/websiteCustomization';

jest.mock('../../services/api', () => ({ __esModule: true, default: { get: jest.fn(), put: jest.fn(), post: jest.fn(), delete: jest.fn() } }));
jest.mock('../../context/WebsiteCustomizationContext', () => ({ useWebsiteCustomization: () => ({ refresh: jest.fn() }) }));
jest.mock('../../components/admin/ImageUploader', () => () => <div>Image upload</div>);
jest.mock('../../components/admin/StorefrontPreview', () => ({ config, device }) => <output data-testid="draft-preview" data-device={device}>{JSON.stringify(config)}</output>);

let theme;
const configInPreview = () => JSON.parse(screen.getByTestId('draft-preview').textContent);
beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  window.matchMedia = jest.fn(() => ({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() }));
  jest.spyOn(window, 'confirm').mockReturnValue(true);
  theme = { _id: 'theme-1', name: 'Current theme', updatedAt: '2026-09-01T00:00:00.000Z', isActive: true,
    draftConfig: mergeWebsiteConfig({ branding: { websiteName: 'My store' }, footer: { contactEmail: 'hello@example.com' } }) };
  theme.publishedConfig = theme.draftConfig;
  api.get.mockImplementation(async (path) => {
    if (path === '/admin/customization') return { selectedTheme: theme, themes: [theme],
      presets: [{ id: 'sage', name: 'Botanical Sage', swatches: { primary: '#31594c' }, config: mergeWebsiteConfig({ colors: { primary: '#31594c' }, theme: { preset: 'sage' } }) }] };
    if (path.endsWith('/history')) return [];
    if (path.endsWith('/themes')) return [theme];
    if (path.endsWith('/theme-1')) return theme;
    return [];
  });
  api.put.mockImplementation(async (path, body) => {
    theme = { ...theme, name: body.name, draftConfig: body.config, updatedAt: '2026-09-02T00:00:00.000Z' }; return theme;
  });
});
afterEach(() => jest.restoreAllMocks());

async function openDesigner() {
  render(<WebsiteCustomizer />);
  await screen.findByRole('tab', { name: 'Presets' });
}

test('preset apply, undo, redo and draft save preserve mobile and store identity', async () => {
  await openDesigner();
  fireEvent.click(screen.getByRole('button', { name: /Botanical Sage/ }));
  expect(configInPreview().colors.primary).toBe('#31594c');
  expect(configInPreview().branding.websiteName).toBe('My store');
  expect(configInPreview().mobile.enabled).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
  expect(configInPreview().colors.primary).toBe('#6d1f34');
  fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
  expect(configInPreview().colors.primary).toBe('#31594c');
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
  await screen.findByText('Draft saved. Your live storefront has not changed.');
  expect(api.put.mock.calls[0][1].expectedUpdatedAt).toBe('2026-09-01T00:00:00.000Z');
  expect(api.post).not.toHaveBeenCalled();
});

test('footer link typing keeps input focus instead of remounting after every character', async () => {
  await openDesigner();
  fireEvent.click(screen.getByRole('tab', { name: 'Footer' }));
  const input = screen.getAllByLabelText('Shopping menu link label')[0];
  userEvent.type(input, ' edited');
  expect(input).toHaveFocus();
  expect(input).toHaveValue('New Arrivals edited');
  expect(configInPreview().footer.menus.shopping[0].label).toBe('New Arrivals edited');
});

test('mobile overrides do not change desktop configuration', async () => {
  await openDesigner();
  const before = configInPreview();
  fireEvent.click(screen.getByRole('tab', { name: 'Mobile' }));
  fireEvent.click(screen.getByLabelText('Enable mobile overrides'));
  fireEvent.change(screen.getByLabelText('Products per row'), { target: { value: '1' } });
  const after = configInPreview();
  expect(after.mobile.enabled).toBe(true);
  expect(after.mobile.columns).toBe(1);
  expect(after.colors).toEqual(before.colors);
  expect(after.homepage).toEqual(before.homepage);
  expect(after.layout).toEqual(before.layout);
});

test('publishing requires review and a second explicit confirmation', async () => {
  await openDesigner();
  api.post.mockImplementation(async (path) => path.endsWith('/preflight')
    ? { ready: true, blocking: [], warnings: [], summary: { productsChecked: 0, categoriesChecked: 0, blocksChecked: 0 } }
    : { theme, version: { version: 2 } });
  fireEvent.click(screen.getByRole('button', { name: 'Review & publish' }));
  await screen.findByText('Storefront preflight passed');
  expect(api.post).toHaveBeenCalledWith('/admin/customization/themes/theme-1/preflight', expect.objectContaining({ expectedUpdatedAt: '2026-09-01T00:00:00.000Z' }));
  fireEvent.click(screen.getByRole('button', { name: 'Publish now' }));
  await screen.findByText('Published successfully as version 2.');
  expect(api.post).toHaveBeenCalledWith('/admin/customization/themes/theme-1/publish', expect.objectContaining({ expectedUpdatedAt: '2026-09-02T00:00:00.000Z' }));
});

test('a save conflict retains the edited draft and does not publish', async () => {
  await openDesigner();
  fireEvent.click(screen.getByRole('button', { name: /Botanical Sage/ }));
  api.put.mockRejectedValue(new Error('This theme was changed in another session.'));
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
  await screen.findByText('This theme was changed in another session.');
  expect(configInPreview().colors.primary).toBe('#31594c');
  expect(api.post).not.toHaveBeenCalled();
});

test('workspace failure displays a retry instead of an endless loader', async () => {
  api.get.mockRejectedValueOnce(new Error('Offline'));
  render(<WebsiteCustomizer />);
  await screen.findByRole('button', { name: 'Try again' });
  expect(screen.queryByText('Loading Website Designer…')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('tab', { name: 'Presets' })).toBeInTheDocument();
});

test('editor opens without waiting for catalog or history, and avoids fetching the selected theme twice', async () => {
  const originalGet = api.get.getMockImplementation();
  api.get.mockImplementation((path) => {
    if (path.includes('/history') || path.startsWith('/admin/products') || path === '/admin/categories') return new Promise(() => {});
    return originalGet(path);
  });
  await openDesigner();
  expect(api.get).not.toHaveBeenCalledWith('/admin/customization/themes/theme-1');
  expect(api.get.mock.calls.some(([path]) => path.startsWith('/admin/products'))).toBe(false);
  fireEvent.click(screen.getByRole('tab', { name: 'Desktop home' }));
  await screen.findByText(/Loading catalog choices/);
  expect(api.get).toHaveBeenCalledWith('/admin/products?customizationOptions=true&optionLimit=250');
  expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled();
});

test('home section fields are mounted only when opened, and changes survive closing and reopening', async () => {
  await openDesigner();
  fireEvent.click(screen.getByRole('tab', { name: 'Desktop home' }));
  await waitFor(() => expect(screen.queryByText(/Loading catalog choices/)).not.toBeInTheDocument());
  expect(screen.queryByLabelText('Heading')).not.toBeInTheDocument();
  const firstEdit = screen.getAllByRole('button', { name: /^Edit / })[0];
  fireEvent.click(firstEdit);
  fireEvent.change(screen.getByLabelText('Heading'), { target: { value: 'Edited hero' } });
  fireEvent.click(screen.getByRole('button', { name: /^Close / }));
  expect(screen.queryByLabelText('Heading')).not.toBeInTheDocument();
  fireEvent.click(firstEdit);
  expect(screen.getByLabelText('Heading')).toHaveValue('Edited hero');
});

test('invalid input keeps the preview component mounted and save remains blocked', async () => {
  await openDesigner();
  const preview = screen.getByTestId('draft-preview');
  fireEvent.click(screen.getByRole('tab', { name: 'Colors' }));
  fireEvent.change(screen.getByLabelText('Primary hex'), { target: { value: '#' } });
  expect(screen.getByTestId('draft-preview')).toBe(preview);
  expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
});

test('10,000 catalog options render at most 40 rows and remain searchable/selectable across pages', () => {
  const options = Array.from({ length: 10000 }, (_, i) => ({ value: String(i), label: `Product ${i}` }));
  const onChange = jest.fn();
  render(<MultiSelect label="Catalog" options={options} value={['9999']} onChange={onChange} />);
  expect(screen.getAllByRole('checkbox')).toHaveLength(40);
  fireEvent.click(screen.getByRole('button', { name: 'Next Catalog results' }));
  expect(screen.getByLabelText('Product 40')).toBeInTheDocument();
  expect(screen.getAllByRole('checkbox')).toHaveLength(40);
  fireEvent.change(screen.getByLabelText('Search Catalog'), { target: { value: 'Product 9999' } });
  expect(screen.getAllByRole('checkbox')).toHaveLength(1);
  fireEvent.click(screen.getByLabelText('Product 9999'));
  expect(onChange).toHaveBeenLastCalledWith([]);
});

test('setting search opens quick styling; grouped changes save through the existing draft API', async () => {
  await openDesigner();
  fireEvent.change(screen.getByLabelText('Find a design setting'), { target: { value: 'density' } });
  fireEvent.click(screen.getByRole('button', { name: 'Quick styling' }));
  fireEvent.click(screen.getByRole('button', { name: /Compact More products/ }));
  expect(configInPreview().layout.productsPerRow.desktop).toBe(5);
  fireEvent.click(screen.getByRole('button', { name: 'Match mobile appearance' }));
  expect(configInPreview().mobile.enabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
  await screen.findByText('Draft saved. Your live storefront has not changed.');
  expect(api.put).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ config: expect.objectContaining({ mobile: expect.objectContaining({ enabled: true }), layout: expect.objectContaining({ productsPerRow: expect.objectContaining({ desktop: 5 }) }) }) }));
  expect(api.post).not.toHaveBeenCalled();
});

test('saved comparison preserves current edits and the preview instance; restoring a panel is undoable', async () => {
  await openDesigner();
  const original = configInPreview();
  const preview = screen.getByTestId('draft-preview');
  fireEvent.click(screen.getByRole('button', { name: /Apply Botanical Sage/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Compare with saved draft' }));
  expect(configInPreview()).toEqual(original);
  fireEvent.click(screen.getByRole('button', { name: 'Back to current draft' }));
  expect(configInPreview().colors.primary).toBe('#31594c');
  expect(screen.getByTestId('draft-preview')).toBe(preview);
  fireEvent.click(screen.getByRole('tab', { name: 'Colors' }));
  fireEvent.click(screen.getByRole('button', { name: 'Restore this panel to saved' }));
  expect(configInPreview().colors).toEqual(original.colors);
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
  expect(configInPreview().colors.primary).toBe('#31594c');
});

test('preset search and mobile opt-in keep content and can be undone together', async () => {
  await openDesigner();
  const original = configInPreview();
  fireEvent.change(screen.getByLabelText('Search presets'), { target: { value: 'not a preset' } });
  expect(screen.queryByRole('button', { name: /Apply Botanical Sage/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  fireEvent.click(screen.getByLabelText('Also match mobile card corners'));
  fireEvent.click(screen.getByRole('button', { name: /Apply Botanical Sage/ }));
  expect(configInPreview().mobile.enabled).toBe(true);
  expect(configInPreview().homepage).toEqual(original.homepage);
  expect(configInPreview().mobile.sections).toEqual(original.mobile.sections);
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
  expect(configInPreview()).toEqual(original);
});

test('selected product ordering and footer link ordering are controllable without retyping', async () => {
  const onChange = jest.fn();
  const { unmount } = render(<MultiSelect label="Catalog" value={['b', 'a']} options={[{ value: 'a', label: 'First' }, { value: 'b', label: 'Second' }]} onChange={onChange} />);
  fireEvent.click(screen.getByText('Arrange selected items (2)'));
  fireEvent.click(screen.getByRole('button', { name: 'Move selected item 2 up' }));
  expect(onChange).toHaveBeenLastCalledWith(['a', 'b']);
  unmount();
  await openDesigner();
  const menus = configInPreview().footer.menus.shopping;
  fireEvent.click(screen.getByRole('tab', { name: 'Footer' }));
  fireEvent.click(screen.getByRole('button', { name: 'Shopping menu link 2 up' }));
  expect(configInPreview().footer.menus.shopping.slice(0, 2)).toEqual([menus[1], menus[0]]);
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
  expect(configInPreview().footer.menus.shopping).toEqual(menus);
});

test('seller studio saves through tenant routes and keeps master theme controls hidden', async () => {
  const sellerConfig = mergeWebsiteConfig({ branding: { websiteName: 'Client store' } });
  api.get.mockImplementation(async (path) => {
    if (path === '/seller/design') return {
      store: { id: 'store-7', name: 'Client store', slug: 'client-store' },
      platform: { name: 'Growth', status: 'ACTIVE' },
      draftConfig: sellerConfig,
      publishedConfig: sellerConfig,
      preset: 'default',
      revision: 4,
      presets: [{ id: 'sage', name: 'Botanical Sage', swatches: { primary: '#31594c' }, config: mergeWebsiteConfig({ colors: { primary: '#31594c' }, theme: { preset: 'sage' } }) }],
      managedFields: [],
    };
    if (path === '/seller/design/history') return [];
    return [];
  });
  api.put.mockResolvedValue({ draftConfig: sellerConfig, revision: 5, updatedAt: '2026-09-10T00:00:00.000Z' });

  render(<WebsiteCustomizer mode="seller" />);
  await screen.findByRole('heading', { name: 'Storefront Studio' });
  expect(screen.queryByRole('button', { name: 'Duplicate' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Delete theme' })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
  await screen.findByText('Draft saved. Your live storefront has not changed.');
  expect(api.put).toHaveBeenCalledWith('/seller/design', expect.objectContaining({ expectedRevision: 4 }));
  expect(api.get).not.toHaveBeenCalledWith('/admin/customization');
});
