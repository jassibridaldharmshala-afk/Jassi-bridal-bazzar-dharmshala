import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Login from './Login';
import LoginPrompt from '../../components/auth/LoginPrompt';

const mockAuth = {
  sendOtp: jest.fn(),
  verifyOtp: jest.fn(),
  resendOtp: jest.fn(),
};

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

jest.mock('../../hooks/useDesktopFeedback', () => () => ({
  notify: () => false,
}));

describe('customer login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    window.history.replaceState(null, '', '/login');
  });

  test('restricts the phone field, scopes consent clicks, and exposes policy/help links', () => {
    render(<Login route="/login" />);

    const phone = screen.getByPlaceholderText('Mobile Number*');
    expect(phone.closest('.focus-within\\:border-wine')).not.toBeNull();
    expect(phone).toHaveClass('border-0', 'outline-none', 'focus:ring-0');
    const consent = screen.getByRole('checkbox');
    const continueButton = screen.getByRole('button', { name: 'Continue' });

    fireEvent.change(phone, { target: { value: '9ab!8 765-43210' } });
    expect(phone).toHaveValue('9876543210');
    expect(continueButton).toBeDisabled();

    fireEvent.click(screen.getByText(/By continuing, I agree/i));
    expect(consent).not.toBeChecked();

    fireEvent.click(consent);
    expect(consent).toBeChecked();
    expect(continueButton).toBeEnabled();

    expect(screen.getByRole('link', { name: 'Terms of Use' })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy-policy');
    expect(screen.getByRole('link', { name: /Get help/i })).toHaveAttribute('href', '/contact');
  });

  test('sends OTP to valid ten-digit numbers beginning with 91', async () => {
    mockAuth.sendOtp.mockResolvedValueOnce({ message: 'OTP sent' });
    render(<Login route="/login" />);
    fireEvent.change(screen.getByPlaceholderText('Mobile Number*'), { target: { value: '9123456789' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(mockAuth.sendOtp).toHaveBeenCalledWith('9123456789'));
  });

  test('delivery failures keep the phone editable and retry can advance to OTP entry', async () => {
    const message = 'SMS login is unavailable because the SMS provider rejected the store credentials. Please contact support.';
    mockAuth.sendOtp.mockRejectedValueOnce(new Error(message)).mockResolvedValueOnce({ otpMode: 'production' });
    render(<Login route="/login" />);
    fireEvent.change(screen.getByPlaceholderText('Mobile Number*'), { target: { value: '9876543210' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText(message)).toBeVisible();
    expect(screen.getByPlaceholderText('Mobile Number*')).toHaveValue('9876543210');
    expect(screen.queryByRole('button', { name: 'Verify OTP' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(await screen.findByRole('button', { name: 'Verify OTP' })).toBeVisible();
    expect(mockAuth.sendOtp).toHaveBeenCalledTimes(2);
  });

  test('demo login displays its code without claiming an SMS was sent and submits the entered OTP', async () => {
    mockAuth.sendOtp.mockResolvedValueOnce({ otpMode: 'demo', demoOtp: '123456', message: 'OTP sent successfully' });
    mockAuth.verifyOtp.mockResolvedValueOnce({});
    render(<Login route="/login" />);
    fireEvent.change(screen.getByPlaceholderText('Mobile Number*'), { target: { value: '9816978086' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText(/No SMS is needed/)).toHaveTextContent('123456');
    expect(screen.queryByText(/^Sent to /)).not.toBeInTheDocument();
    fireEvent.paste(screen.getByLabelText('OTP digit 1'), { clipboardData: { getData: () => '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify OTP' }));
    await waitFor(() => expect(mockAuth.verifyOtp).toHaveBeenCalledWith({ phone: '9816978086', otp: '123456', redirectTo: '/profile' }));
  });

  test('production login does not display a demo code even if a response contains one', async () => {
    mockAuth.sendOtp.mockResolvedValueOnce({ otpMode: 'production', demoOtp: '123456' });
    render(<Login route="/login" />);
    fireEvent.change(screen.getByPlaceholderText('Mobile Number*'), { target: { value: '9816978086' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('button', { name: 'Verify OTP' })).toBeVisible();
    expect(screen.queryByText(/No SMS is needed/)).not.toBeInTheDocument();
  });

  test('the storefront login prompt accepts local numbers beginning with 91', () => {
    const onContinue = jest.fn();
    render(<LoginPrompt open onClose={jest.fn()} onContinue={onContinue} />);
    expect(screen.getByPlaceholderText('Mobile Number*').closest('.focus-within\\:border-wine')).not.toBeNull();
    fireEvent.change(screen.getByPlaceholderText('Mobile Number*'), { target: { value: '9123456789' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onContinue).toHaveBeenCalledWith('9123456789');
  });

  test('supports typing, replacing, deleting and moving backward through OTP digits', () => {
    renderOtpStep();
    const inputs = otpInputs();

    inputs[0].focus();
    fireEvent.keyDown(inputs[0], { key: '1' });
    expect(inputs[0]).toHaveValue('1');
    expect(inputs[1]).toHaveFocus();

    fireEvent.keyDown(inputs[1], { key: '2' });
    fireEvent.keyDown(inputs[2], { key: '3' });
    fireEvent.keyDown(inputs[3], { key: '4' });
    fireEvent.keyDown(inputs[4], { key: '5' });
    fireEvent.keyDown(inputs[5], { key: '6' });
    expect(inputs.map((input) => input.value).join('')).toBe('123456');
    expect(screen.getByRole('button', { name: 'Verify OTP' })).toBeEnabled();

    fireEvent.keyDown(inputs[5], { key: 'Backspace' });
    expect(inputs[5]).toHaveValue('');
    expect(inputs[5]).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Verify OTP' })).toBeDisabled();

    fireEvent.keyDown(inputs[5], { key: 'Backspace' });
    expect(inputs[4]).toHaveValue('');
    expect(inputs[4]).toHaveFocus();

    fireEvent.keyDown(inputs[4], { key: '9' });
    expect(inputs[4]).toHaveValue('9');
    expect(inputs[5]).toHaveFocus();

    fireEvent.keyDown(inputs[5], { key: '7' });
    fireEvent.keyDown(inputs[5], { key: 'ArrowLeft' });
    expect(inputs[4]).toHaveFocus();
    fireEvent.keyDown(inputs[4], { key: 'Delete' });
    expect(inputs[4]).toHaveValue('');
  });

  test('fills all OTP boxes from paste and enables verification', () => {
    renderOtpStep();
    const inputs = otpInputs();

    fireEvent.paste(inputs[0], {
      clipboardData: { getData: () => '12a-34 56' },
    });

    expect(inputs.map((input) => input.value).join('')).toBe('123456');
    expect(inputs[5]).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Verify OTP' })).toBeEnabled();
  });

  test('keeps an incorrect OTP editable and focuses the last digit for correction', async () => {
    mockAuth.verifyOtp.mockRejectedValueOnce(new Error('Incorrect OTP. Please try again.'));
    renderOtpStep();
    const inputs = otpInputs();

    fireEvent.paste(inputs[0], {
      clipboardData: { getData: () => '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify OTP' }));

    await waitFor(() => expect(mockAuth.verifyOtp).toHaveBeenCalledWith({
      phone: '9876543086',
      otp: '123456',
      redirectTo: '/admin/reel-import?jobId=job-1',
    }));
    expect(await screen.findByText('Incorrect OTP. Please try again.')).toBeVisible();
    expect(inputs.map((input) => input.value).join('')).toBe('123456');
    expect(inputs[5]).toHaveFocus();

    fireEvent.keyDown(inputs[5], { key: 'Backspace' });
    expect(inputs[5]).toHaveValue('');
    expect(screen.queryByText('Incorrect OTP. Please try again.')).not.toBeInTheDocument();
  });

  test('resends only when the cooldown allows it and starts a new cooldown', async () => {
    mockAuth.resendOtp.mockResolvedValueOnce({ message: 'OTP sent again.' });
    renderOtpStep();

    const resend = screen.getByRole('button', { name: 'Resend OTP' });
    expect(resend).toBeEnabled();
    fireEvent.click(resend);

    await waitFor(() => expect(mockAuth.resendOtp).toHaveBeenCalledWith('9876543086'));
    expect(await screen.findByText(/OTP sent again/i)).toBeVisible();
    expect(resend).toBeDisabled();
  });

});

function renderOtpStep() {
  render(
    <Login
      route="/login?step=otp&phone=9876543086&consent=1&redirect=%2Fadmin%2Freel-import%3FjobId%3Djob-1"
    />,
  );
}

function otpInputs() {
  return Array.from({ length: 6 }, (_, index) => (
    screen.getByRole('textbox', { name: `OTP digit ${index + 1}` })
  ));
}

test('boutique sign-in keeps OTP navigation and the account return inside the same boutique', async () => {
  window.history.replaceState(null, '', '/store/bridal/login');
  mockAuth.sendOtp.mockResolvedValueOnce({ otpMode: 'production' });
  render(<Login route="/store/bridal/login?redirect=%2Fwishlist" />);
  fireEvent.change(screen.getByPlaceholderText('Mobile Number*'), { target: { value: '9876543210' } });
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await screen.findByRole('button', { name: 'Verify OTP' });
  expect(window.location.pathname).toBe('/store/bridal/login');
  expect(new URLSearchParams(window.location.search).get('redirect')).toBe('/store/bridal/wishlist');
});
