export function couponApplyBody({ code, cart, paymentMethod, shippingAddress, deliveryCharge, salesChannel = 'STOREFRONT' } = {}) {
  return {
    code: String(code || '').trim().toUpperCase(),
    cartTotal: Number(cart?.sellingTotal || 0),
    paymentMethod: paymentMethod || undefined,
    pincode: shippingAddress?.pincode || undefined,
    deliveryCharge: Number.isFinite(Number(deliveryCharge)) ? Number(deliveryCharge) : undefined,
    salesChannel,
    items: (cart?.items || []).map((item) => ({
      product: item.product?._id || item.product?.id || item.product,
      quantity: item.quantity,
      size: item.size || '',
      color: item.color || '',
      variantId: item.variantId || '',
    })),
  };
}

export function formatCouponOffer(coupon) {
  if (!coupon) return '';
  if (coupon.benefitType === 'FREE_SHIPPING') return 'Free delivery';
  if (coupon.benefitType === 'BUY_X_GET_Y') return `Buy ${coupon.buyQuantity || 1}, get ${coupon.getQuantity || 1} free`;
  const amount = coupon.type === 'Percentage'
    ? `${coupon.discountValue}% off`
    : `Rs. ${coupon.discountValue} off`;
  const min = Number(coupon.minOrderAmount || 0);
  const cap = coupon.type === 'Percentage' && Number(coupon.maxDiscountAmount || 0) > 0
    ? `, up to Rs. ${coupon.maxDiscountAmount}`
    : '';
  return min > 0 ? `${amount}${cap} on orders of Rs. ${min} or more` : `${amount}${cap}`;
}

export function formatCouponExpiry(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function couponTerms(coupon) {
  if (!coupon) return [];
  const terms = [];
  if (coupon.firstOrderOnly) terms.push('Valid on your first order only');
  if (Number(coupon.customerLimit || 0) > 0) terms.push(`Maximum ${coupon.customerLimit} use${Number(coupon.customerLimit) === 1 ? '' : 's'} per customer`);
  if (coupon.applicablePaymentMethods?.length) terms.push(`Payment: ${coupon.applicablePaymentMethods.join(', ')}`);
  if (coupon.applicableProducts?.length || coupon.applicableCategories?.length) {
    const both = coupon.applicableProducts?.length && coupon.applicableCategories?.length;
    terms.push(both && coupon.scopeMatchMode === 'ALL' ? 'Product and category selections must both match' : 'Valid only on selected products or categories');
  }
  if (coupon.minimumRequirementBasis === 'ELIGIBLE_ITEMS') terms.push('Minimum spend and quantity use eligible products only');
  if (coupon.stackingMode === 'EXCLUSIVE') terms.push('Valid on full-price products only');
  if (Number(coupon.minItemQuantity || 0) > 0) terms.push(`Add at least ${coupon.minItemQuantity} items`);
  if (coupon.applicablePincodes?.length) terms.push('Available only at selected delivery PIN codes');
  if (coupon.customerSegment && coupon.customerSegment !== 'ALL') terms.push(`Customer audience: ${coupon.customerSegment}`);
  if (coupon.terms) terms.push(coupon.terms);
  return terms;
}
