const clean = (value) => typeof value === 'string' ? value.trim() : '';
const amount = (value) => Number.isFinite(Number(value)) ? Math.round(Number(value) * 100) / 100 : 0;
export const invoiceMoney = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount(value));
export function invoiceDate(value) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return 'Not available';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}
export function invoiceAddress(address) {
  if (typeof address === 'string') return address.split(/\n+/).map(clean).filter(Boolean);
  if (!address || typeof address !== 'object') return [];
  return [
    clean(address.fullName || address.name),
    [address.houseNo || address.houseNumber || address.addressLine1, address.area || address.addressLine2].map(clean).filter(Boolean).join(', '),
    clean(address.landmark),
    [address.city, address.state].map(clean).filter(Boolean).join(', ') + (address.pincode ? ` - ${address.pincode}` : ''),
    address.mobile || address.phone ? `Phone: ${address.mobile || address.phone}` : '',
  ].filter((line) => line && line !== ' - ');
}

const small = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
function words(number) {
  if (number < 20) return small[number];
  if (number < 100) return `${tens[Math.floor(number / 10)]}${number % 10 ? ` ${small[number % 10]}` : ''}`;
  for (const [divisor, name] of [[10000000, 'Crore'], [100000, 'Lakh'], [1000, 'Thousand'], [100, 'Hundred']]) {
    if (number >= divisor) return `${words(Math.floor(number / divisor))} ${name}${number % divisor ? ` ${words(number % divisor)}` : ''}`;
  }
  return '';
}
export function amountInWords(value) {
  const paise = Math.round(amount(value) * 100);
  if (paise < 0 || paise > 99999999999) return '';
  return `Rupees ${words(Math.floor(paise / 100))}${paise % 100 ? ` and ${words(paise % 100)} Paise` : ''} Only`;
}

export function receiptView(receipt = {}) {
  const store = receipt.storeDetails || {};
  const storeName = clean(store.storeName) || 'Jassi General Store';
  const items = (Array.isArray(receipt.items) ? receipt.items : []).map((item, index) => ({
    number: index + 1, name: clean(item.name || item.productName) || 'Product', sku: clean(item.sku),
    variant: [item.size && `Size: ${item.size}`, item.color && `Colour: ${item.color}`].filter(Boolean).join(' | '),
    quantity: amount(item.quantity), price: amount(item.price), total: amount(amount(item.price) * amount(item.quantity)),
  }));
  const subtotal = amount(items.reduce((sum, item) => sum + item.total, 0));
  const productDiscount = amount(receipt.productDiscount);
  const totalMRP = receipt.totalMRP != null ? amount(receipt.totalMRP) : amount(subtotal + productDiscount);
  const totals = [['Total MRP', totalMRP]];
  if (productDiscount > 0) totals.push(['Product savings', -productDiscount]);
  if (amount(receipt.couponDiscount) > 0) totals.push([`Coupon savings${receipt.coupon?.code ? ` (${receipt.coupon.code})` : ''}`, -amount(receipt.couponDiscount)]);
  if (amount(receipt.prepaidDiscount) > 0) totals.push(['Prepaid savings', -amount(receipt.prepaidDiscount)]);
  totals.push(['Delivery', amount(receipt.deliveryCharge)]);
  if (amount(receipt.codCharge) > 0) totals.push(['Cash on delivery fee', amount(receipt.codCharge)]);
  if (amount(receipt.platformFee) > 0) totals.push(['Platform fee', amount(receipt.platformFee)]);
  if (amount(receipt.cancellationAdjustment) > 0) totals.push(['Cancelled items adjustment', -amount(receipt.cancellationAdjustment)]);
  const cod = receipt.paymentMethod === 'COD';
  const methods = { COD: 'Cash on delivery', UPI: 'UPI', CARD: 'Card', Card: 'Card', NETBANKING: 'Net banking', WALLET: 'Wallet', Razorpay: 'Online payment' };
  const paymentMethod = methods[receipt.paymentMethod] || clean(receipt.paymentMethod) || 'Not recorded';
  const paymentProvider = !cod && receipt.paymentProvider !== 'COD' ? clean(receipt.paymentProvider) : '';
  let paymentStatus = receipt.paymentState === 'PARTIALLY_REFUNDED' ? 'Partially refunded' : clean(receipt.paymentStatus) || 'Not recorded';
  let paymentNote = '';
  if (receipt.paymentStatus === 'Pending' && receipt.orderStatus !== 'Cancelled') paymentNote = cod ? 'Payment is due on delivery. This invoice is not proof of payment.' : 'Payment is pending. This invoice is not proof of payment.';
  if (receipt.orderStatus === 'Cancelled') paymentNote = receipt.paymentStatus === 'Paid' ? 'Order cancelled. Refer to your order for refund updates.' : 'Order cancelled. Do not make a payment against this invoice.';
  if (receipt.paymentStatus === 'Failed') paymentNote = 'Payment was unsuccessful. Contact support for help with any amount debited.';
  const shipping = invoiceAddress(receipt.shippingAddress);
  const billing = invoiceAddress(receipt.billingAddress);
  const orderId = String(receipt.orderId || '');
  const number = clean(receipt.invoiceNumber) || (orderId ? `SC-${orderId.slice(-8).toUpperCase()}` : 'Not available');
  const tax = amount(receipt.taxAmount);
  return {
    storeName, sellerName: clean(store.legalBusinessName) || storeName, logoUrl: clean(store.logoUrl), invoiceNote: clean(store.invoiceNote),
    sellerAddress: invoiceAddress(store.billingAddress || store.address),
    sellerContact: [store.contactPhone || store.whatsappNumber, store.contactEmail].map(clean).filter(Boolean),
    gstin: clean(store.gstin), number, orderId, date: invoiceDate(receipt.invoiceDate || receipt.orderDate), orderDate: invoiceDate(receipt.orderDate),
    customerName: clean(receipt.billingAddress?.fullName || receipt.shippingAddress?.fullName || receipt.customer?.name) || 'Customer',
    customerEmail: clean(receipt.customer?.email),
    shipping: shipping.length ? shipping : ['Address not available'], billing: billing.length ? billing : shipping.length ? shipping : ['Address not available'],
    items, quantity: items.reduce((sum, item) => sum + item.quantity, 0), totals, total: amount(receipt.adjustedFinalAmount ?? receipt.finalAmount),
    totalWords: amountInWords(receipt.adjustedFinalAmount ?? receipt.finalAmount), paymentMethod, paymentProvider, paymentStatus, paymentNote,
    transactionId: clean(receipt.razorpayPaymentId), orderStatus: clean(receipt.orderStatus) || 'Not recorded',
    tracking: [receipt.shipment?.courierName, receipt.shipment?.trackingNumber || receipt.shipment?.awb].map(clean).filter(Boolean).join(' | '),
    taxNote: tax > 0 ? `Includes ${invoiceMoney(tax)} GST${Number(receipt.taxRate) > 0 ? ` (${amount(receipt.taxRate)}%)` : ''}. Tax is already included in the invoice total.` : '',
    policy: clean(receipt.policies?.returnPolicy) || 'For returns, exchanges or order support, please contact the store with your order number.',
    filename: `${storeName.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'Store'}-Invoice-${number.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80)}.pdf`,
  };
}
