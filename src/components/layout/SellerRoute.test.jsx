import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import SellerRoute from './SellerRoute';
let mockUser;
const mockSwitch = jest.fn();
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: mockUser, switchMode: mockSwitch }) }));
jest.mock('../seller/SellerLayout', () => ({ children }) => <div>{children}</div>);
beforeEach(() => { mockUser = null; mockSwitch.mockClear(); window.history.replaceState(null, '', '/seller/products/edit?id=one'); });
afterEach(() => window.history.replaceState(null, '', '/'));
test('seller login retains the requested editor route', () => {
  render(<SellerRoute><p>Editor</p></SellerRoute>);
  expect(screen.getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/login?redirect=%2Fseller%2Fproducts%2Fedit%3Fid%3Done');
  expect(screen.queryByText('Editor')).not.toBeInTheDocument();
});
test('changing to seller mode opens the original destination', () => {
  mockUser = { availableModes: ['customer', 'seller'], activeMode: 'customer' };
  render(<SellerRoute><p>Editor</p></SellerRoute>);
  fireEvent.click(screen.getByRole('button', { name: 'Switch to Seller' }));
  expect(mockSwitch).toHaveBeenCalledWith('seller', '/seller/products/edit?id=one');
});
test('an unprovisioned account cannot enter seller tools or an unavailable self-service creation flow', () => {
  mockUser = { availableModes: ['customer'], activeMode: 'customer' };
  render(<SellerRoute><p>Editor</p></SellerRoute>);
  expect(screen.getByText('Seller access required')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Contact support' })).toHaveAttribute('href', '/contact');
  expect(screen.queryByText('Editor')).not.toBeInTheDocument();
});
