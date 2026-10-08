import { useEffect, useRef, useState } from 'react';
import api from '../../services/api';
export default function RentalRecordPager({ base, kind, refresh = 0, onLoaded }) {
  const callback = useRef(onLoaded); callback.current = onLoaded;
  const [page, setPage] = useState(1), [search, setSearch] = useState(''), [query, setQuery] = useState(''), [result, setResult] = useState(null), [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    api.get(`${base}/manage/${kind}?page=${page}&search=${encodeURIComponent(query)}`, { silent: true, forceRefetch: true }).then(value => { if (alive) { setResult(value); callback.current(value.rows); setError(''); } }).catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [base, kind, page, query, refresh]);
  return <div className="rental-card"><div className="rental-fields"><label className="rental-field"><span>Search {kind}</span><input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); setQuery(search); setPage(1); } }} /></label><button type="button" className="rental-button rental-button--secondary" onClick={() => { setQuery(search); setPage(1); }}>Find {kind}</button></div>{error && <p role="alert">{error}</p>}{result && <div className="rental-actions"><button type="button" className="rental-button rental-button--secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous {kind}</button><span>{result.total} {kind} · page {result.page}</span><button type="button" className="rental-button rental-button--secondary" disabled={page >= result.pages} onClick={() => setPage(p => p + 1)}>Next {kind}</button></div>}</div>;
}
