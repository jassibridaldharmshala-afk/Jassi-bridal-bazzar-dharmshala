import { useState } from 'react';
import api from '../../services/api';
import { RentalField } from './RentalUi';
import { localDateTime, rentalDate, rentalInstant, rentalMoney, rentalUrl } from '../../utils/rentals';
export default function RentalDateSearch({ base, storeSlug, policy, draft, onChange, onSearch, loading }) {
  const [slots, setSlots] = useState(null), [error, setError] = useState(''), [slotLoading, setSlotLoading] = useState(false);
  const slotList = async field => {
    setError(''); setSlotLoading(true);
    try { if (!draft[field]) throw new Error('Choose the date first.'); const value = await api.get(rentalUrl(base + '/slots?date=' + encodeURIComponent(draft[field].slice(0, 10)), storeSlug), { silent: true }); setSlots({ field, date: draft[field].slice(0, 10), ...value }); }
    catch (e) { setError(e.details || e.message); } finally { setSlotLoading(false); }
  };
  const search = () => { try { setError(''); onSearch({ pickupAt: rentalInstant(draft.pickupAt, policy.timezone), returnDueAt: rentalInstant(draft.returnDueAt, policy.timezone), deliveryMode: draft.deliveryMode || policy.deliveryModes[0] }); } catch (e) { setError(e.message); } };
  return <section className="rental-card rental-date-search"><h2>Start with your occasion dates</h2><p className="rental-muted">Choose pickup and return in {policy.timezone}. Availability includes preparation/cleaning buffers; final reservation is rechecked before payment.</p><fieldset disabled={loading || slotLoading}><div className="rental-fields"><RentalField label="Search pickup / delivery date" type="datetime-local" value={draft.pickupAt || ''} onChange={v => { onChange('pickupAt', v); setSlots(null); }} /><RentalField label="Search return deadline" type="datetime-local" value={draft.returnDueAt || ''} onChange={v => { onChange('returnDueAt', v); setSlots(null); }} /><RentalField label="Date search delivery method"><select value={draft.deliveryMode || policy.deliveryModes[0]} onChange={e => onChange('deliveryMode', e.target.value)}>{policy.deliveryModes.map(value => <option key={value} value={value}>{value.replace(/_/g, ' ')}</option>)}</select></RentalField></div><div className="rental-actions"><button type="button" className="rental-button" disabled={!draft.pickupAt || !draft.returnDueAt} onClick={search}>{loading ? 'Checking availability…' : 'Find rentals for these dates'}</button><button type="button" className="rental-button rental-button--secondary" onClick={() => slotList('pickupAt')}>View pickup slots</button><button type="button" className="rental-button rental-button--secondary" onClick={() => slotList('returnDueAt')}>View return slots</button></div></fieldset>{error && <p role="alert" className="rental-notice">{error}</p>}
    {slots && <div className="rental-slot-list" aria-label="Available shop slots"><p className="rental-muted">{slots.note}</p>{slots.rows.map(slot => <button type="button" key={slot.at} disabled={!slot.available || loading} className="rental-button rental-button--secondary" onClick={() => { onChange(slots.field, localDateTime(slot.at, policy.timezone)); setSlots(null); }}>{slot.time} · {slot.available ? slot.capacityLeft + ' places' : 'Unavailable'}</button>)}{!slots.rows.length && <p className="rental-muted">The shop is closed or has no slots on this date.</p>}</div>}
  </section>;
}
export function RentalAvailabilityHints({ rows = [], schedule, timezone, base, storeSlug, onDates, onChoose }) {
  const [suggestions, setSuggestions] = useState({}), [busyId, setBusyId] = useState(''), [error, setError] = useState('');
  const lookup = async row => {
    if (busyId) return; setBusyId(row._id); setError('');
    try { const value = await api.get(rentalUrl(base + '/availability/' + row._id + '/alternatives?' + new URLSearchParams(schedule), storeSlug), { silent: true }); setSuggestions(old => ({ ...old, [row._id]: value })); }
    catch (e) { setError(e.details || e.message); } finally { setBusyId(''); }
  };
  if (!schedule) return null;
  return <section className="rental-card"><h3>Availability for your selected dates</h3><p className="rental-muted">Each indicator checks one set. Larger quantities and combined outfits/accessories are checked together when you review the booking.</p>{error && <p role="alert" className="rental-notice">{error}</p>}
    {rows.map(row => <article key={row._id} className="rental-work-item"><strong>{row.title}</strong><p className={row.availability === 'AVAILABLE' ? 'rental-available' : 'rental-muted'}>{row.availability === 'AVAILABLE' ? 'One set available for these dates' : 'Unavailable for these dates'}</p>{row.availability === 'UNAVAILABLE' && <button type="button" disabled={!!busyId} className="rental-button rental-button--secondary" onClick={() => lookup(row)}>{busyId === row._id ? 'Finding alternatives…' : 'Find other dates / matching looks'}</button>}
      {suggestions[row._id] && <div><p className="rental-muted">{suggestions[row._id].note}</p>{suggestions[row._id].nextDates.map(next => <button key={next.schedule.pickupAt} type="button" className="rental-suggestion" onClick={() => onDates(next.schedule)}>{rentalDate(next.schedule.pickupAt, timezone)} – {rentalDate(next.schedule.returnDueAt, timezone)} · {rentalMoney(next.totalPaise)}</button>)}{suggestions[row._id].matches.map(match => <button key={match._id} type="button" className="rental-suggestion" onClick={() => onChoose(match, row._id)}>{match.title} · {match.size} · {rentalMoney(match.totalPaise)}</button>)}{!suggestions[row._id].nextDates.length && !suggestions[row._id].matches.length && <p className="rental-muted">No matching suggestions found in the next 14 days. Try other dates or request an availability notification.</p>}</div>}
    </article>)}
  </section>;
}
