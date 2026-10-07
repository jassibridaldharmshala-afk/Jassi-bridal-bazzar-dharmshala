import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import ProductInfoPanel from './ProductInfoPanel';

const baseProps = {
  product: { name: 'Silk Saree', brand: 'Jassi General Store', price: 1299, originalPrice: 2499, discountPercentage: 48 },
  size: '',
  setSize: jest.fn(),
  color: '',
  setColor: jest.fn(),
  quantity: 1,
  setQuantity: jest.fn(),
  deliveryPin: '',
  setDeliveryPin: jest.fn(),
  onCheckDelivery: jest.fn(),
  onAddToCart: jest.fn(),
  onBuyNow: jest.fn(),
  onOrderWhatsApp: jest.fn(),
  onShare: jest.fn(),
  selectedStock: 1,
  isOutOfStock: false,
};

describe('desktop product purchase information', () => {
  beforeEach(() => jest.clearAllMocks());

  test('does not invent unavailable size or colour values', () => {
    render(<ProductInfoPanel {...baseProps} />);

    expect(screen.queryByText(/Select size/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Select colour/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeDisabled();
  });

  test('hides legacy size values for a saree', () => {
    render(<ProductInfoPanel {...baseProps} product={{ ...baseProps.product, sizes: ['S', 'M', 'XL'] }} />);

    expect(screen.queryByText(/Select size/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Size guide/i })).not.toBeInTheDocument();
  });

  test('shows a working factual price breakdown', () => {
    render(<ProductInfoPanel {...baseProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Price details' }));
    expect(screen.getByText('Maximum retail price')).toBeInTheDocument();
    expect(screen.getByText('Product discount')).toBeInTheDocument();
    expect(screen.getByText('Selling price')).toBeInTheDocument();
  });

  test('keeps selectable sizes unselected and shows verified measurements after selection', () => {
    const product = {
      ...baseProps.product,
      name: 'Rose fit and flare dress',
      category: 'Dresses',
      sizingMode: 'sized',
      sizeChartProfile: 'dress',
      sizes: ['S', 'M'],
      sizeFitNotes: 'The model is wearing size M.',
      sizeChart: { unit: 'in', rows: [{ size: 'S', acrossShoulder: 14, sleeveLength: 18, bust: 36, waist: 30, frontLength: 51, hips: 38 }] },
    };
    const { rerender } = render(<ProductInfoPanel {...baseProps} product={product} />);

    expect(screen.getByRole('button', { name: 'Size S' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Choose a size before adding this product to your bag.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Selected size S')).not.toBeInTheDocument();

    rerender(<ProductInfoPanel {...baseProps} product={product} size="S" />);
    expect(screen.getByRole('button', { name: 'Size S' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Selected size S')).toBeInTheDocument();
    expect(screen.getByText(/Bust 36 in · Waist 30 in/)).toBeInTheDocument();
    expect(screen.getByText('The model is wearing size M.')).toBeInTheDocument();
  });

  test('shows delivery results returned by the delivery workflow', () => {
    render(
      <ProductInfoPanel
        {...baseProps}
        deliveryPin="110001"
        deliveryResult={{ status: 'success', title: 'Options for 110001', lines: ['This order qualifies for free shipping.', 'Cash on Delivery is available.'] }}
      />,
    );

    expect(screen.getByText('Options for 110001')).toBeInTheDocument();
    expect(screen.getByText('This order qualifies for free shipping.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(baseProps.onCheckDelivery).toHaveBeenCalledWith('110001');
  });
});
