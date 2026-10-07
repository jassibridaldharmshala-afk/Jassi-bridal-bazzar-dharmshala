import { useEffect, useState } from 'react';
import { Check, Monitor, Smartphone, Tablet, WandSparkles } from 'lucide-react';
import { Select, TextInput } from '../ui/Field';
import ImageUploader from './ImageUploader';
import WorkflowSmartFill from './WorkflowSmartFill';
import { normalizeImageUrl } from '../../services/normalize';

const types = ['Hero', 'Offer', 'Category', 'Sale'];
const positions = ['Home - Top', 'Home - Middle', 'Home - Bottom', 'Cart - Bottom', 'Category - Featured', 'Offer Strip'];
const presets = [
  ['Hero launch', 'Hero', 'Home - Top', 'Shop now'],
  ['Festival sale', 'Sale', 'Home - Middle', 'Explore offers'],
  ['Free delivery', 'Offer', 'Cart - Bottom', 'Complete your bag'],
  ['Category spotlight', 'Category', 'Category - Featured', 'View collection'],
];
const emptyBanner = {
  title: '', subtitle: '', buttonText: 'Shop now', link: '', image: '', tabletImage: '', mobileImage: '', altText: '',
  focalPoint: 'center', displayOrder: 0, type: 'Hero', position: 'Home - Top', isActive: true,
  destinationType: 'CUSTOM', destinationValue: '', campaignKey: '', couponCode: '', startsAt: '', endsAt: '', revision: 0,
};

export default function BannerForm({ initialValues, saving = false, message = '', onSubmit, onCancel, products = [], categories = [], coupons = [] }) {
  const [form, setForm] = useState(() => bannerToForm(initialValues));
  const [device, setDevice] = useState('desktop');
  const [showResponsive, setShowResponsive] = useState(Boolean(initialValues?.tabletImage || initialValues?.mobileImage));
  useEffect(() => setForm(bannerToForm(initialValues)), [initialValues]);
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const options = destinationOptions(form.destinationType, products, categories, coupons);
  const submit = (event) => {
    event.preventDefault();
    if (saving) return;
    onSubmit?.({
      ...form,
      title: form.title.trim(), subtitle: form.subtitle.trim(), buttonText: form.buttonText.trim(), altText: form.altText.trim(),
      link: form.link.trim(), destinationValue: form.destinationValue.trim(), campaignKey: form.campaignKey.trim(), couponCode: form.couponCode.trim(),
      displayOrder: Number(form.displayOrder || 0), startsAt: toIso(form.startsAt), endsAt: toIso(form.endsAt), revision: Number(form.revision || 0),
    });
  };

  return <form onSubmit={submit} className="admin-card overflow-hidden">
    <header className="border-b border-[#eee2da] bg-gradient-to-r from-ivory to-[#fff4f7] p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="admin-kicker">Campaign creative</p><h2 className="mt-1">{initialValues?._id ? 'Edit banner' : 'Create banner'}</h2><p className="admin-note">Responsive artwork, destination, schedule and tracking stay together.</p></div>{onCancel ? <button type="button" onClick={onCancel} className="admin-btn-ghost">Cancel</button> : null}</div>
      {!initialValues?._id ? <div className="mt-4 flex gap-2 overflow-x-auto pb-1">{presets.map(([name, type, position, buttonText]) => <button key={name} type="button" onClick={() => setForm((current) => ({ ...current, type, position, buttonText }))} className="inline-flex min-w-max items-center gap-2 rounded-full border border-[#ead8cf] bg-white px-3 py-2 text-xs font-black text-wine"><WandSparkles className="h-3.5 w-3.5" />{name}</button>)}</div> : null}
    </header>

    <div className="grid gap-6 p-5 xl:grid-cols-[1.05fr_.95fr] md:p-6">
      <div className="space-y-6">
        <WorkflowSmartFill key={initialValues?._id || "new"} workflow="banner" form={form} onChange={setForm} disabled={saving} />
        <Panel title="Message" note="Keep the main message short enough for a phone."><div className="grid gap-4 md:grid-cols-2"><Field label="Banner Title" value={form.title} onChange={(value) => update('title', value)} maxLength={120} required /><Field label="CTA Label" value={form.buttonText} onChange={(value) => update('buttonText', value)} maxLength={60} /><Field label="Subtitle" value={form.subtitle} onChange={(value) => update('subtitle', value)} maxLength={300} className="md:col-span-2" /><Field label="Image alt text" value={form.altText} onChange={(value) => update('altText', value)} maxLength={180} className="md:col-span-2" placeholder="Describe the artwork for accessibility" /></div></Panel>

        <Panel title="Responsive artwork" note="Desktop is required. Tablet and phone fall back to desktop when empty.">
          <div className="grid gap-4 lg:grid-cols-3"><BannerImage label="Desktop (16:6)" value={form.image} onChange={(value) => update('image', value)} />{showResponsive ? <><BannerImage label="Tablet (4:2)" value={form.tabletImage} onChange={(value) => update('tabletImage', value)} /><BannerImage label="Mobile (4:3)" value={form.mobileImage} onChange={(value) => update('mobileImage', value)} /></> : <button type="button" onClick={() => setShowResponsive(true)} className="min-h-28 rounded-2xl border border-dashed border-wine/30 bg-[#fff8fa] px-4 text-sm font-black text-wine lg:col-span-2">Add tablet and mobile artwork</button>}</div>
          <SelectField className="mt-4" label="Image focal point" value={form.focalPoint} onChange={(value) => update('focalPoint', value)} options={['center', 'top', 'bottom', 'left', 'right']} />
        </Panel>

        <Panel title="Destination" note="External links must use HTTPS."><div className="grid gap-4 md:grid-cols-2"><SelectField label="Destination type" value={form.destinationType} onChange={(value) => setForm((current) => ({ ...current, destinationType: value, destinationValue: '' }))} options={['CUSTOM', 'PRODUCT', 'CATEGORY', 'COLLECTION', 'COUPON']} />{options.length ? <SelectField label="Destination" value={form.destinationValue} onChange={(value) => update('destinationValue', value)} options={options} pairs /> : <Field label={form.destinationType === 'CUSTOM' ? 'Redirect Link' : `${form.destinationType.toLowerCase()} value`} value={form.destinationType === 'CUSTOM' ? form.link : form.destinationValue} onChange={(value) => update(form.destinationType === 'CUSTOM' ? 'link' : 'destinationValue', value)} placeholder={form.destinationType === 'CUSTOM' ? '/products?featured=true' : 'Enter destination'} />}</div></Panel>
      </div>

      <div className="space-y-6">
        <Panel title="Placement and delivery" note="Times use your device timezone and are saved as UTC."><div className="grid gap-4 sm:grid-cols-2"><SelectField label="Banner type" value={form.type} onChange={(value) => update('type', value)} options={types} /><SelectField label="Storefront position" value={form.position} onChange={(value) => update('position', value)} options={positions} /><Field label="Display Order" type="number" min="0" value={form.displayOrder} onChange={(value) => update('displayOrder', value)} /><Field label="Campaign key" value={form.campaignKey} onChange={(value) => update('campaignKey', value)} placeholder="festival-2026" /><Field label="Starts" type="datetime-local" value={form.startsAt} onChange={(value) => update('startsAt', value)} /><Field label="Ends" type="datetime-local" value={form.endsAt} onChange={(value) => update('endsAt', value)} /><Field label="Linked coupon code" value={form.couponCode} onChange={(value) => update('couponCode', value.toUpperCase())} className="sm:col-span-2" /></div><label className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"><span><strong className="block text-sm text-charcoal">Publish when schedule allows</strong><small className="text-xs text-slate-500">Pause any time from the banner list.</small></span><input type="checkbox" checked={form.isActive} onChange={(event) => update('isActive', event.target.checked)} className="h-4 w-4 accent-wine" /></label></Panel>

        <Panel title="Live placement preview" note="The dotted area is the safe zone for essential text."><div className="mb-3 flex gap-2">{[['desktop', Monitor], ['tablet', Tablet], ['mobile', Smartphone]].map(([name, DeviceIcon]) => <button key={name} type="button" onClick={() => setDevice(name)} className={`grid h-9 w-9 place-items-center rounded-lg border ${device === name ? 'border-wine bg-wine text-white' : 'border-slate-200 bg-white text-slate-500'}`} aria-label={`${name} preview`}><DeviceIcon className="h-4 w-4" /></button>)}</div><Preview form={form} device={device} /></Panel>
      </div>
    </div>
    {message ? <p role="alert" className="mx-5 mb-4 rounded-xl bg-rose/10 px-4 py-3 text-sm font-bold text-wine md:mx-6">{message}</p> : null}
    <footer className="sticky bottom-0 flex justify-end gap-3 border-t border-[#eee2da] bg-white/95 p-4 backdrop-blur">{onCancel ? <button type="button" onClick={onCancel} className="admin-btn-ghost">Cancel</button> : null}<button type="submit" disabled={saving || !form.title.trim() || !form.image} className="admin-btn disabled:opacity-50">{saving ? 'Saving...' : initialValues?._id ? 'Save banner' : 'Add New Banner'}</button></footer>
  </form>;
}

function Panel({ title, note, children }) { return <section className="rounded-2xl border border-[#eee2da] bg-[#fffdfa] p-4"><h3 className="text-sm font-black text-charcoal">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{note}</p><div className="mt-4">{children}</div></section>; }
function Field({ label, className = '', onChange, ...props }) { return <label className={className}><span className="label-text text-slate-500">{label}</span><TextInput className="mt-2" {...props} onChange={(event) => onChange(event.target.value)} /></label>; }
function SelectField({ label, options, value, onChange, pairs = false, className = '' }) { return <label className={className}><span className="label-text text-slate-500">{label}</span><Select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2"><option value="">Select</option>{options.map((option) => { const pair = pairs ? option : [option, titleCase(option)]; return <option key={pair[0]} value={pair[0]}>{pair[1]}</option>; })}</Select></label>; }
function BannerImage({ label, value, onChange }) { return <ImageUploader label={label} helpText="JPG, PNG or WEBP" uploadContext="banners" value={value ? [{ url: value }] : []} onChange={(images) => onChange(images[0]?.url || '')} compressAboveMb={2} maxUploadMb={20} targetSizeMb={0.6} />; }

function Preview({ form, device }) {
  const image = device === 'desktop' ? form.image : device === 'tablet' ? form.tabletImage || form.image : form.mobileImage || form.tabletImage || form.image;
  const size = device === 'desktop' ? 'min-h-[220px]' : device === 'tablet' ? 'mx-auto min-h-[220px] max-w-[520px]' : 'mx-auto min-h-[280px] max-w-[260px]';
  return <div className={`relative overflow-hidden rounded-2xl bg-[#f5e8e1] ${size}`}>{image ? <img src={normalizeImageUrl(image)} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: form.focalPoint }} /> : null}<span className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent" /><span className="pointer-events-none absolute inset-[10%] rounded-xl border border-dashed border-white/80" /><span className="relative flex min-h-[220px] max-w-[70%] flex-col items-start justify-center p-6 text-white"><small className="text-[9px] font-black uppercase tracking-[0.2em]">{form.position}</small><strong className="mt-2 font-serif text-2xl leading-tight">{form.title || 'Banner title'}</strong>{form.subtitle ? <span className="mt-2 text-xs">{form.subtitle}</span> : null}{form.buttonText ? <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-black text-wine">{form.buttonText}<Check className="h-3.5 w-3.5" /></span> : null}</span></div>;
}

function destinationOptions(type, products, categories, coupons) {
  if (type === 'PRODUCT') return products.map((item) => [item._id, item.name]);
  if (type === 'CATEGORY') return categories.map((item) => [item._id, item.name]);
  if (type === 'COUPON') return coupons.filter((item) => !item.isArchived).map((item) => [item.code, `${item.code}${item.title ? ` - ${item.title}` : ''}`]);
  return [];
}
function bannerToForm(value) { return { ...emptyBanner, ...(value || {}), startsAt: toLocalDateTime(value?.startsAt), endsAt: toLocalDateTime(value?.endsAt) }; }
function toLocalDateTime(value) { if (!value) return ''; const date = new Date(value); if (Number.isNaN(date.getTime())) return ''; const offset = date.getTimezoneOffset() * 60000; return new Date(date.getTime() - offset).toISOString().slice(0, 16); }
function toIso(value) { if (!value) return null; const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date.toISOString(); }
function titleCase(value) { return String(value || '').toLowerCase().replace(/(^|_)(\w)/g, (_, separator, letter) => `${separator ? ' ' : ''}${letter.toUpperCase()}`); }
