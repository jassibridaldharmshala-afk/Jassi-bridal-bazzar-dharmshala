import { useAuth } from '../../context/AuthContext';
import { useStorefront } from '../../context/StorefrontContext';
import { storefrontPath } from '../../utils/routing';
import RentalCatalogueBrowser from '../../components/rentals/RentalCatalogueBrowser';
import '../../components/rentals/Rentals.css';
export default function RentalCheckout({ navigate: navigateRoute, route = '/rental-book' }) {
  const { user } = useAuth();
  const { storeSlug } = useStorefront();
  const navigate = path => navigateRoute(storefrontPath(path, storeSlug));
  const productId = new URLSearchParams(route.split('?')[1] || '').get('product') || '';
  const query = new URLSearchParams(route.split('?')[1] || '');
  return <main className="rental-workspace"><header className="rental-hero"><h1>Rent your occasion look</h1><p>Outfits, jewellery and accessories, with clear dates, transparent deposits and a tracked return.</p></header><div className="rental-actions"><button type="button" className="rental-button rental-button--secondary" onClick={() => navigate('/rentals')}>My rentals</button><button type="button" className="rental-button rental-button--secondary" onClick={() => navigate('/products')}>Browse products</button></div><RentalCatalogueBrowser key={storeSlug + ':' + route} storeSlug={storeSlug} user={user} initialProductId={productId} initialListingId={query.get('listing') || ''} initialWaitlistId={query.get('waitlist') || ''} initialSchedule={{ pickupAt: query.get('pickup'), returnDueAt: query.get('return') }} onBooked={booking => navigate(`/rentals?id=${booking._id}`)} /></main>;
}
