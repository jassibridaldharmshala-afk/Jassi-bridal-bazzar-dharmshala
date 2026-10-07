import { useMemo, useState } from 'react';
import { Button, Card, CardContent, Dialog, DialogContent } from '../ui';
import { cn } from '../../lib/utils';
import { clearOtpState } from '../../utils/loginOtpStorage';
import { normalizeIndianPhone } from '../../utils/phoneFormatter';

export { clearLoginPromptDismissed, markLoginPromptDismissed, isLoginPromptDismissed } from '../../utils/loginPromptStorage';

export default function LoginPrompt({ open, onClose, onContinue }) {
  const [countryCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [accepted, setAccepted] = useState(false);
  const normalizedPhone = useMemo(() => normalizePhone(phone, countryCode), [countryCode, phone]);

  if (!open) return null;

  const continueLogin = () => {
    clearOtpState();
    onContinue(normalizedPhone ? phone.replace(/\D/g, '').slice(0, 10) : '');
  };

  return (
    <Dialog open={open}>
      <div className="flex min-h-full items-center justify-center p-3 sm:p-4">
        <DialogContent className="auth-font relative max-w-[420px] overflow-hidden rounded-[22px] bg-white">
          <div className="relative bg-gradient-to-r from-[#f6e1e7] via-[#fff4e9] to-[#f9eef6] px-5 pb-5 pt-4">
            <button type="button" onClick={onClose} className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-white/80 text-lg leading-none text-slate-600" aria-label="Close login prompt">
              ×
            </button>
            <p className="small-text font-bold uppercase tracking-[0.22em] text-wine">Jassi General Store</p>
            <h2 className="mt-2 text-[22px] font-bold leading-[1.15] text-charcoal">Login or Signup</h2>
            <p className="body-text mt-2 max-w-sm text-slate-600">Get faster checkout, saved carts, and order tracking.</p>
          </div>
          <Card className="rounded-none border-0 shadow-none">
            <CardContent className="space-y-4 p-5">
              <div className="sc-field-shell overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:border-wine focus-within:ring-2 focus-within:ring-wine/10">
                <div className="flex items-center">
                  <span className="px-4 text-base font-semibold text-slate-500">+91</span>
                  <span className="h-12 w-px bg-slate-200" />
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="body-text h-12 min-w-0 flex-1 px-4 outline-none placeholder:text-slate-400"
                    placeholder="Mobile Number*"
                    inputMode="numeric"
                    autoComplete="tel"
                    maxLength={10}
                    pattern="[0-9]*"
                  />
                </div>
              </div>
              {phone && !normalizedPhone ? (
                <p className="text-[12px] font-medium text-[#c81e4a]">Enter a valid 10-digit mobile number starting with 6-9.</p>
              ) : null}
              <div className="label-text flex items-start gap-3 text-slate-600">
                <input id="login-prompt-consent" type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-rose" />
                <p>
                  By continuing, I agree to the <a href="/terms" className="font-semibold text-rose underline-offset-2 hover:underline">Terms of Use</a> and <a href="/privacy-policy" className="font-semibold text-rose underline-offset-2 hover:underline">Privacy Policy</a> and I am above 18 years old.
                </p>
              </div>
              <Button onClick={continueLogin} disabled={!accepted || !normalizedPhone} variant="secondary" className={cn('h-12 w-full rounded-xl bg-[#a8a8b3] text-white hover:bg-[#9d9da8]', accepted && normalizedPhone && 'bg-charcoal hover:bg-charcoal/90')}>
                Continue
              </Button>
              <button type="button" onClick={onClose} className="small-text font-semibold text-slate-500">
                Not now
              </button>
            </CardContent>
          </Card>
        </DialogContent>
      </div>
    </Dialog>
  );
}

function normalizePhone(value, countryCode) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (countryCode === '+91') {
    return normalizeIndianPhone(value);
  }
  return digits.length >= 6 ? `${countryCode}${digits}` : '';
}
