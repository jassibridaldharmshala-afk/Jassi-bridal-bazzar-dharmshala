import { useState } from 'react';
import { Copy, Download, Eye, MessageCircle, Printer } from 'lucide-react';
import { buildReceiptMessage } from '../../utils/receiptMessage';
import { downloadReceiptPdf, printReceipt } from '../../utils/printReceipt';
import WhatsAppReceiptModal from './WhatsAppReceiptModal';
import './Receipt.css';

export default function ReceiptActions({ receipt, compact = false, showShare = true, onPreview }) {
  const [openWhatsApp, setOpenWhatsApp] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const run = async (action, task) => {
    if (busy) return;
    setBusy(action); setError('');
    try { await task(); }
    catch (err) { setError(err.message || 'Unable to prepare the invoice. Please try again.'); }
    finally { setBusy(''); }
  };
  const copy = () => run('copy', async () => {
    if (!navigator.clipboard?.writeText) throw new Error('Copy is unavailable in this browser. Use the PDF download instead.');
    await navigator.clipboard.writeText(buildReceiptMessage(receipt)); setCopied(true);
  });
  return <div className={`no-print sc-invoice-actions${compact ? ' sc-invoice-actions--compact' : ''}`} aria-label="Invoice actions">
    <button disabled={!!busy} onClick={() => run('download', () => downloadReceiptPdf(receipt))}><Download size={16} />{busy === 'download' ? 'Preparing PDF...' : 'Download invoice (PDF)'}</button>
    <button disabled={!!busy} onClick={() => run('print', () => printReceipt(receipt))}><Printer size={16} />{busy === 'print' ? 'Preparing print...' : 'Print invoice'}</button>
    {onPreview && <button disabled={!!busy} onClick={onPreview}><Eye size={16} />View invoice</button>}
    {showShare && <><button disabled={!!busy} onClick={() => setOpenWhatsApp(true)}><MessageCircle size={16} />Share order summary</button><button disabled={!!busy} onClick={copy}><Copy size={16} />{copied ? 'Copied' : 'Copy summary'}</button><WhatsAppReceiptModal open={openWhatsApp} receipt={receipt} onClose={() => setOpenWhatsApp(false)} /></>}
    {error && <p role="alert" className="sc-invoice-actions__error">{error}</p>}
  </div>;
}
