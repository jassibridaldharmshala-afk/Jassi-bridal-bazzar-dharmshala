import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, Save, Tag, X } from 'lucide-react';
import api from '../../services/api';
import WorkflowSmartFill from './WorkflowSmartFill';

const PAYMENT_METHODS = [
  ['COD', 'Cash on Delivery'],
  ['UPI', 'UPI'],
  ['CARD', 'Card'],
  ['NETBANKING', 'Net Banking'],
  ['WALLET', 'Wallet'],
  ['RAZORPAY', 'Any Razorpay method'],
];
const SALES_CHANNELS = [['STOREFRONT', 'Online store'], ['ADMIN', 'Admin-created orders'], ['SOCIAL', 'Social selling']];
const COUPON_PRESETS = [
  ['Welcome', { code: 'WELCOME10', title: 'Welcome offer', benefitType: 'DISCOUNT', type: 'Percentage', discountValue: '10', customerSegment: 'NEW', firstOrderOnly: true, customerLimit: '1' }],
  ['Festival', { code: 'FESTIVE20', title: 'Festival savings', benefitType: 'DISCOUNT', type: 'Percentage', discountValue: '20', maxDiscountAmount: '1000' }],
  ['Free delivery', { code: 'FREESHIP', title: 'Free delivery', benefitType: 'FREE_SHIPPING', discountValue: '0' }],
  ['Abandoned bag', { code: 'COMEBACK10', title: 'Complete your order', benefitType: 'DISCOUNT', type: 'Percentage', discountValue: '10', customerLimit: '1' }],
  ['VIP', { code: 'VIP15', title: 'VIP customer reward', benefitType: 'DISCOUNT', type: 'Percentage', discountValue: '15', customerSegment: 'VIP', minimumPriorOrders: '5', minimumLifetimeSpend: '25000', customerLimit: '1' }],
  ['Buy 2 get 1', { code: 'BUY2GET1', title: 'Buy 2, get 1 free', benefitType: 'BUY_X_GET_Y', discountValue: '0', buyQuantity: '2', getQuantity: '1' }],
];

const emptyCoupon = {
  code: '', title: '', description: '', terms: '', type: 'Percentage', discountValue: '',
  activationMode: 'CODE', benefitType: 'DISCOUNT', buyQuantity: '1', getQuantity: '1',
  minOrderAmount: '0', minItemQuantity: '0', maxDiscountAmount: '', validFrom: '', expiryDate: '', evergreen: false, usageLimit: '',
  customerLimit: '', totalBudget: '', priority: '0', stackingMode: 'ALLOW_PRODUCT_OFFERS', scopeMatchMode: 'ALL', minimumRequirementBasis: 'CART', customerSegment: 'ALL',
  minimumPriorOrders: '0', minimumLifetimeSpend: '0', inactiveDays: '90',
  applicablePaymentMethods: [], salesChannels: [], applicableProducts: [], applicableCategories: [], applicableCustomers: [], applicablePincodesText: '',
  firstOrderOnly: false, restoreOnFullRefund: false, isPublic: true, isActive: true, revision: 0,
};

export default function CouponForm({ coupon, products = [], categories = [], customers = [], loadProductOptions, loadCategoryOptions, loadCustomerOptions, onSaved, onCancel, apiBase = '/admin', timezone = 'Asia/Kolkata' }) {
  const editing = Boolean(coupon?._id);
  const [form, setForm] = useState(emptyCoupon);
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [codeAvailability, setCodeAvailability] = useState(null);

  useEffect(() => {
    setForm(coupon ? couponToForm(coupon, timezone) : { ...emptyCoupon });
    setMessage(null);
    setCodeAvailability(null);
  }, [coupon, timezone]);

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const toggleListValue = (field, value) => setForm((current) => ({
    ...current,
    [field]: current[field].includes(value)
      ? current[field].filter((item) => item !== value)
      : [...current[field], value],
  }));

  const estimatedLabel = useMemo(() => {
    const value = Number(form.discountValue || 0);
    if (form.benefitType === 'FREE_SHIPPING') return 'Free delivery';
    if (form.benefitType === 'BUY_X_GET_Y') return `Buy ${form.buyQuantity || 1}, get ${form.getQuantity || 1} free`;
    if (!value) return 'Set the customer saving';
    if (form.type === 'Percentage') {
      return `${value}% off${Number(form.maxDiscountAmount || 0) ? `, up to Rs. ${Number(form.maxDiscountAmount).toLocaleString('en-IN')}` : ''}`;
    }
    return `Rs. ${value.toLocaleString('en-IN')} off`;
  }, [form.benefitType, form.buyQuantity, form.discountValue, form.getQuantity, form.maxDiscountAmount, form.type]);

  const warnings = useMemo(() => {
    const items = [];
    if (form.benefitType === 'DISCOUNT' && form.type === 'Percentage' && Number(form.discountValue) >= 50 && !Number(form.maxDiscountAmount || 0)) items.push('High percentage discount has no maximum saving cap.');
    if (form.benefitType === 'DISCOUNT' && form.type === 'Flat' && Number(form.discountValue) > 0 && Number(form.minOrderAmount || 0) <= Number(form.discountValue)) items.push('Flat saving can cover the full minimum order value.');
    if (form.isActive && form.evergreen && !Number(form.usageLimit || 0) && !Number(form.totalBudget || 0)) items.push('This active offer has no expiry, usage limit or budget limit.');
    return items;
  }, [form]);

  const applyPreset = (preset) => setForm((current) => ({ ...current, ...preset, code: uniqueCode(preset.code) }));
  const checkCode = async () => {
    const code = sanitizeCode(form.code);
    if (!code || typeof api.get !== 'function' || (editing && code === coupon.code)) return;
    setCodeAvailability({ checking: true });
    try {
      const query = new URLSearchParams({ code, ...(editing ? { excludeId: coupon._id } : {}) });
      const data = await api.get(`${apiBase}/coupons/code-availability?${query}`, { silent: true });
      setCodeAvailability({ available: Boolean(data?.available) });
    } catch { setCodeAvailability(null); }
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      validateForm(form);
      if (codeAvailability?.available === false) throw new Error('Choose a coupon code that is not already in use.');
      const saved = editing
        ? await api.put(`${apiBase}/coupons/${coupon._id}`, toPayload(form, timezone))
        : await api.post(`${apiBase}/coupons`, toPayload(form, timezone));
      setMessage({ type: 'success', text: editing ? 'Coupon updated successfully.' : 'Coupon created successfully.' });
      if (!editing) setForm({ ...emptyCoupon });
      onSaved?.(saved, editing ? 'updated' : 'created');
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Unable to save coupon.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="admin-card overflow-hidden">
      <WorkflowSmartFill key={coupon?._id || 'new'} workflow="coupon" form={form} onChange={setForm} apiBase={`${apiBase}/smart-fill`} disabled={saving} />
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-theme-border bg-gradient-to-r from-[#fffaf7] to-white px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-blush text-wine"><Tag className="h-5 w-5" /></span>
          <div>
            <h2 className="text-base font-black text-charcoal">{editing ? `Edit ${coupon.code}` : 'Create a coupon'}</h2>
            <p className="mt-1 text-xs text-slate-500">Configure the offer, eligibility, usage and storefront visibility.</p>
          </div>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">{estimatedLabel}</span>
      </div>

      <div className="grid gap-6 p-5 xl:grid-cols-2">
        {!editing ? <div className="xl:col-span-2"><p className="mb-2 text-xs font-black uppercase tracking-wider text-slate-500">Start with a proven offer</p><div className="flex gap-2 overflow-x-auto pb-1">{COUPON_PRESETS.map(([label, preset]) => <button key={label} type="button" onClick={() => applyPreset(preset)} className="min-w-max rounded-full border border-theme-border bg-white px-3 py-2 text-xs font-bold text-wine hover:bg-blush">{label}</button>)}</div></div> : null}
        <FormSection title="Offer details" note="Shown to customers in the coupon picker.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Coupon code" required hint={editing && Number(coupon.usedCount || 0) > 0 ? 'Locked because this coupon has redemption history' : 'Letters, numbers, dash and underscore'}><div className="flex gap-2"><input value={form.code} disabled={editing && Number(coupon.usedCount || 0) > 0} onBlur={checkCode} onChange={(event) => { update('code', sanitizeCode(event.target.value)); setCodeAvailability(null); }} maxLength={32} className="admin-coupon-input min-w-0 flex-1 uppercase disabled:bg-slate-100" placeholder="SAMIRA20" />{!editing ? <button type="button" onClick={() => { update('code', uniqueCode(form.title || 'SAVE')); setCodeAvailability(null); }} className="rounded-xl border border-slate-200 px-3 text-xs font-black text-wine">Generate</button> : null}</div>{codeAvailability ? <span className={`mt-1 block text-[10px] font-bold ${codeAvailability.available ? 'text-emerald-700' : codeAvailability.checking ? 'text-slate-400' : 'text-rose'}`}>{codeAvailability.checking ? 'Checking code...' : codeAvailability.available ? 'Code is available' : 'Code is already in use'}</span> : null}</Field>
            <Field label="Activation" required><select value={form.activationMode} onChange={(event) => update('activationMode', event.target.value)} className="admin-coupon-input"><option value="CODE">Customer enters code</option><option value="AUTOMATIC">Apply automatically</option></select></Field>
            <Field label="Offer benefit" required><select value={form.benefitType} onChange={(event) => update('benefitType', event.target.value)} className="admin-coupon-input"><option value="DISCOUNT">Price discount</option><option value="FREE_SHIPPING">Free delivery</option><option value="BUY_X_GET_Y">Buy X get Y</option></select></Field>
            {form.benefitType === 'DISCOUNT' && <Field label="Discount type" required><select value={form.type} onChange={(event) => update('type', event.target.value)} className="admin-coupon-input"><option value="Percentage">Percentage</option><option value="Flat">Flat amount</option></select></Field>}
            <Field label="Customer-facing title" className="sm:col-span-2"><input value={form.title} onChange={(event) => update('title', event.target.value)} maxLength={120} className="admin-coupon-input" placeholder="Extra savings on your order" /></Field>
            <Field label="Short description" className="sm:col-span-2"><textarea value={form.description} onChange={(event) => update('description', event.target.value)} maxLength={500} rows={2} className="admin-coupon-input min-h-[76px] py-3" placeholder="A short explanation customers can understand." /></Field>
            {form.benefitType === 'DISCOUNT' && <Field label={form.type === 'Percentage' ? 'Discount percentage' : 'Flat discount (Rs.)'} required><NumberInput value={form.discountValue} onChange={(value) => update('discountValue', value)} min="0.01" max={form.type === 'Percentage' ? '100' : undefined} step="0.01" placeholder={form.type === 'Percentage' ? '20' : '500'} /></Field>}
            {form.benefitType === 'BUY_X_GET_Y' && <><Field label="Customer buys" required><NumberInput value={form.buyQuantity} onChange={(value) => update('buyQuantity', value)} min="1" max="100" step="1" /></Field><Field label="Customer gets free" required><NumberInput value={form.getQuantity} onChange={(value) => update('getQuantity', value)} min="1" max="100" step="1" /></Field></>}
            <Field label="Minimum bag value (Rs.)"><NumberInput value={form.minOrderAmount} onChange={(value) => update('minOrderAmount', value)} min="0" step="0.01" placeholder="0" /></Field>
            <Field label={form.benefitType === 'FREE_SHIPPING' ? 'Maximum delivery benefit (Rs.)' : 'Maximum saving (Rs.)'} hint={form.benefitType === 'FREE_SHIPPING' ? 'Blank covers the full delivery charge' : 'Useful for percentage coupons'}><NumberInput value={form.maxDiscountAmount} onChange={(value) => update('maxDiscountAmount', value)} min="0" step="0.01" placeholder="No cap" /></Field>
            <Field label="Minimum item quantity"><NumberInput value={form.minItemQuantity} onChange={(value) => update('minItemQuantity', value)} min="0" step="1" placeholder="No minimum" /></Field>
            <Field label="Offer priority" hint="Higher priority wins when savings are equal"><NumberInput value={form.priority} onChange={(value) => update('priority', value)} min="-1000" max="1000" step="1" /></Field>
          </div>
        </FormSection>

        <FormSection title="Schedule & limits" note="Control when and how often the coupon can be used.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Starts at" hint="Leave blank to start immediately"><DateTimeInput value={form.validFrom} onChange={(value) => update('validFrom', value)} /></Field>
            <Field label="Expires at" required={!form.evergreen}><DateTimeInput value={form.expiryDate} disabled={form.evergreen} onChange={(value) => update('expiryDate', value)} /></Field>
            <Field label="Total usage limit" hint="Blank means unlimited"><NumberInput value={form.usageLimit} onChange={(value) => update('usageLimit', value)} min="0" step="1" placeholder="Unlimited" /></Field>
            <Field label="Limit per customer" hint="Requires a signed-in customer"><NumberInput value={form.customerLimit} onChange={(value) => update('customerLimit', value)} min="0" step="1" placeholder="Unlimited" /></Field>
            <Field label="Campaign budget (Rs.)" hint="Stops new redemptions after this saving"><NumberInput value={form.totalBudget} onChange={(value) => update('totalBudget', value)} min="0" step="0.01" placeholder="Unlimited" /></Field>
            <Field label="Offer stacking"><select value={form.stackingMode} onChange={(event) => update('stackingMode', event.target.value)} className="admin-coupon-input"><option value="EXCLUSIVE">Exclusive coupon</option><option value="ALLOW_PRODUCT_OFFERS">Allow with product discounts</option></select></Field>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm font-bold text-charcoal sm:col-span-2"><input type="checkbox" checked={form.evergreen} onChange={(event) => setForm((current) => ({ ...current, evergreen: event.target.checked, expiryDate: event.target.checked ? '' : current.expiryDate }))} className="h-4 w-4 accent-rose" />Evergreen offer with no expiry</label>
            <p className="text-[11px] text-slate-500 sm:col-span-2">Schedule timezone: <strong>{timezone}</strong>. Times are saved safely as UTC.</p>
            {editing ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:col-span-2"><span className="text-xs font-bold text-slate-500">Redemptions</span><p className="mt-1 text-sm font-black text-charcoal">{Number(coupon.usedCount || 0).toLocaleString('en-IN')} used{coupon.usageLimit ? ` of ${Number(coupon.usageLimit).toLocaleString('en-IN')}` : ''}</p></div> : null}
          </div>
        </FormSection>

        <FormSection title="Eligibility" note="Empty selections mean the coupon applies to all options.">
          <ChoiceGrid label="Payment methods" items={PAYMENT_METHODS} selected={form.applicablePaymentMethods} onToggle={(value) => toggleListValue('applicablePaymentMethods', value)} />
          <div className="mt-5"><ChoiceGrid label="Sales channels" items={SALES_CHANNELS} selected={form.salesChannels} onToggle={(value) => toggleListValue('salesChannels', value)} /></div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <SearchableMultiSelect label="Categories" options={categories.map((item) => [item._id, item.name, item.subtitle])} loadOptions={loadCategoryOptions} selected={form.applicableCategories} onChange={(value) => update('applicableCategories', value)} emptyLabel="All categories" />
            <SearchableMultiSelect label="Products" options={products.map((item) => [item._id, item.name, item.subtitle])} loadOptions={loadProductOptions} selected={form.applicableProducts} onChange={(value) => update('applicableProducts', value)} emptyLabel="All products" />
            <Field label="When products and categories are selected" hint="All requires the product to be inside a selected category"><select value={form.scopeMatchMode} onChange={(event) => update('scopeMatchMode', event.target.value)} className="admin-coupon-input"><option value="ALL">Match all selections</option><option value="ANY">Match any selection</option></select></Field>
            <Field label="Minimum spend and quantity basis"><select value={form.minimumRequirementBasis} onChange={(event) => update('minimumRequirementBasis', event.target.value)} className="admin-coupon-input"><option value="CART">Entire shopping bag</option><option value="ELIGIBLE_ITEMS">Eligible products only</option></select></Field>
            <Field label="Customer audience"><select value={form.customerSegment} onChange={(event) => setForm((current) => ({ ...current, customerSegment: event.target.value, ...(event.target.value === 'REPEAT' && !Number(current.minimumPriorOrders) ? { minimumPriorOrders: '1' } : {}), ...(event.target.value === 'VIP' ? { minimumPriorOrders: Number(current.minimumPriorOrders) ? current.minimumPriorOrders : '5', minimumLifetimeSpend: Number(current.minimumLifetimeSpend) ? current.minimumLifetimeSpend : '25000' } : {}) }))} className="admin-coupon-input"><option value="ALL">All customers</option><option value="NEW">New customers</option><option value="REPEAT">Repeat customers</option><option value="VIP">VIP by orders or spend</option><option value="INACTIVE">Inactive customers</option><option value="SELECTED">Selected customers</option></select></Field>
            <Field label="Eligible PIN codes" hint="Comma or space separated; blank means all"><textarea value={form.applicablePincodesText} onChange={(event) => update('applicablePincodesText', event.target.value)} rows={2} className="admin-coupon-input min-h-[62px] py-2" placeholder="176001, 110001" /></Field>
            {form.customerSegment === 'SELECTED' ? <SearchableMultiSelect label="Selected customers" options={customers.map((item) => [item._id || item.id, item.name || item.label || item.phone || item.email, item.subtitle])} loadOptions={loadCustomerOptions} selected={form.applicableCustomers} onChange={(value) => update('applicableCustomers', value)} emptyLabel="Choose customers" className="sm:col-span-2" /> : null}
            {['REPEAT', 'VIP'].includes(form.customerSegment) ? <Field label="Minimum previous orders"><NumberInput value={form.minimumPriorOrders} onChange={(value) => update('minimumPriorOrders', value)} min="1" step="1" /></Field> : null}
            {form.customerSegment === 'VIP' ? <Field label="Minimum lifetime spend (Rs.)" hint="VIP qualifies when either threshold is met"><NumberInput value={form.minimumLifetimeSpend} onChange={(value) => update('minimumLifetimeSpend', value)} min="0" step="0.01" /></Field> : null}
            {form.customerSegment === 'INACTIVE' ? <Field label="Days since last order"><NumberInput value={form.inactiveDays} onChange={(value) => update('inactiveDays', value)} min="1" max="3650" step="1" /></Field> : null}
          </div>
          <label className="mt-5 flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm font-bold text-charcoal"><input type="checkbox" checked={form.firstOrderOnly} onChange={(event) => update('firstOrderOnly', event.target.checked)} className="h-4 w-4 accent-rose" />First order only</label>
          <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm font-bold text-charcoal"><input type="checkbox" checked={form.restoreOnFullRefund} onChange={(event) => update('restoreOnFullRefund', event.target.checked)} className="mt-0.5 h-4 w-4 accent-rose" /><span>Restore coupon usage after a full refund<small className="mt-1 block text-[10px] font-normal text-slate-500">Partial refunds never restore a redemption. Cancellation before fulfilment is always restored.</small></span></label>
        </FormSection>

        <FormSection title="Visibility & terms" note="Private coupons work by code but are not advertised.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Toggle checked={form.isActive} onChange={(value) => update('isActive', value)} label="Coupon active" note="Can be validated and used" />
            <Toggle checked={form.isPublic} onChange={(value) => update('isPublic', value)} label="Show to customers" note="Visible in available offers" />
          </div>
          <Field label="Terms and conditions" className="mt-4" hint="One clear line or a short paragraph"><textarea value={form.terms} onChange={(event) => update('terms', event.target.value)} maxLength={1200} rows={4} className="admin-coupon-input min-h-[104px] py-3" placeholder="Cannot be combined with other offers." /></Field>
        </FormSection>
      </div>

      {warnings.length ? <div className="mx-5 mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"><strong className="text-xs text-amber-900">Review before publishing</strong>{warnings.map((warning) => <p key={warning} className="mt-1 text-xs text-amber-800">{warning}</p>)}</div> : null}

      {message ? <p role="status" className={`mx-5 mb-4 rounded-xl px-4 py-3 text-sm font-bold ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose/10 text-rose'}`}>{message.text}</p> : null}
      <div className="flex flex-wrap justify-end gap-3 border-t border-theme-border bg-ivory px-5 py-4">
        {editing ? <button type="button" onClick={onCancel} disabled={saving} className="admin-btn-ghost"><X className="h-4 w-4" /> Cancel edit</button> : null}
        <button disabled={saving} className="admin-btn disabled:opacity-60"><Save className="h-4 w-4" /> {saving ? 'Saving...' : editing ? 'Update Coupon' : 'Create Coupon'}</button>
      </div>
    </form>
  );
}

function FormSection({ title, note, children }) {
  return <fieldset className="rounded-2xl border border-theme-border p-4"><legend className="px-2 text-sm font-black text-charcoal">{title}</legend><p className="mb-4 text-xs text-slate-500">{note}</p>{children}</fieldset>;
}

function Field({ label, hint, required, className = '', children }) {
  return <label className={`block ${className}`}><span className="mb-1.5 flex items-center gap-1 text-xs font-bold text-slate-700">{label}{required ? <em className="not-italic text-rose">*</em> : null}</span>{children}{hint ? <span className="mt-1 block text-[10px] text-slate-400">{hint}</span> : null}</label>;
}

function NumberInput({ onChange, ...props }) {
  return <input type="number" {...props} onChange={(event) => onChange(event.target.value)} className="admin-coupon-input" />;
}

function DateTimeInput({ value, onChange, disabled = false }) {
  return <span className="relative block"><CalendarDays className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input type="datetime-local" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="admin-coupon-input pl-10 disabled:bg-slate-100 disabled:text-slate-400" /></span>;
}

function ChoiceGrid({ label, items, selected, onToggle }) {
  return <div><p className="mb-2 text-xs font-bold text-slate-700">{label}</p><div className="flex flex-wrap gap-2">{items.map(([value, text]) => { const active = selected.includes(value); return <button key={value} type="button" onClick={() => onToggle(value)} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-bold ${active ? 'border-wine bg-wine text-white' : 'border-slate-200 bg-white text-slate-600'}`}>{active ? <Check className="h-3 w-3" /> : null}{text}</button>; })}</div></div>;
}

function SearchableMultiSelect({ label, options, loadOptions, selected, onChange, emptyLabel, className = '' }) {
  const [search, setSearch] = useState('');
  const [remoteOptions, setRemoteOptions] = useState(options);
  const [loading, setLoading] = useState(false);
  useEffect(() => { setRemoteOptions((current) => mergeOptionPairs(current, options)); }, [options]);
  useEffect(() => {
    if (typeof loadOptions !== 'function') return undefined;
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const result = await loadOptions(search, selected);
        if (active) setRemoteOptions((current) => mergeOptionPairs(current.filter(([id]) => selected.includes(String(id))), result));
      } catch {
        // Keep the last successful options visible while the user retries typing.
      } finally { if (active) setLoading(false); }
    }, search ? 250 : 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [loadOptions, search, selected]);
  const needle = search.trim().toLowerCase();
  const visible = remoteOptions.filter(([value, text, subtitle]) => selected.includes(String(value)) || !needle || `${text || ''} ${subtitle || ''}`.toLowerCase().includes(needle)).slice(0, 100);
  return <div className={className}><Field label={label} hint={selected.length ? `${selected.length} selected` : emptyLabel}><input value={search} onChange={(event) => setSearch(event.target.value)} className="admin-coupon-input mb-2" placeholder={`Search ${label.toLowerCase()}`} /></Field><div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">{loading ? <p className="px-2 py-1 text-[10px] font-bold text-slate-400">Searching...</p> : null}{visible.length ? visible.map(([value, text, subtitle]) => { const active = selected.includes(String(value)); return <button key={value} type="button" onClick={() => onChange(active ? selected.filter((item) => item !== String(value)) : [...selected, String(value)])} className={`mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs ${active ? 'bg-wine text-white' : 'hover:bg-slate-50'}`}><span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${active ? 'border-white' : 'border-slate-300'}`}>{active ? <Check className="h-3 w-3" /> : null}</span><span className="min-w-0"><strong className="block truncate font-bold">{text}</strong>{subtitle ? <small className={`block truncate text-[10px] ${active ? 'text-white/75' : 'text-slate-400'}`}>{subtitle}</small> : null}</span></button>; }) : <p className="p-2 text-xs text-slate-400">No matching options</p>}</div></div>;
}

function mergeOptionPairs(...groups) {
  const merged = new Map();
  groups.flat().forEach((option) => { if (option?.[0] != null) merged.set(String(option[0]), [String(option[0]), option[1], option[2]]); });
  return [...merged.values()];
}

function Toggle({ checked, onChange, label, note }) {
  return <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"><span><strong className="block text-xs text-charcoal">{label}</strong><small className="mt-1 block text-[10px] text-slate-500">{note}</small></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-rose" /></label>;
}

function sanitizeCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32);
}

function toLocalDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function couponToForm(coupon, timezone) {
  return {
    ...emptyCoupon, ...coupon, code: coupon.code || '', discountValue: coupon.discountValue ?? '',
    minOrderAmount: coupon.minOrderAmount ?? '0', minItemQuantity: coupon.minItemQuantity ?? '0', maxDiscountAmount: coupon.maxDiscountAmount ?? '',
    validFrom: toZonedDateTime(coupon.validFrom, timezone), expiryDate: toZonedDateTime(coupon.expiryDate, timezone),
    evergreen: !coupon.expiryDate, usageLimit: coupon.usageLimit ?? '', customerLimit: coupon.customerLimit ?? '', totalBudget: coupon.totalBudget ?? '', priority: coupon.priority ?? '0', stackingMode: coupon.stackingMode || 'ALLOW_PRODUCT_OFFERS', scopeMatchMode: coupon.scopeMatchMode || 'ALL', minimumRequirementBasis: coupon.minimumRequirementBasis || 'CART',
    applicablePaymentMethods: coupon.applicablePaymentMethods || [],
    applicableProducts: (coupon.applicableProducts || []).map((item) => String(item?._id || item)),
    applicableCategories: (coupon.applicableCategories || []).map((item) => String(item?._id || item)),
    applicableCustomers: (coupon.applicableCustomers || []).map((item) => String(item?._id || item)),
    applicablePincodesText: (coupon.applicablePincodes || []).join(', '), salesChannels: coupon.salesChannels || [], customerSegment: coupon.customerSegment || 'ALL',
    minimumPriorOrders: coupon.minimumPriorOrders ?? '0', minimumLifetimeSpend: coupon.minimumLifetimeSpend ?? '0', inactiveDays: coupon.inactiveDays ?? '90',
    firstOrderOnly: Boolean(coupon.firstOrderOnly), restoreOnFullRefund: Boolean(coupon.restoreOnFullRefund), isPublic: coupon.isPublic !== false, isActive: coupon.isActive !== false,
    activationMode: coupon.activationMode || 'CODE', benefitType: coupon.benefitType || 'DISCOUNT',
    buyQuantity: coupon.buyQuantity ?? '1', getQuantity: coupon.getQuantity ?? '1',
  };
}

function validateForm(form) {
  if (!form.code.trim()) throw new Error('Coupon code is required.');
  if (form.benefitType === 'DISCOUNT' && Number(form.discountValue) <= 0) throw new Error('Discount value must be positive.');
  if (form.benefitType === 'DISCOUNT' && form.type === 'Percentage' && Number(form.discountValue) > 100) throw new Error('Percentage discount cannot exceed 100.');
  if (form.benefitType === 'BUY_X_GET_Y' && (!Number.isInteger(Number(form.buyQuantity)) || !Number.isInteger(Number(form.getQuantity)) || Number(form.buyQuantity) < 1 || Number(form.getQuantity) < 1)) throw new Error('Buy and free quantities must be whole numbers of 1 or more.');
  if (Number(form.minOrderAmount || 0) < 0 || Number(form.maxDiscountAmount || 0) < 0 || Number(form.totalBudget || 0) < 0) throw new Error('Coupon amounts cannot be negative.');
  if (!form.evergreen && !form.expiryDate) throw new Error('Expiry date is required unless this is an evergreen offer.');
  if (form.validFrom && form.expiryDate && new Date(form.expiryDate) <= new Date(form.validFrom)) throw new Error('Expiry date must be after the start date.');
  ['usageLimit', 'customerLimit', 'minItemQuantity'].forEach((field) => {
    if (form[field] !== '' && (!Number.isInteger(Number(form[field])) || Number(form[field]) < 0)) throw new Error('Usage limits must be whole numbers of 0 or more.');
  });
  if (form.customerSegment === 'SELECTED' && !form.applicableCustomers.length) throw new Error('Select at least one customer.');
  if (['REPEAT', 'VIP'].includes(form.customerSegment) && (!Number.isInteger(Number(form.minimumPriorOrders)) || Number(form.minimumPriorOrders) < 1)) throw new Error('Minimum previous orders must be a whole number of 1 or more.');
  if (form.customerSegment === 'VIP' && Number(form.minimumLifetimeSpend || 0) < 0) throw new Error('Minimum lifetime spend cannot be negative.');
  if (form.customerSegment === 'INACTIVE' && (!Number.isInteger(Number(form.inactiveDays)) || Number(form.inactiveDays) < 1 || Number(form.inactiveDays) > 3650)) throw new Error('Inactive period must be between 1 and 3650 days.');
  const pincodes = parsePincodes(form.applicablePincodesText);
  if (pincodes.some((value) => !/^\d{6}$/.test(value))) throw new Error('Every PIN code must contain exactly 6 digits.');
}

function toPayload(form, timezone) {
  return {
    code: sanitizeCode(form.code), title: form.title, description: form.description, terms: form.terms,
    activationMode: form.activationMode, benefitType: form.benefitType,
    type: form.type, discountValue: form.benefitType === 'DISCOUNT' ? Number(form.discountValue) : 0,
    buyQuantity: Number(form.buyQuantity || 1), getQuantity: Number(form.getQuantity || 1),
    minOrderAmount: Number(form.minOrderAmount || 0), minItemQuantity: Number(form.minItemQuantity || 0), maxDiscountAmount: form.maxDiscountAmount === '' ? 0 : Number(form.maxDiscountAmount),
    usageLimit: form.usageLimit === '' ? 0 : Number(form.usageLimit), customerLimit: form.customerLimit === '' ? 0 : Number(form.customerLimit),
    totalBudget: form.totalBudget === '' ? 0 : Number(form.totalBudget), priority: Number(form.priority || 0), stackingMode: form.stackingMode, scopeMatchMode: form.scopeMatchMode, minimumRequirementBasis: form.minimumRequirementBasis,
    validFrom: toIso(form.validFrom, timezone), expiryDate: form.evergreen ? null : toIso(form.expiryDate, timezone),
    applicablePaymentMethods: form.applicablePaymentMethods,
    applicableProducts: form.applicableProducts,
    applicableCategories: form.applicableCategories,
    applicableCustomers: form.applicableCustomers,
    applicablePincodes: parsePincodes(form.applicablePincodesText),
    salesChannels: form.salesChannels,
    customerSegment: form.customerSegment,
    minimumPriorOrders: Number(form.minimumPriorOrders || 0),
    minimumLifetimeSpend: Number(form.minimumLifetimeSpend || 0),
    inactiveDays: Number(form.inactiveDays || 90),
    firstOrderOnly: Boolean(form.firstOrderOnly),
    restoreOnFullRefund: Boolean(form.restoreOnFullRefund),
    isPublic: Boolean(form.isPublic),
    isActive: Boolean(form.isActive),
    revision: Number(form.revision || 0),
  };
}

function toIso(value, timezone) {
  if (!value) return null;
  const parts = String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!parts) return null;
  const desired = Date.UTC(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]), Number(parts[4]), Number(parts[5]));
  let instant = desired;
  try {
    for (let pass = 0; pass < 2; pass += 1) {
      const zoned = zonedParts(new Date(instant), timezone);
      const represented = Date.UTC(zoned.year, zoned.month - 1, zoned.day, zoned.hour, zoned.minute);
      instant += desired - represented;
    }
  } catch { instant = new Date(value).getTime(); }
  const date = new Date(instant);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toZonedDateTime(value, timezone) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  try {
    const parts = zonedParts(date, timezone);
    const pad = (number) => String(number).padStart(2, '0');
    return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
  } catch { return toLocalDateTime(value); }
}

function zonedParts(date, timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
}

function parsePincodes(value) {
  return Array.from(new Set(String(value || '').split(/[\s,]+/).map((item) => item.trim()).filter(Boolean)));
}

function uniqueCode(seed) {
  const base = sanitizeCode(seed).replace(/[_-]+/g, '').slice(0, 20) || 'SAVE';
  return `${base}${String(Date.now()).slice(-4)}`.slice(0, 32);
}
