import { useAuth } from '../../context/AuthContext';
import SellerLayout from '../seller/SellerLayout';
import { currentPath } from '../../utils/routing';

export default function SellerRoute({ children }) {
  const { user, switchMode } = useAuth();
  const destination = currentPath().startsWith('/seller') ? currentPath() : '/seller';
  if (!user) {
    return (
      <section className="grid min-h-screen place-items-center bg-[color:var(--site-accent-soft)] px-4">
        <div className="max-w-md rounded-xl bg-[color:var(--site-surface)] p-8 text-center shadow-xl">
          <h1 className="text-2xl font-black">Seller login required</h1>
          <p className="mt-3 text-sm text-[color:var(--site-muted)]">Sign in to open your boutique dashboard.</p>
          <a href={`/login?redirect=${encodeURIComponent(destination)}`} className="mt-6 inline-flex rounded-full bg-wine px-6 py-3 text-sm font-black text-[color:var(--site-on-fill)]">Login</a>
        </div>
      </section>
    );
  }

  const canSell = user.availableModes?.includes('seller') || (user.stores || []).length > 0;
  if (!canSell) {
    return (
      <section className="grid min-h-screen place-items-center bg-[color:var(--site-accent-soft)] px-4">
        <div className="max-w-md rounded-xl bg-[color:var(--site-surface)] p-8 text-center shadow-xl">
          <h1 className="text-2xl font-black">Seller access required</h1>
          <p className="mt-3 text-sm text-[color:var(--site-muted)]">Ask the store owner to grant access to your seller workspace.</p>
          <a href="/contact" className="mt-6 inline-flex rounded-full bg-wine px-6 py-3 text-sm font-black text-[color:var(--site-on-fill)]">Contact support</a>
        </div>
      </section>
    );
  }

  if (user.activeMode !== 'seller') {
    return (
      <section className="grid min-h-screen place-items-center bg-[color:var(--site-accent-soft)] px-4">
        <div className="max-w-md rounded-xl bg-[color:var(--site-surface)] p-8 text-center shadow-xl">
          <h1 className="text-2xl font-black">Switch to Seller Mode</h1>
          <p className="mt-3 text-sm text-[color:var(--site-muted)]">Your boutique tools stay separate from shopping.</p>
          <button type="button" onClick={() => switchMode('seller', destination)} className="mt-6 rounded-full bg-wine px-6 py-3 text-sm font-black text-[color:var(--site-on-fill)]">Switch to Seller</button>
        </div>
      </section>
    );
  }

  return <SellerLayout>{children}</SellerLayout>;
}
