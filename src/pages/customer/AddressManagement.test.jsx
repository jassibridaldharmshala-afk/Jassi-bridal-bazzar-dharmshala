import '@testing-library/jest-dom';
import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import AddressManagement from './AddressManagement';
import api from '../../services/api';
import { lookupPincode } from '../../utils/indiaPincode';

jest.mock('../../services/api', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() } }));
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { name: 'Test Shopper' }, logout: jest.fn() }) }));
jest.mock('../../utils/indiaPincode', () => ({ lookupPincode: jest.fn() }));

const home = { _id: 'home', fullName: 'Home Recipient', mobile: '9876543210', pincode: '400001', state: 'Maharashtra', city: 'Mumbai', houseNo: '12A', area: 'Fort', addressType: 'Home', isDefault: true };
const work = { ...home, _id: 'work', fullName: 'Work Recipient', addressType: 'Work', isDefault: false };
function Page({ initialRoute = '/profile/addresses' }) {
  const [route, navigate] = useState(initialRoute);
  return <AddressManagement route={route} navigate={navigate} />;
}
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function close() { this.removeAttribute('open'); };
});
beforeEach(() => { jest.resetAllMocks(); api.get.mockResolvedValue([home, work]); lookupPincode.mockResolvedValue(null); });

test('groups addresses by default status, displays the actual address type and activates the account sidebar', async () => {
  render(<Page />);
  expect(await screen.findByRole('region', { name: 'Default address' })).toHaveTextContent('Home Recipient');
  expect(screen.getByRole('region', { name: 'Other addresses' })).toHaveTextContent('Work Recipient');
  expect(within(screen.getByRole('article', { name: 'Address for Work Recipient' })).getByText('Work')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Addresses', current: 'page' })).toBeInTheDocument();
});

test('makes another address default using the saved response', async () => {
  api.patch.mockResolvedValue([{ ...home, isDefault: false }, { ...work, isDefault: true }]);
  render(<Page />);
  fireEvent.click(await screen.findByRole('button', { name: 'Make default' }));
  await waitFor(() => expect(screen.getByRole('region', { name: 'Default address' })).toHaveTextContent('Work Recipient'));
  expect(api.patch).toHaveBeenCalledWith('/user/addresses/work/default', {});
});

test('requires confirmation to remove an address and restores the updated default', async () => {
  api.delete.mockResolvedValue([{ ...work, isDefault: true }]);
  render(<Page />);
  const card = await screen.findByRole('article', { name: 'Address for Home Recipient' });
  fireEvent.click(within(card).getByRole('button', { name: 'Remove' }));
  expect(api.delete).not.toHaveBeenCalled();
  let dialog = screen.getByRole('dialog', { name: 'Remove address' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(within(card).getByRole('button', { name: 'Remove' }));
  dialog = screen.getByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Remove address' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(api.delete).toHaveBeenCalledWith('/user/addresses/home');
  expect(screen.getByRole('region', { name: 'Default address' })).toHaveTextContent('Work Recipient');
});

test('retains an address and exposes the error if removal fails', async () => {
  api.delete.mockRejectedValue(new Error('Unable to remove address. Try again.'));
  render(<Page />);
  fireEvent.click(within(await screen.findByRole('article', { name: 'Address for Home Recipient' })).getByRole('button', { name: 'Remove' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove address' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to remove address');
  expect(screen.getByRole('article', { name: 'Address for Home Recipient' })).toBeInTheDocument();
});

test('edits saved fields and persists work type, alternate number and default preference', async () => {
  api.put.mockImplementation(async (_, payload) => [home, { ...payload, _id: 'work' }]);
  render(<Page />);
  fireEvent.click(within(await screen.findByRole('article', { name: 'Address for Work Recipient' })).getByRole('button', { name: 'Edit' }));
  const dialog = screen.getByRole('dialog', { name: 'Edit address' });
  expect(within(dialog).getByLabelText('Full name')).toHaveValue('Work Recipient');
  fireEvent.change(within(dialog).getByLabelText('House / flat / block'), { target: { value: 'Suite 42' } });
  fireEvent.change(within(dialog).getByLabelText('Alternate mobile (optional)'), { target: { value: '9123456789' } });
  fireEvent.click(within(dialog).getByLabelText('Make this my default address'));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Update Address' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(api.put).toHaveBeenCalledWith('/user/addresses/work', expect.objectContaining({ houseNo: 'Suite 42', addressType: 'Work', alternateMobile: '9123456789', isDefault: true }));
  expect(screen.getByText('Suite 42')).toBeInTheDocument();
});

test('adds an address from the empty state and shows it after saving', async () => {
  api.get.mockResolvedValue([]);
  api.post.mockResolvedValue([home]);
  render(<Page />);
  fireEvent.click(await screen.findByRole('button', { name: 'Add your first address' }));
  const dialog = screen.getByRole('dialog', { name: 'Add new address' });
  const fill = (label, value) => fireEvent.change(within(dialog).getByLabelText(label), { target: { value } });
  fill('Full name', home.fullName); fill('Mobile number', home.mobile);
  fill('State', home.state); fill('District', 'Mumbai City'); fill('Pincode', home.pincode);
  fill('House / flat / block', home.houseNo); fill('Street / area', home.area);
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save Address' }));
  expect(await screen.findByRole('article', { name: 'Address for Home Recipient' })).toBeInTheDocument();
  expect(api.post).toHaveBeenCalledWith('/user/addresses', expect.objectContaining({ fullName: home.fullName, houseNo: home.houseNo, pincode: home.pincode }));
});

test('shows a retry for loading failures instead of claiming there are no addresses', async () => {
  api.get.mockRejectedValueOnce(new Error('Store unavailable'));
  render(<Page />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Store unavailable');
  expect(screen.queryByText('A place for your next delivery')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('article', { name: 'Address for Home Recipient' })).toBeInTheDocument();
});

test('does not turn a missing edit address into an accidental new address', async () => {
  render(<Page initialRoute="/profile/addresses/edit?id=missing" />);
  expect(await screen.findByText('Address not found')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Save Address' })).not.toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalled();
});

test('preserves entered details on save failure and supports escape to close', async () => {
  api.put.mockRejectedValue(new Error('Could not save address'));
  render(<Page initialRoute="/profile/addresses/edit?id=home" />);
  const input = await screen.findByLabelText('Full name');
  fireEvent.change(input, { target: { value: 'Changed name' } });
  fireEvent.click(screen.getByRole('button', { name: 'Update Address' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save address');
  expect(input).toHaveValue('Changed name');
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: false, cancelable: true }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(document.body.style.overflow).toBe('');
});

test('an outdated pincode lookup cannot overwrite a newer location', async () => {
  jest.useFakeTimers();
  let resolveLookup;
  lookupPincode.mockReturnValue(new Promise((resolve) => { resolveLookup = resolve; }));
  render(<Page initialRoute="/profile/addresses/new" />);
  await act(async () => {});
  fireEvent.change(screen.getByLabelText('Pincode'), { target: { value: '400001' } });
  act(() => jest.advanceTimersByTime(250));
  fireEvent.change(screen.getByLabelText('Pincode'), { target: { value: '11000' } });
  await act(async () => resolveLookup({ state: 'Maharashtra', district: 'Mumbai' }));
  expect(screen.getByLabelText('Pincode')).toHaveValue('11000');
  expect(screen.getByLabelText('State')).toHaveValue('');
  jest.useRealTimers();
});

test.each(['/profile/addresses/new', '/profile/addresses/edit?id=home'])(
  'every address input and dropdown uses a single bordered shell: %s', async initialRoute => {
    render(<Page initialRoute={initialRoute} />);
    await screen.findByLabelText('Full name');
    const dialog = screen.getByRole('dialog');
    const controls = [...dialog.querySelectorAll('.sc-address-form__field input, .sc-address-form__field select')];
    expect(controls).toHaveLength(9);
    controls.forEach(control => {
      expect(control.parentElement).toHaveClass('sc-field-shell');
      expect(control.parentElement.parentElement).toHaveClass('sc-address-form__field', 'min-w-0');
      act(() => control.focus());
      if (!control.disabled) expect(control).toHaveFocus();
    });
    const defaultToggle = within(dialog).getByRole('checkbox', { name: 'Make this my default address' });
    expect(defaultToggle.closest('.sc-field-shell')).toBeNull();
    expect(within(dialog).getByRole('button', { name: /Personal deliveries/ }).closest('.sc-field-shell')).toBeNull();
  },
);
