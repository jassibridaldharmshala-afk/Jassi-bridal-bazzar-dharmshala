import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, FileText, GitBranch, Image, LayoutDashboard, Store, Package, ShoppingBag, Users, MessageCircle, Camera, ClipboardList, BarChart3, HeartPulse, Settings, Star, RotateCcw } from 'lucide-react';
import useAppPath from '../../hooks/useAppPath';
import { useAuth } from '../../context/AuthContext';
import '../admin/AdminShell.css';

const links = [
  ['Dashboard', '/seller'],
  ['Notifications', '/seller/notifications'],
  ['Onboarding', '/seller/onboarding'],
  ['Products', '/seller/products'],
  ['Variant Families', '/seller/variant-groups'],
  ['Inventory', '/seller/inventory'],
  ['Orders', '/seller/orders'],
  ['Rental setup & stock', '/seller/rentals'],
  ['Returns / Exchange', '/seller/returns'],
  ['Customers', '/seller/crm'],
  ['Offers', '/seller/offers'],
  ['Banners', '/seller/banners'],
  ['Campaigns', '/seller/campaigns'],
  ['Reviews', '/seller/reviews'],
  ['Inbox', '/seller/inbox'],
  ['Analytics', '/seller/analytics'],
  ['Reports', '/seller/reports'],
  ['Traffic & visitors', '/seller/traffic'],
  ['Business Center', '/seller/business'],
  ['Store settings', '/seller/settings'],
  ['Store Designer', '/seller/design'],
  ['Store content', '/seller/content'],
  ['Social studio', '/seller/social'],
  ['Audit log', '/seller/audit'],
];

const icons = {
  Dashboard: LayoutDashboard,
  Notifications: HeartPulse,
  Onboarding: Store,
  Products: Package,
  'Variant Families': GitBranch,
  Inventory: Package,
  Orders: ShoppingBag,
  'Rental setup & stock': ShoppingBag,
  'Returns / Exchange': RotateCcw,
  Customers: Users,
  Offers: HeartPulse,
  Banners: Image,
  Campaigns: BarChart3,
  Reviews: Star,
  Inbox: MessageCircle,
  Analytics: BarChart3,
  Reports: BarChart3,
  'Traffic & visitors': BarChart3,
  'Business Center': HeartPulse,
  'Store settings': Settings,
  'Store Designer': LayoutDashboard,
  'Store content': FileText,
  'Social studio': Camera,
  'Audit log': ClipboardList,
};
const LINK_FEATURES = {
  '/seller/crm': 'crm',
  '/seller/analytics': 'analytics',
  '/seller/reports': 'analytics',
  '/seller/traffic': 'analytics',
  '/seller/campaigns': 'festival',
  '/seller/design': 'advancedCustomization',
  '/seller/social': 'socialStudio',
};
const LINK_PERMISSIONS = { '/seller/content': 'content.read', '/seller/traffic': 'reports.read', '/seller/rentals': 'orders.read' };

export default function SellerLayout({ children }) {
  const path = useAppPath();
  const { user } = useAuth();
  const linkedStoreId = new URLSearchParams(window.location.search).get('storeId');
  const stores = useMemo(() => (user?.stores || []).filter((item) => item?.id && item?.status !== 'SUSPENDED'), [user]);
  const [storeId, setStoreId] = useState(() => {
    const linked = window.location.pathname.startsWith('/seller/') ? new URLSearchParams(window.location.search).get('storeId') : '';
    if (linked && stores.some(item => item.id === linked)) { sessionStorage.setItem('samira_seller_store_id', linked); return linked; }
    return sessionStorage.getItem('samira_seller_store_id') || '';
  });

  useEffect(() => {
    if (!stores.length) return;
    const selected = stores.some(item => item.id === linkedStoreId) ? linkedStoreId : stores.some(item => item.id === storeId) ? storeId : stores[0].id;
    if (selected !== storeId) setStoreId(selected);
    sessionStorage.setItem('samira_seller_store_id', selected);
  }, [storeId, stores, path, linkedStoreId]);

  const chooseStore = (nextId) => {
    if (!stores.some((item) => item.id === nextId) || nextId === storeId) return;
    sessionStorage.setItem('samira_seller_store_id', nextId);
    const nextUrl = new URL(window.location.href);
    if (nextUrl.searchParams.has('storeId')) nextUrl.searchParams.set('storeId', nextId);
    if (nextUrl.pathname === '/seller/orders') nextUrl.searchParams.delete('booking');
    if (nextUrl.pathname === '/seller/rentals') ['id', 'listing', 'productId'].forEach(key => nextUrl.searchParams.delete(key));
    window.history.replaceState(null, '', nextUrl.pathname + nextUrl.search + nextUrl.hash);
    setStoreId(nextId);
    window.location.reload();
  };

  const activeStore = stores.find((item) => item.id === storeId) || stores[0];
  const activeFeatures = activeStore?.platform?.features;
  const enabledFeatures = useMemo(() => new Set(activeFeatures || []), [activeFeatures]);
  const licenceRestricted = ['EXPIRED', 'SUSPENDED'].includes(activeStore?.platform?.status);

  const granted = useMemo(() => new Set(activeStore?.permissions || (['OWNER', 'MANAGER'].includes(activeStore?.role) ? ['*'] : [])), [activeStore]);
  const items = useMemo(() => links.filter(([, itemPath]) => (!LINK_FEATURES[itemPath] || (!licenceRestricted && enabledFeatures.has(LINK_FEATURES[itemPath]))) && (!LINK_PERMISSIONS[itemPath] || granted.has('*') || granted.has(LINK_PERMISSIONS[itemPath]))).map(([label, itemPath]) => ({
    label,
    path: itemPath,
    active: itemPath === '/seller' ? path === '/seller' || path === '/seller/' : path === itemPath || path.startsWith(`${itemPath}/`),
    Icon: icons[label] || Store,
  })), [enabledFeatures, granted, licenceRestricted, path]);

  return (
    <div className="admin-shell min-h-screen bg-[#f7f2eb] lg:pl-[260px]">
      <aside className="fixed inset-y-0 left-0 hidden w-[260px] overflow-y-auto bg-[#171018] p-4 text-white lg:block">
        <p className="font-display text-2xl font-black">Boutique</p>
        <p className="mt-1 text-[10px] font-black uppercase tracking-[0.28em] text-white/50">Seller workspace</p>
        {stores.length > 0 && <label className="mt-5 grid gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/60">Active store<select aria-label="Active seller store" value={storeId || stores[0].id} onChange={(event) => chooseStore(event.target.value)} className="h-11 rounded-xl border border-white/15 bg-white/10 px-3 text-sm font-bold normal-case tracking-normal text-white outline-none">{stores.map((item) => <option key={item.id} value={item.id} className="text-slate-900">{item.name} · {item.role}</option>)}</select></label>}
        <nav className="mt-6 grid gap-1.5">
          {items.map((item) => (
            <a key={item.path} href={item.path === '/seller/rentals' ? item.path + '?tab=setup' : item.path} className={`flex items-center justify-between rounded-2xl px-3 py-2.5 text-sm font-bold ${item.active ? 'bg-[#8a3d59]' : 'text-white/75 hover:bg-white/10'}`}>
              <span className="flex items-center gap-3">
                <item.Icon className="h-4 w-4" />
                {item.label}
              </span>
              <ChevronRight className="h-3.5 w-3.5 opacity-60" />
            </a>
          ))}
        </nav>
      </aside>
      {stores.length > 1 && <div className="border-b border-[#e8dcd4] bg-white px-4 pt-3 lg:hidden"><select aria-label="Active seller store" value={storeId || stores[0].id} onChange={(event) => chooseStore(event.target.value)} className="h-10 w-full rounded-xl border border-[#e8dcd4] bg-[#fbf8f4] px-3 text-sm font-bold">{stores.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.role}</option>)}</select></div>}
      <nav className="flex gap-2 overflow-x-auto border-b border-[#e8dcd4] bg-white px-4 py-3 lg:hidden" aria-label="Seller workspace navigation">
        {items.map(item => <a key={item.path} href={item.path === '/seller/rentals' ? item.path + '?tab=setup' : item.path} aria-current={item.active ? 'page' : undefined} className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold ${item.active ? 'bg-wine text-white' : 'text-[#75656f]'}`}><item.Icon size={15} />{item.label}</a>)}
      </nav>
      <div className="p-4 lg:p-8">{licenceRestricted && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><div><strong>{activeStore.platform.name} subscription {activeStore.platform.status.toLowerCase()}</strong><p className="mt-1 text-xs">{activeStore.platform.renewalMessage || 'Your data is safe. Renew to create products, accept orders and make changes.'}</p></div></div>}{children}</div>
    </div>
  );
}
