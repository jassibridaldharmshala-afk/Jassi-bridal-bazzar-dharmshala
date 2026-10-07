import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProductPosterModal from './ProductPosterModal';
let pendingImages;
let originalImage;
beforeEach(() => {
  pendingImages = [];
  originalImage = window.Image;
  window.Image = class { constructor() { pendingImages.push(this); } };
  const context = new Proxy({ createLinearGradient: () => ({ addColorStop: () => {} }) }, { get: (target, key) => target[key] || (() => {}) });
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
  jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,poster');
});
afterEach(() => { window.Image = originalImage; jest.restoreAllMocks(); });
const product = { _id: 'product', slug: 'rose-saree', name: 'Rose saree', images: [{ url: 'https://media.example/rose.jpg' }], price: 999 };
test('poster download stays disabled until rendering completes and switches clear the previous image', async () => {
  const view = render(<ProductPosterModal open product={product} />);
  expect(screen.getByRole('button', { name: 'Download PNG' })).toBeDisabled();
  await act(async () => { pendingImages[0].onload(); });
  expect(screen.getByRole('button', { name: 'Download PNG' })).toBeEnabled();
  const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
    expect(this.download).toBe('rose-saree-poster.png');
    expect(this.href).toBe('data:image/png;base64,poster');
  });
  fireEvent.click(screen.getByRole('button', { name: 'Download PNG' }));
  expect(click).toHaveBeenCalledTimes(1);
  view.rerender(<ProductPosterModal open product={{ ...product, _id: 'next', name: 'Green saree' }} />);
  expect(screen.queryByRole('img', { name: 'Poster preview' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Download PNG' })).toBeDisabled();
  await act(async () => { pendingImages[1].onload(); });
  expect(screen.getByRole('button', { name: 'Download PNG' })).toBeEnabled();
});
test('failed poster generation retries and clipboard denial preserves a selectable product link', async () => {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: jest.fn().mockRejectedValue(new Error('Denied')) } });
  render(<ProductPosterModal open product={product} />);
  await act(async () => { pendingImages[0].onerror(new Error('Image could not load')); });
  fireEvent.click(screen.getByRole('button', { name: 'Retry poster' }));
  await act(async () => { pendingImages[1].onload(); });
  fireEvent.click(screen.getByRole('button', { name: 'Copy product link' }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Copy the product link below'));
  expect(screen.getByRole('textbox', { name: 'Product link' })).toHaveValue(window.location.origin + '/product/rose-saree');
});
