import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Download, Package, RefreshCw, Truck } from 'lucide-react';
import api from '../../services/api';
import ManualShipmentForm from './ManualShipmentForm';

const human = value => String(value || 'WAITING').replaceAll('_', ' ').toLowerCase().replace(/^./, c => c.toUpperCase());
const providerName = value => ({ bluedart: 'Blue Dart', shiprocket: 'Shiprocket', delhivery: 'Delhivery', xpressbees: 'Xpressbees', manual: 'Manual courier' }[value] || 'Courier');
const inputClass = 'admin-field__control w-full min-w-0';
export default function ShipmentPanel({ orderId, order, returnId, replacement = false, onChanged, onManualSave, saving = false, apiBase = '/admin' }) {
  const reverse = Boolean(returnId && !replacement);
  const base = returnId
    ? `${apiBase}/returns/${returnId}/${replacement ? 'replacement-delivery' : 'delivery'}`
    : `${apiBase}/orders/${orderId}/delivery`;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [parcel, setParcel] = useState({ weightKg: '', lengthCm: '', widthCm: '', heightCm: '' });
  const [slot, setSlot] = useState({ date: '', time: '10:00', closeTime: '18:00' });
  const [checked, setChecked] = useState(false);
  const [cancelConfirmed, setCancelConfirmed] = useState(false);
  const [pickupToken, setPickupToken] = useState('');
  const [carrierConfirmed, setCarrierConfirmed] = useState(false);
  const [confirmedNoRequest, setConfirmedNoRequest] = useState(false);
  const [exceptionForm, setExceptionForm] = useState({ action: 'CONTACTED_CUSTOMER', note: '', reference: '' });
  const generation = useRef(0);
  const readVersion = useRef(0);
  const lock = useRef(false);
  const load = useCallback(async (refresh = false) => {
    const version = generation.current;
    const request = ++readVersion.current;
    try {
      const result = await api.get(`${base}${refresh ? '?refresh=1' : ''}`, { silent: true, cache: 'no-store' });
      if (version !== generation.current || request !== readVersion.current) return;
      setData(result); setError(result.warning || '');
      setParcel(current => Object.values(current).some(Boolean) ? current : result.shipment?.parcel || result.parcel || current);
    } catch (e) { if (version === generation.current && request === readVersion.current) setError(e.message); }
  }, [base]);
  useEffect(() => {
    generation.current += 1; setData(null); setMessage(''); setError(''); setChecked(false); setCancelConfirmed(false); setCarrierConfirmed(false); setConfirmedNoRequest(false); setPickupToken(''); setExceptionForm({ action: 'CONTACTED_CUSTOMER', note: '', reference: '' });
    setParcel({ weightKg: '', lengthCm: '', widthCm: '', heightCm: '' });
    load();
    return () => { generation.current += 1; };
  }, [load]);
  useEffect(() => { if (order?.revision !== undefined) load(); }, [order?.revision, load]);
  const act = async (action, extra = {}) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setMessage('');
    const version = generation.current;
    try {
      await api.post(`${base}/${action}`, { ...slot, parcel, pickupToken, confirmedWithCarrier: carrierConfirmed, confirmedNoRequest, ...extra });
      if (version !== generation.current) return;
      setMessage({ book: 'Shipment created. Download the label, attach it to your packed parcel and follow the confirmed pickup status.', pickup: 'Pickup request confirmed by the courier.', cancel: 'Courier shipment cancelled. The order and payment remain available to manage separately.', exception: 'Delivery issue follow-up saved. Refresh tracking after the courier processes the request.', reconcile: 'Booking outcome checked.' }[action]);
      if (action === 'exception') setExceptionForm(current => ({ ...current, note: '', reference: '' }));
      await load(); onChanged?.();
    } catch (e) { if (version === generation.current) { await load(); setError(e.message); } }
    finally { lock.current = false; if (version === generation.current) setBusy(false); }
  };
  const download = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const file = await api.get(`${base}/label`, { cache: 'no-store' });
      const bytes = Uint8Array.from(atob(file.base64), c => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      const a = document.createElement('a'); a.href = url; a.download = file.filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      setMessage('Shipping label downloaded. Open the PDF and print at actual size.');
    } catch (e) { setError(e.message); }
    finally { lock.current = false; setBusy(false); }
  };
  const shipment = data?.shipment;
  const uncertain = ['UNKNOWN', 'BOOKING'].includes(shipment?.bookingState) || !!shipment?.operation;
  const manualSaved = (!shipment?.provider || shipment.provider === 'manual') && Boolean(shipment?.manualConfiguredAt || shipment?.fulfillmentMode === 'SELF' || shipment?.courierName || shipment?.trackingNumber || shipment?.awb || shipment?.deliveryReference);
  const existingCarrierRequest = Boolean(shipment?.awb || uncertain || manualSaved);
  const connection = existingCarrierRequest ? data?.readiness : data?.selectedProvider || data?.readiness;
  const activeProvider = existingCarrierRequest ? shipment?.provider || 'manual' : connection?.name || shipment?.provider || 'manual';
  const carrier = existingCarrierRequest && shipment?.courierName ? shipment.courierName : connection?.label || providerName(activeProvider);
  const integrated = activeProvider !== 'manual';
  const deliveryIsCurrent = !order || (data?.order?.revision !== undefined && Number(data.order.revision) >= Number(order.revision || 0));
  const manualOrder = order ? { ...order, ...(deliveryIsCurrent ? data?.order : {}), shipment: deliveryIsCurrent ? shipment : order.shipment || shipment } : data?.order;
  const selfDelivery = !integrated && shipment?.fulfillmentMode === 'SELF';
  const canEditManual = !returnId && !integrated && manualOrder && ['Confirmed', 'Packed', 'Shipped', 'Out for Delivery'].includes(manualOrder.orderStatus) && !['CANCELLED', 'RETURNED', 'DELIVERED'].includes(shipment?.status);
  const saveManual = async body => {
    if (lock.current || saving) return false;
    lock.current = true; setBusy(true); setError(''); setMessage('');
    const version = generation.current;
    try {
      const result = onManualSave ? await onManualSave(body) : await api.put(`${apiBase}/orders/${orderId}/shipment`, body);
      if (result === false || version !== generation.current) return false;
      await load();
      if (!onManualSave) await onChanged?.();
      return true;
    } catch (e) {
      if (version === generation.current && e.status === 409) { await load(); await onChanged?.(); }
      throw e;
    } finally { lock.current = false; if (version === generation.current) setBusy(false); }
  };
  const canBook = integrated && !shipment?.awb && !uncertain && shipment?.bookingState !== 'CANCELLED';
  const canPickup = integrated && shipment?.bookingState === 'BOOKED' && !uncertain && !shipment?.pickup?.token && shipment?.status === 'READY_TO_SHIP';
  const deliveryLabel = replacement ? 'Replacement delivery' : reverse ? 'Reverse pickup' : 'Courier delivery';
  const shipmentLabel = replacement ? 'replacement shipment' : reverse ? 'return shipment' : 'shipment';
  return <section className="admin-card min-w-0 p-5" aria-label={deliveryLabel}>
    <header className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2"><Truck size={19} />{!returnId && !integrated ? 'Manual & self delivery' : deliveryLabel}</h2><button type="button" className="admin-table-action-link inline-flex items-center gap-1" disabled={busy || saving} onClick={() => load(true)}><RefreshCw size={14} />Refresh tracking</button></header>
    {error && <p role="alert" className="my-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
    {message && <p role="status" className="my-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p>}
    {!data ? <p className="admin-note mt-3">{error ? 'Delivery details could not load.' : 'Loading delivery details...'}</p> : <>
      <div className="my-4 flex flex-wrap items-center justify-between gap-3"><div><strong>{human(shipment?.status)}</strong><p className="admin-note">{selfDelivery ? `Self delivery${shipment.deliveryReference ? ` · Reference ${shipment.deliveryReference}` : ' · Reference assigned when saved'}` : shipment?.trackingNumber || shipment?.awb ? `${shipment.courierName || 'Courier'} · Tracking ID ${shipment.trackingNumber || shipment.awb}` : integrated ? 'No courier AWB has been booked.' : 'Add courier tracking later, or deliver with your own team.'}</p></div>{integrated && (shipment?.environment || connection?.mode) === 'sandbox' && <strong className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">SANDBOX · No real delivery</strong>}</div>
      {shipment?.providerRef && <p className="admin-note break-all">Booking reference: {shipment.providerRef}</p>}
      {shipment?.providerStatus && <p className="mt-2 text-sm">{shipment.providerStatus}</p>}
      {integrated && shipment?.providerCharge != null && Number.isFinite(Number(shipment.providerCharge)) && <p className="admin-note mt-2">Carrier quote at booking: ₹{Number(shipment.providerCharge).toLocaleString('en-IN', { maximumFractionDigits: 2 })}. The customer delivery amount remains the total agreed at checkout.</p>}
      {shipment?.lastError && <p role="status" className="admin-note mt-2">{shipment.lastError}</p>}
      {shipment?.lastSyncedAt && <p className="admin-note mt-2">Last checked: {new Date(shipment.lastSyncedAt).toLocaleString('en-IN')}</p>}
      {shipment?.expectedDeliveryAt && <p className="mt-2 text-sm font-bold text-emerald-800">Expected delivery: {new Date(shipment.expectedDeliveryAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
      {shipment?.pickup?.token && <p className="mt-3 text-sm">Pickup {shipment.pickup.cancelled ? 'cancelled' : 'confirmed'} · {shipment.pickup.date} at {shipment.pickup.time} IST · Token {shipment.pickup.token}</p>}
      {integrated && ['EXCEPTION', 'FAILED'].includes(shipment?.status) && <form className="order-delivery-exception" onSubmit={event => { event.preventDefault(); act('exception', exceptionForm); }}>
        <header><AlertTriangle size={18} /><div><h3>Resolve delivery issue</h3><p>Record the customer or courier follow-up. Tracking remains carrier-controlled.</p></div></header>
        <label>Follow-up<select className={inputClass} value={exceptionForm.action} onChange={event => setExceptionForm(value => ({ ...value, action: event.target.value }))}><option value="CONTACTED_CUSTOMER">Customer contacted</option><option value="CONFIRMED_ADDRESS">Address confirmed</option><option value="REQUESTED_REDELIVERY">Redelivery requested</option><option value="REQUESTED_RTO">Return to origin requested</option><option value="OTHER">Other courier follow-up</option></select></label>
        <label>Courier reference (optional)<input className={inputClass} maxLength={120} value={exceptionForm.reference} onChange={event => setExceptionForm(value => ({ ...value, reference: event.target.value }))} /></label>
        <label className="is-wide">Action note<textarea className={`${inputClass} min-h-20`} minLength={3} maxLength={500} required value={exceptionForm.note} onChange={event => setExceptionForm(value => ({ ...value, note: event.target.value }))} /></label>
        <button className="admin-btn is-wide" type="submit" disabled={busy || exceptionForm.note.trim().length < 3}>Save follow-up</button>
      </form>}
      {!integrated && <p className="admin-note">Delivery is managed by your team. Status updates are entered by staff; no courier API is called. {returnId ? 'Manage return or replacement progress using the case actions.' : 'Use the order workflow to dispatch and confirm delivery.'}</p>}
      {canEditManual && <ManualShipmentForm order={{ ...manualOrder, shipment: manualOrder.shipment || shipment }} defaultMode={data?.manualDefaultMode} busy={busy || saving} onSave={saveManual} apiBase={`${apiBase}/smart-fill`} />}
      {integrated && !connection?.liveBooking && !shipment?.awb && <p role="status" className="admin-note">{connection?.note}</p>}
      <fieldset disabled={busy}>
        {canBook && <div className="mt-4"><h3 className="flex items-center gap-2 text-sm"><Package size={17} />Packed parcel · one package</h3><div className="mt-3 grid grid-cols-2 gap-3">{[['weightKg', 'Weight (kg)'], ['lengthCm', 'Length (cm)'], ['widthCm', 'Width (cm)'], ['heightCm', 'Height (cm)']].map(([key, label]) => <label className="text-sm" key={key}>{label}<input type="number" min="0.001" step="0.001" className={inputClass} value={parcel[key] ?? ''} onChange={e => { setParcel(p => ({ ...p, [key]: e.target.value })); setChecked(false); }} /></label>)}</div><p className="admin-note mt-2">Measure the finished parcel including packaging. Changing these measurements does not change the customer's order total.</p></div>}
        {(canBook || canPickup) && <div className="mt-4 grid gap-3 sm:grid-cols-3">{[['date', 'Pickup date', 'date'], ['time', 'Ready from (IST)', 'time'], ['closeTime', 'Closes at (IST)', 'time']].map(([key, label, type]) => <label className="min-w-0 text-sm" key={key}>{label}<input className={inputClass} type={type} value={slot[key]} onChange={e => setSlot(s => ({ ...s, [key]: e.target.value }))} /></label>)}</div>}
        {canBook && <><label className="my-4 flex items-start gap-2 text-sm"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} className="mt-1" /><span>I checked the packed parcel details. Create this {shipmentLabel} with {carrier} using my connected account.</span></label><button type="button" disabled={!checked || !connection?.liveBooking} className="admin-btn" onClick={() => act('book')}>Create {shipmentLabel}</button></>}
        {integrated && shipment?.awb && shipment.status !== 'CANCELLED' && <div className="mt-4 flex flex-wrap gap-3"><button type="button" className="admin-btn-ghost inline-flex items-center gap-2" disabled={!shipment.labelAvailable} onClick={download}><Download size={16} />Download label / print PDF</button>{canPickup && <button type="button" className="admin-btn" onClick={() => act('pickup')}>Request {carrier} pickup</button>}</div>}
        {integrated && shipment?.awb && !shipment.labelAvailable && <p className="admin-note mt-2">The PDF was not returned by {carrier}. Download the original label from the carrier account using this AWB.</p>}
        {uncertain && <div className="mt-4 rounded-xl border border-amber-200 p-4"><h3>Check the existing request</h3><p className="admin-note">A request may already exist at {carrier}. Check by reference before creating another parcel.</p>{shipment?.operation?.startsWith('pickup') && <label className="mt-3 block text-sm">Confirmed pickup token<input className={inputClass} value={pickupToken} onChange={e => setPickupToken(e.target.value)} /></label>}{shipment?.operation && !['book'].includes(shipment.operation) && <label className="my-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={carrierConfirmed} onChange={e => setCarrierConfirmed(e.target.checked)} />I confirmed this request with {carrier}.</label>}<details className="mt-3"><summary>{carrier} confirmed no request exists</summary><label className="my-3 flex items-start gap-2"><input type="checkbox" checked={confirmedNoRequest} onChange={e => { setConfirmedNoRequest(e.target.checked); setCarrierConfirmed(e.target.checked); }} /><span>{carrier} confirmed there is no AWB or pickup for this reference. Unlock a retry only after that confirmation.</span></label></details><button type="button" className="admin-btn-ghost mt-3" onClick={() => act('reconcile')}>Check booking outcome</button></div>}
        {integrated && shipment?.awb && !uncertain && ['READY_TO_SHIP', 'PICKUP_SCHEDULED'].includes(shipment.status) && <details className="mt-5 text-sm"><summary className="cursor-pointer text-wine">Cancel courier booking</summary><p className="admin-note mt-2">{carrier} must confirm cancellation before the parcel is handed over. Manage the order cancellation and customer refund separately.</p><label className="my-3 flex items-start gap-2"><input type="checkbox" checked={cancelConfirmed} onChange={e => setCancelConfirmed(e.target.checked)} /><span>I want to cancel this courier booking and its pickup.</span></label><button type="button" disabled={!cancelConfirmed} className="admin-btn-ghost" onClick={() => act('cancel')}>Cancel shipment & pickup</button></details>}
      </fieldset>
      {shipment?.events?.length > 0 && <details className="mt-5 text-sm"><summary className="cursor-pointer font-bold">{integrated ? 'Courier history' : 'Delivery history · store updates'}</summary><ol className="mt-3 space-y-3">{[...shipment.events].reverse().map((event, i) => <li key={i} className="border-l-2 border-rose/20 pl-3"><strong>{human(event.status)}</strong><p>{event.note}</p><time className="admin-note">{new Date(event.date).toLocaleString('en-IN')}</time></li>)}</ol></details>}
      {shipment?.exceptionActions?.length > 0 && <details className="mt-4 text-sm"><summary className="cursor-pointer font-bold">Delivery issue follow-ups ({shipment.exceptionActions.length})</summary><ol className="mt-3 space-y-3">{[...shipment.exceptionActions].reverse().map((entry, index) => <li key={`${entry.date}-${index}`} className="rounded-xl bg-amber-50 p-3"><strong>{human(entry.action)}</strong><p>{entry.note}</p>{entry.reference && <p className="admin-note">Reference: {entry.reference}</p>}<time className="admin-note">{entry.actor?.name || 'Staff'} · {new Date(entry.date).toLocaleString('en-IN')}</time></li>)}</ol></details>}
    </>}
  </section>;
}
