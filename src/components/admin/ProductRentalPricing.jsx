import RentalFittingFields from '../rentals/RentalFittingFields';
export const emptyRentalPricing = { dailyRatePaise: '', depositPaise: 0, advanceMode: 'STORE', fitting: { adjustable: true, alterationsAvailable: true, instructions: '' } };
export function pricingFromOffer(offer) {
  return offer ? { listingId: offer._id, revision: offer.revision || 0, dailyRatePaise: offer.dailyRatePaise, depositPaise: offer.depositPaise || 0, advanceMode: offer.advanceMode || 'STORE', advancePercent: offer.advancePercent, advanceAmountPaise: offer.advanceAmountPaise, ...(offer.fitting ? { fitting: offer.fitting } : {}) } : { ...emptyRentalPricing };
}
export function rentalPricingError(value) {
  if (!value || !Number.isSafeInteger(value.dailyRatePaise) || value.dailyRatePaise < 1 || value.dailyRatePaise > 100000000) return 'Enter a rental price per day greater than zero (up to two decimals).';
  if (!Number.isSafeInteger(value.depositPaise) || value.depositPaise < 0 || value.depositPaise > 100000000) return 'Enter a refundable deposit of zero or more (up to two decimals).';
  if (value.advanceMode === 'PERCENT' && (!Number.isInteger(value.advancePercent) || value.advancePercent < 1 || value.advancePercent > 100)) return 'Enter an advance percentage from 1 to 100.';
  if (value.advanceMode === 'FIXED' && (!Number.isSafeInteger(value.advanceAmountPaise) || value.advanceAmountPaise < 1 || value.advanceAmountPaise > 100000000)) return 'Enter a fixed booking advance greater than zero.';
  return '';
}
export default function ProductRentalPricing({ value, offers = [], onChange, error, apiPrefix, compact = false }) {
  const pricing = value || emptyRentalPricing;
  const patch = (key, next) => onChange({ ...pricing, [key]: next });
  const money = key => pricing[key] === '' || pricing[key] === undefined ? '' : pricing[key] / 100;
  const setMoney = (key, raw) => patch(key, raw === '' ? '' : Math.round(Number(raw) * 100));
  const selected = offers.find(offer => offer._id === pricing.listingId);
  return <section className="admin-rental-pricing lg:col-span-2" aria-label="Rental pricing">
    <header><span>RENT THIS ITEM</span><h3>Rental price & security</h3><p>Sale and rental have separate prices. The customer pays only for the option they choose.</p></header>
    {offers.length > 1 && <label className="admin-field"><span>Rental offer to price</span><select aria-label="Rental offer to price" className="admin-field__control" value={pricing.listingId || ''} onChange={event => onChange(pricingFromOffer(offers.find(offer => offer._id === event.target.value)))}>{offers.map(offer => <option key={offer._id} value={offer._id}>{offer.title}{offer.active ? '' : ' · inactive'}</option>)}</select><small>Each offer keeps its own prices, packages and physical pieces.</small></label>}
    <div className="admin-rental-pricing__fields">
      <label className="admin-field"><span>Rental price per day (₹)</span><input className="admin-field__control" type="number" min="0.01" step="0.01" value={money('dailyRatePaise')} onChange={event => setMoney('dailyRatePaise', event.target.value)} placeholder="Enter daily rent" /></label>
      <label className="admin-field"><span>Refundable security deposit (₹)</span><input className="admin-field__control" type="number" min="0" step="0.01" value={money('depositPaise')} onChange={event => setMoney('depositPaise', event.target.value)} /><small>Deposit is separate from rent; zero is allowed.</small></label>
      <label className="admin-field"><span>Booking advance</span><select className="admin-field__control" value={pricing.advanceMode || 'STORE'} onChange={event => patch('advanceMode', event.target.value)}><option value="STORE">Use shop policy</option><option value="PERCENT">Percentage for this offer</option><option value="FIXED">Fixed amount per rented set</option></select></label>
      {pricing.advanceMode === 'PERCENT' && <label className="admin-field"><span>Rental advance (%)</span><input className="admin-field__control" type="number" min="1" max="100" step="1" value={pricing.advancePercent ?? ''} onChange={event => patch('advancePercent', Number(event.target.value))} /></label>}
      {pricing.advanceMode === 'FIXED' && <label className="admin-field"><span>Rental advance per set (₹)</span><input className="admin-field__control" type="number" min="0.01" step="0.01" value={money('advanceAmountPaise')} onChange={event => setMoney('advanceAmountPaise', event.target.value)} /><small>Capped at the rental amount; deposit follows shop policy.</small></label>}
    </div>
    {compact ? <details className="rental-disclosure"><summary>Fitting & included items · {pricing.fitting?.adjustable ? 'Adjustable' : 'Review fitting'}</summary><RentalFittingFields value={pricing.fitting} onChange={value => patch('fitting', value)} /></details> : <RentalFittingFields value={pricing.fitting} onChange={value => patch('fitting', value)} />}
    {error && <p role="alert" data-error-field="rentalPricing" tabIndex="-1" className="admin-field__error">{error}</p>}
    <p className="admin-form-hint">{!pricing.listingId ? 'Saving creates an inactive rental offer. Add the actual pieces and activate it in Rental Studio before customers can book.' : selected?.active ? 'This offer is live. Saving updates its future quotes; existing bookings keep their accepted prices.' : 'This offer is inactive. Add physical pieces and activate it in Rental Studio.'} {!compact && <a href={`${apiPrefix}/rentals?tab=setup${pricing.listingId ? `&listing=${encodeURIComponent(pricing.listingId)}` : ''}`}>Complete rental setup</a>}</p>
  </section>;
}
