import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../services/api';
import { localDateTime, rentalDate, rentalOperation } from '../../utils/rentals';
import { RentalField, RentalStatus } from './RentalUi';
import { blankRentalAddress } from '../../utils/rentalDetails';
const addressFields = [['fullName', 'Customer contact'], ['mobile', 'Customer mobile (10 digits)'], ['houseNo', 'House / building'], ['area', 'Area / street'], ['city', 'City'], ['state', 'State'], ['pincode', 'PIN code']];
export default function RentalCourierPanel({ booking, base, canWrite, owner, onChange }) {
  const [rows, setRows] = useState([]), [direction, setDirection] = useState('outbound'), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [form, setForm] = useState({ address: { fullName: booking.customer.name, mobile: booking.customer.phone.replace(/^\+?91(?=\d{10}$)/, ''), houseNo: '', area: '', city: '', state: '', pincode: '' }, date: localDateTime(booking.schedule.pickupAt, 'Asia/Kolkata').slice(0, 10), time: '10:00', closeTime: '18:00', declaredValue: '', awb: '', note: '', confirmNotCreated: false, confirmOperationNotApplied: false, pickupToken: '' });
  const alive = useRef(true), lock = useRef(false), generation = useRef(0), operation = useRef(rentalOperation());
  const url = `${base}/bookings/${booking._id}`;
  const savedAddress = booking.bookingDetails?.[direction === 'outbound' ? 'deliveryAddress' : 'collectionAddress'];
  const addressVersion = JSON.stringify(savedAddress || null);
  useEffect(() => {
    setForm(f => ({ ...f, address: blankRentalAddress(booking.customer, JSON.parse(addressVersion) || {}), date: localDateTime(direction === 'outbound' ? booking.schedule.pickupAt : booking.schedule.returnDueAt, 'Asia/Kolkata').slice(0, 10) }));
    operation.current = rentalOperation();
  }, [direction, addressVersion, booking.customer, booking.schedule.pickupAt, booking.schedule.returnDueAt]);
  const load = useCallback(async () => { const request = ++generation.current; const value = await api.get(`${url}/couriers`, { silent: true, forceRefetch: true }); if (alive.current && request === generation.current) setRows(Array.isArray(value) ? value : []); }, [url]);
  useEffect(() => { alive.current = true; load().catch(e => { if (alive.current) setError(e.details || e.message); }); return () => { alive.current = false; generation.current += 1; }; }, [load]);
  const update = (key, value) => { setForm(f => ({ ...f, [key]: value })); operation.current = rentalOperation(); };
  const run = async task => {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try { await task(); } catch (e) { if (alive.current) { setError(e.details || e.message); await load().catch(() => {}); } }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  };
  const row = rows.find(r => r.direction === direction);
  const command = action => {
    if (['book', 'pickup', 'cancel'].includes(action) && !window.confirm(`${action === 'cancel' ? 'Cancel this real carrier parcel?' : 'Submit this real carrier request? Carrier charges may apply.'} Physical handover/return still needs the rental checklist.`)) return;
    run(async () => {
      await api.post(`${url}/courier/${direction}/${action}`, { ...form, declaredValuePaise: Math.round(Number(form.declaredValue) * 100), revision: booking.revision, operationId: operation.current }, { silent: true });
      const current = await api.get(url, { silent: true, forceRefetch: true });
      if (!alive.current) return;
      onChange(current); operation.current = rentalOperation(); await load();
    });
  };
  const label = () => run(async () => {
    const value = await api.get(`${url}/courier/${direction}/label`, { silent: true });
    if (!alive.current) return;
    const bytes = Uint8Array.from(window.atob(value.base64), c => c.charCodeAt(0));
    const link = document.createElement('a'), objectUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    link.href = objectUrl; link.download = `${booking.number}-${direction}-label.pdf`; link.click(); URL.revokeObjectURL(objectUrl);
  });
  const uncertain = row?.status === 'REVIEW' || !!row?.operation;
  return <section className="rental-card"><h3>Connected rental courier · outgoing & return</h3>
    <p className="rental-muted">Optional: enable in Rental settings and connect a provider in Delivery settings. Manual/self delivery remains available via Outgoing / return tracking. Outbound needs READY + full payment; reverse pickup needs an active rental. Courier movement never marks a physical piece returned.</p>
    {error && <p role="alert" className="rental-notice">{error}</p>}
    <fieldset disabled={busy}><RentalField label="Connected courier journey"><select value={direction} onChange={e => { setDirection(e.target.value); operation.current = rentalOperation(); }}><option value="outbound">Outgoing delivery</option><option value="inbound">Reverse return collection</option></select></RentalField>
      {row && <div><RentalStatus value={row.status || 'BOOKING'} /><p>{row.courierName || row.provider} · AWB {row.awb || 'not confirmed'}</p><p className="rental-muted">{row.providerStatus}{row.expectedDeliveryAt && ` · Expected ${rentalDate(row.expectedDeliveryAt, booking.policy.timezone)}`}</p>{row.lastError && <p className="rental-notice">{row.lastError}</p>}{row.operation && <p className="rental-muted">Operation pending. Refresh first; do not submit again. Interrupted commands become review-only after five minutes.</p>}</div>}
      {canWrite && <><h4>Customer address (destination or return pickup)</h4>{savedAddress && <p className="rental-muted">Using this journey’s saved booking address. Change approved booking details first if the destination / collection address is different.</p>}<div className="rental-fields">{addressFields.map(([key, label]) => <RentalField key={key} label={label} maxLength="120" disabled={!!savedAddress} value={form.address[key]} onChange={value => update('address', { ...form.address, [key]: value })} />)}<RentalField label="Declared physical goods value (₹; not rental fee)" type="number" min="0.01" step="0.01" value={form.declaredValue} onChange={v => update('declaredValue', v)} />{[['date', 'Carrier pickup date (India time)', 'date'], ['time', 'Carrier pickup time', 'time'], ['closeTime', 'Pickup location closes', 'time']].map(([key, label, type]) => <RentalField key={key} label={label} type={type} value={form[key]} onChange={v => update(key, v)} />)}</div>
        <p className="rental-muted">Parcel weight/dimensions use Delivery settings defaults. Validate packaging there before booking. Outgoing pickup must be within preparation time and before the promised customer delivery.</p>
        <div className="rental-actions"><button type="button" className="rental-button" disabled={uncertain || (row?.awb && row.status !== 'CANCELLED')} onClick={() => command('book')}>Book connected courier</button><button type="button" className="rental-button rental-button--secondary" disabled={uncertain || !row?.awb} onClick={() => command('pickup')}>Request carrier pickup</button><button type="button" className="rental-button rental-button--secondary" disabled={uncertain || !row?.awb} onClick={() => command('cancel')}>Cancel carrier leg</button><button type="button" className="rental-button rental-button--secondary" disabled={!row?.awb || !!row?.operation} onClick={() => command('sync')}>Sync carrier tracking</button></div>
        {owner && row && uncertain && !row.operation && <><h4>Owner-only carrier reconciliation</h4><p className="rental-muted">Check the carrier dashboard first. Enter the confirmed AWB or explicitly confirm that no booking exists. For an uncertain pickup/cancel, record its real result before any repeat.</p><RentalField label="Carrier-confirmed AWB" value={form.awb} onChange={v => update('awb', v)} /><RentalField label="Carrier-confirmed pickup token (if created)" value={form.pickupToken} onChange={v => update('pickupToken', v)} /><RentalField label="Carrier dashboard review note" value={form.note} onChange={v => update('note', v)} /><label className="rental-check"><input type="checkbox" checked={form.confirmNotCreated} onChange={e => update('confirmNotCreated', e.target.checked)} />I checked: no shipment booking was created (only without AWB)</label><label className="rental-check"><input type="checkbox" checked={form.confirmOperationNotApplied} onChange={e => update('confirmOperationNotApplied', e.target.checked)} />I checked: the uncertain pickup/cancellation was not applied</label><button type="button" className="rental-button" disabled={!form.note} onClick={() => command('reconcile')}>Reconcile verified carrier outcome</button></>}
      </>}
      <div className="rental-actions">{row?.awb && <button type="button" className="rental-button rental-button--secondary" onClick={label}>Download private carrier label</button>}<button type="button" className="rental-button rental-button--secondary" onClick={() => run(load)}>Refresh courier leg</button></div>
    </fieldset>
  </section>;
}
