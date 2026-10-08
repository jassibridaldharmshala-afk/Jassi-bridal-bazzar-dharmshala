import { useEffect, useState } from 'react';
import api from '../services/api';
import { rentalUrl } from '../utils/rentals';
export default function useRentalOffers(items, storeSlug) {
  const key = items.map(item => item.listingId).sort().join(',');
  const [state, setState] = useState({ key: '', rows: [], loading: false, error: '' });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    if (!key) { setState({ key, rows: [], loading: false, error: '' }); return undefined; }
    setState({ key, rows: [], loading: true, error: '' });
    api.get(rentalUrl('/rentals/catalogue?listingIds=' + key, storeSlug), { silent: true, forceRefetch: true }).then(value => {
      if (!Array.isArray(value?.rows)) throw new Error('Your rental items could not be loaded.');
      if (alive) setState({ key, rows: value.rows, loading: false, error: '' });
    }).catch(e => { if (alive) setState({ key, rows: [], loading: false, error: e.message }); });
    return () => { alive = false; };
  }, [key, storeSlug, retry]);
  return { ...(state.key === key ? state : { rows: [], loading: !!key, error: '' }), reload: () => setRetry(n => n + 1) };
}
