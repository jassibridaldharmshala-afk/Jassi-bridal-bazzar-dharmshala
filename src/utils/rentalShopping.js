import { productHref } from './routing';
import { localDateTime, rentalInstant } from './rentals';

export const rentalShoppingRoute = route => /\/(rental-book|rental-cart|rental-checkout|rental-success|rentals)(?:[/?]|$)/.test(route || '') || new URLSearchParams(String(route || '').split('?')[1] || '').get('mode') === 'rent' || (/\/orders(?:[/?]|$)/.test(route || '') && new URLSearchParams(String(route || '').split('?')[1] || '').get('type') === 'rental');
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

export const rentalSlotLabel = time => new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date('2000-01-01T' + time + ':00Z'));
export const rentalDayOffset = (day, offset) => new Date(Date.parse(day + 'T12:00Z') + offset * 86400000).toISOString().slice(0, 10);
export function defaultRentalSchedule(days, policy, now = Date.now()) {
  const sorted = days.filter(day => /^\d{4}-\d{2}-\d{2}$/.test(day)).sort();
  if (!sorted.length) return {};
  const earliest = localDateTime(now + (policy.minimumLeadHours || 0) * 3600000, policy.timezone).slice(0, 10);
  const proposed = rentalDayOffset(sorted[0], -1);
  return { pickupAt: (proposed >= earliest ? proposed : sorted[0]) + 'T', returnDueAt: rentalDayOffset(sorted[sorted.length - 1], 1) + 'T' };
}
export function validateRentalCheckoutDates(form, policy) {
  const days = [form.useStart, ...(form.additionalUseDates || [])].flatMap(day => rentalUseDates(day));
  if (new Set(days).size !== days.length) throw new Error('Each use day should be selected only once.');
  if (days.length < (policy.minimumDays || 1) || days.length > (policy.maximumDays || 90)) throw new Error(`Choose ${policy.minimumDays || 1}–${policy.maximumDays || 90} use days.`);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(form.pickupAt || '')) throw new Error('Choose an available pickup date and time.');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(form.returnDueAt || '')) throw new Error('Choose an available return date and time.');
  const pickupAt = rentalInstant(form.pickupAt, policy.timezone), returnDueAt = rentalInstant(form.returnDueAt, policy.timezone);
  if (+new Date(returnDueAt) <= +new Date(pickupAt)) throw new Error('Return must be after pickup.');
  if (days.some(day => day < form.pickupAt.slice(0, 10) || day > form.returnDueAt.slice(0, 10))) throw new Error('Collect on or before your first use day and return on or after your last use day.');
  const minutes = time => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  for (const [label, value] of [['pickup', form.pickupAt], ['return', form.returnDueAt]]) {
    const day = value.slice(0, 10), weekday = new Date(day + 'T12:00Z').getUTCDay();
    if (policy.closedDates?.includes(day) || policy.closedWeekdays?.includes(weekday)) throw new Error(`The shop is closed on your ${label} date. Choose another date.`);
    const time = minutes(value.slice(11)), start = minutes(policy.pickupStart), end = minutes(policy.pickupEnd);
    if (time < start || time >= end || (time - start) % (policy.slotMinutes || 60)) throw new Error(`Choose an available ${label} time during shop hours.`);
  }
  return { useDates: days, pickupAt, returnDueAt };
}
