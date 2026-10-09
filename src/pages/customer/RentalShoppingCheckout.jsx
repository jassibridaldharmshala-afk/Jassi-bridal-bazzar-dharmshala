import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CircleHelp } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useStorefront } from '../../context/StorefrontContext';
import { useBrandIdentity } from '../../context/BrandIdentityContext';
import { useRentalBag } from '../../context/RentalBagContext';
import { useMediaQuery } from '@mantine/hooks';
import useRentalOffers from '../../hooks/useRentalOffers';
import { storefrontPath } from '../../utils/routing';
import { defaultRentalSchedule, validateRentalCheckoutDates } from '../../utils/rentalShopping';
import { readRentalSession, saveRentalSession, clearRentalSession } from '../../utils/rentalPlan';
import { readRentalContactDraft, saveRentalContactDraft, readGuestRentalContact, saveGuestRentalContact } from '../../utils/rentalContactDraft';
import { editableRentalDetails, rentalDetailsPayload, validateRentalDetails } from '../../utils/rentalDetails';
import { openRentalPayment, rentalMoney, rentalOperation, rentalUrl } from '../../utils/rentals';
import { normalizeIndianPhone } from '../../utils/phoneFormatter';
import { trackEvent } from '../../utils/analytics';
import RentalBagItems from '../../components/rentals/RentalBagItems';
import { RentalDateFields } from '../../components/rentals/RentalCheckoutFields';
import RentalPaymentChoices from '../../components/rentals/RentalPaymentChoices';
import RentalCheckoutSummary from '../../components/rentals/RentalCheckoutSummary';
import RentalCheckoutContact from '../../components/rentals/RentalCheckoutContact';
import RentalCheckoutPlan, { RentalShopArrangement } from '../../components/rentals/RentalCheckoutPlan';
import RentalContact from '../../components/rentals/RentalContact';

export default function RentalShoppingCheckout({ navigate }) {
  const { storeSlug } = useStorefront(); const { user } = useAuth(); const brand = useBrandIdentity(); const bag = useRentalBag();
  const actor = user?._id || user?.id || ''; const mobile = useMediaQuery('(max-width: 1023px)', false, { getInitialValueInEffect: false });
  const [configuration, setConfiguration] = useState(null), [methods, setMethods] = useState([]), [method, setMethod] = useState(''), [addresses, setAddresses] = useState([]), [configError, setConfigError] = useState(''), [retry, setRetry] = useState(0);
  const seed = useRef(readRentalSession('checkout-dates', storeSlug));
  const verificationReturn = useRef(readRentalSession('verification-return', storeSlug));
  const continuingVerification = !!user?.isPhoneVerified && verificationReturn.current?.expiresAt > Date.now() && normalizeIndianPhone(verificationReturn.current?.phone) === normalizeIndianPhone(user.phone);
  const contact = useRef((continuingVerification ? readGuestRentalContact(storeSlug) : null) || readRentalContactDraft(storeSlug, user) || (!user ? readGuestRentalContact(storeSlug) : null));
  const [form, setForm] = useState(() => ({ useStart: seed.current?.useStart || '', additionalUseDates: Array.isArray(seed.current?.additionalUseDates) ? seed.current.additionalUseDates.slice(0, 89).filter(day => typeof day === 'string') : [], pickupAt: seed.current?.pickupAt || '', returnDueAt: seed.current?.returnDueAt || '', deliveryMode: seed.current?.deliveryMode || 'STORE_PICKUP', paymentPlan: seed.current?.paymentPlan || 'ADVANCE', name: contact.current?.customer.name || user?.name || '', phone: user?.phone || '', email: contact.current?.customer.email ?? user?.email ?? '', whatsappConsent: contact.current?.customer.whatsappConsent === true }));
  const [details, setDetails] = useState(() => ({ ...editableRentalDetails(contact.current?.details, user), sameAsDelivery: true }));
  const [contactState, setContactState] = useState({ label: 'Review booking', busy: false, disabled: false });
  const checkoutRoot = useRef(null), previousActor = useRef(actor), previousPhone = useRef(normalizeIndianPhone(user?.phone));
  const restoreStep = useRef(continuingVerification ? 2 : seed.current?.step || 0);
  const [step, setStep] = useState(0), [quoted, setQuoted] = useState(null), [accepted, setAccepted] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [pending, setPending] = useState(() => actor ? readRentalSession('reserve', storeSlug, actor) : null);
  const attempt = useRef(rentalOperation()), lock = useRef(false), alive = useRef(true), quoteGeneration = useRef(0);
  const offers = useRentalOffers(bag.items, storeSlug);
  const bagKey = JSON.stringify(bag.items);
  const [slots, setSlots] = useState({ pickup: null, return: null });
  const errorPanel = useRef(null), reprice = useRef(false), reviewRef = useRef(null);
  const slotStatus = useCallback((kind, status) => setSlots(old => JSON.stringify(old[kind]) === JSON.stringify(status) ? old : { ...old, [kind]: status }), []);
  useEffect(() => { setQuoted(null); setAccepted(false); setStep(0); quoteGeneration.current += 1; attempt.current = rentalOperation(); }, [bagKey]);
  useEffect(() => { if (error) { errorPanel.current?.focus({ preventScroll: true }); errorPanel.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' }); } }, [error]);
  useEffect(() => { const draft = { customer: { name: form.name, email: form.email, whatsappConsent: form.whatsappConsent }, details }; if (actor) saveRentalContactDraft(storeSlug, user, draft); else saveGuestRentalContact(storeSlug, draft); }, [actor, storeSlug, user, form.name, form.email, form.whatsappConsent, details]);
  useEffect(() => { if (reprice.current) { reprice.current = false; reviewRef.current?.(2); } }, [form.paymentPlan]);
  const go = path => navigate(storefrontPath(path, storeSlug));
  useEffect(() => { alive.current = true; return () => { alive.current = false; quoteGeneration.current += 1; }; }, []);
  useEffect(() => {
    let current = true; setConfigError('');
    Promise.all([api.get(rentalUrl('/rentals/configuration', storeSlug), { silent: true, forceRefetch: true }), api.get(rentalUrl('/rentals/payment-methods', storeSlug), { silent: true, forceRefetch: true })]).then(([config, options]) => {
      if (!config?.policy || !Array.isArray(options)) throw new Error('Rental checkout could not be loaded.');
      if (!current) return;
      setConfiguration(config); const enabled = options.filter(row => row.enabled); setMethods(enabled); setMethod(enabled[0]?.key || '');
      setForm(old => ({ ...old, deliveryMode: config.policy.deliveryModes.includes(old.deliveryMode) ? old.deliveryMode : config.policy.deliveryModes[0], paymentPlan: (config.policy.paymentPlans || ['ADVANCE', 'FULL', 'PICKUP']).includes(old.paymentPlan) && (old.paymentPlan === 'PICKUP' || enabled.length) ? old.paymentPlan : (config.policy.paymentPlans || ['ADVANCE', 'FULL', 'PICKUP']).find(plan => plan === 'PICKUP' || enabled.length) || 'ADVANCE' }));
    }).catch(e => { if (current) setConfigError(e.message); });
    return () => { current = false; };
  }, [storeSlug, retry]);
  useEffect(() => {
    if (previousActor.current && previousActor.current !== actor) {
      quoteGeneration.current++; attempt.current = rentalOperation(); setQuoted(null); setAccepted(false); setStep(1);
      setForm(old => ({ ...old, name: user?.name || '', phone: user?.phone || '', email: user?.email || '', whatsappConsent: false }));
      setDetails({ ...editableRentalDetails(null, user), sameAsDelivery: true });
    }
    const phone = normalizeIndianPhone(user?.phone);
    if (previousActor.current === actor && previousPhone.current && previousPhone.current !== phone) {
      quoteGeneration.current++; attempt.current = rentalOperation(); setQuoted(null); setAccepted(false); setStep(1);
      setForm(old => ({ ...old, phone: user?.phone || '' }));
    }
    previousPhone.current = phone; previousActor.current = actor; setAddresses([]); setPending(actor ? readRentalSession('reserve', storeSlug, actor) : null); setAccepted(false); if (!actor) return undefined; let current = true; api.get('/user/addresses', { silent: true, cacheScope: actor }).then(value => { if (current && Array.isArray(value)) setAddresses(value); }).catch(() => {}); return () => { current = false; }; }, [actor, storeSlug, user]);
  useEffect(() => { saveRentalSession('checkout-dates', storeSlug, { step, useStart: form.useStart, additionalUseDates: form.additionalUseDates, pickupAt: form.pickupAt, returnDueAt: form.returnDueAt, deliveryMode: form.deliveryMode, paymentPlan: form.paymentPlan }); }, [step, form.useStart, form.additionalUseDates, form.pickupAt, form.returnDueAt, form.deliveryMode, form.paymentPlan, storeSlug]);
  useEffect(() => {
    const viewport = window.visualViewport; if (!mobile || !viewport) return undefined;
    let frame;
    const update = () => {
      cancelAnimationFrame(frame); frame = requestAnimationFrame(() => {
        const root = checkoutRoot.current, focused = document.activeElement;
        const editing = root?.contains(focused) && ['INPUT', 'SELECT', 'TEXTAREA'].includes(focused.tagName);
        root?.style.setProperty('--rental-keyboard-offset', editing ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) + 'px' : '0px');
        if (editing && focused.getBoundingClientRect().bottom > viewport.height + viewport.offsetTop - 110) focused.scrollIntoView?.({ block: 'center' });
      });
    };
    viewport.addEventListener('resize', update); document.addEventListener('focusin', update); document.addEventListener('focusout', update);
    return () => { cancelAnimationFrame(frame); viewport.removeEventListener('resize', update); document.removeEventListener('focusin', update); document.removeEventListener('focusout', update); };
  }, [mobile]);
  const change = (key, value) => {
    if (key === 'paymentPlan' && step === 2 && value !== form.paymentPlan) reprice.current = true;
    setForm(old => {
      const next = { ...old, [key]: value };
      if (['useStart', 'additionalUseDates'].includes(key) && configuration) {
        try {
          const suggested = defaultRentalSchedule([next.useStart, ...next.additionalUseDates], configuration.policy);
          if (!next.pickupAt) next.pickupAt = suggested.pickupAt || '';
          if (!next.returnDueAt) next.returnDueAt = suggested.returnDueAt || '';
        } catch { /* Incomplete days remain editable. */ }
      }
      return next;
    });
    if (!['name', 'phone', 'email', 'whatsappConsent'].includes(key)) setQuoted(null); setAccepted(false); setError(''); quoteGeneration.current += 1; attempt.current = rentalOperation();
  };
  const changeDetails = next => { setDetails(next); setAccepted(false); setError(''); quoteGeneration.current += 1; attempt.current = rentalOperation(); };
  const payload = (effectiveDetails = details) => ({ items: bag.items, ...validateRentalCheckoutDates(form, configuration.policy), deliveryMode: form.deliveryMode, paymentPlan: form.paymentPlan, bookingDetails: rentalDetailsPayload(effectiveDetails, form.deliveryMode) });
  const review = async (nextStep = 1, profile = user, restoring = false) => {
    if (lock.current) return; lock.current = true; setBusy(true); setError(''); setAccepted(false); const generation = ++quoteGeneration.current;
    try {
      if (!bag.items.length || offers.rows.length !== bag.items.length) throw new Error('Review your rental bag and remove unavailable items.');
      const effectiveDetails = nextStep === 2 && profile?.isPhoneVerified && form.deliveryMode !== 'STORE_PICKUP' ? { ...details, deliveryAddress: { ...details.deliveryAddress, fullName: details.deliveryAddress?.fullName || form.name || profile.name, mobile: details.deliveryAddress?.mobile || profile.phone } } : details;
      if (effectiveDetails !== details) setDetails(effectiveDetails);
      if (nextStep === 2 && form.email && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(form.email)) throw new Error('Enter a valid email address, or leave it blank.');
      if (nextStep === 2 && (!profile?.isPhoneVerified || !form.name.trim() || validateRentalDetails(effectiveDetails, form.deliveryMode))) { setStep(1); throw new Error(validateRentalDetails(effectiveDetails, form.deliveryMode) || 'Enter your booking name and verify your mobile number.'); }
      const request = payload(effectiveDetails);
      if (!restoring && step === 0) for (const [kind, value] of [['pickup', form.pickupAt], ['return', form.returnDueAt]]) if (slots[kind]?.date !== value.slice(0, 10) || !slots[kind]?.times.includes(value.slice(11, 16))) throw new Error(`Choose an available ${kind} time. Retry times if needed.`);
      const result = await api.post(rentalUrl('/rentals/quote', storeSlug), request, { silent: true });
      if (!result?.quoteFingerprint || !result.quote) throw new Error('Your total could not be verified. Please retry.');
      if (alive.current && generation === quoteGeneration.current) { setQuoted(result); setStep(nextStep); if (nextStep === 2 && profile?.isPhoneVerified) { clearRentalSession('guest-contact', storeSlug); clearRentalSession('verification-return', storeSlug); clearRentalSession('otp-challenge', storeSlug); clearRentalSession('phone-entry', storeSlug); } if (profile?.isPhoneVerified) setForm(old => ({ ...old, phone: profile.phone })); trackEvent('RENTAL_QUOTE_SUCCESS', { storeSlug }); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    } catch (e) { if (alive.current && generation === quoteGeneration.current) { setError(e.details || e.message); trackEvent('RENTAL_QUOTE_FAILURE', { storeSlug }); } }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  };
  reviewRef.current = review;
  useEffect(() => {
    if (!configuration || !bag.ready || offers.loading || !bag.items.length || pending?.request || !restoreStep.current) return;
    const restored = restoreStep.current; restoreStep.current = 0;
    reviewRef.current?.(restored === 2 && user?.isPhoneVerified ? 2 : 1, user, true);
  }, [configuration, bag.ready, offers.loading, bag.items.length, user, pending]);
  const goStep = index => { setAccepted(false); setError(''); setStep(index); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const contactVerified = profile => review(2, profile, true);
  const verificationChanged = () => { setAccepted(false); quoteGeneration.current++; };

  const complete = async (booking, request) => {
    if (!booking?._id) throw new Error('Booking confirmation is unavailable. Retry the same booking.');
    bag.consume(request.items, booking._id); clearRentalSession('reserve', storeSlug, actor); if (alive.current) setPending(null); clearRentalSession('checkout-dates', storeSlug); clearRentalSession('contact', storeSlug, actor); clearRentalSession('guest-contact', storeSlug); clearRentalSession('otp-challenge', storeSlug); clearRentalSession('phone-entry', storeSlug);
    if (booking.status === 'HELD' && booking.quote.dueNowPaise > 0) {
      const saved = readRentalSession('payment', storeSlug, booking._id);
      const paymentRequest = saved || { bookingId: booking._id, operationId: rentalOperation(), method };
      saveRentalSession('payment', storeSlug, paymentRequest, booking._id);
      try {
        const payment = await api.post(rentalUrl(`/rentals/bookings/${booking._id}/payment`, storeSlug), { operationId: paymentRequest.operationId, method: paymentRequest.method }, { silent: true });
        const verified = await openRentalPayment(payment, { ...booking, storeName: brand.websiteName }, response => api.post(rentalUrl(`/rentals/bookings/${booking._id}/verify`, storeSlug), response, { silent: true }));
        if (verified) clearRentalSession('payment', storeSlug, booking._id);
        else { if (alive.current) go(`/rental-success?id=${booking._id}&payment=pending`); return; }
      } catch (e) { if (e.code === 'PAYMENT_SETUP_REJECTED') clearRentalSession('payment', storeSlug, booking._id); if (alive.current) go(`/rental-success?id=${booking._id}&payment=pending`); return; }
    }
    if (alive.current) go('/rental-success?id=' + booking._id);
  };
  const book = async (recover = false) => {
    if (!user?.isPhoneVerified) { goStep(1); setError('Verify your mobile number before reserving.'); return; }
    if (lock.current || (!recover && (!quoted || !accepted))) return;
    const validation = validateRentalDetails(details, form.deliveryMode);
    if (!recover && (!form.name.trim() || validation)) { setError(validation || 'Enter your booking name.'); setStep(1); return; }
    lock.current = true; setBusy(true); setError('');
    try {
      const request = recover ? pending.request : { ...payload(), attemptId: attempt.current, policyRevision: quoted.policyRevision, quoteFingerprint: quoted.quoteFingerprint, acceptTerms: true, customer: { name: form.name, phone: user.phone, email: form.email, whatsappConsent: form.whatsappConsent } };
      saveRentalSession('reserve', storeSlug, { request }, actor); setPending({ request });
      const booking = await api.post(rentalUrl('/rentals/bookings', storeSlug), request, { silent: true });
      if (alive.current) { trackEvent('RENTAL_HOLD_CREATED', { storeSlug }); await complete(booking, request); }
    } catch (e) { if (alive.current) { if (['RENTAL_QUOTE_CHANGED', 'OUT_OF_STOCK', 'VALIDATION_ERROR', 'NOT_FOUND', 'CHECKOUT_RESTRICTED', 'FEATURE_NOT_AVAILABLE'].includes(e.code)) { clearRentalSession('reserve', storeSlug, actor); setPending(null); setQuoted(null); setAccepted(false); setStep(0); attempt.current = rentalOperation(); } setError(e.details || e.message); } }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  };

  const working = busy || (step === 1 && contactState.busy);
  const shopName = configuration?.contact?.storeName || brand.websiteName || 'Rental checkout';
  const header = <header className="sc-mobile-checkout__header rental-checkout-header"><div><button type="button" aria-label="Back" disabled={working || !!pending} onClick={() => step ? goStep(step - 1) : go('/rental-cart')}><ArrowLeft size={20} /></button><div className="rental-checkout-brand"><strong>{shopName}</strong>{configuration?.contact?.address && <small>{configuration.contact.address}</small>}</div><button type="button" className="rental-checkout-help" onClick={() => go('/contact')}><CircleHelp size={15} />Help</button></div></header>;
  if (configError) return <section className="rental-shopping-page">{header}<p role="alert">{configError}</p><button onClick={() => setRetry(n => n + 1)}>Retry checkout</button></section>;
  if (!configuration || !bag.ready || offers.loading) return <section className="rental-shopping-page">{header}<p role="status">Loading rental checkout…</p></section>;
  if (!bag.items.length && !pending && busy) return <section className="rental-shopping-page">{header}<p role="status">Opening your booking…</p></section>;
  if (!bag.items.length && !pending) return <section className="rental-shopping-page">{header}<h2>Your rental bag is empty</h2><button className="rental-shopping-primary" onClick={() => go('/rental-book')}>Choose rentals</button></section>;
  if (configuration.mode === 'SALE_ONLY') return <section className="rental-shopping-page">{header}<h2>Rentals are currently unavailable</h2><p>Contact the shop for help or continue shopping.</p><button className="rental-shopping-primary" onClick={() => go('/products')}>Browse products</button></section>;
  const ready = quoted && accepted && user?.isPhoneVerified && (form.paymentPlan === 'PICKUP' || method);
  const checkingTimes = step === 0 && (slots.pickup?.loading || slots.return?.loading);
  const useCount = new Set([form.useStart, ...form.additionalUseDates].filter(day => /^\d{4}-\d{2}-\d{2}$/.test(day))).size;
  const dailyEstimate = offers.rows.reduce((sum, row) => sum + row.dailyRatePaise * (bag.items.find(item => item.listingId === row._id)?.quantity || 0), 0);
  const depositEstimate = offers.rows.reduce((sum, row) => sum + row.depositPaise * (bag.items.find(item => item.listingId === row._id)?.quantity || 0), 0);
  const estimate = useCount ? { days: useCount, rent: dailyEstimate * useCount, deposit: depositEstimate, total: dailyEstimate * useCount + depositEstimate } : null;
  const action = step === 0 ? 'Continue' : step === 1 ? contactState.label : !quoted ? 'Update total' : form.paymentPlan === 'PICKUP' ? 'Confirm booking' : 'Continue to payment';
  const button = <button type={step === 1 ? 'submit' : 'button'} form={step === 1 ? 'rental-checkout-contact-form' : undefined} className={mobile ? 'sc-mobile-checkout__primary' : 'rental-shopping-primary'} disabled={working || checkingTimes || !!offers.error || (step === 1 && contactState.disabled) || (step === 2 && !!quoted && !ready)} onClick={step === 1 ? undefined : () => step === 0 ? review(1) : !quoted ? review(2) : book()}>{working ? 'Checking…' : checkingTimes ? 'Loading times…' : action}<ArrowRight size={17} /></button>;
  const planProps = { form, details, contact: configuration.contact, policy: configuration.policy, items: bag.items, offers: offers.rows, storeSlug, navigate, onDates: () => goStep(0), onContact: () => goStep(1) };
  const headings = ['Choose your dates', 'Contact details', 'Review your booking'];
  const subtitles = ['Tell us when you need your rental.', 'Get your booking updates on this number.', 'Check your details before payment.'];
  return <section ref={checkoutRoot} className={(mobile ? 'sc-mobile-checkout' : 'sc-checkout') + ' rental-customer-checkout rental-checkout-v2'} data-stage={step}>{header}
    <nav className="rental-checkout-steps" aria-label="Rental checkout progress">{['Dates', 'Contact', 'Review'].map((label, index) => <button key={label} type="button" aria-current={step === index ? 'step' : undefined} disabled={working || !!pending || index > step} onClick={() => { if (index < step) goStep(index); }}><span>{index < step ? <Check size={13} /> : index + 1}</span>{label}</button>)}</nav>
    <div className="rental-checkout-page-heading"><div className="rental-checkout-title-row"><h1>{headings[step]}</h1>{mobile && step === 0 && <button type="button" className="rental-edit-control" disabled={working} onClick={() => go('/rental-cart')}>Edit bag</button>}</div><p>{subtitles[step]}</p></div>
    <div className="rental-checkout-layout"><div className="rental-checkout-main">
      {error && <p ref={errorPanel} tabIndex={-1} role="alert" className="rental-shopping-notice">{error}</p>}
      {offers.error && <div role="alert"><p>{offers.error}</p><button onClick={offers.reload}>Retry bag</button></div>}
      {pending?.request ? <section className="rental-shopping-card"><h2>Check your previous booking</h2><p>Retry checks the same request and protects against duplicate bookings.</p><button className="rental-shopping-primary" disabled={busy} onClick={() => book(true)}>{busy ? 'Checking…' : 'Recover booking'}</button></section> : <fieldset disabled={working} className="rental-checkout-fieldset">
        {step === 0 ? <><section aria-label="Your rental items" className="sc-mobile-checkout__card rental-checkout-items">{!mobile && <div className="rental-checkout-section-heading"><h2>Your rental {bag.items.length === 1 ? 'item' : 'items'}</h2><button type="button" className="rental-edit-control" onClick={() => go('/rental-cart')}>Edit bag</button></div>}<RentalBagItems items={bag.items} offers={offers.rows} storeSlug={storeSlug} navigate={navigate} /></section>
          <RentalDateFields form={form} policy={configuration.policy} onChange={change} storeSlug={storeSlug} onSlotStatus={slotStatus} />
          <section className="sc-mobile-checkout__card"><RentalShopArrangement {...planProps} /><p className="rental-shopping-hint">Continue to check availability for the full pickup-to-return period.</p></section>
        </> : step === 1 ? <><section className="sc-mobile-checkout__card rental-contact-card"><RentalCheckoutContact key={storeSlug || 'default'} form={form} details={details} addresses={addresses} onChange={change} onDetails={changeDetails} onContinue={contactVerified} onState={setContactState} onVerificationChange={verificationChanged} storeSlug={storeSlug} /></section><RentalCheckoutPlan {...planProps} />{quoted && <p className="rental-availability-confirmed" role="status"><Check size={16} />Available for your selected dates. Final check at reservation.</p>}</> : <>
          <RentalCheckoutPlan {...planProps} showContact />
          {mobile && <section className="sc-mobile-checkout__card rental-review-price"><RentalCheckoutSummary data={quoted} estimate={estimate} /></section>}<section className="sc-mobile-checkout__card rental-review-payment"><RentalPaymentChoices value={form.paymentPlan} allowed={configuration.policy.paymentPlans || ['ADVANCE', 'FULL', 'PICKUP']} onlineReady={!!methods.length} methods={methods} method={method} onMethod={setMethod} quoted={quoted?.quote} onChange={plan => change('paymentPlan', plan)} /></section>
          <section className="sc-mobile-checkout__card rental-policy-card"><details className="rental-checkout-terms"><summary>Rental & return policy</summary><p>{quoted?.terms || configuration.policy.terms || 'Contact the store to confirm rental terms before booking.'}</p><p>Cancellation and any full, partial or unavailable refund are reviewed by the store under the agreed policy.</p></details><label className="rental-shopping-check"><input type="checkbox" checked={accepted} disabled={!quoted} onChange={e => setAccepted(e.target.checked)} /><span>I have reviewed the total, dates and <button className="rental-shopping-link" type="button" onClick={e => { e.currentTarget.closest('section').querySelector('details').open = true; }}>rental & return policy</button>.</span></label></section>
        </>}
      </fieldset>}
    </div>{(!mobile || step !== 2) && <aside className="rental-checkout-summary sc-mobile-checkout__card"><RentalCheckoutSummary data={quoted} estimate={estimate} /><RentalContact contact={configuration.contact} navigate={go} message="Need help? Contact the store." />{!mobile && !pending && button}</aside>}{mobile && step === 2 && <RentalContact contact={configuration.contact} navigate={go} message="Need help? Contact the store." />}<div className="rental-checkout-utilities" data-rental-checkout-utilities /></div>
    {mobile && !pending && <div className="sc-mobile-checkout__bottom"><div className="sc-mobile-checkout__bottom-inner"><div><small>{step === 2 ? form.paymentPlan === 'PICKUP' ? 'At pickup' : 'Pay now' : quoted ? 'Total' : estimate ? 'Estimated total' : 'Rent / use day'}</small><strong>{quoted ? rentalMoney(step === 2 && form.paymentPlan !== 'PICKUP' ? quoted.quote.dueNowPaise : quoted.quote.totalPaise) : rentalMoney(estimate ? estimate.total : dailyEstimate)}</strong>{(quoted?.quote.depositPaise || depositEstimate) > 0 && <small className="rental-bottom-deposit">{step === 2 && form.paymentPlan !== 'PICKUP' && quoted ? `Balance at pickup ${rentalMoney(quoted.quote.remainingPaise)}` : 'Includes refundable security'}</small>}</div>{button}</div><p className="rental-bottom-next">{step === 0 ? 'Next: contact details' : step === 1 ? 'Next: review your booking' : 'Your dates are reserved only after confirmation.'}</p></div>}
  </section>;
}
