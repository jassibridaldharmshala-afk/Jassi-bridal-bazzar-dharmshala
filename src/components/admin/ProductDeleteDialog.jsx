import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, Archive, RefreshCw, ShieldCheck, Trash2, X } from 'lucide-react';
import api from '../../services/api';
import { TextInput } from '../ui/Field';
import './ProductDeleteDialog.css';

export default function ProductDeleteDialog({ product, productsPath, onClose, onDeleted, onArchived }) {
  const titleId = useId();
  const dialogRef = useRef(null);
  const revision = useRef(0);
  const pending = useRef(false);
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const close = useCallback(() => { if (!pending.current) onClose(); }, [onClose]);
  const refresh = useCallback(async () => {
    const current = ++revision.current;
    setLoading(true); setReview(null); setError(''); setConfirmation(''); setAcknowledged(false);
    try {
      const result = await api.get(`${productsPath}/${product._id}/deletion-preview`, { silent: true });
      if (current === revision.current) setReview(result);
    } catch (failure) { if (current === revision.current) setError(failure.message || 'Deletion review could not be loaded.'); }
    finally { if (current === revision.current) setLoading(false); }
  }, [product._id, productsPath]);
  useEffect(() => { refresh(); return () => { revision.current += 1; }; }, [refresh]);
  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    const keydown = event => {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (event.key !== 'Tab') return;
      const nodes = [...dialogRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), a[href]')];
      if (!nodes.length) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === nodes[0] || document.activeElement === dialogRef.current)) { event.preventDefault(); nodes[nodes.length - 1].focus(); }
      else if (!event.shiftKey && (document.activeElement === nodes[nodes.length - 1] || document.activeElement === dialogRef.current)) { event.preventDefault(); nodes[0].focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', keydown); previousFocus?.focus?.(); };
  }, [close]);
  const run = async action => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try { await action(); }
    catch (failure) {
      if (failure.status === 409) {
        await refresh();
        setError(`${failure.message} Review the latest checks below.`);
      } else setError(failure.message || 'Unable to complete this action.');
    } finally { pending.current = false; setBusy(false); }
  };
  const archive = () => run(async () => {
    await api.delete(`${productsPath}/${product._id}`);
    onArchived?.();
    await refresh();
  });
  const remove = () => {
    if (!review?.eligible || confirmation.trim() !== review.confirmation || !acknowledged) return;
    run(async () => {
      await api.delete(`${productsPath}/${product._id}/permanent`, { confirm: confirmation.trim(), version: review.version });
      onDeleted(product._id);
    });
  };
  return <div className="product-delete-overlay">
    <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-busy={busy || loading} className="product-delete-dialog">
      <header><span className="product-delete-icon"><Trash2 size={21} /></span><div><p>CATALOG SAFETY</p><h2 id={titleId}>Delete product permanently?</h2></div><button type="button" disabled={busy} onClick={close} aria-label="Close deletion review"><X size={20} /></button></header>
      <div className="product-delete-body">
        <strong className="product-delete-name">{review?.name || product.name}</strong>
        <p>Permanent deletion cannot be undone. Archive keeps the product restorable and preserves its history.</p>
        {loading ? <p role="status">Checking product dependencies…</p> : review && <>
          {!!review.blockers?.length && <div className="product-delete-notice" role="status"><strong><ShieldCheck size={18} />Deletion is protected</strong><p>Keep this product archived. Its linked records must remain intact.</p><ul>{review.blockers.map(item => <li key={item.key}>{item.label} <span>({item.count})</span></li>)}</ul></div>}
          {!review.transactions && <div className="product-delete-notice"><strong>Safe deletion is unavailable</strong><p>A transaction-capable MongoDB deployment is required. You can still archive this product.</p></div>}
          {!review.archived && <div className="product-delete-notice"><strong><Archive size={18} />Archive first</strong><p>Remove it from the live catalog before reviewing permanent deletion.</p></div>}
          {review.eligible && <>
            <div className="product-delete-notice is-warning"><strong><AlertTriangle size={18} />What will change</strong><p>The listing and its {review.stock} available unit{review.stock === 1 ? '' : 's'} will leave the catalog.</p><p>Removed from {review.cleanup?.carts || 0} cart{review.cleanup?.carts === 1 ? '' : 's'}, {review.cleanup?.wishlists || 0} wishlist{review.cleanup?.wishlists === 1 ? '' : 's'} and related-product selections. Inventory opening records and the audit trail are retained.</p><p>{review.mediaPolicy}</p></div>
            <label className="product-delete-confirmation">Type <strong>{review.confirmation}</strong> to confirm<TextInput value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="off" disabled={busy} /></label>
            <label className="product-delete-ack"><input type="checkbox" checked={acknowledged} disabled={busy} onChange={event => setAcknowledged(event.target.checked)} /><span>I understand this removes the listing permanently, including any remaining catalog stock.</span></label>
          </>}
        </>}
        {error && <p role="alert" className="product-delete-error">{error}</p>}
      </div>
      <footer><button type="button" className="admin-btn-ghost" disabled={busy} onClick={close}>Cancel</button>
        {!loading && !review && <button type="button" className="admin-btn-ghost" onClick={refresh}><RefreshCw size={16} />Retry checks</button>}
        {!loading && review && !review.archived && <button type="button" className="admin-btn" disabled={busy} onClick={archive}><Archive size={16} />{busy ? 'Archiving…' : 'Archive product'}</button>}
        {review?.eligible && <button type="button" className="product-delete-danger" disabled={busy || loading || confirmation.trim() !== review.confirmation || !acknowledged} onClick={remove}><Trash2 size={16} />{busy ? 'Deleting…' : 'Delete permanently'}</button>}
      </footer>
    </section>
  </div>;
}
