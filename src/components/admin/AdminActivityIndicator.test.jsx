import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import AdminActivityIndicator from './AdminActivityIndicator';
import { beginAdminActivity, beginAdminRequest, getAdminActivitySnapshot, installAdminActionGuard } from '../../utils/adminActivity';

let operations;
const start = options => { const operation = beginAdminActivity(options); operations.push(operation); return operation; };
beforeEach(() => { operations = []; jest.useFakeTimers(); window.history.replaceState(null, '', '/admin/products'); });
afterEach(() => { act(() => operations.forEach(operation => operation.finish())); jest.useRealTimers(); window.history.replaceState(null, '', '/'); });

test('fast reads finish without a flashing loader; concurrent work stays visible until every operation finishes', () => {
  render(<AdminActivityIndicator enabled />);
  let quick;
  act(() => { quick = start({ label: 'Loading products' }); });
  act(() => { jest.advanceTimersByTime(100); quick.finish(); jest.advanceTimersByTime(200); });
  expect(screen.queryByLabelText('Admin progress')).not.toBeInTheDocument();
  let read, write;
  act(() => { read = start({ label: 'Loading products' }); write = start({ kind: 'saving', label: 'Saving changes' }); });
  act(() => jest.advanceTimersByTime(200));
  expect(screen.getAllByLabelText('Admin progress')).toHaveLength(1);
  expect(screen.getByLabelText('Admin progress')).toHaveTextContent('Saving changes');
  act(() => write.finish());
  expect(screen.getByLabelText('Admin progress')).toHaveTextContent('Loading products');
  act(() => read.finish());
  expect(screen.queryByLabelText('Admin progress')).not.toBeInTheDocument();
  read.finish(); expect(getAdminActivitySnapshot().count).toBe(0);
});

test('repeated clicks and Enter submits are blocked only for the active form; cancel and other navigation still work', () => {
  const submit = jest.fn(), cancel = jest.fn(), navigate = jest.fn();
  let operation;
  render(<><AdminActivityIndicator enabled /><form aria-label="Product editor" onSubmit={event => { event.preventDefault(); submit(); operation = start({ kind: 'saving', label: 'Saving product' }); }}>
    <button type="submit">Save product</button><button type="button" onClick={cancel}>Cancel</button>
  </form><button type="button" onClick={navigate}>Open orders</button></>);
  const save = screen.getByRole('button', { name: 'Save product' });
  fireEvent.click(save); fireEvent.click(save); fireEvent.submit(screen.getByRole('form'));
  expect(submit).toHaveBeenCalledTimes(1); expect(save).toHaveAttribute('aria-busy', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); fireEvent.click(screen.getByRole('button', { name: 'Open orders' }));
  expect(cancel).toHaveBeenCalledTimes(1); expect(navigate).toHaveBeenCalledTimes(1);
  act(() => operation.finish()); // The same cleanup runs on success, failure and abort.
  expect(save).not.toHaveAttribute('aria-busy'); expect(save).not.toHaveAttribute('aria-disabled');
  fireEvent.click(save); expect(submit).toHaveBeenCalledTimes(2);
});

test('the initiating control stays guarded across overlapping requests and its original accessibility state is restored', () => {
  const cleanup = installAdminActionGuard();
  const button = document.createElement('button'); button.textContent = 'Refresh'; button.setAttribute('aria-busy', 'false'); document.body.append(button);
  fireEvent.click(button);
  const first = start({ label: 'Loading products' }), second = start({ label: 'Loading categories' });
  first.finish(); expect(button).toHaveAttribute('data-admin-loading-action');
  second.finish(); expect(button).toHaveAttribute('aria-busy', 'false'); expect(button).not.toHaveAttribute('aria-disabled');
  cleanup(); button.remove();
});

test('long requests show honest wait guidance and leaving admin restores the controls immediately', () => {
  let operation;
  const { rerender } = render(<><AdminActivityIndicator enabled /><button onClick={() => { operation = start({ kind: 'uploading', label: 'Uploading photos' }); }}>Upload</button></>);
  fireEvent.click(screen.getByRole('button', { name: 'Upload' }));
  act(() => jest.advanceTimersByTime(10100));
  expect(screen.getByLabelText('Admin progress')).toHaveTextContent('Taking a little longer');
  expect(document.body.style.overflow).not.toBe('hidden');
  rerender(<><AdminActivityIndicator enabled={false} /><button>Upload</button></>);
  expect(screen.queryByLabelText('Admin progress')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Upload' })).not.toHaveAttribute('data-admin-loading-action');
  act(() => operation.finish());
});

test('silent admin reads are tracked while notification, analytics, cached background reads and storefront work stay quiet', () => {
  for (const path of ['/notifications/summary', '/analytics/config', '/cart', '/wishlist', '/auth/refresh']) {
    const operation = beginAdminRequest({ url: path, silent: true }); operation.finish();
    expect(getAdminActivitySnapshot().active).toBe(false);
  }
  beginAdminRequest({ url: '/admin/products', silentWhenCached: true }, { cached: true }).finish();
  expect(getAdminActivitySnapshot().active).toBe(false);
  const admin = beginAdminRequest({ url: '/admin/rentals/listings', silent: true }); operations.push(admin);
  expect(getAdminActivitySnapshot().active).toBe(true); admin.finish();
  window.history.replaceState(null, '', '/products');
  beginAdminRequest('/products').finish(); expect(getAdminActivitySnapshot().active).toBe(false);
});
