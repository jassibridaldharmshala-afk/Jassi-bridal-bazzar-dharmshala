import { useEffect, useRef, useState } from 'react';
import api from '../../services/api';
export default function CompleteLookPicker({ apiPrefix, productId, value = [], onChange, disabled }) {
  const [search, setSearch] = useState(''), [rows, setRows] = useState([]), [names, setNames] = useState({}), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const generation = useRef(0), lock = useRef(false);
  useEffect(() => { generation.current += 1; lock.current = false; setRows([]); setNames({}); setError(''); setBusy(false); return () => { generation.current += 1; }; }, [apiPrefix, productId]);
  const find = async () => {
    if (lock.current || disabled) return; lock.current = true; const version = generation.current; setBusy(true); setError('');
    try { const data = await api.get(`${apiPrefix}/products?search=${encodeURIComponent(search.trim())}&page=1&limit=12`, { silent: true }); if (version !== generation.current) return; const found = Array.isArray(data) ? data : data?.items || []; setRows(found.filter(p => String(p._id) !== String(productId || ''))); setNames(current => ({ ...current, ...Object.fromEntries(found.map(p => [String(p._id), p.name])) })); }
    catch (e) { if (version === generation.current) setError(e.message); } finally { if (version === generation.current) { lock.current = false; setBusy(false); } }
  };
  const key = value.map(String).join(',');
  useEffect(() => {
    let alive = true;
    key.split(',').filter(Boolean).forEach(id => { Promise.resolve(api.get(`${apiPrefix}/products/${id}`, { silent: true })).then(p => { if (alive && p?.name) setNames(current => ({ ...current, [id]: p.name })); }).catch(() => {}); });
    return () => { alive = false; };
  }, [apiPrefix, key]);
  return <div className="space-y-3 lg:col-span-2">
    <p className="text-sm text-slate-600">Choose up to eight complementary products from this store. Leave empty for occasion/colour-based matching. Hidden and unavailable products are not shown to shoppers.</p>
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <label className="admin-field flex-1"><span>Find matching products</span><input className="admin-field__control" value={search} disabled={disabled || busy} onChange={e => setSearch(e.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); find(); } }} /></label>
      <button type="button" className="admin-btn-ghost" disabled={disabled || busy} onClick={find}>{busy ? 'Finding…' : 'Find products'}</button>
    </div>
    {error && <p role="alert">{error}</p>}
    <p className="text-xs text-slate-500">{value.length} of 8 selected. Selection order is the display order.</p>
    <div className="flex flex-wrap gap-2">{value.map(String).map(id => <button type="button" key={id} disabled={disabled} className="admin-btn-ghost" aria-label={`Remove ${names[id] || id} from complete look`} onClick={() => onChange(value.map(String).filter(item => item !== id))}>{names[id] || 'Selected matching product'} ×</button>)}</div>
    <div className="grid gap-2 sm:grid-cols-2">{rows.map(p => <label key={p._id} className="flex items-center gap-2 rounded-xl border p-3"><input type="checkbox" checked={value.map(String).includes(String(p._id))} disabled={disabled || (!value.map(String).includes(String(p._id)) && value.length >= 8)} onChange={e => onChange(e.target.checked ? [...value.map(String), String(p._id)] : value.map(String).filter(id => id !== String(p._id)))} /><span>{p.name}{p.isActive === false || p.isArchived ? ' · Not published' : ''}</span></label>)}</div>
  </div>;
}
