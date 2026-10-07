import { normalizeIndianPhone } from './phoneFormatter';
import { invoiceMoney, receiptView } from './receiptData';

export function buildReceiptMessage(receipt) {
  const view = receiptView(receipt);
  const lines = [
    `${view.storeName} - Order summary`,
    '',
    `Order ID: #${String(receipt.orderId).slice(-8).toUpperCase()}`,
    `Invoice: ${view.number}`,
    `Order Date: ${view.orderDate}`,
    `Customer: ${receipt.customer?.name || receipt.shippingAddress?.fullName || '-'}`,
    `Payment Method: ${view.paymentMethod}`,
    `Payment Status: ${view.paymentStatus}`,
    `Order Status: ${receipt.orderStatus}`,
    '',
    'Items:',
    ...view.items.map((item) => `${item.number}. ${item.name}${item.variant ? ` - ${item.variant}` : ''}, Qty: ${item.quantity}, Amount: ${invoiceMoney(item.total)}`),
    '',
    ...view.totals.map(([name, value]) => `${name}: ${name === 'Delivery' && value === 0 ? 'FREE' : invoiceMoney(value)}`),
    `Invoice Total: ${invoiceMoney(view.total)}`,
    ...(view.taxNote ? [view.taxNote] : []),
    ...(view.paymentNote ? [view.paymentNote] : []),
    '',
    'Delivery Address:',
    formatAddress(receipt.shippingAddress),
    '',
    `Thank you for shopping with ${view.storeName}.`,
  ];
  return lines.join('\n');
}

export function getWhatsAppUrl(receipt, phone) {
  const mobile = normalizeIndianPhone(phone);
  if (!mobile) return '';
  return `https://wa.me/91${mobile}?text=${encodeURIComponent(buildReceiptMessage(receipt))}`;
}

export function formatAddress(address = {}) {
  return [address.fullName, address.houseNo || address.houseNumber, address.area, address.landmark, address.city, address.state, address.pincode].filter(Boolean).join(', ');
}
