import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import catalogReducer from '../../store/catalogSlice';
import Products from './Products';

let mockQuery;
jest.mock('../../store/apiSlice', () => ({
  useGetProductsQuery: () => mockQuery,
  useGetCategoriesQuery: () => ({ data: [] }),
  useGetBannersQuery: () => ({ data: [] }),
}));
jest.mock('../../context/StorefrontContext', () => ({ useStorefront: () => ({ storeSlug: '' }) }));
jest.mock('../../services/api', () => ({ get: () => Promise.resolve({}) }));
jest.mock('../../utils/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('../../components/product/ProductGrid', () => ({ products }) => <div>{products.map(product => <span key={product.id}>{product.name}</span>)}</div>);
jest.mock('../../components/product/MobileFilterSheet', () => () => null);
jest.mock('../../components/seo/SeoHead', () => () => null);
jest.mock('../../components/banners/StorefrontBannerSlot', () => () => null);
jest.mock('./DesktopNewArrivalsLayout', () => () => null);

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
