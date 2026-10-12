import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import { rentalUrl } from '../utils/rentals';

export default function useProductRentalOffers(productId, { storeSlug = '', requestedListing = '', enabled = true } = {}) {
  const key = `${storeSlug}:${productId || ''}:${requestedListing}`;
  const active = Boolean(enabled && productId);
  const [response, setResponse] = useState(null);
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => setRevision(value => value + 1), []);

  useEffect(() => {
    if (!active) return undefined;
    let alive = true;
    setResponse(null);
    api.get(rentalUrl('/rentals/products/' + productId, storeSlug), { silent: true, forceRefetch: revision > 0 }).then(data => {
      if (!Array.isArray(data?.listings)) throw new Error('Rental details could not be loaded. Please retry.');
      const listingId = requestedListing
        ? data.listings.some(listing => listing._id === requestedListing) ? requestedListing : ''
        : data.listings[0]?._id || '';
      if (alive) setResponse({ key, data, listingId, error: '' });
    }).catch(error => {
      if (alive) setResponse({ key, data: null, listingId: '', error: error.message || 'Rental details could not be loaded. Please retry.' });
    });
    return () => { alive = false; };
  }, [active, key, productId, requestedListing, revision, storeSlug]);

  const current = active && response?.key === key ? response : null;
  const data = current?.data;
  const error = current?.error || '';
  const listingId = current?.listingId || '';
  const listing = data?.listings.find(item => item._id === listingId);
  const setListingId = useCallback(id => setResponse(value => value?.key === key ? { ...value, listingId: id } : value), [key]);
  return { data, error, listing, listingId, setListingId, retry, loading: active && !data && !error, bookable: Boolean(data?.enabled && listing && listing.readiness?.ready !== false && data.readiness?.bookable !== false) };
}
