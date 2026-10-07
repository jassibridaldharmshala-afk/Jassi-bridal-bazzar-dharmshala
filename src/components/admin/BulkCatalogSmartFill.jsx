import { useEffect, useRef, useState } from 'react';
import { Sparkles, Save, X } from 'lucide-react';
import api from '../../services/api';
import { SmartFillReview } from './WorkflowSmartFill';
import { applySmartReview, reviewSmartSuggestions, smartEndpoint } from '../../utils/workflowSmartFill';
import './WorkflowSmartFill.css';
import useUnsavedChanges from '../../hooks/useUnsavedChanges';

export default function BulkCatalogSmartFill({ ids, apiBase, disabled = false, onSaved, onClose, onBusyChange }) {
  const [records, setRecords] = useState([]), [busy, setBusy] = useState(''), [error, setError] = useState('');
  const active = useRef(null), generation = useRef(0), stateRef = useRef(records); stateRef.current = records;
  const selection = ids.join(',');
  const dirty = records.some(record => record.staged && !record.saved);
  useUnsavedChanges(dirty, !!busy);
  useEffect(() => { generation.current += 1; setBusy(''); setRecords([]); setError(''); return () => { generation.current += 1; active.current?.abort(); }; }, [selection, apiBase]);
  useEffect(() => { onBusyChange?.(!!busy); return () => onBusyChange?.(false); }, [busy, onBusyChange]);
  const preview = async () => {
    if (busy || disabled) return;
    if (dirty && !window.confirm('Discard the staged changes and prepare new previews?')) return;
    const controller = new AbortController(); active.current = controller;
    const version = generation.current; setBusy('preview'); setError('');
    try {
      const data = await api.post(smartEndpoint(apiBase, 'catalog/preview'), { workflow: 'catalog', context: { productIds: ids } }, { silent: true, signal: controller.signal });
      if (version !== generation.current || controller.signal.aborted) return;
      if (!Array.isArray(data.records) || data.records.length !== ids.length || new Set(data.records.map(record => record.id)).size !== ids.length || data.records.some(record => !ids.includes(record.id) || !record.current || typeof record.current !== 'object' || !Number.isFinite(Date.parse(record.updatedAt)))) throw new Error('The selected catalog preview is incomplete. Nothing was changed.');
      setRecords(data.records.map(record => ({ ...record, rows: reviewSmartSuggestions(record, record.current, 'catalog'), draft: record.current, changes: {}, staged: false, saved: false, error: '' })));
    } catch (failure) { if (version === generation.current && !controller.signal.aborted) setError(failure.message); }
    finally { if (version === generation.current) setBusy(''); if (active.current === controller) active.current = null; }
  };
  const save = async () => {
    if (busy || disabled) return;
    const version = generation.current; setBusy('save'); setError('');
    let count = 0;
    for (const record of stateRef.current.filter(row => row.staged && !row.saved && !row.error)) {
      if (version !== generation.current) break;
      try {
        await api.post(smartEndpoint(apiBase, 'catalog/save'), { id: record.id, expectedUpdatedAt: record.updatedAt, changes: record.changes }, { silent: true });
        count += 1;
        if (version === generation.current) setRecords(current => current.map(row => row.id === record.id ? { ...row, saved: true } : row));
      } catch (failure) {
        if (version === generation.current) setRecords(current => current.map(row => row.id === record.id ? { ...row, error: `${failure.message} Refresh the catalog and prepare a new preview before retrying.` } : row));
      }
    }
    if (version === generation.current) { setBusy(''); if (count) onSaved?.(count); }
  };
  const prepared = records.filter(record => record.staged && !record.saved && !record.error).length;
  return <section className="workflow-smart workflow-smart-bulk" aria-label="Bulk catalog Smart Fill">
    <div className="workflow-smart__body"><header className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold">Bulk catalog Smart Fill</h2><p>Review up to 20 selected products. Only descriptions, tags and SEO can be saved here.</p></div><button type="button" className="admin-btn-ghost" disabled={!!busy} onClick={() => { if (!dirty || window.confirm('Discard the staged catalog changes?')) onClose(); }}><X size={15} />Close</button></header>
      <p>Price, stock, variants, publication and category structure are protected. Suggested category matches are reviewed in the individual product editor. Partial save results are shown per product; changed revisions are never overwritten.</p>
      <button type="button" className="admin-btn" disabled={disabled || !!busy || !ids.length || ids.length > 20} onClick={preview}><Sparkles size={15} />{busy === 'preview' ? 'Preparing previews…' : `Prepare ${ids.length} product previews`}</button>
      {ids.length > 20 && <p role="alert" className="workflow-smart__warning">Select no more than 20 products per batch.</p>}{error && <p role="alert" className="workflow-smart__warning">{error}</p>}
      {records.map(record => <article key={record.id} className="workflow-smart-bulk__record"><h3>{record.name}</h3>{record.warnings?.map((warning, index) => <p key={index} className="text-sm text-theme-muted">{warning}</p>)}
        {record.saved ? <p role="status" className="workflow-smart__notice">Reviewed content saved.</p> : record.staged ? <div><p role="status">{Object.keys(record.changes).length} fields staged. Not saved yet.</p><button type="button" className="admin-btn-ghost mt-3" disabled={!!busy} onClick={() => setRecords(current => current.map(row => row.id === record.id ? { ...row, staged: false, draft: row.current, changes: {} } : row))}>Discard this product's staged changes</button></div> : record.rows.length ? <SmartFillReview rows={record.rows} form={record.draft} disabled={!!busy || disabled} onApply={(rows, replace) => {
          const result = applySmartReview(record.draft, rows, rows.map(row => row.path), replace);
          if (result.applied.length) setRecords(current => current.map(row => row.id === record.id ? { ...row, staged: true, draft: result.form, changes: Object.fromEntries(result.applied.map(item => [item.path, item.value])) } : row));
        }} /> : <p>No safe listing-content suggestions for this product.</p>}
        {record.error && <p role="alert" className="workflow-smart__warning">{record.error}</p>}
      </article>)}
      <div className="workflow-smart-bulk__save"><button type="button" className="admin-btn" disabled={disabled || !!busy || !prepared} onClick={save}><Save size={15} />{busy === 'save' ? 'Saving reviewed content…' : `Save ${prepared} reviewed products`}</button><span className="text-sm text-theme-muted">No product is saved until you explicitly choose this action.</span></div>
    </div>
  </section>;
}
