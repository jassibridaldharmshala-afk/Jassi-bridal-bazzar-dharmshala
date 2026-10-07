import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import api from '../services/api';
import { NotificationProvider, useNotifications } from './NotificationContext';
import NotificationBell from '../components/notifications/NotificationBell';
jest.mock('../services/api', () => ({ __esModule: true, default: { get: jest.fn(), patch: jest.fn() } }));
let mockUser;
jest.mock('./AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
function Probe() { const { revision } = useNotifications(); return <span data-testid="revision">{revision}</span>; }
const tree = (navigate = jest.fn()) => <NotificationProvider navigate={navigate}><NotificationBell navigate={navigate} /><Probe /></NotificationProvider>;
beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); mockUser = { _id: 'user-1' }; api.get.mockResolvedValue({ unreadCount: 0, latest: null }); });
afterEach(() => { jest.useRealTimers(); });

test('initial badge caps at 99+ and polling shows only newly arriving alerts', async () => {
  api.get.mockResolvedValueOnce({ unreadCount: 120, latest: { createdAt: '2026-09-01', title: 'Old update' } });
  const navigate = jest.fn();
  await act(async () => { render(tree(navigate)); });
  expect(screen.getByRole('button', { name: 'Notifications, 120 unread' })).toHaveTextContent('99+');
  expect(screen.queryByText('Old update')).not.toBeInTheDocument();
  api.get.mockResolvedValue({ unreadCount: 121, latest: { createdAt: '2026-09-05', title: 'New order received', message: 'Ready for review' } });
  await act(async () => { jest.advanceTimersByTime(30000); });
  expect(screen.getByRole('status')).toHaveTextContent('New order received');
  expect(api.get).toHaveBeenLastCalledWith('/notifications/summary', { silent: true });
  fireEvent.click(screen.getByRole('button', { name: 'View notification' }));
  expect(navigate).toHaveBeenCalledWith('/notifications');
});

test('read receipts from another tab refresh the badge and inbox', async () => {
  api.get.mockResolvedValueOnce({ unreadCount: 2 });
  await act(async () => { render(tree()); });
  await act(async () => { window.dispatchEvent(new StorageEvent('storage', { key: 'samira_notifications_changed', newValue: JSON.stringify({ userId: 'user-1' }) })); });
  expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  expect(screen.getByTestId('revision')).toHaveTextContent('1');
});

test('late responses from a previous account never expose its badge or content', async () => {
  let resolveFirst;
  api.get.mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }));
  const view = render(tree());
  mockUser = { _id: 'user-2' };
  await act(async () => { view.rerender(tree()); });
  await act(async () => { resolveFirst({ unreadCount: 45, latest: { title: 'Private update', createdAt: '2026-09-05' } }); });
  expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  expect(screen.queryByText('Private update')).not.toBeInTheDocument();
});

test('polling stops on logout and resumes on login', async () => {
  const view = render(tree()); await act(async () => {});
  mockUser = null;
  await act(async () => { view.rerender(tree()); });
  api.get.mockClear();
  await act(async () => { jest.advanceTimersByTime(60000); });
  expect(api.get).not.toHaveBeenCalled(); expect(screen.queryByRole('button')).not.toBeInTheDocument();
  mockUser = { _id: 'user-2' };
  await act(async () => { view.rerender(tree()); });
  expect(api.get).toHaveBeenCalledTimes(1);
});

test('hidden tabs skip polling and focus refreshes the count', async () => {
  const visibility = jest.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  await act(async () => { render(tree()); jest.advanceTimersByTime(30000); });
  expect(api.get).not.toHaveBeenCalled();
  visibility.mockReturnValue('visible');
  await act(async () => { window.dispatchEvent(new Event('focus')); });
  expect(api.get).toHaveBeenCalledTimes(1); visibility.mockRestore();
});
