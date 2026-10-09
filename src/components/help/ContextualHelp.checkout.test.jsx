import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ContextualHelp from './ContextualHelp';

test('rental checkout help mounts in the utility row and restores the same trigger after closing', async () => {
  const view = render(<><div data-rental-checkout-utilities /><ContextualHelp route="/store/bridal-shop/rental-checkout" /></>);
  const target = document.querySelector('[data-rental-checkout-utilities]');
  const trigger = await within(target).findByRole('button', { name: 'Open help for this page' });
  fireEvent.click(trigger);
  await screen.findByRole('dialog');
  await screen.findByRole('heading', { name: 'Book a rental' });
  fireEvent.click(screen.getByRole('button', { name: 'Close user manual' }));
  await waitFor(() => expect(trigger).toHaveFocus());
  view.rerender(<><div data-rental-checkout-utilities /><ContextualHelp route="/contact" /></>);
  await waitFor(() => expect(within(target).queryByRole('button')).not.toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Open help for this page' })).toBeInTheDocument();
});
