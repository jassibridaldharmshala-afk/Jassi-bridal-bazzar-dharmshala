import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown, Copy, FileText, Sparkles, Undo2, X } from 'lucide-react';
import api from '../../services/api';
import { compressImageFile, isSupportedImageFile } from '../../services/imageCompression';
import { applySmartReview, reviewSmartSuggestions, smartCurrent, smartEndpoint, smartRowUnchanged } from '../../utils/workflowSmartFill';
import './WorkflowSmartFill.css';

const titles = { category: 'Category & SEO', banner: 'Banner creative', campaign: 'Campaign creative', website: 'Website design', coupon: 'Coupon rules', shipment: 'Delivery details', purchase: 'Supplier invoice', support: 'Order support', returns: 'Return case', store: 'Store setup' };
const examples = {
  category: 'Category: Silver earrings', banner: 'Title: Diwali collection\nSubtitle: Discover our festive edit\nCTA: Explore collection\nLink: /products\nAlt text: Describe the actual artwork',
  campaign: 'Campaign: Festive collection\nTitle: Discover the festive edit\nSubtitle: Explore the collection\nCTA: Shop now',
  website: 'Style: luxury jewellery\nHero heading: Made for your special moments\nHero description: Explore our latest collection\nAbout us: Add verified brand details here',
  coupon: 'New customers: 10%\nMinimum order: 1000\nMaximum discount: 200\nCode: WELCOME10',
  shipment: 'Courier: Blue Dart\nAWB: 12345678901\nTracking URL: https://your-courier.example/verified-link\nDelivery date: 2026-10-15',
  purchase: 'Supplier: Your supplier\nSupplier phone: +919876543210\nSKU-001, 5, 250.00\nSKU-002, 3, 190.00',
  store: 'Brand: Your store\nTagline: Your brand message\nLegal name: Registered business name\nEmail: support@example.com\nPhone: +919876543210\nAddress: Actual business address',
};
const display = value => typeof value === 'boolean' ? value ? 'Yes' : 'No' : (Array.isArray(value) || (value && typeof value === 'object')) ? JSON.stringify(value, null, 2) : String(value ?? '(empty)');
const clone = value => JSON.parse(JSON.stringify(value));
const defaultBase = () => window.location.pathname.startsWith('/seller') ? '/seller/smart-fill' : '/admin/smart-fill';
const workspaceScope = base => { try { return base.startsWith('/seller') ? sessionStorage.getItem('samira_seller_store_id') || '' : new URLSearchParams(window.location.search).get('storeId') || sessionStorage.getItem('samira_store_slug') || ''; } catch { return ''; } };

export function CopySmartDraft({ value }) {
  const [message, setMessage] = useState('');
  useEffect(() => setMessage(''), [value]);
  return <div className="mt-3"><button type="button" className="admin-btn-ghost" disabled={!value} onClick={async () => { try { if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable'); await navigator.clipboard.writeText(value); setMessage('Reply copied. Nothing was sent.'); } catch { setMessage('Clipboard unavailable. Select the reply text and copy it manually.'); } }}><Copy size={15} />Copy reviewed reply</button>{message && <p role="status" className="mt-2 text-sm text-theme-muted">{message}</p>}</div>;
}

export function SmartFillReview({ rows, form, disabled = false, onApply, title = 'Review suggestions' }) {
  const [selected, setSelected] = useState(() => rows.filter(row => row.empty).map(row => row.path));
  const [replace, setReplace] = useState(false), [confirmed, setConfirmed] = useState(false);
  const conflicts = rows.filter(row => !smartRowUnchanged(form, row));
  const candidates = rows.filter(row => selected.includes(row.path) && (row.empty || replace) && !conflicts.includes(row));
  const blockedGroups = new Set(candidates.filter(row => row.group && rows.some(peer => peer.group === row.group && !candidates.includes(peer))).map(row => row.group));
  const usable = candidates.filter(row => !blockedGroups.has(row.group));
  const needsConfirmation = usable.some(row => row.attention);
  return <div className="workflow-smart__review">
    <h4>{title}</h4>
    <label className="workflow-smart__choice"><input type="checkbox" checked={replace} disabled={disabled} onChange={event => { setReplace(event.target.checked); setConfirmed(false); if (!event.target.checked) setSelected(rows.filter(row => row.empty).map(row => row.path)); }} /><span>Allow replacing selected existing values</span></label>
    {conflicts.length > 0 && <p role="status" className="workflow-smart__warning">Some fields changed since this preview. Those fields are protected; refresh suggestions to review their latest values.</p>}
    {blockedGroups.size > 0 && <p role="status" className="workflow-smart__warning">Related discount, audience or courier fields must be reviewed together. Allow replacement where needed, then select all related fields.</p>}
    <div className="workflow-smart__actions"><button type="button" className="admin-btn-ghost" disabled={disabled} onClick={() => { setSelected(rows.filter(row => (row.empty || replace) && !conflicts.includes(row)).map(row => row.path)); setConfirmed(false); }}>Select eligible fields</button><button type="button" className="admin-btn-ghost" disabled={disabled} onClick={() => { setSelected([]); setConfirmed(false); }}>Clear selection</button></div>
    <div className="workflow-smart__rows">{rows.map(row => { const locked = (!row.empty && !replace) || conflicts.includes(row); return <label key={row.path} className="workflow-smart__row" data-protected={locked || undefined}>
      <input type="checkbox" checked={selected.includes(row.path) && !locked} disabled={disabled || locked} onChange={event => { setSelected(current => event.target.checked ? [...current, row.path] : current.filter(path => path !== row.path)); setConfirmed(false); }} />
      <span><strong>{row.label}</strong><small>{row.source === 'database' ? 'Saved store data' : row.source === 'notes' ? 'Source notes / extracted document' : 'Algorithm draft — review wording'}</small><span className="workflow-smart__value">{display(row.value)}</span>{!row.empty && <small>Current: {display(row.before)}</small>}{row.quote && <small>Source: {row.quote}</small>}{row.attention && <small>Verify against the original before applying.</small>}</span>
    </label>; })}</div>
    {needsConfirmation && <label className="workflow-smart__choice"><input type="checkbox" checked={confirmed} disabled={disabled} onChange={event => setConfirmed(event.target.checked)} /><span>I checked these financial, shipment or business values against the original source.</span></label>}
    <button type="button" className="admin-btn" disabled={disabled || !usable.length || (needsConfirmation && !confirmed)} onClick={() => onApply(usable, replace)}><Check size={15} />Apply {usable.length} reviewed fields to draft</button>
  </div>;
}

export default function WorkflowSmartFill({ workflow, form, onChange, apiBase, context = {}, disabled = false, documents = false, protectedPaths = [], title }) {
  const base = apiBase || defaultBase(); const id = useId();
  const [open, setOpen] = useState(false), [notes, setNotes] = useState(''), [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [undo, setUndo] = useState(null), [document, setDocument] = useState(null), [consent, setConsent] = useState(false), [status, setStatus] = useState(null);
  const active = useRef(null), alive = useRef(true), currentForm = useRef(form); currentForm.current = form;
  const fileRevision = useRef(0);
  const scopeKey = JSON.stringify({ base, workflow, context, store: workspaceScope(base) });
  useEffect(() => { alive.current = true; fileRevision.current += 1; setBusy(false); setNotes(''); setPreview(null); setUndo(null); setDocument(null); setStatus(null); setConsent(false); setError(''); setNotice(''); return () => { alive.current = false; fileRevision.current += 1; active.current?.abort(); active.current = null; }; }, [scopeKey]);
  useEffect(() => {
    if (!open || !documents) return undefined;
    let valid = true; api.get(smartEndpoint(base, 'status'), { silent: true, cache: 'no-store' }).then(value => { if (valid) setStatus(value); }).catch(() => { if (valid) setStatus({ documentExtraction: false }); });
    return () => { valid = false; };
  }, [base, open, documents, scopeKey]);
  const analyze = async () => {
    if (active.current || disabled) return;
    const controller = new AbortController(); active.current = controller;
    setBusy(true); setError(''); setNotice(''); setPreview(null);
    const baseline = clone(currentForm.current), sourceNotes = notes, sourceDocument = document;
    try {
      const result = await api.post(smartEndpoint(base, 'preview'), { workflow, notes: sourceNotes, current: smartCurrent(baseline, workflow), context,
        ...(sourceDocument ? { document: { ...sourceDocument, consent } } : {}) }, { silent: true, signal: controller.signal });
      if (!alive.current || controller.signal.aborted) return;
      setPreview({ ...result, rows: reviewSmartSuggestions(result, baseline, workflow), sourceNotes, sourceDocument });
    } catch (failure) { if (alive.current && !controller.signal.aborted) setError(failure.message || 'Suggestions could not load. Your form is unchanged.'); }
    finally { if (active.current === controller) { active.current = null; if (alive.current) setBusy(false); } }
  };
  const chooseDocument = async event => {
    const revision = ++fileRevision.current;
    const file = event.target.files?.[0]; event.target.value = ''; setError(''); setDocument(null); setConsent(false); setPreview(null);
    if (!file) return;
    let prepared;
    try {
      if (isSupportedImageFile(file)) prepared = await compressImageFile(file);
      else if (file.type === 'application/pdf' && file.size <= 512 * 1024) prepared = file;
      else throw new Error('Choose a photo up to 20 MB or a PDF under 512 KB, or paste its text.');
    } catch (failure) { if (alive.current && fileRevision.current === revision) setError(failure.message); return; }
    if (!alive.current || fileRevision.current !== revision) return;
    const reader = new FileReader();
    reader.onerror = () => { if (alive.current && fileRevision.current === revision) setError('Could not read this document. Paste its text instead.'); };
    reader.onload = () => { if (alive.current && fileRevision.current === revision) setDocument({ mimeType: prepared.type, data: String(reader.result).split(',')[1] }); };
    reader.readAsDataURL(prepared);
  };
  const stale = preview && (preview.sourceNotes !== notes || preview.sourceDocument !== document);
  const reviewRows = preview?.rows.filter(row => !protectedPaths.includes(row.path)) || [];
  return <section className="workflow-smart" aria-label={`${titles[workflow] || workflow} Smart Fill`}>
    <button type="button" className="workflow-smart__toggle" aria-expanded={open} aria-controls={id} disabled={disabled} onClick={() => setOpen(value => !value)}><span className="workflow-smart__icon"><Sparkles size={20} /></span><span><strong>{title || `${titles[workflow] || workflow} Smart Fill`}</strong><small>Source → suggestions → review → draft. You stay in control.</small></span><ChevronDown size={18} /></button>
    {open && <div id={id} className="workflow-smart__body">
      <p>Algorithms suggest content and extract explicit facts. Existing values stay protected. Nothing is saved, sent, published or executed automatically.</p>
      {!['support', 'returns'].includes(workflow) && <label className="workflow-smart__source"><span>Source notes / brief</span><textarea aria-label={`${titles[workflow]} source notes`} maxLength={16000} value={notes} disabled={busy || disabled} placeholder={examples[workflow] || 'Paste verified source details'} onChange={event => setNotes(event.target.value)} /></label>}
      {documents && <div className="workflow-smart__document"><label><FileText size={16} />Optional document (photos up to 20 MB, PDF up to 512 KB)<input type="file" aria-label="Smart Fill source document" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={busy || disabled || !status?.documentExtraction} onChange={chooseDocument} /></label><small>{status?.documentExtraction ? 'The configured Gemini extracts text only. Check every machine-extracted value.' : 'Document extraction needs the existing backend Gemini configuration. Pasted notes work without AI.'}</small>{document && <><button type="button" className="admin-btn-ghost" disabled={busy} onClick={() => { setDocument(null); setConsent(false); }}>Remove document</button><label className="workflow-smart__choice"><input type="checkbox" checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)} /><span>I may use this document and agree to send it to the configured AI for text extraction. Remove unnecessary personal information first.</span></label></>}</div>}
      <div className="workflow-smart__actions"><button type="button" className="admin-btn" disabled={disabled || busy || (!!document && !consent)} onClick={analyze}><Sparkles size={15} />{busy ? 'Preparing suggestions…' : 'Suggest draft fields'}</button>{busy && <button type="button" className="admin-btn-ghost" onClick={() => { active.current?.abort(); active.current = null; setBusy(false); }}>Cancel analysis</button>}{undo && <button type="button" className="admin-btn-ghost" disabled={disabled || busy} onClick={() => { const result = applySmartReview(currentForm.current, undo.filter(row => !protectedPaths.includes(row.path)), undo.map(row => row.path), true, true); if (onChange(result.form, result.applied, true) === false) return; setUndo(null); setNotice('Last fill undone. Later manual edits were preserved.'); }}><Undo2 size={15} />Undo last fill</button>}</div>
      {error && <p role="alert" className="workflow-smart__warning">{error}</p>}{notice && <p role="status" className="workflow-smart__notice">{notice}</p>}
      {preview && <>{preview.warnings?.map((warning, index) => <p key={index} className="workflow-smart__warning">{warning}</p>)}{preview.extractedText && <details><summary>Compare extracted source text</summary><pre className="workflow-smart__value">{preview.extractedText}</pre></details>}{stale && <p role="status" className="workflow-smart__warning">Source changed. Refresh suggestions before applying.</p>}{reviewRows.length ? <SmartFillReview key={JSON.stringify(reviewRows)} rows={reviewRows} form={form} disabled={busy || disabled || stale} onApply={(rows, replace) => { const result = applySmartReview(currentForm.current, rows, rows.map(row => row.path), replace); if (result.applied.length) { if (onChange(result.form, result.applied, false, preview) === false) return; setUndo(result.applied); setNotice(`${result.applied.length} fields filled in the draft. Use the existing Save action after reviewing.`); setPreview(null); } }} /> : <p role="status">No safe changes found. Add explicit source details or edit the form manually.</p>}<button type="button" className="admin-btn-ghost" disabled={busy} onClick={() => setPreview(null)}><X size={14} />Discard suggestions</button></>}
    </div>}
  </section>;
}
