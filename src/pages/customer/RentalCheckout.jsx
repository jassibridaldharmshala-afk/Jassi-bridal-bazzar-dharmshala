import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useStorefront } from '../../context/StorefrontContext';
import { useRentalBag } from '../../context/RentalBagContext';
import { rentalDetailHref } from '../../utils/rentalShopping';
import { storefrontPath } from '../../utils/routing';
import { rentalUrl, localDateTime } from '../../utils/rentals';
import { saveRentalSession } from '../../utils/rentalPlan';
import api from '../../services/api';
import RentalShop from './RentalShop';
import RentalShoppingCheckout from './RentalShoppingCheckout';
export default function RentalCheckout({ navigate, route = '/rental-book' }) {
  const { storeSlug } = useStorefront(); const { user } = useAuth();
  if (/\/rental-book$/.test(route.split('?')[0])) {
    const params = new URLSearchParams(route.split('?')[1] || '');
    if (params.get('product') || params.get('listing')) return <RentalLinkEntry key={route + ':' + storeSlug} params={params} navigate={navigate} />;
    return <RentalShop route={route} navigate={navigate} />;
  }
  return <RentalShoppingCheckout key={storeSlug + ':' + (user?._id || user?.id || 'guest')} navigate={navigate} />;
}
function RentalLinkEntry({ params, navigate }) {
  const { storeSlug } = useStorefront(); const bag = useRentalBag(); const [error, setError] = useState('');
  const listing = params.get('listing'), product = params.get('product');
  useEffect(() => {
    if (!bag.ready) return undefined;
    let alive = true;
    if (!listing) { navigate(rentalDetailHref({ _id: product }, storeSlug)); return undefined; }
    api.get(rentalUrl('/rentals/catalogue?listingIds=' + encodeURIComponent(listing), storeSlug), { silent: true, forceRefetch: true }).then(value => {
      const offer = value?.rows?.find(row => row._id === listing && (!product || String(row.productId) === product));
      if (!offer) throw new Error('This rental option is unavailable. Choose another rental.');
      if (!alive) return;
      if (!bag.items.some(item => item.listingId === listing) && !bag.add(listing)) throw new Error('Your rental bag is full. Review its items before adding another.');
      if (params.get('pickup') && params.get('return')) saveRentalSession('checkout-dates', storeSlug, { pickupAt: localDateTime(params.get('pickup'), value.configuration?.policy?.timezone), returnDueAt: localDateTime(params.get('return'), value.configuration?.policy?.timezone) });
      navigate(storefrontPath('/rental-checkout', storeSlug));
    }).catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [bag.ready, listing, product, navigate, storeSlug, params, bag]);
  return <section className="rental-shopping-page">{error ? <><p role="alert">{error}</p><button className="rental-shopping-primary" onClick={() => navigate(storefrontPath('/rental-book', storeSlug))}>Browse rentals</button></> : <p role="status">Opening your rental…</p>}</section>;
}
