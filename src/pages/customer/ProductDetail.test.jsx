import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ProductDetail from './ProductDetail';
import { RentalBagProvider } from '../../context/RentalBagContext';

jest.mock('@reduxjs/toolkit/query', () => ({ skipToken: Symbol('skipToken') }));

const mockProduct = {
  _id: 'product-1',
  slug: 'royal-zari-saree',
  name: 'Royal Zari Silk Saree',
  brand: 'Jassi Bridal Bazar Dharmshala',
  description: 'Handwoven zari border from the catalog API.',
  category: { _id: 'category-1', name: 'Sarees' },
  price: 1299,
  originalPrice: 2499,
  discountPercentage: 48,
  sizes: ['S', 'M'],
  colors: ['Navy'],
  stock: 8,
  images: [{ url: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==' }],
  highlights: [],
  fabric: '',
  occasion: '',
  tags: [],
  careInstructions: '',
  returnPolicy: '',
};
let mockVariantGroupData = null;
let mockRelatedProducts = [];
let mockRentalData = null;
let mockDesktop = false;
jest.mock('@mantine/hooks', () => ({ useMediaQuery: () => mockDesktop }));

jest.mock('../../store/apiSlice', () => ({
  useGetProductQuery: () => ({ data: mockProduct, isLoading: false, error: null }),
  useGetProductsQuery: () => ({ data: mockRelatedProducts }),
  useGetReviewsQuery: () => ({ data: [] }),
  useGetSettingsQuery: () => ({ data: { freeShippingMinAmount: 999, returnWindowDays: 7 } }),
  useGetVariantGroupQuery: () => ({ data: mockVariantGroupData }),
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

const mockAddConfirmed = jest.fn();
let mockBuyCount = 0;
jest.mock('../../context/CartContext', () => ({
  useCart: () => ({ itemCount: mockBuyCount, getCartItem: () => null, addToCart: jest.fn(), addToCartConfirmed: (...args) => mockAddConfirmed(...args) }),
}));

jest.mock('../../context/WishlistContext', () => ({
  useWishlist: () => ({ items: [], loading: false, toggleWishlist: jest.fn() }),
}));

const mockApiGet = jest.fn((path) => Promise.resolve(path.includes('/rentals/products/') ? mockRentalData : path.endsWith('/summary')
  ? { average: 0, total: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, recommendationPercentage: 0 }
  : null));

jest.mock('../../services/api', () => ({
  __esModule: true,
  default: { get: (...args) => mockApiGet(...args) },
}));

jest.mock('../../components/product/ProductCard', () => ({ ProductVisual: () => null }));
jest.mock('../../components/product/ProductDetailPage', () => ({ onBuyNow, onAddToCart, cartBusy, size, setSize, actionMessage }) => <div data-testid="desktop-purchase-actions"><span data-testid="desktop-selected-size">{size || 'No size selected'}</span><button type="button" aria-pressed={size === 'S'} onClick={() => setSize('S')}>Desktop size S</button><button disabled={cartBusy} onClick={onBuyNow}>Desktop buy now</button><button disabled={cartBusy} onClick={onAddToCart}>Desktop add to bag</button>{actionMessage ? <p>{actionMessage}</p> : null}</div>);
jest.mock('../../components/seo/SeoHead', () => () => null);
jest.mock('../../utils/analytics', () => ({ trackEvent: jest.fn() }));

beforeEach(() => {
  window.history.replaceState({}, '', '/');
  mockApiGet.mockImplementation(path => Promise.resolve(path.includes('/rentals/products/') ? mockRentalData : path.endsWith('/summary')
    ? { average: 0, total: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, recommendationPercentage: 0 }
    : null));
  mockAddConfirmed.mockReset();
  mockBuyCount = 0;
  sessionStorage.clear();
  mockDesktop = false;
  mockVariantGroupData = null;
  mockRelatedProducts = [];
  mockRentalData = { enabled: true, listings: [{ _id: 'offer-1', title: 'Saree rental', dailyRatePaise: 100000, depositPaise: 50000 }], readiness: { bookable: true } };
  delete mockProduct.variantGroupId;
  delete mockProduct.sizingMode;
  delete mockProduct.sizeChartProfile;
  delete mockProduct.sizeChart;
  delete mockProduct.sizeFitNotes;
  delete mockProduct.commerceMode;
  delete mockProduct.purchaseEnabled;
});

test.each([
  [2, '/product?id=product-1', '/cart', 3],
  [2, '/product?id=product-1&mode=rent', '/rental-cart', 3],
  [0, '/product?id=product-1', '/rental-cart', 1],
])('mobile product cart includes both bags and opens the appropriate populated bag', async (buyCount, route, destination, total) => {
  mockProduct.commerceMode = 'SALE_AND_RENTAL';
  mockBuyCount = buyCount;
  sessionStorage.setItem('rental-bag:default:', JSON.stringify({ items: [{ listingId: '111111111111111111111111', quantity: 1 }], savedAt: Date.now() }));
  const navigate = jest.fn();
  render(<RentalBagProvider><ProductDetail navigate={navigate} route={route} /></RentalBagProvider>);
  fireEvent.click(await screen.findByRole('button', { name: `Cart, ${total} items` }));
  expect(navigate).toHaveBeenCalledWith(destination);
});

describe('mobile product details', () => {
  test('a rental recommendation opens its detail with the selected rental offer', async () => {
    mockRelatedProducts = [{ _id: 'rental-1', slug: 'orange-lehenga', name: 'Orange Lehenga', commerceMode: 'RENTAL_ONLY', price: 2999, stock: 0, rentalPreview: { listingId: 'offer-orange', dailyRatePaise: 100000, depositPaise: 50000 } }];
    const navigate = jest.fn();
    render(<ProductDetail navigate={navigate} route="/product?id=product-1" />);
    const card = await screen.findByRole('article', { name: 'Orange Lehenga' });
    expect(within(card).getByText('Rental', { exact: true })).toBeInTheDocument();
    expect(within(card).getByText('/ use day')).toBeInTheDocument();
    expect(within(card).queryByText('Available for rental')).not.toBeInTheDocument();
    fireEvent.click(within(card).getByRole('button', { name: 'View rental details' }));
    expect(navigate).toHaveBeenCalledWith('/product/orange-lehenga?mode=rent&listing=offer-orange');
    expect(within(card).getByRole('button', { name: 'View rental details' })).toBeEnabled();
  });
  test('Rental mode shows booking details and Book now opens the existing rental checkout without sale promises', async () => {
    mockProduct.commerceMode = 'SALE_AND_RENTAL';
    const navigate = jest.fn();
    render(<ProductDetail navigate={navigate} route="/product?id=product-1&mode=rent" />);
    expect(await screen.findByText('Rental price details')).toBeInTheDocument();
    expect(screen.getByText('Available to buy or rent')).toBeInTheDocument();
    expect(screen.getByText('/ use day')).toBeInTheDocument();
    expect(screen.queryByText('Delivery & services')).not.toBeInTheDocument();
    expect(screen.queryByText('7-day return window')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View rental details' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: 'Buy Now' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Book now', exact: true }));
    expect(navigate).toHaveBeenCalledWith('/rental-book?product=product-1&listing=offer-1');
    expect(mockAddConfirmed).not.toHaveBeenCalled();
  });
  test('a mixed product reveals rental pricing before booking the requested offer', async () => {
    mockProduct.commerceMode = 'SALE_AND_RENTAL';
    mockRentalData.listings.push({ _id: 'selected-offer', title: 'Selected saree', dailyRatePaise: 150000, depositPaise: 10000 });
    const navigate = jest.fn();
    render(<ProductDetail navigate={navigate} route="/product?id=product-1&listing=selected-offer" />);
    expect(screen.getByRole('button', { name: 'View buy details' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: 'Book now' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View rental details' }));
    expect(await screen.findByText('Rental price details')).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Buy or rent this product' })).getByText('₹1,500.00')).toBeInTheDocument();
    expect(window.location.search).toContain('mode=rent');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Book now' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Book now' }));
    expect(navigate).toHaveBeenCalledWith('/rental-book?product=product-1&listing=selected-offer');
    expect(screen.getByLabelText('Rental details')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rent this item' })).not.toBeInTheDocument();
    expect(mockAddConfirmed).not.toHaveBeenCalled();
  });
  test('a mixed rental switches to buy details before confirming the sale checkout', async () => {
    mockProduct.commerceMode = 'SALE_AND_RENTAL';
    mockProduct.sizingMode = 'sized';
    mockAddConfirmed.mockResolvedValue({ ok: true });
    const navigate = jest.fn();
    render(<ProductDetail navigate={navigate} route="/product?id=product-1&mode=rent" />);
    await screen.findByText('Rental price details');
    fireEvent.click(screen.getByRole('button', { name: 'View buy details' }));
    expect(screen.getByText('Price details')).toBeInTheDocument();
    expect(mockAddConfirmed).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Size S' }));
    fireEvent.click(screen.getByRole('button', { name: 'Buy Now' }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/checkout'));
    expect(mockAddConfirmed).toHaveBeenCalledWith(expect.objectContaining({ _id: 'product-1' }), 'S', 'Navy', '', 1);
  });
  test('an unconfigured rental has a clear contact card and blocks booking while sale checkout still works', async () => {
    mockProduct.commerceMode = 'SALE_AND_RENTAL';
    mockProduct.sizingMode = 'sized';
    mockRentalData = { enabled: true, listings: [] };
    mockAddConfirmed.mockResolvedValue({ ok: true });
    const navigate = jest.fn();
    render(<ProductDetail navigate={navigate} route="/product?id=product-1&mode=rent" />);
    expect(await screen.findByText(/Online booking is not available/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Book now' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Book now' }));
    expect(navigate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'View buy details' }));
    fireEvent.click(screen.getByRole('button', { name: 'Size S' }));
    fireEvent.click(screen.getByRole('button', { name: 'Buy Now' }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/checkout'));
  });
  test('shows factual API information without adding generic product claims', async () => {
    render(<ProductDetail navigate={jest.fn()} route="/product?id=product-1" />);

    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith('/reviews/product-1/summary', { silent: true, cacheFirst: true }));

    expect(screen.getByText('Price details')).toBeInTheDocument();
    expect(screen.getByText('Delivery & services')).toBeInTheDocument();
    expect(screen.getByText('Handwoven zari border from the catalog API.')).toBeInTheDocument();
    expect(screen.getAllByText('7-day return window').length).toBeGreaterThan(0);
    expect(screen.getByText('Maximum retail price')).toBeInTheDocument();
    expect(screen.queryByText('Premium fabric')).not.toBeInTheDocument();
    expect(screen.queryByText('Everyday festive')).not.toBeInTheDocument();
    expect(screen.queryByText('Designer')).not.toBeInTheDocument();
  });
  test('sale-only products keep the buy layout even with a stale rental URL', async () => {
    mockProduct.commerceMode = 'SALE_ONLY';
    render(<ProductDetail navigate={jest.fn()} route="/product?id=product-1&mode=rent" />);
    expect(screen.getByText('Price details')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buy Now' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Buy or rent this product' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Rental details')).not.toBeInTheDocument();
  });
  test('rental-only products show fit and booking information without sale stock restrictions', async () => {
    mockProduct.commerceMode = 'RENTAL_ONLY';
    mockRentalData.listings[0] = { ...mockRentalData.listings[0], _id: '222222222222222222222222', size: 'Free size', colour: 'Navy', fitting: { adjustable: true, alterationsAvailable: true, instructions: 'Fitting can be adjusted at pickup.' }, includedItems: [{ label: 'Blouse', quantity: 1 }, { label: 'Dupatta', quantity: 1 }] };
    const navigate = jest.fn();
    render(<RentalBagProvider><ProductDetail navigate={navigate} route="/product?id=product-1" /></RentalBagProvider>);
    expect(await screen.findByText('Rental price details')).toBeInTheDocument();
    expect(screen.getByText('Fitting can be adjusted at pickup.')).toBeInTheDocument();
    expect(screen.getByText('Blouse')).toBeInTheDocument();
    expect(screen.getByText('Dupatta')).toBeInTheDocument();
    expect(screen.queryByText('Maximum retail price')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Buy Now' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Buy or rent this product' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add to rental bag' }));
    expect(JSON.parse(sessionStorage.getItem('rental-bag:default:')).items).toEqual([{ listingId: '222222222222222222222222', quantity: 1 }]);
    expect(mockAddConfirmed).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Book now' }));
    expect(navigate).toHaveBeenCalledWith('/rental-book?product=product-1&listing=222222222222222222222222');
  });
  test('switching between buy and rental preserves the selected sale size', async () => {
    mockProduct.commerceMode = 'SALE_AND_RENTAL';
    mockProduct.sizingMode = 'sized';
    render(<ProductDetail navigate={jest.fn()} route="/product?id=product-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Size M' }));
    fireEvent.click(screen.getByRole('button', { name: 'View rental details' }));
    await screen.findByText('Rental price details');
    expect(screen.queryByRole('button', { name: 'Size M' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View buy details' }));
    expect(screen.getByRole('button', { name: 'Size M' })).toHaveAttribute('aria-pressed', 'true');
    expect(mockAddConfirmed).not.toHaveBeenCalled();
  });
  test('an unavailable rental option keeps its information visible and prevents booking', async () => {
    mockProduct.commerceMode = 'SALE_AND_RENTAL';
    mockRentalData.listings[0].readiness = { ready: false };
    render(<RentalBagProvider><ProductDetail navigate={jest.fn()} route="/product?id=product-1&mode=rent" /></RentalBagProvider>);
    expect(await screen.findByText('Rent per use day')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Book now' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add to rental bag' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'View buy details' }));
    expect(screen.getByRole('button', { name: 'Buy Now' })).toBeEnabled();
  });
  test('rental details can be retried without replacing the product or inventing a price', async () => {
    mockProduct.commerceMode = 'SALE_AND_RENTAL';
    mockApiGet.mockImplementation(path => path.includes('/rentals/products/') ? Promise.reject(new Error('Rental details could not be loaded. Please retry.')) : Promise.resolve(null));
    render(<ProductDetail navigate={jest.fn()} route="/product?id=product-1&mode=rent" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Rental details could not be loaded');
    expect(screen.getByRole('button', { name: 'Book now' })).toBeDisabled();
    expect(screen.queryByText('₹0.00')).not.toBeInTheDocument();
    mockApiGet.mockImplementation(path => Promise.resolve(path.includes('/rentals/products/') ? mockRentalData : null));
    fireEvent.click(screen.getByRole('button', { name: 'Retry rental details' }));
    expect(await screen.findByText('Rent per use day')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Book now' })).toBeEnabled();
  });
});

test('storefront family selector shows live choices and switches to the selected product', async () => {
  mockProduct.variantGroupId = 'family-1';
  mockVariantGroupData = {
    data: {
      optionDefinitions: [{ key: 'color', label: 'Colour' }, { key: 'storage', label: 'Storage' }],
      members: [
        { productId: 'product-1', label: 'Navy / 128 GB', swatch: '#111827', product: mockProduct },
        { productId: 'product-2', label: 'Black / 256 GB', swatch: '#111111', product: { ...mockProduct, _id: 'product-2', slug: 'black-256', name: 'Black 256 GB Saree', price: 1499, stock: 3 } },
      ],
    },
  };
  const navigate = jest.fn();
  render(<ProductDetail navigate={navigate} route="/product?id=product-1" />);

  expect(await screen.findByRole('heading', { name: 'Choose Colour / Storage' })).toBeInTheDocument();
  expect(screen.getByText('2 choices')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Black / 256 GB'));
  expect(navigate).toHaveBeenCalledWith('/product?id=product-2');
});

test('a rental family choice ignores sale stock and preserves the rental detail mode', async () => {
  mockProduct.commerceMode = 'SALE_AND_RENTAL';
  mockProduct.variantGroupId = 'family-1';
  mockVariantGroupData = { data: { optionDefinitions: [{ label: 'Colour' }], members: [
    { productId: 'product-1', label: 'Navy', product: mockProduct },
    { productId: 'product-2', label: 'Rose rental', product: { ...mockProduct, _id: 'product-2', stock: 0, commerceMode: 'RENTAL_ONLY' } },
  ] } };
  const navigate = jest.fn();
  render(<ProductDetail navigate={navigate} route="/product?id=product-1&mode=rent" />);
  const choice = await screen.findByRole('button', { name: /Rose rental/ });
  expect(choice).toBeEnabled();
  fireEvent.click(choice);
  expect(navigate).toHaveBeenCalledWith('/product?id=product-2&mode=rent');
});

describe.each(['mobile', 'desktop'])('%s purchase confirmation', (view) => {
  beforeEach(() => { mockDesktop = view === 'desktop'; });
  function buyButton() {
    return view === 'desktop'
      ? within(screen.getByTestId('desktop-purchase-actions')).getByRole('button', { name: 'Desktop buy now' })
      : screen.getAllByRole('button', { name: 'Buy Now', exact: true }).at(-1);
  }
  test('Buy now waits for the saved bag, prevents duplicate clicks and then opens checkout', async () => {
    let resolveAdd;
    mockAddConfirmed.mockReturnValue(new Promise((resolve) => { resolveAdd = resolve; }));
    const navigate = jest.fn();
    render(<ProductDetail navigate={navigate} route="/product?id=product-1" />);
    const button = buyButton();
    fireEvent.click(button); fireEvent.click(button);
    expect(button).toBeDisabled();
    expect(navigate).not.toHaveBeenCalled();
    expect(mockAddConfirmed).toHaveBeenCalledTimes(1);
    expect(mockAddConfirmed).toHaveBeenCalledWith(expect.objectContaining({ _id: 'product-1' }), '', 'Navy', '', 1);
    expect(screen.queryByRole('button', { name: 'Size Chart' })).not.toBeInTheDocument();
    await act(async () => resolveAdd({ ok: true }));
    expect(navigate).toHaveBeenCalledWith('/checkout');
  });

  test('a rejected bag update stays on the product and displays the server error', async () => {
    mockAddConfirmed.mockResolvedValue({ ok: false, message: 'Only 1 item is available. Please update the quantity.' });
    const navigate = jest.fn();
    render(<ProductDetail navigate={navigate} route="/product?id=product-1" />);
    fireEvent.click(buyButton());
    expect((await screen.findAllByText('Only 1 item is available. Please update the quantity.')).length).toBeGreaterThan(0);
    expect(navigate).not.toHaveBeenCalled();
    expect(buyButton()).toBeEnabled();
  });
});

describe.each(['mobile', 'desktop'])('%s explicit size selection', (view) => {
  beforeEach(() => { mockDesktop = view === 'desktop'; });
  test('does not preselect a size and blocks bag or checkout until the customer chooses one', async () => {
    mockProduct.sizingMode = 'sized';
    mockProduct.sizeChartProfile = 'dress';
    mockProduct.sizeChart = {
      unit: 'in',
      rows: [
        { size: 'S', bust: 36, waist: 30, hips: 38, acrossShoulder: 14, sleeveLength: 18, frontLength: 51 },
        { size: 'M', bust: 38, waist: 32, hips: 40, acrossShoulder: 15, sleeveLength: 18, frontLength: 52 },
      ],
    };
    mockProduct.sizeFitNotes = "The model is wearing size M.";
    mockAddConfirmed.mockResolvedValue({ items: [{ _id: 'line-s', product: mockProduct, productId: 'product-1', size: 'S', color: 'Navy', quantity: 1 }] });
    const navigate = jest.fn();
    render(<ProductDetail navigate={navigate} route="/product?id=product-1" />);

    const buy = view === 'desktop'
      ? within(screen.getByTestId('desktop-purchase-actions')).getByRole('button', { name: 'Desktop buy now' })
      : screen.getAllByRole('button', { name: 'Buy Now', exact: true }).at(-1);
    const sizeButton = view === 'desktop'
      ? within(screen.getByTestId('desktop-purchase-actions')).getByRole('button', { name: 'Desktop size S' })
      : screen.getByRole('button', { name: 'Size S' });

    expect(sizeButton).toHaveAttribute('aria-pressed', 'false');
    if (view === 'desktop') expect(screen.getByTestId('desktop-selected-size')).toHaveTextContent('No size selected');
    fireEvent.click(buy);
    expect(mockAddConfirmed).not.toHaveBeenCalled();
    expect((await screen.findAllByText('Please select a size first.')).length).toBeGreaterThan(0);
    expect(navigate).not.toHaveBeenCalled();

    fireEvent.click(sizeButton);
    expect(sizeButton).toHaveAttribute('aria-pressed', 'true');
    if (view === 'mobile') expect(screen.getAllByLabelText('Selected size S').length).toBeGreaterThan(0);
    if (view === 'mobile') expect(screen.getAllByText(/Bust 36 in · Waist 30 in/).length).toBeGreaterThan(0);
    fireEvent.click(buy);
    await waitFor(() => expect(mockAddConfirmed).toHaveBeenCalledWith(expect.objectContaining({ _id: 'product-1' }), 'S', 'Navy', '', 1));
  });
});

test('a pending Buy now cannot redirect after the customer leaves the product', async () => {
  mockDesktop = true;
  let resolveAdd;
  mockAddConfirmed.mockReturnValue(new Promise((resolve) => { resolveAdd = resolve; }));
  const navigate = jest.fn();
  const { unmount } = render(<ProductDetail navigate={navigate} route="/product?id=product-1" />);
  fireEvent.click(screen.getByRole('button', { name: 'Desktop buy now' }));
  unmount();
  await act(async () => resolveAdd({ ok: true }));
  expect(navigate).not.toHaveBeenCalled();
});
