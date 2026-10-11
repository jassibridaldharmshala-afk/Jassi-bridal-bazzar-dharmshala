import { BadgeCheck, CalendarDays, Check, Pencil, ShoppingBag, Store, UserRound } from 'lucide-react';
import { rentalUseDayLabel, rentalSlotLabel } from '../../utils/rentalShopping';
import { rentalAddressText } from '../../utils/rentalDetails';
import RentalBagItems from './RentalBagItems';

export function RentalShopArrangement({ contact, policy, form, details, onEdit }) {
  const pickup = form.deliveryMode === 'STORE_PICKUP';
  return <div className="rental-shop-arrangement"><Store size={20} aria-hidden="true" /><div><strong>{pickup ? `Pick up at ${contact?.storeName || 'the store'}` : form.deliveryMode === 'COURIER' ? 'Courier delivery & return' : 'Store delivery & collection'}</strong><p>{pickup ? contact?.address : rentalAddressText(details.deliveryAddress)}</p><small>{pickup ? `Shop hours: ${rentalSlotLabel(policy.pickupStart)}–${rentalSlotLabel(policy.pickupEnd)}` : 'Return collection uses this address.'}</small></div>{onEdit && <button type="button" className="rental-edit-control" onClick={onEdit} aria-label="Edit delivery arrangement"><Pencil size={14} /></button>}</div>;
}
export default function RentalCheckoutPlan({ form, details, contact, policy, items, offers, storeSlug, navigate, onDates, onContact, showContact = false, available = false, sectionNumber = 1 }) {
  const useDates = [form.useStart, ...form.additionalUseDates].filter(Boolean);
  const slot = value => `${rentalUseDayLabel(value.slice(0, 10))} · ${rentalSlotLabel(value.slice(11, 16))}`;
  const phone = form.phone?.replace(/\D/g, '').slice(-10) || '';
  return <>
    <section className="sc-mobile-checkout__card rental-checkout-items rental-plan-card"><div className="rental-checkout-section-heading"><h2><span className="rental-checkout-section-number">{sectionNumber}</span><ShoppingBag size={17} aria-hidden="true" />Your rental plan</h2><button className="rental-edit-control" type="button" onClick={onDates}><Pencil size={13} />Edit dates</button></div>
      <div className="rental-plan-grid"><div className="rental-plan-items"><RentalBagItems items={items} offers={offers} storeSlug={storeSlug} navigate={navigate} /></div><div className="rental-plan-schedule"><h3>Dates & pickup</h3>
        <div className="rental-plan-timeline"><div><CalendarDays size={15} aria-hidden="true" /><strong>Pickup</strong><span>{slot(form.pickupAt)}</span></div>{useDates.map(day => <div key={day} className="rental-plan-use-day"><CalendarDays size={15} aria-hidden="true" /><strong>Use day</strong><span>{rentalUseDayLabel(day)} <small>1 paid day</small></span></div>)}<div><CalendarDays size={15} aria-hidden="true" /><strong>Return</strong><span>{slot(form.returnDueAt)}</span></div></div>
        <p className="rental-plan-charge-note">Only selected use days are charged.</p>
      </div></div>
      <RentalShopArrangement contact={contact} policy={policy} form={form} details={details} onEdit={onDates} />
      {available && <p className="rental-plan-availability" role="status"><Check size={15} aria-hidden="true" />Available for your selected dates. Final check at reservation.</p>}
    </section>
    {showContact && <section className="sc-mobile-checkout__card rental-review-contact-card"><div className="rental-checkout-section-heading"><h2><span className="rental-checkout-section-number">2</span><UserRound size={17} aria-hidden="true" />Contact</h2><button className="rental-edit-control" type="button" onClick={onContact}><Pencil size={13} />Edit contact</button></div><div className="rental-review-contact"><div><strong>{form.name}</strong><p>+91 {phone.slice(0, 2)}••••••{phone.slice(-2)} <span className="rental-verified-contact"><BadgeCheck size={13} />Verified</span></p>{form.email && <small>{form.email}</small>}{form.whatsappConsent && <small className="rental-review-whatsapp">WhatsApp booking updates enabled</small>}</div></div></section>}
  </>;
}
