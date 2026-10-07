import { useEffect, useState } from 'react';
import api from '../../services/api';
import { useStorefront } from '../../context/StorefrontContext';
import { rentalMoney, rentalUrl } from '../../utils/rentals';
import './Rentals.css';
export default function RentalOffer({ productId, navigate }) {
  const { storeSlug } = useStorefront();
  const [data, setData] = useState(null);
  useEffect(() => { if (!productId) return undefined; let alive = true; Promise.resolve(api.get(rentalUrl(`/rentals/products/${productId}`, storeSlug), { silent: true })).then(v => { if (alive) setData(v); }).catch(() => { if (alive) setData(null); }); return () => { alive = false; }; }, [productId, storeSlug]);
  if (!data?.enabled || !data.listings.length) return null;
  const rate = Math.min(...data.listings.map(l => l.dailyRatePaise));
  return <section className="rental-card rental-offer"><h2>Love the look? Rent it.</h2><p>From {rentalMoney(rate)} / day</p><p className="rental-muted">Choose dates and size, review the deposit, and track pickup and return. Sale and rental stock are managed separately.</p><div className="rental-actions"><button type="button" className="rental-button" onClick={() => navigate(`/rental-book?product=${productId}`)}>Check rental dates</button><button type="button" className="rental-button rental-button--secondary" onClick={() => navigate('/rentals')}>My rentals</button></div></section>;
}
