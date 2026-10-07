import { bagTotals, checkoutCart, bagIssue } from './bag';
const line = { product: { _id: 'p', price: 999, originalPrice: 1499, stock: 4 }, price: 999, quantity: 1 };
test('bag charges follow checkout shipping rules before coupons and include tax only once', () => {
  const totals = bagTotals([line], { discount: 100 }, { platformFee: 23, gstRate: 5, freeShippingMinAmount: 999, deliveryCharge: 99 });
  expect(totals).toMatchObject({ sellingTotal: 999, totalMRP: 1499, discount: 500, couponDiscount: 100, deliveryCharge: 0, platformFee: 23, finalAmount: 922 });
  expect(totals.taxAmount).toBe(42.81);
  expect(bagTotals([], { discount: 100 }).finalAmount).toBe(0);
});
test('checkout contains only selected items and unavailable lines are clearly blocked', () => {
  const later = { ...line, selected: false, product: { ...line.product, _id: 'later' } };
  const cart = checkoutCart({ items: [line, later], coupon: null });
  expect(cart.items).toEqual([line]); expect(cart.itemCount).toBe(1);
  expect(bagIssue({ ...line, availableStock: 0 })).toMatch(/out of stock/);
  expect(bagIssue({ ...line, quantity: 3, availableStock: 2 })).toMatch(/Only 2/);
});
test('a free-delivery coupon removes delivery without inventing a price discount', () => {
  const totals = bagTotals([line], { discount: 0, benefitType: 'FREE_SHIPPING' }, { platformFee: 0, freeShippingMinAmount: 2000, deliveryCharge: 99 });
  expect(totals).toMatchObject({ couponDiscount: 0, deliveryCharge: 0, finalAmount: 999 });
});
