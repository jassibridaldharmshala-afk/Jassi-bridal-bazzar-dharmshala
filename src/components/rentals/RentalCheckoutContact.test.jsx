import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useState } from 'react';
import RentalCheckoutContact from './RentalCheckoutContact';
import { editableRentalDetails } from '../../utils/rentalDetails';
let mockUser;
const mockSend = jest.fn(), mockResend = jest.fn(), mockVerify = jest.fn();
jest.mock('../../services/api', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: mockUser, sendOtp: mockSend, resendOtp: mockResend, verifyOtp: mockVerify }) }));
function Harness({ onContinue = jest.fn(), onVerificationChange = jest.fn() }) {
  const [form, setForm] = useState({ name: 'Priya', phone: mockUser?.phone || '', email: '', whatsappConsent: false, deliveryMode: 'STORE_PICKUP' });
  const [state, setState] = useState({});
  return <><RentalCheckoutContact form={form} details={editableRentalDetails(null, null)} addresses={[]} storeSlug="bridal" onChange={(key, value) => setForm(old => ({ ...old, [key]: value }))} onDetails={jest.fn()} onContinue={onContinue} onVerificationChange={onVerificationChange} onState={setState} /><button type="submit" form="rental-checkout-contact-form" disabled={state.disabled}>{state.label}</button></>;
}
beforeEach(() => { sessionStorage.clear(); jest.clearAllMocks(); mockUser = null; mockSend.mockResolvedValue({ otpLength: 6, resendAfterSeconds: 60, expiresInSeconds: 300 }); mockResend.mockResolvedValue({ otpLength: 6, resendAfterSeconds: 60, expiresInSeconds: 300 }); });
afterEach(() => jest.useRealTimers());
async function send() {
  fireEvent.change(screen.getByLabelText('Mobile number'), { target: { value: '9876543210' } });
  fireEvent.click(screen.getByLabelText(/I agree to the/)); await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Send OTP' })));
  await screen.findByLabelText('OTP digit 1');
}
test('a verified account reviews without sending another OTP and pickup requests no address', async () => {
  mockUser = { _id: 'one', phone: '9876543210', isPhoneVerified: true }; const next = jest.fn(); render(<Harness onContinue={next} />);
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Review booking' }))); await waitFor(() => expect(next).toHaveBeenCalledWith(mockUser));
  expect(mockSend).not.toHaveBeenCalled(); expect(screen.queryByText('Delivery & return address')).not.toBeInTheDocument();
});
test('OTP paste and deleting a middle digit preserve every other digit and never store the code', async () => {
  render(<Harness />); await send();
  fireEvent.paste(screen.getByLabelText('OTP digit 1'), { clipboardData: { getData: () => '123456' } });
  fireEvent.change(screen.getByLabelText('OTP digit 3'), { target: { value: '' } });
  expect(screen.getByLabelText('OTP digit 4')).toHaveValue('4'); expect(screen.getByRole('button', { name: 'Verify & continue' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('OTP digit 3'), { target: { value: '3' } });
  expect(screen.getByRole('button', { name: 'Verify & continue' })).toBeEnabled();
  const stored = sessionStorage.getItem('rental-otp-challenge:bridal:'); expect(stored).not.toContain('123456'); expect(JSON.parse(stored).otp).toBeUndefined();
});
test('backend length controls the boxes and a verification response without verified identity is rejected', async () => {
  mockSend.mockResolvedValue({ otpLength: 4, resendAfterSeconds: 0 }); mockVerify.mockResolvedValue({ user: { phone: '9876543210', isPhoneVerified: false } });
  const next = jest.fn(); render(<Harness onContinue={next} />); await send();
  expect(screen.queryByLabelText('OTP digit 5')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('OTP digit 1'), { target: { value: '1234' } }); await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Verify & continue' })));
  expect(await screen.findByRole('alert')).toHaveTextContent('could not be confirmed'); expect(next).not.toHaveBeenCalled();
});
test('wrong OTP leaves the same details available for correction and does not continue', async () => {
  mockVerify.mockRejectedValue(new Error('OTP is incorrect.')); const next = jest.fn(); render(<Harness onContinue={next} />); await send();
  fireEvent.change(screen.getByLabelText('OTP digit 1'), { target: { value: '123456' } }); fireEvent.click(screen.getByRole('button', { name: 'Verify & continue' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('OTP is incorrect'); expect(screen.getByLabelText('Full name')).toHaveValue('Priya'); expect(next).not.toHaveBeenCalled();
});
test('change number invalidates the previous challenge and verified-account shortcut', async () => {
  mockUser = { phone: '9876543210', isPhoneVerified: true }; const invalidated = jest.fn(); render(<Harness onVerificationChange={invalidated} />);
  fireEvent.click(screen.getByRole('button', { name: 'Change' })); expect(screen.queryByText('Verified account number')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Send OTP' })).toBeDisabled(); expect(invalidated).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByLabelText('Mobile number'), { target: { value: '9000000001' } }); expect(sessionStorage.getItem('rental-otp-challenge:bridal:')).toBeNull();
});
test('resend respects the server cooldown, resets the code and expiry cannot pass verification', async () => {
  jest.useFakeTimers(); render(<Harness />); await send();
  expect(screen.getByRole('button', { name: 'Resend OTP in 1:00' })).toBeDisabled();
  act(() => jest.advanceTimersByTime(61000)); await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Resend OTP' })));
  await waitFor(() => expect(mockResend).toHaveBeenCalledWith('9876543210'));
  await act(async () => {}); expect(screen.getByLabelText('OTP digit 1')).toHaveValue('');
  fireEvent.change(screen.getByLabelText('OTP digit 1'), { target: { value: '123456' } });
  act(() => jest.advanceTimersByTime(301000));
  expect(screen.getByRole('alert')).toHaveTextContent('expired'); expect(screen.getByRole('button', { name: 'Verify & continue' })).toBeDisabled(); expect(mockVerify).not.toHaveBeenCalled();
});
test('refresh restores only challenge metadata; OTP digits must be entered again', async () => {
  const view = render(<Harness />); await send(); fireEvent.change(screen.getByLabelText('OTP digit 1'), { target: { value: '123456' } }); view.unmount();
  render(<Harness />); expect(screen.getByLabelText('OTP digit 1')).toHaveValue(''); expect(screen.getByLabelText('Mobile number')).toHaveValue('9876543210');
  expect(screen.getByRole('button', { name: 'Verify & continue' })).toBeDisabled(); expect(mockSend).toHaveBeenCalledTimes(1);
});

test('a guest phone entry survives same-browser refresh before sending OTP, without persisting a code', () => {
  const view = render(<Harness />); fireEvent.change(screen.getByLabelText('Mobile number'), { target: { value: '9876543210' } }); view.unmount();
  render(<Harness />); expect(screen.getByLabelText('Mobile number')).toHaveValue('9876543210'); expect(screen.queryByLabelText('OTP digit 1')).not.toBeInTheDocument();
  expect(JSON.parse(sessionStorage.getItem('rental-phone-entry:bridal:')).otp).toBeUndefined();
});
test('refresh while verifying a changed number cannot reuse the old verified-number shortcut', async () => {
  mockUser = { phone: '9000000001', isPhoneVerified: true }; const view = render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'Change' })); await send(); view.unmount();
  render(<Harness />); expect(screen.getByLabelText('Mobile number')).toHaveValue('9876543210'); expect(screen.queryByText('Verified account number')).not.toBeInTheDocument();
  expect(screen.getByLabelText('OTP digit 1')).toHaveValue(''); expect(screen.getByRole('button', { name: 'Verify & continue' })).toBeDisabled();
});
