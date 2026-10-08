import { useEffect, useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import api from '../../services/api';
import { useStorefront } from '../../context/StorefrontContext';
import { useRentalBag } from '../../context/RentalBagContext';
import { rentalMoney, rentalUrl } from '../../utils/rentals';
import RentalAvailabilityCalendar from './RentalAvailabilityCalendar';
import { RentalFittingInfo } from './RentalFittingFields';
import RentalContact from './RentalContact';
export default function RentalOffer({ productId, commerceMode, navigate }) {
  const { storeSlug } = useStorefront(); const bag = useRentalBag();
  const [data, setData] = useState(null), [error, setError] = useState(''), [reload, setReload] = useState(0), [listingId, setListingId] = useState(''), [expanded, setExpanded] = useState(false), [notice, setNotice] = useState('');
  const requestedListing = new URLSearchParams(window.location.search).get('listing') || '';
  useEffect(() => {
    if (!productId) return undefined;
    let alive = true; setData(null); setError(''); setExpanded(false); setNotice('');
    api.get(rentalUrl('/rentals/products/' + productId, storeSlug), { silent: true, forceRefetch: true }).then(value => {
      if (!Array.isArray(value?.listings)) throw new Error('Rental details could not be loaded. Please retry.');
      if (alive) { setData(value); const requested = requestedListing; setListingId(requested ? value.listings.some(row => row._id === requested) ? requested : '' : value.listings[0]?._id || ''); }
    }).catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [productId, storeSlug, reload, requestedListing]);
  const expectsRental = ['RENTAL_ONLY', 'SALE_AND_RENTAL'].includes(commerceMode);
  if (!data && !error) return expectsRental ? <section className="rental-customer-offer"><p role="status">Loading rental options…</p></section> : null;
  if (error) return expectsRental ? <section className="rental-customer-offer"><p role="alert">{error}</p><button onClick={() => setReload(v => v + 1)}>Retry rental details</button><RentalContact navigate={navigate} /></section> : null;
  if (!data?.enabled || !data.listings.length) return expectsRental ? <section className="rental-customer-offer"><h2>Rent this look</h2><p>Online rental bookings are not open for this item yet. Contact the store for availability.</p><RentalContact contact={data?.contact} navigate={navigate} /></section> : null;
  const listing = data.listings.find(row => row._id === listingId);
  if (!listing) return <section className="rental-customer-offer"><h2>Rental option unavailable</h2><p role="alert">The linked rental option is no longer available. Choose another option before booking.</p><label className="rental-checkout-field">Available rental options<select value="" onChange={e => setListingId(e.target.value)}><option value="">Choose another rental option</option>{data.listings.map(row => <option key={row._id} value={row._id}>{row.title}{row.size ? ' · ' + row.size : ''}{row.colour ? ' · ' + row.colour : ''}</option>)}</select></label><RentalContact contact={data.contact} navigate={navigate} /></section>;
  const book = dates => navigate('/rental-book?' + new URLSearchParams({ product: productId, listing: listing._id, ...(dates ? { pickup: dates.pickupAt, return: dates.returnDueAt } : {}) }));
  return <section className="rental-customer-offer"><h2>Rent this look</h2>{data.listings.length > 1 && <label className="rental-checkout-field">Choose an option<select value={listing._id} onChange={e => { setListingId(e.target.value); setNotice(''); }}>{data.listings.map(row => <option key={row._id} value={row._id}>{row.title}{row.size ? ' · ' + row.size : ''}{row.colour ? ' · ' + row.colour : ''}</option>)}</select></label>}
    <div className="rental-customer-offer__price"><strong>{rentalMoney(listing.dailyRatePaise)}<small> / use day</small></strong><span>Refundable security {rentalMoney(listing.depositPaise)}</span></div><RentalFittingInfo value={listing.fitting} />
    {listing.includedItems?.length > 0 && <p className="rental-shopping-hint">Includes {listing.includedItems.map(item => item.label + ' × ' + item.quantity).join(' · ')}</p>}
    <p className="rental-shopping-hint">Choose use dates and pickup/return at checkout. Review the total before booking.</p>
    <div className="rental-customer-offer__actions"><button type="button" className="rental-shopping-primary" disabled={data.readiness?.bookable === false} onClick={() => book()}>Book this rental</button><button type="button" className="rental-shopping-secondary" disabled={!bag.ready} onClick={() => { if (bag.add(listing._id)) setNotice('Added to your rental bag. Choose dates when you are ready.'); else setNotice('Your bag holds up to 10 rental options. Review your bag to continue.'); }}><ShoppingBag size={18} />Add for later</button></div>
    {notice && <p role="status">{notice}<button className="rental-shopping-link" onClick={() => navigate('/rental-cart')}>View rental bag →</button></p>}
    {data.readiness?.bookable === false && <RentalContact contact={data.contact} navigate={navigate} />}
    <button type="button" className="rental-shopping-link" aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>{expanded ? 'Hide availability' : 'See date availability'}</button>
    {expanded && <RentalAvailabilityCalendar availabilityOnly key={listing._id} listing={listing} policy={data.policy} storeSlug={storeSlug} onChoose={book} />}
  </section>;
}
