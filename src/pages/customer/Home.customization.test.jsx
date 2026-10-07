import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import api from '../../services/api';
import { getRecentProductIds, rememberRecentProduct } from '../../utils/recentProducts';
import Home from './Home';
import { mergeWebsiteConfig } from '../../config/websiteCustomization';

jest.mock('../../services/api', () => ({ post: jest.fn(), get: jest.fn() }));
jest.mock('../../utils/analytics', () => ({ trackEvent: jest.fn() }));

let mockWidth = 390;
let mockConfig = mergeWebsiteConfig();
let mockProduct;
let mockMobileFeed;
let mockMobileLoading;
let mockMobileError;
let mockMobileErrorStatus;
let mockMobileFetching;
let mockPreviousFeed;
let mockToggleWishlist;
let mockAddToCart;
let mockPrefetchProduct;
const mockDesktopModuleLoaded = jest.fn();
jest.mock('@mantine/hooks', () => ({ useMediaQuery: (query) => mockWidth >= (query.includes('1024') ? 1024 : 768) }));
jest.mock('../../context/WebsiteCustomizationContext', () => ({ useWebsiteCustomization: () => ({ config: mockConfig }) }));
jest.mock('../../context/CartContext', () => ({ useCart: () => ({ getCartItem: jest.fn(), addToCart: mockAddToCart, loading: false }) }));
jest.mock('../../context/WishlistContext', () => ({ useWishlist: () => ({ items: [], pendingIds: [], toggleWishlist: mockToggleWishlist }) }));
jest.mock('./DesktopLuxuryHome', () => {
  mockDesktopModuleLoaded();
  return ({ industry, websiteConfig }) => <div data-testid="desktop-home" data-industry={industry} data-ethnic-visible={String(websiteConfig.homepage.sections.find((section) => section.id === 'ethnicSets')?.visible)} data-reviews-visible={String(websiteConfig.homepage.sections.find((section) => section.id === 'reviews')?.visible)}>Desktop home layout</div>;
});
jest.mock('../../store/apiSlice', () => ({
  samiraApi: { usePrefetch: () => mockPrefetchProduct },
  useGetProductsQuery: () => ({ data: [mockProduct] }),
  useGetMobileHomeQuery: () => ({ data: mockPreviousFeed || mockMobileFeed, currentData: mockMobileFeed, isLoading: mockMobileLoading, isFetching: mockMobileFetching, isError: mockMobileError, error: { status: mockMobileErrorStatus }, refetch: jest.fn() }),
  useGetCategoriesQuery: () => ({ data: [] }),
  useGetBannersQuery: () => ({ data: [] }),
  useGetFeaturedReviewsQuery: () => ({ data: [] }),
}));

beforeEach(() => {
  localStorage.clear(); api.get.mockReset(); api.get.mockResolvedValue(null);
  mockWidth = 390;
  mockMobileLoading = false;
  mockMobileError = false;
  mockMobileErrorStatus = undefined;
  mockMobileFetching = false;
  mockPreviousFeed = undefined;
  mockPrefetchProduct = jest.fn();
  mockConfig = mergeWebsiteConfig();
  mockToggleWishlist = jest.fn(() => Promise.resolve({ ok: true }));
  mockAddToCart = jest.fn(() => ({ ok: true }));
  mockProduct = { _id: '0123456789abcdef01234567', name: 'API product', price: 100, images: ['/uploads/item.png'], showOnHomepage: true, isFeatured: true, category: 'Kurtis' };
  mockMobileFeed = {
    products: [mockProduct],
    collections: {
      featured: [mockProduct], trending: [mockProduct], newArrivals: [mockProduct], bestSellers: [mockProduct],
      ethnicSets: [], accessories: [], instagram: [mockProduct], recommended: [mockProduct], recentlyViewed: [], latest: [mockProduct],
    },
    categories: [], banners: [], reviews: [],
    settings: { shippingFreeAboveEnabled: true, freeShippingMinAmount: 999, returnsEnabled: true, returnWindowDays: 7, codEnabled: true },
    warnings: [],
  };
});

test('occasion and rental shortcuts appear below existing categories without adding mobile search', async () => {
  const navigate = jest.fn();
  api.get.mockResolvedValue({ mode: 'SALE_AND_RENTAL', rentalEnabled: true, occasions: [{ key: 'wedding', label: 'Wedding' }], recentlyViewed: [] });
  const { container } = render(<Home navigate={navigate} industry="jewellery" industrySections={['hero', 'categories', 'featured']} storeSlug="nishaya" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Wedding' }));
  expect(navigate).toHaveBeenCalledWith('/products?occasion=Wedding');
  fireEvent.click(screen.getByRole('button', { name: 'Explore rentals & check dates' }));
  expect(navigate).toHaveBeenCalledWith('/rental-book');
  expect(container.querySelector('[data-home-section="categories"]')).toBeInTheDocument();
  expect(container.querySelector('[data-home-section="shoppingShortcuts"]')).toHaveStyle({ order: '21' });
  expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
});

test('mobile recently viewed preserves browser order, can be cleared, and respects owner disable', async () => {
  const second = { ...mockProduct, _id: 'abcdef0123456789abcdef01', name: 'Viewed second' };
  rememberRecentProduct(mockProduct._id, 'nishaya'); rememberRecentProduct(second._id, 'nishaya');
  api.get.mockResolvedValue({ mode: 'SALE_ONLY', rentalEnabled: false, occasions: [], recentlyViewed: [second, mockProduct] });
  const { container, unmount } = render(<Home navigate={jest.fn()} storeSlug="nishaya" />);
  const clear = await screen.findByRole('button', { name: /Clear history/i });
  expect(container.querySelector('[data-home-section="recentlyViewed"] h2')).toHaveTextContent('Continue where you left off');
  fireEvent.click(clear);
  await waitFor(() => expect(screen.queryByRole('button', { name: /Clear history/i })).not.toBeInTheDocument());
  expect(getRecentProductIds('nishaya')).toEqual([]);
  unmount(); rememberRecentProduct(mockProduct._id, 'nishaya');
  mockMobileFeed.settings.recentlyViewedEnabled = false;
  api.get.mockResolvedValue({ recentlyViewedEnabled: false, occasions: [], recentlyViewed: [] });
  render(<Home navigate={jest.fn()} storeSlug="nishaya" />);
  await waitFor(() => expect(api.get).toHaveBeenCalled());
  expect(screen.queryByText('Continue where you left off')).not.toBeInTheDocument();
});

test('mobile rails calculate discounts from actual prices and disable unavailable purchases', () => {
  mockProduct = { ...mockProduct, price: 1599, originalPrice: 2399, discountPercentage: 0, stock: 0 };
  mockMobileFeed = {
    ...mockMobileFeed,
    products: [mockProduct],
    collections: Object.fromEntries(Object.entries(mockMobileFeed.collections).map(([key, products]) => [key, products.length ? [mockProduct] : []])),
  };
  render(<Home navigate={jest.fn()} />);
  expect(screen.getAllByText(/33% OFF/).length).toBeGreaterThan(0);
  expect(screen.queryByText(/0% OFF/)).not.toBeInTheDocument();
  screen.getAllByRole('button', { name: /Out of stock/i }).forEach(button => expect(button).toBeDisabled());
});

test('the wishlist keyboard action does not also open the product card', () => {
  const navigate = jest.fn();
  const { container } = render(<Home navigate={navigate} />);
  const button = container.querySelector('[data-mobile-product-card] button[aria-label="Add to wishlist"]');
  fireEvent.keyDown(button, { key: 'Enter' });
  expect(navigate).not.toHaveBeenCalled();
});

test('touching a product while scrolling only starts a silent detail prefetch', () => {
  const { container } = render(<Home navigate={jest.fn()} />);
  fireEvent.pointerDown(container.querySelector('[data-mobile-product-card] button[aria-label^="View "]'));
  expect(mockPrefetchProduct).toHaveBeenCalledWith({ id: mockProduct._id, store: '', silent: true });
});

test('desktop edits do not change the current mobile composition while overrides are disabled', () => {
  mockConfig = mergeWebsiteConfig({ homepage: { sections: [{ id: 'hero', visible: false, heading: 'Desktop-only text' }] },
    mobile: { enabled: false, sections: [{ id: 'hero', visible: false, heading: 'Inactive mobile text' }] } });
  const { container } = render(<Home navigate={jest.fn()} />);
  expect(screen.getByText('Celebrate in Style')).toBeInTheDocument();
  expect(screen.queryByText('Desktop home layout')).not.toBeInTheDocument();
  expect(mockDesktopModuleLoaded).not.toHaveBeenCalled();
  expect(container.querySelector('.mobile-home--custom')).toBeNull();
  expect(container.querySelector('[data-mobile-product-card] [data-mobile-product-media]')).not.toBeNull();
});

test('enabled mobile sections can hide the hero and change only mobile headings', () => {
  mockConfig = mergeWebsiteConfig({ mobile: { enabled: true, sections: [
    { id: 'hero', visible: false }, { id: 'trending', heading: 'Mobile edit', order: 0 },
  ] } });
  const { container } = render(<Home navigate={jest.fn()} />);
  expect(screen.queryByText('Celebrate in Style')).not.toBeInTheDocument();
  expect(screen.getByText('Mobile edit')).toBeInTheDocument();
  expect(container.querySelector('.mobile-home--custom')).not.toBeNull();
});

test('a non-fashion store uses its industry sections on mobile without fashion-only rails', () => {
  render(<Home navigate={jest.fn()} industry="electronics" industrySections={['hero', 'categories', 'featured', 'bestSellers', 'offers']} />);
  expect(screen.getByText('New electronics collection')).toBeInTheDocument();
  expect(screen.getByText('Featured')).toBeInTheDocument();
  expect(screen.getByText('Best Sellers')).toBeInTheDocument();
  expect(screen.queryByText('Ethnic Sets')).not.toBeInTheDocument();
  expect(screen.queryByText('Accessories')).not.toBeInTheDocument();
});

test('a non-fashion desktop store receives the same industry visibility rules', async () => {
  mockWidth = 1440;
  render(<Home navigate={jest.fn()} industry="electronics" industrySections={['hero', 'categories', 'featured', 'bestSellers', 'offers']} />);
  const desktop = await screen.findByTestId('desktop-home');
  expect(desktop).toHaveAttribute('data-industry', 'electronics');
  expect(desktop).toHaveAttribute('data-ethnic-visible', 'false');
  expect(desktop).toHaveAttribute('data-reviews-visible', 'true');
});

test('mobile settings never render a second layout on desktop or affect tablet section content', async () => {
  mockConfig = mergeWebsiteConfig({ mobile: { enabled: true, sections: [{ id: 'hero', heading: 'Mobile only' }] } });
  mockWidth = 1440;
  const { rerender } = render(<Home navigate={jest.fn()} />);
  expect(await screen.findByText('Desktop home layout')).toBeInTheDocument();
  expect(screen.queryByText('Mobile only')).not.toBeInTheDocument();
  mockWidth = 820;
  rerender(<Home navigate={jest.fn()} />);
  expect(screen.queryByText('Desktop home layout')).not.toBeInTheDocument();
  expect(screen.getByText('Celebrate in Style')).toBeInTheDocument();
  expect(screen.queryByText('Mobile only')).not.toBeInTheDocument();
});

test('mobile cards expose every configurable field and truthful store policies', () => {
  mockProduct = { ...mockProduct, price: 900, originalPrice: 1200, rating: 4.5, numReviews: 8, stock: 2 };
  mockMobileFeed = {
    ...mockMobileFeed,
    products: [mockProduct],
    collections: { ...mockMobileFeed.collections, featured: [mockProduct], trending: [mockProduct], newArrivals: [], bestSellers: [], instagram: [], recommended: [] },
    settings: { shippingFreeAboveEnabled: true, freeShippingMinAmount: 1499, returnsEnabled: false, codEnabled: true },
  };
  const { container } = render(<Home navigate={jest.fn()} />);
  const card = container.querySelector('[data-mobile-product-card]');
  ['title', 'price', 'discount', 'rating', 'wishlist', 'cart'].forEach((field) => expect(card.querySelector(`[data-card-field="${field}"]`)).not.toBeNull());
  expect(screen.getByText('Above ₹1,499')).toBeInTheDocument();
  expect(screen.getByText('Final Sale')).toBeInTheDocument();
  expect(screen.getAllByText('Only 2 left').length).toBeGreaterThan(0);
});

test('a stale configured product selection falls back to live products', () => {
  mockConfig = mergeWebsiteConfig({
    mobile: { enabled: true, useDesktopCatalog: true },
    homepage: { sectionProductIds: { featured: ['ffffffffffffffffffffffff'] } },
  });
  render(<Home navigate={jest.fn()} />);
  expect(screen.getAllByText('API product').length).toBeGreaterThan(0);
});

test('a live order pause stays visible and disables mobile quick add', () => {
  mockMobileFeed = {
    ...mockMobileFeed,
    settings: { ...mockMobileFeed.settings, acceptingOrders: false, orderPauseMessage: 'Back tomorrow morning.' },
  };
  render(<Home navigate={jest.fn()} />);
  expect(screen.getByText('Online orders are temporarily paused')).toBeInTheDocument();
  expect(screen.getByText('Back tomorrow morning.')).toBeInTheDocument();
  screen.getAllByRole('button', { name: 'Orders are temporarily paused' }).forEach((button) => expect(button).toBeDisabled());
});

test('mobile home omits review and newsletter blocks even when an older theme still contains them', () => {
  mockConfig = mergeWebsiteConfig({ homepage: { blocks: [
    { id: 'mobile-review', type: 'reviews', title: 'Customer stories', items: ['Lovely product'] },
    { id: 'mobile-join', type: 'newsletter', title: 'Join our list', buttonText: 'Join' },
  ] } });
  mockMobileFeed = { ...mockMobileFeed, reviews: [{ _id: 'review-1', rating: 5, comment: 'Lovely product' }] };
  render(<Home navigate={jest.fn()} />);
  expect(screen.queryByText('Customer stories')).not.toBeInTheDocument();
  expect(screen.queryByText('Join our list')).not.toBeInTheDocument();
});

test('mobile hero automatically advances through live banners', () => {
  jest.useFakeTimers();
  mockConfig = mergeWebsiteConfig({
    mobile: { enabled: true },
    homepage: { sections: [{ id: 'hero', image: '/uploads/designer-fallback.jpg', imageAlt: 'Designer fallback' }] },
  });
  mockMobileFeed = { ...mockMobileFeed, banners: [
    { _id: 'hero-1', type: 'Hero', position: 'Home - Top', title: 'First offer', image: '/uploads/first.jpg' },
    { _id: 'hero-2', type: 'Hero', position: 'Home - Middle', title: 'Second offer', image: '/uploads/second.jpg' },
  ] };
  const view = render(<Home navigate={jest.fn()} />);
  expect(screen.getByRole('button', { name: 'First offer, slide 1 of 2' })).toBeInTheDocument();
  act(() => jest.advanceTimersByTime(5200));
  expect(screen.getByRole('button', { name: 'Second offer, slide 2 of 2' })).toBeInTheDocument();
  view.unmount();
  jest.useRealTimers();
});

test('mobile category rail includes every active category, including nested Sarees', () => {
  const categories = Array.from({ length: 10 }, (_, index) => ({
    _id: `category-${index}`,
    name: index === 9 ? 'Sarees' : `Category ${index + 1}`,
    ...(index === 9 ? { parent: 'fashion-root' } : {}),
  }));
  mockConfig = mergeWebsiteConfig({ mobile: { enabled: true, useDesktopCatalog: true }, homepage: { featuredCategoryIds: ['category-2'] } });
  mockMobileFeed = { ...mockMobileFeed, categories };
  render(<Home navigate={jest.fn()} />);
  expect(screen.getByText('Sarees')).toBeInTheDocument();
  categories.forEach((category) => expect(screen.getByText(category.name)).toBeInTheDocument());
});

test('mobile home loading renders an accessible in-page skeleton, not a blocking spinner', () => {
  mockMobileLoading = true;
  mockMobileFeed = {};
  const { container } = render(<Home navigate={jest.fn()} />);
  expect(screen.getByLabelText('Loading the collection')).toBeInTheDocument();
  expect(container.querySelector('[data-mobile-loader]')).toBeNull();
});

test('mobile home uses cached public catalog APIs when an older server has no combined feed', () => {
  mockMobileError = true;
  mockMobileErrorStatus = 404;
  mockMobileFeed = {};
  render(<Home navigate={jest.fn()} />);
  expect(screen.queryByText('The store could not be loaded')).not.toBeInTheDocument();
  expect(screen.getAllByText('API product').length).toBeGreaterThan(0);
});

test.each(['TIMEOUT_ERROR', 'FETCH_ERROR', 429, 503])('a %s shows retry instead of starting a second full-catalog waterfall', status => {
  mockMobileError = true;
  mockMobileErrorStatus = status;
  mockMobileFeed = undefined;
  render(<Home navigate={jest.fn()} />);
  expect(screen.getByText('The store could not be loaded')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  expect(screen.queryByText('API product')).not.toBeInTheDocument();
});

test('a background refresh keeps the current collection usable', () => {
  mockMobileFetching = true;
  render(<Home navigate={jest.fn()} />);
  expect(screen.queryByLabelText('Loading the collection')).not.toBeInTheDocument();
  expect(screen.getAllByText('API product').length).toBeGreaterThan(0);
});

test('a store switch cannot show the previous store products while the new feed loads', () => {
  mockPreviousFeed = mockMobileFeed;
  mockMobileFeed = undefined;
  mockMobileFetching = true;
  render(<Home navigate={jest.fn()} storeSlug="another-store" />);
  expect(screen.getByLabelText('Loading the collection')).toBeInTheDocument();
  expect(screen.queryByText('API product')).not.toBeInTheDocument();
});
