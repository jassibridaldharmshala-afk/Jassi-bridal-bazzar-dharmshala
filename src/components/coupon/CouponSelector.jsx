import { useEffect, useMemo, useRef, useState } from 'react';
import { BadgePercent, CheckCircle2, ChevronDown, Tag, X } from 'lucide-react';
import { couponTerms, formatCouponExpiry, formatCouponOffer } from '../../utils/couponApply';

export default function CouponSelector({
  coupons = [],
  bestCouponCode = '',
  appliedCoupon,
  busyCode = '',
  feedback = '',
  onApply,
  onRemove,
}) {
  const [open, setOpen] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [expandedCode, setExpandedCode] = useState('');
  const closeRef = useRef(() => setOpen(false));
  const bestCoupon = useMemo(
    () => coupons.find((coupon) => coupon.code === bestCouponCode)
      || coupons.find((coupon) => coupon.eligible !== false && couponSaving(coupon) > 0),
    [bestCouponCode, coupons],
  );
  const eligibleCount = coupons.filter((coupon) => coupon.eligible !== false).length;

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !busyCode) closeRef.current();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [busyCode, open]);

  const apply = async (code) => {
    const normalized = String(code || '').trim().toUpperCase();
    if (!normalized || busyCode) return;
    const applied = await onApply?.(normalized);
    if (applied !== false) {
      setManualCode(normalized);
      setOpen(false);
    }
  };

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-theme-border bg-[color:var(--site-surface)] shadow-[0_8px_24px_rgb(var(--site-shadow-rgb)/0.05)]">
        <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center gap-3 px-4 py-4 text-left">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blush text-[color:var(--site-primary)]"><Tag className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-black text-charcoal">Apply Coupons</span>
            <span className="mt-1 block truncate text-[11px] text-[color:var(--site-muted)]">
              {appliedCoupon
                ? `${appliedCoupon.code} applied · You save Rs. ${Number(appliedCoupon.savingAmount ?? appliedCoupon.discount ?? 0).toLocaleString('en-IN')}`
                : bestCoupon
                  ? `Save up to Rs. ${couponSaving(bestCoupon).toLocaleString('en-IN')} with ${bestCoupon.code}`
                  : eligibleCount
                    ? `${eligibleCount} coupon${eligibleCount === 1 ? '' : 's'} available`
                    : 'Enter a coupon code to check your offer'}
            </span>
          </span>
          <span className="shrink-0 text-[12px] font-black uppercase text-[color:var(--site-primary)]">{appliedCoupon ? 'Change' : 'View'}</span>
        </button>
        {appliedCoupon ? (
          <div className="flex items-center justify-between border-t border-[color:var(--site-success-border)] bg-[color:var(--site-success-soft)] px-4 py-3">
            <span className="inline-flex items-center gap-2 text-[11px] font-bold text-[color:var(--site-success)]"><CheckCircle2 className="h-4 w-4" /> Coupon applied successfully</span>
            <button type="button" onClick={onRemove} disabled={!!busyCode} className="text-[11px] font-black uppercase text-[color:var(--site-primary)] disabled:opacity-50">Remove</button>
          </div>
        ) : null}
        {!open && feedback ? <p role="status" className="border-t border-[color:var(--site-primary-border)] bg-[color:var(--site-tint)] px-4 py-2.5 text-[10px] font-semibold leading-4 text-[color:var(--site-primary)]">{feedback}</p> : null}
      </section>

      {open ? (
        <div className="fixed inset-0 z-[98] flex items-end justify-center bg-[color:color-mix(in_srgb,var(--site-media-black)_55%,transparent)] md:items-center md:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busyCode) setOpen(false); }}>
          <section className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[24px] bg-[color:var(--site-surface-alt)] shadow-2xl md:rounded-[24px]" role="dialog" aria-modal="true" aria-label="Apply coupons">
            <header className="flex shrink-0 items-center justify-between border-b border-[color:var(--site-border)] bg-[color:var(--site-surface)] px-4 py-4 md:px-5">
              <div><h2 className="text-[16px] font-black text-charcoal">Apply Coupons</h2><p className="mt-1 text-[10px] text-[color:var(--site-muted)]">Only eligible offers can be applied to this bag.</p></div>
              <button type="button" onClick={() => setOpen(false)} disabled={!!busyCode} className="grid h-10 w-10 place-items-center rounded-full bg-[color:var(--site-background)] text-[color:var(--site-muted)] disabled:opacity-40" aria-label="Close coupon list"><X className="h-5 w-5" /></button>
            </header>

            <div className="shrink-0 border-b border-[color:var(--site-border)] bg-[color:var(--site-surface)] p-4 md:px-5">
              <div className="sc-field-shell flex overflow-hidden rounded-xl border border-[color:var(--site-border)] focus-within:border-[color:var(--site-primary-border)]">
                <input value={manualCode} onChange={(event) => setManualCode(event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32))} onKeyDown={(event) => { if (event.key === 'Enter') apply(manualCode); }} placeholder="Enter coupon code" className="h-12 min-w-0 flex-1 px-3 text-[13px] font-bold uppercase outline-none" />
                <button type="button" onClick={() => apply(manualCode)} disabled={!manualCode.trim() || !!busyCode} className="w-24 border-l border-[color:var(--site-border)] text-[12px] font-black uppercase text-[color:var(--site-primary)] disabled:text-[color:var(--site-faint)]">{busyCode === manualCode ? 'Checking' : 'Apply'}</button>
              </div>
              {feedback ? <p role="status" className="mt-3 rounded-lg bg-blush px-3 py-2 text-[11px] font-semibold leading-4 text-[color:var(--site-primary)]">{feedback}</p> : null}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-[max(24px,env(safe-area-inset-bottom))] md:px-5">
              <div className="mb-3 flex items-center justify-between"><h3 className="text-[12px] font-black uppercase tracking-[.04em] text-charcoal">Available offers</h3><span className="text-[10px] text-[color:var(--site-muted)]">{eligibleCount} eligible</span></div>
              {coupons.length ? (
                <div className="space-y-3">
                  {coupons.map((coupon) => {
                    const eligible = coupon.eligible !== false;
                    const applied = appliedCoupon?.code === coupon.code;
                    const terms = couponTerms(coupon);
                    const expanded = expandedCode === coupon.code;
                    return (
                      <article key={coupon.code} className={`overflow-hidden rounded-2xl border bg-[color:var(--site-surface)] ${applied ? 'border-[color:var(--site-success-border)]' : eligible ? 'border-[color:var(--site-border)]' : 'border-[color:var(--site-border)] opacity-70'}`}>
                        <div className="p-4">
                          <div className="flex items-start gap-3">
                            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${eligible ? 'bg-blush text-[color:var(--site-primary)]' : 'bg-[color:var(--site-surface-alt)] text-[color:var(--site-faint)]'}`}><BadgePercent className="h-5 w-5" /></span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-3">
                                <div><span className="inline-flex rounded border border-dashed border-[color:var(--site-primary-border)] px-2 py-1 text-[12px] font-black tracking-[.04em] text-wine">{coupon.code}</span>{coupon.code === bestCoupon?.code ? <span className="ml-2 rounded-full bg-[color:var(--site-success-soft)] px-2 py-1 text-[8px] font-black uppercase text-[color:var(--site-success)]">Best saving</span> : null}</div>
                                {applied ? <span className="text-[11px] font-black text-[color:var(--site-success)]">Applied</span> : <button type="button" onClick={() => apply(coupon.code)} disabled={!eligible || !!busyCode} className="text-[11px] font-black uppercase text-[color:var(--site-primary)] disabled:text-[color:var(--site-faint)]">{busyCode === coupon.code ? 'Applying...' : 'Apply'}</button>}
                              </div>
                              <h4 className="mt-3 text-[13px] font-black leading-5 text-charcoal">{coupon.title || formatCouponOffer(coupon)}</h4>
                              {coupon.description ? <p className="mt-1 text-[10px] leading-4 text-[color:var(--site-muted)]">{coupon.description}</p> : null}
                              {eligible && couponSaving(coupon) > 0 ? <p className="mt-2 text-[11px] font-bold text-[color:var(--site-success)]">You save Rs. {couponSaving(coupon).toLocaleString('en-IN')}</p> : null}
                              {!eligible ? <p className="mt-2 text-[10px] font-semibold leading-4 text-rose">{coupon.reason}</p> : null}
                              {coupon.expiryDate ? <p className="mt-2 text-[9px] text-[color:var(--site-faint)]">Expires {formatCouponExpiry(coupon.expiryDate)}</p> : null}
                            </div>
                          </div>
                        </div>
                        {terms.length ? (
                          <div className="border-t border-[color:var(--site-border)] px-4 py-3">
                            <button type="button" onClick={() => setExpandedCode(expanded ? '' : coupon.code)} className="flex w-full items-center justify-between text-left text-[10px] font-bold text-[color:var(--site-muted)]">Terms &amp; conditions <ChevronDown className={`h-4 w-4 transition ${expanded ? 'rotate-180' : ''}`} /></button>
                            {expanded ? <ul className="mt-2 list-disc space-y-1 pl-4 text-[9px] leading-4 text-[color:var(--site-muted)]">{terms.map((term) => <li key={term}>{term}</li>)}</ul> : null}
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl bg-[color:var(--site-surface)] px-5 py-10 text-center"><Tag className="mx-auto h-8 w-8 text-[color:var(--site-faint)]" /><p className="mt-3 text-[13px] font-bold text-charcoal">No public coupons right now</p><p className="mt-1 text-[10px] text-[color:var(--site-muted)]">You can still enter a private coupon code above.</p></div>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function couponSaving(coupon) {
  return Number(coupon?.effectiveSaving ?? (Number(coupon?.estimatedDiscount || 0) + Number(coupon?.estimatedDeliverySaving || 0)));
}
