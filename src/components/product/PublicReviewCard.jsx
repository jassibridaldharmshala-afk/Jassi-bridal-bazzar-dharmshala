import { CheckCircle2, Flag, Star, ThumbsUp } from 'lucide-react';
import { normalizeImageUrl } from '../../services/normalize';

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function PublicReviewCard({ review, compact = false, isOwnReview = false, helpful = false, helpfulBusy = false, onHelpful, onReport }) {
  const rating = Number(review?.rating || 0);
  const reviewId = String(review?._id || '');
  const text = compact ? 'text-[11px] leading-5' : 'text-sm leading-6';
  const meta = compact ? 'text-[9px]' : 'text-xs';

  return (
    <article className={`${compact ? 'py-5 first:pt-3' : 'sc-pdp__review py-5'}`} data-review-id={reviewId}>
      <div className="flex items-start gap-3">
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 font-black text-white ${compact ? 'text-[10px]' : 'text-xs'} ${rating >= 4 ? 'bg-emerald-600' : rating === 3 ? 'bg-amber-500' : 'bg-[#ff4d67]'}`}>{rating} <Star className={`${compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} fill-white`} /></span>
        <div className="min-w-0 flex-1">
          {review.title ? <h3 className={`${compact ? 'text-[12px] leading-4' : 'text-base'} font-bold text-charcoal`}>{review.title}</h3> : null}
          {review.comment ? <p className={`${review.title ? 'mt-2' : ''} whitespace-pre-line text-slate-600 ${text}`}>{review.comment}</p> : <p className={`${text} italic text-slate-400`}>Star rating submitted without a written review.</p>}
          {Array.isArray(review.photos) && review.photos.length ? <div className={`mt-3 flex gap-2 overflow-x-auto ${compact ? '' : 'sc-pdp__review-photos'}`}>{review.photos.map((photo, index) => <a key={`${photo}-${index}`} href={normalizeImageUrl(photo)} target="_blank" rel="noreferrer" aria-label={`Open review photo ${index + 1}`} className={`${compact ? 'h-20 w-20 rounded-lg' : 'h-24 w-24 rounded-xl'} shrink-0 overflow-hidden bg-slate-100`}><img src={normalizeImageUrl(photo)} alt={`Customer review ${index + 1}`} className="h-full w-full object-cover" /></a>)}</div> : null}
          {(review.purchase?.size || review.purchase?.color) ? <p className={`mt-3 font-semibold text-slate-400 ${meta}`}>Purchased: {[review.purchase.size, review.purchase.color].filter(Boolean).join(' / ')}</p> : null}
          {review.merchantReply?.body ? <div className={`mt-3 rounded-xl bg-[#faf6f2] ${compact ? 'p-3' : 'p-4'}`}><p className={`${compact ? 'text-[9px]' : 'text-[10px]'} font-black uppercase tracking-[.08em] text-wine`}>Response from the store</p><p className={`mt-1 whitespace-pre-line text-slate-600 ${text}`}>{review.merchantReply.body}</p></div> : null}
        </div>
      </div>
      <div className={`mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-slate-400 ${meta}`}>
        <span className="font-semibold text-slate-500">{review.user?.name || 'Customer'}</span>
        {review.verifiedPurchase ? <span className="inline-flex items-center gap-1 font-bold text-emerald-700"><CheckCircle2 className={`${compact ? 'h-3 w-3' : 'h-4 w-4'}`} /> Verified purchase</span> : null}
        {review.createdAt ? <span>{formatDate(review.createdAt)}</span> : null}
        {review.editedAt ? <span>Edited</span> : null}
        {review.recommend === true ? <span className="font-semibold text-emerald-700">Recommends this product</span> : null}
      </div>
      {!isOwnReview ? <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => onHelpful?.(review)} disabled={helpfulBusy} aria-pressed={helpful} className={`inline-flex items-center gap-1.5 rounded-full border px-3 font-bold disabled:opacity-50 ${compact ? 'h-8 text-[9px]' : 'py-1.5 text-xs'} ${helpful ? 'border-[#ff3e6c] bg-blush text-[#ff3e6c]' : 'border-slate-200 text-slate-500'}`}><ThumbsUp className={`h-3.5 w-3.5 ${helpful ? 'fill-current' : ''}`} /> Helpful{Number(review.helpfulCount || 0) ? ` (${review.helpfulCount})` : ''}</button><button type="button" onClick={() => onReport?.(review)} className={`inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 font-bold text-slate-500 ${compact ? 'h-8 text-[9px]' : 'py-1.5 text-xs'}`}><Flag className="h-3.5 w-3.5" /> Report</button></div> : null}
    </article>
  );
}
