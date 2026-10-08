import { useRentalBag } from '../../context/RentalBagContext';
import { rentalShoppingRoute } from '../../utils/rentalShopping';
import NotificationBell from '../notifications/NotificationBell';
import { useNotifications } from '../../context/NotificationContext';
import { useEffect, useState } from 'react';
import Icon from './Icon';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useAuth } from '../../context/AuthContext';
import {
  ChevronRight,
  Bell,
  Grid2x2,
  Headphones,
  Heart,
  Home,
  MapPin,
  Package,
  Search,
  ShoppingBag,
  Sparkles,
  Tag,
  X,
} from 'lucide-react';
import MobileSearchOverlay from './MobileSearchOverlay';
import { parseStoreSlug } from '../../utils/attribution';
import { storefrontPath } from '../../utils/routing';
import { useBrandIdentity } from '../../context/BrandIdentityContext';
import { normalizeImageUrl } from '../../services/normalize';
import logoFallback from '../../assets/generated-brand-logo.svg';
import StoreLogo from '../ui/StoreLogo';
import { useWebsiteCustomization } from '../../context/WebsiteCustomizationContext';

const categoryLinks = [
  ['Sarees', '/products?search=Saree'],
  ['Suits', '/products?search=Suit'],
  ['Kurtis', '/products?search=Kurti'],
  ['Dresses', '/products?search=Dress'],
  ['Lehengas', '/products?search=Lehenga'],
  ['Ethnic Sets', '/products?search=Set'],
  ['Accessories', '/products?search=Accessory'],
];

export default function MobileHeader({ navigate, route = '/' }) {
  const brand = useBrandIdentity();
  const { config: websiteConfig } = useWebsiteCustomization();
  const cart = useCart();
  const rentalBag = useRentalBag();
  const rentalShopping = rentalShoppingRoute(route);
  const wishlist = useWishlist();
  const { user, switchMode } = useAuth();
  const { unreadCount } = useNotifications();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [announcementClock, setAnnouncementClock] = useState(() => Date.now());
  const compactUtilityRoute = ['/wishlist', '/profile', '/orders', '/notifications', '/cart', '/checkout']
    .includes(route.split('?')[0]);
  const searchValue = new URLSearchParams(route.split('?')[1] || '').get('search') || '';
  const headerConfig = websiteConfig.header;
  const menuItems = headerConfig.menuItems?.length ? headerConfig.menuItems : [
    { label: 'Home', path: '/' }, { label: 'Shop All', path: '/products' },
    { label: 'New Arrivals', path: '/products?newArrival=true' }, { label: 'Offers', path: '/products?discount=20' },
  ];
  const announcementVisible = headerConfig.announcementEnabled
    && (!headerConfig.announcementStartsAt || new Date(headerConfig.announcementStartsAt).getTime() <= announcementClock)
    && (!headerConfig.announcementEndsAt || new Date(headerConfig.announcementEndsAt).getTime() >= announcementClock);

  useEffect(() => {
    setSearchOpen(false);
  }, [route]);

  useEffect(() => {
    const boundaries = [headerConfig.announcementStartsAt, headerConfig.announcementEndsAt]
      .map((value) => new Date(value).getTime()).filter((value) => Number.isFinite(value) && value > Date.now());
    if (!boundaries.length) return undefined;
    const wait = Math.max(50, Math.min(2147480000, Math.min(...boundaries) - Date.now() + 50));
    const timer = window.setTimeout(() => setAnnouncementClock(Date.now()), wait);
    return () => window.clearTimeout(timer);
  }, [headerConfig.announcementEndsAt, headerConfig.announcementStartsAt, announcementClock]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const go = (path) => {
    setOpen(false);
    navigate(storefrontPath(path, parseStoreSlug(route)));
  };

  return (
    <>
      <header data-mobile-header className="sticky top-0 z-50 overflow-hidden border-b border-slate-200 bg-white/95 backdrop-blur lg:hidden">
        <div className="grid h-[58px] grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-1 px-3 pt-1">
          <button onClick={() => setOpen(true)} className="grid h-11 w-11 place-items-center text-slate-600" aria-label="Open menu">
            <Icon name="menu" className="h-5.5 w-5.5" />
          </button>
          {compactUtilityRoute ? <span aria-hidden="true" /> : <button type="button" onClick={() => go('/')} aria-label={brand.websiteName + ' home'} className="min-w-0 justify-self-start"><StoreLogo src={normalizeImageUrl(brand.logo) || logoFallback} name={brand.websiteName} className="h-9 max-w-full object-contain" /></button>}
          <div className="col-start-3 flex shrink-0 justify-end gap-1">
            <NotificationBell navigate={navigate} />
            <button onClick={() => setSearchOpen(true)} className="grid h-11 w-10 place-items-center text-slate-700" aria-label="Search products">
              <Search className="h-5.5 w-5.5" strokeWidth={1.9} />
            </button>
            <button onClick={() => go(rentalShopping ? '/wishlist?mode=rent' : '/wishlist')} className="relative grid h-11 w-11 place-items-center text-slate-700" aria-label="Open wishlist">
              <Icon name="heart" className="h-5.5 w-5.5" />
              {wishlist.items.length > 0 && (
                <span className="absolute right-0 top-0 grid h-4 min-w-4 place-items-center rounded-full bg-wine px-1 text-[9px] font-black leading-none text-white">
                  {wishlist.items.length}
                </span>
              )}
            </button>
            <button onClick={() => go(rentalShopping ? '/rental-cart' : '/cart')} className="relative grid h-11 w-11 place-items-center text-slate-700" aria-label="Open cart">
              <Icon name="bag" className="h-5.5 w-5.5" />
              {(rentalShopping ? rentalBag.itemCount : cart.itemCount) > 0 && (
                <span className="absolute right-0 top-0 grid h-4 min-w-4 place-items-center rounded-full bg-wine px-1 text-[9px] font-black leading-none text-white">
                  {(rentalShopping ? rentalBag.itemCount : cart.itemCount)}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>
      {searchOpen && <MobileSearchOverlay shoppingMode={rentalShopping ? 'rental' : 'buy'} initialValue={searchValue} navigate={go} storeSlug={parseStoreSlug(route)} onClose={() => setSearchOpen(false)} />}
      <div
        className={`fixed inset-0 z-[75] transition-[visibility] duration-0 lg:hidden ${open ? 'visible pointer-events-auto delay-0' : 'invisible pointer-events-none delay-300'}`}
        aria-hidden={!open}
      >
          <button
            type="button"
            onClick={() => setOpen(false)}
            className={`absolute inset-0 z-0 bg-[#17121a]/55 backdrop-blur-[1px] transition-opacity duration-300 motion-reduce:duration-0 ${open ? 'opacity-100' : 'opacity-0'}`}
            aria-label="Close menu"
          />
          <aside
            className={`absolute inset-y-0 left-0 z-10 flex w-[min(88vw,360px)] flex-col overflow-hidden bg-white shadow-[18px_0_45px_rgba(20,12,17,.22)] transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:duration-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
            role="dialog"
            aria-modal="true"
            aria-label="Shopping menu"
          >
            <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-wine via-wine to-wine px-5 pb-5 pt-[calc(env(safe-area-inset-top)+18px)] text-white">
              <div className="pointer-events-none absolute -right-10 -top-12 z-0 h-36 w-36 rounded-full border-[24px] border-white/5" />
              <button
                type="button"
                onClick={(event) => { event.stopPropagation(); setOpen(false); }}
                className="absolute right-3 top-[calc(env(safe-area-inset-top)+8px)] z-20 grid h-10 w-10 touch-manipulation place-items-center rounded-full bg-white/10 text-white"
                aria-label="Close menu panel"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="relative flex items-center gap-3 pr-10">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-white/30 bg-white/15 shadow-inner">
                  {user?.name ? <span className="text-xl font-black uppercase">{user.name.trim().charAt(0)}</span> : <Icon name="user" className="h-6 w-6 text-white" />}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[16px] font-black leading-tight">{user?.name || 'Welcome'}</p>
                  <p className="mt-1 truncate text-[11px] font-medium text-white/75">{user?.phone || user?.email || 'Sign in to view orders and rewards'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => go(user ? '/profile' : '/login?redirect=/profile')}
                className="relative mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/30 bg-white/10 px-3 text-[11px] font-black uppercase tracking-[.06em] text-white"
              >
                {user ? 'View profile' : 'Login / Sign up'}
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              {!user && <p className="relative mt-2 text-[9px] font-semibold text-white/60">Secure login with mobile number and OTP</p>}
            </div>

            <nav className="min-h-0 flex-1 overflow-y-auto bg-white pb-[calc(env(safe-area-inset-bottom)+16px)]">
              <div className="border-b-[6px] border-[#f7f7f7] py-2">
                {menuItems.map((item, index) => <DrawerLink key={`${item.path}-${index}`} icon={item.path === '/' ? Home : item.path === '/products' ? Grid2x2 : /newArrival/i.test(item.path) ? Sparkles : /discount|offer/i.test(item.path) ? Tag : undefined} label={item.label} badge={/newArrival/i.test(item.path) ? 'NEW' : /discount|offer/i.test(item.path) ? 'SALE' : ''} accent={/discount|offer/i.test(item.path)} onClick={() => go(item.path)} />)}
              </div>

              <DrawerSection title="Shop by category">
                {categoryLinks.map(([label, path]) => (
                  <DrawerLink key={label} label={label} onClick={() => go(path)} compact />
                ))}
              </DrawerSection>

              <DrawerSection title="My account">
                <DrawerLink icon={Package} label="My Orders" onClick={() => go('/orders')} />
                <DrawerLink icon={Bell} label="Notifications" badge={unreadCount > 99 ? '99+' : unreadCount || ''} onClick={() => go('/notifications')} />
                <DrawerLink icon={Heart} label="Wishlist" badge={wishlist.items.length || ''} onClick={() => go(rentalShopping ? '/wishlist?mode=rent' : '/wishlist')} />
                <DrawerLink icon={ShoppingBag} label="My Cart" badge={(rentalShopping ? rentalBag.itemCount : cart.itemCount) || ''} onClick={() => go(rentalShopping ? '/rental-cart' : '/cart')} />
                <DrawerLink icon={MapPin} label="Saved Addresses" onClick={() => go('/profile/addresses')} />
                <DrawerLink icon={Tag} label="Coupons" onClick={() => go('/profile')} />
              </DrawerSection>

              <DrawerSection title="More">
                <DrawerLink icon={Headphones} label="Help & Support" onClick={() => go('/contact')} />
              </DrawerSection>

              {user?.role === 'admin' && user?.availableModes?.includes('admin') && (
                <div className="border-t border-slate-100 px-5 py-4">
                  <button
                    type="button"
                    onClick={() => { setOpen(false); if (user.activeMode === 'admin') navigate('/admin'); else switchMode('admin'); }}
                    className="h-11 w-full rounded-xl bg-wine px-4 text-[12px] font-black text-white shadow-sm"
                  >
                    {user.activeMode === 'admin' ? 'Admin Dashboard' : 'Switch to Admin'}
                  </button>
                </div>
              )}

              <div className="px-5 pb-2 pt-5">
                <p className="text-[9px] font-bold uppercase tracking-[.16em] text-slate-500">{brand.websiteName}</p>
                <p className="mt-1 text-[10px] font-medium text-slate-400">{brand.tagline}</p>
                {announcementVisible && headerConfig.announcementText && (headerConfig.announcementLink ? <button type="button" onClick={() => go(headerConfig.announcementLink)} className="mt-3 w-full rounded-lg bg-[#faf2ee] p-3 text-left text-[11px] font-bold text-wine">{headerConfig.announcementText}</button> : <p className="mt-3 rounded-lg bg-[#faf2ee] p-3 text-[11px] text-wine">{headerConfig.announcementText}</p>)}
              </div>
            </nav>
          </aside>
        </div>
    </>
  );
}

function DrawerSection({ title, children }) {
  return (
    <section className="border-b-[6px] border-[#f7f7f7] py-3">
      <h2 className="px-5 pb-2 text-[10px] font-black uppercase tracking-[.15em] text-slate-400">{title}</h2>
      {children}
    </section>
  );
}

function DrawerLink({ icon: RowIcon, label, badge, accent = false, compact = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center gap-3 px-5 text-left transition-colors active:bg-[#fff2f6] ${compact ? 'h-10' : 'h-12'} ${accent ? 'text-[#e11d5b]' : 'text-charcoal'}`}
    >
      {RowIcon ? (
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${accent ? 'bg-[#fff0f5] text-[#e11d5b]' : 'bg-[#f7f4f2] text-slate-500'}`}>
          <RowIcon className="h-4 w-4" strokeWidth={1.9} />
        </span>
      ) : <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#d7c6cc]" />}
      <span className={`min-w-0 flex-1 truncate ${accent ? 'font-black' : 'font-semibold'} ${compact ? 'text-[13px]' : 'text-[13px]'}`}>{label}</span>
      {badge !== undefined && badge !== '' ? (
        <span className={`rounded-full px-2 py-0.5 text-[8px] font-black ${accent ? 'bg-[#e11d5b] text-white' : 'bg-[#fff0f5] text-[#d31352]'}`}>{badge}</span>
      ) : null}
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-active:translate-x-0.5" />
    </button>
  );
}
