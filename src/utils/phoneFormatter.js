export function normalizeIndianPhone(value = '') {
  const input = String(value).replace(/\D/g, '');
  const digits = input.length === 12 && input.startsWith('91') ? input.slice(2) : input;
  return digits.length === 10 && /^[6-9]/.test(digits) ? digits : '';
}
