import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ImagePlus, Star, Trash2, X } from 'lucide-react';
import { getPrimaryImageUrl, normalizeImageUrl } from '../../services/normalize';

const ratingLabels = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

export default function ReviewModal({ open, product, existingReview, initialRating = 0, onClose, onSubmit, onUpload, onWithdraw }) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [photos, setPhotos] = useState([]);
  const [photosTouched, setPhotosTouched] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [aspects, setAspects] = useState({ quality: '', fit: '', colorAccuracy: '' });
  const [recommend, setRecommend] = useState('');
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    setRating(Number(existingReview?.rating || initialRating || 0));
    setTitle(existingReview?.title || '');
    setComment(existingReview?.comment || '');
    setHoveredRating(0);
    setSaving(false);
    setError('');
    setSuccess('');
    setPhotos(Array.isArray(existingReview?.photos) ? existingReview.photos : []);
    setPhotosTouched(false);
    setUploading(false);
    setAspects({
      quality: existingReview?.aspects?.quality || '',
      fit: existingReview?.aspects?.fit || '',
      colorAccuracy: existingReview?.aspects?.colorAccuracy || '',
    });
    setRecommend(typeof existingReview?.recommend === 'boolean' ? String(existingReview.recommend) : '');

    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onCloseRef.current?.();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [existingReview, initialRating, open]);

  if (!open) return null;
  const image = normalizeImageUrl(getPrimaryImageUrl(product?.images));
  const displayedRating = hoveredRating || rating;

  const submit = async (event) => {
    event.preventDefault();
    if (!rating) {
      setError('Please select a rating from 1 to 5 stars.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = { rating, title: title.trim(), comment: comment.trim() };
      const selectedAspects = Object.fromEntries(Object.entries(aspects).filter(([, value]) => value !== '').map(([key, value]) => [key, Number(value)]));
      if (Object.keys(selectedAspects).length) payload.aspects = selectedAspects;
      if (recommend !== '') payload.recommend = recommend === 'true';
      if (photosTouched) payload.photos = photos;
      const result = await onSubmit?.(payload);
      setSuccess(result?.message || (existingReview ? 'Your review has been updated.' : 'Thank you. Your review has been submitted.'));
    } catch (submitError) {
      setError(submitError?.message || 'Unable to save your review right now. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const uploadPhotos = async (event) => {
    const incoming = Array.from(event.target.files || []);
    event.target.value = '';
    if (!incoming.length) return;
    if (photos.length + incoming.length > 4) { setError('You can add up to 4 photos.'); return; }
    setUploading(true); setError('');
    try {
      if (!onUpload) throw new Error('Photo upload is unavailable right now.');
      const result = await onUpload(incoming);
      const urls = (result?.files || []).map((file) => file.url).filter(Boolean);
      setPhotos((current) => [...new Set([...current, ...urls])].slice(0, 4));
      setPhotosTouched(true);
    } catch (uploadError) {
      setError(uploadError.message || 'Unable to upload review photos.');
    } finally { setUploading(false); }
  };

  const withdraw = async () => {
    if (!onWithdraw || saving) return;
    setSaving(true); setError('');
    try { await onWithdraw(existingReview); setSuccess('Your review has been removed from the storefront. You can edit and resubmit it later.'); }
    catch (withdrawError) { setError(withdrawError.message || 'Unable to withdraw this review.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-[color:color-mix(in_srgb,var(--site-media-black)_55%,transparent)] sm:items-center sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose?.(); }}>
      <section className="flex max-h-[94vh] w-full max-w-xl flex-col overflow-hidden rounded-t-[24px] bg-[color:var(--site-surface)] shadow-2xl sm:rounded-[24px]" role="dialog" aria-modal="true" aria-label={existingReview ? 'Edit your review' : 'Write a review'}>
        <header className="flex shrink-0 items-center justify-between border-b border-[color:var(--site-border)] px-4 py-4 sm:px-5">
          <div>
            <h2 className="text-[16px] font-black text-charcoal">{existingReview ? 'Edit your review' : 'Rate this product'}</h2>
            <p className="mt-1 text-[10px] text-[color:var(--site-muted)]">Only delivered purchases can be reviewed.</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="grid h-10 w-10 place-items-center rounded-full bg-[color:var(--site-background)] text-[color:var(--site-muted)] disabled:opacity-40" aria-label="Close review form"><X className="h-5 w-5" /></button>
        </header>

        {success ? (
          <div className="grid min-h-80 place-items-center px-7 py-10 text-center">
            <div>
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[color:var(--site-success-soft)] text-[color:var(--site-success)]"><CheckCircle2 className="h-8 w-8" /></span>
              <h3 className="mt-4 text-lg font-black text-charcoal">Review saved</h3>
              <p className="mx-auto mt-2 max-w-sm text-[12px] leading-5 text-[color:var(--site-muted)]">{success}</p>
              <button type="button" onClick={onClose} className="mt-6 h-12 min-w-40 rounded-xl bg-wine px-6 text-[13px] font-black text-[color:var(--site-on-fill)]">Done</button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="min-h-0 flex-1 overflow-y-auto pb-[max(20px,env(safe-area-inset-bottom))]">
            <div className="flex items-center gap-3 border-b border-[color:var(--site-border)] px-4 py-4 sm:px-5">
              <div className="h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-[color:var(--site-accent-soft)]">{image ? <img src={image} alt={product?.name || 'Product'} className="h-full w-full object-cover object-top" /> : null}</div>
              <div className="min-w-0"><p className="truncate text-[12px] font-bold text-charcoal">{product?.brand || 'Jassi Bridal Bazar Dharmshala'}</p><p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[color:var(--site-muted)]">{product?.name}</p></div>
            </div>

            <div className="px-4 py-5 text-center sm:px-5">
              <p className="text-[13px] font-bold text-charcoal">How was your experience?</p>
              <div className="mt-3 flex justify-center gap-2" onMouseLeave={() => setHoveredRating(0)}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => { setRating(value); setError(''); }}
                    onMouseEnter={() => setHoveredRating(value)}
                    className="grid h-11 w-11 place-items-center rounded-full transition hover:bg-[color:var(--site-warning-soft)] focus:outline-none focus:ring-2 focus:ring-[color:var(--site-warning-border)]"
                    aria-label={`${value} star${value === 1 ? '' : 's'} — ${ratingLabels[value]}`}
                    aria-pressed={rating === value}
                  >
                    <Star className={`h-8 w-8 ${value <= displayedRating ? 'fill-[color:var(--site-warning)] text-[color:var(--site-warning)]' : 'text-[color:var(--site-faint)]'}`} strokeWidth={1.7} />
                  </button>
                ))}
              </div>
              <p className={`mt-2 min-h-5 text-[12px] font-bold ${displayedRating ? 'text-[color:var(--site-warning)]' : 'text-[color:var(--site-faint)]'}`}>{displayedRating ? ratingLabels[displayedRating] : 'Tap a star to rate'}</p>
            </div>

            <div className="space-y-4 border-t border-[color:var(--site-border)] px-4 py-5 sm:px-5">
              <label className="block"><span className="text-[12px] font-bold text-charcoal">Review title <span className="font-medium text-[color:var(--site-faint)]">(optional)</span></span><input value={title} onChange={(event) => setTitle(event.target.value.slice(0, 120))} maxLength={120} className="mt-2 h-12 w-full rounded-xl border border-[color:var(--site-border)] px-3 text-[13px] outline-none focus:border-[color:var(--site-primary-border)]" placeholder="Summarise your experience" /></label>
              <label className="block"><span className="text-[12px] font-bold text-charcoal">Your review <span className="font-medium text-[color:var(--site-faint)]">(optional)</span></span><textarea value={comment} onChange={(event) => setComment(event.target.value.slice(0, 2000))} maxLength={2000} className="mt-2 min-h-32 w-full resize-none rounded-xl border border-[color:var(--site-border)] p-3 text-[13px] leading-5 outline-none focus:border-[color:var(--site-primary-border)]" placeholder="Tell other customers about quality, fit, fabric, colour, and value." /><span className="mt-1 block text-right text-[9px] text-[color:var(--site-faint)]">{comment.length}/2000</span></label>
              <fieldset>
                <legend className="text-[12px] font-bold text-charcoal">Product details <span className="font-medium text-[color:var(--site-faint)]">(optional)</span></legend>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {[['quality', 'Quality'], ['fit', 'Fit'], ['colorAccuracy', 'Colour']].map(([key, label]) => <label key={key} className="text-[10px] font-semibold text-[color:var(--site-muted)]">{label}<select aria-label={`${label} rating`} value={aspects[key]} onChange={(event) => setAspects((current) => ({ ...current, [key]: event.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-[color:var(--site-border)] bg-[color:var(--site-surface)] px-2 text-[11px] font-bold"><option value="">Not rated</option>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value}/5</option>)}</select></label>)}
                </div>
              </fieldset>
              <fieldset><legend className="text-[12px] font-bold text-charcoal">Would you recommend it?</legend><div className="mt-2 flex gap-2">{[['true', 'Yes'], ['false', 'No']].map(([value, label]) => <button key={value} type="button" aria-pressed={recommend === value} onClick={() => setRecommend((current) => current === value ? '' : value)} className={`h-10 flex-1 rounded-xl border text-[11px] font-bold ${recommend === value ? 'border-[color:var(--site-primary-border)] bg-blush text-[color:var(--site-primary)]' : 'border-[color:var(--site-border)] text-[color:var(--site-muted)]'}`}>{label}</button>)}</div></fieldset>
              <div>
                <div className="flex items-center justify-between gap-3"><span className="text-[12px] font-bold text-charcoal">Add photos <span className="font-medium text-[color:var(--site-faint)]">(up to 4)</span></span><label className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-[color:var(--site-border)] px-3 text-[10px] font-bold text-[color:var(--site-muted)] ${uploading || photos.length >= 4 ? 'pointer-events-none opacity-40' : ''}`}><ImagePlus className="h-4 w-4" />{uploading ? 'Uploading...' : 'Choose photos'}<input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={uploadPhotos} disabled={uploading || photos.length >= 4} /></label></div>
                {photos.length ? <div className="mt-3 grid grid-cols-4 gap-2">{photos.map((photo) => <div key={photo} className="relative aspect-square overflow-hidden rounded-xl bg-[color:var(--site-surface-alt)]"><img src={normalizeImageUrl(photo)} alt="Review upload" className="h-full w-full object-cover" /><button type="button" aria-label="Remove review photo" onClick={() => { setPhotos((current) => current.filter((item) => item !== photo)); setPhotosTouched(true); }} className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-[color:color-mix(in_srgb,var(--site-surface)_95%,transparent)] text-rose shadow"><Trash2 className="h-3.5 w-3.5" /></button></div>)}</div> : null}
              </div>
              <div className="rounded-xl bg-[color:var(--site-accent-soft)] px-3 py-3 text-[10px] leading-4 text-[color:var(--site-muted)]">Please share your genuine product experience. Avoid phone numbers, payment details, and other personal information.</div>
              {error && <p className="rounded-xl bg-[color:var(--site-danger-soft)] px-3 py-3 text-[11px] font-semibold text-[color:var(--site-danger)]" role="alert">{error}</p>}
              <button type="submit" disabled={saving || uploading} className="h-12 w-full rounded-xl bg-[color:var(--site-tint)] text-[13px] font-black uppercase tracking-[.04em] text-[color:var(--site-on-fill)] disabled:bg-[color:var(--site-surface-alt)]">{saving ? 'Saving review...' : existingReview ? 'Update review' : 'Submit review'}</button>
              {existingReview && onWithdraw ? <button type="button" disabled={saving} onClick={withdraw} className="h-11 w-full rounded-xl border border-rose/20 text-[11px] font-bold text-rose disabled:opacity-40">Withdraw this review</button> : null}
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
