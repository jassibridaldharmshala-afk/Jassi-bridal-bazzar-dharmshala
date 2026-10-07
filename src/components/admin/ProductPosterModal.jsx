import { useEffect, useMemo, useState } from 'react';
import { Copy, Download, X } from 'lucide-react';
import { normalizeImageUrl } from '../../services/normalize';
import { productHref } from '../../utils/routing';

export default function ProductPosterModal({ open, product, settings, onClose }) {
  const [posterUrl, setPosterUrl] = useState('');
  const [message, setMessage] = useState('');
  const [generationFailed, setGenerationFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  const shareLink = useMemo(() => `${window.location.origin}${productHref(product)}`, [product]);

  useEffect(() => {
    if (!open || !product) return undefined;
    let cancelled = false;
    setPosterUrl('');
    setMessage('');
    setGenerationFailed(false);
    generatePoster(product, settings, shareLink)
      .then((url) => {
        if (!cancelled) setPosterUrl(url);
      })
      .catch((error) => {
        if (!cancelled) { setGenerationFailed(true); setMessage(error.message || 'Unable to generate poster'); }
      });
    return () => {
      cancelled = true;
    };
  }, [open, product, settings, shareLink, retry]);

  if (!open || !product) return null;

  const download = () => {
    if (!posterUrl) return;
    const link = document.createElement('a');
    link.href = posterUrl;
    link.download = `${slugify(product.name || 'product')}-poster.png`;
    link.click();
  };

  const copyLink = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(shareLink);
      setMessage('Product link copied.');
    } catch { setMessage('Could not copy automatically. Copy the product link below.'); }
  };

  return (
    <div className="fixed inset-0 z-[90] bg-black/55 p-3 sm:p-4">
      <div className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.3)]">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-wine/60">Product Poster</p>
            <h2 className="text-lg font-black text-charcoal">Generate shareable poster</h2>
          </div>
          <button type="button" aria-label="Close poster" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full border border-slate-200">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid min-h-0 flex-1 gap-4 p-4 lg:grid-cols-[1fr_320px]">
          <div className="min-h-0 overflow-auto rounded-[24px] border border-slate-200 bg-[#fbf7f3] p-4">
            {posterUrl ? <img src={posterUrl} alt="Poster preview" className="mx-auto w-full max-w-[420px] rounded-[24px] shadow-lg" /> : <div className="grid h-full min-h-[420px] place-items-center text-sm font-bold text-slate-500">{generationFailed ? <button type="button" className="admin-btn-ghost" onClick={() => setRetry((value) => value + 1)}>Retry poster</button> : 'Generating poster...'}</div>}
          </div>
          <div className="space-y-3 rounded-[24px] border border-slate-200 p-4">
            <p className="text-sm font-bold text-charcoal">{product.name}</p>
            <p className="text-sm text-slate-500">WhatsApp: {settings?.whatsappNumber || '-'}</p>
            <p className="text-sm text-slate-500">Website: {window.location.origin}</p>
            <input aria-label="Product link" readOnly value={shareLink} className="admin-field__control" />
            {message && <p role="status" className="rounded-xl bg-[#fdf4f6] px-3 py-2 text-sm font-semibold text-rose">{message}</p>}
            <button type="button" onClick={download} disabled={!posterUrl} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-wine px-4 text-sm font-black text-white disabled:opacity-60">
              <Download className="h-4 w-4" />
              Download PNG
            </button>
            <button type="button" onClick={copyLink} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-black text-slate-700">
              <Copy className="h-4 w-4" />
              Copy product link
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

async function generatePoster(product, settings, shareLink) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  bg.addColorStop(0, '#fff8f4');
  bg.addColorStop(0.6, '#fffdfb');
  bg.addColorStop(1, '#f8e6df');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#6d1f34';
  ctx.fillRect(60, 60, 180, 56);
  ctx.fillStyle = '#ffffff';
  drawText(ctx, 'JASSI GENERAL STORE', 150, 96, '24px Arial', 'center');

  const image = await loadImage(normalizeImageUrl(product.images?.[0]?.url || product.primaryImageUrl || '/uploads/placeholder.jpg'));
  const imageX = 90;
  const imageY = 150;
  const imageW = 900;
  const imageH = 760;
  roundRect(ctx, imageX, imageY, imageW, imageH, 36, '#ffffff');
  ctx.save();
  roundRectPath(ctx, imageX + 20, imageY + 20, imageW - 40, imageH - 40, 28);
  ctx.clip();
  ctx.drawImage(image, imageX + 20, imageY + 20, imageW - 40, imageH - 40);
  ctx.restore();

  ctx.fillStyle = '#17161a';
  drawText(ctx, product.name || 'Product Name', 120, 1015, 'bold 46px Arial', 'left');
  ctx.fillStyle = '#6d1f34';
  drawText(ctx, `₹${Number(product.price || 0).toLocaleString('en-IN')}`, 120, 1085, 'bold 54px Arial', 'left');
  ctx.fillStyle = '#8b8b8b';
  drawText(ctx, `MRP ₹${Number(product.originalPrice || 0).toLocaleString('en-IN')}`, 350, 1085, '28px Arial', 'left');
  ctx.fillStyle = '#e23d73';
  drawText(ctx, `${Number(product.discountPercentage || 0)}% OFF`, 120, 1136, 'bold 34px Arial', 'left');

  ctx.fillStyle = '#f8f1ed';
  roundRect(ctx, 120, 1180, 840, 120, 30, '#f8f1ed');
  ctx.fillStyle = '#17161a';
  drawText(ctx, `Order on WhatsApp: ${settings?.whatsappNumber || 'Not configured'}`, 160, 1230, 'bold 34px Arial', 'left');
  ctx.fillStyle = '#6d1f34';
  drawText(ctx, `Website: ${window.location.origin}`, 160, 1270, '26px Arial', 'left');

  return canvas.toDataURL('image/png');
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function roundRect(ctx, x, y, width, height, radius, fillStyle) {
  ctx.fillStyle = fillStyle;
  roundRectPath(ctx, x, y, width, height, radius);
  ctx.fill();
}

function roundRectPath(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawText(ctx, text, x, y, font, align = 'left') {
  ctx.font = font;
  ctx.textAlign = align;
  ctx.fillText(String(text || ''), x, y);
}

function slugify(value) {
  return String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
