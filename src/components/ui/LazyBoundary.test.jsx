import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import LazyBoundary from './LazyBoundary';
function Broken() { throw new Error('ChunkLoadError'); }
beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { jest.restoreAllMocks(); });

test('chunk failure shows recoverable feedback without removing the surrounding page', () => {
  render(<><p>Store navigation</p><LazyBoundary><Broken /></LazyBoundary></>);
  expect(screen.getByText('Store navigation')).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('This section could not load');
  expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument();
});

test('navigating to another page recovers from a previous chunk error', () => {
  const { rerender } = render(<LazyBoundary resetKey="/products"><Broken /></LazyBoundary>);
  rerender(<LazyBoundary resetKey="/cart"><p>Cart ready</p></LazyBoundary>);
  expect(screen.getByText('Cart ready')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
