export const DEFAULT_PLATFORM_FEE = 23;
export const DEFAULT_GST_RATE = 5;

export function inclusiveTax(amount, rate = DEFAULT_GST_RATE) {
  const gstRate = Number(rate || 0);
  const base = Math.max(0, Number(amount || 0));
  if (gstRate <= 0 || base <= 0) return 0;
  return Math.round((base * gstRate) / (100 + gstRate) * 100) / 100;
}

export function readPricingSettings(settings = {}) {
  return {
    platformFee: Number(settings.platformFee ?? DEFAULT_PLATFORM_FEE),
    gstRate: Number(settings.gstRate ?? DEFAULT_GST_RATE),
    deliveryCharge: Number(settings.deliveryCharge ?? 99),
    freeShippingMinAmount: Number(settings.freeShippingMinAmount ?? 999),
    shippingFreeAboveEnabled: settings.shippingFreeAboveEnabled !== false,
    shippingPricingMode: settings.shippingPricingMode || 'fixed',
  };
}
