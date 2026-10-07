import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProductDeleteDialog from './ProductDeleteDialog';
import api from '../../services/api';

jest.mock('../../services/api', () => ({ get: jest.fn(), delete: jest.fn() }));
const product = { _id: 'product-a', name: 'Rose saree' };
const review = { name: product.name, archived: true, eligible: true, transactions: true, confirmation: product.name,
  version: 'fresh-review', stock: 4, blockers: [], cleanup: { carts: 2, wishlists: 3 }, mediaPolicy: 'Uploaded files are retained to protect shared images and import sources.' };
let props;
beforeEach(() => {
  jest.resetAllMocks();
  api.get.mockResolvedValue(review); api.delete.mockResolvedValue({ success: true });
  props = { product, productsPath: '/admin/products', onClose: jest.fn(), onDeleted: jest.fn(), onArchived: jest.fn() };
});
const ready = async () => screen.findByRole('button', { name: 'Delete permanently' });
const confirm = () => {
  fireEvent.change(screen.getByRole('textbox'), { target: { value: product.name } });
  fireEvent.click(screen.getByRole('checkbox'));
};

test('requires typed name and explicit stock-loss acknowledgement before deletion', async () => {
  render(<ProductDeleteDialog {...props} />);
  const button = await ready();
  expect(button).toBeDisabled();
  expect(screen.getByText(/listing and its 4 available units/)).toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: product.name } });
  expect(button).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(button); fireEvent.click(button);
  await waitFor(() => expect(props.onDeleted).toHaveBeenCalledWith('product-a'));
  expect(api.delete).toHaveBeenCalledTimes(1);
  expect(api.delete).toHaveBeenCalledWith('/admin/products/product-a/permanent', { confirm: 'Rose saree', version: 'fresh-review' });
});

test('active products are explicitly archived and rechecked before deletion', async () => {
  api.get.mockResolvedValueOnce({ ...review, archived: false, eligible: false }).mockResolvedValueOnce(review);
  render(<ProductDeleteDialog {...props} />);
  const archive = await screen.findByRole('button', { name: 'Archive product' });
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  fireEvent.click(archive);
  await ready();
  expect(api.delete).toHaveBeenCalledWith('/admin/products/product-a');
  expect(api.get).toHaveBeenCalledTimes(2);
  expect(props.onArchived).toHaveBeenCalledTimes(1);
  expect(props.onDeleted).not.toHaveBeenCalled();
});

test('linked history explains blockers and offers no destructive confirmation', async () => {
  api.get.mockResolvedValue({ ...review, eligible: false, blockers: [{ key: 'rentals', label: 'Rental booking history', count: 2 }] });
  render(<ProductDeleteDialog {...props} />);
  expect(await screen.findByText('Rental booking history')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Delete permanently' })).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(api.delete).not.toHaveBeenCalled();
});

test('transaction-unavailable deployments keep archive available without a delete button', async () => {
  api.get.mockResolvedValue({ ...review, transactions: false, eligible: false, archived: false });
  render(<ProductDeleteDialog {...props} />);
  expect(await screen.findByText('Safe deletion is unavailable')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Archive product' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'Delete permanently' })).not.toBeInTheDocument();
});

test('preview errors have a retry and never expose a working delete button', async () => {
  api.get.mockRejectedValueOnce(new Error('Review unavailable')).mockResolvedValueOnce(review);
  render(<ProductDeleteDialog {...props} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Review unavailable');
  fireEvent.click(screen.getByRole('button', { name: 'Retry checks' }));
  expect(await ready()).toBeDisabled();
});

test('a stale review refreshes checks and requires new confirmation', async () => {
  api.delete.mockRejectedValueOnce(Object.assign(new Error('This product changed.'), { status: 409 }));
  render(<ProductDeleteDialog {...props} />);
  const button = await ready(); confirm(); fireEvent.click(button);
  expect(await screen.findByRole('alert')).toHaveTextContent('Review the latest checks');
  expect(screen.getByRole('textbox')).toHaveValue('');
  expect(screen.getByRole('checkbox')).not.toBeChecked();
  expect(screen.getByRole('button', { name: 'Delete permanently' })).toBeDisabled();
  expect(props.onDeleted).not.toHaveBeenCalled();
});

test('pending deletion cannot be cancelled or double submitted', async () => {
  let finish;
  api.delete.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  render(<ProductDeleteDialog {...props} />);
  const button = await ready(); confirm(); fireEvent.click(button);
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(props.onClose).not.toHaveBeenCalled();
  await act(async () => finish({ success: true }));
  expect(props.onDeleted).toHaveBeenCalledTimes(1);
});

test('keyboard focus stays in the dialog and closing restores scroll/focus', async () => {
  const trigger = document.createElement('button'); document.body.appendChild(trigger); trigger.focus();
  const view = render(<ProductDeleteDialog {...props} />);
  await ready();
  expect(screen.getByRole('dialog')).toHaveFocus();
  expect(document.body.style.overflow).toBe('hidden');
  fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
  expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(props.onClose).toHaveBeenCalledTimes(1);
  view.unmount();
  expect(document.body.style.overflow).not.toBe('hidden');
  expect(trigger).toHaveFocus(); trigger.remove();
});

test('seller deletion uses the scoped seller endpoint', async () => {
  render(<ProductDeleteDialog {...props} productsPath="/seller/products" />);
  const button = await ready(); confirm(); fireEvent.click(button);
  await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/seller/products/product-a/permanent', expect.objectContaining({ version: 'fresh-review' })));
});
