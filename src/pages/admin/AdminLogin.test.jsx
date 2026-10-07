import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import AdminLogin from './AdminLogin';

jest.mock('../customer/Login', () => function MockMobileOtpLogin({ route }) {
  return <div data-testid="mobile-otp-login">{route}</div>;
});

describe('admin login', () => {
  test('uses the shared mobile OTP flow and defaults to the admin dashboard', () => {
    render(<AdminLogin />);

    expect(screen.getByTestId('mobile-otp-login')).toHaveTextContent(
      '/login?redirect=%2Fadmin',
    );
  });

  test('returns to the requested reel import after mobile OTP verification', () => {
    render(
      <AdminLogin
        route="/admin/login?redirect=%2Fadmin%2Freel-import%3FjobId%3Djob-1"
      />,
    );

    expect(screen.getByTestId('mobile-otp-login')).toHaveTextContent(
      '/login?redirect=%2Fadmin%2Freel-import%3FjobId%3Djob-1',
    );
  });
});
