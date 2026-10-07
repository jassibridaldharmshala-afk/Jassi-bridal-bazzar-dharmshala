import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, RefreshCw, WifiOff, X } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useNotifications } from '../../context/NotificationContext';
import './MobileAppCompanion.css';

const INSTALL_DISMISSED_KEY = 'jassi-general-store_install_prompt_dismissed';

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function wasInstallDismissed() {
  try { return localStorage.getItem(INSTALL_DISMISSED_KEY) === '1'; } catch { return false; }
}

export default function MobileAppCompanion({ enabled = true }) {
  const cart = useCart();
  const notifications = useNotifications();
  const [online, setOnline] = useState(() => navigator.onLine !== false);
  const [installEvent, setInstallEvent] = useState(null);
  const [updateRegistration, setUpdateRegistration] = useState(null);
  const [installDismissed, setInstallDismissed] = useState(wasInstallDismissed);
  const reloading = useRef(false);
  const mobile = useMemo(() => window.matchMedia?.('(max-width: 767px)').matches ?? false, []);
  const badgeCount = Math.max(0, Number(cart?.itemCount || 0) + Number(notifications?.unreadCount || 0));

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    const onInstallAvailable = (event) => {
      event.preventDefault();
      if (!isStandalone()) setInstallEvent(event);
    };
    const onInstalled = () => setInstallEvent(null);
    const onUpdate = (event) => setUpdateRegistration(event.detail?.registration || null);
    const onControllerChange = () => {
      if (reloading.current) return;
      reloading.current = true;
      window.location.reload();
    };
    window.addEventListener('beforeinstallprompt', onInstallAvailable);
    window.addEventListener('appinstalled', onInstalled);
    window.addEventListener('samira:pwa-update', onUpdate);
    navigator.serviceWorker?.addEventListener('controllerchange', onControllerChange);
    return () => {
      window.removeEventListener('beforeinstallprompt', onInstallAvailable);
      window.removeEventListener('appinstalled', onInstalled);
      window.removeEventListener('samira:pwa-update', onUpdate);
      navigator.serviceWorker?.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  useEffect(() => {
    if (!enabled || !('setAppBadge' in navigator)) return;
    try {
      const operation = badgeCount > 0 ? navigator.setAppBadge(badgeCount) : navigator.clearAppBadge?.();
      Promise.resolve(operation).catch(() => null);
    } catch {
      // Badging is optional and may be blocked outside an installed app.
    }
  }, [badgeCount, enabled]);

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice.catch(() => null);
    setInstallEvent(null);
  };

  const dismissInstall = () => {
    try { localStorage.setItem(INSTALL_DISMISSED_KEY, '1'); } catch { /* Private browsing may block storage. */ }
    setInstallDismissed(true);
  };

  const applyUpdate = () => {
    const worker = updateRegistration?.waiting;
    if (worker) worker.postMessage({ type: 'SKIP_WAITING' });
    else window.location.reload();
  };

  if (!enabled) return null;

  return (
    <div className="sc-app-companion" aria-live="polite">
      {!online && (
        <div className="sc-app-companion__notice sc-app-companion__notice--offline" role="status">
          <WifiOff size={18} aria-hidden="true" />
          <span><strong>You are offline</strong><small>Saved pages remain available. Connect before checkout or updating data.</small></span>
        </div>
      )}
      {updateRegistration && (
        <div className="sc-app-companion__notice" role="status">
          <RefreshCw size={18} aria-hidden="true" />
          <span><strong>Update ready</strong><small>Refresh to use the latest store version.</small></span>
          <button type="button" onClick={applyUpdate}>Refresh</button>
        </div>
      )}
      {mobile && installEvent && !installDismissed && !isStandalone() && (
        <div className="sc-app-companion__install" role="status">
          <span className="sc-app-companion__install-icon"><Download size={19} aria-hidden="true" /></span>
          <span><strong>Install the store app</strong><small>Faster access from your home screen.</small></span>
          <button type="button" onClick={install}>Install</button>
          <button type="button" className="sc-app-companion__close" aria-label="Dismiss install suggestion" onClick={dismissInstall}><X size={17} /></button>
        </div>
      )}
    </div>
  );
}
