import { AlertTriangle, Check, Info, X, XCircle } from 'lucide-react';
import './AppToast.css';

const icons = { success: Check, error: XCircle, warning: AlertTriangle, info: Info };

export default function AppToast({ toast, onDismiss, activeMode = 'customer' }) {
  if (!toast) return null;
  const type = Object.prototype.hasOwnProperty.call(icons, toast.type) ? toast.type : 'info';
  const StatusIcon = icons[type];

  return (
    <div className="app-toast-region" data-mode={activeMode}>
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
