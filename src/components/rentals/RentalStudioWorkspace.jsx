import { useEffect, useRef, useState } from 'react';
import api from '../../services/api';
import RentalWorkshop from './RentalWorkshop';
import { RentalField, RentalStatus } from './RentalUi';
import { rentalDate, rentalInstant, rentalMoney } from '../../utils/rentals';
function RefundDesk({ base, timezone, busy, onOpen }) {
  const [data, setData] = useState(null), [page, setPage] = useState(1), [overdue, setOverdue] = useState(false), [error, setError] = useState(''), [reload, setReload] = useState(0);
  useEffect(() => { let alive = true; api.get(base + '/refund-queue?page=' + page + '&overdue=' + overdue, { silent: true }).then(value => { if (alive) { setData(value); setError(''); } }).catch(e => { if (alive) setError(e.message); }); return () => { alive = false; }; }, [base, page, overdue, reload]);
  return <section className="rental-card"><h2>Deposit refund desk</h2><p className="rental-muted">The clock starts when a refund becomes eligible after cancellation/expiry or completed return inspection. Pending provider refunds remain visible until processed. Inspection and disputes require owner review.</p>
    <label className="rental-check"><input type="checkbox" checked={overdue} onChange={e => { setOverdue(e.target.checked); setPage(1); }} />Overdue settlements only</label><button className="rental-button rental-button--secondary" disabled={busy} onClick={() => setReload(n => n + 1)}>Refresh refunds</button>
    {error && <p role="alert" className="rental-notice">{error}</p>}{!data && !error && <p role="status">Loading refunds…</p>}
    {data && <><div className="rental-metrics">{[['Pending settlements', data.summary.total], ['Overdue', data.summary.overdue], ['Refund available', rentalMoney(data.summary.refundablePaise)], ['With payment provider', rentalMoney(data.summary.pendingPaise)]].map(([label, value]) => <div key={label} className="rental-card"><span>{label}</span><strong>{value}</strong></div>)}</div>
      {data.rows.map(row => <article className="rental-work-item" key={row._id}><strong>{row.number} · {row.customer}</strong><p>Refundable {rentalMoney(row.refundablePaise)} · Provider pending {rentalMoney(row.pendingPaise)}</p><p className="rental-muted">Deadline {rentalDate(row.dueAt, timezone)} · Waiting {Math.floor(row.ageHours)} hours</p>{row.overdue && <p className="rental-warning">Settlement deadline passed</p>}{row.inspectionPending && <p className="rental-muted">Inspection pending — refund not yet eligible</p>}{row.disputePending && <p className="rental-warning">Open customer dispute — review before settlement</p>}<button className="rental-button rental-button--secondary" disabled={busy} onClick={() => onOpen(row._id)}>Review settlement</button></article>)}
      {!data.rows.length && <p className="rental-muted">No pending refunds in this view.</p>}<div className="rental-actions"><button className="rental-button rental-button--secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous refunds</button><button className="rental-button rental-button--secondary" disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}>Next refunds</button></div>
    </>}
  </section>;
}
function PiecePerformance({ base, timezone, busy, run }) {
  const [data, setData] = useState(null), [page, setPage] = useState(1);
  const [from, setFrom] = useState(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)), [to, setTo] = useState(new Date(Date.now() + 86400000).toISOString().slice(0, 10)), [search, setSearch] = useState('');
  const filters = useRef(null);
  const load = async next => { const query = filters.current || { from, to, search }; const result = await run(() => api.get(base + '/piece-report?' + new URLSearchParams({ from: rentalInstant(query.from + 'T00:00', timezone), to: rentalInstant(query.to + 'T00:00', timezone), search: query.search, page: String(next) }), { silent: true })); if (result) { setData(result); setPage(next); } };
  const exportCsv = () => {
    const cell = value => '"' + String(value ?? '').replace(/^(\s*[=+@-])/, "'$1").replace(/"/g, '""') + '"';
    const rows = [['Physical piece performance — current page only; INR amounts in paise'], ['From', data.from], ['To (exclusive)', data.to], ['Code', 'Label', 'Times rented', 'Rented days', 'Not rented days', 'Rental revenue paise', 'Recorded expense paise', 'Operating contribution paise', 'Purchase cost paise', 'Lifetime recovery percent'], ...data.rows.map(row => [row.code, row.label, row.rentedCount, row.rentedDays.toFixed(2), row.idleDays.toFixed(2), row.rentalRevenuePaise, row.expensesPaise, row.operatingContributionPaise, row.purchaseCostPaise, row.recoveryPercent]), [data.note]];
    const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })), link = document.createElement('a'); link.href = url; link.download = 'rental-piece-performance-page-' + page + '.csv'; link.click(); URL.revokeObjectURL(url);
  };
  return <section className="rental-card"><h2>Physical-piece performance</h2><div className="rental-fields"><RentalField label="Piece report from date" type="date" value={from} onChange={setFrom} /><RentalField label="Piece report to date (exclusive)" type="date" value={to} onChange={setTo} /><RentalField label="Find piece code / label" value={search} onChange={setSearch} /></div><div className="rental-actions"><button className="rental-button" disabled={busy} onClick={() => { filters.current = { from, to, search }; load(1); }}>Generate piece report</button>{data && <button className="rental-button rental-button--secondary" onClick={exportCsv}>Export this report page</button>}</div>
    {data && <><p className="rental-muted">{data.note}</p><div className="rental-table-wrap"><table className="rental-table"><thead><tr><th>Physical piece</th><th>Usage in period</th><th>Period contribution</th><th>Lifetime purchase recovery</th></tr></thead><tbody>{data.rows.map(row => <tr key={row._id}><td><strong>{row.code}</strong><p>{row.label}</p><RentalStatus value={row.status} /></td><td>{row.rentedCount} rentals<p>{row.rentedDays.toFixed(1)} rented days · {row.idleDays.toFixed(1)} not rented days</p></td><td>Rent {rentalMoney(row.rentalRevenuePaise)}<p>Expenses {rentalMoney(row.expensesPaise)}</p><strong>{rentalMoney(row.operatingContributionPaise)}</strong></td><td>Purchase {rentalMoney(row.purchaseCostPaise)}<p>{row.recoveryPercent === null ? 'Purchase cost not recorded' : row.recoveryPercent + '% recovered'}</p>{row.purchaseRecovered && <RentalStatus value="RECOVERED" />}</td></tr>)}</tbody></table></div>{!data.rows.length && <p>No pieces match this report.</p>}<div className="rental-actions"><button className="rental-button rental-button--secondary" disabled={busy || page <= 1} onClick={() => load(page - 1)}>Previous report page</button><span>{data.total} pieces · Page {page}</span><button className="rental-button rental-button--secondary" disabled={busy || page >= data.pages} onClick={() => load(page + 1)}>Next report page</button></div></>}
  </section>;
}
export default function RentalStudioWorkspace({ base, policy, permissions, busy, run, onOpen }) {
  const tools = [
    permissions['inventory.read'] !== false && ['workshop', 'Cleaning & repairs', 'Track preparation, cleaning and repair jobs.'],
    policy.refundDashboardEnabled && permissions['returns.refund'] !== false && ['refunds', 'Deposit refunds', 'Review eligible refunds and overdue settlements.'],
    policy.piecePerformanceEnabled && permissions['reports.read'] !== false && permissions['inventory.cost.read'] === true && ['performance', 'Piece performance', 'Compare usage, income and recorded costs.'],
  ].filter(Boolean);
  const [selected, setSelected] = useState('');
  const active = tools.some(([id]) => id === selected) ? selected : tools[0]?.[0];
  return <div className="rental-studio-stack">
    <section className="rental-card"><h2>Workshop & settlement</h2><p className="rental-muted">Choose the work you need to do. Each tool opens separately.</p><nav className="rental-tool-grid" aria-label="Workshop and settlement tools">{tools.map(([id, title, description]) => <button type="button" key={id} aria-pressed={active === id} disabled={busy} onClick={() => setSelected(id)}><strong>{title}</strong><span>{description}</span></button>)}</nav>{!tools.length && <p>No tools are enabled for your staff access. Ask the store owner to review rental settings.</p>}</section>
    {active === 'workshop' && <RentalWorkshop base={base} policy={policy} permissions={permissions} busy={busy} run={run} />}
    {active === 'refunds' && <RefundDesk base={base} timezone={policy.timezone} busy={busy} onOpen={onOpen} />}
    {active === 'performance' && <PiecePerformance base={base} timezone={policy.timezone} busy={busy} run={run} />}
    <p className="rental-muted">Optional workflows are controlled in Rental settings. Existing jobs remain available even when new job creation is disabled.</p>
  </div>;
}
