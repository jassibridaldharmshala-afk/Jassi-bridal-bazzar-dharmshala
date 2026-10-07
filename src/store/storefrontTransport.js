// Browsing reads must not lock navigation behind a full-screen spinner. Keep
// write requests (orders, payments, uploads) on their existing busy/timeout path.
export const STOREFRONT_READ_TIMEOUT = 15000;

export function storefrontReadOptions(args) {
  const request = typeof args === 'string' ? { url: args } : args;
  const method = String(request?.method || 'GET').toUpperCase();
  const readOnly = method === 'GET' || method === 'HEAD';
  const path = String(request?.url || '').split('?')[0];
  const publicRead = readOnly && /^(?:\/storefront\/home(?:\/discovery)?|\/products(?:\/[^/]+(?:\/complete-look)?)?|\/categories|\/banners|\/settings|\/website-config|\/catalog-configuration|\/reviews\/featured|\/stores\/[^/]+)\/?$/.test(path);
  return {
    readOnly,
    request: publicRead ? { timeout: STOREFRONT_READ_TIMEOUT, ...request } : args,
  };
}

// New servers send each product once. Older deployments can still return the
// original shape: the component contract and rolling deploys stay compatible.
export function expandHomeFeed(feed) {
  if (feed?.format !== 'compact-v1') return feed;
  const byId = new Map((feed.products || []).map(product => [String(product._id || product.id), product]));
  return {
    ...feed,
    collections: Object.fromEntries(Object.entries(feed.collections || {}).map(([key, ids]) => [
      key, ids.map(id => byId.get(String(id))).filter(Boolean),
    ])),
  };
}
