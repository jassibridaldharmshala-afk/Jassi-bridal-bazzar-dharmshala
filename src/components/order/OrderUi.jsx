import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, Package, X } from 'lucide-react';
import AccountSidebar from '../layout/AccountSidebar';
import { useAuth } from '../../context/AuthContext';
import { normalizeImageUrl } from '../../services/normalize';
import { money, statusTone } from '../../utils/orderPresentation';
import '../../pages/customer/Profile.css';
import '../../pages/customer/Orders.css';

export function OrderShell({ title, detail = false, breadcrumb = 'Order details', navigate, children }) {
  const { user, logout } = useAuth();
  return <section className="sc-orders"><div className="sc-orders__shell">
    <nav className="sc-orders__breadcrumb" aria-label="Breadcrumb">
      <button onClick={() => navigate('/')}>Home</button><ChevronRight size={13} />
      <button onClick={() => navigate('/profile')}>My Account</button><ChevronRight size={13} />
      {detail ? <><button onClick={() => navigate('/orders')}>My Orders</button><ChevronRight size={13} /><span>{breadcrumb}</span></> : <span>My Orders</span>}
    </nav>
    <div className="sc-orders__layout">
      <AccountSidebar user={user} logout={logout} navigate={navigate} activePath="/orders" />
      <div className="sc-orders__main">
        <header className="sc-orders__heading"><button className="sc-orders__back" aria-label={detail ? 'Back to orders' : 'Back to account'} onClick={() => navigate(detail ? '/orders' : '/profile')}><ArrowLeft size={21} /></button>
          <div><h1>{title}</h1></div>
          <button className="sc-orders__text" onClick={() => navigate('/returns')}>Returns & exchanges</button>
        </header>{children}
      </div>
    </div>
  </div></section>;
}
export function OrderState({ error, loading, title, children, retry }) {
  return <div className="sc-orders__state" role={error ? 'alert' : loading ? 'status' : undefined}>
    <Package size={36} strokeWidth={1.4} /><h2>{loading ? 'Loading your orders…' : title}</h2>
    {error && <p>{error}</p>}{children}{retry && <button className="sc-orders__button" onClick={retry}>Try again</button>}
  </div>;
}
export function StatusBadge({ status }) { return <span className={`sc-order-status sc-order-status--${statusTone(status)}`}><span />{status || 'Status unavailable'}</span>; }
export function OrderItem({ item, children, onOpen }) {
  const [failed, setFailed] = useState(false);
  const src = normalizeImageUrl(typeof item.image === 'string' ? item.image : item.image?.url || '');
  const name = item.name || item.productName || 'Ordered product';
  const cancelled = Math.max(0, Number(item.cancelledQuantity || 0));
  const active = Math.max(0, Number(item.quantity ?? 1) - cancelled);
  return <div className="sc-order-item">
    <div className="sc-order-item__image">{src && !failed ? <img src={src} alt={name} loading="lazy" onError={() => setFailed(true)} /> : <Package size={25} aria-label="Product image unavailable" />}</div>
    <div className="sc-order-item__body">{onOpen ? <button className="sc-order-item__name" onClick={onOpen}>{name}</button> : <h3>{name}</h3>}
      <p className="sc-order-item__variant">{[item.size && `Size: ${item.size}`, item.color && `Colour: ${item.color}`, `Qty: ${item.quantity ?? 1}`].filter(Boolean).join(' · ')}</p>
      {cancelled > 0 && <p className="sc-orders__muted">{cancelled} cancelled{active > 0 ? ` · ${active} active` : ' · item fully cancelled'}</p>}
      {item.price !== undefined && <p className="sc-order-item__price">{money(Number(item.price) * active)}{Number(item.originalPrice) > Number(item.price) && active > 0 && <del>{money(Number(item.originalPrice) * active)}</del>}</p>}
      {children}
    </div>
  </div>;
}
export function OrderModal({ title, onClose, busy, children, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current;
    const focus = document.activeElement;
    const overflow = document.body.style.overflow;
    node.showModal(); document.body.style.overflow = 'hidden';
    return () => { node.close(); document.body.style.overflow = overflow; focus?.focus(); };
  }, []);
  return <dialog ref={ref} className={`sc-order-modal ${className}`} aria-label={title} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <header><h2>{title}</h2><button disabled={busy} aria-label="Close dialog" onClick={onClose}><X size={22} /></button></header>{children}
  </dialog>;
}
