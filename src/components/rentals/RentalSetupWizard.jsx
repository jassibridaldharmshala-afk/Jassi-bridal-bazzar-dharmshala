import { useEffect, useRef, useState } from 'react';
import { rentalOperation } from '../../utils/rentals';
import api from '../../services/api';
import { RentalField } from './RentalUi';
import RentalRecordPager from './RentalRecordPager';
import RentalProductPicker from './RentalProductPicker';
import ProductRentalPricing, { pricingFromOffer, rentalPricingError } from '../admin/ProductRentalPricing';
const newOffer = () => ({ productId: '', title: '', active: false, dailyRatePaise: '', depositPaise: 0, advanceMode: 'STORE', fitting: { adjustable: true, alterationsAvailable: true, instructions: '' }, cleaningFeePaise: 0, alterationFeePaise: 0, packages: [], requirements: [] });
const newPiece = () => ({ component: '0', code: '', label: '', location: '', condition: 'Good' });
const noop = () => {};
export default function RentalSetupWizard({ base, initialListingId = '', initialProductId = '', permissions = {}, readiness, configuration, refresh = 0, busy, run, onTab, onDirtyChange = noop }) {
  const [rows, setRows] = useState([]), [id, setId] = useState(initialListingId), [data, setData] = useState(null), [step, setStep] = useState(initialListingId ? 2 : 1);
  const [offer, setOffer] = useState(newOffer), [piece, setPiece] = useState(newPiece), [pieceBaseline, setPieceBaseline] = useState(newPiece);
  const [error, setError] = useState(''), [loading, setLoading] = useState(false), [reload, setReload] = useState(0), [quantity, setQuantity] = useState('');
  const batch = useRef(rentalOperation()), stepIntro = useRef(null), previousStep = useRef(step);
  useEffect(() => { if (!loading && previousStep.current !== step && stepIntro.current) { previousStep.current = step; stepIntro.current.focus(); stepIntro.current.scrollIntoView?.({ block: 'start' }); } }, [step, loading]);
  const policy = configuration.policy || {};
  const write = permissions['inventory.write'] !== false;
  useEffect(() => { batch.current = rentalOperation(); }, [id, quantity, piece.component, piece.location, piece.condition]);
  const dirty = !loading && (JSON.stringify(offer) !== JSON.stringify(data?.listing || newOffer()) || (piece.code !== pieceBaseline.code || piece.label !== pieceBaseline.label || piece.location !== pieceBaseline.location || piece.condition !== pieceBaseline.condition) || !!quantity);
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
  useEffect(() => { if (initialListingId) setId(initialListingId); }, [initialListingId]);
  useEffect(() => { if (!initialListingId && initialProductId) setOffer(value => ({ ...value, productId: initialProductId })); }, [initialListingId, initialProductId]);
  useEffect(() => {
    if (!id) { setData(null); return undefined; }
    let alive = true; setLoading(true); setError(''); setData(null);
    api.get(`${base}/setup/${id}`, { silent: true, forceRefetch: true }).then(result => {
      if (!result?.listing || !Array.isArray(result.checks) || !Array.isArray(result.components)) throw new Error('Rental setup could not be loaded. Refresh readiness to retry.');
      if (alive) { setData(result); setOffer(result.listing); }
    }).catch(e => { if (alive) setError(e.details || e.message); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [base, id, refresh, reload]);
  const chooseProduct = product => setOffer(o => ({ ...o, productId: product._id, title: product.name, requirements: [{ poolKey: `product-${product._id}`, label: product.name.slice(0, 100), quantity: 1, productId: product._id }] }));
  const switchOffer = next => {
    if (dirty && !window.confirm('Switch rental offer? Unsaved changes will be lost.')) return;
    setPiece(newPiece()); setPieceBaseline(newPiece()); setQuantity(''); setError(''); setId(next); if (!next) setOffer(newOffer()); setStep(1);
  };
  const finishRegistration = () => {
    const saved = { ...piece, code: '', label: '' };
    setPiece(saved); setPieceBaseline(saved); setQuantity(''); setError(''); batch.current = rentalOperation(); setReload(v => v + 1);
  };
  const registerQuantity = async () => {
    const count = Number(quantity);
    if (!Number.isInteger(count) || count < 1 || count > 100) { setError('Enter the actual new pieces you own, from 1 to 100.'); return; }
    const result = await run(() => api.post(`${base}/setup/${id}/pieces`, { operationId: batch.current, revision: data.listing.revision, componentIndex: Number(piece.component), quantity: count, location: piece.location, condition: piece.condition }));
    if (result) finishRegistration();
  };
  const save = async () => {
    const problem = rentalPricingError(pricingFromOffer(offer));
    if (problem || !offer.productId || !offer.requirements.length) { setError(problem || 'Choose a catalogue product first.'); return; }
    setError('');
    const result = await run(() => api.post(`${base}/listings`, { ...offer, active: offer._id ? offer.active : false }));
    if (result) { setId(result._id); setOffer(result); setStep(2); setReload(v => v + 1); }
  };
  const addPiece = async () => {
    const component = data?.components[Number(piece.component)];
    if (!component) return;
    if (!piece.code.trim()) { setError('Enter a unique physical piece code, for example LEHENGA-001.'); return; }
    const result = await run(() => api.post(`${base}/assets`, { poolKey: component.poolKey, productId: component.productId || offer.productId, variantId: component.variantId || '', size: component.size || '', colour: component.colour || '', code: piece.code, label: piece.label || component.label, location: piece.location, condition: piece.condition }));
    if (result) finishRegistration();
  };
  const activate = async active => {
    if (!data) return;
    const result = await run(() => api.post(`${base}/listings`, { ...data.listing, active }));
    if (result) { setOffer(result); setReload(v => v + 1); }
  };
  return <section className="rental-card rental-setup" aria-busy={loading || busy}>
    <header className="rental-section-heading"><div><span className="rental-eyebrow">PRODUCT → PIECES → BOOKINGS</span><h2>Guided rental setup</h2><p className="rental-muted">Finish one step at a time. Your offer opens for booking only after you activate it.</p></div>{data?.listing.active && <span className="rental-status">Active offer</span>}</header>
    {!write && <p className="rental-notice">You can review setup. Ask a staff member with inventory editing access to save or activate it.</p>}
    <div className="rental-offer-selector"><RentalField label="Offer to set up"><select value={id} disabled={busy || loading} onChange={e => switchOffer(e.target.value)}><option value="">New offer</option>{rows.map(row => <option key={row._id} value={row._id}>{row.title} · {row.active ? 'Active' : 'Paused'}</option>)}{id && !rows.some(row => row._id === id) && <option value={id}>{data?.listing.title || 'Selected offer'}</option>}</select></RentalField><button type="button" className="rental-text-button" disabled={busy} onClick={() => switchOffer('')}>Create another rental offer</button></div>
    <details className="rental-disclosure"><summary>Find an existing offer / refresh setup</summary><RentalRecordPager base={base} kind="listings" refresh={refresh} onLoaded={setRows} /><button type="button" className="rental-button rental-button--secondary" disabled={busy || loading || !id} onClick={() => { if (dirty && !window.confirm('Reload this offer? Unsaved changes will be lost.')) return; setReload(v => v + 1); }}>Refresh readiness</button></details>
    <nav className="rental-setup-steps" aria-label="Rental setup steps">{['Price & fitting', 'Physical pieces', 'Review & activate'].map((label, i) => <button type="button" key={label} className={step === i + 1 ? 'is-selected' : ''} aria-current={step === i + 1 ? 'step' : undefined} disabled={busy || loading || (i > 0 && !data)} onClick={() => setStep(i + 1)}><strong>{i + 1}</strong><span>{label}</span></button>)}</nav>
    {error && <p role="alert" className="rental-notice">{error}</p>}{loading && <p role="status">Checking this offer…</p>}
    {!loading && step === 1 && <fieldset disabled={busy || !write}>
      <div ref={stepIntro} tabIndex={-1} className="rental-step-intro"><span>STEP 1 OF 3</span><h3>What can the customer rent?</h3><p>Pick a published Rent or Sale + rent product, then enter its actual rental price.</p></div>
      <RentalProductPicker base={base} productId={offer.productId} disabled={!!offer._id} onChoose={chooseProduct} onResolve={product => setOffer(o => !o._id && !o.requirements.length && o.productId === product._id ? { ...o, title: o.title || product.name, requirements: [{ poolKey: `product-${product._id}`, label: product.name.slice(0, 100), quantity: 1, productId: product._id }] } : o)} />
      <RentalField label="Offer title" maxLength={200} value={offer.title} onChange={title => setOffer(o => ({ ...o, title }))} />
      <ProductRentalPricing compact value={pricingFromOffer(offer)} offers={offer._id ? [offer] : []} apiPrefix={base.replace(/\/rentals$/, '')} onChange={pricing => setOffer(o => ({ ...o, ...pricing, fitting: pricing.fitting || o.fitting }))} />
      <p className="rental-muted">Rent is the hire charge. Security is refundable after inspection. Advance confirms the booking; “Use shop policy” follows your rental settings.</p>
      <details className="rental-disclosure"><summary>Optional cleaning / alteration fees</summary><div className="rental-fields"><RentalField label="Cleaning fee per set (₹)" type="number" min="0" step="0.01" value={offer.cleaningFeePaise / 100} onChange={value => setOffer(o => ({ ...o, cleaningFeePaise: Math.round(Number(value) * 100) }))} /><RentalField label="Alteration fee per set (₹)" type="number" min="0" step="0.01" value={offer.alterationFeePaise / 100} onChange={value => setOffer(o => ({ ...o, alterationFeePaise: Math.round(Number(value) * 100) }))} /></div><p className="rental-muted">Keep these at zero when no separate fee applies. Configured fees appear in the customer quote.</p></details>
      <div className="rental-step-actions"><button type="button" className="rental-button" onClick={save}>Save price & continue</button><button type="button" className="rental-text-button" disabled={!offer._id} onClick={() => onTab('listings', data?.listing)}>Manage bundled components & duration packages →</button></div>
    </fieldset>}
    {!loading && data && step === 2 && <>
      <div ref={stepIntro} tabIndex={-1} className="rental-step-intro"><span>STEP 2 OF 3</span><h3>Register actual pieces</h3><p>One product can have many physical pieces. A code identifies the exact item sent to a customer.</p></div>
      <ul className="rental-setup-checks">{data.components.map(component => <li key={component.poolKey} className={component.configured >= component.required ? 'is-ready' : ''}><strong>{component.label}</strong><span>{component.configured} registered · {component.required} required per set · {component.readyNow} ready now</span></li>)}</ul>
      <button type="button" className="rental-text-button" disabled={busy || !write} onClick={() => onTab('listings', data.listing)}>Need an outfit + jewellery set? Review included components →</button>
      <fieldset disabled={busy || !write}>
        <div className="rental-fields"><RentalField label="Component for this piece"><select value={piece.component} onChange={e => setPiece(p => ({ ...p, component: e.target.value }))}>{data.components.map((component, i) => <option key={component.poolKey} value={i}>{component.label}</option>)}</select></RentalField><RentalField label="Rack / location" placeholder="e.g. Bridal rack A" maxLength={200} value={piece.location} onChange={location => setPiece(p => ({ ...p, location }))} /></div>
        <details className="rental-disclosure"><summary>Condition of the new pieces: {piece.condition || 'Not entered'}</summary><RentalField label="Current condition" maxLength={1000} value={piece.condition} onChange={condition => setPiece(p => ({ ...p, condition }))} /></details>
        <section className="rental-register-card"><h3>Let the studio create piece codes</h3><p>Count only the new physical items you are adding.</p><RentalField label="New physical pieces to register (owner counted)" type="number" min="1" max="100" placeholder="e.g. 2 actual lehengas" value={quantity} onChange={setQuantity} /><p className="rental-muted">Adds to existing pieces, using the component, rack and condition above. For a set, register each included component separately.</p><button type="button" className="rental-button" disabled={!quantity || !data.components.length} onClick={registerQuantity}>Generate codes & register pieces</button></section>
        <details className="rental-disclosure"><summary>I already have a code / add one piece manually</summary><p className="rental-muted">Use this for an existing item label, for example LEHENGA-001. Every physical piece needs a different code.</p><div className="rental-fields"><RentalField label="Unique physical piece code" maxLength={80} value={piece.code} onChange={code => setPiece(p => ({ ...p, code }))} /><RentalField label="Piece label (optional)" maxLength={200} value={piece.label} onChange={label => setPiece(p => ({ ...p, label }))} /></div><button type="button" className="rental-button rental-button--secondary" onClick={addPiece}>Register this piece</button></details>
        <p className="rental-muted">These items are separate from sale stock. “Ready now” describes condition; availability for a date is checked at booking.</p>
        <div className="rental-step-actions"><button type="button" className="rental-text-button" onClick={() => setStep(1)}>← Back to price</button><button type="button" className="rental-button" onClick={() => setStep(3)}>Review activation</button></div>
      </fieldset>
    </>}
    {!loading && data && step === 3 && <>
      <div ref={stepIntro} tabIndex={-1} className="rental-step-intro"><span>STEP 3 OF 3</span><h3>{data.listing.active ? 'Offer is active' : 'Ready to open bookings?'}</h3><p>Resolve any incomplete checks before activating. Booked dates and cleaning buffers still control availability.</p></div>
      <ul className="rental-setup-checks">{data.checks.map(check => <li key={check.key} className={check.ready ? 'is-ready' : ''}><strong>{check.ready ? '✓' : '○'} {check.label}</strong></li>)}<li className={data.shopEnabled ? 'is-ready' : ''}><strong>{data.shopEnabled ? '✓' : '○'} Shop rental mode enabled</strong></li><li className={data.onlinePayments ? 'is-ready' : ''}><strong>{data.onlinePayments ? '✓' : '○'} Online payments enabled</strong></li><li className={data.acceptingOrders !== false ? 'is-ready' : ''}><strong>{data.acceptingOrders !== false ? '✓' : '○'} Shop accepting new orders</strong></li><li className={readiness.transactions ? 'is-ready' : ''}><strong>{readiness.transactions ? '✓' : '○'} Booking transactions available</strong></li></ul>
      {dirty && <p className="rental-notice" role="status">Save price changes in step 1, or register / clear new piece entries in step 2, before activating this offer.</p>}
      {(!data.onlinePayments || data.acceptingOrders === false) && <p className="rental-notice">Offer activation alone does not open online checkout. Review payment configuration and whether your shop is accepting orders.</p>}
      <div className="rental-step-actions"><button type="button" className="rental-text-button" onClick={() => setStep(2)}>← Back to pieces</button><button type="button" className="rental-button" disabled={busy || dirty || !write || !data.ready || !data.shopEnabled || !readiness.transactions || data.listing.active} onClick={() => activate(true)}>Activate rental offer</button>{data.listing.active && <><button type="button" className="rental-button rental-button--secondary" disabled={busy || dirty || !write} onClick={() => activate(false)}>Pause new bookings for this offer</button><button type="button" className="rental-button" disabled={busy} onClick={() => onTab('bookings')}>Go to daily work</button></>}</div>
    </>}
    <details className="rental-disclosure rental-launch-checklist"><summary>Shop settings to review before the first booking</summary><p>{readiness.onlinePayments ? '✓ Online payment provider configured' : '○ Online payment provider needs configuration for online collection'}</p><p>{policy.customerEmail || policy.customerWhatsapp ? '✓ Customer reminders enabled — check a real delivery in reminder history' : '○ Customer email / WhatsApp reminders are currently off'}</p><p>{policy.requireConditionPhotos ? '✓ Condition photos required at handover and return' : '○ Condition photos are optional under the current policy'}</p><p>{policy.requireCustomerAcknowledgement ? '✓ Customer acknowledgement required' : '○ Customer acknowledgement is optional under the current policy'}</p><p>Check pickup / return slots, cleaning time, delivery, cancellation, damage and deposit-refund terms.</p><p className="rental-muted">Before launch, test a booking, payment, pickup, return and refund with your real shop settings. Configuration checks do not prove SMS or payment delivery.</p>{permissions.configure !== false && <button type="button" className="rental-text-button" disabled={busy} onClick={() => onTab('settings')}>Open rental policy & reminder settings →</button>}</details>
  </section>;
}
