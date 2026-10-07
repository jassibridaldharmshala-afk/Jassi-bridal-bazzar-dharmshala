import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Bell, CheckCheck, ChevronRight, CreditCard, Headphones, Package, RefreshCw, RotateCcw, Truck } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useNotifications, useOpenNotification } from '../../context/NotificationContext';
import AccountSidebar from '../../components/layout/AccountSidebar';
import { notificationCategory, notificationDate, notificationDestination } from '../../utils/notifications';
import './Profile.css';
import '../../components/notifications/Notifications.css';

const filters = [['', 'All updates'], ['orders', 'Orders'], ['returns', 'Returns'], ['payments', 'Payments'], ['support', 'Support']];
const icons = { orders: Package, returns: RotateCcw, payments: CreditCard, support: Headphones, updates: Bell };
export default function Notifications({ navigate, route = '/notifications' }) {
  const { user, logout } = useAuth();
  const notificationBase = user?.activeMode === 'seller' ? '/seller/notifications' : '/notifications';
  const { unreadCount, revision, changed, refresh } = useNotifications();
  const openNotification = useOpenNotification(navigate);
  const admin = route.startsWith('/admin');
  const workspace = admin || route.startsWith('/seller');
  const [data, setData] = useState({ items: [], total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [category, setCategory] = useState('');
  const [read, setRead] = useState('');
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const refreshVersion = useRef({ reload, revision });
  const [busy, setBusy] = useState('');
  const userId = user?._id || user?.id;
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    const query = new URLSearchParams({ page: String(page), limit: '20' });
    if (category) query.set('category', category);
    if (read) query.set('read', read);
    if (!userId) { setData({ items: [], total: 0, totalPages: 1 }); setLoading(false); return undefined; }
    const forceRefetch = refreshVersion.current.reload !== reload || refreshVersion.current.revision !== revision;
    refreshVersion.current = { reload, revision };
    api.get(`${notificationBase}?${query}`, { silent: true, cacheFirst: true, cacheScope: String(userId), forceRefetch }).then((result) => {
      if (!active) return;
      const next = Array.isArray(result) ? { items: result, total: result.length, totalPages: 1 } : result;
      if (!Array.isArray(next?.items) || next.items.some((item) => !item || !item._id)) {
        throw new Error('Notifications could not be loaded. Please try again.');
      }
      const totalPages = Math.max(1, Number(next.totalPages) || 1);
      setData({ ...next, totalPages });
      if (page > totalPages) setPage(totalPages);
    }).catch((err) => { if (active) setError(err.message || 'Unable to load notifications.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId, page, category, read, revision, reload, notificationBase]);
  const groups = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    return data.items.reduce((result, item) => {
      const time = new Date(item.createdAt).getTime();
      const label = time >= today.getTime() ? 'Today' : time >= yesterday.getTime() ? 'Yesterday' : 'Earlier';
      (result[label] ||= []).push(item); return result;
    }, {});
  }, [data.items]);
  const markAll = async () => {
    if (busy) return; setBusy('all'); setActionError('');
    try { await api.patch(`${notificationBase}/read-all`, {}); await changed(); setReload((value) => value + 1); }
    catch (err) { setActionError(err.message || 'Unable to mark notifications as read.'); }
    finally { setBusy(''); }
  };
  const toggleRead = async (item) => {
    if (busy) return; setBusy(item._id); setActionError('');
    try { await api.patch(`${notificationBase}/${item._id}/read`, { read: !item.readAt }); await changed(); setReload((value) => value + 1); }
    catch (err) { setActionError(err.message || 'Unable to update this notification.'); }
    finally { setBusy(''); }
  };
  const open = async (item) => {
    if (busy) return;
    setBusy(item._id);
    try { await openNotification(item); setReload((value) => value + 1); }
    catch (err) { setActionError(err.message || 'Unable to open this notification.'); }
    finally { setBusy(''); }
  };
  return <section className={`sc-notifications${workspace ? ' sc-notifications--admin' : ''}`}>
    <div className="sc-notifications__shell">
      {!workspace && <nav className="sc-notifications__breadcrumb" aria-label="Breadcrumb"><button onClick={() => navigate('/')}>Home</button><ChevronRight size={13} /><button onClick={() => navigate('/profile')}>My Account</button><ChevronRight size={13} /><span>Notifications</span></nav>}
      <div className="sc-notifications__layout">{!workspace && <AccountSidebar user={user} navigate={navigate} logout={logout} activePath="/notifications" />}
        <div className="sc-notifications__main">
          <header className="sc-notifications__heading"><button className="sc-notifications__back" onClick={() => navigate(workspace ? (admin ? '/admin' : '/seller') : '/profile')} aria-label={workspace ? 'Back to dashboard' : 'Back to profile'}><ArrowLeft size={21} /></button>
            <div><p className="sc-notifications__eyebrow">{workspace ? 'STORE UPDATES' : 'MY ACCOUNT'}</p><h1>Notifications</h1><p>{unreadCount} unread update{unreadCount === 1 ? '' : 's'}</p></div>
            <button className="sc-notifications__mark-all" disabled={!!busy || !unreadCount} onClick={markAll}><CheckCheck size={17} />{busy === 'all' ? 'Updating...' : 'Mark all read'}</button>
          </header>
          <div className="sc-notifications__toolbar"><div className="sc-notifications__filters" role="group" aria-label="Notification categories">{filters.map(([value, label]) => <button key={value} aria-pressed={category === value} onClick={() => { setCategory(value); setPage(1); }}>{label}</button>)}</div>
            <div className="sc-notifications__read-filter"><label><input type="checkbox" checked={read === 'unread'} onChange={(event) => { setRead(event.target.checked ? 'unread' : ''); setPage(1); }} />Unread only</label><button aria-label="Refresh notifications" disabled={loading} onClick={() => { refresh(); setReload((value) => value + 1); }}><RefreshCw size={17} /></button></div>
          </div>
          {actionError && <p className="sc-notifications__error" role="alert">{actionError}</p>}
          {!userId ? <div className="sc-notifications__state"><Bell size={36} /><h2>Sign in for your updates</h2><button onClick={() => navigate('/login?redirect=/notifications')}>Sign in</button></div>
            : loading ? <div className="sc-notifications__state" role="status">Loading notifications...</div>
              : error ? <div className="sc-notifications__state" role="alert"><h2>Unable to load notifications</h2><p>{error}</p><button onClick={() => setReload((value) => value + 1)}>Try again</button></div>
                : !data.items.length ? <div className="sc-notifications__state"><Bell size={36} strokeWidth={1.4} /><h2>{category || read ? 'All caught up here' : 'No notifications yet'}</h2><p>{category || read ? 'There are no updates matching these filters.' : 'Order and return updates will appear here.'}</p>{(category || read) && <button onClick={() => { setCategory(''); setRead(''); setPage(1); }}>View all updates</button>}</div>
                  : <>{Object.entries(groups).map(([label, items]) => <section className="sc-notifications__group" key={label} aria-label={label}><h2>{label}</h2><div className="sc-notifications__list">{items.map((item) => {
                    const Icon = /SHIPPED|DELIVERY/.test(item.event || '') ? Truck : icons[notificationCategory(item)];
                    const path = notificationDestination(item, user);
                    return <article key={item._id} className={`sc-notification${item.readAt ? '' : ' is-unread'}`}>
                      <button className="sc-notification__open" disabled={!!busy} onClick={() => open(item)}>
                        <span className={`sc-notification__icon sc-notification__icon--${notificationCategory(item)}`}><Icon size={21} strokeWidth={1.7} /></span>
                        <span className="sc-notification__body"><span className="sc-notification__title">{item.title || 'Account update'}{item.audience === 'ADMIN' && <span className="sc-notification__admin">Admin</span>}</span><span className="sc-notification__message">{item.message || item.event}</span><time dateTime={item.createdAt}>{notificationDate(item.createdAt)}</time>{path && <span className="sc-notification__link">{item.metadata?.returnId ? 'View request' : item.metadata?.orderId ? 'View order' : 'View details'}<ChevronRight size={13} /></span>}</span>
                        {!item.readAt && <span className="sc-notification__dot" aria-label="Unread" />}
                      </button>
                      <button className="sc-notification__read" disabled={!!busy} aria-label={`${item.readAt ? 'Mark unread' : 'Mark read'}: ${item.title || 'Account update'}`} onClick={() => toggleRead(item)}>{item.readAt ? 'Mark unread' : 'Mark read'}</button>
                    </article>;
                  })}</div></section>)}
                  {data.totalPages > 1 && <nav className="sc-notifications__pages" aria-label="Notification pages"><button disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>{page} / {data.totalPages}</span><button disabled={page >= data.totalPages} onClick={() => setPage((value) => value + 1)}>Next</button></nav>}</>}
        </div>
      </div>
    </div>
  </section>;
}
