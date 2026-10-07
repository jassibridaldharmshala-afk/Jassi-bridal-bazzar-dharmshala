import { useEffect, useRef, useState } from 'react';

export default function StockInput({ value, onSave, ...props }) {
  const [draft, setDraft] = useState(String(value ?? 0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  useEffect(() => { setDraft(String(value ?? 0)); }, [value]);

  const save = async () => {
    if (inFlight.current || draft === String(value ?? 0)) return;
    const next = Number(draft);
    if (!draft.trim() || !Number.isSafeInteger(next) || next < 0) {
      setError('Enter a whole stock quantity of 0 or more.');
      return;
    }
    inFlight.current = true;
    setSaving(true);
    setError('');
    try { await onSave(next); }
    catch (failure) { setError(failure.message || 'Stock could not be saved. Try again.'); }
    finally { inFlight.current = false; setSaving(false); }
  };

  return <span className="inline-flex flex-col items-start gap-1">
    <input {...props} type="number" min="0" step="1" value={draft} disabled={saving || props.disabled}
      aria-invalid={Boolean(error)} title="Enter a quantity, then press Enter or leave this field to save"
      onChange={event => { setDraft(event.target.value); setError(''); }} onBlur={save}
      onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); save(); } }} />
    {saving && <small role="status">Saving…</small>}
    {error && <small role="alert" className="max-w-48 text-xs text-rose-700">{error}</small>}
  </span>;
}
