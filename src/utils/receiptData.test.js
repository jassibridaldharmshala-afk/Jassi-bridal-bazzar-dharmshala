import { amountInWords, invoiceDate, invoiceMoney, receiptView } from './receiptData';
import { buildReceiptDefinition } from './receiptDocument';
import sample from './__fixtures__/invoice.json';

test('uses the stored invoice number and issue date, not the print date', () => {
  const view = receiptView(sample);
  expect(view.number).toBe('SC-SAMPLE01');
  expect(view.date).toBe('01 Sept 2026');
  expect(view.orderDate).toBe('31 Aug 2026');
  expect(view.filename).toBe('Jassi-Collection-Invoice-SC-SAMPLE01.pdf');
});
test('matches the order snapshot without double-counting inclusive tax', () => {
  const receipt = { ...sample, couponDiscount: 100, prepaidDiscount: 50, platformFee: 23, deliveryCharge: 49, finalAmount: 2719, taxAmount: 129.48, taxRate: 5 };
  const view = receiptView(receipt);
  expect(view.totals.reduce((sum, [, value]) => sum + value, 0)).toBe(view.total);
  expect(view.taxNote).toContain('already included');
  expect(view.totals.some(([name]) => /GST|Tax/.test(name))).toBe(false);
  expect(view.items.map((item) => item.total)).toEqual([899, 999, 899]);
});
test('describes COD and cancellation without implying payment was collected', () => {
  const view = receiptView(sample);
  expect(view.paymentMethod).toBe('Cash on delivery'); expect(view.paymentProvider).toBe('');
  expect(view.paymentNote).toContain('not proof of payment');
  expect(receiptView({ ...sample, orderStatus: 'Cancelled' }).paymentNote).toContain('Do not make a payment');
  expect(receiptView({ ...sample, paymentStatus: 'Paid', paymentState: 'PARTIALLY_REFUNDED' }).paymentStatus).toBe('Partially refunded');
});
test('retains distinct billing and delivery information and supports legacy addresses', () => {
  const view = receiptView({ ...sample, billingAddress: { fullName: 'Billing customer', houseNumber: '42', area: 'Business Park', phone: '9000000001' } });
  expect(view.billing.join(' ')).toContain('Billing customer 42, Business Park');
  expect(view.shipping[0]).toBe('Sample Customer');
  expect(receiptView({ ...sample, billingAddress: null }).billing).toEqual(view.shipping);
});
test('formats Indian currency, paise and amount in words consistently', () => {
  expect(invoiceMoney(123456.5)).toBe('₹1,23,456.50');
  expect(amountInWords(2797)).toBe('Rupees Two Thousand Seven Hundred Ninety Seven Only');
  expect(amountInWords(100000.05)).toBe('Rupees One Lakh and Five Paise Only');
  expect(invoiceDate('invalid')).toBe('Not available');
});
test('PDF treats customer content as text, repeats table headers and shows page numbers', () => {
  const definition = buildReceiptDefinition({ ...sample, items: [{ ...sample.items[0], name: '<script>alert(1)</script>' }] });
  const table = definition.content.find((block) => block.table);
  expect(table.table.headerRows).toBe(1);
  expect(table.table.body[1][1].stack[0].text).toBe('<script>alert(1)</script>');
  expect(definition.footer(2, 3).columns[1].text).toBe('Page 2 of 3');
});
