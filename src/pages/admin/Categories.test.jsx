import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Categories from './Categories';
import api from '../../services/api';

jest.mock('../../services/api', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('./Products', () => ({ AdminTable: () => <div>Category table</div> }));
jest.mock('../../components/admin/CategoryForm', () => () => null);
jest.mock('../../components/admin/SearchFilterBar', () => ({ children }) => <div>{children}</div>);
jest.mock('../../components/admin/StatusBadge', () => ({ value }) => <span>{value}</span>);
jest.mock('../../components/admin/PageHeader', () => ({ title, children }) => <header><h1>{title}</h1>{children}</header>);

test('admin can add missing bridal categories without exposing them immediately', async () => {
  api.get.mockImplementation(async path => path === '/admin/categories/bridal-setup'
    ? { missing: ['Bridal Jewellery', 'Jaimala & Varmala'], existing: ['Lehengas'], archived: [], conflicts: [], structureUpdated: true }
    : []);
  api.post.mockResolvedValue({ created: ['Bridal Jewellery', 'Jaimala & Varmala'], missing: [], existing: ['Lehengas'], archived: [], conflicts: [], structureUpdated: false });
  render(<Categories />);
  fireEvent.click(await screen.findByRole('button', { name: 'Add bridal categories' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/categories/bridal-setup', {}));
  expect(await screen.findByText(/2 bridal categories added as hidden/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Add bridal categories' })).not.toBeInTheDocument();
});
