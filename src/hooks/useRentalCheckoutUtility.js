import { useEffect, useState } from 'react';

// Keep existing help/privacy controls clear of shopping and order actions.
export default function useRentalCheckoutUtility(route) {
  const [target, setTarget] = useState(null);
  useEffect(() => {
    if (!/\/(rental-book|rental-cart|rental-checkout|rental-success|rentals|orders|order-detail|product|products)(?:[/?]|$)/.test(route || '')) { setTarget(null); return undefined; }
    const locate = () => {
      const next = document.querySelector('[data-rental-checkout-utilities]');
      setTarget(current => current === next ? current : next);
    };
    locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [route]);
  return target?.isConnected ? target : null;
}

