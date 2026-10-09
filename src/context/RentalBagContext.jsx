import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { cleanRentalBag } from '../utils/rentalShopping';
import { clearRentalSession, readRentalSession, saveRentalSession } from '../utils/rentalPlan';

const empty = { items: [], itemCount: 0, ready: false, add: () => false, update: () => {}, remove: () => {}, consume: () => {} };
const RentalBagContext = createContext(empty);
function initialBag(storeSlug, actor, scope) {
  const saved = readRentalSession('bag', storeSlug, actor);
  const guest = actor ? readRentalSession('bag', storeSlug, '') : null;
  return { scope, items: cleanRentalBag([...(saved?.items || []), ...(guest?.items || [])]), consumed: saved?.consumed || [], adoptGuest: Boolean(guest) };
}
export function RentalBagProvider({ children, user, storeSlug = '' }) {
  const actor = user?._id || user?.id || '';
  const scope = `${storeSlug || 'default'}:${actor}`;
  // Cart/wishlist account keys can remount this provider after OTP sign-in.
  // Read the same-store guest bag at initial mount as well as on a scope change.
  const [bag, setBag] = useState(() => initialBag(storeSlug, actor, scope));
  useEffect(() => {
    if (bag.scope === scope) return;
    let items = cleanRentalBag(readRentalSession('bag', storeSlug, actor)?.items);
    // Adopt only the signed-out bag from this boutique. Account bags never migrate.
    if (actor && bag.scope === `${storeSlug || 'default'}:`) {
      items = cleanRentalBag([...items, ...bag.items]);
    }
    setBag({ scope, items, consumed: readRentalSession('bag', storeSlug, actor)?.consumed || [], adoptGuest: Boolean(actor && bag.scope === `${storeSlug || 'default'}:`) });
  }, [actor, bag, scope, storeSlug]);
  const ready = bag.scope === scope;
  useEffect(() => {
    if (!ready) return;
    saveRentalSession('bag', storeSlug, { items: bag.items, consumed: bag.consumed }, actor);
    if (actor && bag.adoptGuest) {
      clearRentalSession('bag', storeSlug, '');
      setBag(current => ({ ...current, adoptGuest: false }));
    }
  }, [actor, bag.items, bag.consumed, bag.adoptGuest, ready, storeSlug]);
  const value = useMemo(() => ({
    ready, items: ready ? bag.items : [], itemCount: ready ? bag.items.reduce((n, item) => n + item.quantity, 0) : 0,
    add: (listingId, quantity = 1) => { if (!ready || (!bag.items.some(item => item.listingId === listingId) && bag.items.length >= 10)) return false; setBag(current => ({ ...current, scope, items: cleanRentalBag([...current.items, { listingId, quantity }]) })); return true; },
    update: (listingId, quantity) => { if (ready) setBag(current => ({ ...current, scope, items: cleanRentalBag(current.items.map(item => item.listingId === listingId ? { listingId, quantity } : item)) })); },
    remove: listingId => { if (ready) setBag(current => ({ ...current, scope, items: current.items.filter(item => item.listingId !== listingId) })); },
    consume: (purchased, bookingId) => { if (ready) setBag(current => current.consumed?.includes(bookingId) ? current : ({ ...current, scope, consumed: [...(current.consumed || []), bookingId].slice(-100), items: cleanRentalBag(current.items.map(item => ({ ...item, quantity: item.quantity - (purchased.find(row => row.listingId === item.listingId)?.quantity || 0) }))) })); },
  }), [bag.items, ready, scope]);
  return <RentalBagContext.Provider value={value}>{children}</RentalBagContext.Provider>;
}
export const useRentalBag = () => useContext(RentalBagContext);
