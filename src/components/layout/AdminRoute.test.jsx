import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import AdminRoute from './AdminRoute';

const mockSwitchMode = jest.fn();
let mockAuthState = { user: null, switchMode: mockSwitchMode };

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

jest.mock('../admin/AdminLayout', () => function MockAdminLayout({ children }) {
  return <div data-testid="admin-layout">{children}</div>;
});

describe('admin access gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState = { user: null, switchMode: mockSwitchMode };
    window.history.replaceState({}, '', '/admin/reel-import?jobId=job-1');
  });

  afterAll(() => {
    window.history.replaceState({}, '', '/');
  });

  test('uses mobile OTP and preserves the requested admin destination', () => {
    render(<AdminRoute><div>Protected content</div></AdminRoute>);

    expect(screen.getByRole('heading', { name: 'Verify your admin number' })).toBeInTheDocument();
    expect(screen.getByText(/Only a number registered with the admin role/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Continue with mobile OTP/ })).toHaveAttribute(
      'href',
      '/login?redirect=%2Fadmin%2Freel-import%3FjobId%3Djob-1',
    );
  });

  test('returns an admin in customer mode to the same requested page', () => {
    mockAuthState = {
      user: { role: 'admin', activeMode: 'customer' },
      switchMode: mockSwitchMode,
    };

    render(<AdminRoute><div>Protected content</div></AdminRoute>);
    fireEvent.click(screen.getByRole('button', { name: /Switch to admin mode/ }));

    expect(mockSwitchMode).toHaveBeenCalledWith(
      'admin',
      '/admin/reel-import?jobId=job-1',
    );
  });

  test('renders the requested page for a verified admin in admin mode', () => {
    mockAuthState = {
      user: { role: 'admin', activeMode: 'admin' },
      switchMode: mockSwitchMode,
    };

    render(<AdminRoute><div>Protected content</div></AdminRoute>);

    expect(screen.getByTestId('admin-layout')).toHaveTextContent('Protected content');
  });
});
