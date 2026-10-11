import { useEffect, useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import useProductRentalOffers from '../../hooks/useProductRentalOffers';
import { useStorefront } from '../../context/StorefrontContext';
import { useRentalBag } from '../../context/RentalBagContext';
import { rentalMoney } from '../../utils/rentals';
import RentalAvailabilityCalendar from './RentalAvailabilityCalendar';
import { RentalFittingInfo } from './RentalFittingFields';
import RentalContact from './RentalContact';
export default function RentalOffer({ productId, commerceMode, navigate, compact = false, onBuy }) {
  const { storeSlug } = useStorefront(); const bag = useRentalBag();
  const [expanded, setExpanded] = useState(false), [notice, setNotice] = useState('');
  const requestedListing = new URLSearchParams(window.location.search).get('listing') || '';
  const { data, error, listing, setListingId, retry } = useProductRentalOffers(productId, { storeSlug, requestedListing });
  const buyAction = onBuy && <button type="button" className="rental-shopping-secondary" onClick={onBuy}>Buy this item</button>;
  useEffect(() => {
    setExpanded(false); setNotice('');
  }, [productId, requestedListing]);
  const expectsRental = ['RENTAL_ONLY', 'SALE_AND_RENTAL'].includes(commerceMode);
  if (!data && !error) return expectsRental ? <section className="rental-customer-offer"><p role="status">Loading rental options…</p>{buyAction}</section> : null;
  if (error) return expectsRental ? <section className="rental-customer-offer"><p role="alert">{error}</p><button onClick={retry}>Retry rental details</button><RentalContact navigate={navigate} />{buyAction}</section> : null;
  if (!data?.enabled || !data.listings.length) return expectsRental ? <section className="rental-customer-offer"><h2>Rent this look</h2><p>Online rental bookings are not open for this item yet. Contact the store for availability.</p><RentalContact contact={data?.contact} navigate={navigate} />{buyAction}</section> : null;
  if (!listing) return <section className="rental-customer-offer"><h2>Rental option unavailable</h2><p role="alert">The linked rental option is no longer available. Choose another option before booking.</p><label className="rental-checkout-field">Available rental options<select value="" onChange={e => setListingId(e.target.value)}><option value="">Choose another rental option</option>{data.listings.map(row => <option key={row._id} value={row._id}>{row.title}{row.size ? ' · ' + row.size : ''}{row.colour ? ' · ' + row.colour : ''}</option>)}</select></label><RentalContact contact={data.contact} navigate={navigate} />{buyAction}</section>;
  const book = dates => navigate('/rental-book?' + new URLSearchParams({ product: productId, listing: listing._id, ...(dates ? { pickup: dates.pickupAt, return: dates.returnDueAt } : {}) }));
  return <section className={`rental-customer-offer${compact ? ' rental-customer-offer--inline' : ''}`} aria-label="Rental details">{!compact && <h2>Rent this look</h2>}{data.listings.length > 1 && <label className="rental-checkout-field">Choose an option<select value={listing._id} onChange={e => { setListingId(e.target.value); setNotice(''); }}>{data.listings.map(row => <option key={row._id} value={row._id}>{row.title}{row.size ? ' · ' + row.size : ''}{row.colour ? ' · ' + row.colour : ''}</option>)}</select></label>}
    <div className="rental-customer-offer__price"><strong>{rentalMoney(listing.dailyRatePaise)}<small> / use day</small></strong><span>Refundable security {rentalMoney(listing.depositPaise)}</span></div><RentalFittingInfo value={listing.fitting} />
    {listing.includedItems?.length > 0 && <p className="rental-shopping-hint">Includes {listing.includedItems.map(item => item.label + ' × ' + item.quantity).join(' · ')}</p>}
    <p className="rental-shopping-hint">Choose use dates and pickup/return at checkout. Review the total before booking.</p>
    <div className={`rental-customer-offer__actions${onBuy ? ' rental-customer-offer__actions--mixed' : ''}`}><button type="button" className="rental-shopping-secondary" disabled={!bag.ready || data.readiness?.bookable === false} onClick={() => { if (bag.add(listing._id)) setNotice('Added to your rental bag. Choose dates when you are ready.'); else setNotice('Your bag holds up to 10 rental options. Review your bag to continue.'); }}><ShoppingBag size={18} />Add to rental bag</button><button type="button" className="rental-shopping-primary" disabled={data.readiness?.bookable === false} onClick={() => book()}>Book now</button>{buyAction}</div>
    {notice && <p role="status">{notice}<button className="rental-shopping-link" onClick={() => navigate('/rental-cart')}>View rental bag →</button></p>}
    {data.readiness?.bookable === false && <RentalContact contact={data.contact} navigate={navigate} />}
    <button type="button" className="rental-shopping-link" aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>{expanded ? 'Hide availability' : 'See date availability'}</button>
    {expanded && <RentalAvailabilityCalendar availabilityOnly key={listing._id} listing={listing} policy={data.policy} storeSlug={storeSlug} onChoose={book} />}
    {!compact && <div className="rental-checkout-utilities" data-rental-checkout-utilities />}
  </section>;
}
