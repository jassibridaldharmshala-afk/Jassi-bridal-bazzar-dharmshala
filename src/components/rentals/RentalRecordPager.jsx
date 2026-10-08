import { useEffect, useRef, useState } from 'react';
import api from '../../services/api';
export default function RentalRecordPager({ base, kind, refresh = 0, onLoaded }) {
  const callback = useRef(onLoaded); callback.current = onLoaded;
  const [page, setPage] = useState(1), [search, setSearch] = useState(''), [query, setQuery] = useState(''), [result, setResult] = useState(null), [error, setError] = useState(''), [reload, setReload] = useState(0);
  const name = kind === 'assets' ? 'pieces' : kind === 'listings' ? 'offers' : 'products';
  useEffect(() => {
    let alive = true;
    api.get(`${base}/manage/${kind}?page=${page}&search=${encodeURIComponent(query)}`, { silent: true, forceRefetch: true }).then(value => { if (!Array.isArray(value?.rows)) throw new Error(`The ${name} list could not be loaded. Retry to check it again.`); if (alive) { setResult(value); callback.current(value.rows); setError(''); } }).catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [base, kind, page, query, refresh, reload, name]);
  return <div className="rental-card rental-record-pager"><div className="rental-fields"><label className="rental-field"><span>Search {name}</span><input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); setQuery(search.trim()); setPage(1); setReload(v => v + 1); } }} /></label><button type="button" className="rental-button rental-button--secondary" onClick={() => { setQuery(search.trim()); setPage(1); setReload(v => v + 1); }}>Find {name}</button></div>{error && <p role="alert">{error} <button type="button" className="rental-text-button" onClick={() => setReload(v => v + 1)}>Retry {name}</button></p>}{result && <div className="rental-actions">{result.pages > 1 && <button type="button" className="rental-button rental-button--secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous {name}</button>}<span className="rental-muted">{result.total} {name}{result.pages > 1 ? ` · page ${result.page} of ${result.pages}` : ''}</span>{result.pages > 1 && <button type="button" className="rental-button rental-button--secondary" disabled={page >= result.pages} onClick={() => setPage(p => p + 1)}>Next {name}</button>}</div>}</div>;
}
