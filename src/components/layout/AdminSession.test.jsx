import '@testing-library/jest-dom';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../context/AuthContext';
import authReducer from '../../store/authSlice';
import api from '../../services/api';
import Navbar from './Navbar';
import MobileHeader from './MobileHeader';

jest.mock('../../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));
jest.mock('../../store/apiSlice', () => ({
  samiraApi: { util: { resetApiState: () => ({ type: 'api/reset' }) } },
}));
jest.mock('../../context/CartContext', () => ({ useCart: () => ({ itemCount: 0 }) }));
jest.mock('../../context/WishlistContext', () => ({ useWishlist: () => ({ items: [] }) }));
jest.mock('../../context/WebsiteCustomizationContext', () => ({
  useWebsiteCustomization: () => ({ config: { branding: {}, header: {} } }),
}));

const admin = {
  id: 'admin-user', name: 'Store Admin', role: 'admin',
  availableModes: ['customer', 'admin'], activeMode: 'admin',
};

function openSavedSession(Header, user = admin) {
  localStorage.setItem('samira_user', JSON.stringify(user));
  localStorage.setItem('samira_token', 'saved-access-token');
  localStorage.setItem('samira_refresh_token', 'saved-refresh-token');
  const store = configureStore({
    reducer: { auth: authReducer },
    preloadedState: { auth: {
      user: JSON.parse(localStorage.getItem('samira_user')),
      token: localStorage.getItem('samira_token'),
      refreshToken: localStorage.getItem('samira_refresh_token'),
    } },
  });
  const navigate = jest.fn();
  render(<Provider store={store}><AuthProvider navigate={navigate}>
    <Header navigate={navigate} route="/" />
  </AuthProvider></Provider>);
  if (Header === MobileHeader) fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
  return { store, navigate };
}

beforeEach(() => {
  localStorage.clear();
  jest.resetAllMocks();
});

describe.each([['desktop', Navbar], ['mobile', MobileHeader]])('%s restored admin session', (_, Header) => {
  test('opens the dashboard when the saved session is already in admin mode', async () => {
    let resolveProfile;
    api.get.mockReturnValue(new Promise((resolve) => { resolveProfile = resolve; }));
    const { navigate } = openSavedSession(Header);
    expect(screen.getByRole('button', { name: /Admin/ })).toBeInTheDocument();
    await act(async () => resolveProfile({ ...admin }));
    fireEvent.click(screen.getByRole('button', { name: /Admin/ }));
    expect(navigate).toHaveBeenCalledWith('/admin');
    expect(api.post).not.toHaveBeenCalled();
    if (Header === MobileHeader) expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('switches modes before opening the dashboard from customer mode', async () => {
    const user = { ...admin, activeMode: 'customer' };
    api.get.mockResolvedValue(user);
    api.post.mockResolvedValue({ user: admin, token: 'admin-token' });
    const { navigate } = openSavedSession(Header, user);
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: /Admin/ }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/admin'));
    expect(api.post).toHaveBeenCalledWith('/auth/switch-mode', { mode: 'admin' });
  });

  test('does not expose admin navigation to customers', async () => {
    const user = { ...admin, role: 'customer', availableModes: ['customer'], activeMode: 'customer' };
    api.get.mockResolvedValue(user);
    openSavedSession(Header, user);
    await act(async () => {});
    expect(screen.queryByRole('button', { name: /Admin/ })).not.toBeInTheDocument();
  });
});

test.each(['FETCH_ERROR', 'TIMEOUT_ERROR', 503])('retains the saved login if profile loading fails with %s', async (status) => {
  api.get.mockRejectedValue(Object.assign(new Error('Temporarily unavailable'), { status }));
  const { store } = openSavedSession(Navbar);
  await act(async () => {});
  expect(store.getState().auth.user).toEqual(admin);
  expect(localStorage.getItem('samira_token')).toBe('saved-access-token');
  expect(screen.getByRole('button', { name: 'Admin' })).toBeInTheDocument();
});

test.each([401, 403])('clears a rejected session when profile loading returns %s', async (status) => {
  api.get.mockRejectedValue(Object.assign(new Error('Unauthorized'), { status }));
  const { store } = openSavedSession(Navbar);
  await waitFor(() => expect(store.getState().auth.user).toBeNull());
  expect(localStorage.getItem('samira_token')).toBeNull();
  expect(localStorage.getItem('samira_refresh_token')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Admin' })).not.toBeInTheDocument();
});

test('a delayed profile response cannot restore an account after logout', async () => {
  let resolveProfile;
  api.get.mockReturnValue(new Promise((resolve) => { resolveProfile = resolve; }));
  function SessionActions() {
    const { logout: signOut } = useAuth();
    return <button onClick={signOut}>Sign out now</button>;
  }
  const { store } = openSavedSession(SessionActions);
  fireEvent.click(screen.getByRole('button', { name: 'Sign out now' }));
  await act(async () => resolveProfile(admin));
  expect(store.getState().auth.user).toBeNull();
  expect(localStorage.getItem('samira_user')).toBeNull();
});

test('a delayed profile failure cannot clear a newly switched admin session', async () => {
  let rejectProfile;
  api.get.mockReturnValue(new Promise((_, reject) => { rejectProfile = reject; }));
  const user = { ...admin, activeMode: 'customer' };
  api.post.mockResolvedValue({ user: admin, token: 'admin-token', refreshToken: 'admin-refresh' });
  const { store, navigate } = openSavedSession(Navbar, user);
  fireEvent.click(screen.getByRole('button', { name: 'Admin' }));
  await waitFor(() => expect(navigate).toHaveBeenCalledWith('/admin'));
  await act(async () => rejectProfile(Object.assign(new Error('Old token expired'), { status: 401 })));
  expect(store.getState().auth.user).toEqual(admin);
  expect(localStorage.getItem('samira_token')).toBe('admin-token');
});
