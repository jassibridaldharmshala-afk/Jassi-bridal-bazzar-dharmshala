import { useEffect, useRef, useState } from 'react';
import { Loader2, Save, Sparkles, X } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import useAdminActivity from '../../hooks/useAdminActivity';
import { normalizeImageUrl } from '../../services/normalize';
import { uploadScope } from '../../services/uploadRetry';
import { applySmartPatch, displaySmartValue, fieldValue, sameValue, selectedSmartPatch, smartPhotos, smartRequest, snapshotForm, suggestionRows } from '../../utils/productSmartFill';
import './ProductSmartFill.css';
import './DraftBatchSmartFill.css';

const draftId = draft => String(draft?._id || draft?.id || '');
const financial = key => ['sellingPrice', 'price', 'originalPrice'].includes(key) || key.startsWith('rentalPricing.');
const pending = record => ['queued', 'failed', 'paused'].includes(record.state);
const halt = error => [401, 403, 429, 'FETCH_ERROR', 'TIMEOUT_ERROR'].includes(error.status)
  || ['AI_QUOTA_EXCEEDED', 'AI_ACCESS_DENIED', 'SMART_FILL_UNAVAILABLE', 'DUPLICATE_REQUEST'].includes(error.code);
const batchScope = (prefix, auth) => `${prefix}:${uploadScope(auth)}:${new URLSearchParams(window.location.search).get('store') || ''}`;

function waitForNextRequest(milliseconds, signal) {
  if (signal.aborted) return Promise.resolve();
  return new Promise(resolve => {
    const finish = () => { window.clearTimeout(timer); signal.removeEventListener('abort', finish); resolve(); };
    const timer = window.setTimeout(finish, Math.max(0, milliseconds));
    signal.addEventListener('abort', finish, { once: true });
  });
}

export default function DraftBatchSmartFill({ drafts, categories, structure, apiPrefix, onSave, onSaved, onClose, onBusyChange }) {
  const auth = useAuth() || {};
  const authRef = useRef(auth); authRef.current = auth;
  const scope = batchScope(apiPrefix, auth);
  const initialScope = useRef(scope);
  const alive = useRef(true), operation = useRef(null);
  const lastAnalysisStart = useRef(0);
  const [records, setRecords] = useState(() => drafts.map(draft => ({ id: draftId(draft), baseline: snapshotForm(draft), notes: '', state: 'queued', rows: [], selected: [], replace: false, error: '', warnings: [] })));
  const [busy, setBusy] = useState(''), [notice, setNotice] = useState('');
  useAdminActivity(Boolean(busy), busy === 'analysis' ? 'Smart Fill in progress' : 'Saving reviewed details', busy === 'analysis' ? 'generating' : 'saving');
  const [status, setStatus] = useState(null), [statusError, setStatusError] = useState('');
  const currentScope = () => batchScope(apiPrefix, authRef.current);
  const valid = controller => alive.current && !controller.signal.aborted && operation.current === controller && currentScope() === initialScope.current;
  const update = (id, values) => { if (alive.current) setRecords(current => current.map(record => record.id === id ? { ...record, ...values } : record)); };

  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    api.get(`${apiPrefix}/products/smart-fill/status`, { silent: true, signal: controller.signal })
      .then(result => { if (alive.current && !controller.signal.aborted) { setStatus(result); setStatusError(''); } })
      .catch(error => { if (alive.current && !controller.signal.aborted) setStatusError(error.message || 'Smart Fill availability could not be checked.'); });
    return () => { alive.current = false; controller.abort(); operation.current?.abort(); onBusyChange?.(false); };
  }, [apiPrefix, onBusyChange]);

  useEffect(() => {
    if (scope !== initialScope.current) {
      operation.current?.abort(); setRecords([]); setBusy(''); setNotice('Your account or store changed. Close this batch and select drafts again.'); onBusyChange?.(false);
    }
  }, [scope, onBusyChange]);

  const run = async () => {
    if (operation.current || !status || !structure || currentScope() !== initialScope.current) return;
    const queue = records.filter(pending);
    if (!queue.length) return;
    const controller = new AbortController(); operation.current = controller;
    setBusy('analysis'); onBusyChange?.(true); setNotice('');
    try {
      // The existing server admits one analysis per owner. Queueing keeps every
      // product isolated and avoids duplicate-request errors and quota bursts.
      const rateRetries = new Map();
      for (let index = 0; index < queue.length; index += 1) {
        const record = queue[index];
        if (!valid(controller)) break;
        const interval = Number.isFinite(status.requestIntervalMs) && status.requestIntervalMs >= 0 ? status.requestIntervalMs : 5100;
        const delay = interval - (Date.now() - lastAnalysisStart.current);
        if (delay > 0) { update(record.id, { state: 'waiting', error: '' }); await waitForNextRequest(delay, controller.signal); }
        if (!valid(controller)) break;
        update(record.id, { state: 'reading', error: '' });
        try {
          const response = await api.get(`${apiPrefix}/product-drafts/${encodeURIComponent(record.id)}`, { silent: true, signal: controller.signal, cache: 'no-store' });
          if (!valid(controller)) break;
          const latest = response?.data || response;
          if (draftId(latest) !== record.id || latest.status !== 'draft' || !Number.isSafeInteger(latest.revision)) throw new Error('This draft changed or is unavailable. Reload it before running Smart Fill.');
          const baseline = snapshotForm(latest);
          const photos = smartPhotos(baseline).slice(0, Math.min(6, status.maxPhotos || 3));
          if (!status.enabled && !record.notes.trim()) throw Object.assign(new Error('Photo AI is not configured. Add supplier notes for this product or configure Gemini on the backend.'), { code: 'SMART_FILL_UNAVAILABLE' });
          lastAnalysisStart.current = Date.now();
          const result = await api.post(`${apiPrefix}/products/smart-fill`, smartRequest(baseline, record.notes, photos), { silent: true, signal: controller.signal });
          if (!valid(controller)) break;
          if (result.analysisStatus === 'failed') throw Object.assign(new Error(result.analysisError || result.warnings?.[0] || 'Photo analysis failed. Retry this draft.'), { code: result.errorCode });
          if (!result.suggestion || typeof result.suggestion !== 'object' || Array.isArray(result.suggestion)) throw new Error('Smart Fill returned an incomplete result. Retry this draft.');
          const rows = suggestionRows(result, baseline, { categories, structure, priceField: 'sellingPrice', seo: true });
          setNotice('');
          update(record.id, { baseline, rows, selected: rows.filter(row => row.empty && !financial(row.key)).map(row => row.key), replace: false,
            similarProducts: result.similarProducts || [], warnings: Array.isArray(result.warnings) ? result.warnings : [], state: rows.length ? 'ready' : 'empty', mode: result.mode });
        } catch (error) {
          if (!valid(controller)) break;
          if (error.status === 429 && !rateRetries.has(record.id)) {
            rateRetries.set(record.id, true); update(record.id, { state: 'waiting', error: '' });
            setNotice('Waiting for the Smart Fill request limit to reset. Your completed suggestions are kept; this batch will continue automatically.');
            await waitForNextRequest(61000, controller.signal);
            index -= 1; continue;
          }
          update(record.id, { state: 'failed', error: error.message || 'Smart Fill failed. Retry this product.' });
          if (halt(error)) { setNotice('Batch paused. Completed suggestions are kept. Resolve the message below, then resume the remaining drafts.'); break; }
        }
      }
    } finally {
      if (operation.current === controller) {
        operation.current = null;
        if (alive.current) { setBusy(''); onBusyChange?.(false); setRecords(current => current.map(record => ['reading', 'waiting'].includes(record.state) ? { ...record, state: 'paused' } : record)); }
      }
    }
  };

  const patches = records.map(record => ({ record, patch: record.state === 'ready' ? selectedSmartPatch(record.rows, record.selected, record.baseline, record.replace) : [] })).filter(item => item.patch.length);
  const save = async () => {
    if (operation.current || !patches.length || currentScope() !== initialScope.current) return;
    const controller = new AbortController(); operation.current = controller;
    setBusy('save'); onBusyChange?.(true); setNotice(''); let saved = 0;
    try {
      for (const { record, patch } of patches) {
        if (!valid(controller)) break;
        update(record.id, { state: 'saving', error: '' });
        try {
          // The original revision stays on the snapshot. The existing save API
          // rejects concurrent edits instead of replacing someone else's work.
          await onSave(applySmartPatch(record.baseline, patch), { silent: true });
          if (!valid(controller)) break;
          saved += 1; update(record.id, { state: 'saved', selected: [] });
        } catch (error) {
          if (!valid(controller)) break;
          update(record.id, { state: 'conflict', error: `${error.data?.message || error.message || 'Draft could not be saved.'} Re-analyse this draft before saving again.` });
          if (halt(error)) break;
        }
      }
    } finally {
      if (operation.current === controller) {
        operation.current = null;
        if (alive.current) { setBusy(''); onBusyChange?.(false); setNotice(`${saved} draft${saved === 1 ? '' : 's'} saved. Per-product results are shown below.`); if (saved) onSaved?.(saved); }
      }
    }
  };

  const complete = records.filter(record => ['ready', 'empty', 'saved', 'conflict'].includes(record.state)).length;
  const remaining = records.filter(pending).length;
  const labels = { queued: 'Waiting', waiting: 'Waiting for next analysis', reading: 'Reading photos', ready: 'Ready to review', empty: 'No new details', failed: 'Analysis failed', paused: 'Paused', saving: 'Saving', saved: 'Saved', conflict: 'Review required' };
  return <section className="product-smart-fill draft-smart-batch" aria-label="Batch draft Smart Fill">
    <div className="draft-smart-batch__heading"><div><h2><Sparkles size={19} />Smart Fill selected drafts</h2><p>Run all selected products with one click. Each product uses its own photos and notes.</p></div><button type="button" className="admin-btn-ghost" disabled={!!busy} onClick={onClose}><X size={16} />Close</button></div>
    <div className="product-smart-fill__body">
      <p>Keep this page open while the batch runs. Review suggestions, then save the selected details for all products together.</p>
      <div className="draft-smart-batch__progress" role="status">{complete}/{records.length} products analysed · {records.filter(record => record.state === 'saved').length} saved</div>
      <progress aria-label="Smart Fill batch progress" max={records.length || 1} value={complete} />
      <div className="product-smart-fill__actions"><button type="button" className="admin-btn" disabled={!!busy || !status || !structure || !remaining} onClick={run}>{busy === 'analysis' ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}{busy === 'analysis' ? 'Reading selected products…' : complete || records.some(record => record.state === 'failed') ? `Resume ${remaining} remaining drafts` : `Run Smart Fill for ${records.length} drafts`}</button>
        {busy === 'analysis' && <button type="button" className="admin-btn-ghost" onClick={() => { operation.current?.abort(); setNotice('Analysis stopped. Completed suggestions are kept; resume the remaining drafts when ready.'); }}>Stop analysis</button>}
        <button type="button" className="admin-btn" disabled={!!busy || !patches.length} onClick={save}><Save size={16} />{busy === 'save' ? 'Saving reviewed details…' : `Save selected details for ${patches.length} drafts`}</button></div>
      {statusError && <p role="alert" className="product-smart-fill__warning">{statusError} Close and reopen this batch to retry availability.</p>}
      {status?.enabled === false && <p role="status" className="product-smart-fill__warning">Photo AI is not configured. Enter notes per product to fill explicitly stated details.</p>}
      {notice && <p role="status" className="product-smart-fill__notice">{notice}</p>}
      <p className="product-smart-fill__hint">Empty listing fields are selected by default. Verify any suggested prices before selecting them.</p>
      {records.map((record, index) => <article key={record.id} className="draft-smart-batch__record" aria-label={`Smart Fill product ${index + 1}`}>
        <header>{smartPhotos(record.baseline)[0] && <img src={normalizeImageUrl(smartPhotos(record.baseline)[0])} alt="" />}<div><h3>{record.baseline.name || `Product ${index + 1}`}</h3><span>{smartPhotos(record.baseline).length} photos · {labels[record.state]}</span></div></header>
        {pending(record) && <label className="product-smart-fill__label">Notes for product {index + 1}<textarea rows={2} maxLength={7000} disabled={!!busy} value={record.notes} onChange={event => update(record.id, { notes: event.target.value })} placeholder="Optional details for this product only" /></label>}
        {record.error && <p role="alert" className="product-smart-fill__warning">{record.error}</p>}
        {record.similarProducts?.length > 0 && <section><strong>Similar catalogue products</strong>{record.similarProducts.map(product => <p key={product._id}><a href={`${apiPrefix}/products?edit=${encodeURIComponent(product._id)}`} target="_blank" rel="noopener noreferrer">{product.name}</a> — {product.reason}</p>)}<p>Review before publishing; grouping and merging remain your decision.</p></section>}{record.warnings.map((warning, i) => <p key={i} className="product-smart-fill__warning">{warning}</p>)}
        {record.state === 'conflict' && <button type="button" className="admin-btn-ghost" disabled={!!busy} onClick={() => update(record.id, { state: 'queued', rows: [], selected: [], error: '' })}>Re-analyse this draft</button>}
        {record.state === 'ready' && <details open={records.length === 1}><summary>{selectedSmartPatch(record.rows, record.selected, record.baseline, record.replace).length} selected details · Review suggestions</summary>
          <label className="product-smart-fill__choice"><input type="checkbox" checked={record.replace} disabled={!!busy} onChange={event => update(record.id, { replace: event.target.checked, selected: event.target.checked ? record.selected : record.rows.filter(row => row.empty && !financial(row.key)).map(row => row.key) })} />Allow replacing selected existing details for this product</label>
          <div className="product-smart-fill__fields">{record.rows.map(row => {
            const locked = !!busy || (!row.empty && !record.replace) || !sameValue(fieldValue(record.baseline, row.key), row.before);
            return <label key={row.key} className={`product-smart-fill__field ${locked ? 'is-protected' : ''}`}><input type="checkbox" aria-label={`${row.label} for product ${index + 1}`} checked={record.selected.includes(row.key) && !locked} disabled={locked} onChange={event => update(record.id, { selected: event.target.checked ? [...record.selected, row.key] : record.selected.filter(key => key !== row.key) })} /><span><strong>{row.label}</strong><span className="product-smart-fill__value">{displaySmartValue(row.value, row.key, categories)}</span>{!row.empty && <small>Current: {displaySmartValue(row.before, row.key, categories)}</small>}{row.evidence?.quote && <small>Source: {row.evidence.quote}</small>}</span></label>;
          })}</div></details>}
      </article>)}
    </div>
  </section>;
}
