import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Loader2, Sparkles, Undo2 } from 'lucide-react';
import api from '../../services/api';
import { normalizeImageUrl } from '../../services/normalize';
import { displaySmartValue, fieldValue, sameValue, selectedSmartPatch, smartPhotos, smartRequest, snapshotForm, suggestionRows } from '../../utils/productSmartFill';
import './ProductSmartFill.css';

export default function ProductSmartFill({ form, categories, structure, onApply, apiPrefix = '/admin', priceField = 'price', seo = true, disabled = false }) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [selection, setSelection] = useState(null);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [preview, setPreview] = useState(null);
  const [selected, setSelected] = useState([]);
  const [replace, setReplace] = useState(false);
  const [undo, setUndo] = useState(null);
  const request = useRef(null);
  const photos = smartPhotos(form);
  const chosen = (selection ?? photos.slice(0, 3)).filter(url => photos.includes(url)).slice(0, 3);
  const inputs = JSON.stringify({ notes, photos: chosen });
  const stale = preview && preview.inputs !== inputs;

  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    api.get(`${apiPrefix}/products/smart-fill/status`, { silent: true, forceRefetch: false })
      .then(value => { if (alive) setStatus(value); })
      .catch(() => { if (alive) setStatus(null); });
    return () => { alive = false; };
  }, [open, apiPrefix]);

  const analyze = async () => {
    if (request.current || disabled) return;
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError(''); setNotice(''); setPreview(null); setReplace(false);
    const baseline = snapshotForm(form);
    try {
      const result = await api.post(`${apiPrefix}/products/smart-fill`, smartRequest(baseline, notes, chosen), { silent: true, signal: controller.signal });
      if (controller.signal.aborted) return;
      const rows = suggestionRows(result, baseline, { categories, structure, priceField, seo });
      setPreview({ rows, warnings: result.warnings || [], mode: result.mode, inputs });
      setSelected(rows.filter(row => row.empty).map(row => row.key));
      if (!rows.length && !result.warnings?.length) setNotice('No additional fields to fill from these inputs. Your existing details are unchanged.');
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure.message || 'Smart Fill could not complete. Please try again.');
    } finally {
      if (request.current === controller) { request.current = null; setBusy(false); }
    }
  };
  const togglePhoto = (url) => {
    setSelection(chosen.includes(url) ? chosen.filter(item => item !== url) : chosen.length < 3 ? [...chosen, url] : chosen);
  };
  const patch = preview && !stale ? selectedSmartPatch(preview.rows, selected, form, replace) : [];
  const apply = () => {
    if (!patch.length || disabled) return;
    onApply(patch); setUndo(patch); setPreview(null);
    setNotice('Reviewed details added to your form. Check stock and any missing information, then save as usual.');
  };

  return <section className="product-smart-fill" aria-label="Smart product fill">
    <button type="button" className="product-smart-fill__toggle" aria-expanded={open} aria-controls={uid} onClick={() => setOpen(value => !value)}>
      <span className="product-smart-fill__icon"><Sparkles size={20} /></span>
      <span><strong>Smart fill</strong><small>Turn photos and supplier notes into product details</small></span>
      <ChevronDown size={18} className={open ? 'is-open' : ''} />
    </button>
    {open && <div id={uid} className="product-smart-fill__body">
      <p>Use clear views of one product. Review suggested details before adding them to your form.</p>
      {!!photos.length && <div>
        <p className="product-smart-fill__label">Product photos <span>{chosen.length}/3 selected</span></p>
        <div className="product-smart-fill__photos">{photos.map((url, index) => <button key={url} type="button" disabled={busy || disabled || (!chosen.includes(url) && chosen.length >= 3)} aria-pressed={chosen.includes(url)} aria-label={`Use product photo ${index + 1}`} onClick={() => togglePhoto(url)}>
          <img src={normalizeImageUrl(url)} alt={`Product view ${index + 1}`} loading="lazy" /><span>{chosen.includes(url) ? 'Selected' : 'Select'}</span>
        </button>)}</div>
      </div>}
      <label className="product-smart-fill__label" htmlFor={uid + '-notes'}>Supplier notes or product details</label>
      <textarea id={uid + '-notes'} rows={4} maxLength={7000} value={notes} disabled={busy || disabled} onChange={event => setNotes(event.target.value)} placeholder={'Paste details in English, Hindi or Hinglish. For example:\nName: Wine embroidered saree\nFabric: Georgette\nSelling price: Rs 1299\nMRP: Rs 1999'} />
      <p className="product-smart-fill__hint">{status?.enabled === false ? 'Photo AI is not configured. You can still fill explicitly stated details from notes.' : 'Uses your selected photos and details already entered. Add photos in the product photo section.'} Stock stays manual. Price and available sizes are suggested only when stated.</p>
      <div className="product-smart-fill__actions">
        <button type="button" className="admin-btn" disabled={busy || disabled} onClick={analyze}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}{busy ? 'Reading product details…' : 'Suggest details'}</button>
        {busy && <button type="button" className="admin-btn-ghost" onClick={() => { request.current?.abort(); request.current = null; setBusy(false); setNotice('Analysis cancelled.'); }}>Cancel</button>}
        {undo && !busy && <button type="button" className="admin-btn-ghost" disabled={disabled} onClick={() => { onApply(undo, true); setUndo(null); setNotice('Smart Fill changes undone. Any later manual edits have been kept.'); }}><Undo2 size={15} />Undo last fill</button>}
      </div>
      {error && <p role="alert" className="product-smart-fill__warning">{error}</p>}
      {notice && <p role="status" className="product-smart-fill__notice">{notice}</p>}
      {preview && <div className="product-smart-fill__review">
        <div className="product-smart-fill__review-heading"><strong>Review suggestions</strong><span>{preview.mode === 'ai' ? 'Photos & context' : 'From your notes'}</span></div>
        {preview.warnings.map(warning => <p key={warning} role="status" className="product-smart-fill__warning">{warning}</p>)}
        {stale && <p role="status" className="product-smart-fill__warning">Your photos or notes changed. Suggest details again before applying.</p>}
        {!!preview.rows.length && <>
          <label className="product-smart-fill__choice"><input type="checkbox" checked={replace} disabled={disabled || stale} onChange={event => { setReplace(event.target.checked); if (!event.target.checked) setSelected(preview.rows.filter(row => row.empty).map(row => row.key)); }} />Allow replacing selected existing details</label>
          <div className="product-smart-fill__fields">{preview.rows.map(row => {
            const changed = !sameValue(fieldValue(form, row.key), row.before);
            const locked = disabled || stale || changed || (!row.empty && !replace);
            return <label key={row.key} className={'product-smart-fill__field' + (locked ? ' is-protected' : '')}>
              <input type="checkbox" checked={selected.includes(row.key) && !locked} disabled={locked} onChange={event => setSelected(current => event.target.checked ? [...current, row.key] : current.filter(key => key !== row.key))} />
              <span><strong>{row.label}</strong><span className="product-smart-fill__value">{displaySmartValue(row.value, row.key, categories)}</span>
                {!row.empty && <small>Current: {displaySmartValue(fieldValue(form, row.key), row.key, categories)}</small>}
                {changed && <small>Edited since analysis — your change is protected.</small>}
                {row.evidence?.quote && <small>Source: {row.evidence.quote}</small>}
              </span>
            </label>;
          })}</div>
          <div className="product-smart-fill__actions"><button type="button" className="admin-btn" disabled={!patch.length || disabled} onClick={apply}>Apply {patch.length || ''} selected {patch.length === 1 ? 'detail' : 'details'}</button><button type="button" className="admin-btn-ghost" onClick={() => setPreview(null)}>Discard suggestions</button></div>
          <p className="product-smart-fill__hint">Existing values are protected by default. Conflicting selling price and MRP suggestions are skipped together.</p>
        </>}
      </div>}
    </div>}
  </section>;
}
