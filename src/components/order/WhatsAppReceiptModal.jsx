import { useMemo, useState } from 'react';
import { buildReceiptMessage, getWhatsAppUrl } from '../../utils/receiptMessage';
import { normalizeIndianPhone } from '../../utils/phoneFormatter';

export default function WhatsAppReceiptModal({ open, receipt, onClose }) {
  const defaultPhone = receipt?.shippingAddress?.mobile || receipt?.shippingAddress?.phone || receipt?.customer?.phone || '';
  const [phone, setPhone] = useState(defaultPhone);
  const [error, setError] = useState('');
  const message = useMemo(() => receipt ? buildReceiptMessage(receipt) : '', [receipt]);
  if (!open) return null;

  const send = () => {
    setError('');
    if (!normalizeIndianPhone(phone)) return setError('Enter a valid 10-digit Indian WhatsApp number.');
    window.open(getWhatsAppUrl(receipt, phone), '_blank', 'noopener,noreferrer');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/45 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl">
        <h2 className="text-xl font-black">Share order summary on WhatsApp</h2>
        <input value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-4 h-12 w-full rounded-xl border border-slate-200 px-4 text-sm font-semibold" placeholder="10-digit WhatsApp number" />
        {error && <p className="mt-2 text-sm font-bold text-rose">{error}</p>}
        <textarea readOnly value={message} className="mt-4 h-44 w-full rounded-xl border border-slate-200 p-3 text-xs font-semibold text-slate-600" />
        <div className="mt-4 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-black">Cancel</button>
          <button onClick={send} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white">Open WhatsApp</button>
        </div>
      </div>
    </div>
  );
}
