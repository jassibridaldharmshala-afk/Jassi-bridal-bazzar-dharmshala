import { useRentalBag } from '../../context/RentalBagContext';
import { rentalShoppingRoute, shoppingBagDestination } from '../../utils/rentalShopping';
import Icon from './Icon';
import { useWishlist } from '../../context/WishlistContext';
import { useCart } from '../../context/CartContext';
import { parseStoreSlug } from '../../utils/attribution';
import { storefrontPath } from '../../utils/routing';

const tabs = [
  ['/', 'Home', 'home'],
  ['/products', 'Products', 'grid'],
  ['/search', 'Search', 'search'],
  ['/wishlist', 'Wishlist', 'heart'],
  ['/cart', 'Cart', 'bag'],
  ['/profile', 'Profile', 'user'],
];

export default function MobileBottomNav({ active, navigate, route }) {
  const wishlist = useWishlist(); const cart = useCart();
  const rentalBag = useRentalBag();
  const currentRoute = route || active || window.location.pathname + window.location.search;
  const currentPath = (active || currentRoute).split('?')[0];
  const rentalShopping = rentalShoppingRoute(currentRoute);
  const storeSlug = parseStoreSlug(currentRoute);
  const bagDestination = shoppingBagDestination(currentRoute, cart?.itemCount, rentalBag.itemCount);
  const counts = { '/wishlist': wishlist?.items?.length || 0, '/cart': Number(cart?.itemCount || 0) + Number(rentalBag.itemCount || 0) };
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <div className="grid h-16 grid-cols-6">
        {tabs.map(([path, label, icon]) => {
          const destination = path === '/cart' ? bagDestination : rentalShopping && path === '/products' ? '/rental-book' : rentalShopping && path === '/wishlist' ? '/wishlist?mode=rent' : path;
          const isActive = path === '/cart' ? ['/cart', '/rental-cart'].some(bagPath => currentPath === storefrontPath(bagPath, storeSlug)) : currentPath === storefrontPath(destination.split('?')[0], storeSlug);
          return <button key={label} onClick={() => navigate(storefrontPath(destination, storeSlug))} aria-current={isActive ? 'page' : undefined} aria-label={counts[path] ? `${label}, ${counts[path]} items` : label} className={`flex min-w-0 flex-col items-center justify-center gap-1 text-[10px] font-bold ${isActive ? 'text-wine' : 'text-slate-500'}`}>
            <span className="relative inline-flex h-5 w-5 shrink-0"><Icon name={icon} className="h-5 w-5" />{counts[path] > 0 && <span aria-hidden="true" className="absolute -right-2 -top-1 rounded-full bg-wine px-1 text-[8px] leading-3 text-white">{counts[path] > 99 ? '99+' : counts[path]}</span>}</span>
            <span className="truncate">{label}</span>
          </button>;
        })}
      </div>
    </nav>
  );
}
