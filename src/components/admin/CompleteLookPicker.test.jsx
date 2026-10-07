import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CompleteLookPicker from './CompleteLookPicker';
import api from '../../services/api';
jest.mock('../../services/api', () => ({ get: jest.fn() }));
beforeEach(() => { jest.clearAllMocks(); });
test('picker searches this store endpoint, excludes itself and requires an explicit selection', async () => {
  api.get.mockResolvedValue({ items: [{ _id: 'source', name: 'Lehenga' }, { _id: 'match', name: 'Necklace', isActive: true }] });
  const onChange = jest.fn(); render(<CompleteLookPicker apiPrefix="/seller" productId="source" onChange={onChange} />);
  fireEvent.change(screen.getByLabelText('Find matching products'), { target: { value: ' gold ' } });
  expect(fireEvent.keyDown(screen.getByLabelText('Find matching products'), { key: 'Enter' })).toBe(false);
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Necklace' }));
  expect(api.get).toHaveBeenCalledWith('/seller/products?search=gold&page=1&limit=12', { silent: true });
  expect(screen.queryByRole('checkbox', { name: 'Lehenga' })).not.toBeInTheDocument();
  expect(onChange).toHaveBeenCalledTimes(1); expect(onChange).toHaveBeenCalledWith(['match']);
});
test('selection cap permits removal and blocks adding a ninth matching item', async () => {
  api.get.mockImplementation(path => Promise.resolve(path.includes('?') ? [{ _id: 'new', name: 'New necklace', isActive: true }] : { name: 'Existing match' }));
  const onChange = jest.fn(); const value = Array.from({ length: 8 }, (_, n) => `item-${n}`);
  render(<CompleteLookPicker apiPrefix="/admin" value={value} onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: 'Find products' }));
  expect(await screen.findByRole('checkbox', { name: 'New necklace' })).toBeDisabled();
  await waitFor(() => expect(screen.getAllByRole('button', { name: /Remove Existing match/ })).toHaveLength(8));
  fireEvent.click(screen.getAllByRole('button', { name: /Remove Existing match/ })[0]);
  expect(onChange).toHaveBeenCalledWith(value.slice(1));
});
