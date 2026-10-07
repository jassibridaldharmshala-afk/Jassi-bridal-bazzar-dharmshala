import { getDesktopActiveLink } from '../../utils/navbarActive';

describe('desktop navbar active link', () => {
  test.each([
    ['/', '', 'Home'],
    ['/products', '', 'Shop All'],
    ['/products', 'newArrival=true&collection=new-arrivals', 'New Arrivals'],
    ['/products', 'bestSeller=true&collection=best-sellers', 'Best Sellers'],
    ['/products', 'featured=true&collection=featured', 'Featured'],
    ['/products', 'discount=20', 'Offers'],
    ['/contact', '', 'Contact Us'],
  ])('selects one link for %s?%s', (path, query, expected) => {
    expect(getDesktopActiveLink(path, new URLSearchParams(query))).toBe(expected);
  });

  test('keeps a named collection selected when an additional offer filter is applied', () => {
    const active = getDesktopActiveLink('/products', new URLSearchParams('newArrival=true&collection=new-arrivals&discount=20'));
    expect(active).toBe('New Arrivals');
  });
});
