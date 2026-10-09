import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import SellerLayout from './SellerLayout';

let mockUser;
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('../../hooks/useAppPath', () => () => globalThis.window.location.pathname);
const storeA = '500000000000000000000001', storeB = '500000000000000000000002';
beforeEach(() => {
  sessionStorage.clear();
  mockUser = { stores: [{ id: storeA, name: 'Shop A', status: 'PUBLISHED', role: 'OWNER' }, { id: storeB, name: 'Shop B', status: 'PUBLISHED', role: 'OWNER' }] };
});
afterEach(() => { window.history.replaceState(null, '', '/'); sessionStorage.clear(); });

test('a scoped rental order link selects its authorized store before rendering the booking', () => {
  sessionStorage.setItem('samira_seller_store_id', storeA);
  window.history.replaceState(null, '', '/seller/orders?type=rental&storeId=' + storeB);
  render(<SellerLayout><p>Rental booking</p></SellerLayout>);
  expect(sessionStorage.getItem('samira_seller_store_id')).toBe(storeB);
  screen.getAllByRole('combobox', { name: 'Active seller store' }).forEach(select => expect(select).toHaveValue(storeB));
});

test('a same-path navigation to another authorized rental store updates the store selector', async () => {
  sessionStorage.setItem('samira_seller_store_id', storeA);
  window.history.replaceState(null, '', '/seller/orders?type=rental&storeId=' + storeA);
  const view = render(<SellerLayout><p>Rental booking A</p></SellerLayout>);
  window.history.replaceState(null, '', '/seller/orders?type=rental&storeId=' + storeB);
  view.rerender(<SellerLayout><p>Rental booking B</p></SellerLayout>);
  await waitFor(() => expect(sessionStorage.getItem('samira_seller_store_id')).toBe(storeB));
  screen.getAllByRole('combobox', { name: 'Active seller store' }).forEach(select => expect(select).toHaveValue(storeB));
});

test('an unowned linked store is never inserted into the seller membership selector', () => {
  sessionStorage.setItem('samira_seller_store_id', storeA);
  window.history.replaceState(null, '', '/seller/orders?type=rental&storeId=500000000000000000000003');
  render(<SellerLayout><p>Rental booking</p></SellerLayout>);
  expect(sessionStorage.getItem('samira_seller_store_id')).toBe(storeA);
  screen.getAllByRole('combobox', { name: 'Active seller store' }).forEach(select => expect(select).toHaveValue(storeA));
});
