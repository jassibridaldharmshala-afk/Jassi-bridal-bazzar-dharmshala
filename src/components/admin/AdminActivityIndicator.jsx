import { useEffect, useState, useSyncExternalStore } from 'react';
import { getAdminActivitySnapshot, installAdminActionGuard, subscribeAdminActivity } from '../../utils/adminActivity';
import useAdminActivity from '../../hooks/useAdminActivity';

export default function AdminActivityIndicator({ enabled }) {
  const activity = useSyncExternalStore(subscribeAdminActivity, getAdminActivitySnapshot, getAdminActivitySnapshot);
  const [visible, setVisible] = useState(false);
  const [slow, setSlow] = useState(false);
  useEffect(() => enabled ? installAdminActionGuard() : undefined, [enabled]);
  useEffect(() => {
    if (!enabled || !activity.active) { setVisible(false); setSlow(false); return undefined; }
    setSlow(Date.now() - activity.startedAt >= 10000);
    const reveal = window.setTimeout(() => setVisible(true), 180);
    const delayed = window.setTimeout(() => setSlow(true), Math.max(0, activity.startedAt + 10000 - Date.now()));
    return () => { window.clearTimeout(reveal); window.clearTimeout(delayed); };
  }, [enabled, activity.active, activity.startedAt]);
  if (!enabled || !activity.active || !visible) return null;
  return <aside className="admin-activity" role="status" aria-live="polite" aria-atomic="true" aria-label="Admin progress" data-admin-activity data-kind={activity.kind}>
    <span className="admin-activity__mark" aria-hidden="true"><span className="admin-activity__ring" /><span className="admin-activity__gem" /></span>
    <span className="admin-activity__copy"><strong>{activity.label}</strong><small>{slow ? 'Taking a little longer. Please wait.' : 'Please wait. Your request is in progress.'}</small></span>
  </aside>;
}

export function AdminLoadingPlaceholder({ label = 'Loading workspace' }) {
  useAdminActivity(true, label);
  return <div className="admin-loading-placeholder" aria-busy="true" aria-label={label}>
    <span className="sr-only">{label}</span>
    <div aria-hidden="true"><span /><span /><span /></div>
  </div>;
}
