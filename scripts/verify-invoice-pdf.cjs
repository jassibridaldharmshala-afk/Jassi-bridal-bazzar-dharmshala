// Generates deterministic samples from the production invoice renderer. No API or customer data is used.
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');
const pdfMake = require('pdfmake/build/pdfmake');
pdfMake.addVirtualFileSystem(require('pdfmake/build/vfs_fonts'));
const sample = require('../src/utils/__fixtures__/invoice.json');

async function main() {
  const root = path.resolve(__dirname, '..');
  const { buildReceiptDefinition } = await import(pathToFileURL(path.join(root, 'src/utils/receiptDocument.js')));
  const logo = `data:image/png;base64,${fs.readFileSync(path.join(root, 'src/assets/samira-collection-logo.png')).toString('base64')}`;
  const output = path.join(root, 'tmp/pdfs');
  fs.mkdirSync(output, { recursive: true });
  const prepaid = { ...sample, invoiceNumber: 'SC-SAMPLE02', paymentMethod: 'UPI', paymentProvider: 'Razorpay', paymentStatus: 'Paid', paymentState: 'PAID', razorpayPaymentId: 'pay_sample_only', platformFee: 23, deliveryCharge: 49, couponDiscount: 100, prepaidDiscount: 50, finalAmount: 2719, taxRate: 5, taxAmount: 129.48 };
  const long = { ...sample, invoiceNumber: 'SC-SAMPLE03', items: Array.from({ length: 40 }, (_, index) => ({ ...sample.items[index % 3], name: `${sample.items[index % 3].name} - Item ${index + 1}`, sku: `SAMPLE-${index + 1}` })) };
  long.totalMRP = long.items.reduce((sum, item) => sum + item.originalPrice * item.quantity, 0);
  long.productDiscount = long.items.length * 1000;
  long.finalAmount = long.totalMRP - long.productDiscount;
  const pageErrors = [];
  for (const [name, receipt, pages] of [['invoice-standard', sample, 1], ['invoice-prepaid', prepaid, 1], ['invoice-multipage', long, null]]) {
    const buffer = await pdfMake.createPdf(buildReceiptDefinition(receipt, logo)).getBuffer();
    assert.equal(buffer.subarray(0, 5).toString(), '%PDF-');
    const pageCount = (buffer.toString('latin1').match(/\/Type \/Page\b/g) || []).length;
    if (pages) { if (pageCount !== pages) pageErrors.push(`${name} should fit on one A4 page (got ${pageCount})`); }
    else assert.ok(pageCount > 1);
    fs.writeFileSync(path.join(output, `${name}.pdf`), buffer);
    console.log(`${name}: ${pageCount} page(s), ${buffer.length} bytes`);
  }
  assert.deepEqual(pageErrors, []);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
