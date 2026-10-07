import { invoiceMoney, receiptView } from './receiptData.js';

const wine = '#781d3c';
const ink = '#29262a';
const muted = '#706a70';
const line = '#e6dfe2';
const label = (text) => ({ text, color: muted, fontSize: 8, bold: true, characterSpacing: 1, margin: [0, 0, 0, 6] });
const rule = () => ({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 511, y2: 0, lineWidth: .6, lineColor: line }], margin: [0, 12, 0, 12] });
const address = (title, lines) => ({ stack: [label(title), ...lines.map((text, index) => ({ text, bold: index === 0, margin: [0, 0, 0, 2], lineHeight: 1.1 }))] });

// The same normalized order snapshot powers the screen, print and PDF download.
export function buildReceiptDefinition(receipt, logoData) {
  const view = receiptView(receipt);
  const itemRows = view.items.map((item) => [
    { text: String(item.number), color: muted },
    { stack: [{ text: item.name, bold: true, margin: [0, 0, 0, 4] }, ...(item.variant ? [{ text: item.variant, color: muted, fontSize: 8 }] : []), ...(item.sku ? [{ text: `SKU: ${item.sku}`, color: muted, fontSize: 8, margin: [0, 3, 0, 0] }] : [])] },
    { text: String(item.quantity), alignment: 'center' },
    { text: invoiceMoney(item.price), alignment: 'right', noWrap: true },
    { text: invoiceMoney(item.total), alignment: 'right', bold: true, noWrap: true },
  ]);
  const payment = [
    label('PAYMENT INFORMATION'),
    { text: view.paymentMethod, bold: true, margin: [0, 0, 0, 4] },
    { text: `Status: ${view.paymentStatus}`, color: view.paymentStatus === 'Paid' ? '#226443' : ink },
    ...(view.paymentProvider ? [{ text: `Provider: ${view.paymentProvider}`, color: muted, margin: [0, 4, 0, 0] }] : []),
    ...(view.transactionId ? [{ text: `Transaction: ${view.transactionId}`, fontSize: 8, color: muted, margin: [0, 4, 0, 0] }] : []),
    ...(view.paymentNote ? [{ text: view.paymentNote, color: muted, fontSize: 8, lineHeight: 1.2, margin: [0, 7, 10, 0] }] : []),
    { text: `Order status: ${view.orderStatus}`, margin: [0, 12, 0, 0] },
    ...(view.tracking ? [{ text: `Tracking: ${view.tracking}`, color: muted, fontSize: 8, margin: [0, 4, 0, 0] }] : []),
  ];
  return {
    pageSize: 'A4', pageMargins: [42, 38, 42, 45],
    info: { title: `Invoice ${view.number}`, author: view.storeName, subject: `Order ${view.orderId}`, creator: view.storeName },
    defaultStyle: { font: 'Roboto', fontSize: 9, color: ink, lineHeight: 1.1 },
    header: (page) => page > 1 ? { text: `${view.storeName}  |  Invoice ${view.number}  |  Continued`, color: muted, fontSize: 8, margin: [42, 17, 42, 0] } : null,
    footer: (page, pages) => ({ margin: [42, 14, 42, 0], columns: [{ text: `${view.storeName} | ${view.number}`, fontSize: 8, color: muted }, { text: `Page ${page} of ${pages}`, alignment: 'right', fontSize: 8, color: muted }] }),
    content: [
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 511, y2: 0, lineWidth: 3, lineColor: wine }], margin: [0, 0, 0, 16] },
      { columns: [
        { width: '*', columns: [...(logoData ? [{ image: logoData, fit: [48, 58], width: 48, margin: [0, 0, 12, 0] }] : []), { width: '*', stack: [
          { text: view.sellerName, fontSize: 18, bold: true, color: wine, margin: [0, 0, 0, 6] },
          ...view.sellerAddress.map((text) => ({ text, fontSize: 8, color: muted, margin: [0, 0, 0, 2] })),
          ...view.sellerContact.map((text) => ({ text, fontSize: 8, color: muted, margin: [0, 0, 0, 2] })),
          ...(view.gstin ? [{ text: `GSTIN: ${view.gstin}`, fontSize: 8, bold: true, margin: [0, 4, 0, 0] }] : []),
        ] }] },
        { width: 135, alignment: 'right', stack: [{ text: 'INVOICE', fontSize: 25, bold: true, characterSpacing: 1, color: wine }, { text: view.number, bold: true, margin: [0, 6, 0, 5] }, { text: `Issued ${view.date}`, color: muted, fontSize: 8 }] },
      ], columnGap: 18 },
      rule(),
      { columns: [address('BILL TO', [...view.billing, ...(view.customerEmail ? [view.customerEmail] : [])]), address('SHIP TO', view.shipping)], columnGap: 28 },
      { columns: [{ text: `Order: ${view.orderId || view.number}`, fontSize: 8, color: muted }, { text: `Ordered ${view.orderDate}`, alignment: 'right', fontSize: 8, color: muted }], margin: [0, 14, 0, 12] },
      {
        table: { headerRows: 1, keepWithHeaderRows: 1, dontBreakRows: true, widths: [17, '*', 26, 70, 76], body: [
          ['#', 'ITEM / DESCRIPTION', 'QTY', 'UNIT PRICE', 'AMOUNT'].map((text, index) => ({ text, bold: true, fontSize: 8, color: wine, alignment: index > 2 ? 'right' : index === 2 ? 'center' : 'left' })), ...itemRows,
        ] },
        layout: { hLineWidth: () => .5, vLineWidth: () => 0, hLineColor: () => line, fillColor: (row) => row === 0 ? '#f7f0f3' : null, paddingLeft: () => 8, paddingRight: () => 8, paddingTop: () => 8, paddingBottom: () => 8 },
      },
      { text: `${view.items.length} item${view.items.length === 1 ? '' : 's'} | ${view.quantity} unit${view.quantity === 1 ? '' : 's'} | All amounts in INR. Unit prices include product savings.`, fontSize: 7.5, color: muted, margin: [0, 7, 0, 12] },
      { unbreakable: true, columns: [
        { width: '*', stack: payment },
        { width: 233, stack: [
          { table: { widths: ['*', 'auto'], body: view.totals.map(([name, value]) => [{ text: name, color: muted }, { text: name === 'Delivery' && value === 0 ? 'FREE' : invoiceMoney(value), alignment: 'right', noWrap: true }]) }, layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingTop: () => 3, paddingBottom: () => 3, paddingLeft: () => 0, paddingRight: () => 0 } },
          { table: { widths: ['*', 'auto'], body: [[{ text: 'Invoice total', bold: true }, { text: invoiceMoney(view.total), bold: true, alignment: 'right', noWrap: true }]] }, fontSize: 13, color: wine, margin: [0, 9, 0, 8], layout: { fillColor: () => '#f7f0f3', hLineWidth: () => 0, vLineWidth: () => 0, paddingTop: () => 10, paddingBottom: () => 10, paddingLeft: () => 9, paddingRight: () => 9 } },
          ...(view.taxNote ? [{ text: view.taxNote, fontSize: 8, color: muted, lineHeight: 1.2 }] : []),
          { text: view.totalWords, fontSize: 8, color: muted, margin: [0, 6, 0, 0], lineHeight: 1.2 },
        ] },
      ], columnGap: 28 },
      rule(),
      label('RETURNS & SUPPORT'),
      { text: view.policy, color: muted, fontSize: 8, lineHeight: 1.25, margin: [0, 0, 0, 10] },
      ...(view.invoiceNote ? [{ text: view.invoiceNote, color: muted, fontSize: 8, margin: [0, 0, 0, 10] }] : []),
      { unbreakable: true, stack: [{ text: `Thank you for shopping with ${view.storeName}.`, bold: true, color: wine, fontSize: 10 }, { text: 'Computer-generated invoice. Please retain a copy for your records.', fontSize: 8, color: muted, margin: [0, 4, 0, 0] }] },
    ],
  };
}
