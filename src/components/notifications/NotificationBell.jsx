import { Bell } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';

export default function NotificationBell({ navigate, admin = false, desktop = false }) {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  if (!user) return null;
  return <button type="button" className={`sc-notification-bell${desktop ? ' sc-notification-bell--desktop' : ''}${admin ? ' sc-notification-bell--admin' : ''}`}
    aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'} onClick={() => navigate(admin ? '/admin/notifications' : '/notifications')}>
    <span className="sc-notification-bell__icon"><Bell size={desktop ? 24 : 22} strokeWidth={1.85} />{unreadCount > 0 && <span className="sc-notification-bell__badge" aria-hidden="true">{unreadCount > 99 ? '99+' : unreadCount}</span>}</span>
    {desktop && <span className="sc-notification-bell__label">Alerts</span>}
  </button>;
}
