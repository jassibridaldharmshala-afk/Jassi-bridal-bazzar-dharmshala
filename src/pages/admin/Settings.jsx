import { useCallback, useEffect, useRef, useState } from 'react';
import { BadgeCheck, Building2, Check, ChevronRight, CreditCard, Globe2, ImagePlus, Link2, Mail, ReceiptText, RotateCcw, Save, Search, ShieldCheck, Truck } from 'lucide-react';
import PageHeader from '../../components/admin/PageHeader';
import ImageUploader from '../../components/admin/ImageUploader';
import api from '../../services/api';
import { normalizeImageUrl } from '../../services/normalize';
import useUnsavedChanges from '../../hooks/useUnsavedChanges';
import { useBrandIdentity } from '../../context/BrandIdentityContext';
import { SETTINGS_SECTIONS, settingsForm, settingsPayload, announceSettingsSaved } from '../../config/storeSettings';
import logoFallback from '../../assets/generated-brand-logo.svg';
import StoreLogo from '../../components/ui/StoreLogo';
import './Settings.css';
import DeliverySettings from '../../components/admin/DeliverySettings';
import SmsSettings from '../../components/admin/SmsSettings';
import OrderAlertSettings from '../../components/admin/OrderAlertSettings';
import TrafficSettings from '../../components/admin/TrafficSettings';
import RentalSettings from '../../components/rentals/RentalSettings';
import WorkflowSmartFill from '../../components/admin/WorkflowSmartFill';

const ICONS = { brand: Building2, invoice: ReceiptText, contact: Mail, delivery: Truck, payment: CreditCard, policy: ShieldCheck, social: Link2, website: Globe2 };
const POLICIES = [['returnPolicy', 'Return Policy'], ['shippingPolicy', 'Shipping Policy'], ['cancellationPolicy', 'Cancellation Policy'], ['privacyPolicy', 'Privacy Policy'], ['termsConditions', 'Terms and Conditions'], ['sizeGuide', 'Size Guide'], ['faqs', 'FAQs'], ['ourStory', 'Our Story']];

export default function Settings({ route = '' }) {
  const brand = useBrandIdentity();
  const settingsApi = route.startsWith('/seller') ? '/seller/settings' : '/admin/settings';
  const uploadPath = route.startsWith('/seller') ? '/seller/uploads' : '/admin/uploads';
  const [form, setForm] = useState({});
  const [baseline, setBaseline] = useState(null);
  const [active, setActive] = useState('identity');
  const [search, setSearch] = useState('');
  const [paymentReadiness, setPaymentReadiness] = useState(null);
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const uploadLock = useRef(false);
  const uploadBusy = value => { uploadLock.current = value; setUploading(value); };
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [readinessError, setReadinessError] = useState('');
  const [smsOpened, setSmsOpened] = useState(false);
  const [smsDirty, setSmsDirty] = useState(false);
  const [smsBusy, setSmsBusy] = useState(false);
  const [alertsOpened, setAlertsOpened] = useState(false);
  const [alertsDirty, setAlertsDirty] = useState(false);
  const [alertsBusy, setAlertsBusy] = useState(false);
  const [trafficOpened, setTrafficOpened] = useState(false);
  const [trafficDirty, setTrafficDirty] = useState(false);
  const [trafficBusy, setTrafficBusy] = useState(false);
  const [rentalsOpened, setRentalsOpened] = useState(false);
  const [rentalsDirty, setRentalsDirty] = useState(false);
  const [rentalsBusy, setRentalsBusy] = useState(false);
  const lock = useRef(false);
  const dirty = !!baseline && JSON.stringify(form) !== JSON.stringify(baseline);
  useUnsavedChanges(dirty || smsDirty || alertsDirty || trafficDirty || rentalsDirty, saving || uploading || smsBusy || alertsBusy || trafficBusy || rentalsBusy);
  const update = (field, value) => { setMessage(null); setForm(current => ({ ...current, ...(['contactEmail', 'contactPhone', 'address', 'footerText', 'socialLinks'].includes(field) ? { contactDetailsEnabled: true } : {}), [field]: value })); };
  const updateIdentity = (field, value) => {
    setMessage(null);
    setForm(current => ({
      ...current,
      ...(!current.brandIdentityEnabled ? { logoUrl: current.logoUrl ?? brand.logo, faviconUrl: current.faviconUrl ?? brand.favicon, tagline: current.tagline ?? brand.tagline } : {}),
      [field]: value, brandIdentityEnabled: true,
    }));
  };
  const refreshReadiness = useCallback(async () => {
    try { setPaymentReadiness(await api.get(`${settingsApi}/payment-readiness`)); setReadinessError(''); }
    catch (error) { setPaymentReadiness(null); setReadinessError(error.message || 'Payment availability could not be checked.'); }
  }, [settingsApi]);
  const load = useCallback(async () => {
    setLoading(true); setLoadError('');
    try { const value = settingsForm(await api.get(settingsApi)); setForm(value); setBaseline(value); }
    catch (error) { setLoadError(error.message); }
    finally { setLoading(false); }
  }, [settingsApi]);
  useEffect(() => { load(); refreshReadiness(); }, [load, refreshReadiness]);

  const submit = async event => {
    event.preventDefault();
    if (['sms', 'order-alerts', 'traffic', 'rentals'].includes(active) || smsBusy || alertsBusy || trafficBusy || rentalsBusy) return;
    if (lock.current || uploadLock.current || loading || loadError || !dirty) return;
    lock.current = true; setSaving(true); setMessage(null);
    try {
      const saved = settingsForm(await api.put(settingsApi, settingsPayload(form)));
      setForm(saved); setBaseline(saved); announceSettingsSaved();
      setMessage({ text: 'Settings saved successfully.', error: false });
      await refreshReadiness();
    } catch (error) { setMessage({ text: error.message, error: true, conflict: error.status === 409 }); }
    finally { lock.current = false; setSaving(false); }
  };
  const reloadLatest = async () => {
    if (lock.current || uploadLock.current) return;
    lock.current = true; setSaving(true);
    try {
      const edits = Object.fromEntries(Object.entries(form).filter(([key, value]) => !['_id', '__v', 'createdAt', 'updatedAt', 'storeId'].includes(key) && JSON.stringify(value) !== JSON.stringify(baseline?.[key])));
      const latest = settingsForm(await api.get(settingsApi));
      setBaseline(latest); setForm({ ...latest, ...edits });
      setMessage({ text: 'Latest settings loaded. Your edits have been kept; review them before saving.', error: false });
    } catch (error) { setMessage({ text: error.message, error: true, conflict: true }); }
    finally { lock.current = false; setSaving(false); }
  };
  const discard = () => { if (saving || uploading || !baseline) return; setForm(settingsForm(baseline)); setMessage(null); };
  const input = (field, label, options = {}) => <Field key={field} label={label} value={form[field] ?? ''} onChange={value => update(field, value)} {...options} />;
  const number = (field, label, note = '', options = {}) => input(field, label, { type: 'number', note, min: 0, step: 'any', ...options });
  const toggle = (field, label, note = '', options = {}) => <Toggle key={field} label={label} note={note} checked={!!form[field]} onChange={value => update(field, value)} {...options} />;
  const availableSections = SETTINGS_SECTIONS.filter(section => !section.deploymentOnly || !route.startsWith('/seller'));
  const selected = availableSections.find(section => section.id === active) || availableSections[0];
  const sections = availableSections.filter(section => (section.title + ' ' + section.note + ' ' + section.keywords).toLowerCase().includes(search.toLowerCase().trim()));
  const logo = normalizeImageUrl(form.brandIdentityEnabled ? form.logoUrl : form.logoUrl ?? brand.logo) || logoFallback;

  return <section className="store-settings">
    <PageHeader title="Store settings" note="Everything you need to manage your business, in one place." />
    {loading ? <div className="admin-card p-6" role="status">Loading settings...</div> : loadError ? <div role="alert" className="store-settings__notice"><p>{loadError}</p><button type="button" onClick={load} className="admin-btn-ghost">Retry settings</button></div> : <>
      <div className="store-settings__overview">
        <div className="store-settings__brand"><StoreLogo src={logo} name={form.storeName || 'Your store'} /><div><strong>{form.storeName || 'Your store'}</strong><span>{form.legalBusinessName || 'Business preferences and storefront identity'}</span></div></div>
        <span className={'store-settings__status ' + (form.acceptingOrders === false ? 'is-paused' : '')}><span />{form.acceptingOrders === false ? 'New orders paused' : 'Accepting orders'}</span>
      </div>
      {readinessError && <div role="status" className="store-settings__notice"><p>Settings are available. {readinessError}</p><button type="button" onClick={refreshReadiness} className="admin-btn-ghost">Retry payment check</button></div>}
      <form onSubmit={submit} noValidate>
        <div className="store-settings__layout">
          <aside className="store-settings__sidebar">
            <label className="store-settings__search"><Search size={17} /><input aria-label="Find a settings section" placeholder="Find settings" value={search} onChange={event => setSearch(event.target.value)} /></label>
            <nav aria-label="Settings sections">{sections.map(section => { const Icon = ICONS[section.icon]; return <button type="button" key={section.id} disabled={uploading || smsBusy || alertsBusy || trafficBusy || rentalsBusy} aria-current={active === section.id ? 'page' : undefined} onClick={() => { setActive(section.id); if (section.id === 'sms') setSmsOpened(true); if (section.id === 'order-alerts') setAlertsOpened(true); if (section.id === 'traffic') setTrafficOpened(true); if (section.id === 'rentals') setRentalsOpened(true); }}><Icon size={18} /><span>{section.title}</span><ChevronRight size={15} /></button>; })}</nav>
            {!sections.length && <p className="store-settings__muted">No matching section. Try payments, logo or delivery.</p>}
            <p className="store-settings__sidebar-note"><ShieldCheck size={16} /> Changes are saved securely and recorded in your audit log.</p>
          </aside>
          <div className="store-settings__panel">
            <div className="store-settings__panel-heading"><span>{String(availableSections.indexOf(selected) + 1).padStart(2, '0')} / {String(availableSections.length).padStart(2, '0')}</span><h2>{selected.title}</h2><p>{selected.note}</p></div>
            <fieldset disabled={saving || uploading} style={['sms', 'order-alerts', 'traffic', 'rentals'].includes(active) ? { display: 'none' } : undefined} className="store-settings__fields">
              {['identity', 'business', 'contact'].includes(active) && <WorkflowSmartFill workflow="store" form={form} onChange={setForm} apiBase={settingsApi.startsWith('/seller') ? '/seller/smart-fill' : '/admin/smart-fill'} documents disabled={saving || uploading} />}
              {active === 'identity' && <>
                <Field label="Store Name" value={form.storeName || ''} onChange={value => updateIdentity('storeName', value)} required maxLength={100} note="Shown on your storefront, admin workspace and new invoices." />
                <Field label="Tagline" value={form.tagline ?? brand.tagline ?? ''} onChange={value => updateIdentity('tagline', value)} maxLength={180} note="A short line that describes your brand." />
                <BrandImage title="Store logo" value={form.logoUrl ?? brand.logo} onChange={value => updateIdentity('logoUrl', value)} onBusyChange={uploadBusy} disabled={saving || uploading} note="A transparent PNG works well. Used in the header, mobile menu and new invoices." uploadPath={uploadPath} />
                <BrandImage title="Browser icon" value={form.faviconUrl ?? brand.favicon} onChange={value => updateIdentity('faviconUrl', value)} onBusyChange={uploadBusy} disabled={saving || uploading} note="Use a square PNG or JPG, ideally 256 x 256 pixels." uploadPath={uploadPath} />
                <div className="store-settings__tip"><BadgeCheck size={19} /><p>Identity changes apply across desktop and mobile. Existing order invoices keep their original seller information.</p></div>
                <Toggle label="Use this identity across all themes" checked={!!form.brandIdentityEnabled} onChange={value => value ? updateIdentity('storeName', form.storeName) : update('brandIdentityEnabled', false)} note="Turn off to use the logo and name saved in Website Designer. Business and invoice details stay in Settings." />
              </>}
              {active === 'business' && <>
                {input('legalBusinessName', 'Legal business name', { maxLength: 160, note: 'Registered seller name, if different from your store name.' })}
                {input('gstin', 'GSTIN', { maxLength: 15, note: 'Leave empty if not applicable.' })}
                {input('invoicePrefix', 'Invoice prefix', { maxLength: 16, note: 'Used for new invoice numbers. Existing numbers stay unchanged.' })}
                {number('gstRate', 'GST rate % (shown as inclusive)', 'Tax is included in product prices, not added a second time.', { max: 100 })}
                {input('billingAddress', 'Billing address on invoices', { multiline: true, maxLength: 1000, note: 'Uses the store address when left empty.' })}
                {input('invoiceNote', 'Invoice footer note', { multiline: true, maxLength: 500, note: 'Optional message printed on new invoices and PDF downloads.' })}
              </>}
              {active === 'contact' && <>
                {toggle('contactDetailsEnabled', 'Use these contact details in the footer', 'Turn off to use the contact details saved in Website Designer. The contact page and invoices always use Settings.')}
                {input('contactEmail', 'Contact Email', { type: 'email', maxLength: 254 })}
                {input('contactPhone', 'Contact Phone', { type: 'tel', maxLength: 24 })}
                {input('whatsappNumber', 'WhatsApp Number', { type: 'tel', maxLength: 24, note: 'Include the country code for international numbers.' })}
                {input('supportHours', 'Support hours', { maxLength: 200, placeholder: 'Monday-Saturday, 10 AM-7 PM IST', note: 'Displayed on the contact page and in the footer.' })}
                {input('address', 'Store Address', { multiline: true, maxLength: 1000 })}
                {input('footerText', 'Footer Text', { multiline: true, maxLength: 1000 })}
              </>}
              {active === 'delivery' && <>
                {toggle('acceptingOrders', 'Accept new orders', 'Pause new checkout while customers can still browse and view existing orders.')}
                {input('orderPauseMessage', 'Message when orders are paused', { multiline: true, maxLength: 300 })}
                {number('minimumOrderAmount', 'Minimum order value', 'Item total before coupon discounts and fees. 0 means no minimum.')}
                {number('deliveryCharge', 'Delivery Charge', 'Charged below the free delivery threshold. 0 means free delivery.')}
                {number('freeShippingMinAmount', 'Free Shipping Minimum Amount', '0 gives free delivery on every order.')}
                {number('platformFee', 'Platform Fee', 'Shown separately in the bag, checkout and invoice. 0 removes the fee.')}
                <DeliverySettings form={form} update={update} apiBase={settingsApi} />
                <div className="store-settings__tip"><Truck size={19} /><p>Checkout calculates these amounts on the server. Existing orders keep the charges agreed when they were placed.</p></div>
              </>}
              {active === 'payments' && <>
                {!form.codEnabled && !(form.razorpayEnabled && paymentReadiness?.configured && ['upiEnabled', 'cardPaymentEnabled', 'netBankingEnabled', 'walletEnabled'].some(key => form[key])) && <p role="status" className="store-settings__tip">No payment method is currently available. Customers will be unable to complete checkout until a method is enabled.</p>}
                <div className="store-settings__gateway"><div><h3>Online payments</h3><p>UPI, cards, net banking and wallets through Razorpay.</p></div><GatewayStatus readiness={paymentReadiness} />
                  {!paymentReadiness?.configured && <p className="store-settings__wide">Your payment provider must be connected before you can enable online payments.</p>}
                  {paymentReadiness?.configured && !paymentReadiness.webhookConfigured && <p className="store-settings__wide">Payment recovery setup is incomplete. Ask your store owner to finish the gateway connection before accepting live payments.</p>}
                  {toggle('razorpayEnabled', 'Accept online payments', '', { disabled: !paymentReadiness?.configured && !form.razorpayEnabled })}
                  <div className="store-settings__method-grid">{[['upiEnabled', 'UPI'], ['cardPaymentEnabled', 'Credit / Debit Card'], ['netBankingEnabled', 'Net Banking'], ['walletEnabled', 'Wallet']].map(([key, label]) => toggle(key, label))}</div>
                </div>
                {toggle('codEnabled', 'Cash on delivery', 'Allow customers to pay when their order arrives.')}
                {number('codCharge', 'COD Charge', 'Additional fee for cash on delivery orders only.')}
                {number('codMinAmount', 'COD minimum order amount', '0 means no minimum.')}
                {number('codMaxAmount', 'COD maximum order amount', '0 means no maximum.')}
                <Field label="COD pincodes" multiline value={Array.isArray(form.codPincodes) ? form.codPincodes.join(', ') : form.codPincodes || ''} onChange={value => update('codPincodes', value)} note="Six-digit pincodes, separated by commas. Leave empty to offer COD everywhere you deliver." />
                {toggle('smartCodVerificationEnabled', 'Smart COD verification', 'Ask for OTP on first COD orders and after an RTO, while trusted customers continue without repeated OTPs.')}
                <label className="store-settings__field"><span>Prepaid discount type</span><select value={form.prepaidDiscountType || ''} onChange={event => update('prepaidDiscountType', event.target.value)}><option value="">None</option><option value="Flat">Flat amount (INR)</option><option value="Percentage">Percentage (%)</option></select><small>Applied only to online payments.</small></label>
                {number('prepaidDiscountValue', 'Prepaid discount value', form.prepaidDiscountType === 'Percentage' ? 'A percentage between 0 and 100.' : 'Amount in rupees for a flat discount.')}
                <details className="store-settings__advanced"><summary>Advanced COD and RTO controls</summary><div className="store-settings__fields">{number('codRtoRestrictionLimit', 'Repeated RTO limit for COD', 'After this many RTO orders, COD is unavailable. Use 0 to disable the count limit.', { max: 100, step: 1 })}{toggle('rtoBlockEnabled', 'RTO rate COD blocking', 'Also restrict COD when the configured RTO rate is reached.')}{number('rtoBlockMinOrders', 'RTO block minimum orders', 'At least 1 when rate blocking is enabled.', { step: 1 })}{number('rtoBlockThreshold', 'RTO block rate', 'A value between 0 and 1. For example, 0.5 means 50%.', { max: 1, step: 0.01 })}{number('rtoRefundDeduction', 'Prepaid RTO refund deduction', 'Optional fixed amount retained from prepaid RTO refunds when your published policy allows it. Staff can waive it during inspection.')}</div></details>
              </>}
              {active === 'policies' && <>
                {toggle('returnsEnabled', 'Accept returns and exchanges', 'Disable this only when the complete store catalogue is final sale. Product-level rules still apply when enabled.')}
                {toggle('returnWindowUnlimited', 'No return deadline', 'Allow eligible products to be returned without a store-wide time limit. Product-specific limits still take priority.')}
                {!form.returnWindowUnlimited && number('returnWindowDays', 'Return window (days)', 'Days after delivery. Set 0 to disable the store default window; use a product-specific window when required.', { max: 365, step: 1 })}
                {number('returnSlaHours', 'First response SLA (hours)', 'Cases exceeding this time appear in Needs attention.', { min: 1, max: 720, step: 1 })}
                {number('exchangeReservationHours', 'Exchange stock reservation (hours)', 'Reserved replacement stock is flagged as overdue after this period.', { min: 1, max: 720, step: 1 })}
                {number('customerReturnShippingCharge', 'Customer return shipping charge', 'Deducted from change-of-mind refunds. It is automatically waived for damaged, defective or wrong-item reasons.')}
                {number('customerRestockingFeePercent', 'Customer-fault restocking fee (%)', 'Optional percentage deducted for change-of-mind returns. It is waived for damaged, defective or wrong-item cases.', { max: 100, step: 0.5 })}
                {toggle('refundDeliveryChargeOnFullReturn', 'Refund delivery charge on a full return', 'Applied only when all active items in the order are covered by returns.')}
                {toggle('refundPlatformFeeOnFullReturn', 'Refund platform fee on a full return', 'Keep disabled when the platform fee is non-refundable under your policy.')}
                {toggle('refundCodChargeOnFullReturn', 'Refund COD charge on a full return', 'Applies only after COD collection has been recorded.')}
                <details className="store-settings__advanced" open><summary>Return fraud protection</summary><div className="store-settings__fields">
                  {toggle('requireProductQrScan', 'Require unique item scan before packing', 'Each physical unit must match its order product and variant before the order can be packed.')}
                  {toggle('requirePackingPhotos', 'Require packing photos', 'Keep product condition and sealed-package proof with the order.')}
                  {toggle('requirePackingVideo', 'Require packing video', 'Useful for high-value products; videos require persistent media storage in production.')}
                  {toggle('requireDispatchWeight', 'Require dispatch weight', 'Compare dispatch and returned parcel weight during inspection.')}
                  {toggle('requireSecuritySeal', 'Require package seal ID', 'A scanned or entered seal ID is saved with the dispatch record.')}
                  {toggle('enableSecurityTag', 'Enable return security tags', 'Attach a unique tag to fashion items and verify it when the item returns.')}
                  {toggle('requireReturnPhotos', 'Require return inspection photos', 'Staff must attach returned-item proof before completing inspection.')}
                  {toggle('requireReturnVideo', 'Require return unboxing video', 'Staff must record parcel opening for stronger dispute evidence.')}
                  {toggle('enableCustomerRiskDetection', 'Enable internal customer risk signals', 'Shows neutral internal review signals. Customers are never labelled or automatically blocked.')}
                  {toggle('autoApproveVerifiedReturns', 'Recommend approval for verified returns', 'A clean match is marked ready for approval; money is never refunded automatically.')}
                  {number('returnWeightToleranceGrams', 'Weight tolerance (grams)', 'Differences above this value create a manual-review flag.', { max: 10000, step: 1 })}
                  {number('highValueVerificationThreshold', 'High-value verification threshold', 'Orders at or above this amount require dispatch weight even when the general weight rule is off.', { step: 1 })}
                </div></details>
                {POLICIES.map(([key, label]) => <div key={key} className="store-settings__wide">{input(key, label, { multiline: true, maxLength: 20000, rows: 5 })}</div>)}
              </>}
              {active === 'social' && <>
                {['instagram', 'facebook', 'youtube', 'pinterest'].map(network => <Field key={network} label={network[0].toUpperCase() + network.slice(1) + ' Link'} type="url" value={form.socialLinks?.[network] || ''} onChange={value => update('socialLinks', { ...form.socialLinks, [network]: value })} placeholder="https://" />)}
                <Field label="Google Play app link" type="url" value={form.appLinks?.googlePlay ?? form.appLinks?.playStore ?? ''} onChange={value => update('appLinks', { ...form.appLinks, googlePlay: value, playStore: '' })} placeholder="https://play.google.com/" />
                <Field label="Apple App Store link" type="url" value={form.appLinks?.appStore ?? form.appLinks?.appleStore ?? ''} onChange={value => update('appLinks', { ...form.appLinks, appStore: value, appleStore: '' })} placeholder="https://apps.apple.com/" />
                <div className="store-settings__tip"><Link2 size={19} /><p>These are public storefront links. Connect messaging and publishing accounts from <a href="/admin/social">Social studio</a>.</p></div>
              </>}
              {active === 'website' && <>
                {toggle('occasionShoppingEnabled', 'Shop by occasion', 'Desktop and mobile shortcuts use Occasion values from this store’s published products. Empty occasions are hidden.')}
                {toggle('recentlyViewedEnabled', 'Recently viewed products', 'Continue browsing on desktop and mobile. History stays on the shopper’s device, is limited to 12 products and can be cleared.')}
                {toggle('completeLookEnabled', 'Complete the look', 'Show optional matching items on product details. Set matching products in the product editor, or use occasion, colour and tag matching.')}
                <Toggle label="Show announcement bar" checked={form.announcementEnabled ?? true} onChange={value => update('announcementEnabled', value)} note="Displays above the desktop navigation and in the mobile shopping menu." />
                {input('announcementText', 'Announcement text', { maxLength: 240, placeholder: 'Leave empty for an automatic free delivery message', note: 'Clear this field to use a message based on your delivery settings.' })}
                {input('seoTitle', 'Browser page title', { maxLength: 100, note: 'Leave empty to use your store name.' })}
                {input('seoDescription', 'Website description', { multiline: true, maxLength: 300, note: 'Added to the page description metadata. Search engines decide how to display it.' })}
                <BrandImage title="Social sharing image" value={form.socialShareImage || ''} onChange={value => update('socialShareImage', value)} onBusyChange={uploadBusy} disabled={saving || uploading} note="Shown when your store link is shared on WhatsApp, Facebook and other social apps." uploadPath={uploadPath} />
                {toggle('searchIndexingEnabled', 'Allow search engine indexing', 'Turn this off while a store is being prepared. Search crawlers will be asked not to index the storefront.')}
                <div className="store-settings__tip"><Globe2 size={19} /><p>Colours, typography, navigation and homepage layouts are available in <a href="/admin/customization">Website Designer</a>.</p></div>
              </>}
            </fieldset>
            {smsOpened && !route.startsWith('/seller') && <div hidden={active !== 'sms'} className="p-5"><SmsSettings apiBase={settingsApi} onDirtyChange={setSmsDirty} onBusyChange={setSmsBusy} /></div>}
            {alertsOpened && <div hidden={active !== 'order-alerts'} className="p-5"><OrderAlertSettings key={settingsApi} apiBase={settingsApi} onDirtyChange={setAlertsDirty} onBusyChange={setAlertsBusy} /></div>}
            {trafficOpened && <div hidden={active !== 'traffic'} className="p-5"><TrafficSettings key={settingsApi} apiBase={settingsApi} onDirtyChange={setTrafficDirty} onBusyChange={setTrafficBusy} /></div>}
            {rentalsOpened && <div className="p-5" hidden={active !== 'rentals'}><RentalSettings apiBase={route.startsWith('/seller') ? '/seller/rentals' : '/admin/rentals'} onDirtyChange={setRentalsDirty} onBusyChange={setRentalsBusy} /></div>}
          </div>
        </div>
        {!['sms', 'order-alerts', 'traffic', 'rentals'].includes(active) && <div className="store-settings__savebar">
          <div aria-live="polite">{message ? <p className={message.error ? 'is-error' : 'is-success'} role={message.error ? 'alert' : 'status'}>{!message.error && <Check size={17} />}{message.text}</p> : <p>{dirty ? 'You have unsaved changes' : 'All changes saved'}<small>{dirty ? 'Save to apply your updates across the store.' : 'Changes apply after you save.'}</small></p>}{message?.conflict && <button type="button" disabled={saving} onClick={reloadLatest} className="text-xs font-bold text-wine underline">Reload latest and keep my edits</button>}</div>
          <div className="store-settings__save-actions"><button type="button" className="admin-btn-ghost" disabled={!dirty || saving || uploading} onClick={discard}><RotateCcw size={16} /><span>Discard</span></button><button type="submit" className="admin-btn" disabled={!dirty || saving || uploading}><Save size={17} />{uploading ? 'Uploading...' : saving ? 'Saving...' : 'Save Settings'}</button></div>
        </div>}
      </form>
    </>}
  </section>;
}
function Field({ label, value, onChange, note, multiline, ...props }) {
  const Component = multiline ? 'textarea' : 'input';
  return <label className="store-settings__field"><span>{label}{props.required && <b aria-hidden="true"> *</b>}</span><Component {...props} aria-label={label} value={value} onChange={event => onChange(event.target.value)} />{note && <small>{note}</small>}</label>;
}
function Toggle({ label, checked, onChange, note, disabled }) {
  return <label className="store-settings__toggle"><span><strong>{label}</strong>{note && <small>{note}</small>}</span><input type="checkbox" aria-label={label} checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} /><i aria-hidden="true" /></label>;
}
function BrandImage({ title, value, onChange, note, onBusyChange, disabled, uploadPath }) {
  return <div className="store-settings__image"><h3><ImagePlus size={18} />{title}</h3><p>{note}</p><ImageUploader value={value ? [{ url: value }] : []} onChange={files => onChange(files[0]?.url || '')} uploadContext="website-branding" uploadPath={uploadPath} showPrimaryControl={false} replaceOnUpload onBusyChange={onBusyChange} disabled={disabled} label={'Upload ' + title.toLowerCase()} maxUploadMb={5} helpText="PNG, JPG or WebP, up to 5 MB. Choose a new image to replace the current one." /><Field label={title + ' URL'} value={value || ''} onChange={onChange} placeholder="https://" /></div>;
}
function GatewayStatus({ readiness }) {
  if (!readiness) return <span className="store-settings__pill">Check unavailable</span>;
  return <span className={'store-settings__pill ' + (readiness.ready ? 'is-ready' : '')}>{readiness.ready ? 'Ready - ' + readiness.mode + ' mode' : readiness.configured ? 'Connected - disabled' : 'Setup required'}</span>;
}
