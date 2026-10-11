import { rentalUrl } from '../utils/rentals';

export const RENTAL_AVAILABILITY_TAG = 'RentalAvailability';
export const RENTAL_AVAILABILITY_EVENT = 'samira:rental-availability-changed';
export const RENTAL_CALENDAR_TIMEOUT = 15000;

export function rentalCalendarRequest({ listingId, items, month, days, quantity, pickupTime, returnTime, deliveryMode, storeSlug, apiBase = '/rentals', staffStoreId }) {
  const options = { silent: true, cache: 'no-store', timeout: RENTAL_CALENDAR_TIMEOUT };
  if (items?.length) {
    const path = `${apiBase}/calendar${staffStoreId ? `?storeId=${encodeURIComponent(staffStoreId)}` : ''}`;
    return { ...options, url: rentalUrl(path, storeSlug), method: 'POST', body: { month, days, pickupTime, returnTime, deliveryMode, items } };
  }
  const query = new URLSearchParams({ month, days: String(days), quantity: String(quantity), pickupTime, returnTime, ...(deliveryMode ? { deliveryMode } : {}) });
  return { ...options, url: rentalUrl(`/rentals/calendar/${encodeURIComponent(listingId)}?${query}`, storeSlug) };
}

// Calendar/quote POSTs are reads. Neither they nor cart, contact, proof or
// marketing changes should invalidate a customer's date selection.
export function changesRentalAvailability(path = '', method = 'GET') {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) return false;
  const resource = path.split('?')[0];
  if (/^\/(?:admin|seller)\/product-drafts\/publish-selected$/.test(resource)) return true;
  if (/^\/(?:admin|seller)\/products(?:\/|$)/.test(resource)) {
    return !/\/(?:smart-fill|quick-analyze|caption|poster)(?:\/|$)/.test(resource);
  }
  if (/^\/(?:admin|seller)\/rentals\/(?:configuration|listings|assets|blocks|tasks|setup\/[^/]+\/pieces)(?:\/|$)/.test(resource)) return true;
  return /^\/(?:admin\/|seller\/)?rentals\/bookings(?:$|\/[^/]+\/(?:payment|payments|verify|collection|operation|reschedule|replace|cancel-items|resolve)(?:\/|$))/.test(resource);
}

export function broadcastRentalAvailabilityChange() {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(RENTAL_AVAILABILITY_EVENT, `${Date.now()}:${Math.random()}`); } catch { /* Final booking still checks the server. */ }
}

export function installRentalAvailabilitySync(store, api) {
  if (typeof window === 'undefined') return () => {};
  const changed = event => {
    if (event.key === RENTAL_AVAILABILITY_EVENT && event.newValue !== event.oldValue) {
      store.dispatch(api.util.invalidateTags([RENTAL_AVAILABILITY_TAG]));
    }
  };
  window.addEventListener('storage', changed);
  return () => window.removeEventListener('storage', changed);
}
