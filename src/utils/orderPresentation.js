export const ORDER_STATUSES = ['Pending', 'Confirmed', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Return Requested', 'Exchange Requested', 'Returned', 'Refunded'];
export const money = (value) => value === undefined || value === null || !Number.isFinite(Number(value)) ? '—' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value));
export const orderCode = (order) => String(order?._id || '').slice(-8).toUpperCase();
export function orderDate(value, withTime = false) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return '';
  return new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}) });
}
export function statusTone(status = '') {
  return status === 'Delivered' ? 'success' : status === 'Cancelled' ? 'cancelled'
    : /Return|Refund|Exchange/.test(status) ? 'return' : 'progress';
}
export function paymentLabel(order) {
  if (order.paymentState === 'PARTIALLY_REFUNDED') return 'Partially refunded';
  if (order.paymentStatus === 'Refunded' || order.paymentState === 'REFUNDED') return 'Refunded';
  if (order.paymentStatus === 'Paid' || order.paymentState === 'PAID') return 'Paid';
  if (order.orderStatus === 'Cancelled') return 'Not collected';
  if (order.paymentStatus === 'Failed' || order.paymentState === 'FAILED') return 'Payment failed';
  return order.paymentMethod === 'COD' ? 'Payment due on delivery' : 'Awaiting payment confirmation';
}
export function paymentNote(order) {
  if (order.paymentState === 'PARTIALLY_REFUNDED') return 'A partial refund is recorded. Contact support for the amount and reference.';
  if (order.orderStatus === 'Cancelled' && paymentLabel(order) === 'Paid') return 'Your order is cancelled. A completed refund has not been recorded yet. Contact support for an update.';
  if (order.paymentStatus === 'Failed') return order.paymentFailureReason || 'Payment was not completed. Contact support if your account was debited.';
  if (order.paymentMethod !== 'COD' && paymentLabel(order) === 'Awaiting payment confirmation') return 'Refresh to check payment confirmation. Contact support before making another payment if you were debited.';
  return '';
}
export function safeTrackingUrl(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
}
export function priceLines(order) {
  const rows = [['Total MRP', order.totalMRP]];
  for (const [label, key] of [['Product discount', 'productDiscount'], ['Coupon discount', 'couponDiscount'], ['Prepaid discount', 'prepaidDiscount']]) {
    if (Number(order[key]) > 0) rows.push([label, -Number(order[key])]);
  }
  rows.push(['Delivery charge', order.deliveryCharge ?? 0]);
  for (const [label, key] of [['COD charge', 'codCharge'], ['Platform fee', 'platformFee']]) if (Number(order[key]) > 0) rows.push([label, order[key]]);
  if (Number(order.cancellationAdjustment) > 0) rows.push(['Cancelled items adjustment', -Number(order.cancellationAdjustment)]);
  return rows;
}
