export const rentalAddressFields = [['fullName', 'Contact name'], ['mobile', 'Mobile number'], ['houseNo', 'House / building'], ['area', 'Area / street'], ['landmark', 'Landmark (optional)'], ['city', 'City'], ['state', 'State'], ['pincode', 'PIN code']];
export const pieceMeasurementFields = {
  APPAREL: [['bust', 'Bust'], ['chest', 'Chest'], ['waist', 'Waist'], ['hips', 'Hips'], ['shoulder', 'Shoulder'], ['sleeve', 'Sleeve length'], ['armhole', 'Armhole'], ['blouseLength', 'Blouse length'], ['outfitLength', 'Outfit length'], ['bottomLength', 'Bottom length'], ['inseam', 'Inseam'], ['outseam', 'Outseam']],
  JEWELLERY: [['bangleInnerDiameter', 'Bangle inner diameter'], ['ringInnerDiameter', 'Ring inner diameter'], ['chainLength', 'Chain length'], ['circumference', 'Circumference']],
  OTHER: [['length', 'Length'], ['width', 'Width'], ['circumference', 'Circumference']],
};
const mobile = value => String(value || '').replace(/[\s()-]/g, '').replace(/^\+?91(?=\d{10}$)/, '');
export function blankRentalAddress(customer = {}, saved = {}) {
  return Object.fromEntries(rentalAddressFields.map(([key]) => [key, saved?.[key] ?? (key === 'fullName' ? customer?.name || '' : key === 'mobile' ? mobile(customer?.phone) : '')]));
}
export function editableRentalDetails(saved, customer = {}) {
  const contact = value => value ? { name: value.name || '', phone: mobile(value.phone), ...(value.authorised !== undefined ? { relationship: value.relationship || '', authorised: value.authorised === true } : {}) } : null;
  return { version: 1, deliveryAddress: blankRentalAddress(customer, saved?.deliveryAddress), collectionAddress: blankRentalAddress(customer, saved?.collectionAddress), sameAsDelivery: saved?.sameAsDelivery !== false,
    alternateContact: contact(saved?.alternateContact), pickupContact: contact(saved?.pickupContact), returnContact: contact(saved?.returnContact), occasion: saved?.occasion || '', fittingInstructions: saved?.fittingInstructions || '', deliveryInstructions: saved?.deliveryInstructions || '' };
}
export function rentalDetailsPayload(details, deliveryMode) {
  return { ...details, deliveryAddress: deliveryMode === 'STORE_PICKUP' ? null : details.deliveryAddress,
    collectionAddress: deliveryMode === 'STORE_PICKUP' ? null : details.sameAsDelivery ? (details.deliveryAddress ? { ...details.deliveryAddress } : null) : details.collectionAddress };
}
export function validateRentalDetails(details, deliveryMode, { preserveLegacyDelivery = false } = {}) {
  if (deliveryMode !== 'STORE_PICKUP') for (const [key, label] of [...(preserveLegacyDelivery && details.deliveryAddress === null ? [] : [['deliveryAddress', 'delivery']]), ...(!details.sameAsDelivery ? [['collectionAddress', 'return collection']] : [])]) {
    const address = details[key];
    if (['fullName', 'houseNo', 'area', 'city', 'state'].some(field => !address?.[field]?.trim())) return `Complete the ${label} contact, street, city and state.`;
    if (!/^[6-9]\d{9}$/.test(mobile(address.mobile))) return `Enter a valid mobile number for ${label}.`;
    if (!/^[1-9]\d{5}$/.test(address.pincode.trim())) return `Enter a valid six-digit PIN code for ${label}.`;
  }
  for (const [key, label] of [['alternateContact', 'alternate contact'], ['pickupContact', 'pickup / delivery contact'], ['returnContact', 'return contact']]) {
    const value = details[key];
    if (value && (!value.name.trim() || !/^[6-9]\d{9}$/.test(mobile(value.phone)))) return `Complete the name and valid mobile number for ${label}.`;
    if (value && key !== 'alternateContact' && !value.authorised) return `Explicitly authorise the ${label}.`;
  }
  return '';
}
export function rentalAddressText(address) { return address ? rentalAddressFields.map(([key]) => address[key]).filter(Boolean).join(', ') : ''; }
export function pieceProfilePayload(profile) {
  if (!profile) return null;
  return { ...profile, values: Object.fromEntries(Object.entries(profile.values || {}).filter(([, value]) => value !== '').map(([key, value]) => [key, Number(value)])),
    alterationLimits: profile.alterationsAllowed ? Object.fromEntries(Object.entries(profile.alterationLimits || {}).filter(([, limit]) => limit.min !== '' || limit.max !== '').map(([key, limit]) => [key, { min: limit.min === '' ? null : Number(limit.min), max: limit.max === '' ? null : Number(limit.max) }])) : {} };
}
