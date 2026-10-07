import { useEffect, useState } from 'react';
import api from '../../services/api';

export const SHIPPING_DEFAULTS = { shippingProvider: 'manual', manualDeliveryMode: 'COURIER', shippingPricingMode: 'fixed', shippingFreeAboveEnabled: true, shippingDefaultWeightKg: 0.5, shippingLengthCm: 30, shippingWidthCm: 25, shippingHeightCm: 5, shippingVolumetricDivisor: 5000, shippingWeightStepKg: 0.5, shippingAdditionalStepCharge: 0, shippingPickup: {}, shippingRateZones: [] };
const PROVIDER_OPTIONS = [
  ['manual', 'Manual / self delivery (no integration)'], ['shiprocket', 'Shiprocket'], ['bluedart', 'Blue Dart'], ['delhivery', 'Delhivery'], ['xpressbees', 'Xpressbees'],
];

export default function DeliverySettings({ form, update, apiBase = '/admin/settings' }) {
  const data = { ...SHIPPING_DEFAULTS, ...form };
  const manual = data.shippingProvider === 'manual';
  const [readiness, setReadiness] = useState(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    api.get(`${apiBase}/shipping-readiness`, { silent: true, cache: 'no-store' }).then(result => { if (active) { setReadiness(result); setError(''); } }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [apiBase, reload]);
  const field = (key, label, note, max = 100000) => <label className="store-settings__field" key={key}><span>{label}</span><input type="number" min="0" step="any" max={max} value={data[key]} onChange={e => update(key, e.target.value)} /><small>{note}</small></label>;
  const zones = data.shippingRateZones || [];
  const zoneChange = (index, key, value) => update('shippingRateZones', zones.map((row, i) => i === index ? { ...row, [key]: value } : row));
  const providers = readiness?.providers || PROVIDER_OPTIONS.map(([name, label]) => ({ name, label, configured: name === 'manual', liveBooking: false, rateQuotes: ['shiprocket', 'delhivery', 'xpressbees'].includes(name) }));
  const selected = providers.find(provider => provider.name === data.shippingProvider) || readiness?.selected;
  const providerBadge = provider => provider.liveBooking && provider.mode === 'production'
    ? { label: 'Ready', classes: 'bg-emerald-50 text-emerald-700' }
    : provider.liveBooking && provider.mode === 'sandbox'
      ? { label: 'Test mode', classes: 'bg-amber-50 text-amber-800' }
      : provider.configured
        ? { label: 'Disabled', classes: 'bg-amber-50 text-amber-800' }
        : { label: 'Setup needed', classes: 'bg-slate-100 text-slate-500' };
  const selectProvider = value => {
    update('shippingProvider', value);
    const provider = providers.find(item => item.name === value);
    if (data.shippingPricingMode === 'carrier' && !provider?.rateQuotes) update('shippingPricingMode', 'fixed');
  };
  return <>
    <div className="store-settings__wide"><h3>Delivery method</h3><p className="admin-note">Deliver with your own team, arrange a courier yourself, or connect a courier account. This default applies to new deliveries; existing shipments keep their saved delivery method and tracking details.</p></div>
    <label className="store-settings__field"><span>Active delivery provider</span><select value={data.shippingProvider} onChange={e => selectProvider(e.target.value)}>{PROVIDER_OPTIONS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><small>{manual ? 'No integration, API credentials or courier account is required by the app.' : 'The storefront checks the selected provider before confirming an order.'}</small></label>
    {manual && <>
      <label className="store-settings__field"><span>Default manual delivery method</span><select value={data.manualDeliveryMode || 'COURIER'} onChange={e => update('manualDeliveryMode', e.target.value)}><option value="COURIER">Manual courier — enter tracking ID / link</option><option value="SELF">Self delivery — my own team</option></select><small>Choose the default for new manual deliveries. Confirm the method on each order before dispatch.</small></label>
      <div className="store-settings__tip"><div><strong>{data.manualDeliveryMode === 'SELF' ? 'Self delivery is ready — no connection needed' : 'Manual courier is ready — no connection needed'}</strong><p>{data.manualDeliveryMode === 'SELF' ? 'Use Admin orders to record your delivery details and update progress as your team delivers. No courier AWB is generated or required.' : 'Book directly with your chosen courier, then add its real tracking ID and customer tracking link in Admin orders. Booking is not made by this app.'}</p><p>Customers see the saved delivery details and status timeline in their order. There is no automatic courier status sync or live GPS tracking: staff must update dispatch, out-for-delivery and delivered status.</p><p>COD collection is separate from delivery status. Record payment only after the money is actually collected.</p></div></div>
    </>}
    {!manual && <>
      <div className="store-settings__wide grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{providers.filter(provider => provider.name !== 'manual').map(provider => <div key={provider.name} className={`rounded-2xl border p-4 ${provider.name === data.shippingProvider ? 'border-wine bg-rose/5' : 'border-slate-200 bg-white'}`}><div className="flex items-center justify-between gap-2"><strong>{provider.label}</strong><span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${providerBadge(provider).classes}`}>{providerBadge(provider).label}</span></div><p className="mt-2 text-xs leading-5 text-slate-500">{provider.note}</p><p className="mt-2 text-[11px] font-bold text-slate-500">{provider.cod ? 'COD' : 'No COD'} · {provider.reverse ? 'Returns' : 'No reverse pickup'}{provider.rateQuotes ? ' · Live rates' : ''}</p></div>)}</div>
      <div className="store-settings__tip"><div><strong>{selected?.label || 'Courier'} · {selected?.mode || 'Connection check'}</strong><p>{error || selected?.note || 'Checking backend connection...'}</p>{selected?.missing?.length > 0 && <p className="admin-note">Backend setup required: {selected.missing.join(', ')}. Credentials are never entered or returned here.</p>}<button type="button" className="admin-table-action-link" onClick={() => setReload(n => n + 1)}>Check all connections again</button></div></div>
    </>}
    <label className="store-settings__field"><span>Customer delivery pricing</span><select value={data.shippingPricingMode} onChange={e => update('shippingPricingMode', e.target.value)}><option value="fixed">Fixed delivery charge</option><option value="weight">Destination and weight rate card</option>{!manual && selected?.rateQuotes && <option value="carrier">Selected courier live rate</option>}</select><small>{manual ? 'The charge agreed with the customer. Fixed charges, free-delivery offers and weight/PIN rate cards also work without an integration.' : 'The amount shown to the customer. Carrier billing and adjustments remain visible in the provider account.'}</small></label>
    <label className="store-settings__field"><span>Free delivery offer</span><select value={String(data.shippingFreeAboveEnabled)} onChange={e => update('shippingFreeAboveEnabled', e.target.value === 'true')}><option value="true">Use the free shipping minimum above</option><option value="false">Charge delivery on every order</option></select></label>
    {data.shippingPricingMode === 'weight' && <>
      {field('shippingWeightStepKg', 'Weight slab (kg)', 'The base charge covers the first slab. Further slabs are rounded up.')}
      {field('shippingAdditionalStepCharge', 'Each additional slab (INR)', 'Default surcharge outside any specific PIN zone.')}
      <div className="store-settings__wide"><h3>Destination rates</h3><p className="admin-note">Enter agreed customer-facing rates. A longer PIN prefix takes priority. Unmatched PIN codes use the default delivery charge above.</p>{zones.map((row, index) => <div className="grid gap-3 rounded-xl border p-3 mt-3 sm:grid-cols-4" key={index}><label>PIN prefix<input aria-label={`PIN prefix ${index + 1}`} value={row.prefix} maxLength={6} inputMode="numeric" onChange={e => zoneChange(index, 'prefix', e.target.value)} className="admin-field__control w-full" /></label><label>Base (INR)<input aria-label={`Base charge ${index + 1}`} type="number" min="0" value={row.baseCharge} onChange={e => zoneChange(index, 'baseCharge', e.target.value)} className="admin-field__control w-full" /></label><label>Extra slab (INR)<input aria-label={`Extra slab ${index + 1}`} type="number" min="0" value={row.additionalStepCharge} onChange={e => zoneChange(index, 'additionalStepCharge', e.target.value)} className="admin-field__control w-full" /></label><button type="button" className="admin-btn-ghost self-end" onClick={() => update('shippingRateZones', zones.filter((_, i) => i !== index))}>Remove zone</button></div>)}<button type="button" className="admin-btn-ghost mt-3" disabled={zones.length >= 200} onClick={() => update('shippingRateZones', [...zones, { prefix: '', baseCharge: '', additionalStepCharge: '' }])}>Add PIN zone</button></div>
    </>}
    <div className="store-settings__wide"><h3>{manual ? 'Dispatch address (optional)' : 'Pickup address'}</h3><p className="admin-note">{manual ? 'Optional store dispatch details. Manual and self delivery do not require a registered courier pickup address. Keep any existing address saved if you may connect a courier later.' : 'Where the selected courier collects packed orders and returns parcels. Use the same address registered in that provider account.'}</p></div>
    {[['fullName', 'Contact name'], ['mobile', 'Mobile number'], ['houseNo', 'Building / street'], ['area', 'Area'], ['city', 'City'], ['state', 'State'], ['pincode', 'PIN code']].map(([key, label]) => <label className="store-settings__field" key={key}><span>{label}</span><input value={data.shippingPickup?.[key] || ''} maxLength={key === 'fullName' ? 100 : key === 'pincode' ? 6 : key === 'mobile' ? 10 : 120} onChange={e => update('shippingPickup', { ...data.shippingPickup, [key]: e.target.value })} /></label>)}
    <div className="store-settings__wide"><h3>Parcel defaults</h3><p className="admin-note">Checkout estimates a single parcel from unit weights and stacked item heights. Confirm the actual packed measurements when booking; this never changes a customer's agreed order total.</p></div>
    {field('shippingDefaultWeightKg', 'Default packed unit weight (kg)', 'Used when a product has no saved weight.', 1000)}
    {field('shippingLengthCm', 'Package length (cm)', 'Default outer package length.', 300)}
    {field('shippingWidthCm', 'Package width (cm)', 'Default outer package width.', 300)}
    {field('shippingHeightCm', 'Height per item (cm)', 'Multiplied by the number of items at checkout.', 300)}
    {field('shippingVolumetricDivisor', 'Volumetric divisor', 'Confirm the divisor for the selected courier contract. Chargeable weight is the greater of actual and volumetric weight.')}
  </>;
}
