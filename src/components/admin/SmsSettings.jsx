import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import api from '../../services/api';

export default function SmsSettings({ apiBase = '/admin/settings', onDirtyChange, onBusyChange }) {
  const [data, setData] = useState(null);
  const [source, setSource] = useState('settings');
  const [provider, setProvider] = useState('twofactor');
  const [credentials, setCredentials] = useState({});
  const [otp, setOtp] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [retryAfter, setRetryAfter] = useState(0);
  const [consent, setConsent] = useState(false);
  const lock = useRef(false);
  const generation = useRef(0);
  const base = `${apiBase}/sms`;
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  useEffect(() => { if (!retryAfter) return undefined; const timer = setTimeout(() => setRetryAfter(value => Math.max(0, value - 1)), 1000); return () => clearTimeout(timer); }, [retryAfter]);
  const accept = useCallback(result => {
    setData(result); setRetryAfter(result.retryAfter || 0); setCredentials({}); setOtp(''); setDirty(false); setConsent(false);
    setSource(result.pending?.source || 'settings');
    setProvider(result.pending?.provider || (result.providers.some(item => item.id === result.active?.provider) ? result.active.provider : 'twofactor'));
  }, []);
  const load = useCallback(async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    const version = generation.current;
    try { const result = await api.get(base, { cache: 'no-store', silent: true }); if (version === generation.current) accept(result); }
    catch (e) { if (version === generation.current) setError(e.message || 'OTP settings could not be loaded.'); }
    finally { lock.current = false; if (version === generation.current) setBusy(false); }
  }, [base, accept]);
  useEffect(() => { generation.current += 1; setData(null); load(); return () => { generation.current += 1; }; }, [load]);
  const run = async (action, body, successMessage) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setMessage('');
    const version = generation.current;
    try {
      const result = action === 'save' ? await api.put(base, body) : await api.post(`${base}/${action}`, body);
      if (version !== generation.current) return;
      accept(result); setMessage(successMessage);
    } catch (e) { if (version === generation.current) setError(e.message || 'The request could not be completed. Reload to check the saved state before retrying.'); }
    finally { lock.current = false; if (version === generation.current) setBusy(false); }
  };
  const edit = () => { setDirty(true); setError(''); setMessage(''); setConsent(false); setOtp(''); };
  const definition = data?.providers.find(item => item.id === provider);
  const saved = [data?.pending, data?.active].find(item => item?.source === 'settings' && item.provider === provider)?.savedFields || [];
  const label = id => data?.providers.find(item => item.id === id)?.label || id;
  const save = () => {
    if (source === 'settings' && definition.fields.some(field => field.required && !credentials[field.key]?.trim() && !saved.includes(field.key))) { setError('Fill all required provider credentials before saving the draft.'); return; }
    run('save', { revision: data.revision, source, ...(source === 'settings' ? { provider, credentials } : {}) }, 'Draft saved securely. Your active provider is unchanged. Send a test OTP, then verify it to activate.');
  };
  return <section aria-label="OTP and SMS settings" onKeyDown={event => { if (event.key === 'Enter' && event.target.tagName === 'INPUT') event.preventDefault(); }}>
    <div className="store-settings__tip"><ShieldCheck size={20} /><p>This setting controls SMS login, phone verification and COD OTPs for this entire backend, including administrator login. Each separately deployed client has its own configuration. Email OTP is unchanged.</p></div>
    {error && <div className="store-settings__notice" role="alert"><p>{error}</p><button type="button" className="admin-btn-ghost" disabled={busy} onClick={load}>Reload OTP settings</button><small>Reload discards unsaved credential inputs, never the active provider.</small></div>}
    {message && <p role="status" className="my-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p>}
    {!data ? <p className="admin-note mt-4">{busy ? 'Loading OTP settings…' : 'Only a verified deployment administrator can manage this configuration.'}</p> : <fieldset disabled={busy} className="min-w-0 space-y-5">
      <div className="rounded-xl border border-slate-200 p-4"><strong>Active provider: {label(data.active.provider)}</strong><p className="admin-note">{data.active.source === 'environment' ? 'Using backend environment configuration.' : 'Using verified, encrypted Settings configuration.'} {data.active.configured ? '' : 'SMS setup is incomplete.'}</p>{data.active.verifiedAt && <p className="admin-note">Last verified {new Date(data.active.verifiedAt).toLocaleString('en-IN')}</p>}</div>
      {data.demoMode && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm">Customer OTP demo mode is enabled on the backend. Saving a provider does not turn demo mode off. Set OTP_MODE=production on the backend for real customer OTPs. The test below always sends a real SMS and may incur provider charges.</p>}
      {data.environmentOverride && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm">Emergency backend override is enabled. Remove SMS_CONFIG_SOURCE=environment before activating a Settings provider.</p>}
      <div className="flex items-center gap-2"><KeyRound size={18} /><h3>1. Prepare provider configuration</h3></div>
      <label className="store-settings__field"><span>Configuration source</span><select aria-label="Configuration source" value={source} onChange={event => { setSource(event.target.value); setCredentials({}); edit(); }}><option value="settings">Manage provider in Settings</option><option value="environment" disabled={!data.environment.configured}>Use backend environment configuration</option></select><small>Switching source also requires a successful test. There is no automatic fallback to another provider.</small></label>
      {source === 'settings' ? <>
        <label className="store-settings__field"><span>OTP provider</span><select value={provider} onChange={event => { setProvider(event.target.value); setCredentials({}); edit(); }}>{data.providers.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <div className="grid gap-4 sm:grid-cols-2">{definition?.fields.map(field => <div key={`${provider}-${field.key}`}><label className="store-settings__field"><span>{field.label}{field.required ? ' *' : ' (optional)'}</span><input aria-label={field.label} type="password" autoComplete="new-password" spellCheck={false} maxLength={512} disabled={credentials[field.key] === null} value={credentials[field.key] || ''} placeholder={saved.includes(field.key) ? 'Saved securely — leave blank to keep' : `Enter ${field.label.toLowerCase()}`} onChange={event => { setCredentials(current => ({ ...current, [field.key]: event.target.value })); edit(); }} /><small>{saved.includes(field.key) ? 'A saved value exists for this provider. It is never returned to the browser.' : 'Stored encrypted on the backend, not in browser storage.'}</small></label>{!field.required && saved.includes(field.key) && <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={credentials[field.key] === null} onChange={event => { setCredentials(current => ({ ...current, [field.key]: event.target.checked ? null : '' })); edit(); }} />Clear saved {field.label.toLowerCase()}</label>}</div>)}</div>
        <p className="admin-note">Use this client's own provider account and approved OTP template/sender. Account balance, template approval and carrier delivery remain with the provider.</p>
      </> : <p className="admin-note">Prepare the currently configured backend provider: {data.environment.label}. Backend credentials are never displayed here.</p>}
      <button type="button" className="admin-btn" disabled={!dirty || busy} onClick={save}>Save provider draft</button>
      {data.pending && <div className="space-y-4 rounded-xl border border-slate-200 p-4">
        <h3>2. Test and activate {label(data.pending.provider)}</h3>
        <p className="admin-note">Saved draft · {data.pending.source === 'environment' ? 'Backend environment' : 'Settings'}. Your current provider continues to serve logins until this test is verified. Only the administrator who receives the test can activate it.</p>
        {dirty && <p role="status" className="text-sm text-amber-800">Save or reload your edited inputs before testing the draft.</p>}
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} /><span>Send a real test SMS to my verified number {data.phoneMasked}. Provider charges may apply.</span></label>
        <button type="button" className="admin-btn-ghost" disabled={busy || dirty || !consent || retryAfter > 0 || data.environmentOverride} onClick={() => run('test', { revision: data.revision }, 'Test SMS accepted by the provider. Enter the code you actually receive to activate; SMS acceptance alone is not activation.')}>{retryAfter > 0 ? `Test again in ${retryAfter}s` : 'Send test OTP'}</button>
        {data.challenge && <div className="space-y-3"><label className="store-settings__field"><span>Test OTP</span><input aria-label="Test OTP" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={event => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} /><small>Expires {new Date(data.challenge.expiresAt).toLocaleTimeString('en-IN')}. Five incorrect attempts require a new test. This code cannot be used to log in.</small></label><button type="button" className="admin-btn" disabled={busy || dirty || otp.length !== 6 || data.environmentOverride} onClick={() => run('activate', { revision: data.revision, challengeId: data.challenge.id, otp }, 'OTP provider activated. New real SMS OTP requests now use this provider.')}>Verify OTP and activate</button></div>}
        <button type="button" className="admin-btn-ghost" disabled={busy || dirty} onClick={() => run('discard', { revision: data.revision }, 'Draft discarded. Your active provider is unchanged.')}>Discard provider draft</button>
      </div>}
      <p className="admin-note">Provider changes do not change OTP expiry, resend limits or your session. Settings take effect without a server restart. Test codes are random even in demo mode.</p>
    </fieldset>}
  </section>;
}
