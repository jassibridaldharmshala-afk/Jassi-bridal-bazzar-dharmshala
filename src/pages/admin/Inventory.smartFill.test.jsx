import '@testing-library/jest-dom';
import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PurchaseOrderDialog } from './Inventory';
import api from '../../services/api';
jest.mock('../../services/api', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
const productId = '1234567890abcdef12345678', variantId = '2234567890abcdef12345678';
const key = productId + ':' + variantId;
const source = { suggestions: [
  { path: 'supplier.name', value: 'Verified supplier', label: 'Supplier name', source: 'notes' },
  { path: 'items', value: [{ selection: key, quantity: 5, unitCost: 250 }], label: 'Invoice lines', source: 'notes', attention: true },
], purchaseOptions: [{ key, productId, variantId, sku: 'SKU-V1', name: 'Matched product' }] };
function Form({ onSaved }) {
  const [value, setValue] = useState({ supplier: { name: '', phone: '', email: '' }, expectedAt: '', notes: '', items: [{ selection: '', quantity: 1, unitCost: 0 }] });
  return <PurchaseOrderDialog base="/admin" value={value} setValue={setValue} options={[]} onClose={jest.fn()} onSaved={onSaved} />;
}
beforeEach(() => { jest.resetAllMocks(); api.get.mockResolvedValue({ documentExtraction: false }); });
test('invoice matches add missing catalog selections to the draft, while actual purchase/receiving remain explicit', async () => {
  api.post.mockResolvedValueOnce(source).mockResolvedValueOnce({ number: 'PO-1', supplier: { name: 'Verified supplier' } });
  const saved = jest.fn(); render(<Form onSaved={saved} />);
  fireEvent.click(screen.getByRole('button', { name: /Supplier invoice Smart Fill/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Suggest draft fields' }));
  await screen.findByText('Invoice lines');
  fireEvent.click(screen.getByLabelText('Allow replacing selected existing values'));
  fireEvent.click(screen.getByRole('button', { name: 'Select eligible fields' }));
  fireEvent.click(screen.getByLabelText(/I checked these financial/));
  fireEvent.click(screen.getByRole('button', { name: /Apply 2/ }));
  expect(screen.getByLabelText('Purchase product 1')).toHaveValue(key);
  expect(screen.getByLabelText('Purchase quantity 1')).toHaveValue(5); expect(screen.getByLabelText('Unit cost 1')).toHaveValue(250);
  expect(api.post).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Create purchase order' }));
  await waitFor(() => expect(saved).toHaveBeenCalled());
  expect(api.post.mock.calls[1]).toEqual(['/admin/inventory/purchase-orders', expect.objectContaining({ supplier: { name: 'Verified supplier', phone: '', email: '' }, items: [{ productId, variantId, quantity: 5, unitCost: 250 }] })]);
  expect(api.post.mock.calls.some(([path]) => path.includes('/receive'))).toBe(false);
});
test('incomplete invoice metadata cannot create unknown product lines or show false success', async () => {
  api.post.mockResolvedValue({ ...source, purchaseOptions: [] }); render(<Form onSaved={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /Supplier invoice Smart Fill/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Suggest draft fields' })); await screen.findByText('Invoice lines');
  fireEvent.click(screen.getByLabelText('Allow replacing selected existing values')); fireEvent.click(screen.getByRole('button', { name: 'Select eligible fields' }));
  fireEvent.click(screen.getByLabelText(/I checked these financial/)); fireEvent.click(screen.getByRole('button', { name: /Apply 2/ }));
  expect(screen.getByRole('alert')).toHaveTextContent('incomplete');
  expect(screen.getByLabelText('Purchase product 1')).toHaveValue('');
  expect(screen.getByRole('button', { name: 'Create purchase order' })).toBeDisabled(); expect(api.post).toHaveBeenCalledTimes(1);
});
