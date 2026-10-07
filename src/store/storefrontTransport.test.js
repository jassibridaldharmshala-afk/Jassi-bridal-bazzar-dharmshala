import { expandHomeFeed, storefrontReadOptions, STOREFRONT_READ_TIMEOUT } from './storefrontTransport';

test.each(['/storefront/home', '/storefront/home/discovery', '/products?search=saree', '/products/id', '/products/id/complete-look', '/categories', '/banners', '/settings', '/website-config', '/stores/resolve?host=example.com'])(
  '%s browsing requests have a deadline', url => {
    expect(storefrontReadOptions(url)).toEqual({ readOnly: true, request: { url, timeout: STOREFRONT_READ_TIMEOUT } });
  },
);

test.each(['/admin/reports/export', '/master/projects/export', '/orders', '/auth/me'])(
  '%s is not silently given a catalog timeout', url => expect(storefrontReadOptions(url).request).toBe(url),
);

test('explicit timeouts are preserved and writes are not retried or treated as browsing', () => {
  expect(storefrontReadOptions({ url: '/products', timeout: 1200 }).request.timeout).toBe(1200);
  const write = { url: '/products', method: 'POST', body: {} };
  expect(storefrontReadOptions(write)).toEqual({ readOnly: false, request: write });
});

test('legacy feeds pass through unchanged; compact feeds keep configured ordering and share product references', () => {
  const legacy = { products: [{ _id: 'a' }], collections: { featured: [] } };
  expect(expandHomeFeed(legacy)).toBe(legacy);
  const products = [{ _id: 'a' }, { _id: 'b' }];
  const result = expandHomeFeed({ format: 'compact-v1', products, collections: { featured: ['b', 'a', 'deleted'], latest: ['a'] } });
  expect(result.collections.featured).toEqual([products[1], products[0]]);
  expect(result.collections.latest[0]).toBe(result.products[0]);
});
