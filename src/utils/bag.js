import { findProductVariant } from './variants';
import { isUnavailable, wishlistStock } from './wishlist';
import { inclusiveTax, readPricingSettings } from './priceBreakdown';

export const bagKey = item => item.cartKey || [item.productId || item.product?._id || item.product?.id, item.size || '', item.color || '', item.variantId || ''].join('::');
export const selectedBagItems = items => items.filter(item => item.selected !== false);
export function bagStock(item) {
  if (item.unavailable || isUnavailable(item.product)) return 0;
  return item.availableStock ?? wishlistStock(item.product, item.product.variants?.length ? item : undefined);
}
export function bagIssue(item) {
  if (item.issue) return item.issue;
  if (item.unavailable || isUnavailable(item.product)) return 'This item is no longer available.';
  const stock = bagStock(item);
  if (stock === 0) return 'This selection is out of stock.';
  if (stock !== null && item.quantity > stock) return `Only ${stock} left. Reduce the quantity to continue.`;
  if (item.quantity > 20) return 'Choose up to 20 of this item per order.';
  return '';
}
export function bagTotals(items, coupon, settings = {}) {
  const rules = readPricingSettings(settings);
  const round = amount => Math.round(amount * 100) / 100;
  const sellingTotal = round(items.reduce((sum, item) => sum + Number(item.price ?? item.product.price ?? 0) * item.quantity, 0));
  const totalMRP = round(items.reduce((sum, item) => sum + Math.max(Number(item.price ?? item.product.price ?? 0), Number(item.originalPrice ?? item.product.originalPrice ?? item.product.price ?? 0)) * item.quantity, 0));
  const discount = round(Math.max(0, totalMRP - sellingTotal));
  const couponDiscount = round(Math.max(0, Math.min(sellingTotal, Number(coupon?.discount || 0))));
  // Checkout grants free delivery on the merchandise subtotal before coupons.
  const deliveryCharge = coupon?.benefitType === 'FREE_SHIPPING'
    ? 0
    : items.length && (!rules.shippingFreeAboveEnabled || sellingTotal < rules.freeShippingMinAmount) ? Math.max(0, rules.deliveryCharge) : 0;
  const platformFee = items.length ? Math.max(0, rules.platformFee) : 0;
  return { sellingTotal, totalMRP, discount, couponDiscount, deliveryCharge, platformFee,
    taxAmount: inclusiveTax(sellingTotal - couponDiscount, rules.gstRate), taxRate: rules.gstRate,
    finalAmount: round(Math.max(0, sellingTotal - couponDiscount + deliveryCharge + platformFee)),
    itemCount: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0) };
}
export function checkoutCart(cart) {
  const items = selectedBagItems(cart.items);
  return { ...cart, items, ...bagTotals(items, cart.coupon, cart.pricing) };
}
export function chosenVariant(product, size, color) { return findProductVariant(product, { size, color }); }
