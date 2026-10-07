import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Receipt from './Receipt';
import ReceiptActions from './ReceiptActions';
import { downloadReceiptPdf, printReceipt } from '../../utils/printReceipt';
import sample from '../../utils/__fixtures__/invoice.json';
jest.mock('../../utils/printReceipt', () => ({ downloadReceiptPdf: jest.fn(), printReceipt: jest.fn() }));
beforeEach(() => { jest.resetAllMocks(); });

test('receipt includes seller, two addresses, item details, status and reconciled totals', () => {
  render(<Receipt receipt={sample} />);
  expect(screen.getByRole('article', { name: 'Invoice SC-SAMPLE01' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Bill to' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Ship to' })).toBeInTheDocument();
  const table = screen.getByRole('table');
  expect(within(table).getAllByRole('row')).toHaveLength(4);
  expect(within(table).getByText('SKU: SC-KS-021')).toBeInTheDocument();
  expect(screen.getByText('Cash on delivery')).toBeInTheDocument();
  expect(screen.queryByText(/COD via COD/)).not.toBeInTheDocument();
  expect(screen.getByText('₹2,797.00')).toBeInTheDocument();
  expect(screen.getByText(/not proof of payment/)).toBeInTheDocument();
});
test('download prevents duplicate clicks until the PDF is prepared', async () => {
  let finish;
  downloadReceiptPdf.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  render(<ReceiptActions receipt={sample} showShare={false} />);
  fireEvent.click(screen.getByRole('button', { name: 'Download invoice (PDF)' }));
  expect(screen.getByRole('button', { name: 'Preparing PDF...' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Print invoice' })).toBeDisabled();
  await act(async () => { finish(); });
  expect(downloadReceiptPdf).toHaveBeenCalledTimes(1);
  expect(downloadReceiptPdf).toHaveBeenCalledWith(sample);
});
test('print sends the same receipt data to the separate PDF print document', async () => {
  printReceipt.mockResolvedValue(); render(<ReceiptActions receipt={sample} showShare={false} />);
  fireEvent.click(screen.getByRole('button', { name: 'Print invoice' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Print invoice' })).toBeEnabled());
  expect(printReceipt).toHaveBeenCalledWith(sample);
});
test('download errors are visible and allow another attempt', async () => {
  downloadReceiptPdf.mockRejectedValueOnce(new Error('Unable to load PDF tools')).mockResolvedValueOnce();
  render(<ReceiptActions receipt={sample} showShare={false} />);
  fireEvent.click(screen.getByRole('button', { name: 'Download invoice (PDF)' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load PDF tools');
  fireEvent.click(screen.getByRole('button', { name: 'Download invoice (PDF)' }));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  await waitFor(() => expect(screen.getByRole('button', { name: 'Download invoice (PDF)' })).toBeEnabled());
});
