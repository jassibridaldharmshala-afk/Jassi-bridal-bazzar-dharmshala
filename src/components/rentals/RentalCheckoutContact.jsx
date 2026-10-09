import { useEffect, useRef, useState } from 'react';
import { BadgeCheck, MessageSquare, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { normalizeIndianPhone } from '../../utils/phoneFormatter';
import { clearRentalSession, readRentalSession, saveRentalSession } from '../../utils/rentalPlan';
import { saveGuestRentalContact } from '../../utils/rentalContactDraft';
import { editableRentalDetails } from '../../utils/rentalDetails';
import { storefrontPath } from '../../utils/routing';
import { RentalContactFields } from './RentalCheckoutFields';

function readChallenge(storeSlug, user) {
  const value = readRentalSession('otp-challenge', storeSlug);
  if (value && (!user || value.sourcePhone === normalizeIndianPhone(user.phone) || normalizeIndianPhone(value.phone) === normalizeIndianPhone(user.phone)) && normalizeIndianPhone(value.phone) && Number.isInteger(value.otpLength) && value.otpLength >= 4 && value.otpLength <= 8 && Number.isFinite(value.expiresAt) && value.expiresAt > Date.now() && value.expiresAt <= Date.now() + 3600000 && Number.isFinite(value.cooldownUntil)) return value;
  clearRentalSession('otp-challenge', storeSlug); return null;
}
function readPhoneEntry(storeSlug, user) {
  const value = readRentalSession('phone-entry', storeSlug);
  if (value && Date.now() - value.savedAt < 1800000 && value.sourcePhone === (normalizeIndianPhone(user?.phone) || '') && normalizeIndianPhone(value.phone)) return value.phone;
  clearRentalSession('phone-entry', storeSlug); return '';
}
export default function RentalCheckoutContact({ form, details, addresses, onChange, onDetails, onContinue, onState, onVerificationChange, storeSlug }) {
  const { user, sendOtp, resendOtp, verifyOtp } = useAuth();
  const saved = useRef(readChallenge(storeSlug, user));
  const entered = useRef(readPhoneEntry(storeSlug, user));
  const initialPhone = saved.current?.phone || entered.current || normalizeIndianPhone(user?.phone) || form.phone || '';
  const [phone, setPhone] = useState(initialPhone);
  const [challenge, setChallenge] = useState(() => saved.current?.expiresAt > Date.now() ? saved.current : null);
  const [otp, setOtp] = useState([]), [consent, setConsent] = useState(saved.current?.expiresAt > Date.now()), [changing, setChanging] = useState(!!user && normalizeIndianPhone(initialPhone) !== normalizeIndianPhone(user.phone));
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [now, setNow] = useState(Date.now());
  const inputs = useRef([]), lock = useRef(false), alive = useRef(true), generation = useRef(0);
  const normalized = normalizeIndianPhone(phone);
  const verified = !!user?.isPhoneVerified && !changing && normalized === normalizeIndianPhone(user.phone);
  const length = challenge?.otpLength || 6;
  const cooldown = Math.max(0, Math.ceil(((challenge?.cooldownUntil || 0) - now) / 1000));
  const expired = challenge && challenge.expiresAt <= now;
  const label = verified ? 'Review booking' : challenge ? 'Verify & continue' : 'Send OTP';
  useEffect(() => { onState({ label, busy, verified, disabled: busy || (!verified && (!normalized || !consent || (challenge && (otp.filter(Boolean).length !== length || expired)))) }); }, [label, busy, verified, normalized, consent, challenge, otp, length, expired, onState]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { if (!challenge) return undefined; const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, [challenge]);
  const clearChallenge = () => { setChallenge(null); setOtp([]); clearRentalSession('otp-challenge', storeSlug); };
  const editPhone = value => {
    generation.current++; const next = normalizeIndianPhone(value) || value.replace(/\D/g, '').slice(0, 10); setPhone(next);
    saveRentalSession('phone-entry', storeSlug, { phone: next, sourcePhone: normalizeIndianPhone(user?.phone) || '' });
    clearChallenge(); setError(''); onVerificationChange();
  };
  const recordChallenge = result => {
    const otpLength = Number.isInteger(result?.otpLength) && result.otpLength >= 4 && result.otpLength <= 8 ? result.otpLength : 6;
    const seconds = Number.isFinite(result?.resendAfterSeconds) ? Math.max(0, Math.min(3600, result.resendAfterSeconds)) : 60;
    const expires = Number.isFinite(result?.expiresInSeconds) ? Math.max(60, Math.min(3600, result.expiresInSeconds)) : 300;
    const value = { phone: normalized, sourcePhone: normalizeIndianPhone(user?.phone) || '', otpLength, expiresAt: Date.now() + expires * 1000, cooldownUntil: Date.now() + seconds * 1000 };
    setChallenge(value); setOtp([]); setNow(Date.now()); saveRentalSession('otp-challenge', storeSlug, value);
    setConsent(true); setTimeout(() => inputs.current[0]?.focus(), 0);
  };
  const submit = async (event, resend = false) => {
    event?.preventDefault(); if (lock.current) return;
    if (!form.name.trim()) { setError('Enter your full name for this booking.'); return; }
    if (!normalized) { setError('Enter a valid 10-digit Indian mobile number.'); return; }
    if (!verified && !consent) { setError('Accept the account terms and privacy policy to verify your number.'); return; }
    if (resend && cooldown) return;
    if (!resend && challenge && !verified && (otp.filter(Boolean).length !== length || expired)) { setError(expired ? 'This OTP has expired. Request a new code.' : `Enter the ${length}-digit OTP.`); return; }
    lock.current = true; setBusy(true); setError(''); const current = ++generation.current;
    try {
      if (verified && !resend) await onContinue(user);
      else if (!challenge || resend) {
        const result = await (resend ? resendOtp(normalized) : sendOtp(normalized));
        if (alive.current && current === generation.current) recordChallenge(result);
      } else {
        // Account-scoped sale cart/wishlist providers remount their children on sign-in.
        // This short-lived, code-free handoff lets the new checkout re-quote the same plan.
        saveGuestRentalContact(storeSlug, { customer: { name: form.name, email: user ? '' : form.email, whatsappConsent: user ? false : form.whatsappConsent }, details: user ? editableRentalDetails(null, null) : details });
        saveRentalSession('verification-return', storeSlug, { phone: normalized, expiresAt: Date.now() + 300000 });
        const result = await verifyOtp({ phone: normalized, otp: otp.join(''), redirectTo: storefrontPath('/rental-checkout', storeSlug), navigateOnSuccess: false });
        if (!result?.user?.isPhoneVerified || normalizeIndianPhone(result.user.phone) !== normalized) throw new Error('Your mobile verification could not be confirmed. Please retry.');
        if (alive.current && current === generation.current) { clearChallenge(); setChanging(false); await onContinue(result.user); }
      }
    } catch (err) { clearRentalSession('verification-return', storeSlug); if (alive.current && current === generation.current) setError(err.message || 'Verification could not be completed. Please retry.'); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  };
  const digits = Array.from({ length }, (_, index) => otp[index] || '');
  const enterDigit = (index, value) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length > 1) { setOtp(numbers.slice(0, length).split('')); inputs.current[Math.min(numbers.length, length) - 1]?.focus(); return; }
    const next = [...digits]; next[index] = numbers.slice(-1); setOtp(next);
    if (numbers && index < length - 1) inputs.current[index + 1]?.focus();
  };
  const phoneControl = <label>Mobile number<div className="rental-mobile-number"><span>+91</span><input aria-label="Mobile number" type="tel" inputMode="tel" autoComplete="tel-national" maxLength={14} value={phone} readOnly={verified || !!challenge} onChange={event => editPhone(event.target.value)} />{(verified || challenge) && <button type="button" className="rental-shopping-link" disabled={busy} onClick={() => { generation.current++; setChanging(true); clearChallenge(); setError(''); onVerificationChange(); }}>Change</button>}</div></label>;
  return <form id="rental-checkout-contact-form" onSubmit={submit} noValidate className="rental-contact-form">
    <RentalContactFields form={form} details={details} addresses={addresses} onChange={onChange} onDetails={onDetails} phoneControl={phoneControl} />
    {verified ? <p className="rental-verified-contact"><BadgeCheck size={17} />Verified account number</p> : <>
      {changing && user && <p className="rental-shopping-hint">Verify this number to use its account for your booking. <button type="button" className="rental-shopping-link" onClick={() => { setChanging(false); setPhone(normalizeIndianPhone(user.phone)); clearRentalSession('phone-entry', storeSlug); clearChallenge(); setError(''); }}>Use my current account</button></p>}
      <label className="rental-shopping-check rental-account-consent"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} /> <span>I agree to the <a href={storefrontPath('/terms', storeSlug)}>account terms</a> and <a href={storefrontPath('/privacy-policy', storeSlug)}>privacy policy</a>.</span></label>
      {challenge && <div className="rental-otp-panel"><p className="rental-otp-sent" role="status"><MessageSquare size={16} />OTP sent to +91 {challenge.phone.slice(0, 2)}••••{challenge.phone.slice(-4)}</p><label htmlFor="rental-otp-1">Enter {length}-digit OTP</label><div className="rental-otp-inputs">{digits.map((digit, index) => <input key={index} ref={element => { inputs.current[index] = element; }} id={`rental-otp-${index + 1}`} aria-label={`OTP digit ${index + 1}`} autoComplete={index === 0 ? 'one-time-code' : 'off'} inputMode="numeric" type="text" value={digit} maxLength={length} onChange={event => enterDigit(index, event.target.value)} onPaste={event => { const value = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, length); if (value) { event.preventDefault(); setOtp(value.split('')); inputs.current[value.length - 1]?.focus(); } }} onKeyDown={event => { if (event.key === 'Backspace' && !digit && index) inputs.current[index - 1]?.focus(); }} />)}</div>{expired && <p className="rental-slot-error" role="alert">This OTP has expired. Request a new code.</p>}<button type="button" className="rental-shopping-link" disabled={busy || cooldown > 0} onClick={event => submit(event, true)}>{cooldown ? `Resend OTP in ${Math.floor(cooldown / 60)}:${String(cooldown % 60).padStart(2, '0')}` : 'Resend OTP'}</button></div>}
    </>}
    {error && <p role="alert" className="rental-slot-error">{error}</p>}
    <p className="rental-contact-security"><ShieldCheck size={17} />Your verified number is used for booking updates.</p>
  </form>;
}
