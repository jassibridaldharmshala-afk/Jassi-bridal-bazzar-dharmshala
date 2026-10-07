import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ProductCatalogManager from './ProductCatalogManager';
import api from '../../services/api';
jest.mock('../../services/api', () => ({ get: jest.fn(), delete: jest.fn() }));
jest.mock('../../utils/catalogOptions', () => ({ fetchCategories: async () => [] }));
jest.mock('../../components/admin/ProductForm', () => () => null);
jest.mock('../../components/admin/BulkCatalogSmartFill', () => () => null);
jest.mock('../../components/admin/ProductPosterModal', () => () => null);
jest.mock('../../components/admin/ProductCaptionModal', () => () => null);
const product = { _id: 'product-a', name: 'Rose saree', price: 1000, stock: 2, isArchived: true, isActive: false, images: [] };
beforeEach(() => {
  jest.resetAllMocks();
  api.get.mockImplementation(async path => path.includes('deletion-preview') ? { name: product.name, archived: true, eligible: true, transactions: true, confirmation: product.name, stock: 2, version: 'review', blockers: [], cleanup: {} }
    : path.includes('/products?') ? { items: [product], total: 1, totalPages: 1 } : {});
  api.delete.mockResolvedValue({ success: true });
});
test.each([true, false])('delete action works in %s desktop layout and removes row/selection after success', async desktop => {
  const original = window.matchMedia;
  window.matchMedia = () => ({ matches: desktop, addEventListener: jest.fn(), removeEventListener: jest.fn() });
  try {
    render(<ProductCatalogManager />);
    fireEvent.click(await screen.findByRole('button', { name: 'Select Rose saree' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Rose saree permanently' }));
    const dialog = within(await screen.findByRole('dialog'));
    await dialog.findByRole('textbox');
    fireEvent.change(dialog.getByRole('textbox'), { target: { value: product.name } });
    fireEvent.click(dialog.getByRole('checkbox'));
    api.get.mockImplementation(async path => path.includes('/products?') ? { items: [], total: 0, totalPages: 1 } : {});
    fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/admin/products/product-a/permanent', { confirm: product.name, version: 'review' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Delete Rose saree permanently' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Export 1' })).not.toBeInTheDocument();
  } finally { window.matchMedia = original; }
});
