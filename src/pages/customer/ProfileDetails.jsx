import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { digitsOnly, isValidIndianMobile, PHONE_VALIDATION_MESSAGE } from '../../utils/phoneInput';

const baseInputClass = 'h-[48px] w-full rounded-none border border-[#e5e7eb] px-4 text-[14px] text-[#182033] outline-none placeholder:text-slate-400 focus:border-[#ff4f7d]';
const fieldLabelClass = 'absolute left-4 top-[-9px] bg-white px-1 text-[12px] text-slate-400';

export default function ProfileDetails() {
  const {
    user,
    updateProfile,
    deleteProfile,
    sendProfilePhoneChangeOtp,
    verifyProfilePhoneChangeOtp,
    sendProfileEmailChangeOtp,
    verifyProfileEmailChangeOtp,
  } = useAuth();

  const [form, setForm] = useState(() => buildForm(user));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mobileEditable, setMobileEditable] = useState(false);
  const [emailEditable, setEmailEditable] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [phoneVerificationToken, setPhoneVerificationToken] = useState('');
  const [emailVerificationToken, setEmailVerificationToken] = useState('');
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [phoneOtpSending, setPhoneOtpSending] = useState(false);
  const [emailOtpSending, setEmailOtpSending] = useState(false);
  const [phoneOtpVerifying, setPhoneOtpVerifying] = useState(false);
  const [emailOtpVerifying, setEmailOtpVerifying] = useState(false);
  useEffect(() => {
    setForm(buildForm(user));
    resetVerificationState(setPhoneOtp, setEmailOtp, setPhoneVerificationToken, setEmailVerificationToken, setPhoneOtpSent, setEmailOtpSent);
  }, [user]);

  const normalizedCurrentPhone = normalizePhone(user?.phone || '');
  const normalizedDraftPhone = normalizePhone(form.phone || '');
  const normalizedCurrentEmail = normalizeEmail(user?.email || '');
  const normalizedDraftEmail = normalizeEmail(form.email || '');
  const phoneChanged = normalizedDraftPhone && normalizedDraftPhone !== normalizedCurrentPhone;
  const emailChanged = normalizedDraftEmail !== normalizedCurrentEmail;
  const mobileVerified = useMemo(() => {
    if (phoneChanged) return Boolean(phoneVerificationToken);
    return Boolean(user?.isPhoneVerified);
  }, [phoneChanged, phoneVerificationToken, user]);
  const emailVerified = useMemo(() => {
    if (!normalizedDraftEmail) return false;
    if (emailChanged) return Boolean(emailVerificationToken);
    return Boolean(user?.isEmailVerified);
  }, [emailChanged, emailVerificationToken, normalizedDraftEmail, user]);

  const onChange = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError('');
    setSuccess('');

    if (key === 'phone') {
      setPhoneOtp('');
      setPhoneVerificationToken('');
      setPhoneOtpSent(false);
    }

    if (key === 'email') {
      setEmailOtp('');
      setEmailVerificationToken('');
      setEmailOtpSent(false);
    }
  };

  const requestPhoneOtp = async () => {
    const phone = normalizePhone(form.phone);
    if (!phone) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }
    setError('');
    setSuccess('');
    setPhoneOtpSending(true);
    try {
      await sendProfilePhoneChangeOtp(phone);
      setPhoneOtpSent(true);
      setSuccess('OTP sent to your new mobile number');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPhoneOtpSending(false);
    }
  };

  const requestEmailOtp = async () => {
    const email = normalizeEmail(form.email);
    if (!email) {
      setError('Please enter a valid email address');
      return;
    }
    setError('');
    setSuccess('');
    setEmailOtpSending(true);
    try {
      await sendProfileEmailChangeOtp(email);
      setEmailOtpSent(true);
      setSuccess('OTP sent to your email address');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setEmailOtpSending(false);
    }
  };

  const confirmPhoneOtp = async () => {
    const phone = normalizePhone(form.phone);
    if (!phone || phoneOtp.length !== 6) {
      setError('Please enter the 6-digit mobile OTP');
      return;
    }
    setError('');
    setSuccess('');
    setPhoneOtpVerifying(true);
    try {
      const response = await verifyProfilePhoneChangeOtp({ phone, otp: phoneOtp });
      setPhoneVerificationToken(response.verificationToken || '');
      setSuccess('Mobile number verified successfully');
    } catch (verifyError) {
      setError(verifyError.message);
    } finally {
      setPhoneOtpVerifying(false);
    }
  };

  const confirmEmailOtp = async () => {
    const email = normalizeEmail(form.email);
    if (!email || emailOtp.length !== 6) {
      setError('Please enter the 6-digit email OTP');
      return;
    }
    setError('');
    setSuccess('');
    setEmailOtpVerifying(true);
    try {
      const response = await verifyProfileEmailChangeOtp({ email, otp: emailOtp });
      setEmailVerificationToken(response.verificationToken || '');
      setSuccess('Email verified successfully');
    } catch (verifyError) {
      setError(verifyError.message);
    } finally {
      setEmailOtpVerifying(false);
    }
  };

  const onSave = async () => {
    setError('');
    setSuccess('');

    if (!form.name.trim()) {
      setError('Please enter your full name');
      return;
    }

    if (!isValidIndianMobile(form.phone)) {
      setError(PHONE_VALIDATION_MESSAGE);
      return;
    }

    if (phoneChanged && !phoneVerificationToken) {
      setError('Please verify your new mobile number before saving');
      return;
    }

    if (normalizedDraftEmail && emailChanged && !emailVerificationToken) {
      setError('Please verify your email before saving');
      return;
    }

    const parsedBirthDate = parseBirthDate(form.birthDate);
    if (form.birthDate && !parsedBirthDate) {
      setError('Please enter birthday in dd/mm/yyyy format');
      return;
    }

    setSaving(true);
    try {
      const profile = await updateProfile({
        name: form.name.trim(),
        email: normalizedDraftEmail,
        phone: normalizedDraftPhone,
        phoneVerificationToken,
        emailVerificationToken,
        gender: form.gender,
        birthDate: parsedBirthDate || '',
        alternatePhone: normalizePhone(form.alternatePhone, true),
        hintName: form.hintName.trim(),
      });
      setForm(buildForm(profile));
      resetVerificationState(setPhoneOtp, setEmailOtp, setPhoneVerificationToken, setEmailVerificationToken, setPhoneOtpSent, setEmailOtpSent);
      setMobileEditable(false);
      setEmailEditable(false);
      setSuccess('Details saved successfully');
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    const confirmed = window.confirm('Are you sure you want to delete this account? This action cannot be undone.');
    if (!confirmed) return;
    setDeleting(true);
    setError('');
    try {
      await deleteProfile();
    } catch (deleteError) {
      setError(deleteError.message);
      setDeleting(false);
    }
  };

  return (
    <section className="min-h-screen bg-[#f6f7fb] pb-28">
      <div className="mx-auto w-full max-w-[470px] bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.06)] md:mt-6 md:rounded-[24px] md:pb-6">
        <div className="border-b border-slate-100 px-5 py-6">
          <h1 className="text-[18px] font-bold text-charcoal md:text-[22px]">Edit Details</h1>
        </div>

        <div className="space-y-8 px-5 py-6">
          <div className="grid grid-cols-[1fr_170px] gap-3">
            <div className="relative">
              <span className={fieldLabelClass}>Mobile Number*</span>
              <div className={`${baseInputClass} flex items-center justify-between gap-2`}>
                <span className="truncate">{form.phone}</span>
                {mobileVerified ? <CheckCircle2 className="h-5 w-5 shrink-0 text-[#00a86b]" /> : null}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMobileEditable((value) => !value)}
              className="h-[48px] border border-[#e5e7eb] text-[14px] font-bold text-charcoal"
            >
              {mobileEditable ? 'DONE' : 'CHANGE'}
            </button>
            {mobileEditable ? (
              <div className="col-span-2 space-y-3">
                <input
                  value={form.phone}
                  disabled={phoneOtpSending || phoneOtpVerifying || saving}
                  onChange={(event) => onChange('phone', digitsOnly(event.target.value, 10))}
                  className={baseInputClass}
                  placeholder="Enter mobile number"
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={10}
                  pattern="[0-9]*"
                />
                {form.phone && !isValidIndianMobile(form.phone) ? (
                  <p className="text-[12px] font-medium text-[#c81e4a]">{PHONE_VALIDATION_MESSAGE}</p>
                ) : null}
                {phoneChanged ? (
                  <>
                    <div className="flex gap-3">
                      <button type="button" onClick={requestPhoneOtp} disabled={phoneOtpSending || phoneOtpVerifying || saving} className="h-[44px] min-w-[128px] border border-[#e5e7eb] px-4 text-[13px] font-bold text-charcoal disabled:opacity-60">
                        {phoneOtpSending ? 'Sending...' : (phoneOtpSent ? 'Resend OTP' : 'Send OTP')}
                      </button>
                      <input
                        value={phoneOtp}
                        disabled={phoneOtpSending || phoneOtpVerifying || saving}
                        onChange={(event) => setPhoneOtp(digitsOnly(event.target.value, 6))}
                        className={`${baseInputClass} h-[44px] flex-1`}
                        placeholder="Enter OTP"
                        inputMode="numeric"
                      />
                    </div>
                    <button type="button" onClick={confirmPhoneOtp} disabled={phoneOtpSending || phoneOtpVerifying || saving || phoneOtp.length !== 6} className="h-[44px] w-full border border-[#ff3f7f] text-[13px] font-bold text-[#ff3f7f] disabled:opacity-60">
                      {phoneOtpVerifying ? 'Verifying...' : (phoneVerificationToken ? 'Verified' : 'Verify Mobile Number')}
                    </button>
                    <VerificationNote verified={Boolean(phoneVerificationToken)} pendingText="New number needs OTP verification before save." />
                  </>
                ) : (
                  <p className="text-[12px] text-slate-500">Your current number is already linked to this account.</p>
                )}
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-[1fr_170px] gap-3">
            <div className="relative">
              <span className={fieldLabelClass}>Email</span>
              <div className={`${baseInputClass} flex items-center justify-between gap-2`}>
                <span className="truncate">{form.email || 'Add your email'}</span>
                {emailVerified ? <CheckCircle2 className="h-5 w-5 shrink-0 text-[#00a86b]" /> : null}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEmailEditable((value) => !value)}
              className="h-[48px] border border-[#e5e7eb] text-[14px] font-bold text-charcoal"
            >
              {emailEditable ? 'DONE' : 'CHANGE'}
            </button>
            {emailEditable ? (
              <div className="col-span-2 space-y-3">
                <input
                  value={form.email}
                  disabled={emailOtpSending || emailOtpVerifying || saving}
                  onChange={(event) => onChange('email', event.target.value)}
                  className={baseInputClass}
                  placeholder="Enter email"
                  type="email"
                />
                {normalizedDraftEmail && emailChanged ? (
                  <>
                    <div className="flex gap-3">
                      <button type="button" onClick={requestEmailOtp} disabled={emailOtpSending || emailOtpVerifying || saving} className="h-[44px] min-w-[128px] border border-[#e5e7eb] px-4 text-[13px] font-bold text-charcoal disabled:opacity-60">
                        {emailOtpSending ? 'Sending...' : (emailOtpSent ? 'Resend OTP' : 'Send OTP')}
                      </button>
                      <input
                        value={emailOtp}
                        disabled={emailOtpSending || emailOtpVerifying || saving}
                        onChange={(event) => setEmailOtp(digitsOnly(event.target.value, 6))}
                        className={`${baseInputClass} h-[44px] flex-1`}
                        placeholder="Enter OTP"
                        inputMode="numeric"
                      />
                    </div>
                    <button type="button" onClick={confirmEmailOtp} disabled={emailOtpSending || emailOtpVerifying || saving || emailOtp.length !== 6} className="h-[44px] w-full border border-[#ff3f7f] text-[13px] font-bold text-[#ff3f7f] disabled:opacity-60">
                      {emailOtpVerifying ? 'Verifying...' : (emailVerificationToken ? 'Verified' : 'Verify Email')}
                    </button>
                    <VerificationNote verified={Boolean(emailVerificationToken)} pendingText="Email must be verified before save." />
                  </>
                ) : normalizedDraftEmail ? (
                  <p className="text-[12px] text-slate-500">{emailVerified ? 'Your email is verified.' : 'This email is on your account.'}</p>
                ) : (
                  <p className="text-[12px] text-slate-500">Add an email and verify it with OTP before saving.</p>
                )}
              </div>
            ) : null}
          </div>

          <div className="relative">
            <span className={fieldLabelClass}>Full Name</span>
            <input value={form.name} onChange={(event) => onChange('name', event.target.value)} className={baseInputClass} placeholder="Full name" />
          </div>

          <div className="grid grid-cols-2 overflow-hidden border border-[#e5e7eb]">
            {['male', 'female'].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => onChange('gender', value)}
                className={`flex h-[48px] items-center justify-center gap-2 text-[14px] ${form.gender === value ? 'text-[#182033]' : 'text-slate-500'} ${value === 'male' ? 'border-r border-[#e5e7eb]' : ''}`}
              >
                <span className={`text-[15px] ${form.gender === value ? 'text-[#ff4f7d]' : 'text-transparent'}`}>✓</span>
                <span className="capitalize">{value}</span>
              </button>
            ))}
          </div>

          <div className="relative">
            <span className={fieldLabelClass}>Birthday (dd/mm/yyyy)</span>
            <input value={form.birthDate} onChange={(event) => onChange('birthDate', formatBirthInput(event.target.value))} className={baseInputClass} placeholder="dd/mm/yyyy" inputMode="numeric" />
          </div>

          <div>
            <h2 className="text-[16px] font-bold text-charcoal">Alternate mobile details</h2>
            <div className="mt-5 space-y-5">
              <div>
                <div className="sc-field-shell flex h-[48px] overflow-hidden border border-[#e5e7eb] focus-within:border-wine focus-within:ring-2 focus-within:ring-wine/10">
                  <div className="flex w-[64px] items-center justify-center border-r border-[#e5e7eb] text-[13px] text-slate-400">+91</div>
                  <input value={form.alternatePhone} onChange={(event) => onChange('alternatePhone', digitsOnly(event.target.value, 10))} className="h-full w-full px-4 text-[14px] text-[#182033] outline-none placeholder:text-slate-400" placeholder="Alternate mobile number" inputMode="numeric" autoComplete="tel" maxLength={10} pattern="[0-9]*" />
                </div>
                {form.alternatePhone && !isValidIndianMobile(form.alternatePhone) ? (
                  <p className="mt-2 text-[12px] font-medium text-[#c81e4a]">{PHONE_VALIDATION_MESSAGE}</p>
                ) : null}
              </div>

              <div className="relative">
                <span className={fieldLabelClass}>Hint name</span>
                <input value={form.hintName} onChange={(event) => onChange('hintName', event.target.value)} className={baseInputClass} placeholder="Hint name" />
              </div>
            </div>
          </div>

          {(error || success) ? (
            <div className={`rounded-[14px] px-4 py-3 text-[13px] font-medium ${error ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
              {error || success}
            </div>
          ) : null}

          <div className="border-t border-slate-100 pt-6 text-center">
            <button type="button" onClick={onDelete} disabled={deleting} className="text-[14px] font-bold uppercase tracking-[0.01em] text-[#ff4f7d] disabled:opacity-60">
              {deleting ? 'Deleting Account...' : 'Delete Account'}
            </button>
          </div>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:static md:border-0 md:bg-transparent md:px-5 md:pt-0">
          <div className="mx-auto w-full max-w-[470px]">
            <button type="button" onClick={onSave} disabled={saving || deleting || phoneOtpSending || phoneOtpVerifying || emailOtpSending || emailOtpVerifying} className="h-[46px] w-full rounded-[4px] bg-[#ff3f7f] text-[15px] font-bold uppercase tracking-[0.01em] text-white disabled:opacity-60">
              {saving ? 'Saving Details...' : 'Save Details'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function VerificationNote({ verified, pendingText }) {
  if (verified) return <p className="text-[12px] font-medium text-emerald-600">Verified successfully.</p>;
  return <p className="text-[12px] text-slate-500">{pendingText}</p>;
}

function resetVerificationState(setPhoneOtp, setEmailOtp, setPhoneVerificationToken, setEmailVerificationToken, setPhoneOtpSent, setEmailOtpSent) {
  setPhoneOtp('');
  setEmailOtp('');
  setPhoneVerificationToken('');
  setEmailVerificationToken('');
  setPhoneOtpSent(false);
  setEmailOtpSent(false);
}

function buildForm(user) {
  return {
    phone: user?.phone || '',
    email: user?.email || '',
    name: user?.name || '',
    gender: user?.gender || '',
    birthDate: formatBirthDate(user?.birthDate),
    alternatePhone: user?.alternatePhone || '',
    hintName: user?.hintName || '',
  };
}

function normalizePhone(value, allowEmpty = false) {
  const digits = digitsOnly(value, 10);
  if (!digits) return '';
  if (allowEmpty && !isValidIndianMobile(digits)) return '';
  return isValidIndianMobile(digits) ? digits : '';
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function formatBirthDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatBirthInput(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function parseBirthDate(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const iso = `${year}-${month}-${day}`;
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getDate() !== Number(day) || date.getMonth() + 1 !== Number(month) || date.getFullYear() !== Number(year)) return null;
  return iso;
}
