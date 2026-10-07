import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import SizeChartModal from './SizeChartModal';

const product = {
  name: 'Rose Fit and Flare Dress',
  brand: 'Jassi General Store',
  category: 'Dresses',
  price: 1499,
  sizes: ['S'],
  sizeChart: {
    unit: 'in',
    columns: ['acrossShoulder', 'sleeveLength', 'bust', 'waist', 'frontLength', 'hips'],
    rows: [{ size: 'S', acrossShoulder: 14, sleeveLength: 18, bust: 36, waist: 30, frontLength: 51, hips: 38 }],
  },
};

describe('professional size chart', () => {
  test('shows category measurements, changes unit and selects a size', () => {
    const onSelectSize = jest.fn();
    render(<SizeChartModal open product={product} selectedSize="S" onSelectSize={onSelectSize} onClose={jest.fn()} />);

    expect(screen.getByRole('columnheader', { name: /Across shoulder/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Front length/i })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Inseam/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'cm' }));
    expect(screen.getByText('91.4')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Select size S' }));
    expect(onSelectSize).toHaveBeenCalledWith('S');

    fireEvent.click(screen.getByRole('tab', { name: 'How to measure' }));
    expect(screen.getByText(/Measure straight across the back/i)).toBeInTheDocument();
  });
});
