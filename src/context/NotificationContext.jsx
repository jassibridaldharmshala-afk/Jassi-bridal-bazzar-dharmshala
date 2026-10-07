import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { useAuth } from './AuthContext';
import api from '../services/api';
import { notificationDestination } from '../utils/notifications';
import '../components/notifications/Notifications.css';

const NotificationContext = createContext({ unreadCount: 0, revision: 0, refresh: async () => {}, changed: async () => {} });
export function NotificationProvider({ children, navigate }) {
  const { user } = useAuth();
  const userId = String(user?._id || user?.id || '');
  const notificationBase = user?.activeMode === 'seller' ? '/seller/notifications' : '/notifications';
  const [summary, setSummary] = useState({ userId: '', unreadCount: 0 });
  const [revision, setRevision] = useState(0);
  const [banner, setBanner] = useState(null);
  const latestSeen = useRef(null);
  const sequence = useRef(0);
  const activeUser = useRef(userId);
  activeUser.current = userId;
  const refresh = useCallback(async () => {
    if (!userId || document.visibilityState === 'hidden') return;
    const request = ++sequence.current;
    try {
      const data = await api.get(`${notificationBase}/summary`, { silent: true });
      if (activeUser.current !== userId || request !== sequence.current) return;
      const timestamp = data.latest?.createdAt ? new Date(data.latest.createdAt).getTime() : 0;
      if (latestSeen.current !== null && timestamp > latestSeen.current) {
        setBanner({ ...data.latest, userId }); setRevision((value) => value + 1);
      }
      latestSeen.current = Math.max(latestSeen.current || 0, timestamp);
      setSummary({ userId, unreadCount: Number(data.unreadCount) || 0 });
    } catch {
      // Keep the last known count when the service is temporarily unavailable.
    }
  }, [notificationBase, userId]);

  useEffect(() => {
    latestSeen.current = null; setBanner(null); sequence.current += 1;
    if (!userId) return undefined;
    refresh();
    const onStorage = (event) => {
      if (event.key !== 'samira_notifications_changed') return;
      try { if (JSON.parse(event.newValue)?.userId !== userId) return; } catch { return; }
      setRevision((value) => value + 1); refresh();
    };
    const onFocus = () => { setRevision((value) => value + 1); refresh(); };
    const interval = window.setInterval(refresh, 30000);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('storage', onStorage);
    return () => {
      sequence.current += 1; window.clearInterval(interval);
      window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus); window.removeEventListener('storage', onStorage);
    };
  }, [refresh, userId]);
  useEffect(() => {
    if (!banner) return undefined;
    const timer = window.setTimeout(() => setBanner(null), 8000);
    return () => window.clearTimeout(timer);
  }, [banner]);
  const changed = useCallback(async () => {
    setRevision((value) => value + 1);
    try { localStorage.setItem('samira_notifications_changed', JSON.stringify({ userId, at: Date.now(), nonce: Math.random() })); } catch { /* Storage may be disabled. */ }
    await refresh();
  }, [refresh, userId]);
  const value = useMemo(() => ({ unreadCount: summary.userId === userId ? summary.unreadCount : 0, revision, refresh, changed }), [summary, userId, revision, refresh, changed]);
  return <NotificationContext.Provider value={value}>{children}
    {banner && banner.userId === userId && <div className="sc-notification-banner" role="status" aria-live="polite"><Bell size={21} /><div><strong>{banner.title || 'New notification'}</strong><p>{banner.message}</p><button onClick={() => { setBanner(null); navigate(user?.activeMode === 'seller' ? '/seller/notifications' : '/notifications'); }}>View notification</button></div><button aria-label="Dismiss notification alert" onClick={() => setBanner(null)}><X size={18} /></button></div>}
  </NotificationContext.Provider>;
}
export const useNotifications = () => useContext(NotificationContext);
export function useOpenNotification(navigate) {
  const { user, switchMode, notify } = useAuth();
  const { changed } = useNotifications();
  return async (item) => {
    if (!item.readAt) {
      const notificationBase = user?.activeMode === 'seller' ? '/seller/notifications' : '/notifications';
      try { await api.patch(`${notificationBase}/${item._id}/read`, {}); await changed(); }
      catch (error) { notify?.(error.message || 'Unable to mark this notification as read.', 'error'); }
    }
    const path = notificationDestination(item, user);
    if (!path) return;
    if (path.startsWith('/admin') && user?.activeMode !== 'admin') await switchMode('admin', path);
    else navigate(path);
  };
}
