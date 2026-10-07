import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { pushAppRoute } from '../../utils/routing';
import Icon from '../layout/Icon';
import { Search } from 'lucide-react';
import NotificationBell from '../notifications/NotificationBell';
import { adminTitleFromPath } from './AdminSidebar';
import useAppPath from '../../hooks/useAppPath';
import { useBrandIdentity } from '../../context/BrandIdentityContext';

export default function AdminHeader({ onOpenSidebar }) {
  const brand = useBrandIdentity();
  const { logout, user, switchMode } = useAuth();
  const path = useAppPath();
  const title = adminTitleFromPath(path);
  const [search, setSearch] = useState('');
  const initials = String(user?.name || 'A')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  const submitSearch = (event) => {
    event.preventDefault();
    const term = search.trim();
    pushAppRoute(term ? `/admin/products?search=${encodeURIComponent(term)}` : '/admin/products');
  };

  return (
    <header className="admin-header sticky top-0 z-40">
      <div className="admin-header__strip">
        <span>{brand.websiteName} · Admin</span>
        <span className="admin-header__strip-note">Free shipping, returns and live catalog stay in sync</span>
      </div>

      <div className="admin-header__row admin-header__row--mobile">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="admin-header__icon-btn"
          aria-label="Open admin menu"
        >
          <Icon name="menu" />
        </button>
        <div className="admin-header__identity">
          <p className="admin-header__title">{title}</p>
        </div>
        <NotificationBell navigate={pushAppRoute} admin />
        <button type="button" onClick={logout} className="admin-btn admin-header__logout">
          Logout
        </button>
      </div>

      <div className="admin-header__row admin-header__row--desktop">
        <div className="admin-header__identity">
          <p className="admin-header__title">{title}</p>
          <p className="admin-header__subtitle">Welcome back, {user?.name?.split(' ')?.[0] || 'Admin'}</p>
        </div>
        <form className="admin-header__search" onSubmit={submitSearch} role="search">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full bg-transparent text-sm text-charcoal outline-none placeholder:text-slate-400" placeholder="Search products..." aria-label="Search admin products" />
        </form>
        <div className="admin-header__actions">
          <NotificationBell navigate={pushAppRoute} admin />
          <div className="admin-header__user">
            <div className="admin-header__avatar">{initials || 'A'}</div>
            <div className="leading-tight">
              <p className="text-[13px] font-semibold text-charcoal">{user?.name || 'Admin'}</p>
              <p className="text-[11px] text-slate-500">{user?.systemRole === 'MASTER_OWNER' ? 'Master Owner' : 'Store Admin'}</p>
            </div>
          </div>
          <button type="button" onClick={() => switchMode('customer')} className="admin-btn-ghost">
            Storefront
          </button>
          <button type="button" onClick={logout} className="admin-btn">
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
