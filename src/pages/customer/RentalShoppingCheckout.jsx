import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, LockKeyhole } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useStorefront } from '../../context/StorefrontContext';
import { useBrandIdentity } from '../../context/BrandIdentityContext';
import { useRentalBag } from '../../context/RentalBagContext';
import { useMediaQuery } from '@mantine/hooks';
import useRentalOffers from '../../hooks/useRentalOffers';
import { storefrontPath } from '../../utils/routing';
import { rentalUseDates, rentalUseDayLabel } from '../../utils/rentalShopping';
import { readRentalSession, saveRentalSession, clearRentalSession } from '../../utils/rentalPlan';
import { editableRentalDetails, rentalDetailsPayload, validateRentalDetails } from '../../utils/rentalDetails';
import { openRentalPayment, rentalDate, rentalInstant, rentalMoney, rentalOperation, rentalUrl } from '../../utils/rentals';
import { trackEvent } from '../../utils/analytics';
import RentalBagItems from '../../components/rentals/RentalBagItems';
import { RentalDateFields, RentalContactFields } from '../../components/rentals/RentalCheckoutFields';
import RentalPaymentChoices from '../../components/rentals/RentalPaymentChoices';
import RentalCheckoutSummary from '../../components/rentals/RentalCheckoutSummary';
import RentalContact from '../../components/rentals/RentalContact';

export default function RentalShoppingCheckout({ navigate }) {
  const { storeSlug } = useStorefront(); const { user } = useAuth(); const brand = useBrandIdentity(); const bag = useRentalBag();
  const actor = user?._id || user?.id || ''; const mobile = useMediaQuery('(max-width: 1023px)', false, { getInitialValueInEffect: false });
  const [configuration, setConfiguration] = useState(null), [methods, setMethods] = useState([]), [method, setMethod] = useState(''), [addresses, setAddresses] = useState([]), [configError, setConfigError] = useState(''), [retry, setRetry] = useState(0);
  const seed = useRef(readRentalSession('checkout-dates', storeSlug));
  const [form, setForm] = useState(() => ({ useStart: seed.current?.useStart || '', additionalUseDates: Array.isArray(seed.current?.additionalUseDates) ? seed.current.additionalUseDates.slice(0, 89).filter(day => typeof day === 'string') : [], pickupAt: seed.current?.pickupAt || '', returnDueAt: seed.current?.returnDueAt || '', deliveryMode: seed.current?.deliveryMode || 'STORE_PICKUP', paymentPlan: seed.current?.paymentPlan || 'ADVANCE', name: user?.name || '', phone: user?.phone || '', email: user?.email || '', whatsappConsent: false }));
  const [details, setDetails] = useState(() => editableRentalDetails(null, user));
  const [step, setStep] = useState(0), [quoted, setQuoted] = useState(null), [accepted, setAccepted] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [pending, setPending] = useState(() => actor ? readRentalSession('reserve', storeSlug, actor) : null);
  const attempt = useRef(rentalOperation()), lock = useRef(false), alive = useRef(true), quoteGeneration = useRef(0);
  const offers = useRentalOffers(bag.items, storeSlug);
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
  useEffect(() => { if (!actor) return undefined; let current = true; api.get('/user/addresses', { silent: true, cacheScope: actor }).then(value => { if (current && Array.isArray(value)) setAddresses(value); }).catch(() => {}); return () => { current = false; }; }, [actor]);
  useEffect(() => { saveRentalSession('checkout-dates', storeSlug, { useStart: form.useStart, additionalUseDates: form.additionalUseDates, pickupAt: form.pickupAt, returnDueAt: form.returnDueAt, deliveryMode: form.deliveryMode, paymentPlan: form.paymentPlan }); }, [form.useStart, form.additionalUseDates, form.pickupAt, form.returnDueAt, form.deliveryMode, form.paymentPlan, storeSlug]);
  const change = (key, value) => { setForm(old => ({ ...old, [key]: value })); setQuoted(null); setAccepted(false); quoteGeneration.current += 1; attempt.current = rentalOperation(); };
  const changeDetails = next => { setDetails(next); setAccepted(false); };
  const payload = () => ({ items: bag.items, useDates: [form.useStart, ...form.additionalUseDates].flatMap(day => rentalUseDates(day)), pickupAt: rentalInstant(form.pickupAt, configuration.policy.timezone), returnDueAt: rentalInstant(form.returnDueAt, configuration.policy.timezone), deliveryMode: form.deliveryMode, paymentPlan: form.paymentPlan, bookingDetails: rentalDetailsPayload(details, form.deliveryMode) });
  const review = async () => {
    if (lock.current) return; lock.current = true; setBusy(true); setError(''); setAccepted(false); const generation = ++quoteGeneration.current;
    try {
      if (!bag.items.length || offers.rows.length !== bag.items.length) throw new Error('Review your rental bag and remove unavailable items.');
      if (user && (!form.name.trim() || validateRentalDetails(details, form.deliveryMode))) throw new Error(validateRentalDetails(details, form.deliveryMode) || 'Enter your booking name.');
      const request = payload();
      if (+new Date(request.returnDueAt) <= +new Date(request.pickupAt)) throw new Error('Return must be after pickup.');
      const result = await api.post(rentalUrl('/rentals/quote', storeSlug), request, { silent: true });
      if (!result?.quoteFingerprint || !result.quote) throw new Error('Your total could not be verified. Please retry.');
      if (alive.current && generation === quoteGeneration.current) { setQuoted(result); setStep(1); trackEvent('RENTAL_QUOTE_SUCCESS', { storeSlug }); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    } catch (e) { if (alive.current && generation === quoteGeneration.current) { setError(e.details || e.message); trackEvent('RENTAL_QUOTE_FAILURE', { storeSlug }); } }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  };
  const complete = async (booking, request) => {
    if (!booking?._id) throw new Error('Booking confirmation is unavailable. Retry the same booking.');
    bag.consume(request.items, booking._id); clearRentalSession('reserve', storeSlug, actor); if (alive.current) setPending(null); clearRentalSession('checkout-dates', storeSlug);
    if (booking.status === 'HELD' && booking.quote.dueNowPaise > 0) {
      const saved = readRentalSession('payment', storeSlug, booking._id);
      const paymentRequest = saved || { bookingId: booking._id, operationId: rentalOperation(), method };
      saveRentalSession('payment', storeSlug, paymentRequest, booking._id);
      try {
        const payment = await api.post(rentalUrl(`/rentals/bookings/${booking._id}/payment`, storeSlug), { operationId: paymentRequest.operationId, method: paymentRequest.method }, { silent: true });
        const verified = await openRentalPayment(payment, { ...booking, storeName: brand.websiteName }, response => api.post(rentalUrl(`/rentals/bookings/${booking._id}/verify`, storeSlug), response, { silent: true }));
        if (verified) clearRentalSession('payment', storeSlug, booking._id);
      } catch (e) { if (e.code === 'PAYMENT_SETUP_REJECTED') clearRentalSession('payment', storeSlug, booking._id); if (alive.current) go(`/rental-success?id=${booking._id}&payment=pending`); return; }
    }
    if (alive.current) go('/rental-success?id=' + booking._id);
  };
  const book = async (recover = false) => {
    if (!user?.isPhoneVerified) { go('/login?redirect=' + encodeURIComponent(storefrontPath('/rental-checkout', storeSlug))); return; }
    if (lock.current || (!recover && (!quoted || !accepted))) return;
    const validation = validateRentalDetails(details, form.deliveryMode);
    if (!recover && (!form.name.trim() || validation)) { setError(validation || 'Enter your booking name.'); setStep(0); return; }
    lock.current = true; setBusy(true); setError('');
    try {
      const request = recover ? pending.request : { ...payload(), attemptId: attempt.current, policyRevision: quoted.policyRevision, quoteFingerprint: quoted.quoteFingerprint, acceptTerms: true, customer: { name: form.name, phone: form.phone, email: form.email, whatsappConsent: form.whatsappConsent } };
      saveRentalSession('reserve', storeSlug, { request }, actor); setPending({ request });
      const booking = await api.post(rentalUrl('/rentals/bookings', storeSlug), request, { silent: true });
      if (alive.current) { trackEvent('RENTAL_HOLD_CREATED', { storeSlug }); await complete(booking, request); }
    } catch (e) { if (alive.current) { if (['RENTAL_QUOTE_CHANGED', 'OUT_OF_STOCK', 'VALIDATION_ERROR', 'NOT_FOUND', 'CHECKOUT_RESTRICTED', 'FEATURE_NOT_AVAILABLE'].includes(e.code)) { clearRentalSession('reserve', storeSlug, actor); setPending(null); setQuoted(null); setAccepted(false); setStep(0); attempt.current = rentalOperation(); } setError(e.details || e.message); } }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  };
  const header = <header className="sc-mobile-checkout__header rental-checkout-header"><div><button type="button" aria-label="Back" disabled={busy} onClick={() => step ? setStep(0) : go('/rental-cart')}><ArrowLeft size={22} /></button><h1>Rental checkout</h1><span>{step + 1} / 2</span></div></header>;
  if (configError) return <section className="rental-shopping-page">{header}<p role="alert">{configError}</p><button onClick={() => setRetry(n => n + 1)}>Retry checkout</button></section>;
  if (!configuration || !bag.ready || offers.loading) return <section className="rental-shopping-page">{header}<p role="status">Loading rental checkout…</p></section>;
  if (!bag.items.length && !pending) return <section className="rental-shopping-page">{header}<h2>Your rental bag is empty</h2><button className="rental-shopping-primary" onClick={() => go('/rental-book')}>Choose rentals</button></section>;
  const ready = quoted && accepted && (form.paymentPlan === 'PICKUP' || method);
  const action = !quoted ? 'Update total' : !user?.isPhoneVerified ? 'Sign in to book' : form.paymentPlan === 'PICKUP' ? 'Confirm booking' : quoted ? `Pay ${rentalMoney(quoted.quote.dueNowPaise)}` : 'Update total';
  const submit = () => step === 0 || !quoted ? review() : book();
  const button = <button type="button" className={mobile ? 'sc-mobile-checkout__primary' : 'rental-shopping-primary'} disabled={busy || (step === 1 && !!quoted && user?.isPhoneVerified && !ready)} onClick={submit}><LockKeyhole size={16} />{busy ? 'Working…' : step === 0 ? 'Continue' : action}</button>;
  return <section className={(mobile ? 'sc-mobile-checkout' : 'sc-checkout') + ' rental-customer-checkout'}>{header}<nav className="rental-checkout-steps" aria-label="Rental checkout progress"><button type="button" aria-current={step === 0 ? 'step' : undefined} disabled={busy} onClick={() => setStep(0)}><span>1</span>Dates & contact</button><button type="button" aria-current={step === 1 ? 'step' : undefined} disabled={busy || !quoted} onClick={() => setStep(1)}><span>2</span>Review & payment</button></nav>
    <div className="rental-checkout-layout"><div className="rental-checkout-main">{error && <p role="alert" className="rental-shopping-notice">{error}</p>}{offers.error && <div role="alert"><p>{offers.error}</p><button onClick={offers.reload}>Retry bag</button></div>}{pending?.request ? <section className="rental-shopping-card"><h2>Check your previous booking</h2><p>Retry checks the same request and protects against duplicate bookings.</p><button className="rental-shopping-primary" disabled={busy} onClick={() => book(true)}>{busy ? 'Checking…' : 'Recover booking'}</button></section> : <fieldset disabled={busy} className="rental-checkout-fieldset">{step === 0 ? <><section className="sc-mobile-checkout__card"><RentalDateFields form={form} policy={configuration.policy} onChange={change} /></section><section className="sc-mobile-checkout__card">{user ? <RentalContactFields form={form} details={details} addresses={addresses} onChange={change} onDetails={changeDetails} /> : <><h2>Contact details</h2><p>Sign in when you reserve. Your verified account supplies the booking contact.</p></>}</section><section className="sc-mobile-checkout__card"><h2>Your rental items</h2><RentalBagItems items={bag.items} offers={offers.rows} storeSlug={storeSlug} navigate={navigate} /></section></> : <><section className="sc-mobile-checkout__card"><RentalPaymentChoices value={form.paymentPlan} allowed={configuration.policy.paymentPlans || ['ADVANCE', 'FULL', 'PICKUP']} onlineReady={!!methods.length} methods={methods} method={method} onMethod={setMethod} quoted={quoted?.quote} onChange={plan => change('paymentPlan', plan)} /></section><section className="sc-mobile-checkout__card"><h2>Booking summary</h2><p>{[form.useStart, ...form.additionalUseDates].filter(Boolean).map(rentalUseDayLabel).join(', ')} · use days</p><p>Pickup: {rentalDate(rentalInstant(form.pickupAt, configuration.policy.timezone), configuration.policy.timezone)}</p><p>Return: {rentalDate(rentalInstant(form.returnDueAt, configuration.policy.timezone), configuration.policy.timezone)}</p><p>{form.name} · {form.phone}</p><details className="rental-checkout-terms"><summary>Rental terms & cancellation</summary><p>{quoted?.terms || configuration.policy.terms}</p><p>Cancellation is reviewed by the store. Refunds may be full, partial or unavailable according to the agreed policy and the store’s decision.</p></details><label className="rental-shopping-check"><input type="checkbox" checked={accepted} disabled={!quoted} onChange={e => setAccepted(e.target.checked)} />I have reviewed the total, dates and rental terms.</label></section></>}</fieldset>}</div><aside className="rental-checkout-summary sc-mobile-checkout__card"><RentalCheckoutSummary data={quoted} /><RentalContact contact={configuration.contact} navigate={go} message="Need help with dates or payment? Contact the store." />{!mobile && !pending && button}</aside></div>
    {mobile && !pending && <div className="sc-mobile-checkout__bottom"><div className="sc-mobile-checkout__bottom-inner"><div><small>{step ? form.paymentPlan === 'PICKUP' ? 'At pickup' : 'Pay now' : 'Total'}</small><strong>{quoted ? rentalMoney(step && form.paymentPlan !== 'PICKUP' ? quoted.quote.dueNowPaise : quoted.quote.totalPaise) : 'Check dates'}</strong></div>{button}</div></div>}
  </section>;
}
