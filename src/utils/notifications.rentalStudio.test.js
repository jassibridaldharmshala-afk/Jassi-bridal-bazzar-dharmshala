import { notificationDestination } from './notifications';
test('studio notification links land in the scoped rental workflows', () => {
  expect(notificationDestination({ audience: 'ADMIN', metadata: { rentalTaskId: 'task1' } }, { role: 'admin' })).toBe('/admin/rentals?tab=studio');
  expect(notificationDestination({ audience: 'ADMIN', metadata: { rentalTaskId: 'task1' } }, { activeMode: 'seller' })).toBe('/seller/rentals?tab=studio');
  expect(notificationDestination({ audience: 'CUSTOMER', metadata: { rentalWaitlistId: 'wait1' } }, { role: 'customer' })).toBe('/rental-book?waitlist=wait1');
  expect(notificationDestination({ audience: 'ADMIN', storeId: 'store2', metadata: { rentalTaskId: 'task1' } }, { activeMode: 'seller' })).toBe('/seller/rentals?tab=studio&storeId=store2');
  expect(notificationDestination({ audience: 'CUSTOMER', metadata: { rentalWaitlistId: 'wait1', storeSlug: 'occasion-boutique' } }, { role: 'customer' })).toBe('/store/occasion-boutique/rental-book?waitlist=wait1');
  expect(notificationDestination({ audience: 'ADMIN', storeId: 'store2', metadata: { rentalBookingId: 'refund1' } }, { activeMode: 'seller' })).toBe('/seller/rentals?id=refund1&storeId=store2');
  expect(notificationDestination({ audience: 'CUSTOMER', metadata: { rentalBookingId: 'trial1', storeSlug: 'occasion-boutique' } }, { role: 'customer' })).toBe('/store/occasion-boutique/rentals?id=trial1');
});
