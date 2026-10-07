import { useEffect, useRef, useState } from 'react';
import api from '../../services/api';
import { RentalField, RentalStatus } from './RentalUi';
import { localDateTime, rentalDate, rentalInstant, rentalMoney, rentalOperation } from '../../utils/rentals';
import RentalAssetPicker from './RentalAssetPicker';
function WorkItem({ task, base, timezone, costs, canWrite, busy, run, onRefresh }) {
  const [status, setStatus] = useState(task.status === 'OPEN' ? 'IN_PROGRESS' : 'COMPLETED'), [note, setNote] = useState(''), [verified, setVerified] = useState(false), [cost, setCost] = useState(String((task.actualCostPaise || 0) / 100));
  const operation = useRef(rentalOperation());
  const choices = { OPEN: ['IN_PROGRESS', 'CANCELLED'], IN_PROGRESS: ['COMPLETED', ...(task.type === 'ALTERATION' ? ['AWAITING_FITTING'] : []), 'CANCELLED'], AWAITING_FITTING: ['COMPLETED', 'IN_PROGRESS', 'CANCELLED'] }[task.status];
  const change = callback => value => { operation.current = rentalOperation(); callback(value); };
  const save = async () => {
    const result = await run(() => api.post(base + '/tasks/' + task._id, { operationId: operation.current, revision: task.revision, status, note, verified, fittingApproved: verified,
      ...(costs ? { actualCostPaise: Math.round(Number(cost) * 100) } : {}) }, { silent: true }));
    if (result) onRefresh();
  };
  return <article className="rental-work-item"><div className="rental-work-item__heading"><strong>{task.piece?.code || task.assetId} · {task.type}</strong><RentalStatus value={task.status} /></div><p>{task.instructions}</p><p className="rental-muted">{task.assignee} · Due {rentalDate(task.dueAt, timezone)}</p>{task.overdue && <p className="rental-warning">Overdue work — review future booking readiness</p>}{costs && <p className="rental-muted">Estimated {rentalMoney(task.estimatedCostPaise)} · Recorded actual {rentalMoney(task.actualCostPaise)}</p>}
    {canWrite && choices && <fieldset disabled={busy}><div className="rental-fields"><RentalField label={'Next status for ' + (task.piece?.code || task._id)}><select value={status} onChange={e => change(setStatus)(e.target.value)}>{choices.map(value => <option key={value}>{value}</option>)}</select></RentalField>{costs && <RentalField label={'Actual incurred cost for ' + (task.piece?.code || task._id)} type="number" min="0" step="0.01" value={cost} onChange={change(setCost)} />}</div><RentalField label={'Work update note for ' + (task.piece?.code || task._id)} multiline value={note} onChange={change(setNote)} />{status === 'COMPLETED' && <label className="rental-check"><input type="checkbox" checked={verified} onChange={e => change(setVerified)(e.target.checked)} />{task.type === 'ALTERATION' ? 'Fitting explicitly approved by customer' : 'Completed cleaning/repair physically verified'}</label>}<button type="button" className="rental-button" disabled={!note || (status === 'COMPLETED' && !verified)} onClick={save}>Update workshop job</button></fieldset>}
    <details><summary>Work history</summary>{(task.events || []).map((event, index) => <p key={index} className="rental-muted">{event.type} · {rentalDate(event.at, timezone)} · {event.note}</p>)}</details>
  </article>;
}
export default function RentalWorkshop({ base, booking, policy, permissions = {}, busy, run, onBookingChange }) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [page, setPage] = useState(1), [status, setStatus] = useState(''), [reload, setReload] = useState(0);
  const [form, setForm] = useState({ type: booking && policy.tailoringEnabled ? 'ALTERATION' : 'CLEANING', assetId: '', assignee: '', instructions: '', dueAt: localDateTime(Date.now() + 86400000, policy.timezone), estimate: '' });
  const operation = useRef(rentalOperation()), canWrite = permissions['inventory.write'] !== false, costs = permissions['inventory.cost.read'] === true;
  const bookingId = booking?._id;
  useEffect(() => { let alive = true; api.get(base + '/tasks?page=' + page + '&status=' + status + (bookingId ? '&bookingId=' + bookingId : ''), { silent: true }).then(value => { if (alive) { setData(value); setError(''); } }).catch(e => { if (alive) setError(e.message); }); return () => { alive = false; }; }, [base, bookingId, page, status, reload]);
  const refresh = async () => { setReload(n => n + 1); try { if (booking && onBookingChange) onBookingChange(await api.get(base + '/bookings/' + booking._id, { silent: true })); } catch (e) { setError('Work saved; reload the booking to refresh its status. ' + e.message); } };
  const change = (key, value) => { operation.current = rentalOperation(); setForm(f => ({ ...f, [key]: value })); };
  const create = async () => {
    const result = await run(() => api.post(base + '/tasks', { operationId: operation.current, type: form.type, assetId: form.assetId, assignee: form.assignee, instructions: form.instructions,
      dueAt: rentalInstant(form.dueAt, policy.timezone), ...(booking ? { bookingId: booking._id } : {}), ...(costs ? { estimatedCostPaise: Math.round(Number(form.estimate || 0) * 100) } : {}) }, { silent: true }));
    if (result) { operation.current = rentalOperation(); setForm(f => ({ ...f, assetId: '', instructions: '', estimate: '' })); await refresh(); }
  };
  const types = [...(booking && policy.tailoringEnabled ? ['ALTERATION'] : []), ...(policy.maintenanceTasksEnabled ? ['CLEANING', 'REPAIR'] : [])];
  return <section className="rental-card"><h2>Workshop task board</h2><p className="rental-muted">Jobs block piece readiness until resolved. Returned pieces still require the normal inspection/release operation; completing work never bypasses deposit settlement.</p>
    {error && <p role="alert" className="rental-notice">{error}<button className="rental-button rental-button--secondary" onClick={() => setReload(n => n + 1)}>Reload workshop</button></p>}
    {canWrite && types.length > 0 && <details><summary>Create workshop job</summary><fieldset disabled={busy}><div className="rental-fields"><RentalField label="Work type"><select value={form.type} onChange={e => change('type', e.target.value)}>{types.map(value => <option key={value}>{value}</option>)}</select></RentalField>
      {booking ? <RentalField label="Workshop piece"><select value={form.assetId} onChange={e => change('assetId', e.target.value)}><option value="">Choose physical piece</option>{booking.allocations.map(piece => <option key={piece.assetId} value={piece.assetId}>{piece.code}</option>)}</select></RentalField> : <RentalAssetPicker base={base} value={form.assetId} onChange={value => change('assetId', value)} />}
      <RentalField label="Assigned person / vendor" value={form.assignee} onChange={v => change('assignee', v)} maxLength="120" /><RentalField label="Expected ready date/time" type="datetime-local" value={form.dueAt} onChange={v => change('dueAt', v)} />{costs && <RentalField label="Estimated work cost (₹)" type="number" min="0" step="0.01" value={form.estimate} onChange={v => change('estimate', v)} />}</div><RentalField label="Required work / alteration instructions" multiline value={form.instructions} onChange={v => change('instructions', v)} maxLength="2000" /><button className="rental-button" type="button" disabled={!form.assetId || !form.assignee || !form.instructions} onClick={create}>Assign workshop job</button></fieldset></details>}
    <RentalField label="Workshop status filter"><select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">All jobs</option>{['OPEN', 'IN_PROGRESS', 'AWAITING_FITTING', 'COMPLETED', 'CANCELLED'].map(value => <option key={value}>{value}</option>)}</select></RentalField>
    {!data && !error && <p role="status">Loading workshop jobs…</p>}{data?.rows.map(task => <WorkItem key={task._id + ':' + task.revision} task={task} base={base} timezone={policy.timezone} costs={costs} canWrite={canWrite} busy={busy} run={run} onRefresh={refresh} />)}{data && !data.rows.length && <p className="rental-muted">No workshop jobs match this view.</p>}
    {data && <div className="rental-actions"><button className="rental-button rental-button--secondary" disabled={page <= 1 || busy} onClick={() => setPage(p => p - 1)}>Previous jobs</button><span>Page {page} · {data.total} jobs</span><button className="rental-button rental-button--secondary" disabled={page >= data.pages || busy} onClick={() => setPage(p => p + 1)}>Next jobs</button></div>}
  </section>;
}
