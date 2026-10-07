import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, Check, CloudOff, CreditCard, Gauge, RefreshCw, Rocket, ShieldCheck, Sparkles } from 'lucide-react';
import api from '../../services/api';
import PageHeader from '../../components/admin/PageHeader';
import PageState from '../../components/ui/PageState';
import { useAuth } from '../../context/AuthContext';
import { openRazorpayCheckout } from '../../utils/razorpayCheckout';
import { publishSubscriptionStatus, subscriptionIdentity } from '../../utils/subscriptionNotice';

const CYCLES = [
  { id: 'MONTHLY', label: 'Monthly' },
  { id: 'YEARLY', label: 'Yearly' },
  { id: 'LIFETIME', label: 'Lifetime' },
];

export default function SystemStatus() {
  const { notify, user } = useAuth();
  const userId = subscriptionIdentity(user);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [cycle, setCycle] = useState('YEARLY');

  const load = useCallback(async (force = false) => {
    setError('');
    try {
      const result = force ? await api.post('/system/license/refresh', {}) : await api.get('/system/license');
      setData(result); publishSubscriptionStatus(result, { _id: userId }); return result;
    }
    catch (requestError) { setError(requestError.message); return null; }
  }, [userId]);
  useEffect(() => { load(); }, [load]);

  const daysRemaining = useMemo(() => {
    if (!data?.endsAt) return null;
    return Math.max(0, Math.ceil((new Date(data.endsAt).getTime() - Date.now()) / 86400000));
  }, [data?.endsAt]);

  const purchase = async (plan) => {
    if (busy) return;
    setBusy(plan.id);
    try {
      const checkout = await api.post('/system/subscription/checkout', { plan: plan.id, billingCycle: cycle });
      await openRazorpayCheckout({
        key: checkout.keyId, orderId: checkout.orderId, amount: checkout.amount, currency: checkout.currency,
        name: user?.name, contact: user?.phone, storeName: checkout.storeName,
        description: `${plan.name} · ${cycle.toLowerCase()} access`,
        onSuccess: (response) => api.post('/system/subscription/verify', response),
      });
      const renewed = await load(true);
      if (renewed && ['ACTIVE', 'TRIAL'].includes(renewed.status)) notify(`${plan.name} access is active.`, 'success', 'Subscription updated');
      else notify('Payment received. Access could not yet be confirmed. Use Check now or contact the platform owner before retrying payment.', 'warning', 'Access verification pending');
    } catch (requestError) {
      if (requestError.message !== 'Payment cancelled') notify(requestError.message, 'error', 'Subscription');
    } finally { setBusy(''); }
  };

  if (!data && error) return <PageState error={error} onRetry={() => load()} />;
  if (!data) return <PageState loading loadingLabel="Checking system access..." />;

  return <section className="min-w-0 space-y-5">
    <PageHeader title="System & updates" note="Subscription, usage limits and assigned releases for this installation.">
      <button type="button" className="admin-btn-ghost" onClick={() => load(true)} disabled={Boolean(busy)}><RefreshCw size={16} /> Check now</button>
    </PageHeader>

    {!data.managed ? <article className="admin-card p-5 sm:p-7"><div className="flex items-start gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><ShieldCheck /></span><div><h2 className="text-xl font-black">Main platform workspace</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">This source platform is not registered as a generated client installation. Client subscriptions and update targets are managed from Store portfolio after a project ZIP is issued.</p></div></div></article> : <>
      <div className="grid gap-4 xl:grid-cols-[1.35fr_.65fr]">
        <article className="overflow-hidden rounded-[24px] bg-gradient-to-br from-[#5e142b] via-[#7c203f] to-[#a94f6b] p-5 text-white shadow-lg sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/65">{data.companyName || 'Managed installation'}</p><h2 className="mt-2 text-3xl font-black">{data.plan}</h2><p className="mt-2 text-sm text-white/75">{statusMessage(data.status, daysRemaining)}</p></div><span className={`rounded-full px-4 py-2 text-xs font-black ${['ACTIVE', 'TRIAL'].includes(data.status) ? 'bg-emerald-300 text-emerald-950' : 'bg-amber-200 text-amber-950'}`}>{data.status}</span></div>
          <div className="mt-7 grid gap-3 sm:grid-cols-3"><Metric icon={CalendarClock} label="Access" value={data.billingCycle === 'LIFETIME' ? 'Lifetime' : daysRemaining == null ? data.billingCycle : `${daysRemaining} days`} /><Metric icon={Gauge} label="Channel" value={data.updateChannel} /><Metric icon={ShieldCheck} label="Installation" value={shortId(data.installationId)} /></div>
        </article>
        <article className="admin-card p-5 sm:p-6"><p className="text-[11px] font-black uppercase tracking-[0.18em] text-wine">Platform connection</p><div className="mt-4 flex items-center gap-3"><span className={`grid h-10 w-10 place-items-center rounded-xl ${data.platformReachable ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{data.platformReachable ? <ShieldCheck size={19} /> : <CloudOff size={19} />}</span><div><strong>{data.platformReachable ? 'Connected' : 'Protected offline mode'}</strong><p className="text-xs text-slate-500">{data.source === 'offline-cache' ? `Signed access cached until ${formatDate(data.graceUntil)}` : `Last verified ${formatDate(data.issuedAt)}`}</p></div></div><div className="mt-5 grid grid-cols-2 gap-3"><Small label="Products" value={`${Number(data.usage?.products || 0).toLocaleString('en-IN')} / ${Number(data.limits?.products || 0).toLocaleString('en-IN')}`} /><Small label="Orders this month" value={`${Number(data.usage?.ordersPerMonth || 0).toLocaleString('en-IN')} / ${Number(data.limits?.ordersPerMonth || 0).toLocaleString('en-IN')}`} /></div></article>
      </div>

      {data.renewalMessage && <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><AlertTriangle className="shrink-0" size={18} /><div><strong>Message from the platform owner</strong><p className="mt-1 text-xs leading-5">{data.renewalMessage}</p></div></div>}

      <article className="admin-card overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-4 border-b bg-[#fffaf7] p-5 sm:p-6"><div className="flex gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#f3e4e8] text-wine"><Rocket /></span><div><h2 className="text-lg font-black">Application updates</h2><p className="text-xs text-slate-500">The platform owner assigns releases independently to this installation.</p></div></div><span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${data.updateAvailable ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{data.updateAvailable ? 'Update assigned' : 'Up to date'}</span></div><div className="grid gap-4 p-5 sm:grid-cols-3 sm:p-6"><Small label="Installed" value={data.appVersion} /><Small label="Target" value={data.targetVersion} /><Small label="Latest eligible" value={data.latestVersion} /></div>{data.updateAvailable && <div className="mx-5 mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 sm:mx-6 sm:mb-6"><strong>{data.release?.mandatory ? 'Required update assigned' : 'A new update is available'}</strong><p className="mt-1 text-xs leading-5">{data.release?.notes || 'Contact the platform owner to schedule the managed deployment.'}</p></div>}</article>

      <article className="admin-card p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-black">Plans & renewal</h2><p className="mt-1 text-xs text-slate-500">Monthly and yearly purchases are prepaid access periods and renew after a new payment. Each payment changes only this installation. {data.pricing?.taxMode === 'EXCLUSIVE' ? `${data.pricing.gstPercent}% GST is added at checkout.` : data.pricing ? `Prices include ${data.pricing.gstPercent}% GST.` : 'Final taxes are confirmed at checkout.'}</p></div><div className="grid grid-cols-3 gap-2">{CYCLES.map((item) => <button key={item.id} type="button" onClick={() => setCycle(item.id)} className={`rounded-xl px-3 py-2 text-xs font-black ${cycle === item.id ? 'bg-wine text-white' : 'bg-[#faf6f3] text-slate-600'}`}>{item.label}</button>)}</div></div>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">{(data.plans || []).map((plan) => {
          const baseAmount = Number(plan.prices?.[cycle.toLowerCase()] || 0);
          const taxAmount = data.pricing?.taxMode === 'EXCLUSIVE' ? Math.round(baseAmount * Number(data.pricing.gstPercent || 0) / 100) : 0;
          return <div key={plan.id} className={`rounded-2xl border p-4 ${plan.id === data.plan ? 'border-wine bg-[#fffaf7]' : 'bg-white'}`}><div className="flex items-start justify-between gap-2"><div><h3 className="font-black">{plan.name}</h3><p className="mt-1 text-xs text-slate-500">{plan.description}</p></div>{plan.id === data.plan && <Sparkles size={17} className="text-[#8f2748]" />}</div><strong className="mt-4 block text-2xl">₹{Number(baseAmount + taxAmount).toLocaleString('en-IN')}</strong>{taxAmount > 0 && <p className="mt-1 text-[10px] text-slate-500">₹{baseAmount.toLocaleString('en-IN')} + ₹{taxAmount.toLocaleString('en-IN')} GST</p>}<ul className="mt-4 space-y-2 text-xs text-slate-600">{plan.features.slice(0, 5).map((feature) => <li key={feature} className="flex gap-2"><Check size={14} className="text-emerald-600" />{humanize(feature)}</li>)}</ul><button type="button" disabled={Boolean(busy) || !data.checkout?.configured || data.status === 'REVOKED'} onClick={() => purchase(plan)} className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-wine text-xs font-black text-white disabled:opacity-45"><CreditCard size={15} />{busy === plan.id ? 'Opening payment...' : 'Choose this plan'}</button></div>;
        })}</div>
        {!data.checkout?.configured && <p className="mt-4 flex gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900"><AlertTriangle size={16} className="shrink-0" />Online renewal is not configured on the platform. The platform owner can still grant access from Master Control.</p>}
      </article>
    </>}
  </section>;
}

function Metric({ icon: Icon, label, value }) { return <div className="rounded-2xl bg-white/10 p-3"><Icon size={17} className="text-white/70" /><p className="mt-2 text-[9px] font-black uppercase tracking-wider text-white/50">{label}</p><p className="mt-1 truncate text-sm font-black capitalize">{value || '—'}</p></div>; }
function Small({ label, value }) { return <div className="rounded-xl bg-[#fbf7f4] p-3"><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</p><strong className="mt-1 block truncate text-sm">{value == null ? '—' : Number.isFinite(Number(value)) ? Number(value).toLocaleString('en-IN') : value}</strong></div>; }
function shortId(value) { const text = String(value || ''); return text.length > 16 ? `${text.slice(0, 8)}…${text.slice(-5)}` : text; }
function formatDate(value) { if (!value) return 'not available'; const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toLocaleString('en-IN') : 'not available'; }
function humanize(value) { return String(value).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (letter) => letter.toUpperCase()); }
function statusMessage(status, days) { if (status === 'TRIAL') return `${days ?? 0} days remain in the free trial.`; if (status === 'ACTIVE') return days == null ? 'Lifetime access is active.' : `${days} days remain in this access period.`; if (status === 'REVOKED') return 'The platform owner has revoked this installation.'; return 'Renew or contact the platform owner to restore commerce changes.'; }
