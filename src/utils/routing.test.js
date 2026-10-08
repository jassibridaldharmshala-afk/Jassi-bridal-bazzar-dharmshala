import { BEFORE_ROUTE_CHANGE_EVENT, boutiquePath, parseProductKey, productHref, pushAppRoute, storefrontPath } from './routing';

test('designer navigation guard cancels a route change without changing the URL', () => {
  window.history.replaceState(null, '', '/admin/customization');
  const guard = (event) => event.preventDefault();
  window.addEventListener(BEFORE_ROUTE_CHANGE_EVENT, guard);
  pushAppRoute('/products');
  expect(window.location.pathname).toBe('/admin/customization');
  window.removeEventListener(BEFORE_ROUTE_CHANGE_EVENT, guard);
  pushAppRoute('/products');
  expect(window.location.pathname).toBe('/products');
  window.history.replaceState(null, '', '/');
});

test('the preview route is never interpreted as a boutique slug', () => {
  expect(boutiquePath('/website-preview')).toBe('/website-preview');
});
test.each(['/rentals', '/rental-book'])('rental route %s is not a boutique slug and retains tenant navigation', path => {
  expect(boutiquePath(path)).toBe(path);
  expect(storefrontPath(`${path}?id=booking`, 'occasion')).toBe(`/store/occasion${path}?id=booking`);
});

test.each(['/', '/products?category=silk', '/search?search=kurta', '/product?id=one', '/category?category=silk'])('catalog navigation %s remains in the selected boutique', path => {
  expect(storefrontPath(path, 'silk')).toBe(`/store/silk${path === '/' ? '' : path}`);
});
test.each(['/seller', '/admin/products', '/store/other/products', 'https://example.com'])('non-catalog navigation %s retains its correct destination', path => {
  expect(storefrontPath(path, 'silk')).toBe(path);
});

describe('product routes', () => {
  const id = '6a33b378573544bac1ccd9b1';

  test('keeps a readable slug and includes the stable product id', () => {
    expect(productHref({ _id: id, slug: ' Royal Silk Saree ' }))
      .toBe(`/product/Royal%20Silk%20Saree?id=${id}`);
  });

  test('builds store product links with the same stable lookup id', () => {
    expect(productHref({ _id: id, slug: 'royal-silk-saree' }, 'samira-collection'))
      .toBe(`/store/samira-collection/products/royal-silk-saree?id=${id}`);
  });

  test('supports slug-only and missing product records safely', () => {
    expect(productHref({ slug: 'royal-silk-saree' })).toBe('/product/royal-silk-saree');
    expect(productHref({})).toBe('/products');
  });

  test.each([
    [`/product/royal-silk-saree?id=${id}`, id],
    ['/product/royal-silk-saree', 'royal-silk-saree'],
    ['/products/royal-silk-saree', 'royal-silk-saree'],
    ['/store/samira-collection/products/royal-silk-saree', 'royal-silk-saree'],
    ['/store/samira-collection/product/royal-silk-saree', 'royal-silk-saree'],
  ])('parses %s', (route, expected) => {
    expect(parseProductKey(route)).toBe(expected);
  });

  test('does not crash on malformed encoded route text', () => {
    expect(parseProductKey('/product/broken%')).toBe('broken%');
  });
});

test.each(['/cart', '/checkout', '/profile', '/orders', '/returns', '/notifications'])('customer route %s stays in the selected boutique', path => {
  expect(storefrontPath(path, 'silk')).toBe('/store/silk' + path);
});
