import { readRentalSession, saveRentalSession, clearRentalSession } from './rentalPlan';
import { rentalAddressFields } from './rentalDetails';
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const text = (value, limit) => typeof value === 'string' ? value.slice(0, limit) : '';
function clean(value) {
  const source = object(value), customer = object(source.customer), details = object(source.details);
  const address = value => Object.fromEntries(rentalAddressFields.map(([key]) => [key, text(object(value)[key], key === 'pincode' ? 6 : key === 'mobile' ? 25 : 120)]));
  const contact = (value, authorised) => !value ? null : { name: text(object(value).name, 100), phone: text(object(value).phone, 25), ...(authorised ? { relationship: text(object(value).relationship, 100), authorised: object(value).authorised === true } : {}) };
  return {
    customer: { name: text(customer.name, 100), email: text(customer.email, 150), whatsappConsent: customer.whatsappConsent === true },
    eventAt: text(source.eventAt, 30),
    details: { version: 1, deliveryAddress: address(details.deliveryAddress), collectionAddress: address(details.collectionAddress), sameAsDelivery: details.sameAsDelivery !== false,
      alternateContact: contact(details.alternateContact, false), pickupContact: contact(details.pickupContact, true), returnContact: contact(details.returnContact, true),
      occasion: text(details.occasion, 100), fittingInstructions: text(details.fittingInstructions, 1000), deliveryInstructions: text(details.deliveryInstructions, 1000) },
  };
}
export function readGuestRentalContact(storeSlug) {
  const value = readRentalSession('guest-contact', storeSlug);
  if (value && Date.now() - value.savedAt < 30 * 60 * 1000) return clean(value);
  clearRentalSession('guest-contact', storeSlug); return null;
}
export function saveGuestRentalContact(storeSlug, value) {
  saveRentalSession('guest-contact', storeSlug, clean(value));
}
export function rentalContactScope(user, storeSlug, counter = false) {
  const actor = user?._id || user?.id;
  return !counter && user?.isPhoneVerified && actor ? `${storeSlug || 'default'}:${actor}` : '';
}
export function readRentalContactDraft(storeSlug, user, counter = false) {
  if (!rentalContactScope(user, storeSlug, counter)) return null;
  const value = readRentalSession('contact', storeSlug, user._id || user.id);
  return value ? clean(value) : null;
}
export function saveRentalContactDraft(storeSlug, user, value, counter = false) {
  if (rentalContactScope(user, storeSlug, counter)) saveRentalSession('contact', storeSlug, clean(value), user._id || user.id);
}
export function clearRentalContactSessions(actor) {
  if (!actor) return;
  try {
    const keys = Array.from({ length: sessionStorage.length }, (_, index) => sessionStorage.key(index));
    for (const key of keys) if (key?.startsWith('rental-contact:') && key.endsWith(':' + actor)) sessionStorage.removeItem(key);
  } catch { /* Logout remains available with storage disabled. */ }
}
