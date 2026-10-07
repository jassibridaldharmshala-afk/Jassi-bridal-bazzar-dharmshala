let scriptPromise;
function loadRazorpayScript() {
  if (typeof window !== 'undefined' && window.Razorpay) return Promise.resolve(true);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    const finish = error => {
      clearTimeout(timeout);
      script.onload = null; script.onerror = null;
      if (error) { script.remove(); reject(error); }
      else resolve(true);
    };
    const timeout = setTimeout(() => finish(new Error('Payment window took too long to load. Please check your connection and retry.')), 20000);
    script.onload = () => finish(window.Razorpay ? null : new Error('Payment window is unavailable. Please retry.'));
    script.onerror = () => finish(new Error('Failed to load Razorpay checkout'));
    document.body.appendChild(script);
  }).finally(() => { scriptPromise = null; });
  return scriptPromise;
}

export const RAZORPAY_METHODS = Object.freeze({
  UPI: 'upi',
  CARD: 'card',
  NETBANKING: 'netbanking',
  WALLET: 'wallet',
});

const METHOD_LABELS = Object.freeze({
  UPI: 'UPI',
  CARD: 'Credit / Debit Card',
  NETBANKING: 'Net Banking',
  WALLET: 'Wallet',
});

/**
 * Keep the method selected on Jassi Checkout selected inside Razorpay too.
 * The display block also limits the gateway screen to that method, so this
 * works for mobile-number-only accounts where an email may not be available
 * for Razorpay's top-level `method` preselection.
 */
export function buildPaymentMethodConfig(preferredMethod) {
  const normalizedMethod = String(preferredMethod || '').toUpperCase();
  const gatewayMethod = RAZORPAY_METHODS[normalizedMethod];
  if (!gatewayMethod) return {};

  return {
    method: gatewayMethod,
    config: {
      display: {
        blocks: {
          selected: {
            name: `Pay by ${METHOD_LABELS[normalizedMethod]}`,
            instruments: [{ method: gatewayMethod }],
          },
        },
        sequence: ['block.selected'],
        preferences: { show_default_blocks: false },
      },
    },
  };
}

export async function openRazorpayCheckout({
  key,
  amount,
  currency = 'INR',
  orderId,
  name,
  email,
  contact,
  preferredMethod,
  storeName = 'Jassi General Store',
  description = 'Store order',
  onSuccess,
  onDismiss,
}) {
  if (!key) {
    throw new Error('Online payment is not configured. Please choose Cash on Delivery or try again later.');
  }
  if (!orderId) {
    throw new Error('Unable to start payment. Please try again.');
  }

  await loadRazorpayScript();

  return new Promise((resolve, reject) => {
    let settled = false;
    let confirming = false;
    const fail = error => { if (settled || confirming) return; settled = true; reject(error); };
    const options = {
      key,
      amount,
      currency,
      name: storeName,
      description,
      order_id: orderId,
      prefill: {
        name: name || '',
        email: email || '',
        contact: contact || '',
      },
      ...buildPaymentMethodConfig(preferredMethod),
      theme: { color: '#7b1f3a' },
      handler: (response) => {
        if (settled || confirming) return;
        confirming = true;
        Promise.resolve().then(() => onSuccess(response)).then(value => { settled = true; resolve(value); }, error => { settled = true; reject(error); });
      },
      modal: {
        ondismiss: () => {
          if (settled || confirming) return;
          Promise.resolve().then(() => onDismiss?.()).catch(() => {});
          fail(new Error('Payment cancelled'));
        },
      },
    };

    const checkout = new window.Razorpay(options);
    checkout.on('payment.failed', (response) => {
      if (settled || confirming) return;
      const reason = response?.error?.description || 'Payment failed';
      fail(new Error(reason));
      checkout.close?.();
    });
    checkout.open();
  });
}
