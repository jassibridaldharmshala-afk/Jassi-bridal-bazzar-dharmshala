import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import ProductImageCarousel from './ProductImageCarousel';
jest.mock('./ProductVisual', () => ({ ProductVisual: () => <p>No image available</p> }));
const product = { name: 'Silk saree', images: [
  { url: 'https://images.example.test/front.jpg' },
  { url: 'https://images.example.test/back.jpg' },
  { url: 'https://images.example.test/detail.jpg' },
] };

test('only the first slide has an image request at initial render', () => {
  const { container } = render(<ProductImageCarousel product={product} />);
  expect(container.querySelectorAll('img')).toHaveLength(1);
  expect(screen.getByRole('img')).toHaveAttribute('src', product.images[0].url);
  expect(screen.getByRole('img')).toHaveAttribute('loading', 'lazy');
  expect(screen.getByRole('img')).toHaveAttribute('decoding', 'async');
});

test('next/previous lazily load visited slides while retaining images for transitions', () => {
  const open = jest.fn();
  const { container } = render(<ProductImageCarousel product={product} onOpen={open} />);
  fireEvent.click(screen.getByRole('button', { name: 'Next image' }));
  expect(container.querySelectorAll('img')).toHaveLength(2);
  expect(container.querySelector('img[src$="detail.jpg"]')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Previous image' }));
  expect(container.querySelectorAll('img')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Previous image' }));
  expect(container.querySelectorAll('img')).toHaveLength(3);
  expect(open).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'View Silk saree' }));
  expect(open).toHaveBeenCalledTimes(1);
});

test('replacing the product gallery resets safely to its first image', () => {
  const { rerender, container } = render(<ProductImageCarousel product={product} />);
  fireEvent.click(screen.getByRole('button', { name: 'Previous image' }));
  rerender(<ProductImageCarousel product={{ ...product, images: [{ url: 'https://images.example.test/new.jpg' }] }} />);
  expect(container.querySelectorAll('img')).toHaveLength(1);
  expect(screen.getByRole('img')).toHaveAttribute('src', 'https://images.example.test/new.jpg');
  expect(screen.queryByRole('button', { name: 'Next image' })).not.toBeInTheDocument();
});

test('missing images keep the original fallback', () => {
  render(<ProductImageCarousel product={{ name: 'Product', images: [] }} />);
  expect(screen.getByText('No image available')).toBeInTheDocument();
});
