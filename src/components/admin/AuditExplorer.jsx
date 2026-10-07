import { useEffect, useRef, useState } from 'react';
import { Download, RefreshCw, Search, ShieldCheck, Trash2, X } from 'lucide-react';
import api from '../../services/api';
import DataTable from './DataTable';
import PageHeader from './PageHeader';
import './AdminShell.css';
import './AuditExplorer.css';

const EMPTY = { q: '', action: '', entityType: '', outcome: '', source: '', from: '', to: '' };
const OUTCOMES = { SUCCESS: 'Success', REJECTED: 'Rejected', FAILED: 'Failed', LEGACY: 'Recorded (legacy)' };
const SOURCES = { ADMIN: 'Admin', SELLER: 'Seller', CUSTOMER: 'Customer', WEBHOOK: 'Payment gateway', SYSTEM: 'System', LEGACY: 'Not recorded' };
const formatDate = (value) => value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleString('en-IN') : 'Not recorded';
const label = (value) => String(value || '').replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().replace(/^./, (c) => c.toUpperCase());
const displayValue = (value) => value === undefined ? 'Not recorded' : typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
const csvCell = (value) => {
  const text = String(value ?? '');
  return '"' + (/^[\s]*[=+@-]/.test(text) ? "'" + text : text).replace(/"/g, '""') + '"';
};

export function exportAuditPage(items) {
  const rows = [
    ['Event ID', 'Time (UTC)', 'Action', 'Outcome', 'Entity', 'Reference', 'Actor', 'Role', 'Source', 'Request ID'],
    ...items.map((item) => [item._id, item.createdAt, item.action, item.outcome, item.entityType, item.entityId, item.actor?.name, item.actor?.role, item.source, item.requestId]),
  ];
  return '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

function FilterSelect({ title, name, value, onChange, options }) {
  return <label>{title}<select name={name} value={value} onChange={onChange}><option value="">All {title.toLowerCase()}</option>
    {options.map(([key, text]) => <option value={key} key={key}>{text}</option>)}
  </select></label>;
}

function AuditDialog({ confirming, busy, onClose, returnFocus, fallbackFocus, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current;
    const target = returnFocus.current;
    const fallback = fallbackFocus.current;
    const overflow = document.body.style.overflow;
    node.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      node.close();
      document.body.style.overflow = overflow;
      (target?.isConnected && !target.disabled ? target : fallback)?.focus();
    };
  }, [returnFocus, fallbackFocus]);
  useEffect(() => {
    ref.current?.querySelector('[data-initial-focus]')?.focus();
  }, [confirming]);
  const dismiss = (event) => { event.preventDefault(); if (!busy) onClose(); };
  return <dialog ref={ref} className={'admin-card audit-dialog' + (confirming ? ' audit-dialog--confirm' : '')}
    role={confirming ? 'alertdialog' : 'dialog'} aria-modal="true" aria-label={confirming ? 'Delete audit event' : 'Event details'}
    aria-describedby={confirming ? 'audit-delete-description' : undefined} aria-busy={busy}
    onCancel={dismiss} onKeyDown={(event) => { if (event.key === 'Escape') dismiss(event); }}>
    {children}
  </dialog>;
}

export default function AuditExplorer({ endpoint = '/admin/audit-logs', seller = false }) {
  const [draft, setDraft] = useState(EMPTY);
  const [query, setQuery] = useState({ filters: EMPTY, page: 1, limit: 25, asOf: '', revision: 0 });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [validation, setValidation] = useState('');
  const [options, setOptions] = useState({ actions: [], entityTypes: [] });
  const [optionsError, setOptionsError] = useState('');
  const [selection, setSelection] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState('');
  const [detailRetry, setDetailRetry] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [notice, setNotice] = useState('');
  const pendingDelete = useRef(null);
  const explorer = useRef(null);
  const returnFocus = useRef(null);

  useEffect(() => {
    setDeleting(false); setConfirmDelete(false); setDeleteError(''); setNotice('');
    return () => { pendingDelete.current = null; };
  }, [endpoint]);

  useEffect(() => {
    let active = true;
    api.get(endpoint + '/options').then((data) => {
      if (!Array.isArray(data?.actions) || !Array.isArray(data?.entityTypes)) throw new Error('Invalid filter options');
      if (active) { setOptions(data); setOptionsError(''); }
    })
      .catch(() => { if (active) setOptionsError('Action and entity choices could not load. Search and other filters still work. Refresh to retry.'); });
    return () => { active = false; };
  }, [endpoint, query.revision]);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setSelection(null);
    const params = new URLSearchParams({ page: String(query.page), limit: String(query.limit) });
    if (query.asOf) params.set('asOf', query.asOf);
    Object.entries(query.filters).forEach(([key, value]) => {
      if (!value) return;
      if (key === 'from' || key === 'to') {
        // Local calendar days, converted to UTC for the server.
        const date = new Date(value + (key === 'from' ? 'T00:00:00' : 'T23:59:59.999'));
        params.set(key, date.toISOString());
      } else params.set(key, value);
    });
    api.get(endpoint + '?' + params).then((data) => {
      if (!active) return;
      if (!Array.isArray(data?.items) || !Number.isFinite(data.total)) throw new Error('Audit history response is incomplete. Please refresh.');
      const lastPage = Math.max(1, Math.ceil(data.total / query.limit));
      if (query.page > lastPage) {
        setQuery((value) => ({ ...value, page: lastPage, asOf: data.asOf }));
        return;
      }
      setResult(data);
    }).catch((err) => { if (active) setError(err.message || 'Audit history could not be loaded.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [endpoint, query]);

  useEffect(() => {
    if (!selection) return undefined;
    let active = true;
    setDetail(null); setDetailError('');
    api.get(endpoint + '/' + encodeURIComponent(selection)).then((data) => {
      if (!active) return;
      if (data?._id !== selection) throw new Error('The server did not return the selected event. Please retry.');
      setDetail(data);
    })
      .catch((err) => { if (active) setDetailError(err.message || 'Event details could not be loaded.'); });
    return () => { active = false; };
  }, [endpoint, selection, detailRetry]);

  const refresh = () => setQuery((value) => ({ ...value, page: 1, asOf: '', revision: value.revision + 1 }));
  const change = (event) => setDraft((value) => ({ ...value, [event.target.name]: event.target.value }));
  const apply = (event) => {
    event.preventDefault();
    if (draft.from && draft.to && draft.from > draft.to) { setValidation('Start date must be on or before end date.'); return; }
    setValidation('');
    setQuery((value) => ({ ...value, filters: { ...draft }, page: 1, asOf: '' }));
  };
  const clear = () => { setDraft(EMPTY); setValidation(''); setQuery((value) => ({ ...value, filters: EMPTY, page: 1, asOf: '' })); };
  const close = () => {
    if (pendingDelete.current) return;
    if (confirmDelete) { setConfirmDelete(false); setDeleteError(''); return; }
    setSelection(null); setDetail(null);
  };
  const remove = async () => {
    if (pendingDelete.current || !confirmDelete || seller || !detail?.canDelete || detail._id !== selection) return;
    const request = { id: selection };
    pendingDelete.current = request;
    setDeleting(true); setDeleteError('');
    let message = 'Audit event deleted.';
    try {
      const response = await api.delete(endpoint + '/' + encodeURIComponent(request.id));
      if (response?.success !== true || response.id !== request.id) throw new Error('The server did not confirm deletion. Please refresh the history and try again.');
    } catch (err) {
      if (pendingDelete.current !== request) return;
      if (err.status === 404 && err.code === 'AUDIT_EVENT_NOT_FOUND') message = 'This audit event is no longer available. History refreshed.';
      else {
        pendingDelete.current = null;
        setDeleting(false); setDeleteError(err.status === 404
          ? 'Deletion is unavailable on the connected server. Update and restart the backend, then try again.'
          : err.message || 'Event could not be deleted. Please try again.');
        return;
      }
    }
    if (pendingDelete.current !== request) return;
    pendingDelete.current = null;
    setDeleting(false); setConfirmDelete(false); setSelection(null); setDetail(null); setNotice(message);
    // Drop the deleted row even if the subsequent refresh fails. Keep filters
    // and the current snapshot, moving back when the final row was removed.
    setResult((value) => value ? { ...value, items: value.items.filter((item) => item._id !== request.id), total: Math.max(0, value.total - 1) } : value);
    setQuery((value) => ({ ...value, page: result?.items.length === 1 ? Math.max(1, value.page - 1) : value.page,
      asOf: result?.asOf || value.asOf, revision: value.revision + 1 }));
  };
  const exportPage = () => {
    const url = URL.createObjectURL(new Blob([exportAuditPage(result.items)], { type: 'text/csv;charset=utf-8;' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'audit-history-page-' + result.page + '.csv';
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const actions = <><button type="button" className="admin-btn-ghost" onClick={refresh} disabled={loading}><RefreshCw size={16} /> Refresh</button>
    <button type="button" className="admin-btn-ghost" disabled={loading || !!error || !result?.items?.length} onClick={exportPage}><Download size={16} /> Export this page</button></>;
  return <section ref={explorer} tabIndex={-1} className={'audit-explorer' + (seller ? ' admin-shell audit-explorer--seller' : '')} aria-label="Audit history">
    {seller ? <header className="admin-card audit-heading"><div><h1>Audit history</h1><p>Activity recorded for your store.</p></div><div className="audit-actions">{actions}</div></header>
      : <PageHeader title="Audit history" note="Trace who did what, when it happened, and which record was affected.">{actions}</PageHeader>}
    <div className="audit-notice"><ShieldCheck size={20} aria-hidden="true" /><p>Recorded system history. Changes and request activity are labelled separately. Older events may have limited details; missing history is not recreated.</p></div>
    {notice && <p className="audit-success" role="status">{notice}</p>}
    <form className="admin-card audit-filters" onSubmit={apply}>
      <label className="audit-search">Search activity<input name="q" value={draft.q} maxLength={100} onChange={change} placeholder="Action, recorded actor, record or request ID" /></label>
      <FilterSelect title="Actions" name="action" value={draft.action} onChange={change} options={options.actions.map((value) => [value, label(value)])} />
      <FilterSelect title="Entities" name="entityType" value={draft.entityType} onChange={change} options={options.entityTypes.map((value) => [value, label(value)])} />
      <FilterSelect title="Outcomes" name="outcome" value={draft.outcome} onChange={change} options={Object.entries(OUTCOMES)} />
      <FilterSelect title="Sources" name="source" value={draft.source} onChange={change} options={Object.entries(SOURCES)} />
      <label>From date<input type="date" name="from" value={draft.from} onChange={change} /></label>
      <label>To date<input type="date" name="to" value={draft.to} onChange={change} /></label>
      <div className="audit-actions"><button className="admin-btn" type="submit"><Search size={16} /> Apply filters</button><button type="button" className="admin-btn-ghost" onClick={clear}>Clear filters</button></div>
      {validation && <p className="audit-feedback" role="alert">{validation}</p>}
      {optionsError && <p className="audit-feedback" role="status">{optionsError}</p>}
    </form>
    {selection && <AuditDialog confirming={confirmDelete} busy={deleting} onClose={close} returnFocus={returnFocus} fallbackFocus={explorer}>
      <header className="audit-heading audit-dialog__header"><div><p className="admin-kicker">Audit history</p><h2>{confirmDelete ? 'Delete audit event?' : detail ? label(detail.action) : 'Event details'}</h2></div><button type="button" className="admin-btn-ghost" disabled={deleting} onClick={close} data-initial-focus={confirmDelete ? undefined : true}><X size={16} /><span>{confirmDelete ? 'Close confirmation' : 'Close details'}</span></button></header>
      {confirmDelete ? <>
        <div className="audit-detail audit-delete-confirmation">
          <div className="audit-delete-icon"><Trash2 size={24} aria-hidden="true" /></div>
          <p id="audit-delete-description">This permanently deletes the selected audit event. This cannot be undone. The related order, product or account will stay unchanged.</p>
          <dl className="audit-delete-summary"><div><dt>Activity</dt><dd>{label(detail.action)}</dd></div><div><dt>Event ID</dt><dd>{detail._id}</dd></div><div><dt>Recorded</dt><dd>{formatDate(detail.createdAt)}</dd></div></dl>
          <p className="admin-note">A separate activity entry records who deleted this event.</p>
          {deleteError && <p className="audit-feedback" role="alert">{deleteError}</p>}
          {deleting && <p role="status">Deleting audit event…</p>}
        </div>
        <footer className="audit-dialog__footer"><button type="button" className="admin-btn-ghost" disabled={deleting} onClick={close} data-initial-focus>Cancel deletion</button><button type="button" className="admin-btn audit-delete-button" disabled={deleting} onClick={remove}><Trash2 size={16} />{deleting ? 'Deleting…' : 'Delete permanently'}</button></footer>
      </> : <><div className="audit-detail">
      {detailError ? <div role="alert"><p>{detailError}</p><button className="admin-btn-ghost" onClick={() => setDetailRetry((value) => value + 1)}>Retry details</button></div> : !detail ? <p role="status">Loading event details…</p> : <>
        <dl className="audit-metadata">
          {[['Event ID', detail._id], ['Time', formatDate(detail.createdAt)], ['Actor', detail.actor?.name], ['Role at time', detail.actor?.role || 'Not recorded'], ['Outcome', OUTCOMES[detail.outcome] || 'Unknown'], ['Source', SOURCES[detail.source] || 'Unknown'], ['Entity', detail.entityType], ['Reference', detail.entityId || 'Not recorded'], ['Request ID', detail.requestId || 'Not recorded']].map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}
        </dl>
        {detail.summary && <p>{detail.summary}</p>}
        {detail.http && <p className="audit-request">{detail.http.method} {detail.http.route} · HTTP {detail.http.statusCode}<br />Request result only; this event does not assert a data change.</p>}
        <h3>Recorded changes</h3><p className="admin-note">Sensitive values are redacted. Large values are abbreviated. “Not recorded” does not mean empty.</p>
        {detail.changedFields?.length ? <div className="audit-changes">{detail.changedFields.map((field) => <article key={field}><h4>{label(field)}</h4><div><section><span>Before</span><pre>{displayValue(detail.before?.[field])}</pre></section><section><span>After</span><pre>{displayValue(detail.after?.[field])}</pre></section></div></article>)}</div>
          : <p className="audit-notice">No before/after differences were recorded for this event.</p>}
      </>}
      </div>
      {!seller && detail?.canDelete && <footer className="audit-dialog__footer"><p className="admin-note">Manage this audit event</p><button type="button" className="admin-btn-ghost audit-delete-button" onClick={() => { setDeleteError(''); setConfirmDelete(true); }}><Trash2 size={16} /> Delete event</button></footer>}
      </>}
    </AuditDialog>}
    {result?.recordingWarning && <p className="audit-warning" role="alert">{result.recordingWarning}</p>}
    {error ? <div className="admin-card audit-error" role="alert"><h2>History could not be loaded</h2><p>{error}</p><button type="button" className="admin-btn" onClick={refresh}>Try again</button></div>
      : <div aria-busy={loading}>
        <DataTable loading={loading} title="Recorded activity"
          note={result ? result.total.toLocaleString('en-IN') + ' matching events · Snapshot ' + formatDate(result.asOf) : ''}
          emptyTitle={Object.values(query.filters).some(Boolean) ? 'No matching activity' : 'No audit events yet'}
          emptyNote="New recorded activity will appear here. Use Refresh to check for updates."
          heads={['Activity', 'Entity / reference', 'Actor', 'Outcome', 'Time', 'Details']}
          rows={(result?.items || []).map((item) => <tr key={item._id}>
            <td><div><strong>{item.summary || label(item.action)}</strong><small>{SOURCES[item.source] || 'Unknown source'}{item.action === 'ADMIN_REQUEST' ? ' · Request activity' : ''}</small></div></td>
            <td><div>{label(item.entityType)}<small className="audit-reference">{item.entityId || 'No reference recorded'}</small></div></td>
            <td><div>{item.actor?.name || 'Actor unavailable'}<small>{item.actor?.role || 'Role not recorded'}</small></div></td>
            <td><span className={'audit-outcome audit-outcome--' + String(item.outcome).toLowerCase()}>{OUTCOMES[item.outcome] || 'Unknown'}</span></td>
            <td><time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time></td>
            <td><button type="button" className="admin-btn-ghost" aria-label={'View details for ' + item._id} aria-haspopup="dialog" aria-expanded={selection === item._id} onClick={(event) => { returnFocus.current = event.currentTarget; setDetail(null); setDetailError(''); setConfirmDelete(false); setDeleteError(''); setNotice(''); setSelection(item._id); }}>View details</button></td>
          </tr>)} />
      </div>}
    <nav className="admin-card audit-pagination" aria-label="Audit pagination">
      <label>Events per page<select value={query.limit} onChange={(event) => setQuery((value) => ({ ...value, limit: Number(event.target.value), page: 1, asOf: result?.asOf || '' }))}><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select></label>
      <p role="status">{loading ? 'Loading history…' : error ? 'History unavailable' : 'Page ' + (result?.page || 1) + ' of ' + (result?.totalPages || 1)}</p>
      <div className="audit-actions"><button type="button" className="admin-btn-ghost" disabled={loading || !!error || query.page <= 1} onClick={() => setQuery((value) => ({ ...value, page: value.page - 1, asOf: result.asOf }))}>Previous</button>
        <button type="button" className="admin-btn-ghost" disabled={loading || !!error || !result || query.page >= result.totalPages || query.page >= 10000} onClick={() => setQuery((value) => ({ ...value, page: value.page + 1, asOf: result.asOf }))}>Next</button></div>
    </nav>
    <p className="audit-footnote">Times use your device timezone. Export includes only the displayed page, not the full history. Use a narrower date range for large histories.</p>
  </section>;
}
