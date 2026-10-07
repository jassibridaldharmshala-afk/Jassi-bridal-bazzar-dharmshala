export const CANCELLABLE_ORDER_STATUSES = ['Pending', 'Confirmed', 'Packed'];

export function canCancelOrder(order) {
  if (Array.isArray(order?.allowedActions)) return order.allowedActions.includes('CANCEL_ORDER');
  return CANCELLABLE_ORDER_STATUSES.includes(String(order?.orderStatus || ''));
}

export function canCancelOrderItem(order, item) {
  const activeItemQuantity = Math.max(0, Number(item?.quantity || 0) - Number(item?.cancelledQuantity || 0));
  if (!canCancelOrder(order) || activeItemQuantity <= 0) return false;
  const paymentConfirmed = order?.paymentMethod === 'COD' || order?.paymentStatus === 'Paid' || ['PAID', 'PARTIALLY_REFUNDED'].includes(order?.paymentState);
  if (paymentConfirmed) return true;
  const activeOrderQuantity = (order?.orderItems || []).reduce((sum, entry) => sum + Math.max(0, Number(entry?.quantity || 0) - Number(entry?.cancelledQuantity || 0)), 0);
  return activeItemQuantity === activeOrderQuantity;
}

export function productIdOf(item) {
  return String(item?.product?._id || item?.product || '').trim();
}
