import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import PageState from '../../components/ui/PageState';

const emptyAddress = { fullName: '', mobile: '', pincode: '', city: '', state: '', houseNo: '', area: '' };

export default function Onboarding() {
  const { user, refreshProfile, switchMode } = useAuth();
  const master = user?.systemRole === 'MASTER_OWNER' && user?.activeMode === 'admin' && !user?.offlineSession;
  const [form, setForm] = useState({
    name: '',
    slug: '',
    bio: '',
    logo: '',
    instagramHandle: '',
    instagramUrl: '',
    whatsappNumber: '',
    customDomain: '',
    supportEmail: '',
    supportPhone: '',
    paymentReady: false,
    shippingReady: false,
    pickupAddress: { ...emptyAddress },
    returnAddress: { ...emptyAddress },
  });
  const [progress, setProgress] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [hasStore, setHasStore] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const updateAddress = (key, field, value) => setForm((current) => ({
    ...current,
    [key]: { ...current[key], [field]: value },
  }));

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const mine = await api.get('/stores/me/current');
      setForm((current) => ({
        ...current,
        ...mine.store,
        pickupAddress: { ...emptyAddress, ...(mine.store?.pickupAddress || {}) },
        returnAddress: { ...emptyAddress, ...(mine.store?.returnAddress || {}) },
      }));
      setProgress(mine.progress);
      setHasStore(true);
      setCanEdit(['OWNER', 'MANAGER'].includes(mine.role));
      setMessage('');
    } catch (error) {
      if (master && error.status === 403 && /seller access required/i.test(error.message)) { setHasStore(false); setCanEdit(true); }
      else setLoadError(error.status === 403
        ? 'A store owner must provision your seller workspace and grant access before you can set it up.'
        : error.message || 'Your store could not be loaded. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [master]);

  useEffect(() => { load(); }, [load]);

  const save = async (event) => {
    event.preventDefault();
    if (saving || !canEdit || (!hasStore && !master)) return;
    setSaving(true);
    setMessage('');
    try {
      const payload = { ...form };
      const exists = hasStore;
      const data = exists
        ? await api.put('/stores/me/current', payload)
        : await api.post('/stores', payload);
      setProgress(data.progress);
      setHasStore(true);
      setForm((current) => ({
        ...current,
        ...data.store,
        pickupAddress: { ...emptyAddress, ...(data.store?.pickupAddress || {}) },
        returnAddress: { ...emptyAddress, ...(data.store?.returnAddress || {}) },
      }));
      setMessage(exists ? 'Store details saved.' : 'Store created. Complete the remaining steps, then publish.');
      await refreshProfile?.();
      if (!exists) await switchMode?.('seller');
    } catch (error) {
      setMessage(error.message);
    } finally { setSaving(false); }
  };

  const publish = async () => {
    if (saving || !hasStore || !canEdit) return;
    setSaving(true); setMessage('');
    try {
      const data = await api.post('/stores/me/current/publish', {});
      setProgress(data.progress);
      setMessage('Store published. Share your storefront link.');
    } catch (error) {
      setMessage(error.message);
    } finally { setSaving(false); }
  };

  if (loading) return <PageState loading loadingLabel="Loading your boutique..." />;
  if (loadError) return <PageState error={loadError} onRetry={load} />;

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-black">Seller onboarding</h1>
        <p className="mt-1 text-sm font-semibold text-slate-500">Complete these steps before publishing. Existing Jassi shoppers are unchanged.</p>
      </div>
      {progress && (
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-sm font-black">{progress.percent}% complete</p>
          <div className="mt-2 h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-wine" style={{ width: `${progress.percent}%` }} />
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {Object.entries(progress.steps || {}).map(([key, done]) => (
              <p key={key} className={`text-sm font-bold ${done ? 'text-emerald-700' : 'text-slate-400'}`}>{done ? 'Done' : 'Pending'} — {key}</p>
            ))}
          </div>
        </div>
      )}
      {!canEdit && <p role="status" className="rounded-xl bg-white p-3 text-sm text-slate-600">Only the store owner or manager can edit and publish these settings.</p>}
      <form onSubmit={save} className="rounded-2xl bg-white p-5 shadow-sm">
        <fieldset disabled={saving || !canEdit} className="grid min-w-0 gap-3 md:grid-cols-2">
        <Field label="Boutique name" value={form.name} onChange={(value) => update('name', value)} />
        <Field label="URL slug" value={form.slug} onChange={(value) => update('slug', value)} />
        <Field label="Custom domain" value={form.customDomain} onChange={(value) => update('customDomain', value)} />
        <p className="md:col-span-2 text-xs font-semibold text-slate-500">Point a CNAME to this platform yourself. DNS is not changed automatically. Subdomains work when PLATFORM_ROOT_DOMAIN is set on the server.</p>
        <Field label="Instagram handle" value={form.instagramHandle} onChange={(value) => update('instagramHandle', value)} />
        <Field label="Instagram URL" value={form.instagramUrl} onChange={(value) => update('instagramUrl', value)} />
        <Field label="WhatsApp number" value={form.whatsappNumber} onChange={(value) => update('whatsappNumber', value)} />
        <Field label="Support email" value={form.supportEmail} onChange={(value) => update('supportEmail', value)} />
        <Field label="Support phone" value={form.supportPhone} onChange={(value) => update('supportPhone', value)} />
        <Field label="Logo URL" value={form.logo} onChange={(value) => update('logo', value)} />
        <label className="md:col-span-2 text-sm font-bold">Bio
          <textarea className="mt-1 h-24 w-full rounded-xl border px-3 py-2 font-semibold" value={form.bio || ''} onChange={(event) => update('bio', event.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={!!form.paymentReady} onChange={(event) => update('paymentReady', event.target.checked)} /> Payments ready</label>
        <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={!!form.shippingReady} onChange={(event) => update('shippingReady', event.target.checked)} /> Shipping ready</label>
        <AddressFields title="Pickup address" value={form.pickupAddress} onChange={(field, value) => updateAddress('pickupAddress', field, value)} />
        <AddressFields title="Return address" value={form.returnAddress} onChange={(field, value) => updateAddress('returnAddress', field, value)} />
        {message && <p role="status" className="text-sm font-bold text-wine md:col-span-2">{message}</p>}
        <div className="flex flex-wrap gap-3 md:col-span-2">
          <button type="submit" className="h-11 rounded-xl bg-wine px-5 text-sm font-black text-white">Save</button>
          <button type="button" disabled={!hasStore} onClick={publish} className="h-11 rounded-xl border px-5 text-sm font-black disabled:opacity-50">Publish storefront</button>
        </div>
        </fieldset>
      </form>
    </section>
  );
}

function Field({ label, value, onChange }) {
  return (
    <label className="text-sm font-bold">{label}
      <input className="mt-1 h-11 w-full rounded-xl border px-3 font-semibold" value={value || ''} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function AddressFields({ title, value, onChange }) {
  return (
    <div className="rounded-2xl bg-[#fbf8f4] p-4 md:col-span-2">
      <p className="mb-3 text-sm font-black">{title}</p>
      <div className="grid gap-3 md:grid-cols-3">
        {['fullName', 'mobile', 'pincode', 'city', 'state', 'houseNo', 'area'].map((field) => (
          <Field key={field} label={field} value={value?.[field]} onChange={(next) => onChange(field, next)} />
        ))}
      </div>
    </div>
  );
}
