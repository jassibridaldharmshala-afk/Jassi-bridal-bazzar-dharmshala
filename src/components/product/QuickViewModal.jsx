import { useEffect } from 'react';
import { ShoppingBag, X } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { getPrimaryImageUrl, normalizeImageUrl } from '../../services/normalize';
import { isUnavailable, wishlistStock } from '../../utils/wishlist';
import { getSelectableSizes } from '../../utils/productSizing';

export default function QuickViewModal({ product, onClose, onOpenFull }) {
  const cart = useCart();
  useEffect(() => {
    if (!product) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKeyDown);
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', onKeyDown); };
  }, [onClose, product]);
  if (!product) return null;
  const image = normalizeImageUrl(getPrimaryImageUrl(product.images));
  const price = Number(product.sellingPrice ?? product.price ?? 0);
  const original = Number(product.originalPrice ?? price);
  const rental = product.commerceMode === 'RENTAL_ONLY';
  const unavailable = !rental && (isUnavailable(product) || wishlistStock(product) === 0);
  const needsSize = getSelectableSizes(product).length > 0;
  return <div className="fixed inset-0 z-[120] grid place-items-center p-4" role="presentation" onClick={(event) => { event.stopPropagation(); onClose?.(); }}>
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
    <section role="dialog" aria-modal="true" aria-label={`Quick view ${product.name}`} className="relative grid max-h-[90vh] w-full max-w-3xl overflow-auto rounded-3xl bg-white shadow-2xl md:grid-cols-[.9fr_1.1fr]" onClick={(event) => event.stopPropagation()}>
      <button type="button" onClick={onClose} className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white text-slate-700 shadow" aria-label="Close quick view"><X className="h-5 w-5" /></button>
      <div className="min-h-72 bg-[#f7eee8]">{image ? <img src={image} alt={product.name} className="h-full max-h-[580px] w-full object-cover object-top" /> : <div className="grid h-full min-h-72 place-items-center font-black text-wine">{product.name}</div>}</div>
      <div className="flex flex-col justify-center p-6 sm:p-8">
        <p className="text-xs font-black uppercase tracking-[.18em] text-wine">Quick view</p>
        <h2 className="mt-3 text-2xl font-black text-charcoal">{product.name}</h2>
        <p className="mt-2 text-sm font-semibold text-slate-500">{[product.category, product.fabric].filter(Boolean).join(' · ')}</p>
        <div className="mt-5 flex items-center gap-3"><strong className="text-xl text-charcoal">{rental ? 'Check rental rates and dates' : `Rs. ${price.toLocaleString('en-IN')}`}</strong>{!rental && original > price && <del className="text-sm text-slate-400">Rs. {original.toLocaleString('en-IN')}</del>}</div>
        {product.description && <p className="mt-5 line-clamp-4 text-sm leading-6 text-slate-600">{product.description}</p>}
        <div className="mt-7 grid gap-3 sm:grid-cols-2"><button type="button" disabled={unavailable || (!rental && cart.loading)} onClick={() => rental || needsSize ? onOpenFull?.() : cart.addToCart(product)} className="site-theme-button inline-flex h-12 items-center justify-center gap-2 disabled:opacity-50"><ShoppingBag className="h-4 w-4" />{rental ? 'Check rental dates' : unavailable ? 'Out of stock' : needsSize ? 'Select size' : 'Add to cart'}</button><button type="button" onClick={onOpenFull} className="h-12 rounded-xl border border-theme-border text-sm font-black text-wine">View full details</button></div>
      </div>
    </section>
  </div>;
}
