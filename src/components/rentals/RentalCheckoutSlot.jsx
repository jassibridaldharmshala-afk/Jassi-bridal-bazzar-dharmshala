import { useEffect, useRef, useState } from 'react';
import api from '../../services/api';
import { rentalUrl } from '../../utils/rentals';
import { rentalSlotLabel } from '../../utils/rentalShopping';

const EMPTY_ROWS = [];
export default function RentalCheckoutSlot({ kind, value, storeSlug, onChange, onStatus }) {
  const title = kind === 'return' ? 'Return' : 'Pickup';
  const day = value?.slice(0, 10) || '', time = value?.slice(11, 16) || '';
  const key = `${storeSlug || ''}:${kind}:${day}`;
  const [state, setState] = useState({ key: '', rows: [], loading: false, error: '' });
  const [retry, setRetry] = useState(0);
  const callbacks = useRef({ onChange, onStatus }); callbacks.current = { onChange, onStatus };
  const current = state.key === key ? state : { rows: EMPTY_ROWS, loading: Boolean(day), error: '' };
  const ready = Boolean(time && current.rows.some(row => row.time === time && row.available));
  useEffect(() => {
    callbacks.current.onStatus?.({ date: day, times: current.rows.filter(row => row.available).map(row => row.time), loading: current.loading, error: current.error });
  }, [day, current.rows, current.loading, current.error]);
  useEffect(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) { setState({ key, rows: [], loading: false, error: '' }); return undefined; }
    let active = true; setState({ key, rows: [], loading: true, error: '' });
    api.get(rentalUrl('/rentals/slots?' + new URLSearchParams({ date: day, kind }), storeSlug), { silent: true, forceRefetch: true }).then(result => {
      if (!Array.isArray(result?.rows)) throw new Error('Shop times could not be loaded.');
      if (active) setState({ key, rows: result.rows, loading: false, error: '' });
    }).catch(error => { if (active) setState({ key, rows: [], loading: false, error: error.details || error.message }); });
    return () => { active = false; };
  }, [day, key, kind, storeSlug, retry]);
  useEffect(() => {
    // Suggest the first real available time only for a new, blank time.
    // An unavailable saved time must be corrected explicitly.
    if (day && !time && state.key === key && !state.loading) {
      const first = state.rows.find(row => row.available);
      if (first) callbacks.current.onChange(day + 'T' + first.time);
    }
  }, [day, time, key, state]);
  const noTimes = day && !current.loading && !current.error && !current.rows.some(row => row.available);
  const invalid = day && time && !current.loading && !current.error && !ready;
  return <section className="rental-checkout-slot" aria-label={title + ' arrangement'}>
    <h3>{title}</h3>
    <div className="rental-checkout-fields">
      <label>{title} date<input type="date" aria-label={title + " date"} value={day} onChange={event => callbacks.current.onChange(event.target.value ? event.target.value + 'T' + time : '')} /></label>
      <label>{title} time<select aria-label={title + " time"} value={ready ? time : ''} disabled={!day || current.loading || !!current.error || !!noTimes} aria-invalid={invalid || noTimes ? true : undefined} onChange={event => callbacks.current.onChange(day + 'T' + event.target.value)}>
        <option value="">{current.loading ? 'Loading times…' : 'Choose a time'}</option>
        {current.rows.map(row => <option key={row.time} value={row.time} disabled={!row.available}>{rentalSlotLabel(row.time)}{row.available ? '' : ' · Unavailable'}</option>)}
      </select></label>
    </div>
    {current.loading && <p className="rental-shopping-hint" role="status">Checking {title.toLowerCase()} times…</p>}
    {current.error && <p role="alert" className="rental-slot-error">Times could not be loaded. <button type="button" className="rental-shopping-link" onClick={() => setRetry(n => n + 1)}>Retry {title.toLowerCase()} times</button></p>}
    {kind === 'pickup' && ready && <div className="rental-slot-pills" aria-label="Available pickup times">{current.rows.filter(row => row.available).slice(0, 3).map(row => <button key={row.time} type="button" aria-pressed={time === row.time} onClick={() => callbacks.current.onChange(day + 'T' + row.time)}>{rentalSlotLabel(row.time)}</button>)}</div>}
    {noTimes && <p role="status" className="rental-slot-error">No {title.toLowerCase()} times are available on this date. Choose another date.</p>}
    {invalid && !noTimes && <p role="status" className="rental-slot-error">Your saved {title.toLowerCase()} time is unavailable. Choose an available time above.</p>}
    <p className="rental-shopping-hint">{kind === 'pickup' ? 'Collect before your occasion.' : 'Return by the selected time.'} Pickup and return days add no rent unless you choose them as use days.</p>
  </section>;
}

