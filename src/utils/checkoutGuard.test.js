import { shouldExitEmptyCheckout } from './checkoutGuard';

describe('empty checkout guard', () => {
  test('waits for cart hydration before deciding the bag is empty', () => {
    expect(shouldExitEmptyCheckout({ hydrated: false, itemCount: 0 })).toBe(false);
  });

  test('returns the customer to the bag after the final item is removed', () => {
    expect(shouldExitEmptyCheckout({ hydrated: true, itemCount: 0 })).toBe(true);
  });

  test('keeps checkout open while at least one item remains', () => {
    expect(shouldExitEmptyCheckout({ hydrated: true, itemCount: 1 })).toBe(false);
  });

  test('does not interrupt a completed order redirect after the cart is cleared', () => {
    expect(shouldExitEmptyCheckout({ hydrated: true, itemCount: 0, orderCompleted: true })).toBe(false);
  });
});
