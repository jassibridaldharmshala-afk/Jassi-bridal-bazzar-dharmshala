import { getDesktopActiveLink } from '../../utils/navbarActive';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import Navbar from './Navbar';
import { DEFAULT_WEBSITE_CONFIG } from '../../config/websiteCustomization';

let mockWebsiteConfig, mockBuyCount, mockRentalCount;
jest.mock('../../context/CartContext', () => ({ useCart: () => ({ itemCount: mockBuyCount }) }));
jest.mock('../../context/RentalBagContext', () => ({ useRentalBag: () => ({ itemCount: mockRentalCount }) }));
jest.mock('../../context/WishlistContext', () => ({ useWishlist: () => ({ items: [] }) }));
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('../../context/WebsiteCustomizationContext', () => ({ useWebsiteCustomization: () => ({ config: mockWebsiteConfig }) }));
jest.mock('../rentals/RentalStorefrontLink', () => () => null);
jest.mock('../notifications/NotificationBell', () => () => null);

beforeEach(() => { mockWebsiteConfig = DEFAULT_WEBSITE_CONFIG; mockBuyCount = 0; mockRentalCount = 0; });

test('cart badge includes both bags and each shopping mode opens its corresponding bag', () => {
  mockBuyCount = 2; mockRentalCount = 1;
  const navigate = jest.fn(), view = render(<Navbar navigate={navigate} route="/products" />);
  const cart = screen.getByRole('button', { name: 'Cart', exact: true });
  expect(within(cart).getByText('3')).toBeInTheDocument();
  fireEvent.click(cart);
  expect(navigate).toHaveBeenLastCalledWith('/cart');
  view.rerender(<Navbar navigate={navigate} route="/store/bridal-shop/rental-book" />);
  fireEvent.click(cart);
  expect(navigate).toHaveBeenLastCalledWith('/store/bridal-shop/rental-cart');
});

test('cart always opens the populated bag when only one type has items', () => {
  const navigate = jest.fn(); mockRentalCount = 1;
  const view = render(<Navbar navigate={navigate} route="/" />);
  fireEvent.click(screen.getByRole('button', { name: 'Cart', exact: true }));
  expect(navigate).toHaveBeenLastCalledWith('/rental-cart');
  mockBuyCount = 2; mockRentalCount = 0;
  view.rerender(<Navbar navigate={navigate} route="/rental-book" />);
  fireEvent.click(screen.getByRole('button', { name: 'Cart', exact: true }));
  expect(navigate).toHaveBeenLastCalledWith('/cart');
});

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

test('rendered navigation highlights only the selected collection while switching sections', () => {
  const navigate = jest.fn(), view = render(<Navbar navigate={navigate} route="/products" />);
  const menu = within(screen.getByRole('navigation', { name: 'Primary' }));
  for (const [route, label] of [
    ['/products', 'Shop All'],
    ['/products?newArrival=true&collection=new-arrivals', 'New Arrivals'],
    ['/products?bestSeller=true&collection=best-sellers', 'Best Sellers'],
    ['/products?featured=true&collection=featured', 'Featured'],
    ['/products?discount=20', 'Offers'],
    ['/products?newArrival=true&collection=new-arrivals&discount=20', 'New Arrivals'],
    ['/products', 'Shop All'],
  ]) {
    view.rerender(<Navbar navigate={navigate} route={route} />);
    const selected = menu.getAllByRole('button', { current: 'page' });
    expect(selected).toHaveLength(1);
    expect(selected[0]).toHaveAccessibleName(label);
    expect(selected[0]).toHaveClass('sc-navbar__link--active');
    for (const button of menu.getAllByRole('button').filter(button => button !== selected[0])) expect(button).not.toHaveClass('sc-navbar__link--active');
  }
  fireEvent.click(menu.getByRole('button', { name: 'Offers', exact: true }));
  expect(navigate).toHaveBeenCalledWith('/products?discount=20');
});

test('store navigation selects a renamed collection by its destination', () => {
  mockWebsiteConfig = { ...DEFAULT_WEBSITE_CONFIG, header: { ...DEFAULT_WEBSITE_CONFIG.header, menuItems: DEFAULT_WEBSITE_CONFIG.header.menuItems.map(link => link.label === 'New Arrivals' ? { ...link, label: 'Just arrived' } : link) } };
  const navigate = jest.fn();
  render(<Navbar navigate={navigate} route="/store/bridal-shop/products?newArrival=true&collection=new-arrivals" />);
  const menu = within(screen.getByRole('navigation', { name: 'Primary' }));
  const selected = menu.getAllByRole('button', { current: 'page' });
  expect(selected).toHaveLength(1);
  expect(selected[0]).toHaveAccessibleName('Just arrived');
  expect(menu.getByRole('button', { name: 'Shop All' })).not.toHaveClass('sc-navbar__link--active');
  fireEvent.click(menu.getByRole('button', { name: 'Shop All' }));
  expect(navigate).toHaveBeenCalledWith('/store/bridal-shop/products');
});

test('custom destinations select one matching link and unrelated detail pages select none', () => {
  mockWebsiteConfig = { ...DEFAULT_WEBSITE_CONFIG, header: { ...DEFAULT_WEBSITE_CONFIG.header, menuItems: [{ label: 'Guides', path: '/faqs' }, { label: 'Rental guide', path: '/faqs?topic=rentals' }] } };
  const view = render(<Navbar navigate={jest.fn()} route="/faqs?topic=rentals" />);
  const menu = within(screen.getByRole('navigation', { name: 'Primary' }));
  const selected = menu.getAllByRole('button', { current: 'page' });
  expect(selected).toHaveLength(1);
  expect(selected[0]).toHaveAccessibleName('Rental guide');
  view.rerender(<Navbar navigate={jest.fn()} route="/product/orange-lehenga?id=product-id" />);
  expect(menu.queryByRole('button', { current: 'page' })).not.toBeInTheDocument();
});
