import { useEffect, useState } from 'react';
import api from '../../services/api';
import { localDateTime, rentalDate, rentalMoney } from '../../utils/rentals';
import { RentalField, RentalStatus } from './RentalUi';
const views = [['all', 'All bookings'], ['pickups', 'Pickups'], ['returns', 'Returns'], ['overdue', 'Overdue returns'], ['balance', 'Pending balance'], ['refunds', 'Refund available']];
export default function RentalBookingDesk({ base, timezone, refresh = 0, onOpen }) {
  const [day, setDay] = useState(localDateTime(new Date(), timezone).slice(0, 10)), [view, setView] = useState('pickups'), [status, setStatus] = useState('');
  const [search, setSearch] = useState(''), [query, setQuery] = useState(''), [page, setPage] = useState(1), [reload, setReload] = useState(0);
  const [data, setData] = useState(null), [desk, setDesk] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    let alive = true; setBusy(true); setError('');
    const params = new URLSearchParams({ page: String(page), day, view, status, search: query });
    Promise.all([api.get(`${base}/bookings?${params}`, { silent: true, forceRefetch: true }), api.get(`${base}/daily-desk?day=${day}`, { silent: true, forceRefetch: true })])
      .then(([bookings, summary]) => { if (!Array.isArray(bookings?.rows) || !summary?.counts) throw new Error('Booking desk could not be loaded. Use Refresh bookings to retry.'); if (alive) { setData(bookings); setDesk(summary); } })
      .catch(e => { if (alive) setError(e.details || e.message); })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [base, day, view, status, query, page, reload, refresh]);
  useEffect(() => {
    const update = () => { if (document.visibilityState !== 'hidden') setReload(v => v + 1); };
    const timer = setInterval(update, 60000); window.addEventListener('focus', update);
    return () => { clearInterval(timer); window.removeEventListener('focus', update); };
  }, []);
  const choose = next => { setView(next); setStatus(''); setPage(1); };
  return <section className="rental-card rental-booking-desk" aria-busy={busy}><header><span className="rental-eyebrow">DAILY OPERATIONS</span><h2>Booking desk</h2><p className="rental-muted">Find customers and bookings, organise pickups and returns, and follow up outstanding amounts.</p></header>
    <div className="rental-fields"><RentalField label={`Operations date (${timezone})`} type="date" value={day} onChange={value => { setDay(value); setPage(1); }} /><button type="button" className="rental-button rental-button--secondary" onClick={() => { setDay(localDateTime(new Date(), timezone).slice(0, 10)); setPage(1); }}>Today</button><button type="button" className="rental-button rental-button--secondary" disabled={busy} onClick={() => setReload(v => v + 1)}>Refresh bookings</button></div>
    <nav className="rental-desk-filters" aria-label="Booking desk filters">{views.map(([id, label]) => <button type="button" key={id} className={`rental-desk-filter${view === id ? ' is-selected' : ''}`} aria-pressed={view === id} onClick={() => choose(id)}><span>{label}</span>{id !== 'all' && <strong>{desk?.counts?.[id] ?? '—'}</strong>}</button>)}</nav>
    <form className="rental-fields" onSubmit={e => { e.preventDefault(); setQuery(search.trim()); setPage(1); }}><RentalField label="Search customer name, mobile or booking number" value={search} onChange={setSearch} maxLength={100} /><button type="submit" className="rental-button">Search bookings</button><RentalField label="Booking status"><select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">All statuses</option>{['HELD', 'CONFIRMED', 'PREPARING', 'READY', 'OUT', 'RETURNED', 'CLOSED', 'CANCELLED', 'EXPIRED'].map(v => <option key={v}>{v}</option>)}</select></RentalField><button type="button" className="rental-text-button" onClick={() => { setSearch(''); setQuery(''); setStatus(''); setView('all'); setPage(1); }}>Clear filters</button></form>
    {error && <p role="alert" className="rental-notice">{error}</p>}{busy && <p role="status">Updating booking desk…</p>}
    {data && !busy && !error && <><p className="rental-muted">{data.total} matching bookings. Pickup/return filters use the operations date; overdue, balance and refunds cover all dates.</p><div className="rental-table-wrap"><table className="rental-table"><thead><tr><th>Booking / customer</th><th>Pickup / return</th><th>Status</th><th>Balance / refund</th><th>Action</th></tr></thead><tbody>{data.rows.map(b => <tr key={b._id}><td><strong>{b.number}</strong><br />{b.customer.name}<br />{b.customer.phone}</td><td>{rentalDate(b.schedule.pickupAt, b.policy.timezone)}<br />{rentalDate(b.schedule.returnDueAt, b.policy.timezone)}</td><td><RentalStatus value={b.status} />{b.overdue && <p className="rental-warning">Return overdue</p>}</td><td>Due {rentalMoney(b.financial.balancePaise)}<br />Refund available {rentalMoney(b.financial.refundablePaise)}</td><td><button type="button" className="rental-button rental-button--secondary" onClick={() => onOpen(b._id)}>Manage {b.number}</button></td></tr>)}</tbody></table>{!data.rows.length && <p>No bookings match these filters.</p>}</div><div className="rental-actions"><button type="button" className="rental-button rental-button--secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous bookings</button><span>Page {data.page} of {Math.max(1, data.pages)}</span><button type="button" className="rental-button rental-button--secondary" disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}>Next bookings</button></div></>}
  </section>;
}
