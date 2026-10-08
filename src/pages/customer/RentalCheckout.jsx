import RentalFaq from '../../components/rentals/RentalFaq';
import { trackEvent } from '../../utils/analytics';
import { useEffect } from 'react';
import api from '../../services/api';
import { rentalUrl } from '../../utils/rentals';
import { readRentalSession, clearRentalSession } from '../../utils/rentalPlan';
import { useAuth } from '../../context/AuthContext';
import { useStorefront } from '../../context/StorefrontContext';
import { storefrontPath } from '../../utils/routing';
import RentalCatalogueBrowser from '../../components/rentals/RentalCatalogueBrowser';
import '../../components/rentals/Rentals.css';
export default function RentalCheckout({ navigate: navigateRoute, route = '/rental-book' }) {
  const { user } = useAuth();
  const { storeSlug } = useStorefront();
  useEffect(() => { trackEvent('RENTAL_CTA', { storeSlug }); }, [storeSlug]);
  const navigate = path => navigateRoute(storefrontPath(path, storeSlug));
  useEffect(() => {
    const actor = user?._id || user?.id;
    if (!actor) return undefined;
    let alive = true;
    const pending = readRentalSession('reserve', storeSlug, actor);
    if (pending?.request?.attemptId) api.get(rentalUrl('/rentals/bookings/recover/' + pending.request.attemptId, storeSlug), { silent: true, forceRefetch: true }).then(booking => { if (alive) { clearRentalSession('reserve', storeSlug, actor); clearRentalSession('contact', storeSlug, actor); navigateRoute(storefrontPath('/rentals?id=' + booking._id, storeSlug)); } }).catch(() => {});
    return () => { alive = false; };
  }, [user, storeSlug, navigateRoute]);
  const productId = new URLSearchParams(route.split('?')[1] || '').get('product') || '';
  const query = new URLSearchParams(route.split('?')[1] || '');
  return <main className="rental-workspace"><header className="rental-hero"><h1>Rent your occasion look</h1><p>Outfits, jewellery and accessories, with clear dates, transparent deposits and a tracked return.</p></header><div className="rental-actions"><button type="button" className="rental-button rental-button--secondary" onClick={() => navigate('/rentals')}>My rentals</button><button type="button" className="rental-button rental-button--secondary" onClick={() => navigate('/products')}>Browse products</button></div><RentalCatalogueBrowser key={storeSlug + ':' + route} storeSlug={storeSlug} user={user} initialProductId={productId} initialListingId={query.get('listing') || ''} initialWaitlistId={query.get('waitlist') || ''} initialSchedule={{ pickupAt: query.get('pickup'), returnDueAt: query.get('return') }} navigate={navigate} onRequireLogin={() => navigate(`/login?redirect=${encodeURIComponent(storefrontPath(route, storeSlug))}`)} onBooked={booking => navigate(`/rentals?id=${booking._id}`)} /><RentalFaq storeSlug={storeSlug} /></main>;
}
