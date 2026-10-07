import { trackEvent } from '../../utils/analytics';
import './ShoppingDiscovery.css';
export default function ShoppingShortcuts({ data, navigate }) {
  if (!data) return null;
  const occasions = data.occasionShoppingEnabled !== false && Array.isArray(data.occasions) ? data.occasions : [];
  if (!occasions.length && !data.rentalEnabled) return null;
  return <div className="shopping-discovery">
    {!!occasions.length && <section className="shopping-discovery__section" aria-label="Shop by occasion"><h2>Shop by occasion</h2><p>Find pieces for the moments you’re dressing for.</p><div className="shopping-discovery__chips">{occasions.map(item => <button type="button" key={item.key} onClick={() => { trackEvent('HOME_VIEW_ALL', { metadata: { sectionId: 'occasions', occasion: item.label } }); navigate(`/products?occasion=${encodeURIComponent(item.label)}`); }}>{item.label}</button>)}</div></section>}
    {data.rentalEnabled && <section className="shopping-discovery__section shopping-discovery__rental" aria-label="Rental shopping"><div><h2>{data.mode === 'RENTAL_ONLY' ? 'Find your next occasion look' : 'Your look. Your choice.'}</h2><p>Rent outfits and accessories for your dates. Review rental charges and refundable deposits before reserving.</p></div><div className="shopping-discovery__chips">{data.mode !== 'RENTAL_ONLY' && <button type="button" onClick={() => navigate('/products')}>Shop to buy</button>}<button type="button" className="shopping-discovery__primary" onClick={() => navigate('/rental-book')}>Explore rentals & check dates</button></div></section>}
  </div>;
}
