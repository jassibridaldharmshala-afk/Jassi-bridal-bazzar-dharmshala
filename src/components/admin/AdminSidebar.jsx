import { useMemo } from 'react';
import { Bell, ChevronRight, LayoutDashboard, Package, Tags, ShoppingBag, Users, Ticket, Image, Star, RefreshCcw, Boxes, BarChart3, Settings, FilePlus2, GitBranch, Video, MessageCircle, Mail, ClipboardList, Menu, Palette, HeartPulse, ShieldCheck } from 'lucide-react';
import logo from '../../assets/generated-brand-logo.svg';
import useAppPath from '../../hooks/useAppPath';
import { reelProductImportEnabled } from '../../config/features';
import { useBrandIdentity } from '../../context/BrandIdentityContext';
import { normalizeImageUrl } from '../../services/normalize';
import StoreLogo from '../ui/StoreLogo';

export const ADMIN_LINKS = [
  ['Dashboard', '/admin'],
  ['Notifications', '/admin/notifications'],
  ['Products', '/admin/products'],
  ['Product Drafts', '/admin/product-drafts'],
  ['Import social link', '/admin/social-import'],
  ['Social studio', '/admin/social'],
  ...(reelProductImportEnabled ? [['Reel Product Import', '/admin/reel-import']] : []),
  ['Categories', '/admin/categories'],
  ['Variant Groups', '/admin/variant-groups'],
  ['Orders', '/admin/orders'],
  ['Rental studio', '/admin/rentals'],
  ['Customers', '/admin/customers'],
  ['Coupons', '/admin/coupons'],
  ['Banners', '/admin/banners'],
  ['Campaigns', '/admin/campaigns'],
  ['Reviews', '/admin/reviews'],
  ['Returns / Exchange', '/admin/returns'],
  ['Inventory', '/admin/inventory'],
  ['Reports', '/admin/reports'],
  ['Traffic & visitors', '/admin/traffic'],
  ['Business Center', '/admin/business'],
  ['Support', '/admin/support'],
  ['Subscribers', '/admin/subscribers'],
  ['Audit log', '/admin/audit'],
  ['Website Designer', '/admin/customization'],
  ['Store content', '/admin/store-content'],
  ['System & updates', '/admin/system'],
  ['Settings', '/admin/settings'],
];

const MOBILE_TABS = [
  ['Dashboard', '/admin', LayoutDashboard],
  ['Products', '/admin/products', Package],
  ['Orders', '/admin/orders', ShoppingBag],
  ['Customers', '/admin/customers', Users],
];

export function adminTitleFromPath(path = '/admin') {
  const href = matchAdminHref(path);
  return ADMIN_LINKS.find(([, itemPath]) => itemPath === href)?.[0] || 'Admin';
}

export function matchAdminHref(path = '/admin') {
  const pathname = String(path).split('?')[0] || '/admin';
  let best = '';
  ADMIN_LINKS.forEach(([, href]) => {
    const matches = href === '/admin'
      ? pathname === '/admin' || pathname === '/'
      : pathname === href || pathname.startsWith(`${href}/`);
    if (matches && href.length >= best.length) best = href;
  });
  return best;
}

export default function AdminSidebar({ open = false, onClose = () => {}, onOpen = () => {} }) {
  const brand = useBrandIdentity();
  const currentPath = useAppPath();
  const activeHref = matchAdminHref(currentPath);

  const items = useMemo(() => ADMIN_LINKS.map(([label, path]) => ({
    label,
    path,
    active: path === activeHref,
    icon: iconForLabel(label),
  })), [activeHref]);

  const sidebar = (
    <aside className="admin-sidebar">
      <div className="admin-sidebar__brand">
        <StoreLogo src={normalizeImageUrl(brand.logo) || logo} name={brand.websiteName} className="admin-sidebar__logo" />
        <p className="admin-sidebar__label">Admin workspace</p>
      </div>
      <nav className="admin-sidebar__nav">
        {items.map((item) => (
          <a
            key={item.label}
            href={item.path}
            onClick={onClose}
            className={`admin-sidebar__link ${item.active ? 'is-active' : ''}`}
            aria-current={item.active ? 'page' : undefined}
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="admin-sidebar__icon">{item.icon}</span>
              <span className="truncate">{item.label}</span>
            </span>
            <ChevronRight className="h-3.5 w-3.5 opacity-50" />
          </a>
        ))}
      </nav>
    </aside>
  );

  return (
    <>
      <div className="admin-sidebar-desktop">{sidebar}</div>
      <nav className="admin-mobile-nav" aria-label="Admin mobile navigation">
        {MOBILE_TABS.map(([label, path, Icon]) => {
          const active = path === '/admin'
            ? currentPath === '/admin' || currentPath === '/'
            : currentPath === path || currentPath.startsWith(`${path}/`);
          return (
            <a key={label} href={path} className={active ? 'is-active' : ''} aria-current={active ? 'page' : undefined}>
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </a>
          );
        })}
        <button type="button" onClick={onOpen} className={open ? 'is-active' : ''}>
          <Menu className="h-4 w-4" />
          <span>More</span>
        </button>
      </nav>
      {open && (
        <div className="admin-drawer">
          <button type="button" className="admin-drawer__backdrop" onClick={onClose} aria-label="Close admin menu" />
          <div className="admin-drawer__panel">{sidebar}</div>
        </div>
      )}
    </>
  );
}

function iconForLabel(label) {
  const map = {
    Notifications: <Bell className="h-4 w-4" />,
    Dashboard: <LayoutDashboard className="h-4 w-4" />,
    Products: <Package className="h-4 w-4" />,
    'Product Drafts': <FilePlus2 className="h-4 w-4" />,
    'Import social link': <Package className="h-4 w-4" />,
    'Reel Product Import': <Video className="h-4 w-4" />,
    Categories: <Tags className="h-4 w-4" />,
    'Variant Groups': <GitBranch className="h-4 w-4" />,
    Orders: <ShoppingBag className="h-4 w-4" />,
    Customers: <Users className="h-4 w-4" />,
    Coupons: <Ticket className="h-4 w-4" />,
    Banners: <Image className="h-4 w-4" />,
    Campaigns: <BarChart3 className="h-4 w-4" />,
    Reviews: <Star className="h-4 w-4" />,
    'Returns / Exchange': <RefreshCcw className="h-4 w-4" />,
    Inventory: <Boxes className="h-4 w-4" />,
    Reports: <BarChart3 className="h-4 w-4" />,
    'Traffic & visitors': <BarChart3 className="h-4 w-4" />,
    'Business Center': <HeartPulse className="h-4 w-4" />,
    Support: <MessageCircle className="h-4 w-4" />,
    'Social studio': <MessageCircle className="h-4 w-4" />,
    Subscribers: <Mail className="h-4 w-4" />,
    'Audit log': <ClipboardList className="h-4 w-4" />,
    'Website Designer': <Palette className="h-4 w-4" />,
    'System & updates': <ShieldCheck className="h-4 w-4" />,
    Settings: <Settings className="h-4 w-4" />,
  };
  return map[label] || <LayoutDashboard className="h-4 w-4" />;
}
