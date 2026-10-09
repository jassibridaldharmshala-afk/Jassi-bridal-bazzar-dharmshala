import '@testing-library/jest-dom';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import authReducer from '../store/authSlice';
import api from '../services/api';

jest.mock('../services/api', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../store/apiSlice', () => ({ samiraApi: { util: { resetApiState: () => ({ type: 'api/reset' }) } } }));
const owner = { id: 'owner', name: 'Owner', role: 'admin', activeMode: 'admin', availableModes: ['customer', 'admin', 'seller'] };

function Actions() {
  const { switchMode, setToast, notify, logout, verifyOtp } = useAuth();
  return <>
    {['customer', 'admin', 'seller'].map(mode => <button key={mode} onClick={() => switchMode(mode)}>{mode}</button>)}
    <button onClick={() => verifyOtp({ phone: '9000000001', otp: '123456', navigateOnSuccess: false })}>Inline OTP</button>
    <button onClick={() => verifyOtp({ phone: '9000000001', otp: '123456', redirectTo: '/profile' })}>Login OTP</button>
    <button onClick={logout}>Log out</button>
    <button onClick={() => setToast('Saved successfully')}>Legacy notice</button>
    <button onClick={() => notify('Please review the details', 'warning', 'Review needed')}>Titled notice</button>
  </>;
}
function setup() {
  const store = configureStore({ reducer: { auth: authReducer }, preloadedState: { auth: { user: owner, token: 'saved-token', refreshToken: null } } });
  localStorage.setItem('samira_token', 'saved-token');
  api.get.mockResolvedValue(owner);
  const navigate = jest.fn();
  render(<Provider store={store}><AuthProvider navigate={navigate}><Actions /></AuthProvider></Provider>);
  return { store, navigate };
}
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); jest.resetAllMocks(); });
afterEach(() => { cleanup(); jest.useRealTimers(); });

test.each([['customer', '/', 'Customer'], ['admin', '/admin', 'Admin'], ['seller', '/seller', 'Seller']])('the %s switch keeps authentication/navigation and shows a compact success confirmation', async (mode, destination, label) => {
  const { store, navigate } = setup();
  await act(async () => {});
  api.post.mockResolvedValue({ user: { ...owner, activeMode: mode }, token: 'switched-token' });
  fireEvent.click(screen.getByRole('button', { name: mode }));
  expect(await screen.findByText(label + ' mode active')).toBeInTheDocument();
  expect(screen.getByRole('status').closest('.app-toast')).toHaveClass('app-toast--success');
  expect(api.post).toHaveBeenCalledWith('/auth/switch-mode', { mode });
  expect(navigate).toHaveBeenCalledWith(destination);
  expect(store.getState().auth.user.activeMode).toBe(mode);
  expect(localStorage.getItem('samira_token')).toBe('switched-token');
  expect(screen.getByRole('status').closest('.app-toast-region')).toHaveAttribute('data-mode', mode);
});

test('failed switching shows an error and does not change mode, navigate or erase the session', async () => {
  const { store, navigate } = setup();
  await act(async () => {});
  api.post.mockRejectedValue(new Error('Mode temporarily unavailable'));
  fireEvent.click(screen.getByRole('button', { name: 'customer' }));
  await screen.findByText('Mode temporarily unavailable');
  expect(screen.getByRole('status').closest('.app-toast')).toHaveClass('app-toast--error');
  expect(navigate).not.toHaveBeenCalled();
  expect(store.getState().auth.user.activeMode).toBe('admin');
  expect(localStorage.getItem('samira_token')).toBe('saved-token');
});

test('the legacy string and titled notify APIs still work, with explicit dismissal', async () => {
  setup(); await act(async () => {});
  fireEvent.click(screen.getByRole('button', { name: 'Legacy notice' }));
  expect(screen.getByRole('status')).toHaveTextContent('Saved successfully');
  fireEvent.click(screen.getByRole('button', { name: 'Titled notice' }));
  expect(screen.getByRole('status')).toHaveTextContent('Review needed');
  expect(screen.getByRole('status')).toHaveTextContent('Please review the details');
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

test('auto-dismiss stays at 3.5 seconds and a replacement message gets a fresh timer', async () => {
  jest.useFakeTimers(); setup(); await act(async () => {});
  fireEvent.click(screen.getByRole('button', { name: 'Legacy notice' }));
  act(() => jest.advanceTimersByTime(3000));
  fireEvent.click(screen.getByRole('button', { name: 'Titled notice' }));
  act(() => jest.advanceTimersByTime(500));
  expect(screen.getByRole('status')).toHaveTextContent('Review needed');
  act(() => jest.advanceTimersByTime(2999));
  expect(screen.getByRole('status')).toBeInTheDocument();
  act(() => jest.advanceTimersByTime(1));
  await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
});


test('logout removes private rental details for this account across boutiques', async () => {
  const { store, navigate } = setup();
  await act(async () => {});
  sessionStorage.setItem('rental-contact:bridal:owner', 'private');
  sessionStorage.setItem('rental-contact:other:owner', 'private');
  sessionStorage.setItem('rental-contact:bridal:other-user', 'other');
  sessionStorage.setItem('rental-plan:bridal:', 'public planning');
  fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
  expect(sessionStorage.getItem('rental-contact:bridal:owner')).toBeNull();
  expect(sessionStorage.getItem('rental-contact:other:owner')).toBeNull();
  expect(sessionStorage.getItem('rental-contact:bridal:other-user')).toBe('other');
  expect(sessionStorage.getItem('rental-plan:bridal:')).toBe('public planning');
  expect(store.getState().auth.user).toBeNull();
  expect(navigate).toHaveBeenCalledWith('/');
});

test.each([['Inline OTP', false], ['Login OTP', true]])('%s preserves the authenticated session and respects requested navigation', async (label, shouldNavigate) => {
  const { store, navigate } = setup(); await act(async () => {});
  const customer = { id: 'customer', name: 'Priya', phone: '9000000001', role: 'customer', isPhoneVerified: true };
  api.post.mockResolvedValue({ user: customer, token: 'verified-test-token' });
  fireEvent.click(screen.getByRole('button', { name: label }));
  await waitFor(() => expect(store.getState().auth.user).toEqual(customer));
  expect(localStorage.getItem('samira_token')).toBe('verified-test-token');
  if (shouldNavigate) expect(navigate).toHaveBeenCalledWith('/profile'); else expect(navigate).not.toHaveBeenCalled();
});
