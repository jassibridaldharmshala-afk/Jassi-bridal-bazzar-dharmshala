import { useEffect, useId, useRef, useState } from 'react';

export default function ConfirmModal({ open, title, message, confirmLabel = 'Confirm', onConfirm, onClose, children }) {
  const titleId = useId();
  const pending = useRef(false);
  const revision = useRef(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    revision.current += 1; pending.current = false; setBusy(false); setError('');
    return () => { revision.current += 1; };
  }, [open, title, message]);
  const confirm = async () => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    const current = revision.current;
    try { await onConfirm?.(); }
    catch (failure) { if (current === revision.current) setError(failure.message || 'Unable to complete this action. Please try again.'); }
    finally { if (current === revision.current) { pending.current = false; setBusy(false); } }
  };
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/40 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} aria-busy={busy} className="admin-card w-full max-w-md p-6">
        <h2 id={titleId}>{title}</h2>
        <p className="admin-note">{message}</p>
        {children ? <div className="mt-4">{children}</div> : null}
        {error && <p role="alert" className="mt-3 text-sm font-semibold text-rose">{error}</p>}
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" disabled={busy} onClick={onClose} className="admin-btn-ghost disabled:opacity-50">Cancel</button>
          <button type="button" disabled={busy} onClick={confirm} className="admin-btn disabled:opacity-50">{busy ? 'Working...' : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
