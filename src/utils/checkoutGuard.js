export function shouldExitEmptyCheckout({ hydrated, itemCount, orderCompleted = false }) {
  return Boolean(hydrated) && Number(itemCount || 0) === 0 && !orderCompleted;
}
