import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RentalBagProvider, useRentalBag } from './RentalBagContext';
let mockUser = null, mockStore = 'a';
jest.mock('./AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('./StorefrontContext', () => ({ useStorefront: () => ({ storeSlug: mockStore }) }));
const id = '700000000000000000000001';
function Bag() { const bag = useRentalBag(); return <><p>{bag.itemCount}</p><button onClick={() => bag.add(id)}>Add</button><button onClick={() => bag.addMany([{ listingId: '700000000000000000000002', quantity: 1 }, { listingId: '700000000000000000000003', quantity: 2 }])}>Append look</button><button onClick={() => bag.consume([{ listingId: id, quantity: 1 }], 'booking-one')}>Purchased</button></>; }
beforeEach(() => { sessionStorage.clear(); mockUser = null; mockStore = 'a'; });
test('look append preserves previous quantities and survives sign-in remount', () => {
  const view = render(<RentalBagProvider storeSlug="a"><Bag /></RentalBagProvider>);
  fireEvent.click(screen.getByText('Add')); fireEvent.click(screen.getByText('Add')); fireEvent.click(screen.getByText('Append look')); expect(screen.getByText('5')).toBeInTheDocument(); view.unmount();
  render(<RentalBagProvider user={{ _id: 'one' }} storeSlug="a"><Bag /></RentalBagProvider>); expect(screen.getByText('5')).toBeInTheDocument();
  const { readRentalSession } = require('../utils/rentalPlan'); expect(readRentalSession('bag', 'a', 'one').items.find(row => row.listingId === id).quantity).toBe(2);
});
test('guest bag follows sign-in, while other accounts and stores stay separate and booking cleanup is idempotent', async () => {
  const view = render(<RentalBagProvider user={mockUser} storeSlug={mockStore}><Bag /></RentalBagProvider>); fireEvent.click(screen.getByText('Add')); fireEvent.click(screen.getByText('Add')); expect(screen.getByText('2')).toBeInTheDocument();
  mockUser = { _id: 'one' }; await act(async () => view.rerender(<RentalBagProvider user={mockUser} storeSlug={mockStore}><Bag /></RentalBagProvider>)); expect(screen.getByText('2')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Purchased')); fireEvent.click(screen.getByText('Purchased')); expect(screen.getByText('1')).toBeInTheDocument();
  mockUser = { _id: 'two' }; await act(async () => view.rerender(<RentalBagProvider user={mockUser} storeSlug={mockStore}><Bag /></RentalBagProvider>)); expect(screen.getByText('0')).toBeInTheDocument();
  mockUser = { _id: 'one' }; await act(async () => view.rerender(<RentalBagProvider user={mockUser} storeSlug={mockStore}><Bag /></RentalBagProvider>)); expect(screen.getByText('1')).toBeInTheDocument();
  mockStore = 'b'; await act(async () => view.rerender(<RentalBagProvider user={mockUser} storeSlug={mockStore}><Bag /></RentalBagProvider>)); expect(screen.getByText('0')).toBeInTheDocument();
});

test('OTP account-provider remount adopts the guest selection once without mixing other accounts', async () => {
  const guest = render(<StrictMode><RentalBagProvider storeSlug="a"><Bag /></RentalBagProvider></StrictMode>);
  fireEvent.click(screen.getByText('Add')); fireEvent.click(screen.getByText('Add'));
  guest.unmount();
  const signedIn = render(<StrictMode><RentalBagProvider user={{ _id: 'one' }} storeSlug="a"><Bag /></RentalBagProvider></StrictMode>);
  expect(screen.getByText('2')).toBeInTheDocument();
  expect(sessionStorage.getItem('rental-bag:a:')).toBeNull();
  signedIn.unmount();
  const again = render(<RentalBagProvider user={{ _id: 'one' }} storeSlug="a"><Bag /></RentalBagProvider>);
  expect(screen.getByText('2')).toBeInTheDocument(); again.unmount();
  render(<RentalBagProvider user={{ _id: 'two' }} storeSlug="a"><Bag /></RentalBagProvider>);
  expect(screen.getByText('0')).toBeInTheDocument();
});

test('simultaneous look additions enforce the capacity atomically and preserve every existing item', () => {
  function ConcurrentAdds() { const bag = useRentalBag(); return <><output>{bag.items.length}</output><button onClick={() => {
    const first = Array.from({ length: 10 }, (_, i) => ({ listingId: (i + 1).toString(16).padStart(24, '0'), quantity: 1 }));
    expect(bag.addMany(first)).toBe(true); expect(bag.addMany([{ listingId: '700000000000000000000099', quantity: 1 }])).toBe(false);
  }}>Concurrent additions</button></>; }
  render(<RentalBagProvider storeSlug="a"><ConcurrentAdds /></RentalBagProvider>); fireEvent.click(screen.getByText('Concurrent additions')); expect(screen.getByText('10')).toBeInTheDocument();
});
