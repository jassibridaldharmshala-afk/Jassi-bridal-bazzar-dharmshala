import { ArrowLeft, ArrowRight, CalendarDays, Heart, LoaderCircle, LockKeyhole, ShoppingBag } from 'lucide-react';
import { useStorefront } from '../../context/StorefrontContext';
import { useRentalBag } from '../../context/RentalBagContext';
import useRentalOffers from '../../hooks/useRentalOffers';
import { storefrontPath } from '../../utils/routing';
import { rentalMoney } from '../../utils/rentals';
import RentalBagItems from '../../components/rentals/RentalBagItems';
import '../../components/rentals/RentalShopping.css';
import './Cart.css';
import '../../styles/MobileShoppingTheme.css';
import './RentalCart.css';
import BagTypeTabs from '../../components/cart/BagTypeTabs';
export default function RentalCart({ navigate }) {
  const { storeSlug } = useStorefront(); const bag = useRentalBag();
  const { rows, loading, error, reload } = useRentalOffers(bag.items, storeSlug);
  const missing = bag.items.some(item => !rows.some(row => row._id === item.listingId));
  const daily = bag.items.reduce((n, item) => n + (rows.find(row => row._id === item.listingId)?.dailyRatePaise || 0) * item.quantity, 0);
  const deposit = bag.items.reduce((n, item) => n + (rows.find(row => row._id === item.listingId)?.depositPaise || 0) * item.quantity, 0);
  const go = path => navigate(storefrontPath(path, storeSlug));
  const count = `${bag.itemCount} ${bag.itemCount === 1 ? 'item' : 'items'}`;
  const continueButton = className => <button type="button" aria-label="Continue to dates" className={`sc-bag__primary ${className}`} disabled={missing} onClick={() => go('/rental-checkout')}>{className ? 'Continue to dates' : 'Continue'}<ArrowRight size={17} /></button>;
  return <section className="sc-bag rental-cart">
    <header className="sc-bag__mobile-header"><button type="button" aria-label="Back to rentals" onClick={() => go('/rental-book')}><ArrowLeft size={21} /></button><div><h1>Your rental bag</h1><span>{count}</span></div><button type="button" aria-label="Open wishlist" onClick={() => go('/wishlist')}><Heart size={21} /></button></header>
    <div className="sc-bag__shell">
    <div className="sc-bag__heading-row"><header className="sc-bag__top rental-cart__header"><div><button type="button" className="rental-cart__back" aria-label="Back to rentals" onClick={() => go('/rental-book')}><ArrowLeft size={21} /></button><h1>Your rental bag <span>{count}</span></h1></div><p className="sc-bag__secure"><LockKeyhole size={15} />Secure booking</p></header><BagTypeTabs active="rent" navigate={navigate} storeSlug={storeSlug} /></div>
    <nav className="sc-bag__steps rental-cart__mobile-steps" aria-label="Rental checkout progress"><span aria-current="step"><b>1</b> Bag</span><i /><span><b>2</b> Dates</span><i /><span><b>3</b> Booking</span></nav>
    {!bag.ready || loading ? <div className="rental-cart__loading" role="status"><LoaderCircle size={22} className="sc-bag__spin" />Loading your rental bag…</div> : error ? <div className="sc-bag__alert" role="alert"><p>{error}</p><button type="button" onClick={reload}>Retry</button></div> : !bag.items.length ? <div className="rental-cart__empty"><ShoppingBag size={36} /><h2>Your rental bag is empty</h2><p>Add a rental, then choose your dates.</p><button type="button" className="sc-bag__primary" onClick={() => go('/rental-book')}>Explore rentals</button></div> : <>
      <div className="sc-bag__layout"><div className="sc-bag__main">
        <div className="rental-cart__plan-note"><CalendarDays size={18} /><span>Choose use days, pickup and return at checkout.</span></div>
        <RentalBagItems presentation="bag" items={bag.items} offers={rows} storeSlug={storeSlug} navigate={navigate} onUpdate={bag.update} onRemove={bag.remove} />
        <button type="button" className="sc-bag__wishlist-link sc-bag__panel rental-cart__add" onClick={() => go('/rental-book')}><CalendarDays size={19} /><span>Add more rentals</span><ArrowRight size={19} /></button>
      </div><aside className="sc-bag__aside rental-cart__aside"><section id="rental-bag-price-details" className="sc-bag__prices sc-bag__panel">
        <h2>PRICE DETAILS <span>({count})</span></h2>
        <div className="sc-bag__price-row"><span>Rent / use day</span><span>{rentalMoney(daily)}</span></div>
        <div className="sc-bag__price-row"><span>Refundable deposit</span><span>{rentalMoney(deposit)}</span></div>
        <div className="sc-bag__total"><strong>Estimated total</strong><strong>{missing ? 'Unavailable' : rentalMoney(daily + deposit)}</strong></div>
        <p className="sc-bag__tax rental-cart__charge-note">Includes refundable deposit and 1 use day. Choose dates at checkout for the final total.</p>
        {missing && <p className="sc-bag__issue" role="alert">Remove unavailable items to continue.</p>}
        {continueButton('sc-bag__desktop-continue')}
        <p className="sc-bag__next">Review availability and total before booking.</p>
      </section><div className="sc-bag__help"><span>Need help with your rental?</span><button type="button" onClick={() => go('/contact')}>Contact store<ArrowRight size={14} /></button></div></aside></div>
      <div className="sc-bag__mobile-continue"><div><small>Estimated total · 1 use day</small><strong>{missing ? 'Unavailable' : rentalMoney(daily + deposit)}</strong><button type="button" onClick={() => document.getElementById('rental-bag-price-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>View price details</button></div>{continueButton('')}</div>
    </>}
    <div className="rental-checkout-utilities" data-rental-checkout-utilities />
  </div></section>;
}
