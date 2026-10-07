import { useEffect, useRef, useState } from 'react';
import api from '../services/api';
import { isRestrictedSubscription, normalizeSubscription, SUBSCRIPTION_REQUIRED_EVENT, SUBSCRIPTION_STATUS_EVENT, subscriptionIdentity } from '../utils/subscriptionNotice';

const SUMMARY_PATH = '/system/license?summary=1';
const REFRESH_PATH = '/system/license/refresh?summary=1';
const ACTIVE_POLL_MS = 180000;
const RESTRICTED_POLL_MS = 60000;

export default function useClientSubscription(user) {
  const userId = subscriptionIdentity(user);
  const enabled = Boolean(userId && user?.role === 'admin' && user?.activeMode === 'admin' && !user?.offlineSession);
  const [state, setState] = useState({ userId: '', data: null, checking: false, error: '' });
  const refreshRef = useRef(null);

  useEffect(() => {
    setState({ userId, data: null, checking: false, error: '' });
    if (!enabled) return undefined;
    let disposed = false;
    let current = null;
    let pending = null;
    let pendingForce = false;
    let lastRequest = 0;
    let lastRestrictionCheck = 0;
    let expiryTimer;
    let pollTimer;
    let revision = 0;
    const controller = new AbortController();
    const visible = () => document.visibilityState !== 'hidden';
    const update = (changes) => { if (!disposed) setState((value) => ({ ...value, userId, ...changes })); };

    const schedule = () => {
      clearTimeout(pollTimer); clearTimeout(expiryTimer);
      if (disposed || current?.managed === false) return;
      pollTimer = setTimeout(() => {
        if (visible()) check(isRestrictedSubscription(current?.status));
        else schedule();
      }, isRestrictedSubscription(current?.status) ? RESTRICTED_POLL_MS : ACTIVE_POLL_MS);
      const end = Date.parse(current?.endsAt);
      if (current?.managed && ['ACTIVE', 'TRIAL'].includes(current.status) && Number.isFinite(end)) {
        expiryTimer = setTimeout(async () => {
          // A master renewal may already exist beyond this cached end date.
          // Verify it first instead of briefly flashing an incorrect popup.
          const verified = visible() ? await check(true) : null;
          if (!verified && !disposed) accept({ ...current, serverNow: undefined });
        }, Math.min(86400000, Math.max(25, end - Date.now() - current.clockOffset + 25)));
      }
    };
    const accept = (data) => {
      const next = normalizeSubscription(data, current?.clockOffset);
      if (!next) return false;
      current = next; update({ data: next, error: '' }); schedule(); return true;
    };
    // The snapshot may be refreshed by the billing page while an older
    // background request is in flight. Never replace that newer result.
    const check = (force = false, manual = false) => {
      if (disposed) return Promise.resolve(null);
      if (pending) return force && !pendingForce ? pending.then(() => check(true, manual)) : pending;
      const requestRevision = revision;
      pendingForce = force;
      lastRequest = Date.now();
      if (manual) update({ checking: true, error: '' });
      pending = (async () => {
        try {
          const data = force
            ? await api.post(REFRESH_PATH, {}, { silent: true, signal: controller.signal })
            : await api.get(SUMMARY_PATH, { silent: true, signal: controller.signal, cacheScope: `subscription:${userId}` });
          if (disposed || requestRevision !== revision) return null;
          if (!accept(data)) throw new Error('The access status could not be verified. Please try again.');
          if (manual && data.platformReachable === false) update({ error: 'The platform is currently unreachable. Showing the last verified access; please check again shortly.' });
          return current;
        } catch (error) {
          // A connection/configuration failure is not proof of expiry. Keep
          // the last verified status without fabricating or clearing access.
          if (manual && !disposed && requestRevision === revision) update({ error: error.message || 'Unable to verify renewal. Please try again.' });
          return null;
        } finally {
          pending = null;
          pendingForce = false;
          update({ checking: false }); schedule();
        }
      })();
      return pending;
    };
    refreshRef.current = () => check(true, true);
    const onStatus = (event) => {
      if (event.detail?.userId !== userId) return;
      if (current?.installationId && event.detail?.data?.installationId !== current.installationId) return;
      revision += 1; accept(event.detail.data);
    };
    const onWake = () => {
      if (visible() && current?.managed !== false && Date.now() - lastRequest >= 30000) check(isRestrictedSubscription(current?.status));
    };
    const onRequired = (event) => {
      if (event.detail?.userId === userId && Date.now() - lastRestrictionCheck >= 10000) {
        lastRestrictionCheck = Date.now(); check(true);
      }
    };
    window.addEventListener(SUBSCRIPTION_STATUS_EVENT, onStatus);
    window.addEventListener(SUBSCRIPTION_REQUIRED_EVENT, onRequired);
    window.addEventListener('focus', onWake);
    document.addEventListener('visibilitychange', onWake);
    check();
    return () => {
      disposed = true; controller.abort(); clearTimeout(pollTimer); clearTimeout(expiryTimer);
      refreshRef.current = null;
      window.removeEventListener(SUBSCRIPTION_STATUS_EVENT, onStatus);
      window.removeEventListener(SUBSCRIPTION_REQUIRED_EVENT, onRequired);
      window.removeEventListener('focus', onWake);
      document.removeEventListener('visibilitychange', onWake);
    };
  }, [enabled, userId]);

  return {
    data: enabled && state.userId === userId ? state.data : null,
    checking: enabled && state.userId === userId && state.checking,
    error: enabled && state.userId === userId ? state.error : '',
    refresh: () => refreshRef.current?.(),
    userId,
  };
}
