import { CalendarDays, ImageOff, Minus, Plus, ShieldCheck, Trash2, X } from 'lucide-react';
import { responsiveImage } from '../../utils/responsiveImages';
import { rentalMoney } from '../../utils/rentals';
import { rentalDetailHref } from '../../utils/rentalShopping';
export default function RentalBagItems({ items, offers, storeSlug, navigate, onUpdate, onRemove, disabled = false, presentation = 'compact' }) {
  const full = presentation === 'bag';
  return <div className={`rental-bag-items${full ? ' rental-bag-items--cart' : ''}`}>{items.map(item => {
    const offer = offers.find(row => row._id === item.listingId);
    if (!offer) return <article className="rental-bag-item" key={item.listingId}><div><strong>Rental option unavailable</strong><p>Remove this item or choose another rental before checkout.</p>{onRemove && <button type="button" disabled={disabled} onClick={() => onRemove(item.listingId)}>Remove item</button>}</div></article>;
    const image = responsiveImage(offer.product?.images?.[0], 'thumbnail');
    const open = () => navigate(rentalDetailHref({ ...offer.product, _id: offer.productId }, storeSlug, offer._id));
    const quantityControl = onUpdate ? <div className={`rental-bag-item__quantity${full ? ' sc-bag-item__quantity' : ''}`}><button type="button" aria-label={`Reduce quantity of ${offer.title}`} disabled={disabled || item.quantity <= 1} onClick={() => onUpdate(item.listingId, item.quantity - 1)}><Minus size={14} /></button><span aria-label={`Quantity ${item.quantity}`}>{full ? `Qty: ${item.quantity}` : item.quantity}</span><button type="button" aria-label={`Increase quantity of ${offer.title}`} disabled={disabled || item.quantity >= 10} onClick={() => onUpdate(item.listingId, item.quantity + 1)}><Plus size={14} /></button></div> : <p>Quantity: {item.quantity}</p>;
    return <article className={`rental-bag-item${full ? ' sc-bag-item sc-bag__panel' : ''}`} key={item.listingId} aria-label={offer.title}>
      {full ? <div className="rental-bag-item__picture sc-bag-item__picture"><button type="button" className="rental-bag-item__image" aria-label={`View ${offer.title}`} onClick={open}>{image.src ? <img {...image} alt={offer.product?.name || offer.title} /> : <ImageOff size={25} aria-hidden="true" />}</button></div> : image.src && <img {...image} alt={offer.product?.name || offer.title} />}
      <div className={full ? 'rental-bag-item__body sc-bag-item__body' : undefined}><button type="button" className={`rental-bag-item__title${full ? ' sc-bag-item__name' : ''}`} onClick={open}>{offer.title}</button>
        {full ? <>
          <p className="rental-bag-item__kind sc-bag-item__seller"><CalendarDays size={12} />Rental</p>
          <div className="sc-bag-item__options"><span className="rental-bag-item__size">Size: <strong>{offer.size || 'Free size'}</strong></span>{offer.colour && <span>{offer.colour}</span>}{quantityControl}</div>
          <div className="sc-bag-item__price"><strong>{rentalMoney(offer.dailyRatePaise * item.quantity)}</strong><small> / use day</small></div>
          {item.quantity > 1 && <p className="sc-bag-item__unit">{rentalMoney(offer.dailyRatePaise)} per piece / use day</p>}
          <p className="rental-bag-item__deposit sc-bag-item__return"><ShieldCheck size={13} />Refundable deposit {rentalMoney(offer.depositPaise * item.quantity)}</p>
        </> : <><p>{[offer.size || 'Free size', offer.colour].filter(Boolean).join(' · ')}</p><strong>{rentalMoney(offer.dailyRatePaise)}<small> / use day</small></strong><p className="rental-bag-item__deposit">Refundable deposit {rentalMoney(offer.depositPaise)}</p>{quantityControl}</>}
      </div>{onRemove && <button type="button" className={`rental-bag-item__remove${full ? ' sc-bag-item__remove' : ''}`} aria-label={`Remove ${offer.title}`} disabled={disabled} onClick={() => onRemove(item.listingId)}>{full ? <X size={19} /> : <Trash2 size={18} />}</button>}
    </article>;
  })}</div>;
}
