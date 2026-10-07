import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../services/api';

const blank = { revision: 0, storefrontUrl: '', email: { enabled: false, recipient: '', senderEmail: '', senderName: '', apiKey: '' }, whatsapp: { enabled: false, recipient: '', phoneNumberId: '', templateName: '', language: 'en', consent: false, accessToken: '' } };
function toForm(data) {
  return { revision: data.revision, storefrontUrl: data.storefrontUrl || '',
    email: { enabled: data.email.enabled, recipient: data.email.recipient, senderEmail: data.email.senderEmail, senderName: data.email.senderName, apiKey: '' },
    whatsapp: { enabled: data.whatsapp.enabled, recipient: data.whatsapp.recipient, phoneNumberId: data.whatsapp.phoneNumberId, templateName: data.whatsapp.templateName, language: data.whatsapp.language, consent: data.whatsapp.consent, accessToken: '' } };
}
const labels = { QUEUED: 'Queued', SENDING: 'Sending', RETRY: 'Retry scheduled', ACCEPTED: 'Provider accepted', FAILED: 'Needs attention', UNCERTAIN: 'Check provider', SKIPPED: 'Skipped' };
const noop = () => {};

export default function OrderAlertSettings({ apiBase = '/admin/settings', onDirtyChange = noop, onBusyChange = noop }) {
  const [data, setData] = useState(null), [form, setForm] = useState(blank), [saved, setSaved] = useState(null);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [uncertainId, setUncertainId] = useState('');
  const locked = useRef(false);
  const dirty = !!saved && JSON.stringify(form) !== JSON.stringify(saved);
  const accept = value => { const next = toForm(value); setData(value); setForm(next); setSaved(next); };
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { accept(await api.get(`${apiBase}/order-alerts`, { silent: true, cache: 'no-store' })); }
    catch (failure) { setError(failure.message); }
    finally { setLoading(false); }
  }, [apiBase]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => { onBusyChange(busy); }, [busy, onBusyChange]);
  useEffect(() => () => { onDirtyChange(false); onBusyChange(false); }, [onDirtyChange, onBusyChange]);
  const run = async (work, success, replace = false) => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(''); setNotice('');
    try { const result = await work(); if (replace) accept(result); else setData(result); setNotice(success); }
    catch (failure) { setError(failure.message); }
    finally { locked.current = false; setBusy(false); }
  };
  const update = (group, key, value) => setForm(current => group ? ({ ...current, [group]: { ...current[group], [key]: value } }) : ({ ...current, [key]: value }));
  const field = (group, key, label, props = {}) => <label className="store-settings__field" key={`${group}-${key}`}><span>{label}</span><input aria-label={label} value={group ? form[group][key] : form[key]} onChange={event => update(group, key, event.target.value)} maxLength={props.type === 'password' ? 4096 : 254} {...props} /></label>;
  const toggle = (group, key, label) => <label className="store-settings__toggle"><span><strong>{label}</strong></span><input type="checkbox" aria-label={label} checked={form[group][key]} onChange={event => update(group, key, event.target.checked)} /><i aria-hidden="true" /></label>;
  const retry = (id, confirmUncertain = false) => run(() => api.post(`${apiBase}/order-alerts/${id}/retry`, { confirmUncertain }, { silent: true }), 'Alert queued for retry.');
  if (loading) return <p role="status">Loading order alert settings...</p>;
  if (!data) return <div role="alert"><p>{error || 'Order alert settings could not load.'}</p><button type="button" className="admin-btn-ghost mt-3" onClick={load}>Retry settings</button></div>;
  return <div className="space-y-5">
    <div className="store-settings__tip"><p>Get a new-order alert without keeping this dashboard open. COD orders are announced when placed (verification status is included); online orders only after payment is confirmed. Notifications never block checkout.</p></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
    <fieldset disabled={busy} className="space-y-5">
      {field('', 'storefrontUrl', 'Storefront URL for order links', { type: 'url', placeholder: 'https://your-store.com' })}
      <section className="space-y-3 rounded-xl border border-theme-border p-4" aria-labelledby="email-alert-heading">
        <h3 id="email-alert-heading" className="font-bold">Email alerts · Brevo</h3>
        {toggle('email', 'enabled', 'Enable email order alerts')}
        <div className="grid gap-4 sm:grid-cols-2">
          {field('email', 'recipient', 'Owner notification email', { type: 'email', autoComplete: 'off' })}
          {field('email', 'senderEmail', 'Verified sender email', { type: 'email', autoComplete: 'off' })}
          {field('email', 'senderName', 'Sender name')}
          {field('email', 'apiKey', 'Brevo API key', { type: 'password', autoComplete: 'new-password', placeholder: data.email.hasApiKey ? 'Saved securely — leave blank to keep' : 'Enter API key' })}
        </div>
        <p className="text-sm text-theme-muted">Use a sender verified in your Brevo account. The recipient can use Gmail, Outlook or another mailbox. Credentials are stored encrypted and never sent back to the browser.</p>
        <button type="button" disabled={dirty || !data.email.enabled} className="admin-btn-ghost" onClick={() => run(() => api.post(`${apiBase}/order-alerts/test`, { channel: 'EMAIL' }, { silent: true }), 'Email test processed. Check the delivery history and your inbox.')}>Send test email</button>
      </section>
      <section className="space-y-3 rounded-xl border border-theme-border p-4" aria-labelledby="whatsapp-alert-heading">
        <h3 id="whatsapp-alert-heading" className="font-bold">WhatsApp alerts · Meta Cloud API</h3>
        {toggle('whatsapp', 'enabled', 'Enable WhatsApp order alerts')}
        <div className="grid gap-4 sm:grid-cols-2">
          {field('whatsapp', 'recipient', 'Owner WhatsApp number', { type: 'tel', placeholder: '+919876543210', autoComplete: 'off' })}
          {field('whatsapp', 'phoneNumberId', 'WhatsApp business phone-number ID')}
          {field('whatsapp', 'templateName', 'Approved template name', { placeholder: 'store_new_order' })}
          {field('whatsapp', 'language', 'Template language code', { placeholder: 'en' })}
          {field('whatsapp', 'accessToken', 'WhatsApp access token', { type: 'password', autoComplete: 'new-password', placeholder: data.whatsapp.hasAccessToken ? 'Saved securely — leave blank to keep' : 'Enter access token' })}
        </div>
        {toggle('whatsapp', 'consent', 'This recipient has agreed to receive store order alerts')}
        <details className="rounded-xl bg-ivory p-3 text-sm"><summary className="cursor-pointer font-semibold">Template setup and message preview</summary><p className="mt-3">Create an approved WhatsApp template with five body placeholders, in this exact order:</p><ol className="ml-5 mt-2 list-decimal"><li>Store name</li><li>Order number</li><li>Total including currency</li><li>Payment / COD verification status</li><li>Secure admin order link</li></ol><p className="mt-3">Example: New order for {'{{1}}'}. Order {'{{2}}'}, total {'{{3}}'}, payment {'{{4}}'}. Review: {'{{5}}'}.</p><p className="mt-3">A WhatsApp Business Platform account, approved template and valid messaging token are required. A normal WhatsApp number or chat link alone cannot send automatic alerts. Provider charges and template approval apply.</p></details>
        <button type="button" disabled={dirty || !data.whatsapp.enabled} className="admin-btn-ghost" onClick={() => run(() => api.post(`${apiBase}/order-alerts/test`, { channel: 'WHATSAPP' }, { silent: true }), 'WhatsApp test processed. Check delivery history and the recipient phone.')}>Send test WhatsApp</button>
      </section>
      <p className="text-sm text-theme-muted">Save first, then test each enabled channel. Both channels can run together. Enabling alerts starts with new orders; old orders are not broadcast. Existing customer/in-app notifications remain unchanged.</p>
      <div className="flex flex-wrap gap-3"><button type="button" className="admin-btn" disabled={!dirty} onClick={() => run(() => api.put(`${apiBase}/order-alerts`, form, { silent: true }), 'Order alert settings saved. Send a test to confirm your provider setup.', true)}>{busy ? 'Working...' : 'Save order alerts'}</button><button type="button" className="admin-btn-ghost" disabled={!dirty} onClick={() => { setForm(saved); setError(''); }}>Discard alert changes</button><button type="button" className="admin-btn-ghost" disabled={dirty} onClick={load}>Reload settings</button></div>
    </fieldset>
    <section className="space-y-3" aria-labelledby="alert-history-heading">
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 id="alert-history-heading" className="font-bold">Recent alert delivery</h3><button type="button" className="admin-btn-ghost" disabled={busy} onClick={() => run(() => api.get(`${apiBase}/order-alerts`, { silent: true }), 'Delivery status refreshed.')}>Refresh delivery status</button></div>
      <p className="text-sm text-theme-muted">“Provider accepted” confirms submission, not arrival in the inbox. If sending was interrupted, check your provider before retrying. Rate-limited sends retry automatically, up to five attempts. The API service must be running for background delivery.</p>
      {!data.deliveries.length && <p className="rounded-xl border border-theme-border p-4 text-sm">No alerts yet. Save your settings and send a test.</p>}
      <div className="space-y-3">{data.deliveries.map(job => <article key={job._id} className="rounded-xl border border-theme-border p-4 text-sm"><div className="flex flex-wrap justify-between gap-2"><strong>{job.test ? 'Test alert' : `Order ${String(job.orderId || '').slice(-8).toUpperCase()}`} · {job.channel}</strong><span>{labels[job.status] || job.status}</span></div><p className="mt-2 text-theme-muted">{job.reason || 'Waiting for background delivery.'}</p><p className="mt-2 text-xs text-theme-muted">{new Date(job.createdAt).toLocaleString()} · Attempts: {job.attempts}</p>{['FAILED', 'UNCERTAIN'].includes(job.status) && <button type="button" className="admin-btn-ghost mt-3" disabled={busy || dirty} onClick={() => job.status === 'UNCERTAIN' ? setUncertainId(job._id) : retry(job._id)}>Retry alert</button>}{uncertainId === job._id && <div role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-amber-950"><p>The provider might already have sent this alert. Retrying can send a duplicate.</p><button type="button" className="admin-btn-ghost mt-2" disabled={busy} onClick={() => { setUncertainId(''); retry(job._id, true); }}>I checked the provider — retry</button><button type="button" className="ml-3" onClick={() => setUncertainId('')}>Cancel</button></div>}</article>)}</div>
    </section>
  </div>;
}
