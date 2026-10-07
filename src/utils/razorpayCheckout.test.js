import { buildPaymentMethodConfig, openRazorpayCheckout, RAZORPAY_METHODS } from './razorpayCheckout';

describe('Razorpay payment method selection', () => {
  test.each([
    ['UPI', 'upi'],
    ['CARD', 'card'],
    ['NETBANKING', 'netbanking'],
    ['WALLET', 'wallet'],
  ])('maps %s to the matching Razorpay method', (checkoutMethod, gatewayMethod) => {
    const result = buildPaymentMethodConfig(checkoutMethod);

    expect(RAZORPAY_METHODS[checkoutMethod]).toBe(gatewayMethod);
    expect(result.method).toBe(gatewayMethod);
    expect(result.config.display.blocks.selected.instruments).toEqual([{ method: gatewayMethod }]);
    expect(result.config.display.sequence).toEqual(['block.selected']);
    expect(result.config.display.preferences.show_default_blocks).toBe(false);
  });

  test('accepts a lower-case method safely', () => {
    expect(buildPaymentMethodConfig('card').method).toBe('card');
  });

  test('does not add an online gateway configuration for COD or unknown values', () => {
    expect(buildPaymentMethodConfig('COD')).toEqual({});
    expect(buildPaymentMethodConfig('CRYPTO')).toEqual({});
    expect(buildPaymentMethodConfig()).toEqual({});
  });
});

describe('payment window lifecycle', () => {
  let options, events, widget;
  beforeEach(() => {
    options = null; events = {};
    widget = { open: jest.fn(), close: jest.fn(), on: jest.fn((event, callback) => { events[event] = callback; }) };
    window.Razorpay = jest.fn(config => { options = config; return widget; });
  });
  afterEach(() => { delete window.Razorpay; jest.useRealTimers(); });
  const launch = async callbacks => {
    const promise = openRazorpayCheckout({ key: 'test-key', orderId: 'test-order', amount: 99900, ...callbacks });
    await Promise.resolve(); await Promise.resolve();
    return { promise };
  };

  test('duplicate gateway success callbacks and late dismissal verify only once', async () => {
    let finish;
    const onSuccess = jest.fn(() => new Promise(resolve => { finish = resolve; })), onDismiss = jest.fn();
    const { promise } = await launch({ onSuccess, onDismiss });
    options.handler({ razorpay_payment_id: 'paid' }); options.handler({ razorpay_payment_id: 'paid' }); options.modal.ondismiss();
    await Promise.resolve();
    expect(onSuccess).toHaveBeenCalledTimes(1); expect(onDismiss).not.toHaveBeenCalled();
    finish('confirmed'); await expect(promise).resolves.toBe('confirmed');
  });

  test('a verification callback that throws is returned to checkout for recovery', async () => {
    const { promise } = await launch({ onSuccess: () => { throw new Error('Verification interrupted'); } });
    options.handler({ razorpay_payment_id: 'paid' });
    await expect(promise).rejects.toThrow('Verification interrupted');
  });

  test('failed payment closes the old window and ignores late success callbacks', async () => {
    const onSuccess = jest.fn(); const { promise } = await launch({ onSuccess });
    events['payment.failed']({ error: { description: 'Payment declined' } });
    options.handler({ razorpay_payment_id: 'late' });
    await expect(promise).rejects.toThrow('Payment declined');
    expect(widget.close).toHaveBeenCalledTimes(1); expect(onSuccess).not.toHaveBeenCalled();
  });

  test('a failed dismissal callback cannot leave checkout stuck', async () => {
    const { promise } = await launch({ onDismiss: async () => { throw new Error('Logging unavailable'); } });
    options.modal.ondismiss();
    await expect(promise).rejects.toThrow('Payment cancelled');
  });

  test('a stalled gateway script times out, is removed and can be retried', async () => {
    delete window.Razorpay; jest.useFakeTimers();
    const first = openRazorpayCheckout({ key: 'test-key', orderId: 'test-order', onSuccess: jest.fn() });
    const firstCheck = expect(first).rejects.toThrow('took too long');
    jest.advanceTimersByTime(20000); await firstCheck;
    expect(document.querySelector('script[src*="checkout.razorpay.com"]')).toBeNull();
    const second = openRazorpayCheckout({ key: 'test-key', orderId: 'test-order', onSuccess: jest.fn() });
    const secondCheck = expect(second).rejects.toThrow('Failed to load');
    document.querySelector('script[src*="checkout.razorpay.com"]').onerror();
    await secondCheck;
  });
});
