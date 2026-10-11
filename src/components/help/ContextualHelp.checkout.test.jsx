import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ContextualHelp from './ContextualHelp';

test.each(['/', '/products', '/product/lehenga?mode=rent', '/rental-cart', '/rental-checkout', '/orders', '/store/jassi/orders?type=rental', '/order-detail?id=one', '/admin/products', '/admin/rentals', '/admin/settings'])('help stays outside the utility row and remains available on %s', route => {
  render(<><div data-rental-checkout-utilities role="group" aria-label="Page utilities" /><ContextualHelp route={route} /></>);
  expect(screen.getByRole('button', { name: 'Open help for this page' })).toBeInTheDocument();
  expect(within(screen.getByRole('group', { name: 'Page utilities' })).queryByRole('button')).not.toBeInTheDocument();
});

test('floating rental help restores focus after closing and stays available when the page changes', async () => {
  const view = render(<><div data-rental-checkout-utilities role="group" aria-label="Page utilities" /><ContextualHelp route="/store/bridal-shop/rental-checkout" /></>);
  const trigger = screen.getByRole('button', { name: 'Open help for this page' });
  fireEvent.click(trigger);
  await screen.findByRole('dialog');
  await screen.findByRole('heading', { name: 'Book a rental' });
  fireEvent.click(screen.getByRole('button', { name: 'Close user manual' }));
  await waitFor(() => expect(trigger).toHaveFocus());
  fireEvent.click(trigger);
  await screen.findByRole('dialog');
  view.rerender(<><div data-rental-checkout-utilities role="group" aria-label="Page utilities" /><ContextualHelp route="/contact" /></>);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(within(screen.getByRole('group', { name: 'Page utilities' })).queryByRole('button')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Open help for this page' })).toBeInTheDocument();
});
