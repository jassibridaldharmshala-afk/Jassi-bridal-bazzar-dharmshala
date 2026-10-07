export const SETTINGS_CHANGED_EVENT = 'samira:settings-changed';
export const SETTINGS_STORAGE_KEY = 'samira:settings-revision';
export const SETTINGS_SECTIONS = [
  { id: 'identity', title: 'Brand & identity', note: 'Your name, logo and browser icon, consistent across your store.', icon: 'brand', keywords: 'logo company favicon' },
  { id: 'business', title: 'Business & invoices', note: 'Seller information customers see on receipts and invoices.', icon: 'invoice', keywords: 'GST tax receipt' },
  { id: 'contact', title: 'Contact & support', note: 'Help customers reach the right person, at the right time.', icon: 'contact', keywords: 'email phone address whatsapp footer hours' },
  { id: 'delivery', title: 'Orders & delivery', note: 'Choose self delivery or a courier, and control delivery charges.', icon: 'delivery', keywords: 'pause minimum platform fee shipping self manual courier tracking' },
  { id: 'payments', title: 'Payments & COD', note: 'Payment options, cash on delivery limits and prepaid offers.', icon: 'payment', keywords: 'Razorpay UPI cards RTO pincode discount' },
  { id: 'policies', title: 'Policies & information', note: 'Clear expectations for delivery, returns and customer support.', icon: 'policy', keywords: 'privacy terms returns cancellation size FAQ story' },
  { id: 'social', title: 'Social & app links', note: 'Connect the storefront to your public profiles and shopping apps.', icon: 'social', keywords: 'Instagram Facebook YouTube Pinterest Android Apple' },
  { id: 'website', title: 'Website & announcement', note: 'Shopping discovery, announcement, browser title and store description.', icon: 'website', keywords: 'SEO metadata banner occasion recently viewed complete look recommendations shopping' },
  { id: 'sms', title: 'OTP & SMS', note: 'Choose, test and safely activate your SMS login provider.', icon: 'policy', keywords: 'Twilio MSG91 2Factor Fast2SMS login authentication credentials', deploymentOnly: true },
  { id: 'order-alerts', title: 'Order alerts', note: 'Receive new orders by email or WhatsApp, with secure provider setup and delivery history.', icon: 'contact', keywords: 'notifications email WhatsApp Brevo Meta owner order alerts' },
  { id: 'traffic', title: 'Traffic & privacy', note: 'Visitor analytics, consent, timezone, retention and optional GA4.', icon: 'website', keywords: 'visitors traffic analytics tracking sessions consent reports GA4 Google retention privacy' },
  { id: 'rentals', title: 'Rental operations', note: 'Sale/rental mode, booking calendar rules, deposits, pickup, returns and reminders.', icon: 'policy', keywords: 'boutique lehenga saree jewellery rental deposit booking cleaning return' },
];
export const NUMBER_DEFAULTS = { freeShippingMinAmount: 999, deliveryCharge: 99, platformFee: 23, gstRate: 5, codCharge: 0, codMaxAmount: 0, codMinAmount: 0, prepaidDiscountValue: 0, codRtoRestrictionLimit: 2, rtoBlockMinOrders: 0, rtoBlockThreshold: 0, rtoRefundDeduction: 0, returnWindowDays: 7, customerReturnShippingCharge: 0, customerRestockingFeePercent: 0, exchangeReservationHours: 168, returnSlaHours: 24, returnWeightToleranceGrams: 100, highValueVerificationThreshold: 5000, minimumOrderAmount: 0 };
export const BOOLEAN_DEFAULTS = { acceptingOrders: true, brandIdentityEnabled: false, contactDetailsEnabled: false, razorpayEnabled: false, upiEnabled: true, cardPaymentEnabled: true, netBankingEnabled: true, walletEnabled: true, codEnabled: true, codConfirmationRequired: false, smartCodVerificationEnabled: true, rtoBlockEnabled: false, returnsEnabled: true, refundDeliveryChargeOnFullReturn: false, refundPlatformFeeOnFullReturn: false, refundCodChargeOnFullReturn: false, requireProductQrScan: false, requirePackingPhotos: false, requirePackingVideo: false, requireDispatchWeight: false, requireSecuritySeal: false, requireReturnPhotos: false, requireReturnVideo: false, enableSecurityTag: false, enableCustomerRiskDetection: true, autoApproveVerifiedReturns: false, searchIndexingEnabled: true };
export function settingsForm(data = {}) {
  return { ...NUMBER_DEFAULTS, ...BOOLEAN_DEFAULTS, occasionShoppingEnabled: true, recentlyViewedEnabled: true, completeLookEnabled: true, invoicePrefix: 'SC', ...data, manualDeliveryMode: data.manualDeliveryMode || 'COURIER', returnWindowUnlimited: data.returnWindowDays === null, returnWindowDays: data.returnWindowDays === null ? NUMBER_DEFAULTS.returnWindowDays : (data.returnWindowDays ?? NUMBER_DEFAULTS.returnWindowDays), socialLinks: { ...data.socialLinks }, appLinks: { ...data.appLinks } };
}
export function settingsPayload(form) {
  const { _id, __v, createdAt, updatedAt, storeId, ...body } = form;
  const unlimitedReturnWindow = body.returnWindowUnlimited === true;
  delete body.returnWindowUnlimited;
  for (const key of Object.keys(NUMBER_DEFAULTS)) {
    if (key === 'returnWindowDays' && unlimitedReturnWindow) continue;
    if (String(body[key]).trim() === '' || !Number.isFinite(Number(body[key])) || Number(body[key]) < 0) throw new Error('Please enter a valid, non-negative value in every number field.');
    body[key] = Number(body[key]);
  }
  if (unlimitedReturnWindow) body.returnWindowDays = null;
  body.storeName = String(body.storeName || '').trim();
  if (!body.storeName) throw new Error('Store name is required.');
  body.prepaidDiscountType = body.prepaidDiscountType || '';
  if (updatedAt) body.expectedUpdatedAt = updatedAt;
  return body;
}
export function announceSettingsSaved() {
  window.dispatchEvent(new Event(SETTINGS_CHANGED_EVENT));
  try { localStorage.setItem(SETTINGS_STORAGE_KEY, String(Date.now())); } catch { /* Same-tab refresh still works when storage is disabled. */ }
}
