export function notificationDestination(item, user) {
  const metadata = item.metadata || {};
  const admin = item.audience === 'ADMIN';
  const rentalStoreQuery = metadata.storeId || item.storeId ? '&storeId=' + encodeURIComponent(metadata.storeId || item.storeId) : '';
  const socialQuery = () => {
    const query = new URLSearchParams();
    const storeId = metadata.storeId || item.storeId;
    if (storeId) query.set('storeId', storeId);
    if (metadata.socialThreadId) query.set('thread', metadata.socialThreadId);
    return query.toString() ? `?${query}` : '';
  };
  if (admin && user?.activeMode === 'seller') {
    if (metadata.rentalTaskId) return '/seller/rentals?tab=studio' + rentalStoreQuery;
    if (metadata.rentalBookingId) return `/seller/rentals?id=${encodeURIComponent(metadata.rentalBookingId)}` + rentalStoreQuery;
    if (metadata.socialThreadId || metadata.socialAccountId || metadata.socialPostId) return `/seller/social${socialQuery()}`;
    if (metadata.contactId) return '/seller/inbox';
    if (metadata.orderId || metadata.returnId) return '/seller/orders';
    return '/seller/notifications';
  }
  if (admin && user?.role !== 'admin') return '';
  if (admin) {
    if (metadata.rentalTaskId) return '/admin/rentals?tab=studio' + rentalStoreQuery;
    if (metadata.rentalBookingId) return `/admin/rentals?id=${encodeURIComponent(metadata.rentalBookingId)}` + rentalStoreQuery;
    if (metadata.socialThreadId || metadata.socialAccountId || metadata.socialPostId) return `/admin/social${socialQuery()}`;
    if (metadata.returnId) return `/admin/returns?search=${encodeURIComponent(metadata.returnId)}`;
    if (metadata.contactId) return `/admin/support?search=${encodeURIComponent(metadata.contactId)}`;
    if (metadata.orderId) return `/admin/orders/detail?id=${encodeURIComponent(metadata.orderId)}`;
    return '/admin/notifications';
  }
  if (metadata.orderId) return `/order-detail?id=${encodeURIComponent(metadata.orderId)}`;
  if (metadata.rentalWaitlistId) return (metadata.storeSlug ? '/store/' + encodeURIComponent(metadata.storeSlug) : '') + '/rental-book?waitlist=' + encodeURIComponent(metadata.rentalWaitlistId);
  if (metadata.rentalBookingId) return (metadata.storeSlug ? '/store/' + encodeURIComponent(metadata.storeSlug) : '') + `/rentals?id=${encodeURIComponent(metadata.rentalBookingId)}`;
  if (metadata.returnId) return '/returns';
  return '';
}
export function notificationCategory(item) {
  const event = item.event || '';
  if (/^(RETURN_|EXCHANGE_)/.test(event)) return 'returns';
  if (/^(PAYMENT_|REFUND_)/.test(event)) return 'payments';
  if (/^ORDER_/.test(event) || item.metadata?.orderId) return 'orders';
  if (/^CONTACT_/.test(event)) return 'support';
  if (/^SOCIAL_/.test(event)) return 'social';
  return 'updates';
}
export function notificationDate(value) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return '';
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}
