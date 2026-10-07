import { openRazorpayCheckout } from './razorpayCheckout';
export const rentalMoney = paise => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(paise || 0) / 100);
export const rentalOperation = () => `rental_${window.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
export const rentalUrl = (path, storeSlug) => storeSlug === undefined ? path : `${path}${path.includes('?') ? '&' : '?'}store=${encodeURIComponent(storeSlug)}`;
export const rentalDate = (date, timezone = 'Asia/Kolkata') => date ? new Intl.DateTimeFormat('en-IN', { timeZone: timezone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date)) : 'Not scheduled';
export function localDateTime(date, timezone = 'Asia/Kolkata') {
  if (!date) return '';
  const p = Object.fromEntries(new Intl.DateTimeFormat('en', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(date)).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export function rentalInstant(value, timezone) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value || '')) throw new Error('Choose a date and time.');
  const target = Date.parse(`${value}:00Z`); let instant = target;
  for (let i = 0; i < 4; i += 1) { const local = Date.parse(`${localDateTime(instant, timezone)}:00Z`); instant += target - local; }
  if (localDateTime(instant, timezone) !== value) throw new Error('That local time is unavailable. Choose another slot.');
  return new Date(instant).toISOString();
}
export function openRentalPayment(payment, booking, verify) {
  return openRazorpayCheckout({ key: payment.keyId, orderId: payment.orderId, amount: payment.amountPaise, currency: 'INR', description: `Rental ${booking.number}`, storeName: booking.storeName || 'Rental booking', name: booking.customer.name, contact: booking.customer.phone, email: booking.customer.email, preferredMethod: payment.preferredMethod, onSuccess: verify }).catch(error => { if (error.message === 'Payment cancelled') return null; throw error; });
}
