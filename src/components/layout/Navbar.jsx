import { useRentalBag } from '../../context/RentalBagContext';
import { rentalShoppingRoute } from '../../utils/rentalShopping';
import RentalStorefrontLink from '../rentals/RentalStorefrontLink';
import NotificationBell from '../notifications/NotificationBell';
import { useEffect, useMemo, useState } from 'react';
import { Flower2, Heart, HelpCircle, Search, ShoppingBag, Shield, Truck, UserRound } from 'lucide-react';
import logoFallback from '../../assets/generated-brand-logo.svg';
import StoreLogo from '../ui/StoreLogo';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useWebsiteCustomization } from '../../context/WebsiteCustomizationContext';
import { normalizeImageUrl } from '../../services/normalize';
import { getDesktopActiveLink } from '../../utils/navbarActive';
import { parseStoreSlug } from '../../utils/attribution';
import { storefrontPath } from '../../utils/routing';
import './Navbar.css';

const desktopLinks = [
  { label: 'Home', path: '/' },
  { label: 'Shop All', path: '/products' },
  { label: 'New Arrivals', path: '/products?newArrival=true&collection=new-arrivals' },
  { label: 'Best Sellers', path: '/products?bestSeller=true&collection=best-sellers' },
  { label: 'Featured', path: '/products?featured=true&collection=featured', hideBelow: 1400 },
  { label: 'Offers', path: '/products?discount=20', isSale: true, hideBelow: 1280 },
  { label: 'Contact Us', path: '/contact', hideBelow: 1280 },
];

export default function Navbar({
  navigate,
  route = '/',
  logoSrc = logoFallback,
  cartCount: cartCountProp,
  wishlistCount: wishlistCountProp,
  onNavigate,
  onSearch,
  onAccountClick,
  onWishlistClick,
  onCartClick,
  onTrackOrderClick,
  onHelpClick,
  isAdmin: isAdminProp,
}) {
  const cart = useCart();
  const rentalBag = useRentalBag();
  const rentalShopping = rentalShoppingRoute(route);
  const wishlist = useWishlist();
  const { user, switchMode } = useAuth();
  const { config: websiteConfig } = useWebsiteCustomization();
  const headerConfig = websiteConfig.header;
  const [announcementClock, setAnnouncementClock] = useState(() => Date.now());
  const navLinks = useMemo(() => (headerConfig.menuItems?.length ? headerConfig.menuItems : desktopLinks).map((link) => ({
    ...(desktopLinks.find((fallback) => fallback.path === link.path) || {}), ...link,
  })), [headerConfig.menuItems]);
  const announcementVisible = headerConfig.announcementEnabled
    && (!headerConfig.announcementStartsAt || new Date(headerConfig.announcementStartsAt).getTime() <= announcementClock)
    && (!headerConfig.announcementEndsAt || new Date(headerConfig.announcementEndsAt).getTime() >= announcementClock);
  const configuredLogo = normalizeImageUrl(websiteConfig.branding.logo) || logoSrc;
  const routePath = route.split('?')[0];
  const routeParams = useMemo(() => new URLSearchParams(route.split('?')[1] || ''), [route]);
  const activeLinkLabel = useMemo(() => getDesktopActiveLink(routePath, routeParams), [routeParams, routePath]);
  const searchValue = useMemo(() => new URLSearchParams(route.split('?')[1] || '').get('search') || '', [route]);
  const [searchTerm, setSearchTerm] = useState(searchValue);
  const cartCount = Number.isFinite(Number(cartCountProp)) ? Number(cartCountProp) : Number(rentalShopping ? rentalBag.itemCount : cart?.itemCount || 0);
  const wishlistCount = Number.isFinite(Number(wishlistCountProp)) ? Number(wishlistCountProp) : Number(wishlist?.items?.length || 0);
  const go = path => (onNavigate || navigate || (() => {}))(storefrontPath(path, parseStoreSlug(route)));
  const isAdmin = typeof isAdminProp === 'boolean' ? isAdminProp : user?.role === 'admin';
  const showAdminPill = isAdmin && user?.availableModes?.includes('admin');

  useEffect(() => {
    setSearchTerm(searchValue);
  }, [searchValue]);

  useEffect(() => {
    const boundaries = [headerConfig.announcementStartsAt, headerConfig.announcementEndsAt]
      .map((value) => new Date(value).getTime()).filter((value) => Number.isFinite(value) && value > Date.now());
    if (!boundaries.length) return undefined;
    const wait = Math.max(50, Math.min(2147480000, Math.min(...boundaries) - Date.now() + 50));
    const timer = window.setTimeout(() => setAnnouncementClock(Date.now()), wait);
    return () => window.clearTimeout(timer);
  }, [headerConfig.announcementEndsAt, headerConfig.announcementStartsAt, announcementClock]);

  const submitSearch = () => {
    const value = searchTerm.trim();
    if (onSearch) {
      onSearch(value);
      return;
    }

    const params = new URLSearchParams();
    if (value) params.set('search', value);
    else params.delete('search');
    go(`${rentalShopping ? '/rental-book' : '/search'}${params.toString() ? `?${params}` : ''}`);
  };

  return (
    <header
      className={`sc-navbar sc-navbar--desktop ${headerConfig.sticky ? 'sc-navbar--sticky' : 'sc-navbar--static'}`}
      style={{ '--navbar-bg': headerConfig.background, '--navbar-text': headerConfig.textColor, '--navbar-logo-size': `${headerConfig.logoSize}px`, '--navbar-announcement-bg': headerConfig.announcementBackground, '--navbar-announcement-text': headerConfig.announcementTextColor }}
    >
      <div className="sc-navbar__shell">
        {announcementVisible && <div className="sc-navbar__top">
          <div className="sc-navbar__announcement">
            <Truck className="h-4.5 w-4.5 text-gold" strokeWidth={1.9} aria-hidden="true" />
            {headerConfig.announcementLink ? <button type="button" className="text-[13px] font-medium tracking-[0.01em] underline-offset-2 hover:underline" onClick={() => go(headerConfig.announcementLink)}>{headerConfig.announcementText}</button>
              : <span className="text-[13px] font-medium tracking-[0.01em]">{headerConfig.announcementText}</span>}
          </div>

          <div className="sc-navbar__center-mark" aria-hidden="true">
            <Flower2 className="h-4.5 w-4.5" strokeWidth={1.8} />
          </div>

          <div className="sc-navbar__utility">
            <button type="button" className="sc-navbar__top-link" onClick={() => (onTrackOrderClick ? onTrackOrderClick() : go('/orders'))}>
              My Orders
            </button>
            <span className="sc-navbar__top-divider" aria-hidden="true">
              |
            </span>
            <button type="button" className="sc-navbar__top-link sc-navbar__top-link--help" onClick={() => (onHelpClick ? onHelpClick() : go('/contact'))}>
              <HelpCircle className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden="true" />
              Help &amp; Support
            </button>
          </div>
        </div>}

        <div className="sc-navbar__main">
          <div className="sc-navbar__brand">
            <button type="button" className="sc-navbar__brand-link" onClick={() => go('/')}>
              <StoreLogo className="sc-navbar__logo" src={configuredLogo} name={websiteConfig.branding.websiteName} />
            </button>
          </div>

          <nav className="sc-navbar__links" aria-label="Primary" style={{ justifyContent: headerConfig.menuAlignment === 'right' ? 'flex-end' : headerConfig.menuAlignment }}>
            <RentalStorefrontLink className="sc-navbar__link" navigate={go} />
            {navLinks.map((link) => {
              const targetPath = String(link.path || '').split('?')[0];
              const isActive = activeLinkLabel === link.label || (targetPath !== '/' && routePath === targetPath) || (targetPath === '/' && routePath === '/');
              return (
                <button
                  key={link.label}
                  type="button"
                  className={`sc-navbar__link${
                    link.hideBelow === 1400 ? ' sc-navbar__link--hide-1400' : ''
                  }${link.hideBelow === 1280 ? ' sc-navbar__link--hide-1280' : ''}${
                    link.isSale ? ' sc-navbar__link--sale' : ''
                  }${isActive ? ' sc-navbar__link--active' : ''}`}
                  onClick={() => go(link.path)}
                >
                  <span>{link.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="sc-navbar__controls">
            {showAdminPill ? (
              <button type="button" className="sc-navbar__admin-pill" onClick={() => user?.activeMode === 'admin' ? go('/admin') : switchMode('admin')}>
                <Shield className="h-3.5 w-3.5" strokeWidth={2.1} aria-hidden="true" />
                Admin
              </button>
            ) : null}

            <div className="sc-navbar__search">
              <input
                className="sc-navbar__search-input"
                type="search"
                value={searchTerm}
                placeholder="Search for products, styles..."
                onFocus={() => {
                  if (!routePath.startsWith('/search')) go(rentalShopping ? '/rental-book' : '/search');
                }}
                onChange={(event) => setSearchTerm(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    submitSearch();
                  }
                }}
                aria-label="Search products"
              />
              <button type="button" className="sc-navbar__search-button" onClick={submitSearch} aria-label="Search">
                <Search className="h-4.5 w-4.5" strokeWidth={2} aria-hidden="true" />
              </button>
            </div>

            <div className="sc-navbar__actions">
              <NotificationBell navigate={go} desktop />
              <button
                type="button"
                className="sc-navbar__action"
                onClick={() => (onAccountClick ? onAccountClick() : go('/profile'))}
                aria-label="Account"
              >
                <span className="sc-navbar__action-icon">
                  <UserRound className="h-6 w-6" strokeWidth={1.85} aria-hidden="true" />
                </span>
                <span className="sc-navbar__action-label">Account</span>
              </button>

              <button
                type="button"
                className="sc-navbar__action"
                onClick={() => (onWishlistClick ? onWishlistClick() : go(rentalShopping ? '/wishlist?mode=rent' : '/wishlist'))}
                aria-label="Wishlist"
              >
                <span className="sc-navbar__action-icon">
                  <Heart className="h-6 w-6" strokeWidth={1.85} aria-hidden="true" />
                  {wishlistCount > 0 ? <span className="sc-navbar__badge">{wishlistCount}</span> : null}
                </span>
                <span className="sc-navbar__action-label">Wishlist</span>
              </button>

              <button
                type="button"
                className="sc-navbar__action"
                onClick={() => (onCartClick ? onCartClick() : go(rentalShopping ? '/rental-cart' : '/cart'))}
                aria-label="Cart"
              >
                <span className="sc-navbar__action-icon">
                  <ShoppingBag className="h-6 w-6" strokeWidth={1.85} aria-hidden="true" />
                  {cartCount > 0 ? <span className="sc-navbar__badge">{cartCount}</span> : null}
                </span>
                <span className="sc-navbar__action-label">Cart</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
