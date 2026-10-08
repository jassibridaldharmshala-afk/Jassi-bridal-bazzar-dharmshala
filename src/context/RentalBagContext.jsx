import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { cleanRentalBag } from '../utils/rentalShopping';
import { clearRentalSession, readRentalSession, saveRentalSession } from '../utils/rentalPlan';

const empty = { items: [], itemCount: 0, ready: false, add: () => false, update: () => {}, remove: () => {}, consume: () => {} };
const RentalBagContext = createContext(empty);
export function RentalBagProvider({ children, user, storeSlug = '' }) {
  const actor = user?._id || user?.id || '';
  const scope = `${storeSlug || 'default'}:${actor}`;
  const [bag, setBag] = useState(() => ({ scope, items: cleanRentalBag(readRentalSession('bag', storeSlug, actor)?.items), consumed: readRentalSession('bag', storeSlug, actor)?.consumed || [] }));
  useEffect(() => {
    if (bag.scope === scope) return;
    let items = cleanRentalBag(readRentalSession('bag', storeSlug, actor)?.items);
    // Adopt only the signed-out bag from this boutique. Account bags never migrate.
    if (actor && bag.scope === `${storeSlug || 'default'}:`) {
      items = cleanRentalBag([...items, ...bag.items]); clearRentalSession('bag', storeSlug, '');
    }
    setBag({ scope, items, consumed: readRentalSession('bag', storeSlug, actor)?.consumed || [] });
  }, [actor, bag, scope, storeSlug]);
  const ready = bag.scope === scope;
  useEffect(() => { if (ready) saveRentalSession('bag', storeSlug, { items: bag.items, consumed: bag.consumed }, actor); }, [actor, bag.items, bag.consumed, ready, storeSlug]);
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
