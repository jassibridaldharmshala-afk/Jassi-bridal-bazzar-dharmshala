import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import api from '../../services/api';
import Notifications from './Notifications';
import { NotificationProvider } from '../../context/NotificationContext';
import NotificationBell from '../../components/notifications/NotificationBell';

jest.mock('../../services/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    patch: jest.fn(),
  },
}));

const mockSwitchMode = jest.fn();
let mockUser = { _id: 'customer-1', name: 'Customer', role: 'customer' };
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: mockUser, logout: jest.fn(), switchMode: mockSwitchMode, notify: jest.fn() }) }));
let records;
const shipped = () => ({ _id: 'notification-1', event: 'ORDER_SHIPPED', title: 'Order shipped', message: 'Your order is on the way.', createdAt: '2026-09-04T08:00:00.000Z', metadata: { orderId: 'order-1' } });
function mount(route = '/notifications') {
  const navigate = jest.fn();
  render(<NotificationProvider navigate={navigate}><NotificationBell navigate={navigate} admin={route.startsWith('/admin')} /><Notifications route={route} navigate={navigate} /></NotificationProvider>);
  return navigate;
}
describe('customer notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('loads notifications, records a read receipt, and opens the related order', async () => {
    const navigate = jest.fn();
    const notification = {
      _id: 'notification-1',
      title: 'Order shipped',
      message: 'Your order is on the way.',
      createdAt: '2026-09-04T08:00:00.000Z',
      metadata: { orderId: 'order-1' },
    };
    api.get.mockResolvedValue([notification]);
    api.patch.mockResolvedValue({ ...notification, readAt: '2026-09-04T08:05:00.000Z' });

    render(<Notifications navigate={navigate} />);

    expect(await screen.findByText('Order shipped')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Order shipped/i }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/notifications/notification-1/read', {});
      expect(navigate).toHaveBeenCalledWith('/order-detail?id=order-1');
    });
  });

  test('shows a useful empty state', async () => {
    api.get.mockResolvedValue([]);

    render(<Notifications navigate={jest.fn()} />);

    expect(await screen.findByRole('heading', { name: 'No notifications yet' })).toBeInTheDocument();
    expect(screen.getByText('Order and return updates will appear here.')).toBeInTheDocument();
  });

  test.each([undefined, { success: false }, { items: [null] }])('an invalid list response shows recovery instead of crashing or claiming no updates', async (response) => {
    api.get.mockResolvedValueOnce(response).mockResolvedValue([shipped()]);
    render(<Notifications navigate={jest.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Notifications could not be loaded');
    expect(screen.queryByText('No notifications yet')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Order shipped')).toBeInTheDocument();
  });
});

describe('notification centre and navbar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { _id: 'customer-1', name: 'Customer', role: 'customer' };
    records = [shipped()];
    api.get.mockImplementation(async (path) => {
      if (path === '/notifications/summary') return { unreadCount: records.filter((item) => !item.readAt).length, latest: records.find((item) => !item.readAt) || null };
      const query = new URLSearchParams(path.split('?')[1]);
      const items = records.filter((item) => (!query.get('read') || !item.readAt) && (!query.get('category') || item.event.startsWith('RETURN_')));
      return { items, total: items.length, totalPages: 1 };
    });
    api.patch.mockImplementation(async (path, body) => {
      records = records.map((item) => path.includes('read-all') || path.includes(item._id) ? { ...item, readAt: body.read === false ? null : '2026-09-05T09:00:00Z' } : item);
      return {};
    });
  });

  test('opening an order persists the read receipt and clears the shared navbar badge', async () => {
    const navigate = mount();
    expect(await screen.findByRole('button', { name: 'Notifications, 1 unread' })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: /^Order shipped/ }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/order-detail?id=order-1'));
    expect(api.patch).toHaveBeenCalledWith('/notifications/notification-1/read', {});
    await screen.findByText('0 unread updates');
  });

  test('mark all read uses one bulk request and clears the badge', async () => {
    records.push({ ...shipped(), _id: 'notification-2', title: 'Another update' });
    mount(); await screen.findByText('2 unread updates');
    fireEvent.click(screen.getByRole('button', { name: 'Mark all read' }));
    await screen.findByText('0 unread updates');
    expect(api.patch).toHaveBeenCalledTimes(1); expect(api.patch).toHaveBeenCalledWith('/notifications/read-all', {});
  });

  test('mark unread restores the badge without navigating', async () => {
    records[0].readAt = '2026-09-04T09:00:00Z';
    const navigate = mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Mark unread: Order shipped' }));
    await screen.findByText('1 unread update');
    expect(api.patch).toHaveBeenCalledWith('/notifications/notification-1/read', { read: false });
    expect(navigate).not.toHaveBeenCalled();
  });

  test('category and unread filters request the matching server data', async () => {
    mount(); await screen.findByText('Order shipped');
    fireEvent.click(within(screen.getByRole('group', { name: 'Notification categories' })).getByRole('button', { name: 'Returns' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Unread only' }));
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/notifications?page=1&limit=20&category=returns&read=unread', {
      silent: true,
      cacheFirst: true,
      cacheScope: 'customer-1',
      forceRefetch: false,
    }));
    expect(await screen.findByText('There are no updates matching these filters.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View all updates' }));
    expect(await screen.findByText('Order shipped')).toBeInTheDocument();
  });

  test('admin alert switches to admin mode and opens the matching request', async () => {
    mockUser = { _id: 'admin-1', role: 'admin', activeMode: 'customer' };
    records = [{ ...shipped(), audience: 'ADMIN', event: 'RETURN_REQUESTED', title: 'Return needs review', metadata: { returnId: 'return-1', orderId: 'order-1' } }];
    mount(); fireEvent.click(await screen.findByRole('button', { name: /^Return needs review/ }));
    await waitFor(() => expect(mockSwitchMode).toHaveBeenCalledWith('admin', '/admin/returns?search=return-1'));
  });

  test('an admin personal purchase still opens the customer order screen', async () => {
    mockUser = { _id: 'admin-1', role: 'admin', activeMode: 'admin' };
    const navigate = mount('/admin/notifications');
    fireEvent.click(await screen.findByRole('button', { name: /^Order shipped/ }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/order-detail?id=order-1'));
    expect(mockSwitchMode).not.toHaveBeenCalled();
  });

  test('failed read updates keep the unread count and show the error', async () => {
    api.patch.mockRejectedValue(new Error('Connection interrupted'));
    mount(); fireEvent.click(await screen.findByRole('button', { name: 'Mark read: Order shipped' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Connection interrupted');
    expect(screen.getByText('1 unread update')).toBeInTheDocument();
  });

  test('guests can sign in without making authenticated requests', async () => {
    mockUser = null; mount();
    expect(await screen.findByRole('heading', { name: 'Sign in for your updates' })).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
  });
});
