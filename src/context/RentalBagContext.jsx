import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { cleanRentalBag } from '../utils/rentalShopping';
import { clearRentalSession, readRentalSession, saveRentalSession } from '../utils/rentalPlan';

const empty = { items: [], itemCount: 0, ready: false, add: () => false, addMany: () => false, update: () => {}, remove: () => {}, consume: () => {} };
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
  const bagRef = useRef(bag); bagRef.current = bag;
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
  const value = {
    ready, items: ready ? bag.items : [], itemCount: ready ? bag.items.reduce((n, item) => n + item.quantity, 0) : 0,
    add: (listingId, quantity = 1) => append([{ listingId, quantity }]),
    addMany: append,
    update: (listingId, quantity) => mutate(current => ({ ...current, items: cleanRentalBag(current.items.map(item => item.listingId === listingId ? { listingId, quantity } : item)) })),
    remove: listingId => mutate(current => ({ ...current, items: current.items.filter(item => item.listingId !== listingId) })),
    consume: (purchased, bookingId) => mutate(current => current.consumed?.includes(bookingId) ? current : ({ ...current, consumed: [...(current.consumed || []), bookingId].slice(-100), items: cleanRentalBag(current.items.map(item => ({ ...item, quantity: item.quantity - (purchased.find(row => row.listingId === item.listingId)?.quantity || 0) }))) })),
  };
  function mutate(change) {
    if (!ready || bagRef.current.scope !== scope) return false;
    const next = change(bagRef.current); bagRef.current = next; setBag(next); return true;
  }
  function append(items) {
    if (!ready || bagRef.current.scope !== scope || !Array.isArray(items) || !items.length || items.some(item => !/^[a-f\d]{24}$/i.test(item.listingId || '') || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10)) return false;
    const combined = [...bagRef.current.items, ...items], totals = new Map();
    for (const item of combined) totals.set(item.listingId, (totals.get(item.listingId) || 0) + item.quantity);
    if (totals.size > 10 || [...totals.values()].some(total => total > 10)) return false;
    return mutate(current => ({ ...current, items: cleanRentalBag([...current.items, ...items]) }));
  }
  return <RentalBagContext.Provider value={value}>{children}</RentalBagContext.Provider>;
}
export const useRentalBag = () => useContext(RentalBagContext);
