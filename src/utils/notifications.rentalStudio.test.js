import { notificationCategory, notificationDestination } from './notifications';
test('studio notification links land in the scoped rental workflows', () => {
  expect(notificationDestination({ audience: 'ADMIN', metadata: { rentalTaskId: 'task1' } }, { role: 'admin' })).toBe('/admin/rentals?tab=studio');
  expect(notificationDestination({ audience: 'ADMIN', metadata: { rentalTaskId: 'task1' } }, { activeMode: 'seller' })).toBe('/seller/rentals?tab=studio');
  expect(notificationDestination({ audience: 'CUSTOMER', metadata: { rentalWaitlistId: 'wait1' } }, { role: 'customer' })).toBe('/rental-book?waitlist=wait1');
  expect(notificationDestination({ audience: 'ADMIN', storeId: 'store2', metadata: { rentalTaskId: 'task1' } }, { activeMode: 'seller' })).toBe('/seller/rentals?tab=studio&storeId=store2');
  expect(notificationDestination({ audience: 'CUSTOMER', metadata: { rentalWaitlistId: 'wait1', storeSlug: 'occasion-boutique' } }, { role: 'customer' })).toBe('/store/occasion-boutique/rental-book?waitlist=wait1');
  expect(notificationDestination({ audience: 'ADMIN', storeId: 'store2', metadata: { rentalBookingId: 'refund1' } }, { activeMode: 'seller' })).toBe('/seller/orders?type=rental&booking=refund1&storeId=store2');
  expect(notificationDestination({ audience: 'CUSTOMER', metadata: { rentalBookingId: 'trial1', storeSlug: 'occasion-boutique' } }, { role: 'customer' })).toBe('/store/occasion-boutique/rentals?id=trial1');
  expect(notificationDestination({ audience: 'ADMIN', metadata: { rentalBookingId: 'booking1', storeId: 'store2' } }, { role: 'admin' })).toBe('/admin/orders?type=rental&booking=booking1&storeId=store2');
});

test('rental bookings and financial alerts appear in the matching notification filters', () => {
  expect(notificationCategory({ event: 'RENTAL_BOOKING_CONFIRMED', metadata: { rentalBookingId: 'one' } })).toBe('orders');
  expect(notificationCategory({ event: 'RENTAL_PAYMENT_REVIEW', metadata: { rentalBookingId: 'one' } })).toBe('payments');
  expect(notificationCategory({ event: 'RENTAL_REFUND_PROCESSED', metadata: { rentalBookingId: 'one' } })).toBe('payments');
});
