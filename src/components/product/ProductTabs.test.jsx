import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import ProductTabs from './ProductTabs';

describe('desktop product details', () => {
  test('shows factual catalog sections together and opens the size guide', () => {
    const onOpenSizeGuide = jest.fn();
    render(
      <ProductTabs
        product={{
          description: 'A catalog description.\n\nProduct Details:\n• Work: Zari embroidery\n• Neckline: Round neck',
          category: 'Dresses',
          fabric: 'Silk Blend',
          occasion: 'Wedding',
          colors: ['Teal Blue'],
          sizes: ['S', 'M'],
          sku: 'SC-DRESS-1',
          highlights: ['Matching blouse included'],
          careInstructions: 'Dry clean only',
          tags: ['Festive wear'],
        }}
        returnPolicy="7-day return window"
        freeShippingMinimum={999}
        onOpenSizeGuide={onOpenSizeGuide}
      />,
    );

    expect(screen.getByText('A catalog description.')).toBeInTheDocument();
    expect(screen.getByText('Zari embroidery')).toBeInTheDocument();
    expect(screen.getByText('Round neck')).toBeInTheDocument();
    expect(screen.getByText('Matching blouse included')).toBeInTheDocument();
    expect(screen.getByText(/Free shipping on orders of/)).toBeInTheDocument();
    expect(screen.getByText(/7-day return window/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View size guide' }));
    expect(onOpenSizeGuide).toHaveBeenCalledTimes(1);
  });

  test('does not show generic claims for missing catalog fields', () => {
    render(<ProductTabs product={{ sku: 'SC-EMPTY' }} />);

    expect(screen.queryByText(/Premium fabric/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Everyday festive/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Timeless Design/i)).not.toBeInTheDocument();
  });
});
