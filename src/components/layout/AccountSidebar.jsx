import { Bell, CreditCard, Heart, HelpCircle, LayoutDashboard, LogOut, MapPin, Package, TicketPercent, UserRound } from 'lucide-react';

const links = [
  ['Dashboard', LayoutDashboard, '/profile'],
  ['Orders', Package, '/orders'],
  ['My rentals', Package, '/rentals'],
  ['Notifications', Bell, '/notifications'],
  ['Wishlist', Heart, '/wishlist'],
  ['Addresses', MapPin, '/profile/addresses'],
  ['Coupons', TicketPercent, '/products?discount=20'],
  ['Payments', CreditCard, '/checkout'],
  ['Profile Details', UserRound, '/profile/details'],
  ['Help & Support', HelpCircle, '/contact'],
];

export default function AccountSidebar({ user, navigate, logout, activePath = '/profile' }) {
  const name = user?.name || user?.fullName || user?.email || user?.phone || 'My Account';
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  return (
    <aside className="sc-account__sidebar">
      <div className="sc-account__profile-card">
        <div className="sc-account__avatar" aria-hidden="true">{initials}</div>
        <h2>{name}</h2>
        <p>{user?.phone || user?.email || 'Jassi member'}</p>
        <button type="button" onClick={() => navigate('/profile/details')}>Edit Profile</button>
      </div>
      <nav className="sc-account__menu" aria-label="Account sections">
        {links.map(([label, Icon, path]) => (
          <button key={path} type="button" className={path === activePath ? 'is-active' : ''}
            aria-current={path === activePath ? 'page' : undefined} onClick={() => navigate(path)}>
            <Icon size={17} aria-hidden="true" />{label}
          </button>
        ))}
        <button type="button" onClick={logout}><LogOut size={17} aria-hidden="true" />Logout</button>
      </nav>
    </aside>
  );
}
