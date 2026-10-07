import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarClock, ChevronRight, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useAppPath from '../../hooks/useAppPath';
import useClientSubscription from '../../hooks/useClientSubscription';
import { subscriptionNoticeCopy, subscriptionNoticeKey } from '../../utils/subscriptionNotice';
import './ClientSubscriptionNotice.css';

const BILLING_PATH = '/admin/system';
const storageKey = (userId) => `samira_subscription_notice:${userId}`;
function acknowledged(userId, key) {
  try { return sessionStorage.getItem(storageKey(userId)) === key; } catch { return false; }
}

export default function ClientSubscriptionNotice() {
  const { user } = useAuth();
  const path = useAppPath();
  const { data, checking, error, refresh, userId } = useClientSubscription(user);
  const key = subscriptionNoticeKey(data);
  const [dismissed, setDismissed] = useState('');
  const [requested, setRequested] = useState('');
  const sessionKey = `${userId}:${key}`;
  const onBillingPage = path === BILLING_PATH || path.startsWith(`${BILLING_PATH}/`);
  const open = Boolean(key && (requested === sessionKey || (!onBillingPage && dismissed !== sessionKey && !acknowledged(userId, key))));
  const dismiss = useCallback(() => {
    setDismissed(sessionKey); setRequested('');
    try { sessionStorage.setItem(storageKey(userId), key); } catch { /* Session storage is optional. */ }
  }, [key, sessionKey, userId]);

  useEffect(() => {
    if (data?.managed && !key) {
      setDismissed(''); setRequested('');
      try { sessionStorage.removeItem(storageKey(userId)); } catch { /* Session storage is optional. */ }
    }
  }, [data?.managed, key, userId]);

  if (!key) return null;
  const copy = subscriptionNoticeCopy(data);
  return <>
    <section className="client-access-banner" aria-label="Subscription access notice">
      <CalendarClock size={22} aria-hidden="true" className="client-access-banner__icon" />
      <div className="client-access-banner__content"><strong>{copy.title}</strong><p>New orders and restricted changes are paused. Contact the platform owner to restore access.</p>{error && !open && <p role="alert">{error}</p>}</div>
      <div className="client-access-banner__actions">
        <button type="button" className="client-access-button client-access-button--quiet" onClick={() => setRequested(sessionKey)}>View details</button>
        <a href={BILLING_PATH} className="client-access-button" onClick={dismiss}>{copy.action}<ChevronRight size={15} aria-hidden="true" /></a>
      </div>
    </section>
    {open && createPortal(<ExpiryDialog data={data} copy={copy} checking={checking} error={error} onRefresh={refresh} onDismiss={dismiss} />, document.body)}
  </>;
}

function ExpiryDialog({ data, copy, checking, error, onRefresh, onDismiss }) {
  const titleId = useId();
  const descriptionId = useId();
  const dialog = useRef(null);
  const primary = useRef(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    // A class-based lock cannot overwrite a sidebar/other modal's inline
    // lock when this admin layout is unmounted during a mode change.
    document.body.classList.add('client-access-dialog-open');
    primary.current?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onDismiss(); return; }
      if (event.key !== 'Tab') return;
      const items = Array.from(dialog.current?.querySelectorAll('a[href], button:not([disabled]), [tabindex="0"]') || []);
      const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.current?.contains(document.activeElement))) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.current?.contains(document.activeElement))) {
        event.preventDefault(); first?.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.classList.remove('client-access-dialog-open');
      if (previousFocus?.isConnected) previousFocus.focus?.();
    };
  }, [onDismiss]);
  const end = Date.parse(data.endsAt);
  const date = Number.isFinite(end) ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(end) : null;
  return <div className="client-access-overlay">
    <section ref={dialog} className="client-access-dialog" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}>
      <button type="button" className="client-access-dialog__close" aria-label="Dismiss subscription notice" onClick={onDismiss}><X size={20} aria-hidden="true" /></button>
      <span className="client-access-dialog__icon"><CalendarClock size={30} strokeWidth={1.7} aria-hidden="true" /></span>
      <p className="client-access-dialog__eyebrow">{data.companyName || 'Your store'} · Access notice</p>
      <h2 id={titleId}>{copy.title}</h2>
      <p id={descriptionId} className="client-access-dialog__description">{copy.description}</p>
      <dl className="client-access-dialog__period"><div><dt>Access period</dt><dd>{copy.period}</dd></div><div><dt>{data.status === 'EXPIRED' ? 'Expired on' : 'Scheduled end'}</dt><dd>{date || 'Contact the platform owner'}</dd></div></dl>
      {data.renewalMessage && <div className="client-access-dialog__message"><strong>Message from the platform owner</strong><p>{data.renewalMessage}</p></div>}
      <div className="client-access-dialog__safety"><ShieldCheck size={19} aria-hidden="true" /><p>Your saved catalogue and order history remain available. New orders and restricted changes pause until access is restored.</p></div>
      {data.platformReachable === false && <p className="client-access-dialog__connection">Showing the last verified access. The platform connection is temporarily unavailable.</p>}
      {error && <p role="alert" className="client-access-dialog__error">{error}</p>}
      <div className="client-access-dialog__actions"><a ref={primary} href={BILLING_PATH} onClick={onDismiss} className="client-access-button">{copy.action}<ChevronRight size={17} aria-hidden="true" /></a><button type="button" disabled={checking} className="client-access-button client-access-button--quiet" onClick={onRefresh}><RefreshCw size={16} aria-hidden="true" className={checking ? 'client-access-spinning' : ''} />{checking ? 'Checking access…' : 'Check renewal'}</button></div>
      <button type="button" className="client-access-dialog__continue" onClick={onDismiss}>Continue reviewing existing records</button>
      <p className="client-access-dialog__footnote">The platform owner can renew this installation from Master Control.</p>
    </section>
  </div>;
}
