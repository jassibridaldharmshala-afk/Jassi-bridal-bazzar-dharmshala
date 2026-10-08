import { useEffect, useState } from 'react';
import api from '../../services/api';
import { useStorefront } from '../../context/StorefrontContext';
import { rentalUrl } from '../../utils/rentals';
import { storefrontPath } from '../../utils/routing';
export default function RentalStorefrontLink({ className = '', navigate, children = 'Rentals' }) {
  const { storeSlug } = useStorefront();
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let active = true; setEnabled(false);
    api.get(rentalUrl('/rentals/configuration', storeSlug), { silent: true, cacheFirst: true })
      .then(config => { if (active) setEnabled(['RENTAL_ONLY', 'SALE_AND_RENTAL'].includes(config?.mode)); }).catch(() => {});
    return () => { active = false; };
  }, [storeSlug]);
  if (!enabled) return null;
  const href = storefrontPath('/rental-book', storeSlug);
  return <a className={className} href={href} onClick={event => {
    if (navigate && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); navigate(href); }
  }}>{children}</a>;
}
