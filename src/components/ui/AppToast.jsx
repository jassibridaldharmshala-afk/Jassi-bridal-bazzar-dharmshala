import { AlertTriangle, Check, Info, X, XCircle } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { getAdminActivitySnapshot, isAdminWorkspace, subscribeAdminActivity } from '../../utils/adminActivity';
import './AppToast.css';

const icons = { success: Check, error: XCircle, warning: AlertTriangle, info: Info };

export default function AppToast({ toast, onDismiss, activeMode = 'customer' }) {
  const activity = useSyncExternalStore(subscribeAdminActivity, getAdminActivitySnapshot, getAdminActivitySnapshot);
  const workspace = ['admin', 'seller', 'master'].includes(activeMode) || isAdminWorkspace();
  if (!toast) return null;
  const type = Object.prototype.hasOwnProperty.call(icons, toast.type) ? toast.type : 'info';
  const StatusIcon = icons[type];
  if (workspace && activity.active && !['error', 'warning'].includes(type)) return null;

  return (
    <div className={`app-toast-region${workspace ? ' app-toast-region--workspace' : ''}`} data-mode={activeMode}>
      <div className={`app-toast app-toast--${type}`}>
        <div className="app-toast__content" role="status" aria-live="polite" aria-atomic="true">
          <span className="app-toast__icon" aria-hidden="true"><StatusIcon size={18} strokeWidth={1.8} /></span>
          <div className="app-toast__copy">
            {toast.title && <p className="app-toast__title">{toast.title}</p>}
            <p className="app-toast__message">{toast.message}</p>
          </div>
        </div>
        <button type="button" className="app-toast__dismiss" onClick={onDismiss} aria-label="Dismiss notification">
          <X size={16} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
