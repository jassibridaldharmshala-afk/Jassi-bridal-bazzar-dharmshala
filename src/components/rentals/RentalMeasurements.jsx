import { useEffect, useRef, useState } from 'react';
import api from '../../services/api';
import { RentalField } from './RentalUi';
import { localDateTime, rentalDate, rentalInstant, rentalOperation } from '../../utils/rentals';
const fields = [['bust', 'Bust'], ['chest', 'Chest'], ['waist', 'Waist'], ['hips', 'Hips'], ['shoulder', 'Shoulder'], ['sleeve', 'Sleeve length'], ['armhole', 'Armhole'], ['blouseLength', 'Blouse length'], ['outfitLength', 'Outfit length'], ['bottomLength', 'Bottom length']];
export default function RentalMeasurements({ booking, base, enabled, busy, run, onChange }) {
  const [profile, setProfile] = useState(null), [loaded, setLoaded] = useState(false), [error, setError] = useState(''), [reload, setReload] = useState(0);
  const [form, setForm] = useState({ unit: 'in', values: {}, measuredAt: localDateTime(Date.now(), booking.policy.timezone), notes: '', consent: false, customerApproved: false });
  const operation = useRef(rentalOperation());
  useEffect(() => {
    let alive = true;
    api.get(base + '/bookings/' + booking._id + '/measurements', { silent: true }).then(value => {
      if (!alive) return; setProfile(value.profile); setLoaded(true); setError('');
      const latest = value.profile?.versions?.at(-1);
      if (latest) setForm(f => ({ ...f, unit: latest.unit, values: latest.values, measuredAt: localDateTime(latest.measuredAt, booking.policy.timezone), notes: latest.notes, consent: false, customerApproved: false }));
    }).catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [base, booking._id, booking.policy.timezone, reload]);
  const change = (key, value) => { operation.current = rentalOperation(); setForm(f => ({ ...f, [key]: value })); };
  const save = async status => {
    const result = await run(() => api.post(base + '/bookings/' + booking._id + '/measurements', { ...form, status, revision: profile?.revision || 0, operationId: operation.current,
      values: Object.fromEntries(Object.entries(form.values).filter(([, value]) => value !== '').map(([key, value]) => [key, Number(value)])), measuredAt: rentalInstant(form.measuredAt, booking.policy.timezone) }, { silent: true }));
    if (result) { setProfile(result.profile); onChange(result.booking); operation.current = rentalOperation(); setForm(f => ({ ...f, consent: false, customerApproved: false })); }
  };
  const editable = enabled && ['CONFIRMED', 'PREPARING'].includes(booking.status);
  return <section className="rental-card"><h2>Private measurement profile</h2><p className="rental-muted">Customer body measurements are not product size-chart measurements. Review older measurements before reuse; only explicitly approved revisions are attached to this booking.</p>
    {error && <p role="alert" className="rental-notice">{error}<button className="rental-button rental-button--secondary" onClick={() => setReload(n => n + 1)}>Reload measurements</button></p>}
    {!loaded && !error && <p role="status">Loading private measurements…</p>}
    {loaded && <><fieldset disabled={busy || !editable}><div className="rental-fields"><RentalField label="Measurement unit"><select value={form.unit} onChange={e => change('unit', e.target.value)}><option value="in">Inches</option><option value="cm">Centimetres</option></select></RentalField><RentalField label="Measured date/time" type="datetime-local" value={form.measuredAt} onChange={v => change('measuredAt', v)} />{fields.map(([key, label]) => <RentalField key={key} label={label} type="number" min="0.01" step="0.01" value={form.values[key] ?? ''} onChange={v => change('values', { ...form.values, [key]: v })} />)}</div>
      <RentalField label="Private fitting notes" multiline maxLength="1000" value={form.notes} onChange={v => change('notes', v)} />
      <label className="rental-check"><input type="checkbox" checked={form.consent} onChange={e => change('consent', e.target.checked)} />Customer consent to store these private measurements is recorded</label><label className="rental-check"><input type="checkbox" checked={form.customerApproved} onChange={e => change('customerApproved', e.target.checked)} />Customer explicitly approved this fitting revision</label>
      <div className="rental-actions"><button type="button" className="rental-button rental-button--secondary" disabled={!form.consent} onClick={() => save('DRAFT')}>Save measurement draft</button><button type="button" className="rental-button" disabled={!form.consent || !form.customerApproved} onClick={() => save('APPROVED')}>Approve measurement revision</button></div></fieldset>
      {!editable && <p className="rental-muted">New measurement revisions require the module to be enabled and the booking to be confirmed/preparing.</p>}
      {booking.measurementSnapshot && <p className="rental-notice">Booking uses approved revision {booking.measurementSnapshot.number} ({booking.measurementSnapshot.unit}).</p>}
      <details><summary>Measurement revision history ({profile?.versions?.length || 0})</summary>{[...(profile?.versions || [])].reverse().map(version => <article key={version.number} className="rental-work-item"><strong>Revision {version.number} · {version.status}</strong><p className="rental-muted">{rentalDate(version.measuredAt, booking.policy.timezone)} · {version.unit}</p><p>{Object.entries(version.values).map(([key, value]) => key + ': ' + value).join(' · ')}</p></article>)}</details>
    </>}
  </section>;
}
