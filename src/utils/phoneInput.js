export function digitsOnly(value, max = 10) {
  return String(value || '').replace(/\D/g, '').slice(0, max);
}

export function isValidIndianMobile(value) {
  return /^[6-9]\d{9}$/.test(digitsOnly(value, 10));
}

export const PHONE_VALIDATION_MESSAGE = 'Enter a valid 10-digit mobile number starting with 6-9.';
