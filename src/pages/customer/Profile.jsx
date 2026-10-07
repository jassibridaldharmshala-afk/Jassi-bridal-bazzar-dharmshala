import { useMemo } from 'react';
import {
  BadgeCheck,
  Building2,
  ChevronRight,
  FileText,
  Gift,
  Headphones,
  Heart,
  HelpCircle,
  Home,
  Mail,
  Bell,
  MapPin,
  MoreVertical,
  Package,
  Phone,
  Plus,
  RefreshCcw,
  ShieldCheck,
  ShoppingBag,
  TicketPercent,
  Truck,
  UserRound,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useWishlist } from '../../context/WishlistContext';
import { normalizeImageUrl } from '../../services/normalize';
import { useGetAddressesQuery, useGetCouponsQuery, useGetOrdersQuery } from '../../store/apiSlice';
import AccountSidebar from '../../components/layout/AccountSidebar';
import './Profile.css';

const accountLinks = [
  { title: 'Notifications', subtitle: 'Order, delivery and return updates', icon: Bell, action: '/notifications' },
  { title: 'Orders', subtitle: 'Check your order status', icon: Package, action: '/orders' },
  { title: 'Collections & Wishlist', subtitle: 'All your curated product collections', icon: Heart, action: '/wishlist' },
  { title: 'Addresses', subtitle: 'Save addresses for a hassle-free checkout', icon: MapPin, action: '/profile/addresses' },
  { title: 'Coupons', subtitle: 'Manage coupons for additional discounts', icon: ShieldCheck, action: '/products?discount=20' },
  { title: 'Profile Details', subtitle: 'Change your profile details', icon: FileText, action: '/profile/details' },
];

const footerLinks = [
  { label: 'FAQs', path: '/faqs' },
  { label: 'ABOUT US', path: '/our-story' },
  { label: 'TERMS OF USE', path: '/terms' },
  { label: 'CUSTOMER POLICIES', path: '/return-policy' },
  { label: 'USEFUL LINKS', path: '/contact' },
];

const serviceItems = [
  { title: '100% Authentic', text: 'Genuine products, always', icon: BadgeCheck },
  { title: 'Free Shipping', text: 'On orders above ₹999', icon: Truck },
  { title: 'Easy Returns', text: 'Hassle-free returns', icon: RefreshCcw },
  { title: 'Secure Payments', text: '100% safe & secure', icon: ShieldCheck },
  { title: 'Exclusive Offers', text: 'For Samaira members', icon: Gift },
];

export default function Profile({ navigate }) {
  const { user, logout, switchMode } = useAuth();
  const wishlist = useWishlist();
  const { data: ordersData = [], isLoading: ordersLoading } = useGetOrdersQuery(undefined, { skip: !user });
  const { data: addressesData = [] } = useGetAddressesQuery(undefined, { skip: !user });
  const { data: couponsData = [] } = useGetCouponsQuery(undefined, { skip: !user });

  const displayName = useMemo(() => user?.name || user?.fullName || user?.email || user?.phone || 'Account', [user]);
  const orders = Array.isArray(ordersData) ? ordersData : [];
  const addresses = Array.isArray(addressesData) ? addressesData : [];
  const coupons = Array.isArray(couponsData) ? couponsData : [];
  const recentOrders = orders.slice(0, 3);
  const savedAddresses = [...addresses].sort((a, b) => Number(!!b.isDefault) - Number(!!a.isDefault)).slice(0, 2);

  return (
    <>
      <DesktopAccountDashboard
        navigate={navigate}
        user={user}
        displayName={displayName}
        orders={orders}
        recentOrders={recentOrders}
        ordersLoading={ordersLoading}
        wishlistCount={wishlist.items.length}
        addresses={addresses}
        savedAddresses={savedAddresses}
        coupons={coupons}
        logout={logout}
      />
      <MobileAccountView
        navigate={navigate}
        user={user}
        logout={logout}
        switchMode={switchMode}
        displayName={displayName}
      />
    </>
  );
}

function DesktopAccountDashboard({
  navigate,
  user,
  displayName,
  orders,
  recentOrders,
  ordersLoading,
  wishlistCount,
  addresses,
  savedAddresses,
  coupons,
  logout,
}) {
  return (
    <section className="sc-account">
      <div className="sc-account__shell">
        <nav className="sc-account__breadcrumb" aria-label="Breadcrumb">
          <button type="button" onClick={() => navigate('/')}>Home</button>
          <ChevronRight size={13} aria-hidden="true" />
          <span>My Account</span>
        </nav>

        <div className="sc-account__layout">
          <AccountSidebar user={user} navigate={navigate} logout={logout} />

          <main className="sc-account__main">
            <header className="sc-account__hero">
              <h1>My Account</h1>
              <p>Welcome back, {displayName.split(' ')[0] || 'there'}! Here&apos;s what&apos;s happening with your account.</p>
            </header>

            <div className="sc-account__stats">
              <StatCard icon={ShoppingBag} label="Orders" value={orders.length} cta="View all orders" onClick={() => navigate('/orders')} />
              <StatCard icon={Heart} label="Wishlist" value={wishlistCount} cta="View wishlist" onClick={() => navigate('/wishlist')} />
              <StatCard icon={MapPin} label="Saved Addresses" value={addresses.length} cta="Manage addresses" onClick={() => navigate('/profile/addresses')} />
              <StatCard icon={TicketPercent} label="Coupons & Rewards" value={coupons.length} cta="View all coupons" onClick={() => navigate('/products?discount=20')} accent="gold" />
            </div>

            <div className="sc-account__grid">
              <section className="sc-account__panel sc-account__orders">
                <PanelHead title="Recent Orders" action="View all orders" onClick={() => navigate('/orders')} />
                {ordersLoading ? (
                  <p className="sc-account__empty">Loading your recent orders...</p>
                ) : recentOrders.length ? (
                  <div className="sc-account__order-list">
                    {recentOrders.map((order) => <OrderRow key={order._id || order.id} order={order} navigate={navigate} />)}
                  </div>
                ) : (
                  <EmptyState label="No orders yet." action="Start shopping" onClick={() => navigate('/products')} />
                )}
              </section>

              <section className="sc-account__panel">
                <PanelHead title="Saved Addresses" action="Manage all" onClick={() => navigate('/profile/addresses')} />
                {savedAddresses.length ? (
                  <div className="sc-account__address-list">
                    {savedAddresses.map((address) => <AddressPreview key={address._id || address.id} address={address} />)}
                  </div>
                ) : (
                  <EmptyState label="No saved addresses yet." action="Add address" onClick={() => navigate('/profile/addresses/new')} />
                )}
                <button type="button" className="sc-account__add-address" onClick={() => navigate('/profile/addresses/new')}>
                  Add New Address
                  <Plus size={14} aria-hidden="true" />
                </button>
              </section>
            </div>

            <div className="sc-account__bottom-grid">
              <section className="sc-account__panel">
                <PanelHead title="Profile Details" action="Edit Profile" onClick={() => navigate('/profile/details')} />
                <div className="sc-account__profile-details">
                  <ProfileMini icon={UserRound} label="Name" value={displayName} />
                  <ProfileMini icon={Phone} label="Mobile Number" value={user?.phone || 'Not added'} />
                  <ProfileMini icon={Mail} label="Email Address" value={user?.email || 'Not added'} />
                </div>
              </section>

              <section className="sc-account__panel sc-account__support">
                <div>
                  <h2>Help &amp; Support</h2>
                  <SupportLink label="Frequently Asked Questions" onClick={() => navigate('/faqs')} />
                  <SupportLink label="Track an Order" onClick={() => navigate('/orders')} />
                  <SupportLink label="Returns & Refunds" onClick={() => navigate('/return-policy')} />
                  <SupportLink label="Contact Us" onClick={() => navigate('/contact')} />
                </div>
                <div className="sc-account__help-card">
                  <Headphones size={42} aria-hidden="true" />
                  <strong>We&apos;re here to help!</strong>
                  <p>Our support team is available 7 days a week.</p>
                  <button type="button" onClick={() => navigate('/contact')}>Get in Touch</button>
                </div>
              </section>
            </div>

            <div className="sc-account__service-strip">
              {serviceItems.map(({ title, text, icon: Icon }) => (
                <div key={title}>
                  <Icon size={25} aria-hidden="true" />
                  <span>
                    <strong>{title}</strong>
                    <small>{text}</small>
                  </span>
                </div>
              ))}
            </div>
          </main>
        </div>
      </div>
    </section>
  );
}

function MobileAccountView({ navigate, user, logout, switchMode, displayName }) {
  return (
    <section className="sc-account-mobile min-h-screen bg-[#f6f7fb] pb-10 md:pb-8">
      <div className="mx-auto w-full max-w-[470px] bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.06)] md:max-w-none md:bg-transparent md:shadow-none">
        <div className="hidden md:block">
          <div className="container-page py-6">
            <h1 className="page-title">My Profile</h1>
          </div>
        </div>

        <div className="border-b border-slate-100 bg-white px-4 py-5">
          <div className="flex items-center gap-4">
            <div className="grid h-28 w-28 shrink-0 place-items-center overflow-hidden bg-[#f1f1f1]">
              {user?.avatar ? (
                <img src={user.avatar} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center bg-[#f1f1f1]">
                  <div className="h-14 w-14 rounded-full bg-[#d9d9d9]" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="small-text uppercase tracking-[0.18em] text-slate-400">Logged in as</p>
              <h1 className="mt-1 truncate text-[16px] font-bold text-[#2f3851] sm:text-[18px]">{displayName}</h1>
              <p className="mt-1 truncate text-[12px] text-slate-500 sm:text-[13px]">
                {user?.phone || user?.email || 'Manage your account and orders'}
              </p>
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-100 bg-white">
          {accountLinks.map((item) => (
            <button
              key={item.title}
              type="button"
              onClick={() => item.action && navigate?.(item.action)}
              className="flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-slate-50"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center text-slate-400">
                <item.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-[15px] font-bold leading-[1.15] text-[#182033]">{item.title}</h2>
                <p className="mt-1 text-[11px] leading-[1.35] text-slate-400 sm:text-[12px]">{item.subtitle}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
            </button>
          ))}
        </div>

        <div className="border-t-8 border-slate-100 bg-white px-4 py-4">
          <div className="grid gap-4">
            {footerLinks.map((item) => (
              <button key={item.label} type="button" onClick={() => navigate?.(item.path)} className="text-left text-[12px] font-bold uppercase tracking-[0.08em] text-slate-400">
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-100 bg-[#f8f2f2] p-4">
          <button
            type="button"
            onClick={logout}
            className="h-12 w-full rounded-lg bg-[#ff5b5b] text-[14px] font-bold text-white transition hover:bg-[#f24a4a]"
          >
            LOGOUT
          </button>
          {user?.role === 'admin' && user?.availableModes?.includes('admin') && user?.activeMode !== 'admin' && (
            <button
              type="button"
              onClick={() => switchMode('admin')}
              className="mt-3 h-11 w-full rounded-lg border border-wine bg-white text-[13px] font-bold text-wine"
            >
              Switch to Admin
            </button>
          )}
          <button
            type="button"
            onClick={() => (user?.availableModes?.includes('seller') ? switchMode('seller') : navigate('/seller/onboarding'))}
            className="mt-3 h-11 w-full rounded-lg border border-slate-200 bg-white text-[13px] font-bold text-charcoal"
          >
            {user?.availableModes?.includes('seller') ? 'Seller dashboard' : 'Open a boutique'}
          </button>
        </div>
      </div>
    </section>
  );
}

function StatCard({ icon: Icon, label, value, cta, onClick, accent = 'rose' }) {
  return (
    <button type="button" className={`sc-account__stat sc-account__stat--${accent}`} onClick={onClick}>
      <span className="sc-account__stat-icon"><Icon size={26} aria-hidden="true" /></span>
      <span>
        <small>{label}</small>
        <strong>{value}</strong>
        <em>{cta} <ChevronRight size={12} aria-hidden="true" /></em>
      </span>
    </button>
  );
}

function PanelHead({ title, action, onClick }) {
  return (
    <div className="sc-account__panel-head">
      <h2>{title}</h2>
      <button type="button" onClick={onClick}>{action} <ChevronRight size={12} aria-hidden="true" /></button>
    </div>
  );
}

function OrderRow({ order, navigate }) {
  const item = order.orderItems?.[0] || {};
  const image = item.image ? normalizeImageUrl(item.image) : '';
  const status = order.orderStatus || 'Processing';
  const meta = getStatusMeta(status);
  const orderId = order._id || order.id || '';

  return (
    <article className="sc-account__order">
      <div className="sc-account__order-product">
        <div className="sc-account__order-image">
          {image ? <img src={image} alt={item.name || 'Order item'} /> : <Package size={24} aria-hidden="true" />}
        </div>
        <div>
          <h3>{item.name || 'Samaira order'}</h3>
          <p>Order ID: #{String(orderId).slice(-8).toUpperCase()}</p>
          <small>Size: {item.size || order.size || '-'} <span>•</span> Qty: {item.quantity || 1}</small>
        </div>
      </div>
      <span className={`sc-account__status ${meta.className}`}>{meta.label}</span>
      <div className="sc-account__date">
        <small>{meta.dateLabel}</small>
        <strong>{formatDate(order.deliveredAt || order.expectedDelivery || order.updatedAt || order.createdAt)}</strong>
      </div>
      <button type="button" onClick={() => navigate(`/order-detail?id=${orderId}`)}>Track Order</button>
    </article>
  );
}

function AddressPreview({ address }) {
  const Icon = String(address.addressType || '').toLowerCase().includes('work') ? Building2 : Home;
  const lines = buildAddressLines(address);

  return (
    <article className="sc-account__address">
      <span className="sc-account__address-icon"><Icon size={19} aria-hidden="true" /></span>
      <div>
        <div className="sc-account__address-top">
          <span>{address.addressType || 'Home'}{address.isDefault ? ' (Default)' : ''}</span>
          <MoreVertical size={16} aria-hidden="true" />
        </div>
        <strong>{address.fullName || address.name || 'Samaira Customer'}</strong>
        {lines.map((line) => <p key={line}>{line}</p>)}
        <p>Phone: {address.mobile || address.phone || '-'}</p>
      </div>
    </article>
  );
}

function ProfileMini({ icon: Icon, label, value }) {
  return (
    <div className="sc-account__profile-mini">
      <Icon size={20} aria-hidden="true" />
      <span>
        <small>{label}</small>
        <strong>{value}</strong>
      </span>
    </div>
  );
}

function SupportLink({ label, onClick }) {
  return (
    <button type="button" className="sc-account__support-link" onClick={onClick}>
      <HelpCircle size={14} aria-hidden="true" />
      <span>{label}</span>
      <ChevronRight size={13} aria-hidden="true" />
    </button>
  );
}

function EmptyState({ label, action, onClick }) {
  return (
    <div className="sc-account__empty">
      <p>{label}</p>
      <button type="button" onClick={onClick}>{action}</button>
    </div>
  );
}

function getStatusMeta(status = '') {
  const key = String(status).toLowerCase();
  if (key.includes('deliver')) return { label: 'Delivered', className: 'is-delivered', dateLabel: 'Delivered on' };
  if (key.includes('ship')) return { label: 'Shipped', className: 'is-shipped', dateLabel: 'Expected by' };
  if (key.includes('cancel')) return { label: 'Cancelled', className: 'is-cancelled', dateLabel: 'Updated on' };
  return { label: status || 'Processing', className: 'is-processing', dateLabel: 'Expected by' };
}

function formatDate(value) {
  if (!value) return 'Soon';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Soon';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function buildAddressLines(address = {}) {
  const first = [address.houseNo || address.houseNumber, address.area, address.landmark].filter(Boolean).join(', ');
  const second = [address.city, address.state, address.pincode].filter(Boolean).join(' - ');
  return [first, second].filter(Boolean);
}
