import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import catalogReducer from '../../store/catalogSlice';
import Products from './Products';
import RentalShop from './RentalShop';

let mockQuery;
let mockRequest;
jest.mock('../../store/apiSlice', () => ({
  useGetProductsQuery: params => { mockRequest = params; return mockQuery; },
  useGetCategoriesQuery: () => ({ data: [] }),
  useGetBannersQuery: () => ({ data: [] }),
}));
jest.mock('../../context/StorefrontContext', () => ({ useStorefront: () => ({ storeSlug: '' }) }));
jest.mock('../../services/api', () => ({ get: () => Promise.resolve({}) }));
jest.mock('../../utils/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('../../components/product/ProductGrid', () => ({ products, shoppingMode }) => <div data-testid="mobile-grid" data-mode={shoppingMode || 'buy'}>{products.map(product => <span key={product.id}>{product.name}</span>)}</div>);
jest.mock('../../components/product/MobileFilterSheet', () => () => null);
jest.mock('../../components/seo/SeoHead', () => () => null);
jest.mock('../../components/banners/StorefrontBannerSlot', () => () => null);
jest.mock('./DesktopNewArrivalsLayout', () => ({ shoppingMode, clearFilterParams }) => <div data-testid="desktop-grid" data-mode={shoppingMode || 'buy'}><button onClick={clearFilterParams}>Clear shared filters</button></div>);

function mount() {
  const store = configureStore({ reducer: { catalog: catalogReducer } });
  return render(<Provider store={store}><Products navigate={jest.fn()} /></Provider>);
}

beforeEach(() => {
  mockQuery = { currentData: undefined, isLoading: true, isFetching: true, refetch: jest.fn() };
});

test('first mobile catalog load has a skeleton instead of an empty area awaiting the global spinner', async () => {
  await act(async () => { mount(); });
  expect(screen.getByRole('status', { name: 'Loading the collection' })).toBeInTheDocument();
});

test('a background refresh preserves already-loaded products and a failed refresh keeps them visible with retry', async () => {
  mockQuery = { ...mockQuery, currentData: { items: [{ _id: 'one', name: 'Cached Saree', price: 999 }], page: 1, total: 1, totalPages: 1 }, isLoading: false };
  const view = mount();
  expect(await screen.findByText('Cached Saree')).toBeInTheDocument();
  expect(screen.queryByLabelText('Loading the collection')).not.toBeInTheDocument();
  mockQuery = { ...mockQuery, isFetching: false, error: { status: 'TIMEOUT_ERROR' } };
  const store = configureStore({ reducer: { catalog: catalogReducer } });
  view.rerender(<Provider store={store}><Products navigate={jest.fn()} /></Provider>);
  expect(screen.getByText('Cached Saree')).toBeInTheDocument();
  expect(screen.getByText(/Showing the last loaded products/)).toBeInTheDocument();
});

test('rent uses both existing product layouts and clearing filters retains the rental mode', async () => {
  mockQuery = { ...mockQuery, currentData: { items: [{ _id: 'one', name: 'Rental lehenga', rentalPreview: { dailyRatePaise: 50000 } }], page: 1, total: 1, totalPages: 1 }, isLoading: false, isFetching: false };
  const store = configureStore({ reducer: { catalog: catalogReducer } });
  const navigate = jest.fn();
  render(<Provider store={store}><Products route="/products?mode=rent&category=lehenga" navigate={navigate} /></Provider>);
  expect(await screen.findByText('Rental lehenga')).toBeInTheDocument();
  expect(mockRequest).toMatchObject({ mode: 'rent', category: 'lehenga', limit: 24 });
  expect(screen.getByTestId('desktop-grid')).toHaveAttribute('data-mode', 'rental');
  expect(screen.getByTestId('mobile-grid')).toHaveAttribute('data-mode', 'rental');
  expect(screen.queryByRole('option', { name: 'Discount' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Clear shared filters'));
  expect(navigate).toHaveBeenLastCalledWith('/products?mode=rent');
});

test('old rental links retain search, colour and rent limits in the shared catalogue', async () => {
  const store = configureStore({ reducer: { catalog: catalogReducer } });
  await act(async () => render(<Provider store={store}><RentalShop route="/rental-book?search=bridal&colour=Pink&minRent=300&maxRent=800&sort=title" navigate={jest.fn()} /></Provider>));
  expect(mockRequest).toMatchObject({ mode: 'rent', search: 'bridal', color: 'Pink', minPrice: '300', maxPrice: '800' });
  expect(mockRequest.sort).toBeUndefined(); // The catalogue omits its default newest sort.
  expect(screen.getByRole('link', { name: 'Rental' })).toHaveAttribute('aria-current', 'page');
});
