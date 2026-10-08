import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import MyRentals from './MyRentals';
import api from '../../services/api';
jest.mock('../../services/api', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../../context/StorefrontContext', () => ({ useStorefront: () => ({ storeSlug: 'bridal-shop' }) }));
jest.mock('../../context/BrandIdentityContext', () => ({ useBrandIdentity: () => ({ websiteName: 'Bridal shop' }) }));
jest.mock('../../components/rentals/RentalProofPanel', () => () => null);
jest.mock('../../components/rentals/RentalDocuments', () => () => null);
jest.mock('../../components/rentals/RentalBookingDetails', () => () => null);
jest.mock('../../components/rentals/RentalWaitlist', () => () => null);
const booking = id => ({ _id: id, number: `R-${id}`, customer: { name: 'Customer' }, status: 'CONFIRMED', revision: 1, policy: { timezone: 'Asia/Kolkata' }, schedule: {}, quote: { items: [], rentalPaise: 100000, depositPaise: 200000, advanceRentPaise: 30000, dueNowPaise: 230000 }, financial: { balancePaise: 70000 }, requests: [], events: [], pieces: [], ledger: [], assessments: [] });
const flush = async () => { await act(async () => { await Promise.resolve(); }); };
beforeEach(() => { jest.clearAllMocks(); jest.useFakeTimers(); });
afterEach(() => jest.useRealTimers());
test('booking tracking refreshes automatically and when the customer returns to the tab', async () => {
  api.get.mockImplementation(path => Promise.resolve(path.includes('payment-methods') ? [] : booking('one')));
  const view = render(<MyRentals route="/rentals?id=one" navigate={jest.fn()} />);
  await flush();
  expect(screen.getByText('R-one')).toBeInTheDocument();
  const count = () => api.get.mock.calls.filter(([path]) => path.includes('/bookings/one')).length;
  expect(count()).toBe(1);
  await act(async () => { jest.advanceTimersByTime(20000); });
  expect(count()).toBe(2);
  fireEvent(window, new Event('focus')); await flush();
  expect(count()).toBe(3);
  view.unmount();
  await act(async () => { jest.advanceTimersByTime(40000); });
  expect(count()).toBe(3);
});
test('late responses from a different booking cannot replace the current booking', async () => {
  let finishOld;
  api.get.mockImplementation(path => path.includes('payment-methods') ? Promise.resolve([]) : path.includes('/bookings/old') ? new Promise(resolve => { finishOld = resolve; }) : Promise.resolve(booking('new')));
  const view = render(<MyRentals route="/rentals?id=old" navigate={jest.fn()} />);
  view.rerender(<MyRentals route="/rentals?id=new" navigate={jest.fn()} />); await flush();
  await act(async () => finishOld(booking('old')));
  expect(screen.getByText('R-new')).toBeInTheDocument(); expect(screen.queryByText('R-old')).not.toBeInTheDocument();
});
test('a failed booking load offers retry without an endless loading message', async () => {
  api.get.mockImplementation(path => path.includes('payment-methods') ? Promise.resolve([]) : Promise.reject(new Error('Booking unavailable')));
  render(<MyRentals route="/rentals?id=missing" navigate={jest.fn()} />); await flush();
  expect(screen.getAllByRole('alert').some(node => node.textContent.includes('Booking unavailable'))).toBe(true); expect(screen.queryByText('Loading booking…')).not.toBeInTheDocument();
  api.get.mockResolvedValue(booking('missing'));
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' })); await flush();
  expect(screen.getByText('R-missing')).toBeInTheDocument();
});

test('failed payment methods expose retry and refresh also reloads the options', async () => {
  let failMethods = true;
  api.get.mockImplementation(path => path.includes('payment-methods') ? failMethods ? Promise.reject(new Error('Payment options offline')) : Promise.resolve([{ key: 'UPI', label: 'UPI', enabled: true }]) : Promise.resolve(booking('one')));
  render(<MyRentals route="/rentals?id=one" navigate={jest.fn()} />); await flush();
  expect(screen.getByRole('button', { name: 'Retry payment options' })).toBeInTheDocument();
  failMethods = false; fireEvent.click(screen.getByRole('button', { name: 'Retry payment options' })); await flush();
  expect(screen.getByLabelText('Online payment method')).toHaveValue('UPI');
  const previous = api.get.mock.calls.filter(([path]) => path.includes('payment-methods')).length;
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' })); await flush();
  expect(api.get.mock.calls.filter(([path]) => path.includes('payment-methods')).length).toBe(previous + 1);
});
