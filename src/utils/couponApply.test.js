import { couponApplyBody, couponTerms, formatCouponOffer } from './couponApply';

test('coupon payload sends only product identity, options and quantity', () => {
  const body = couponApplyBody({
    code: ' save20 ',
    paymentMethod: 'UPI',
    cart: {
      sellingTotal: 9999,
      items: [{
        product: { _id: 'product-1', price: 10, category: 'category-1' },
        quantity: 2,
        size: 'M',
        color: 'Ivory',
        variantId: 'variant-1',
        lineTotal: 1,
      }],
    },
  });

  expect(body.code).toBe('SAVE20');
  expect(body.items).toEqual([{ product: 'product-1', quantity: 2, size: 'M', color: 'Ivory', variantId: 'variant-1' }]);
  expect(body.items[0]).not.toHaveProperty('price');
  expect(body.items[0]).not.toHaveProperty('lineTotal');
  expect(body.items[0]).not.toHaveProperty('category');
});

test('coupon copy includes minimum spend, cap and customer terms', () => {
  const coupon = {
    type: 'Percentage', discountValue: 20, maxDiscountAmount: 500, minOrderAmount: 1500,
    firstOrderOnly: true, customerLimit: 1, applicablePaymentMethods: ['UPI'], terms: 'One offer per order.',
  };
  expect(formatCouponOffer(coupon)).toBe('20% off, up to Rs. 500 on orders of Rs. 1500 or more');
  expect(couponTerms(coupon)).toEqual([
    'Valid on your first order only',
    'Maximum 1 use per customer',
    'Payment: UPI',
    'One offer per order.',
  ]);
});
