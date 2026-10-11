import { CalendarDays, ChevronRight, Clock, ShieldCheck, Store } from 'lucide-react';
import { useState } from 'react';
import { rentalMoney } from '../../utils/rentals';
import { RentalFittingInfo } from './RentalFittingFields';
import RentalAvailabilityCalendar from './RentalAvailabilityCalendar';
import './MobileRentalDetails.css';

export default function MobileRentalDetails({ rental, product, navigate, storeSlug = '', onChooseDates }) {
  const { data, error, listing, listingId, setListingId, loading, retry, bookable } = rental;
  const [showAvailability, setShowAvailability] = useState(false);
  const contact = () => navigate('/contact');
  const options = data?.listings || [];
  const phone = String(data?.contact?.phone || '').replace(/[^\d+]/g, '');
  const size = listing?.size || (product?.sizes?.length === 1 ? product.sizes[0] : '');
  const colour = listing?.colour || (product?.colors?.length === 1 ? product.colors[0] : '');
  const fitting = listing?.fitting;
  const hasFitting = fitting && (fitting.adjustable || fitting.alterationsAvailable || fitting.instructions || fitting.actualSize || fitting.includedItems || Object.values(fitting.measurements || {}).some(value => value !== '' && value !== null));
  const policy = data?.policy;
  const storePickup = policy?.deliveryModes?.includes('STORE_PICKUP');
  const contactLinks = <div className="mobile-rental-details__contact">{phone && <a href={`tel:${phone}`}>Call store</a>}<button type="button" onClick={contact}>Contact store <ChevronRight size={14} aria-hidden="true" /></button></div>;

  return (
    <>
    <section className="mobile-rental-details" aria-label="Rental details" aria-busy={loading}>
      <h2>{listing ? 'Rental price details' : 'Rental booking'}</h2>
      {loading ? <><div className="mobile-rental-details__skeleton" aria-hidden="true" /><p role="status">Loading rental details…</p></> : error ? <><p role="alert">{error}</p><button type="button" className="mobile-rental-details__link" onClick={retry}>Retry rental details</button></> : !data?.enabled || !options.length ? <p>Online booking is not available for this item yet. Contact the store for rental availability.</p> : <>
        {options.length > 1 || !listing ? <label className="mobile-rental-details__option">{listing ? 'Rental option' : 'Choose another rental option'}<select value={listingId} onChange={event => setListingId(event.target.value)}><option value="" disabled>Choose a rental option</option>{options.map(option => <option key={option._id} value={option._id}>{[option.title, option.size, option.colour].filter(Boolean).join(' · ')}</option>)}</select></label> : null}
        {!listing ? <p role="alert">The linked rental option is unavailable. Choose another option to book.</p> : <>
          <dl className="mobile-rental-details__prices"><div><dt>Rent per use day</dt><dd>{rentalMoney(listing.dailyRatePaise)}</dd></div><div><dt>Refundable security deposit</dt><dd>{rentalMoney(listing.depositPaise)}</dd></div></dl>
          {Number(listing.cleaningFeePaise) > 0 && <dl className="mobile-rental-details__prices"><div><dt>Cleaning fee</dt><dd>{rentalMoney(listing.cleaningFeePaise)}</dd></div></dl>}
          {Number(listing.alterationFeePaise) > 0 && <dl className="mobile-rental-details__prices"><div><dt>Alterations, if needed</dt><dd>{rentalMoney(listing.alterationFeePaise)}</dd></div></dl>}
          <p className="mobile-rental-details__note"><CalendarDays size={16} aria-hidden="true" />Only selected use days are charged. Pickup and return days add no rent.</p>
          <p className="mobile-rental-details__note"><ShieldCheck size={16} aria-hidden="true" />Deposit is settled after return inspection. Final total is shown before booking.</p>
          {!bookable && <p role="status">Online booking is currently unavailable. Contact the store to check this item.</p>}
        </>}
      </>}
      {!loading && (!listing || !bookable) && contactLinks}
    </section>
    {listing && data?.enabled && <>
      {(size || colour || hasFitting || listing.includedItems?.length > 0 || listing.notes) && <section className="mobile-rental-details" aria-label="Rental fit and included items">
        <h2>Fit &amp; included items</h2>
        {(size || colour) && <dl className="mobile-rental-details__specs">{size && <div><dt>Size</dt><dd>{size}</dd></div>}{colour && <div><dt>Colour</dt><dd>{colour}</dd></div>}</dl>}
        {hasFitting && <RentalFittingInfo value={fitting} />}
        {listing.includedItems?.length > 0 && <div className="mobile-rental-details__included"><h3>Included in this rental</h3><ul>{listing.includedItems.map((item, index) => <li key={index}><span>{item.label}</span><b>× {item.quantity}</b></li>)}</ul></div>}
        {listing.notes && <p>{listing.notes}</p>}
      </section>}
      <section className="mobile-rental-details" aria-label="Rental pickup and return">
        <h2>Pickup &amp; return</h2>
        <div className="mobile-rental-details__service"><Store aria-hidden="true" /><div><h3>{storePickup ? 'Store pickup & return' : 'Collection options at checkout'}</h3>{storePickup && data.contact?.storeName && <p>{data.contact.storeName}</p>}{storePickup && data.contact?.address && <p>{data.contact.address}</p>}</div></div>
        {policy?.pickupStart && policy?.pickupEnd && <div className="mobile-rental-details__service"><Clock aria-hidden="true" /><div><h3>Shop hours</h3><p>{policy.pickupStart} – {policy.pickupEnd}</p></div></div>}
        <p className="mobile-rental-details__note"><CalendarDays size={16} aria-hidden="true" />Choose use days, pickup and return at checkout. Availability is checked for the full period.</p>
        {policy && <button type="button" className="mobile-rental-details__link mobile-rental-details__availability-link" aria-expanded={showAvailability} onClick={() => setShowAvailability(value => !value)}><CalendarDays size={16} aria-hidden="true" />{showAvailability ? 'Hide availability' : 'See date availability'}<ChevronRight size={14} aria-hidden="true" /></button>}
        {showAvailability && policy && <div className="mobile-rental-details__availability"><RentalAvailabilityCalendar availabilityOnly key={listing._id} listing={listing} policy={policy} storeSlug={storeSlug} onChoose={onChooseDates} /></div>}
        {policy?.terms && <details className="mobile-rental-details__terms"><summary>Rental &amp; return policy</summary><p>{policy.terms}</p></details>}
        {bookable && contactLinks}
      </section>
    </>}
    </>
  );
}
