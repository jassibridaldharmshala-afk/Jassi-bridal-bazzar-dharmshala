import { createReceiptPdf, downloadReceiptPdf, printReceipt } from './printReceipt';
import sample from './__fixtures__/invoice.json';
const mockDownload = jest.fn();
const mockPrint = jest.fn();
const mockCreate = jest.fn(() => ({ download: mockDownload, print: mockPrint }));
jest.mock('!!pdfmake/build/pdfmake', () => ({ __esModule: true, default: { addVirtualFileSystem: jest.fn(), createPdf: (...args) => mockCreate(...args) } }), { virtual: true });
jest.mock('pdfmake/build/vfs_fonts', () => ({ __esModule: true, default: {} }));
beforeEach(() => {
  jest.clearAllMocks();
  mockCreate.mockImplementation(() => ({ download: mockDownload, print: mockPrint }));
  global.fetch = jest.fn().mockRejectedValue(new Error('Logo unavailable'));
  mockDownload.mockResolvedValue(); mockPrint.mockResolvedValue();
});
test('downloads a named PDF even when the optional logo is unavailable', async () => {
  await downloadReceiptPdf(sample);
  expect(mockDownload).toHaveBeenCalledWith('Jassi-Collection-Invoice-SC-SAMPLE01.pdf');
  expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ pageSize: 'A4', info: expect.objectContaining({ title: 'Invoice SC-SAMPLE01' }) }));
});
test('incomplete invoice data is rejected rather than downloading an incorrect zero total', async () => {
  await expect(createReceiptPdf({ ...sample, finalAmount: undefined })).rejects.toThrow('incomplete');
  expect(mockCreate).not.toHaveBeenCalled();
});
test('print opens a document during the click and never prints the storefront page', async () => {
  const target = { document: { title: '', body: { textContent: '' } }, close: jest.fn() };
  const open = jest.spyOn(window, 'open').mockReturnValue(target);
  const mainPrint = jest.spyOn(window, 'print').mockImplementation(() => {});
  const pending = printReceipt(sample);
  expect(open).toHaveBeenCalledWith('', '_blank');
  await pending;
  expect(mockPrint).toHaveBeenCalledWith(target); expect(mainPrint).not.toHaveBeenCalled();
  open.mockRestore(); mainPrint.mockRestore();
});
test('a blocked print window produces an actionable error', async () => {
  const open = jest.spyOn(window, 'open').mockReturnValue(null);
  await expect(printReceipt(sample)).rejects.toThrow('download the PDF instead');
  open.mockRestore();
});
test('failed PDF generation closes the temporary print window', async () => {
  const target = { document: { title: '', body: { textContent: '' } }, close: jest.fn() };
  const open = jest.spyOn(window, 'open').mockReturnValue(target);
  mockPrint.mockRejectedValueOnce(new Error('PDF generation failed'));
  await expect(printReceipt(sample)).rejects.toThrow('PDF generation failed');
  expect(target.close).toHaveBeenCalled(); open.mockRestore();
});
