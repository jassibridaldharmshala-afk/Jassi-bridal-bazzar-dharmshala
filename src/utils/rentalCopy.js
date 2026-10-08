const labels = {
  HELD: 'Awaiting advance payment', CONFIRMED: 'Booking confirmed', PREPARING: 'Being prepared', READY: 'Ready for pickup', OUT: 'With you', RETURNED: 'Returned for inspection', CLOSED: 'Rental completed', CANCELLED: 'Cancelled', EXPIRED: 'Reservation expired',
  RETURN_COLLECTION: 'Arrange return collection', EXTEND: 'Extend the rental', RESCHEDULE: 'Change booking dates', CANCEL: 'Cancel booking', DISPUTE: 'Question a charge',
  PENDING: 'Awaiting review', APPROVED: 'Approved by the store', REJECTED: 'Declined by the store', RESOLVED: 'Resolved', REQUESTED: 'Request received',
  COLLECTION: 'Payment received', REFUND: 'Refund', SUCCEEDED: 'Completed', FAILED: 'Could not be completed', PROCESSING: 'Processing',
  STORE_PICKUP: 'Store pickup', LOCAL_DELIVERY: 'Local delivery', COURIER: 'Courier delivery', DELIVERY: 'Delivery', LOST: 'Reported missing', CLEANING: 'Being cleaned', RETIRED: 'Removed from service',
};
export function rentalCopy(value) {
  const key = String(value || '');
  return labels[key] || key.toLowerCase().replace(/_/g, ' ').replace(/^./, letter => letter.toUpperCase());
}
