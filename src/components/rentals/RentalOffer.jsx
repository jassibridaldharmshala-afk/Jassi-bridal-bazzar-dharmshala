import { useEffect, useState } from 'react';
import api from '../../services/api';
import { useStorefront } from '../../context/StorefrontContext';
import { rentalMoney, rentalUrl } from '../../utils/rentals';
import RentalAvailabilityCalendar from './RentalAvailabilityCalendar';
import { RentalFittingInfo } from './RentalFittingFields';
import RentalContact from './RentalContact';
import './Rentals.css';
export default function RentalOffer({ productId, commerceMode, navigate }) {
  const { storeSlug } = useStorefront();
  const [data, setData] = useState(null), [error, setError] = useState(''), [reload, setReload] = useState(0), [listingId, setListingId] = useState(''), [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!productId) return undefined;
    let alive = true; setData(null); setError(''); setExpanded(false);
    Promise.resolve(api.get(rentalUrl(`/rentals/products/${productId}`, storeSlug), { silent: true, forceRefetch: true }))
      .then(value => { if (!value || !Array.isArray(value.listings)) throw new Error('Rental details could not be loaded. Please retry.'); if (alive) { setData(value); setListingId(value?.listings?.[0]?._id || ''); } })
      .catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [productId, storeSlug, reload]);
  const expectsRental = ['RENTAL_ONLY', 'SALE_AND_RENTAL'].includes(commerceMode);
  if (!data && !error && expectsRental) return <section className="rental-card rental-offer"><h2>Rental availability</h2><p role="status">Loading rental options and setup status…</p><RentalContact navigate={navigate} /></section>;
  if (error && expectsRental) return <section className="rental-card rental-offer"><h2>Rental availability</h2><p role="alert">{error}</p><button type="button" className="rental-button" onClick={() => setReload(value => value + 1)}>Retry rental details</button><RentalContact navigate={navigate} /></section>;
  if (!data?.enabled || !data.listings?.length) return expectsRental && data ? <section className="rental-card rental-offer"><h2>Rent this look</h2><p className="rental-muted">Online rental bookings are not open for this item yet. Contact the store for availability.</p>{data.readiness?.reasons?.map((reason, i) => <p key={i}>{reason.message}</p>)}<RentalContact contact={data.contact} navigate={navigate} /></section> : null;
  const listing = data.listings.find(row => row._id === listingId) || data.listings[0];
  const book = row => navigate(`/rental-book?${new URLSearchParams({ product: productId, listing: listing._id, ...(row ? { pickup: row.pickupAt, return: row.returnDueAt } : {}) })}`);
  return <section className="rental-card rental-offer">
    <span className="rental-eyebrow">RENT FOR YOUR OCCASION</span><h2>Wear it. Celebrate. Return.</h2>
    {data.listings.length > 1 && <label className="rental-field"><span>Rental option</span><select value={listing._id} onChange={event => setListingId(event.target.value)}>{data.listings.map(row => <option key={row._id} value={row._id}>{row.title}{row.colour ? ` · ${row.colour}` : ''}{row.size ? ` · ${row.size}` : ''}</option>)}</select></label>}
    <div className="rental-offer__prices"><div><span>Rental price</span><strong>{rentalMoney(listing.dailyRatePaise)}<small> / day</small></strong></div><div><span>Refundable deposit</span><strong>{rentalMoney(listing.depositPaise)}</strong></div></div>
    <RentalFittingInfo value={listing.fitting} />
    {listing.includedItems?.length > 0 && <p className="rental-muted">Included: {listing.includedItems.map(item => `${item.label} × ${item.quantity}`).join(' · ')}</p>}
    {data.readiness?.reasons?.map((reason, i) => <p className="rental-notice" key={i}>{reason.message}</p>)}
    {data.readiness?.bookable === false && <RentalContact contact={data.contact} navigate={navigate} />}
    <p className="rental-muted">Pickup and return use the shop timezone ({data.timezone}). Preparation: {data.policy?.preparationHours || 0} hours · cleaning buffer: {data.policy?.cleaningHours || 0} hours. Cleaning fee {rentalMoney(listing.cleaningFeePaise || 0)} · alterations {rentalMoney(listing.alterationFeePaise || 0)} per set. Review cancellation retention and refundable security in your quote before reserving.</p>
    {!!listing.packages?.length && <p className="rental-muted">Packages: {listing.packages.map(pack => `${pack.days} days ${rentalMoney(pack.pricePaise)}`).join(' · ')}</p>}
    <p className="rental-muted">Rental charges and security are separate from the purchase price. Review the full amount and booking advance before reserving.</p>
    <p className="rental-muted">Choose dates → review the total → reserve → pay the advance.</p><div className="rental-actions"><button type="button" className="rental-button" onClick={() => book()}>Book this rental</button><button type="button" className="rental-button rental-button--secondary" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? 'Hide availability' : 'See date availability'}</button><button type="button" className="rental-text-button" onClick={() => navigate('/rentals')}>Track my rentals →</button></div>
    {expanded && <RentalAvailabilityCalendar key={listing._id} listing={listing} policy={data.policy} storeSlug={storeSlug} onChoose={book} />}
  </section>;
}
