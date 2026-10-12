import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import RentalCheckout from './RentalCheckout';
import api from '../../services/api';

const listingId = '700000000000000000000001', productId = '600000000000000000000001';
const route = `/store/bridal-shop/rental-book?product=${productId}&listing=${listingId}`;
let mockBag;
jest.mock('../../services/api', () => ({ get: jest.fn() }));
jest.mock('../../context/StorefrontContext', () => ({ useStorefront: () => ({ storeSlug: 'bridal-shop' }) }));
jest.mock('../../context/RentalBagContext', () => ({ useRentalBag: () => mockBag }));
jest.mock('./RentalShop', () => () => <p>Rental catalogue</p>);
jest.mock('./RentalShoppingCheckout', () => () => <p>Checkout form</p>);

beforeEach(() => {
  jest.clearAllMocks(); sessionStorage.clear();
  mockBag = { ready: true, items: [], add: jest.fn(() => true) };
});

test('Book now keeps a checkout loading layout while the bag hydrates and the rental is checked', async () => {
  mockBag.ready = false;
  let resolve;
  api.get.mockReturnValue(new Promise(done => { resolve = done; }));
  const navigate = jest.fn(), view = render(<RentalCheckout navigate={navigate} route={route} />);
  expect(screen.getByRole('heading', { name: 'Rental checkout' })).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Preparing your booking');
  expect(screen.getByLabelText('Rental checkout progress')).toHaveTextContent('Dates');
  expect(api.get).not.toHaveBeenCalled();
  mockBag = { ...mockBag, ready: true };
  view.rerender(<RentalCheckout navigate={navigate} route={route} />);
  expect(api.get).toHaveBeenCalledTimes(1);
  // Context and search-param objects can change while the same read is pending.
  // Keep that request and use the latest bag when it finishes.
  mockBag = { ...mockBag, items: [{ listingId, quantity: 2 }] };
  view.rerender(<RentalCheckout navigate={navigate} route={route} />);
  expect(api.get).toHaveBeenCalledTimes(1);
  await act(async () => resolve({ rows: [{ _id: listingId, productId }] }));
  expect(mockBag.add).not.toHaveBeenCalled();
  expect(navigate).toHaveBeenCalledWith('/store/bridal-shop/rental-checkout');
});

test('a failed rental read stops loading and only retries when requested', async () => {
  api.get.mockRejectedValueOnce(new Error('The store could not be reached.'));
  const navigate = jest.fn(); render(<RentalCheckout navigate={navigate} route={route} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('The store could not be reached.');
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(api.get).toHaveBeenCalledTimes(1);
  expect(mockBag.add).not.toHaveBeenCalled();
  api.get.mockResolvedValueOnce({ rows: [{ _id: listingId, productId }] });
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(navigate).toHaveBeenCalledWith('/store/bridal-shop/rental-checkout'));
  expect(api.get).toHaveBeenCalledTimes(2);
  expect(mockBag.add).toHaveBeenCalledTimes(1);
});

test('leaving during Book now loading never adds the rental or redirects later', async () => {
  let resolve; api.get.mockReturnValue(new Promise(done => { resolve = done; }));
  const navigate = jest.fn(), view = render(<RentalCheckout navigate={navigate} route={route} />);
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(navigate).toHaveBeenCalledWith(expect.stringContaining('mode=rent'));
  view.unmount(); navigate.mockClear();
  await act(async () => resolve({ rows: [{ _id: listingId, productId }] }));
  expect(mockBag.add).not.toHaveBeenCalled(); expect(navigate).not.toHaveBeenCalled();
});
