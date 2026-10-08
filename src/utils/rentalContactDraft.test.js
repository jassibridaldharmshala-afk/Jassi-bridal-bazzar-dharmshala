import { clearRentalContactSessions, readRentalContactDraft, saveRentalContactDraft } from './rentalContactDraft';
import { readRentalSession, saveRentalSession } from './rentalPlan';
const user = { _id: 'customer-one', isPhoneVerified: true };
beforeEach(() => sessionStorage.clear());
test('private rental draft is isolated by account and boutique and never includes prices or acceptance', () => {
  saveRentalContactDraft('bridal', user, { customer: { name: 'Buyer', phone: '9876543210', email: 'buyer@example.test', whatsappConsent: true }, details: { occasion: 'Wedding', deliveryAddress: { houseNo: '12', city: 'Dharamshala' } }, eventAt: '2030-01-11T12:00', price: 99, quoteFingerprint: 'old', accepted: true });
  const restored = readRentalContactDraft('bridal', user);
  expect(restored.customer).toEqual({ name: 'Buyer', email: 'buyer@example.test', whatsappConsent: true });
  expect(restored.details.deliveryAddress.houseNo).toBe('12');
  expect(restored).not.toHaveProperty('price'); expect(restored).not.toHaveProperty('accepted'); expect(restored).not.toHaveProperty('quoteFingerprint');
  expect(readRentalContactDraft('other', user)).toBeNull();
  expect(readRentalContactDraft('bridal', { ...user, _id: 'customer-two' })).toBeNull();
  expect(readRentalContactDraft('bridal', null)).toBeNull();
});
test('guest and staff counter contacts are not persisted', () => {
  saveRentalContactDraft('bridal', null, { customer: { name: 'Guest' } });
  saveRentalContactDraft('bridal', { ...user, isPhoneVerified: false }, { customer: { name: 'Unverified' } });
  saveRentalContactDraft('bridal', user, { customer: { name: 'Counter customer' } }, true);
  expect(sessionStorage.length).toBe(0);
});
test('expired, malformed and future-dated drafts are removed rather than restored', () => {
  const key = 'rental-contact:bridal:customer-one';
  for (const value of [JSON.stringify({ savedAt: Date.now() - 86400001, customer: { name: 'Expired' } }), '{broken', JSON.stringify({ savedAt: Date.now() + 10000 }), JSON.stringify([])]) {
    sessionStorage.setItem(key, value);
    expect(readRentalContactDraft('bridal', user)).toBeNull();
    expect(sessionStorage.getItem(key)).toBeNull();
  }
});
test('logout clears this account private contact drafts while preserving other users and the public bag', () => {
  for (const boutique of ['bridal', 'other']) saveRentalContactDraft(boutique, user, { customer: { name: 'Buyer' } });
  saveRentalContactDraft('bridal', { ...user, _id: 'customer-two' }, { customer: { name: 'Other' } });
  saveRentalSession('plan', 'bridal', { items: [{ listingId: 'offer', quantity: 1 }] });
  clearRentalContactSessions(user._id);
  expect(readRentalContactDraft('bridal', user)).toBeNull(); expect(readRentalContactDraft('other', user)).toBeNull();
  expect(readRentalContactDraft('bridal', { ...user, _id: 'customer-two' }).customer.name).toBe('Other');
  expect(readRentalSession('plan', 'bridal').items[0].listingId).toBe('offer');
});
test('corrupt stored contact types are normalized before rendering', () => {
  saveRentalSession('contact', 'bridal', { customer: { name: {}, email: [], whatsappConsent: 'true' }, details: { deliveryAddress: { city: {} }, pickupContact: { name: {}, phone: {} } } }, user._id);
  const result = readRentalContactDraft('bridal', user);
  expect(result.customer).toEqual({ name: '', email: '', whatsappConsent: false });
  expect(result.details.deliveryAddress.city).toBe(''); expect(result.details.pickupContact.name).toBe('');
});
