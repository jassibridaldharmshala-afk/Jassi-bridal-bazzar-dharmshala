import { useEffect, useRef, useState } from 'react';
import api from '../../services/api';
import { RentalField, RentalStatus } from './RentalUi';
import { rentalDate, rentalOperation, rentalUrl } from '../../utils/rentals';
export function RentalWaitlistJoin({ request, user, storeSlug, onSaved }) {
  const [consent, setConsent] = useState(false), [emailConsent, setEmailConsent] = useState(false), [whatsapp, setWhatsapp] = useState(false), [email, setEmail] = useState(user?.email || ''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState(false);
  const operation = useRef(rentalOperation()), lock = useRef(false);
  useEffect(() => { setSaved(false); setError(''); setConsent(false); operation.current = rentalOperation(); }, [request]);
  const change = setter => value => { setter(value); operation.current = rentalOperation(); };
  const join = async () => {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try { await api.post(rentalUrl('/rentals/waitlist', storeSlug), { ...request, operationId: operation.current, consent, emailConsent, email, whatsappConsent: whatsapp }, { silent: true }); setSaved(true); onSaved?.(); }
    catch (e) { setError(e.details || e.message); } finally { lock.current = false; setBusy(false); }
  };
  return <section className="rental-card"><h3>Notify me if these dates become available</h3><p className="rental-muted">No reservation or payment is made. Availability can change; the normal quote, terms and compulsory advance are still required.</p>{error && <p role="alert" className="rental-notice">{error}</p>}
    {saved ? <p role="status" className="rental-notice">Waitlist request saved. You can manage it in My rentals.</p> : <fieldset disabled={busy}><label className="rental-check"><input type="checkbox" checked={consent} onChange={e => change(setConsent)(e.target.checked)} />I request availability updates for these items and dates</label><label className="rental-check"><input type="checkbox" checked={emailConsent} onChange={e => change(setEmailConsent)(e.target.checked)} />Also notify me by email when enabled by this store</label>{emailConsent && <RentalField label="Waitlist update email" type="email" value={email} onChange={change(setEmail)} />}<label className="rental-check"><input type="checkbox" checked={whatsapp} onChange={e => change(setWhatsapp)(e.target.checked)} />Also notify me on WhatsApp when enabled by this store</label><button type="button" className="rental-button" disabled={!consent || busy || (emailConsent && !email)} onClick={join}>{busy ? 'Saving request…' : 'Join date-specific waitlist'}</button></fieldset>}
  </section>;
}
export default function RentalWaitlist({ storeSlug, navigate }) {
  const [data, setData] = useState(null), [enabled, setEnabled] = useState(false), [error, setError] = useState(''), [page, setPage] = useState(1), [reload, setReload] = useState(0), [busy, setBusy] = useState(false);
  const lock = useRef(false);
  useEffect(() => { let alive = true; api.get(rentalUrl('/rentals/configuration', storeSlug), { silent: true }).then(value => { if (alive) setEnabled(value?.policy?.waitlistEnabled === true); }).catch(() => {}); return () => { alive = false; }; }, [storeSlug]);
  useEffect(() => { let alive = true; api.get(rentalUrl('/rentals/waitlist?page=' + page, storeSlug), { silent: true }).then(value => { if (alive) { setData(value); setError(''); } }).catch(e => { if (alive) setError(e.message); }); return () => { alive = false; }; }, [storeSlug, page, reload]);
  const cancel = async row => {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try { await api.post(rentalUrl('/rentals/waitlist/' + row._id + '/cancel', storeSlug), { revision: row.revision }, { silent: true }); setReload(n => n + 1); }
    catch (e) { setError(e.message); } finally { lock.current = false; setBusy(false); }
  };
  if (!enabled && !data?.total) return null;
  return <section className="rental-card"><h2>My rental waitlist</h2><p className="rental-muted">Notifications do not secure dates. Confirm through the normal booking and compulsory advance process.</p>{error && <p role="alert" className="rental-notice">{error}<button className="rental-button rental-button--secondary" onClick={() => setReload(n => n + 1)}>Reload waitlist</button></p>}
    {data?.rows.map(row => <article key={row._id} className="rental-work-item"><strong>{row.items.map(i => i.title + ' × ' + i.quantity).join(', ')}</strong><p>{rentalDate(row.schedule.pickupAt)} – {rentalDate(row.schedule.returnDueAt)}</p><RentalStatus value={row.status} />{['WAITING', 'NOTIFIED'].includes(row.status) && <div className="rental-actions"><button className="rental-button rental-button--secondary" disabled={busy} onClick={() => cancel(row)}>Cancel availability request</button>{enabled && <button className="rental-button" disabled={busy} onClick={() => navigate('/rental-book?' + new URLSearchParams({ waitlist: row._id }))}>Review availability & book</button>}</div>}</article>)}
    {data && !data.rows.length && <p className="rental-muted">No availability requests yet.</p>}<div className="rental-actions"><button className="rental-button rental-button--secondary" disabled={busy || page <= 1} onClick={() => setPage(p => p - 1)}>Previous requests</button><button className="rental-button rental-button--secondary" disabled={busy || !data || page >= data.pages} onClick={() => setPage(p => p + 1)}>Next requests</button></div>
  </section>;
}
