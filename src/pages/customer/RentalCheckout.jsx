import { useEffect, useRef, useState } from 'react';
import { useStorefront } from '../../context/StorefrontContext';
import { useRentalBag } from '../../context/RentalBagContext';
import { rentalDetailHref } from '../../utils/rentalShopping';
import { storefrontPath } from '../../utils/routing';
import { rentalUrl, localDateTime } from '../../utils/rentals';
import { saveRentalSession } from '../../utils/rentalPlan';
import api from '../../services/api';
import RentalShop from './RentalShop';
import RentalShoppingCheckout from './RentalShoppingCheckout';
import RentalCheckoutLoading from '../../components/rentals/RentalCheckoutLoading';
export default function RentalCheckout({ navigate, route = '/rental-book' }) {
  const { storeSlug } = useStorefront();
  if (/\/rental-book$/.test(route.split('?')[0])) {
    const params = new URLSearchParams(route.split('?')[1] || '');
    if (params.get('product') || params.get('listing')) return <RentalLinkEntry key={route + ':' + storeSlug} params={params} navigate={navigate} />;
    return <RentalShop route={route} navigate={navigate} />;
  }
  return <RentalShoppingCheckout key={storeSlug || 'default'} navigate={navigate} />;
}
function RentalLinkEntry({ params, navigate }) {
  const { storeSlug } = useStorefront(); const bag = useRentalBag(); const [error, setError] = useState(''), [retry, setRetry] = useState(0);
  const currentBag = useRef(bag); currentBag.current = bag;
  const listing = params.get('listing'), product = params.get('product'), pickup = params.get('pickup'), returnAt = params.get('return');
  useEffect(() => {
    if (!bag.ready) return undefined;
    let alive = true; setError('');
    if (!listing) { navigate(rentalDetailHref({ _id: product }, storeSlug)); return undefined; }
    api.get(rentalUrl('/rentals/catalogue?listingIds=' + encodeURIComponent(listing), storeSlug), { silent: true, forceRefetch: true }).then(value => {
      const offer = value?.rows?.find(row => row._id === listing && (!product || String(row.productId) === product));
      if (!offer) throw new Error('This rental option is unavailable. Choose another rental.');
      if (!alive) return;
      if (!currentBag.current.items.some(item => item.listingId === listing) && !currentBag.current.add(listing)) throw new Error('Your rental bag is full. Review its items before adding another.');
      if (pickup && returnAt) saveRentalSession('checkout-dates', storeSlug, { pickupAt: localDateTime(pickup, value.configuration?.policy?.timezone), returnDueAt: localDateTime(returnAt, value.configuration?.policy?.timezone) });
      navigate(storefrontPath('/rental-checkout', storeSlug));
    }).catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [bag.ready, listing, product, pickup, returnAt, navigate, storeSlug, retry]);
  return <RentalCheckoutLoading error={error} onRetry={() => setRetry(n => n + 1)} onBack={() => navigate(product ? rentalDetailHref({ _id: product }, storeSlug, listing) : storefrontPath('/rental-book', storeSlug))} />;
}
