import { CalendarDays, ShoppingBag } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useRentalBag } from '../../context/RentalBagContext';
import { storefrontPath } from '../../utils/routing';
import './BagTypeTabs.css';

export default function BagTypeTabs({ active, navigate, storeSlug = '' }) {
  const cart = useCart();
  const rentalBag = useRentalBag();
  const tabs = [
    { type: 'buy', label: 'Buy', count: cart?.itemCount || 0, path: '/cart', Icon: ShoppingBag },
    { type: 'rent', label: 'Rental', count: rentalBag.itemCount || 0, path: '/rental-cart', Icon: CalendarDays },
  ];
  return <nav className="sc-bag-types" aria-label="Bag type">
    {tabs.map(({ type, label, count, path, Icon }) => {
      const href = storefrontPath(path, storeSlug);
      return <a key={type} href={href} aria-current={active === type ? 'page' : undefined} aria-label={`${label} bag, ${count} ${count === 1 ? 'item' : 'items'}`} onClick={event => {
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        if (active !== type) navigate(href);
      }}><Icon size={16} aria-hidden="true" /><span>{label}<span className="sc-bag-types__mobile-label"> bag</span></span><span className="sc-bag-types__count">{count}</span></a>;
    })}
  </nav>;
}
