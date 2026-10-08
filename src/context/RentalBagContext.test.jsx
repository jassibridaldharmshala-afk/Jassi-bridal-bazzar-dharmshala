import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RentalBagProvider, useRentalBag } from './RentalBagContext';
let mockUser = null, mockStore = 'a';
jest.mock('./AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('./StorefrontContext', () => ({ useStorefront: () => ({ storeSlug: mockStore }) }));
const id = '700000000000000000000001';
function Bag() { const bag = useRentalBag(); return <><p>{bag.itemCount}</p><button onClick={() => bag.add(id)}>Add</button><button onClick={() => bag.consume([{ listingId: id, quantity: 1 }], 'booking-one')}>Purchased</button></>; }
beforeEach(() => { sessionStorage.clear(); mockUser = null; mockStore = 'a'; });
test('guest bag follows sign-in, while other accounts and stores stay separate and booking cleanup is idempotent', async () => {
  const view = render(<RentalBagProvider user={mockUser} storeSlug={mockStore}><Bag /></RentalBagProvider>); fireEvent.click(screen.getByText('Add')); fireEvent.click(screen.getByText('Add')); expect(screen.getByText('2')).toBeInTheDocument();
  mockUser = { _id: 'one' }; await act(async () => view.rerender(<RentalBagProvider user={mockUser} storeSlug={mockStore}><Bag /></RentalBagProvider>)); expect(screen.getByText('2')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Purchased')); fireEvent.click(screen.getByText('Purchased')); expect(screen.getByText('1')).toBeInTheDocument();
  mockUser = { _id: 'two' }; await act(async () => view.rerender(<RentalBagProvider user={mockUser} storeSlug={mockStore}><Bag /></RentalBagProvider>)); expect(screen.getByText('0')).toBeInTheDocument();
  mockUser = { _id: 'one' }; await act(async () => view.rerender(<RentalBagProvider user={mockUser} storeSlug={mockStore}><Bag /></RentalBagProvider>)); expect(screen.getByText('1')).toBeInTheDocument();
  mockStore = 'b'; await act(async () => view.rerender(<RentalBagProvider user={mockUser} storeSlug={mockStore}><Bag /></RentalBagProvider>)); expect(screen.getByText('0')).toBeInTheDocument();
});
