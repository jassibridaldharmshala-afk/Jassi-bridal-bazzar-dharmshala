import {
  ArrowRight,
  CheckCircle2,
  LockKeyhole,
  ShieldCheck,
  ShieldX,
  Store,
} from 'lucide-react';
import AdminLayout from '../admin/AdminLayout';
import '../admin/AdminShell.css';
import logo from '../../assets/generated-brand-logo.svg';
import { useAuth } from '../../context/AuthContext';
import { useBrandIdentity } from '../../context/BrandIdentityContext';
import { normalizeImageUrl } from '../../services/normalize';
import StoreLogo from '../ui/StoreLogo';

export default function AdminRoute({ children }) {
  const { user, switchMode } = useAuth();
  const returnTo = currentAdminLocation();
  const area = adminAreaLabel(returnTo);

  if (!user) {
    return (
      <AdminGate
        icon={<LockKeyhole aria-hidden="true" />}
        eyebrow="Admin mobile verification"
        title="Verify your admin number"
        note={`Continue with mobile OTP. Only a number registered with the admin role can open ${area}.`}
        action={(
          <a
            href={`/login?redirect=${encodeURIComponent(returnTo)}`}
            className="admin-gate__primary"
          >
            Continue with mobile OTP
            <ArrowRight aria-hidden="true" />
          </a>
        )}
      />
    );
  }

  if (user.role === 'admin' && user.activeMode !== 'admin') {
    return (
      <AdminGate
        icon={<ShieldCheck aria-hidden="true" />}
        eyebrow="Admin account recognised"
        title="Switch to admin mode"
        note={`You are signed in as an administrator but currently using customer mode. Switch modes to continue to ${area}.`}
        action={(
          <button
            type="button"
            onClick={() => switchMode('admin', returnTo)}
            className="admin-gate__primary"
          >
            Switch to admin mode
            <ArrowRight aria-hidden="true" />
          </button>
        )}
      />
    );
  }

  if (user.role !== 'admin') {
    return (
      <AdminGate
        icon={<ShieldX aria-hidden="true" />}
        eyebrow="Permission required"
        title="Admin access unavailable"
        note="This account does not have permission to access the store admin workspace."
        action={(
          <a href="/" className="admin-gate__primary">
            Return to storefront
            <Store aria-hidden="true" />
          </a>
        )}
      />
    );
  }

  return <AdminLayout>{children}</AdminLayout>;
}

function AdminGate({ icon, eyebrow, title, note, action }) {
  const brand = useBrandIdentity();
  return (
    <main className="admin-shell admin-gate">
      <header className="admin-gate__topbar">
        <a href="/" className="admin-gate__brand" aria-label={brand.websiteName + ' storefront'}>
          <StoreLogo src={normalizeImageUrl(brand.logo) || logo} name={brand.websiteName} />
          <span>
            <strong>{brand.websiteName}</strong>
            <small>Administration</small>
          </span>
        </a>

        <a href="/" className="admin-gate__store-link">
          <Store aria-hidden="true" />
          Storefront
        </a>
      </header>

      <section className="admin-gate__panel" aria-labelledby="admin-gate-title">
        <div className="admin-gate__context" aria-hidden="true">
          <p className="admin-gate__context-kicker">{brand.websiteName} ADMIN</p>
          <h2>One secure workspace for your complete store.</h2>
          <p>
            Manage your catalogue and daily operations from a focused, protected dashboard.
          </p>
          <ul>
            <li>
              <CheckCircle2 />
              Products, inventory and product drafts
            </li>
            <li>
              <CheckCircle2 />
              Orders, customers, coupons and returns
            </li>
            <li>
              <CheckCircle2 />
              Reel imports with live processing status
            </li>
          </ul>
          <div className="admin-gate__context-mark">SC</div>
        </div>

        <div className="admin-gate__access">
          <div className="admin-gate__icon">{icon}</div>
          <p className="admin-gate__eyebrow">{eyebrow}</p>
          <h1 id="admin-gate-title">{title}</h1>
          <p className="admin-gate__note">{note}</p>
          <div className="admin-gate__actions">{action}</div>
          <div className="admin-gate__security">
            <ShieldCheck aria-hidden="true" />
            Admin role is checked after OTP verification · Your destination is preserved
          </div>
        </div>
      </section>
    </main>
  );
}

function currentAdminLocation() {
  if (typeof window === 'undefined') return '/admin';

  const target = `${window.location.pathname || '/admin'}${window.location.search || ''}`;
  if (
    (!target.startsWith('/admin') && !target.startsWith('/master'))
    || target.startsWith('//')
    || target.startsWith('/admin/login')
  ) {
    return '/admin';
  }
  return target;
}

function adminAreaLabel(target = '') {
  if (target.includes('/admin/reel-import')) return 'Reel Product Import';
  if (target.includes('/admin/products')) return 'Products';
  if (target.includes('/admin/orders')) return 'Orders';
  if (target.includes('/admin/customers')) return 'Customers';
  if (target.includes('/admin/coupons')) return 'Coupons';
  if (target.includes('/admin/returns')) return 'Returns';
  return 'the Admin Dashboard';
}
