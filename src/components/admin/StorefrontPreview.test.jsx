import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import StorefrontPreview, { PREVIEW_UPDATE_DELAY } from './StorefrontPreview';
import { mergeWebsiteConfig } from '../../config/websiteCustomization';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('each preview uses a real device width with a restricted frame', () => {
  const { rerender } = render(<StorefrontPreview config={mergeWebsiteConfig()} device="desktop" />);
  const frame = screen.getByTitle('desktop storefront preview');
  expect(frame).toHaveStyle({ width: '1440px' });
  expect(frame.getAttribute('sandbox')).toBe('allow-scripts allow-same-origin');
  rerender(<StorefrontPreview config={mergeWebsiteConfig()} device="mobile" />);
  expect(screen.getByTitle('mobile storefront preview')).toHaveStyle({ width: '390px' });
});

function connectFrame() {
  const frame = screen.getByTitle('desktop storefront preview');
  const token = new URL(frame.src).searchParams.get('token');
  const send = jest.spyOn(frame.contentWindow, 'postMessage').mockImplementation(() => {});
  fireEvent(window, new MessageEvent('message', { source: frame.contentWindow, origin: window.location.origin, data: { type: 'samira:preview-ready', token } }));
  return { frame, send, token };
}

test('rapid changes are coalesced, and invalid input never remounts or sends a broken draft', () => {
  const config = mergeWebsiteConfig();
  const { rerender, unmount } = render(<StorefrontPreview config={config} device="desktop" />);
  const { frame, send } = connectFrame();
  act(() => jest.advanceTimersByTime(PREVIEW_UPDATE_DELAY));
  expect(send).toHaveBeenCalledTimes(1); // No duplicate handshake update.
  for (let i = 0; i < 20; i += 1) {
    rerender(<StorefrontPreview config={mergeWebsiteConfig({ branding: { tagline: String(i) } })} device="desktop" />);
    act(() => jest.advanceTimersByTime(50));
  }
  expect(send).toHaveBeenCalledTimes(1);
  rerender(<StorefrontPreview config={mergeWebsiteConfig({ colors: { primary: '#' } })} valid={false} device="desktop" />);
  act(() => jest.advanceTimersByTime(1000));
  expect(screen.getByTitle('desktop storefront preview')).toBe(frame);
  expect(send).toHaveBeenCalledTimes(1);
  const next = mergeWebsiteConfig({ colors: { primary: '#123456' } });
  rerender(<StorefrontPreview config={next} valid device="desktop" />);
  act(() => jest.advanceTimersByTime(PREVIEW_UPDATE_DELAY));
  expect(send).toHaveBeenCalledTimes(2);
  expect(send.mock.calls[1][0].config).toBe(next);
  rerender(<StorefrontPreview config={config} device="desktop" />);
  unmount();
  act(() => jest.advanceTimersByTime(1000));
  expect(send).toHaveBeenCalledTimes(2);
});

test('manual preview sends only on demand and resumes with the latest draft', () => {
  const { rerender } = render(<StorefrontPreview config={mergeWebsiteConfig()} device="desktop" />);
  const { send } = connectFrame();
  fireEvent.click(screen.getByRole('button', { name: 'Pause live preview' }));
  const changed = mergeWebsiteConfig({ branding: { tagline: 'Latest' } });
  rerender(<StorefrontPreview config={changed} device="desktop" />);
  act(() => jest.advanceTimersByTime(1000));
  expect(send).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Update preview' }));
  expect(send).toHaveBeenCalledTimes(2);
  expect(send.mock.calls[1][0].config).toBe(changed);
  const last = mergeWebsiteConfig({ branding: { tagline: 'Resumed' } });
  rerender(<StorefrontPreview config={last} device="desktop" />);
  fireEvent.click(screen.getByRole('button', { name: 'Resume live preview' }));
  act(() => jest.advanceTimersByTime(PREVIEW_UPDATE_DELAY));
  expect(send.mock.calls[2][0].config).toBe(last);
});

test('offscreen previews defer changes and catch up once visible', () => {
  let intersect;
  window.IntersectionObserver = jest.fn((callback) => {
    intersect = callback;
    return { observe: jest.fn(), disconnect: jest.fn() };
  });
  const { rerender, unmount } = render(<StorefrontPreview config={mergeWebsiteConfig()} device="desktop" />);
  const { send } = connectFrame();
  act(() => intersect([{ isIntersecting: false }]));
  const next = mergeWebsiteConfig({ branding: { tagline: 'While offscreen' } });
  rerender(<StorefrontPreview config={next} device="desktop" />);
  act(() => jest.advanceTimersByTime(1000));
  expect(send).toHaveBeenCalledTimes(1);
  act(() => intersect([{ isIntersecting: true }]));
  act(() => jest.advanceTimersByTime(PREVIEW_UPDATE_DELAY));
  expect(send.mock.calls[1][0].config).toBe(next);
  unmount();
  delete window.IntersectionObserver;
});

test('preview render failures offer isolated recovery without resetting editor data', () => {
  render(<StorefrontPreview config={mergeWebsiteConfig()} device="desktop" />);
  const { frame, token } = connectFrame();
  fireEvent(window, new MessageEvent('message', { source: frame.contentWindow, origin: window.location.origin, data: { type: 'samira:preview-error', token } }));
  expect(screen.getByText(/Preview could not render/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry preview' }));
  expect(screen.getByTitle('desktop storefront preview')).not.toBe(frame);
});

test('only the matching frame handshake receives the private draft, followed by debounced updates', () => {
  const config = mergeWebsiteConfig({ branding: { websiteName: 'Private draft' } });
  const { rerender } = render(<StorefrontPreview config={config} device="desktop" />);
  const frame = screen.getByTitle('desktop storefront preview');
  const token = new URL(frame.src).searchParams.get('token');
  const send = jest.spyOn(frame.contentWindow, 'postMessage').mockImplementation(() => {});
  fireEvent(window, new MessageEvent('message', { source: frame.contentWindow, origin: 'https://untrusted.test', data: { type: 'samira:preview-ready', token } }));
  expect(send).not.toHaveBeenCalled();
  fireEvent(window, new MessageEvent('message', { source: frame.contentWindow, origin: window.location.origin, data: { type: 'samira:preview-ready', token: 'wrong' } }));
  expect(send).not.toHaveBeenCalled();
  fireEvent(window, new MessageEvent('message', { source: frame.contentWindow, origin: window.location.origin, data: { type: 'samira:preview-ready', token } }));
  expect(send).toHaveBeenCalledWith(expect.objectContaining({ config, token }), window.location.origin);
  const changed = mergeWebsiteConfig({ colors: { primary: '#123456' } });
  rerender(<StorefrontPreview config={changed} device="desktop" />);
  act(() => jest.advanceTimersByTime(PREVIEW_UPDATE_DELAY + 10));
  expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ config: changed }), window.location.origin);
  fireEvent.change(screen.getByLabelText('Preview page'), { target: { value: '/products' } });
  act(() => jest.advanceTimersByTime(PREVIEW_UPDATE_DELAY + 10));
  expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ path: '/products' }), window.location.origin);
});

test('preview startup timeout offers a retry and never discards the draft', () => {
  render(<StorefrontPreview config={mergeWebsiteConfig()} device="mobile" />);
  const first = screen.getByTitle('mobile storefront preview');
  act(() => jest.advanceTimersByTime(21000));
  expect(screen.getByText(/Your draft is safe/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry preview' }));
  expect(screen.getByTitle('mobile storefront preview')).not.toBe(first);
  expect(screen.getByText('Loading storefront preview…')).toBeInTheDocument();
});
