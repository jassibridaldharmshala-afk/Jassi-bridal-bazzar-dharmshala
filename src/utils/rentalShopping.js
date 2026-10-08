import { productHref } from './routing';

export const rentalShoppingRoute = route => /\/(rental-book|rental-cart|rental-checkout|rental-success|rentals)(?:[/?]|$)/.test(route || '') || new URLSearchParams(String(route || '').split('?')[1] || '').get('mode') === 'rent';
export function rentalDetailHref(product, storeSlug = '', listingId = '') {
  const href = productHref(product, storeSlug);
  return href + (href.includes('?') ? '&' : '?') + new URLSearchParams({ mode: 'rent', ...(listingId ? { listing: listingId } : {}) });
}
export function cleanRentalBag(items) {
  const combined = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    if (!/^[a-f\d]{24}$/i.test(String(item?.listingId || ''))) continue;
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) continue;
    combined.set(item.listingId, Math.min(10, (combined.get(item.listingId) || 0) + quantity));
  }
  return [...combined].slice(0, 10).map(([listingId, quantity]) => ({ listingId, quantity }));
}
export function rentalUseDates(start, end = start) {
  const valid = day => /^\d{4}-\d{2}-\d{2}$/.test(day || '') && Number.isFinite(Date.parse(day + 'T12:00Z')) && new Date(day + 'T12:00Z').toISOString().slice(0, 10) === day;
  if (!valid(start) || !valid(end)) throw new Error('Choose the dates when you will use your rental.');
  const length = (Date.parse(end + 'T12:00Z') - Date.parse(start + 'T12:00Z')) / 86400000 + 1;
  if (length < 1 || length > 90) throw new Error('The last use day must follow the first (up to 90 days).');
  return Array.from({ length }, (_, i) => new Date(Date.parse(start + 'T12:00Z') + i * 86400000).toISOString().slice(0, 10));
}

export const rentalUseDayLabel = day => new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', dateStyle: 'medium' }).format(new Date(day + 'T12:00Z'));
