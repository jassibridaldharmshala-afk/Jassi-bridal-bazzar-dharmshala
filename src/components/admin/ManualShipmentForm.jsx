import { useEffect, useRef, useState } from 'react';
import { PackageCheck, Truck } from 'lucide-react';
import WorkflowSmartFill from './WorkflowSmartFill';

const fieldClass = 'admin-field__control w-full min-w-0';
const dispatchedStatuses = ['Shipped', 'Out for Delivery', 'Delivered', 'Return Requested', 'Exchange Requested', 'Returned', 'Refunded'];
const hasManualDetails = shipment => Boolean(shipment?.fulfillmentMode || shipment?.courierName || shipment?.trackingNumber || shipment?.awb || shipment?.deliveryReference);
const formFrom = (shipment, defaultMode) => ({
  fulfillmentMode: shipment?.fulfillmentMode || (hasManualDetails(shipment) ? 'COURIER' : defaultMode === 'SELF' ? 'SELF' : 'COURIER'),
  courierName: shipment?.courierName || '', trackingNumber: shipment?.trackingNumber || shipment?.awb || '', trackingUrl: shipment?.trackingUrl || '',
  expectedDeliveryAt: shipment?.expectedDeliveryAt ? String(shipment.expectedDeliveryAt).slice(0, 10) : '',
  deliveryContact: { name: shipment?.deliveryContact?.name || '', phone: shipment?.deliveryContact?.phone || '' },
  customerNote: shipment?.customerNote || '', note: '', deliveryEvent: 'NONE', confirmReturned: false,
});

export function isSecureTrackingUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password; } catch { return false; }
}

export default function ManualShipmentForm({ order, defaultMode = 'COURIER', busy = false, onSave, apiBase }) {
  const [form, setForm] = useState(() => formFrom(order.shipment, defaultMode));
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [working, setWorking] = useState(false);
  const pending = useRef(false);
  const orderScope = useRef(order._id); orderScope.current = order._id;
  const shipment = order.shipment;
  useEffect(() => { setForm(formFrom(shipment, defaultMode)); setError(''); setSaved(false); }, [order._id, shipment, defaultMode]);
  const dispatched = dispatchedStatuses.includes(order.orderStatus);
  const returning = shipment?.status === 'RTO_IN_TRANSIT';
  const editable = ['Confirmed', 'Packed', 'Shipped', 'Out for Delivery'].includes(order.orderStatus) && !['RETURNED', 'DELIVERED', 'CANCELLED'].includes(shipment?.status);
  const self = form.fulfillmentMode === 'SELF';
  const edit = (key, value) => { setForm(current => ({ ...current, [key]: value })); setError(''); setSaved(false); };
  const submit = async event => {
    event.preventDefault();
    if (busy || pending.current || !editable) return;
    if (!returning && !self && form.trackingUrl.trim() && !isSecureTrackingUrl(form.trackingUrl.trim())) { setError('Enter a secure https:// tracking URL without a username or password.'); return; }
    if (!returning && !self && dispatched && (!form.courierName.trim() || !form.trackingNumber.trim())) { setError('Courier name and tracking ID are required for a dispatched order.'); return; }
    if (['NOTE', 'EXCEPTION', 'RTO_IN_TRANSIT', 'RETURNED'].includes(form.deliveryEvent) && !form.customerNote.trim()) { setError('Enter a customer message explaining this delivery update.'); return; }
    if (form.deliveryEvent === 'RETURNED' && (!returning || !form.confirmReturned)) { setError('Confirm that this returning parcel has physically arrived back at the store.'); return; }
    const contactPhone = form.deliveryContact.phone.replace(/[\s()-]/g, '');
    if (!returning && contactPhone && !/^\+?[1-9]\d{9,14}$/.test(contactPhone)) { setError('Enter a valid delivery contact phone number, including country code for international numbers.'); return; }
    if (!returning && form.deliveryContact.phone.trim() && !form.deliveryContact.name.trim()) { setError('Enter the name of the delivery contact you are sharing with the customer.'); return; }
    const currentId = order._id;
    pending.current = true; setWorking(true); setError(''); setSaved(false);
    try {
      const result = await onSave({
        revision: Number(order.revision || 0),
        ...(!returning ? { fulfillmentMode: form.fulfillmentMode,
          courierName: self ? '' : form.courierName.trim(), trackingNumber: self ? '' : form.trackingNumber.trim(), trackingUrl: self ? '' : form.trackingUrl.trim(),
          expectedDeliveryAt: form.expectedDeliveryAt,
          deliveryContact: { name: form.deliveryContact.name.trim(), phone: contactPhone },
        } : {}),
        customerNote: form.customerNote.trim(), note: form.note.trim() || 'Manual delivery details updated by staff',
        ...(form.deliveryEvent !== 'NONE' ? { deliveryEvent: form.deliveryEvent } : {}),
        ...(form.deliveryEvent === 'RETURNED' ? { confirmReturned: true } : {}),
      });
      if (orderScope.current !== currentId) return;
      if (result !== false) { setSaved(true); setForm(current => ({ ...current, note: '', deliveryEvent: 'NONE', confirmReturned: false })); }
    } catch (e) { if (orderScope.current === currentId) setError(e.message || 'Delivery details could not be saved. Please try again.'); }
    finally { pending.current = false; if (orderScope.current === currentId) setWorking(false); }
  };
  return <form className="mt-5 border-t border-slate-200 pt-5" onSubmit={submit} aria-label="Manage manual delivery">
    <fieldset disabled={busy || working || !editable} className="min-w-0">
      <WorkflowSmartFill key={String(order._id)} workflow="shipment" form={form} onChange={setForm} apiBase={apiBase} documents disabled={busy || working || returning || !editable} protectedPaths={dispatched ? ['courierName', 'trackingNumber'] : []} />
      <h3 className="flex items-center gap-2 text-base font-bold"><PackageCheck size={18} />Manage delivery yourself</h3>
      <p className="admin-note mt-1">No delivery integration or courier API account is required. Customers see the saved details and your order status updates.</p>
      <label className="admin-field mt-4">Delivery method<select className={fieldClass} value={form.fulfillmentMode} disabled={dispatched} onChange={event => edit('fulfillmentMode', event.target.value)}><option value="COURIER">Courier booked outside this store</option><option value="SELF">Self delivery / your delivery team</option></select></label>
      {dispatched && <p className="admin-note mt-1">{returning ? 'This parcel is returning to the store. Delivery settings are locked; only the customer message and physical return receipt can be updated.' : 'Delivery method, courier and tracking ID are locked after dispatch. You can update the tracking link, estimate, contact and customer message.'}</p>}
      <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">{self ? <><strong className="flex items-center gap-2"><Truck size={16} />Self delivery</strong><p className="mt-1">Deliver with your own team. We create a delivery reference when you save; a courier AWB is not needed.</p>{shipment?.deliveryReference && <p className="mt-2 break-all">Delivery reference: <strong>{shipment.deliveryReference}</strong></p>}</> : <><strong>Manual courier tracking</strong><p className="mt-1">Save a draft now and add the real courier name and tracking ID later. Both are required before dispatch. Tracking links open the courier website; store statuses are updated by your team.</p></>}</div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {!self && <>
          <label className="admin-field">Courier name<input className={fieldClass} disabled={dispatched} maxLength={80} placeholder="Courier name" value={form.courierName} onChange={event => edit('courierName', event.target.value)} /></label>
          <label className="admin-field">AWB / tracking number<input className={fieldClass} disabled={dispatched} maxLength={80} placeholder="AWB / tracking number" value={form.trackingNumber} onChange={event => edit('trackingNumber', event.target.value)} /></label>
          <label className="admin-field sm:col-span-2">Secure tracking URL (optional)<input className={fieldClass} disabled={returning} type="url" maxLength={500} placeholder="https://courier.example/track/..." value={form.trackingUrl} onChange={event => edit('trackingUrl', event.target.value)} /><small>Use the courier's official HTTPS tracking page. Never include account passwords or access tokens.</small></label>
        </>}
        <label className="admin-field">Estimated delivery date (optional)<input className={fieldClass} disabled={returning} type="date" value={form.expectedDeliveryAt} onChange={event => edit('expectedDeliveryAt', event.target.value)} /></label>
        <label className="admin-field">Delivery contact name (optional)<input className={fieldClass} disabled={returning} maxLength={80} autoComplete="off" value={form.deliveryContact.name} onChange={event => edit('deliveryContact', { ...form.deliveryContact, name: event.target.value })} /></label>
        <label className="admin-field">Delivery contact phone (optional)<input className={fieldClass} disabled={returning} type="tel" maxLength={24} autoComplete="off" placeholder="9876543210 or +919876543210" value={form.deliveryContact.phone} onChange={event => edit('deliveryContact', { ...form.deliveryContact, phone: event.target.value })} /><small>Only share a business number intended for customers.</small></label>
        {['Shipped', 'Out for Delivery'].includes(order.orderStatus) && <label className="admin-field sm:col-span-2">Delivery timeline update<select className={fieldClass} value={form.deliveryEvent} onChange={event => { edit('deliveryEvent', event.target.value); edit('confirmReturned', false); }}><option value="NONE">Only save details</option>{returning ? <option value="RETURNED">Parcel physically received back at store</option> : <><option value="NOTE">Add customer update</option>{order.orderStatus === 'Shipped' ? <option value="IN_TRANSIT">In transit / delivery resumed</option> : <option value="OUT_FOR_DELIVERY">Out for delivery / delivery resumed</option>}<option value="EXCEPTION">Delivery delayed / needs attention</option><option value="RTO_IN_TRANSIT">Delivery unsuccessful · returning to store</option></>}</select><small>These are store-entered updates, not automatic courier tracking. A delay alone does not cancel the order or start a return.</small></label>}
        {(returning || form.deliveryEvent === 'RTO_IN_TRANSIT') && <div className="sm:col-span-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm"><strong>Return to origin · unsuccessful delivery</strong><p>This is a parcel coming back before delivery, not a customer return or exchange. Recording its return does not restock inventory or issue a refund. Complete warehouse inspection and any applicable refund using the order's RTO workflow.</p></div>}
        {form.deliveryEvent === 'RETURNED' && <label className="sm:col-span-2 flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={form.confirmReturned} onChange={event => edit('confirmReturned', event.target.checked)} /><span>I confirm this parcel has physically arrived back at the store</span></label>}
        <label className="admin-field sm:col-span-2">Message for the customer (optional)<textarea className={`${fieldClass} min-h-20`} maxLength={300} value={form.customerNote} onChange={event => edit('customerNote', event.target.value)} placeholder="For example: Our delivery team will call before arrival." /><small>This message and the delivery contact are visible to the customer. A message is required for a customer update, delivery delay or return to store.</small></label>
        <label className="admin-field sm:col-span-2">Reason for this update (optional)<input className={fieldClass} maxLength={300} value={form.note} onChange={event => edit('note', event.target.value)} placeholder="For example: Corrected tracking ID after courier confirmation" /></label>
      </div>
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {saved && <p role="status" className="mt-3 text-sm text-emerald-800">Delivery details saved. Order status, inventory and payment actions remain separate.</p>}
      <p className="admin-note my-4">{returning ? 'Record receipt only when the parcel is physically back. Warehouse inspection, inventory disposition and refunds are separate actions.' : 'Saving details does not mark the order shipped or paid. Use the order actions for Shipped → Out for Delivery → Delivered, then record COD collection separately when applicable.'}</p>
      <button type="submit" className="admin-btn" disabled={busy || working}>{busy || working ? 'Saving…' : 'Save manual shipment'}</button>
    </fieldset>
  </form>;
}
