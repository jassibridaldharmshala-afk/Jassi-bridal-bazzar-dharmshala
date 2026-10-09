import { BadgeCheck, CalendarDays, Pencil, Store, UserRound } from 'lucide-react';
import { rentalUseDayLabel, rentalSlotLabel } from '../../utils/rentalShopping';
import { rentalAddressText } from '../../utils/rentalDetails';
import RentalBagItems from './RentalBagItems';

export function RentalShopArrangement({ contact, policy, form, details, onEdit }) {
  const pickup = form.deliveryMode === 'STORE_PICKUP';
  return <div className="rental-shop-arrangement"><Store size={20} /><div><strong>{pickup ? `Pick up at ${contact?.storeName || 'the store'}` : form.deliveryMode === 'COURIER' ? 'Courier delivery & return' : 'Store delivery & collection'}</strong><p>{pickup ? contact?.address : rentalAddressText(details.deliveryAddress)}</p><small>{pickup ? `Shop hours: ${policy.pickupStart}–${policy.pickupEnd}` : 'Return collection uses this address.'}</small></div>{onEdit && <button type="button" className="rental-edit-control" onClick={onEdit} aria-label="Edit delivery arrangement"><Pencil size={14} /></button>}</div>;
}
export default function RentalCheckoutPlan({ form, details, contact, policy, items, offers, storeSlug, navigate, onDates, onContact, showContact = false }) {
  const useDates = [form.useStart, ...form.additionalUseDates].filter(Boolean);
  const slot = value => `${rentalUseDayLabel(value.slice(0, 10))} · ${rentalSlotLabel(value.slice(11, 16))}`;
  const phone = form.phone?.replace(/\D/g, '').slice(-10) || '';
  return <>
    <section className="sc-mobile-checkout__card rental-checkout-items"><div className="rental-checkout-section-heading"><h2>Your rental plan</h2><button className="rental-edit-control" type="button" onClick={onDates}><Pencil size={13} />Edit dates</button></div><RentalBagItems items={items} offers={offers} storeSlug={storeSlug} navigate={navigate} />
      <div className="rental-plan-timeline"><div><CalendarDays size={15} /><strong>Pickup</strong><span>{slot(form.pickupAt)}</span></div>{useDates.map(day => <div key={day} className="rental-plan-use-day"><CalendarDays size={15} /><strong>Use day</strong><span>{rentalUseDayLabel(day)} <small>1 paid day</small></span></div>)}<div><CalendarDays size={15} /><strong>Return</strong><span>{slot(form.returnDueAt)}</span></div></div>
      <RentalShopArrangement contact={contact} policy={policy} form={form} details={details} onEdit={onDates} />
    </section>
    {showContact && <section className="sc-mobile-checkout__card"><div className="rental-checkout-section-heading"><h2>Contact</h2><button className="rental-edit-control" type="button" onClick={onContact}><Pencil size={13} />Edit contact</button></div><div className="rental-review-contact"><UserRound size={24} /><div><strong>{form.name}</strong><p>+91 {phone.slice(0, 2)}••••••{phone.slice(-2)} <span className="rental-verified-contact"><BadgeCheck size={13} />Verified</span></p>{form.email && <small>{form.email}</small>}</div></div></section>}
  </>;
}
