import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ProductDetail from './ProductDetail';

jest.mock('@reduxjs/toolkit/query', () => ({ skipToken: Symbol('skipToken') }));

const mockProduct = {
  _id: 'product-1',
  slug: 'royal-zari-saree',
  name: 'Royal Zari Silk Saree',
  brand: 'Jassi General Store',
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
let mockDesktop = false;
jest.mock('@mantine/hooks', () => ({ useMediaQuery: () => mockDesktop }));

jest.mock('../../store/apiSlice', () => ({
  useGetProductQuery: () => ({ data: mockProduct, isLoading: false, error: null }),
  useGetProductsQuery: () => ({ data: [] }),
  useGetReviewsQuery: () => ({ data: [] }),
  useGetSettingsQuery: () => ({ data: { freeShippingMinAmount: 999, returnWindowDays: 7 } }),
  useGetVariantGroupQuery: () => ({ data: mockVariantGroupData }),
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

const mockAddConfirmed = jest.fn();
jest.mock('../../context/CartContext', () => ({
  useCart: () => ({ getCartItem: () => null, addToCart: jest.fn(), addToCartConfirmed: (...args) => mockAddConfirmed(...args) }),
}));

jest.mock('../../context/WishlistContext', () => ({
  useWishlist: () => ({ items: [], loading: false, toggleWishlist: jest.fn() }),
}));

const mockApiGet = jest.fn((path) => Promise.resolve(path.endsWith('/summary')
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
  mockAddConfirmed.mockReset();
  mockDesktop = false;
  mockVariantGroupData = null;
  delete mockProduct.variantGroupId;
  delete mockProduct.sizingMode;
  delete mockProduct.sizeChartProfile;
  delete mockProduct.sizeChart;
  delete mockProduct.sizeFitNotes;
});

describe('mobile product details', () => {
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
