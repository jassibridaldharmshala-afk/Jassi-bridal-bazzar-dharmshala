export default function AdminOrderTabs({ route = '', mode = 'sale' }) {
  const base = route.startsWith('/seller') ? '/seller/orders' : '/admin/orders';
  const scope = new URLSearchParams(route.split('?')[1] || '').get('storeId');
  const href = type => base + '?' + new URLSearchParams({ type, ...(scope ? { storeId: scope } : {}) });
  return <nav className="admin-order-type-tabs" aria-label="Order type">
    <a href={href('sale')} aria-current={mode === 'sale' ? 'page' : undefined}>Sale orders</a>
    <a href={href('rental')} aria-current={mode === 'rental' ? 'page' : undefined}>Rental bookings</a>
  </nav>;
}
