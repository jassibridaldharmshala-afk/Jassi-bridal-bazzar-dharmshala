import { ShoppingBag, CalendarDays } from 'lucide-react';
import { useStorefront } from '../../context/StorefrontContext';
import { storefrontPath } from '../../utils/routing';
export default function ShoppingModeTabs({ mode = 'buy', navigate }) {
  const { storeSlug } = useStorefront();
  return <nav className="rental-shopping-tabs" aria-label="Buy or rent">{[['buy', 'Buy', ShoppingBag, '/products?mode=buy'], ['rent', 'Rental', CalendarDays, '/rental-book']].map(([key, label, Icon, path]) => <a key={key} href={storefrontPath(path, storeSlug)} aria-current={mode === key ? 'page' : undefined} onClick={event => { if (navigate && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.button === 0) { event.preventDefault(); navigate(storefrontPath(path, storeSlug)); } }}><Icon size={18} />{label}</a>)}</nav>;
}
