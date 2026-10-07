import { useRef, useState } from 'react';
import api from '../../services/api';
import { RentalField, RentalStatus } from './RentalUi';
import { rentalDate, rentalInstant, rentalOperation } from '../../utils/rentals';
export default function RentalTrialDesk({ booking, policy = booking.policy, base, canWrite, busy, run, onChange }) {
  const [note, setNote] = useState(''), operation = useRef(rentalOperation());
  const [schedule, setSchedule] = useState({ at: '', minutes: policy.trialMinutes || 60, assetIds: booking.allocations?.map(a => String(a.assetId)) || [], note: '' });
  if (!booking.trial?.at && !canWrite) return null;
  const status = booking.trial?.status || 'SCHEDULED';
  const transitions = { SCHEDULED: [['ATTENDED', 'Mark trial attended'], ['NO_SHOW', 'Record trial no-show'], ['CANCELLED', 'Cancel trial']], ATTENDED: [['FITTING_COMPLETED', 'Complete fitting']], REVIEW: [['CANCELLED', 'Cancel trial']] };
  const update = async next => {
    const result = await run(() => api.post(base + '/bookings/' + booking._id + '/operation', { operationId: operation.current, revision: booking.revision, action: 'TRIAL_UPDATE', status: next, note }, { silent: true }));
    if (result) { onChange(result); setNote(''); operation.current = rentalOperation(); }
  };
  const scheduleTrial = async () => {
    const result = await run(() => api.post(base + '/bookings/' + booking._id + '/operation', { ...schedule, at: rentalInstant(schedule.at, booking.policy.timezone), action: 'TRIAL', revision: booking.revision, operationId: operation.current }, { silent: true }));
    if (result) { onChange(result); operation.current = rentalOperation(); setSchedule(f => ({ ...f, at: '', note: '' })); }
  };
  const changeSchedule = (key, value) => { operation.current = rentalOperation(); setSchedule(f => ({ ...f, [key]: value })); };
  return <section className="rental-card"><h2>Trial & fitting</h2>{booking.trial?.at && <><RentalStatus value={status} /><p>{rentalDate(booking.trial.at, booking.policy.timezone)}{booking.trial.until && ' – ' + rentalDate(booking.trial.until, booking.policy.timezone)}</p><p className="rental-muted">{booking.trial.notes}</p></>}<p className="rental-muted">Trial pieces are reserved separately. Physically ready pieces are required to record attendance. Changing rental dates/pieces requires this trial to be completed or cancelled first.</p>
    {canWrite && booking.trial?.at && transitions[status] && <fieldset disabled={busy}><RentalField label="Trial outcome note" multiline value={note} onChange={v => { setNote(v); operation.current = rentalOperation(); }} /><div className="rental-actions">{transitions[status].map(([next, label]) => <button key={next} type="button" className="rental-button rental-button--secondary" disabled={!note} onClick={() => update(next)}>{label}</button>)}</div></fieldset>}
    {canWrite && ['HELD', 'CONFIRMED', 'PREPARING'].includes(booking.status) && <details><summary>Schedule / reschedule a trial</summary><fieldset disabled={busy}><div className="rental-fields"><RentalField label="Reserved trial date/time" type="datetime-local" value={schedule.at} onChange={v => changeSchedule('at', v)} /><RentalField label="Reserved trial duration (minutes)" type="number" min="15" max="240" value={schedule.minutes} onChange={v => changeSchedule('minutes', Number(v))} /></div><h3>Choose physical trial pieces</h3>{booking.allocations.map(piece => <label key={piece.assetId} className="rental-check"><input type="checkbox" checked={schedule.assetIds.includes(String(piece.assetId))} onChange={e => changeSchedule('assetIds', e.target.checked ? [...schedule.assetIds, String(piece.assetId)] : schedule.assetIds.filter(id => id !== String(piece.assetId)))} />{piece.code} · {piece.label}</label>)}<RentalField label="Appointment note (shared with customer)" multiline value={schedule.note} onChange={v => changeSchedule('note', v)} /><button type="button" className="rental-button" disabled={!schedule.at || !schedule.assetIds.length} onClick={scheduleTrial}>Reserve trial pieces & slot</button></fieldset></details>}
  </section>;
}
