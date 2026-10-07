let activeRequests = 0;
const listeners = new Set();

function emit() {
  listeners.forEach((listener) => listener());
}

export function startMobileLoader() {
  activeRequests += 1;
  emit();
}

export function stopMobileLoader() {
  activeRequests = Math.max(0, activeRequests - 1);
  emit();
}

export function subscribeMobileLoader(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getMobileLoaderSnapshot() {
  return activeRequests > 0;
}
