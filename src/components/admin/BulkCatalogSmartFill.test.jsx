import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import BulkCatalogSmartFill from './BulkCatalogSmartFill';
import api from '../../services/api';
jest.mock('../../services/api', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
const record = id => ({ id, name: 'Product ' + id, updatedAt: '2026-10-01T01:00:00.000Z', current: { description: '' }, suggestions: [{ path: 'description', label: 'Description', value: 'Reviewed product copy', source: 'database' }] });
beforeEach(() => { jest.resetAllMocks(); jest.spyOn(window, 'confirm').mockReturnValue(true); });
afterEach(() => jest.restoreAllMocks());
test('bounded batch preview/apply never saves; explicit save is safe-field only and uses its revision', async () => {
  api.post.mockResolvedValueOnce({ records: [record('one')] }).mockResolvedValueOnce({ savedFields: ['description'] });
  const saved = jest.fn(); render(<BulkCatalogSmartFill ids={['one']} apiBase="/admin/smart-fill?storeId=store" onSaved={saved} onClose={jest.fn()} />);
  expect(api.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /Prepare 1/ }));
  await screen.findByText('Product one');
  fireEvent.click(screen.getByRole('button', { name: /Apply 1/ }));
  expect(api.post).toHaveBeenCalledTimes(1); expect(screen.getByText('1 fields staged. Not saved yet.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Save 1 reviewed products' }));
  await screen.findByText('Reviewed content saved.');
  expect(api.post.mock.calls[1][0]).toBe('/admin/smart-fill/catalog/save?storeId=store');
  expect(api.post.mock.calls[1][1]).toEqual({ id: 'one', expectedUpdatedAt: record('one').updatedAt, changes: { description: 'Reviewed product copy' } });
  expect(saved).toHaveBeenCalledWith(1);
});
test('partial saves display each outcome and uncertain failures are not automatically retried', async () => {
  api.post.mockResolvedValueOnce({ records: [record('one'), record('two')] }).mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('Revision changed'));
  const saved = jest.fn(); render(<BulkCatalogSmartFill ids={['one', 'two']} apiBase="/seller/smart-fill" onSaved={saved} onClose={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /Prepare 2/ })); await screen.findByText('Product two');
  screen.getAllByRole('button', { name: /Apply 1/ }).forEach(button => fireEvent.click(button));
  fireEvent.click(screen.getByRole('button', { name: 'Save 2 reviewed products' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Revision changed');
  expect(saved).toHaveBeenCalledWith(1); expect(api.post).toHaveBeenCalledTimes(3);
  expect(screen.getByRole('button', { name: 'Save 0 reviewed products' })).toBeDisabled();
});
test('selection changes abort old previews and reject wrong product IDs rather than silently applying them', async () => {
  let resolve; api.post.mockReturnValueOnce(new Promise(done => { resolve = done; })).mockResolvedValueOnce({ records: [record('foreign')] });
  const view = render(<BulkCatalogSmartFill ids={['one']} apiBase="/admin/smart-fill" onClose={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /Prepare 1/ })); const signal = api.post.mock.calls[0][2].signal;
  view.rerender(<BulkCatalogSmartFill ids={['two']} apiBase="/admin/smart-fill" onClose={jest.fn()} />);
  expect(signal.aborted).toBe(true);
  await act(async () => resolve({ records: [record('one')] }));
  expect(screen.queryByText('Product one')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Prepare 1/ }));
  expect(await screen.findByRole('alert')).toHaveTextContent('incomplete');
});
test('more than 20 selected products are not analyzed', () => {
  render(<BulkCatalogSmartFill ids={Array.from({ length: 21 }, (_, index) => String(index))} apiBase="/admin/smart-fill" onClose={jest.fn()} />);
  expect(screen.getByRole('button', { name: /Prepare 21/ })).toBeDisabled(); expect(api.post).not.toHaveBeenCalled();
});
test('busy batch announces its state and staged drafts require confirmation before closing', async () => {
  const close = jest.fn(), busy = jest.fn(); api.post.mockResolvedValue({ records: [record('one')] });
  render(<BulkCatalogSmartFill ids={['one']} apiBase="/admin/smart-fill" onClose={close} onBusyChange={busy} />);
  fireEvent.click(screen.getByRole('button', { name: /Prepare 1/ }));
  await screen.findByText('Product one'); await waitFor(() => expect(busy).toHaveBeenCalledWith(false));
  expect(busy).toHaveBeenCalledWith(true);
  fireEvent.click(screen.getByRole('button', { name: /Apply 1/ }));
  window.confirm.mockReturnValue(false); fireEvent.click(screen.getByRole('button', { name: 'Close' })); expect(close).not.toHaveBeenCalled();
  window.confirm.mockReturnValue(true); fireEvent.click(screen.getByRole('button', { name: 'Close' })); expect(close).toHaveBeenCalledTimes(1);
});
