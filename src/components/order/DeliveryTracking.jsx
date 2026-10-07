import { useEffect, useRef, useState } from 'react';
import { Clipboard, ExternalLink, Phone, RefreshCw, Truck } from 'lucide-react';
import api from '../../services/api';

function secureTrackingUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; } catch { return ''; }
}
const human = value => String(value || 'WAITING').replaceAll('_', ' ').toLowerCase();

export default function DeliveryTracking({ orderId, returnId, replacement = false, onUpdate, initialShipment = null }) {
  const base = returnId ? `/returns/${returnId}/${replacement ? 'replacement-delivery' : 'delivery'}` : `/orders/${orderId}/delivery`;
  const [shipment, setShipment] = useState(initialShipment);
  const [warning, setWarning] = useState('');
  const [copyMessage, setCopyMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const updateRef = useRef(onUpdate); updateRef.current = onUpdate;
  const initialRef = useRef(initialShipment); initialRef.current = initialShipment;
  useEffect(() => { setShipment(initialRef.current); setWarning(''); setCopyMessage(''); }, [base]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get(`${base}?refresh=1`, { silent: true, cache: 'no-store' }).then(data => {
      if (!active) return;
      setShipment(current => data.shipment || current); setWarning(data.warning || ''); updateRef.current?.(data);
    }).catch(e => { if (active) setWarning(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [base, reload]);
  useEffect(() => { const timer = setInterval(() => { if (document.visibilityState === 'visible') setReload(n => n + 1); }, 60000); return () => clearInterval(timer); }, []);
  const manual = !shipment?.provider || shipment.provider === 'manual';
  const displayStatus = value => manual && !returnId && value === 'RTO_IN_TRANSIT' ? 'Returning to store' : manual && !returnId && value === 'RETURNED' ? 'Returned to store' : human(value);
  const self = manual && shipment?.fulfillmentMode === 'SELF';
  const carrier = self ? 'Store team' : shipment?.courierName || ({ bluedart: 'Blue Dart', shiprocket: 'Shiprocket', delhivery: 'Delhivery', xpressbees: 'Xpressbees' })[shipment?.provider] || 'Courier';
  const identifier = self ? shipment?.deliveryReference : shipment?.trackingNumber || shipment?.awb;
  const trackingUrl = !self ? secureTrackingUrl(shipment?.trackingUrl) : '';
  const contactPhone = String(shipment?.deliveryContact?.phone || '').replace(/[\s()-]/g, '');
  const safeContact = /^\+?[1-9]\d{9,14}$/.test(contactPhone) ? contactPhone : '';
  const copy = async () => {
    try { await navigator.clipboard.writeText(String(identifier)); setCopyMessage(self ? 'Delivery reference copied.' : 'Tracking ID copied.'); }
    catch { setCopyMessage('Copy is unavailable. Select the reference above and copy it manually.'); }
  };
  const title = returnId ? `${carrier} ${replacement ? 'replacement delivery' : 'reverse pickup'}` : self ? 'Self delivery · store team' : manual ? `${carrier} delivery · managed by store` : `${carrier} delivery`;
  return <div className="sc-order-shipment" aria-label={returnId ? (replacement ? 'Replacement delivery tracking' : 'Return delivery tracking') : 'Delivery tracking'}>
    <div className="flex flex-wrap items-center justify-between gap-3"><strong className="flex items-center gap-2"><Truck size={17} />{title}</strong><button type="button" className="sc-orders__text" disabled={loading} onClick={() => setReload(n => n + 1)}><RefreshCw size={14} />{loading ? 'Checking...' : 'Refresh'}</button></div>
    {shipment && <>
      <p className="capitalize"><strong>{displayStatus(shipment.status)}</strong></p>
      {manual && !returnId && ['RTO_IN_TRANSIT', 'RETURNED'].includes(shipment.status) && <p>{shipment.status === 'RTO_IN_TRANSIT' ? 'Delivery could not be completed and the parcel is on its way back to the store.' : 'The parcel is back at the store. Receipt inspection and any applicable refund are handled separately; contact the store if you need help.'}</p>}
      {manual && <p className="sc-orders__muted">{self ? 'Your order is delivered by the store or its delivery team. Progress is updated here by the store; this is not live location tracking.' : 'The store updates delivery progress here. For the courier’s latest scans, use its tracking page when available.'}</p>}
      {identifier && <div className="flex flex-wrap items-center gap-2"><p className="break-all">{self ? 'Delivery reference' : 'Tracking ID'}: {identifier}</p><button type="button" className="sc-orders__text" onClick={copy}><Clipboard size={14} />{self ? 'Copy reference' : 'Copy tracking ID'}</button></div>}
      {copyMessage && <p role="status" className="sc-orders__muted">{copyMessage}</p>}
      {trackingUrl && <a className="sc-orders__text" href={trackingUrl} target="_blank" rel="noopener noreferrer">Track with courier<ExternalLink size={14} /></a>}
      {!self && identifier && !trackingUrl && <p className="sc-orders__muted">Use this tracking ID on the courier's official website, or contact the store for help.</p>}
      {!self && !identifier && !['DELIVERED', 'RETURNED', 'CANCELLED'].includes(shipment.status) && <p>Courier tracking will appear here after the store adds the tracking ID.</p>}
      {shipment.providerStatus && <p>{shipment.providerStatus}</p>}
      {!manual && shipment.environment === 'sandbox' && <p>Test shipment · no real delivery</p>}
      {shipment.expectedDeliveryAt && !['DELIVERED', 'RETURNED', 'RTO_IN_TRANSIT', 'CANCELLED'].includes(shipment.status) && <p>Estimated delivery: {new Date(shipment.expectedDeliveryAt).toLocaleDateString('en-IN')} <span className="sc-orders__muted">(estimate, not a guaranteed arrival time)</span></p>}
      {shipment.customerNote && <p><strong>Message from the store:</strong> {shipment.customerNote}</p>}
      {(shipment.deliveryContact?.name || safeContact) && <div><p><strong>Delivery contact:</strong> {shipment.deliveryContact?.name || 'Store delivery team'}</p>{safeContact && <a className="sc-orders__text" href={`tel:${safeContact}`}><Phone size={14} />{safeContact}</a>}</div>}
      {shipment.lastSyncedAt && <p className="sc-orders__muted">Last checked {new Date(shipment.lastSyncedAt).toLocaleString('en-IN')}</p>}
    </>}
    {warning && <p role="status" className="sc-orders__muted">{warning}</p>}
    {!shipment && !loading && !warning && <p>Delivery updates will appear once the store prepares your shipment.</p>}
    {shipment?.events?.length > 0 && <details><summary>{manual ? 'Delivery updates · from the store' : 'Delivery updates'}</summary><ol>{[...shipment.events].reverse().map((event, i) => <li key={i}><strong>{displayStatus(event.status)}</strong><p>{event.note}</p>{event.date && <time>{new Date(event.date).toLocaleString('en-IN')}</time>}</li>)}</ol></details>}
  </div>;
}
