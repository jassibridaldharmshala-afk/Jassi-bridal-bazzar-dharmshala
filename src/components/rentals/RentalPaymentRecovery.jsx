import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../services/api';
import { rentalDate, rentalMoney } from '../../utils/rentals';
import { RentalStatus } from './RentalUi';

export default function RentalPaymentRecovery({ base, booking, run, onRecovered, busy }) {
  const [rows, setRows] = useState([]), [error, setError] = useState(''), [checking, setChecking] = useState(false);
  const lock = useRef(false), readVersion = useRef(0), mounted = useRef(true);
  const load = useCallback(async () => {
    const version = ++readVersion.current;
    try { const value = await api.get(`${base}/bookings/${booking._id}/payments`, { silent: true }); if (version === readVersion.current && mounted.current) { setRows(Array.isArray(value) ? value : []); setError(''); } }
    catch (e) { if (version === readVersion.current && mounted.current) setError(e.details || e.message); }
  }, [base, booking._id]);
  useEffect(() => { mounted.current = true; load(); return () => { mounted.current = false; readVersion.current += 1; }; }, [load, booking.revision]);
  const check = async payment => {
    if (lock.current) return; lock.current = true; setChecking(true);
    try { const result = await run(() => api.post(`${base}/bookings/${booking._id}/payments/${payment._id}/reconcile`, {}, { silent: true })); if (mounted.current && result?.booking) onRecovered(result.booking); if (mounted.current) await load(); }
    catch (e) { if (mounted.current) setError(e.details || e.message); }
    finally { lock.current = false; if (mounted.current) setChecking(false); }
  };
  return <section aria-label="Rental payment recovery"><h3>Online payment recovery</h3><p className="rental-muted">Recheck reads provider records; it never starts another charge. Explicitly rejected setups allow a new attempt or manual receipt. Unknown outcomes stay under review until verified—do not collect twice.</p>{error && <p role="alert">{error}</p>}<button type="button" className="rental-button rental-button--secondary" disabled={busy || checking} onClick={load}>Refresh payment attempts</button>{!rows.length && <p className="rental-muted">No online payment attempts recorded.</p>}{rows.map(payment => <div className="rental-choice" key={payment._id}><div><strong>{rentalMoney(payment.amountPaise)}</strong><p className="rental-muted">{payment.orderId || 'Provider order not yet confirmed'} · {rentalDate(payment.createdAt, booking.policy.timezone)}</p>{payment.lastRecoveryError && <p className="rental-muted">{payment.lastRecoveryError}</p>}{payment.lastCheckedAt && <p className="rental-muted">Last checked {rentalDate(payment.lastCheckedAt, booking.policy.timezone)}</p>}</div><RentalStatus value={payment.state} />{payment.state !== 'CAPTURED' && payment.setupFailure !== 'REJECTED' && <button type="button" disabled={busy || checking} className="rental-button rental-button--secondary" onClick={() => check(payment)}>{checking ? 'Checking provider…' : 'Recheck provider'}</button>}</div>)}</section>;
}
