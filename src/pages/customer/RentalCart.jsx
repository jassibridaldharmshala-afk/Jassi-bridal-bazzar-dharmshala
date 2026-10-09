import { ArrowLeft, ArrowRight, ShoppingBag } from 'lucide-react';
import { useStorefront } from '../../context/StorefrontContext';
import { useRentalBag } from '../../context/RentalBagContext';
import useRentalOffers from '../../hooks/useRentalOffers';
import { storefrontPath } from '../../utils/routing';
import { rentalMoney } from '../../utils/rentals';
import RentalBagItems from '../../components/rentals/RentalBagItems';
import ShoppingModeTabs from '../../components/rentals/ShoppingModeTabs';
export default function RentalCart({ navigate }) {
  const { storeSlug } = useStorefront(); const bag = useRentalBag();
  const { rows, loading, error, reload } = useRentalOffers(bag.items, storeSlug);
  const missing = bag.items.some(item => !rows.some(row => row._id === item.listingId));
  const daily = bag.items.reduce((n, item) => n + (rows.find(row => row._id === item.listingId)?.dailyRatePaise || 0) * item.quantity, 0);
  const go = path => navigate(storefrontPath(path, storeSlug));
  return <section className="rental-shopping-page"><header className="rental-shopping-header"><button type="button" aria-label="Back to rentals" onClick={() => go('/rental-book')}><ArrowLeft size={22} /></button><h1>Your rental bag <small>{bag.itemCount} items</small></h1></header><ShoppingModeTabs mode="rent" navigate={navigate} />
    {!bag.ready || loading ? <p role="status">Loading your rental bag…</p> : error ? <div role="alert"><p>{error}</p><button onClick={reload}>Retry</button></div> : !bag.items.length ? <div className="rental-shopping-empty"><ShoppingBag size={38} /><h2>Your rental bag is empty</h2><p>Save your look here, then choose dates at checkout.</p><button className="rental-shopping-primary" onClick={() => go('/rental-book')}>Explore rentals</button></div> : <div className="rental-shopping-columns"><div><RentalBagItems items={bag.items} offers={rows} storeSlug={storeSlug} navigate={navigate} onUpdate={bag.update} onRemove={bag.remove} /><button type="button" className="rental-shopping-link" onClick={() => go('/rental-book')}>+ Add more rentals</button></div><aside className="rental-shopping-card rental-cart-summary"><h2>Ready for your occasion?</h2><div className="rental-price-row"><span>Rent per use day</span><strong>{rentalMoney(daily)}</strong></div><p>Choose use dates, pickup and return at checkout. Your final rent and refundable security are shown before booking.</p>{missing && <p role="alert">Remove unavailable items to continue.</p>}<button type="button" className="rental-shopping-primary" disabled={missing} onClick={() => go('/rental-checkout')}>Continue to checkout<ArrowRight size={18} /></button><button type="button" className="rental-shopping-link" onClick={() => go('/cart')}>Open buy bag</button></aside></div>}
  <div className="rental-checkout-utilities" data-rental-checkout-utilities /></section>;
}
