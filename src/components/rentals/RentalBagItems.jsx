import { Minus, Plus, Trash2 } from 'lucide-react';
import { responsiveImage } from '../../utils/responsiveImages';
import { rentalMoney } from '../../utils/rentals';
import { rentalDetailHref } from '../../utils/rentalShopping';
export default function RentalBagItems({ items, offers, storeSlug, navigate, onUpdate, onRemove, disabled = false }) {
  return <div className="rental-bag-items">{items.map(item => {
    const offer = offers.find(row => row._id === item.listingId);
    if (!offer) return <article className="rental-bag-item" key={item.listingId}><div><strong>Rental option unavailable</strong><p>Remove this item or choose another rental before checkout.</p>{onRemove && <button type="button" disabled={disabled} onClick={() => onRemove(item.listingId)}>Remove item</button>}</div></article>;
    const image = responsiveImage(offer.product?.images?.[0], 'thumbnail');
    return <article className="rental-bag-item" key={item.listingId}>{image.src && <img {...image} alt={offer.product?.name || offer.title} />}<div><button type="button" className="rental-bag-item__title" onClick={() => navigate(rentalDetailHref({ ...offer.product, _id: offer.productId }, storeSlug, offer._id))}>{offer.title}</button><p>{[offer.size || 'Free size', offer.colour].filter(Boolean).join(' · ')}</p><strong>{rentalMoney(offer.dailyRatePaise)}<small> / use day</small></strong><p className="rental-bag-item__deposit">Refundable security {rentalMoney(offer.depositPaise)}</p>{onUpdate ? <div className="rental-bag-item__quantity"><button type="button" aria-label={`Reduce quantity of ${offer.title}`} disabled={disabled || item.quantity <= 1} onClick={() => onUpdate(item.listingId, item.quantity - 1)}><Minus size={14} /></button><span>{item.quantity}</span><button type="button" aria-label={`Increase quantity of ${offer.title}`} disabled={disabled || item.quantity >= 10} onClick={() => onUpdate(item.listingId, item.quantity + 1)}><Plus size={14} /></button></div> : <p>Quantity: {item.quantity}</p>}</div>{onRemove && <button type="button" className="rental-bag-item__remove" aria-label={`Remove ${offer.title}`} disabled={disabled} onClick={() => onRemove(item.listingId)}><Trash2 size={18} /></button>}</article>;
  })}</div>;
}
