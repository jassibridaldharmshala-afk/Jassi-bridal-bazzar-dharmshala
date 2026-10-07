import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import DeferredMount from './DeferredMount';

let intersect;
let disconnect;
const originalObserver = window.IntersectionObserver;
beforeEach(() => {
  disconnect = jest.fn();
  window.IntersectionObserver = jest.fn((callback) => {
    intersect = callback;
    return { observe: jest.fn(), disconnect };
  });
});
afterEach(() => { window.IntersectionObserver = originalObserver; });

test('offscreen content is not mounted and reserved space stays available', () => {
  const child = jest.fn(() => <p>Heavy preview</p>);
  const Child = child;
  const { container } = render(<DeferredMount minHeight={500}><Child /></DeferredMount>);
  expect(child).not.toHaveBeenCalled();
  expect(container.firstChild).toHaveStyle({ minHeight: '500px' });
  act(() => intersect([{ isIntersecting: false }]));
  expect(child).not.toHaveBeenCalled();
  act(() => intersect([{ isIntersecting: true }]));
  expect(screen.getByText('Heavy preview')).toBeInTheDocument();
  expect(disconnect).toHaveBeenCalled();
});

test('once visible, content and local state survive scrolling away', () => {
  function Child() { const [value, setValue] = useState(''); return <input aria-label="Draft" value={value} onChange={(event) => setValue(event.target.value)} />; }
  render(<DeferredMount><Child /></DeferredMount>);
  act(() => intersect([{ isIntersecting: true }]));
  fireEvent.change(screen.getByLabelText('Draft'), { target: { value: 'Keep my work' } });
  act(() => intersect([{ isIntersecting: false }]));
  expect(screen.getByLabelText('Draft')).toHaveValue('Keep my work');
});

test('manual loading works without waiting for the observer', () => {
  render(<DeferredMount label="storefront preview"><p>Preview ready</p></DeferredMount>);
  fireEvent.click(screen.getByRole('button', { name: 'Load storefront preview now' }));
  expect(screen.getByText('Preview ready')).toBeInTheDocument();
});

test('older browsers render the content without needing IntersectionObserver', () => {
  delete window.IntersectionObserver;
  render(<DeferredMount><p>Preview ready</p></DeferredMount>);
  expect(screen.getByText('Preview ready')).toBeInTheDocument();
});

test('unmount disconnects observers and ignores late callbacks', () => {
  const { unmount } = render(<DeferredMount><p>Preview ready</p></DeferredMount>);
  unmount();
  act(() => intersect([{ isIntersecting: true }]));
  expect(disconnect).toHaveBeenCalled();
});
