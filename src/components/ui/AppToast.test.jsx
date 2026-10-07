import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import AppToast from './AppToast';

test.each(['success', 'error', 'warning', 'info'])('renders a quiet, accessible %s toast without a modal or focus theft', type => {
  const dismiss = jest.fn();
  render(<><button autoFocus>Continue shopping</button><AppToast toast={{ message: 'Customer mode active', type }} onDismiss={dismiss} /></>);
  expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  expect(screen.getByRole('status')).toHaveAttribute('aria-atomic', 'true');
  expect(screen.getByRole('status').closest('.app-toast')).toHaveClass('app-toast--' + type);
  expect(screen.getByRole('button', { name: 'Continue shopping' })).toHaveFocus();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
  expect(dismiss).toHaveBeenCalledTimes(1);
});

test('supports titled/long messages, treats copy as text and defaults unknown types safely', () => {
  render(<AppToast toast={{ title: 'Something needs attention', message: '<script>not HTML</script> ' + 'Long message '.repeat(60), type: 'constructor' }} onDismiss={jest.fn()} activeMode="seller" />);
  expect(screen.getByText('Something needs attention')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('<script>not HTML</script>');
  expect(screen.getByRole('status').closest('.app-toast')).toHaveClass('app-toast--info');
  expect(screen.getByRole('status').closest('.app-toast-region')).toHaveAttribute('data-mode', 'seller');
});

test('does not render an empty overlay when no notification is active', () => {
  const { container } = render(<AppToast toast={null} onDismiss={jest.fn()} />);
  expect(container).toBeEmptyDOMElement();
});

test('styles place every mode top-right on desktop/mobile, respect safe areas and support reduced motion', () => {
  const css = fs.readFileSync(path.join(__dirname, 'AppToast.css'), 'utf8');
  expect(css).toContain('var(--site-surface');
  expect(css).toContain('var(--site-text');
  expect(css).toContain('var(--site-primary');
  expect(css).toContain('max-width: 1023px');
  expect(css).toContain('position: fixed');
  expect(css).toContain('inset-inline-end: max(24px');
  expect(css).toContain('inset-inline-end: max(12px');
  expect(css).toContain('top: calc(24px + env(safe-area-inset-top');
  expect(css).toContain('top: calc(16px + env(safe-area-inset-top');
  expect(css).toContain('width: 44px; height: 44px');
  expect(css).toContain('prefers-reduced-motion: reduce');
  expect(css).toContain('overflow-wrap: anywhere');
  expect(css).not.toMatch(/\bbottom\s*:/);
});
