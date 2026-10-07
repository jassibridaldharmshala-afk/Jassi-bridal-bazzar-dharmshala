import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProfileDetails from './ProfileDetails';

const mockAuth = {
  user: {
    name: 'Jassi Shopper',
    phone: '9876543210',
    email: '',
    isPhoneVerified: true,
  },
  updateProfile: jest.fn(),
  deleteProfile: jest.fn(),
  sendProfilePhoneChangeOtp: jest.fn(),
  verifyProfilePhoneChangeOtp: jest.fn(),
  sendProfileEmailChangeOtp: jest.fn(),
  verifyProfileEmailChangeOtp: jest.fn(),
};

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

beforeEach(() => jest.clearAllMocks());

test.each([
  ['phone', 0, 'Enter mobile number', '9123456789', 'Verify Mobile Number', 'verifyProfilePhoneChangeOtp', 'phoneVerificationToken'],
  ['email', 1, 'Enter email', 'shopper@example.com', 'Verify Email', 'verifyProfileEmailChangeOtp', 'emailVerificationToken'],
])('changing %s requires verification, locks the pending identity, and saves the matching token', async (field, index, placeholder, value, verifyLabel, verifyMethod, tokenField) => {
  let completeVerify;
  mockAuth[verifyMethod].mockImplementationOnce(() => new Promise(resolve => { completeVerify = resolve; }));
  mockAuth.updateProfile.mockResolvedValueOnce({ ...mockAuth.user, [field]: value });
  render(<ProfileDetails />);
  fireEvent.click(screen.getAllByRole('button', { name: 'CHANGE' })[index]);
  const input = screen.getByPlaceholderText(placeholder);
  fireEvent.change(input, { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Details' }));
  expect(mockAuth.updateProfile).not.toHaveBeenCalled();
  fireEvent.change(screen.getByPlaceholderText('Enter OTP'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: verifyLabel }));
  expect(input).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Save Details' })).toBeDisabled();
  await act(async () => completeVerify({ verificationToken: 'confirmed-token' }));
  expect(input).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Save Details' }));
  await waitFor(() => expect(mockAuth.updateProfile).toHaveBeenCalledWith(expect.objectContaining({ [field]: value, [tokenField]: 'confirmed-token' })));
  expect(await screen.findByText('Details saved successfully')).toBeInTheDocument();
});

test('account mobile number accepts digits only and reports an invalid number', () => {
  render(<ProfileDetails />);
  expect(screen.getByPlaceholderText('Alternate mobile number').closest('.focus-within\\:border-wine')).not.toBeNull();

  fireEvent.click(screen.getAllByRole('button', { name: 'CHANGE' })[0]);
  const phone = screen.getByPlaceholderText('Enter mobile number');

  fireEvent.change(phone, { target: { value: '12ab!34' } });
  expect(phone).toHaveValue('1234');
  expect(screen.getByText('Enter a valid 10-digit mobile number starting with 6-9.')).toBeInTheDocument();

  fireEvent.change(phone, { target: { value: '98765#43210abc' } });
  expect(phone).toHaveValue('9876543210');
  expect(screen.queryByText('Enter a valid 10-digit mobile number starting with 6-9.')).not.toBeInTheDocument();
});
