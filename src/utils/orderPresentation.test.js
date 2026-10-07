import { money, orderDate, paymentLabel, paymentNote, priceLines, safeTrackingUrl } from './orderPresentation';
import { canCancelOrder } from './orderActions';

test('keeps order cancellation separate from actual payment and refund status', () => {
  const cancelled = { orderStatus: 'Cancelled', paymentStatus: 'Paid', paymentMethod: 'UPI' };
  expect(paymentLabel(cancelled)).toBe('Paid');
  expect(paymentNote(cancelled)).toContain('refund has not been recorded');
  expect(paymentLabel({ ...cancelled, paymentState: 'PARTIALLY_REFUNDED' })).toBe('Partially refunded');
  expect(paymentLabel({ paymentMethod: 'COD', paymentStatus: 'Pending' })).toBe('Payment due on delivery');
  expect(paymentLabel({ orderStatus: 'Cancelled', paymentStatus: 'Pending' })).toBe('Not collected');
});
test('includes every charge and discount without adding inclusive tax twice', () => {
  const rows = priceLines({ totalMRP: 2000, productDiscount: 200, couponDiscount: 100, prepaidDiscount: 50, deliveryCharge: 40, codCharge: 20, platformFee: 5, taxAmount: 80 });
  expect(rows.map(([, value]) => value).reduce((a, b) => a + b)).toBe(1715);
  expect(rows.some(([label]) => label.includes('GST'))).toBe(false);
});
test('formats missing amounts and dates without inventing information', () => {
  expect(money(undefined)).toBe('—'); expect(money(1022.5)).toContain('1,022.5');
  expect(orderDate(undefined)).toBe(''); expect(orderDate('invalid')).toBe('');
});
test.each(['javascript:alert(1)', 'data:text/html,test', '/track', ''])('rejects unsafe or missing tracking links %s', (value) => expect(safeTrackingUrl(value)).toBe(''));
test('accepts an actual courier URL', () => expect(safeTrackingUrl('https://courier.example/track?id=123')).toBe('https://courier.example/track?id=123'));
test.each(['Shipped', 'Delivered', 'Cancelled', 'Returned', 'Refunded'])('hides cancellation for %s', (orderStatus) => expect(canCancelOrder({ orderStatus })).toBe(false));
