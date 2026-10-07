import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import ProductFilterSidebar from './ProductFilterSidebar';

const facets = {
  categories: [{ label: 'Sarees', value: 'sarees-id', count: 2 }],
  prices: [{ label: '₹1,000 – ₹1,999', value: '1000:1999', min: 1000, max: 1999, count: 2 }],
  discounts: [{ label: '20% and above', value: '20', count: 2 }],
  sizes: [{ label: 'M', value: 'M', count: 2 }],
  colors: [{ label: 'Wine', value: 'Wine', count: 2 }],
  fabrics: [],
  occasions: [],
  ratings: [{ label: '4★ & above', value: '4', count: 1 }],
  availability: [
    { label: 'In stock', value: 'in', count: 2 },
    { label: 'Out of stock', value: 'out', count: 0 },
  ],
};

describe('ProductFilterSidebar', () => {
  test('sends category selections through the shared URL-backed filter callback', () => {
    const onFilterChange = jest.fn();
    render(<ProductFilterSidebar facets={facets} filters={{}} onFilterChange={onFilterChange} />);

    fireEvent.click(screen.getByRole('checkbox', { name: /Sarees/i }));

    expect(onFilterChange).toHaveBeenCalledWith('category', 'sarees-id');
  });

  test('applies and clears both price boundaries as one atomic change', () => {
    const onFiltersChange = jest.fn();
    const { rerender } = render(
      <ProductFilterSidebar facets={facets} filters={{}} onFiltersChange={onFiltersChange} />,
    );

    fireEvent.click(screen.getByRole('radio', { name: /₹1,000/ }));
    expect(onFiltersChange).toHaveBeenCalledWith({ minPrice: '1000', maxPrice: '1999' });

    rerender(
      <ProductFilterSidebar
        facets={facets}
        filters={{ minPrice: '1000', maxPrice: '1999' }}
        onFiltersChange={onFiltersChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Remove ₹1,000/ }));
    expect(onFiltersChange).toHaveBeenLastCalledWith({ minPrice: '', maxPrice: '' });
  });

  test('shows removable applied filters and a working clear-all action', () => {
    const onFilterChange = jest.fn();
    const onClearAll = jest.fn();
    render(
      <ProductFilterSidebar
        facets={facets}
        filters={{ color: 'Wine', stock: 'in' }}
        onFilterChange={onFilterChange}
        onClearAll={onClearAll}
      />,
    );

    expect(screen.getByText('Applied filters')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Wine filter' }));
    expect(onFilterChange).toHaveBeenCalledWith('color', '');

    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });
});
