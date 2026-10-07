import logo from '../assets/generated-brand-logo.svg';
import { buildReceiptDefinition } from './receiptDocument';
import { receiptView } from './receiptData';
import { normalizeImageUrl } from '../services/normalize';

let pdfRuntime;
const logoPromises = new Map();
async function loadPdfRuntime() {
  if (!pdfRuntime) pdfRuntime = Promise.all([
    // This browser bundle is already compiled. Its upstream source map refers
    // to an unavailable xmldoc.ts; bypass loaders for this dependency only.
    // eslint-disable-next-line import/no-webpack-loader-syntax
    import('!!pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ]).then(([module, fonts]) => {
    const pdfMake = module.default || module;
    pdfMake.addVirtualFileSystem(fonts.default || fonts);
    return pdfMake;
  }).catch((error) => { pdfRuntime = null; throw error; });
  return pdfRuntime;
}
function loadLogo(source = logo) {
  if (!source) return Promise.resolve(null);
  if (logoPromises.has(source)) return logoPromises.get(source);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  const promise = fetch(source, { signal: controller.signal, credentials: 'omit' }).then((response) => {
    if (!response.ok) throw new Error('Logo unavailable');
    return response.blob();
  }).then(async (blob) => {
    if (blob.size > 5 * 1024 * 1024) throw new Error('Logo too large');
    if (blob.type === 'image/webp') {
      const bitmap = await createImageBitmap(blob);
      try {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height));
        canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/png');
      } finally { bitmap.close(); }
    }
    if (!['image/png', 'image/jpeg'].includes(blob.type)) throw new Error('Unsupported logo format');
    return new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob);
    });
  }).catch(() => { logoPromises.delete(source); return null; }).finally(() => clearTimeout(timeout));
  if (logoPromises.size > 10) logoPromises.clear();
  logoPromises.set(source, promise);
  return promise;
}
export async function createReceiptPdf(receipt) {
  if (!receipt?.orderId || !Array.isArray(receipt.items) || !receipt.items.length || receipt.finalAmount == null || !Number.isFinite(Number(receipt.finalAmount))) throw new Error('Invoice details are incomplete. Refresh the order and try again.');
  const logoSource = normalizeImageUrl(receipt.storeDetails?.logoUrl) || (receiptView(receipt).storeName === 'Jassi General Store' ? logo : '');
  const [pdfMake, logoData] = await Promise.all([loadPdfRuntime(), loadLogo(logoSource)]);
  return pdfMake.createPdf(buildReceiptDefinition(receipt, logoData));
}
export async function downloadReceiptPdf(receipt) {
  const pdf = await createReceiptPdf(receipt);
  await pdf.download(receiptView(receipt).filename);
}
export async function printReceipt(receipt) {
  // Open during the click gesture, before the lazy PDF bundle loads.
  const target = window.open('', '_blank');
  if (!target) throw new Error('Your browser blocked the print window. Allow pop-ups for this site, or download the PDF instead.');
  target.document.title = 'Preparing invoice';
  target.document.body.textContent = 'Preparing your invoice...';
  try {
    const pdf = await createReceiptPdf(receipt);
    await pdf.print(target);
  } catch (error) {
    target.close(); throw error;
  }
}
