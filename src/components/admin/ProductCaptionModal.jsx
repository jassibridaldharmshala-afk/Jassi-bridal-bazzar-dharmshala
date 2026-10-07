import { useEffect, useState } from 'react';
import { Copy, RefreshCcw, X } from 'lucide-react';

export default function ProductCaptionModal({ open, product, settings, onClose }) {
  const [caption, setCaption] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!open || !product) return;
    setCaption(buildCaption(product, settings));
    setMessage('');
  }, [open, product, settings]);

  if (!open || !product) return null;

  const copy = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(caption);
      setMessage('Caption copied.');
    } catch { setMessage('Could not copy automatically. Select the caption below and copy it manually.'); }
  };

  return (
    <div className="fixed inset-0 z-[90] bg-black/55 p-3 sm:p-4">
      <div className="mx-auto flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.3)]">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-wine/60">Social Caption</p>
            <h2 className="text-lg font-black text-charcoal">Generate copy-ready caption</h2>
          </div>
          <button type="button" aria-label="Close caption" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full border border-slate-200">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
          <textarea aria-label="Product caption" value={caption} onChange={(event) => setCaption(event.target.value)} className="min-h-[340px] flex-1 rounded-[24px] border border-slate-200 bg-ivory p-4 text-sm leading-6 text-charcoal" />
          {message && <p role="status" className="rounded-xl bg-[#fdf4f6] px-3 py-2 text-sm font-semibold text-rose">{message}</p>}
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={copy} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-wine px-4 text-sm font-black text-white">
              <Copy className="h-4 w-4" />
              Copy caption
            </button>
            <button type="button" onClick={() => setCaption(buildCaption(product, settings))} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-black text-slate-700">
              <RefreshCcw className="h-4 w-4" />
              Regenerate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function buildCaption(product, settings) {
  const sizes = (product.sizes || []).join(', ') || 'Free Size';
  const colors = (product.colors || []).join(', ') || 'Available shades';
  const discount = Number(product.discountPercentage || 0);
  const category = product.category?.name || product.category || 'Collection';
  return [
    'New arrival at Jassi General Store ✨',
    '',
    product.name || 'Elegant Ethnic Wear',
    `Category: ${category}`,
    ...(product.fabric ? [`Fabric: ${product.fabric}`] : []),
    ...(product.occasion ? [`Occasion: ${product.occasion}`] : []),
    `Available Sizes: ${sizes}`,
    `Available Colors: ${colors}`,
    `Price: ₹${Number(product.price || 0).toLocaleString('en-IN')}`,
    ...(Number(product.originalPrice) > Number(product.price) ? [`MRP: ₹${Number(product.originalPrice).toLocaleString('en-IN')}${discount > 0 ? ` (${discount}% OFF)` : ''}`] : []),
    '',
    ...(settings?.whatsappNumber ? [`Order now on WhatsApp: ${settings.whatsappNumber}`] : []),
    `Website: ${window.location.origin}`,
    '',
    '#SamiraCollection #EthnicWear #NewArrival',
  ].join('\n');
}
