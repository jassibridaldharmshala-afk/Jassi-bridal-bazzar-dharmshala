import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../services/api';
export default function RentalReadinessQueue({ base, onSetup }) {
  const [data, setData] = useState({ rows: [] }), [search, setSearch] = useState(''), [cursor, setCursor] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);
  const load = useCallback(async () => {
    const current = ++generation.current; setBusy(true); setError('');
    try { const response = await api.get(`${base}/readiness-queue?${new URLSearchParams({ search, after: cursor })}`, { silent: true, forceRefetch: true }); if (current === generation.current) { if (!Array.isArray(response?.rows)) throw new Error('The setup queue returned incomplete information. Please retry.'); setData(response); } }
    catch (err) { if (current === generation.current) setError(err.message); }
    finally { if (current === generation.current) setBusy(false); }
  }, [base, cursor, search]);
  useEffect(() => { load(); }, [load]);
  return <section className="rental-card"><h2>Products needing rental setup</h2><p>Review inactive offers, missing rates and real piece codes after loss, retirement or conversion to sale. Cleaning and booked dates stay in availability.</p>
    <label className="rental-field">Find a product<input value={search} maxLength={100} onChange={event => { setSearch(event.target.value); setCursor(''); }} /></label>
    {error && <p role="alert">{error}<button type="button" onClick={load}>Retry queue</button></p>}
    {busy ? <p role="status">Checking rental readiness…</p> : !data.rows.length ? <p>{data.hasMore ? 'No setup issues in this scan. Continue to check the next products.' : 'No outstanding setup issues in this selection.'}</p> : data.rows.map(row => <article key={row.product._id} className="rental-card"><h3>{row.product.name}</h3>
      {row.reasons.map(reason => <p key={reason.code}>{reason.message}</p>)}
      {row.offers.map(offer => <div key={offer._id}><strong>{offer.title}</strong>{offer.reasons.map(reason => <p key={reason.code}>{reason.message}</p>)}<button type="button" className="rental-button rental-button--secondary" onClick={() => onSetup({ productId: row.product._id, listing: offer._id })}>Review offer & pieces</button></div>)}
      {!row.offers.length && <button type="button" className="rental-button" onClick={() => onSetup({ productId: row.product._id })}>Create rental offer</button>}
    </article>)}
    <div className="rental-actions"><button type="button" disabled={busy} onClick={() => { if (cursor) setCursor(''); else load(); }}>Refresh from start</button>{data.hasMore && <button type="button" disabled={busy} onClick={() => setCursor(data.next)}>Next products</button>}</div>
  </section>;
}

