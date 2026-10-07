const PREFIX = 'samira_checkout_attempt:';
const MAX_AGE = 24 * 60 * 60 * 1000;

function accountKey(user) {
  return String(user?._id || user?.id || user?.phone || 'guest');
}

function newAttemptId() {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `checkout_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export function checkoutPayloadSignature(payload = {}) {
  return JSON.stringify({
    paymentMethod: payload.paymentMethod,
    expectedTotal: payload.expectedTotal,
    coupon: payload.coupon?.code || '',
    address: payload.shippingAddress?._id || [payload.shippingAddress?.pincode, payload.shippingAddress?.houseNo, payload.shippingAddress?.area].join('|'),
    items: (payload.orderItems || []).map(item => [item.product, item.variantId || '', item.size || '', item.color || '', item.quantity]),
  });
}

export function getCheckoutAttempt(user, signature) {
  const key = PREFIX + accountKey(user);
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    if (saved?.id && saved.signature === signature && Date.now() - Number(saved.createdAt || 0) < MAX_AGE) return saved.id;
    const id = newAttemptId();
    localStorage.setItem(key, JSON.stringify({ id, signature, createdAt: Date.now() }));
    return id;
  } catch {
    return newAttemptId();
  }
}

export function clearCheckoutAttempt(user, attemptId) {
  const key = PREFIX + accountKey(user);
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    if (!attemptId || saved?.id === attemptId) localStorage.removeItem(key);
  } catch {
    try { localStorage.removeItem(key); } catch { /* storage is optional */ }
  }
}
