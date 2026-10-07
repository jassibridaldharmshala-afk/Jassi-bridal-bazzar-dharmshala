export const pendingPaymentKey = user => {
  const id = user?._id || user?.id;
  return id ? `samira_pending_payment:${id}` : '';
};

export function readPendingPayment(key) {
  if (!key) return null;
  try {
    const receipt = JSON.parse(localStorage.getItem(key) || 'null');
    const response = receipt?.response;
    return response?.razorpay_order_id && response.razorpay_payment_id && response.razorpay_signature && Array.isArray(receipt.purchased) ? receipt : null;
  } catch { return null; }
}

export function savePendingPayment(key, receipt) {
  if (!key) return;
  try {
    // Retain only the signed payment reference and bag identities, never
    // addresses, product photos or payment instrument details.
    localStorage.setItem(key, JSON.stringify({
      response: receipt.response,
      purchased: receipt.purchased.map(item => ({
        cartKey: item.cartKey,
        productId: item.productId || item.product?._id || item.product?.id,
        size: item.size, color: item.color, variantId: item.variantId,
        quantity: item.quantity,
      })),
    }));
  } catch { /* The in-memory confirmation guard still works if storage is blocked. */ }
}

export function clearPendingPayment(key, response) {
  try {
    if (readPendingPayment(key)?.response.razorpay_order_id === response.razorpay_order_id) localStorage.removeItem(key);
  } catch { /* Storage may be unavailable in restricted browser modes. */ }
}
