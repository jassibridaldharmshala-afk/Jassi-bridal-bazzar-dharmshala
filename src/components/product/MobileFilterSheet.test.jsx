import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import MobileFilterSheet from './MobileFilterSheet';

const categories = [
  { _id: 'sarees', name: 'Designer bridal sarees and traditional occasion wear' },
  { _id: 'empty', name: 'Unavailable category' },
];
const facets = {
  categories: [{ value: 'sarees', count: 3 }, { value: 'empty', count: 0 }],
  sizes: [{ value: 'Free Size', label: 'Free Size', count: 3 }],
  colors: [{ value: 'Wine', label: 'Wine', count: 2 }],
  occasions: [{ value: 'Wedding', label: 'Wedding', count: 1 }],
  ratings: [{ value: '4', label: '4 stars and above', count: 1 }],
  availability: [{ value: 'in', label: 'In stock', count: 3 }],
};
const dynamicFacets = [{ key: 'material', label: 'EmbellishmentAndMaterialDetails', options: [{ value: 'Pearls', label: 'HandcraftedPearlAndStoneEmbellishment', count: 2 }] }];

function mount(overrides = {}) {
  const props = { open: true, onClose: jest.fn(), applyDraftFilters: jest.fn(), params: new URLSearchParams(), categories, facets, dynamicFacets, totalResults: 3, ...overrides };
  return { props, ...render(<MobileFilterSheet {...props} />) };
}

function selectSection(name) {
  fireEvent.click(within(screen.getByLabelText('Filter sections')).getByRole('button', { name }));
}

afterEach(() => {
  document.body.style.overflow = '';
  jest.useRealTimers();
});

test('closed sheet does not render or lock page scrolling', () => {
  mount({ open: false });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(document.body.style.overflow).toBe('');
});

test('draft selections stay local until Apply, including dynamic facets and numeric prices', () => {
  const { props } = mount({ params: new URLSearchParams('occasion=Wedding') });
  fireEvent.click(screen.getByRole('button', { name: /Designer bridal/ }));
  expect(screen.getByRole('button', { name: /Unavailable category/ })).toBeDisabled();
  selectSection('Size');
  fireEvent.click(screen.getByRole('button', { name: /Free Size/ }));
  selectSection('Price');
  fireEvent.change(screen.getByLabelText('Min Price'), { target: { value: 'Rs 1,200' } });
  fireEvent.change(screen.getByLabelText('Max Price'), { target: { value: '2500' } });
  expect(screen.getByLabelText('Min Price')).toHaveValue('1200');
  selectSection(dynamicFacets[0].label);
  fireEvent.click(screen.getByRole('button', { name: /HandcraftedPearl/ }));
  expect(props.applyDraftFilters).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Apply Filters' }));
  expect(props.applyDraftFilters).toHaveBeenCalledWith(expect.objectContaining({ category: 'sarees', size: 'Free Size', occasion: 'Wedding', minPrice: '1200', maxPrice: '2500', attr_material: 'Pearls' }));
  expect(props.onClose).toHaveBeenCalledTimes(1);
});

test.each(['Reset', 'Clear All'])('%s clears local filters, including dynamic fields, without applying immediately', (name) => {
  const { props } = mount({ params: new URLSearchParams('category=sarees&color=Wine&minPrice=100&attr_material=Pearls&attr_retired=Stone') });
  fireEvent.click(screen.getByRole('button', { name }));
  expect(screen.getByText(/0 selected/)).toBeInTheDocument();
  expect(props.applyDraftFilters).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Apply Filters' }));
  expect(props.applyDraftFilters).toHaveBeenCalledWith(expect.objectContaining({ category: '', color: '', minPrice: '' }));
  expect(props.applyDraftFilters.mock.calls[0][0]).toHaveProperty('attr_material', '');
  expect(props.applyDraftFilters.mock.calls[0][0]).toHaveProperty('attr_retired', '');
  // Mirrors the listing's merge: Reset must overwrite the old URL value.
  expect({ attr_material: 'Pearls', ...props.applyDraftFilters.mock.calls[0][0] }.attr_material).toBe('');
});

test('cancel and reopen discard unapplied changes but preserve URL-backed filters', () => {
  const { props, rerender } = mount({ params: new URLSearchParams('color=Wine') });
  fireEvent.click(screen.getByRole('button', { name: /Designer bridal/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Close filters' }));
  expect(props.applyDraftFilters).not.toHaveBeenCalled();
  rerender(<MobileFilterSheet {...props} open={false} />);
  rerender(<MobileFilterSheet {...props} />);
  expect(screen.getByRole('button', { name: /Designer bridal/ })).toHaveAttribute('aria-pressed', 'false');
  expect(screen.getByText(/1 selected/)).toBeInTheDocument();
});

test('a selected zero-count category remains removable', () => {
  const { props } = mount({ params: new URLSearchParams('category=empty') });
  const option = screen.getByRole('button', { name: /Unavailable category/ });
  expect(option).toBeEnabled();
  fireEvent.click(option);
  fireEvent.click(screen.getByRole('button', { name: 'Apply Filters' }));
  expect(props.applyDraftFilters).toHaveBeenCalledWith(expect.objectContaining({ category: '' }));
});

test('single-choice and multi-choice sections preserve existing toggle behaviour', () => {
  const { props } = mount();
  selectSection('Color');
  fireEvent.click(screen.getByRole('button', { name: 'Color', expanded: false }));
  fireEvent.click(screen.getByRole('button', { name: /Wine/ }));
  selectSection('Rating');
  fireEvent.click(screen.getByRole('button', { name: '4 stars and above' }));
  fireEvent.click(screen.getByRole('button', { name: '4 stars and above' }));
  selectSection('Availability');
  fireEvent.click(screen.getByRole('button', { name: 'In stock' }));
  fireEvent.click(screen.getByRole('button', { name: 'Apply Filters' }));
  expect(props.applyDraftFilters).toHaveBeenCalledWith(expect.objectContaining({ color: 'Wine', rating: '', stock: 'in' }));
});

test('real header/body/footer rows replace guessed heights; labels and inputs use constrained layout', () => {
  const { container } = mount();
  const dialog = screen.getByRole('dialog');
  expect(Array.from(dialog.children).map(node => node.className.split(' ')[0])).toEqual(['mobile-filter__header', 'mobile-filter__body', 'mobile-filter__footer']);
  expect(container.querySelector('.mobile-filter__body')).not.toHaveAttribute('style');
  expect(screen.getByText(categories[0].name).className).toContain('mobile-filter__label');
  selectSection('Price');
  expect(screen.getByLabelText('Min Price')).toHaveClass('mobile-filter__price-input');
  expect(screen.getByLabelText('Min Price')).toHaveAttribute('inputmode', 'numeric');
});

test('focus remains trapped, Escape uses latest close callback, and prior focus/overflow are restored', () => {
  jest.useFakeTimers();
  const opener = document.createElement('button');
  document.body.appendChild(opener);
  opener.focus();
  document.body.style.overflow = 'auto';
  const { props, rerender, unmount } = mount();
  act(() => jest.runOnlyPendingTimers());
  const dialog = screen.getByRole('dialog');
  expect(dialog).toHaveFocus();
  fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
  expect(screen.getByRole('button', { name: 'Apply Filters' })).toHaveFocus();
  fireEvent.keyDown(window, { key: 'Tab' });
  expect(screen.getByRole('button', { name: 'Clear All' })).toHaveFocus();
  const latestClose = jest.fn();
  rerender(<MobileFilterSheet {...props} onClose={latestClose} />);
  expect(screen.getByRole('button', { name: 'Clear All' })).toHaveFocus();
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(latestClose).toHaveBeenCalledTimes(1);
  expect(props.onClose).not.toHaveBeenCalled();
  unmount();
  expect(document.body.style.overflow).toBe('auto');
  expect(opener).toHaveFocus();
  opener.remove();
});

test('backdrop dismisses but clicks inside the sheet do not', () => {
  const { props, container } = mount();
  fireEvent.mouseDown(screen.getByRole('dialog'));
  expect(props.onClose).not.toHaveBeenCalled();
  fireEvent.mouseDown(container.querySelector('.mobile-filter-overlay'));
  expect(props.onClose).toHaveBeenCalledTimes(1);
});

test('visual viewport tracks keyboard height/offset, respects pinch zoom, and cleans up listeners', () => {
  const previous = Object.getOwnPropertyDescriptor(window, 'visualViewport');
  const viewport = new EventTarget();
  Object.assign(viewport, { height: 700, offsetTop: 0, scale: 1 });
  const remove = jest.spyOn(viewport, 'removeEventListener');
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
  try {
    const { container, unmount } = mount();
    const overlay = container.querySelector('.mobile-filter-overlay');
    expect(overlay).toHaveStyle({ height: '700px', top: '0px' });
    Object.assign(viewport, { height: 320, offsetTop: 24 });
    act(() => viewport.dispatchEvent(new Event('resize')));
    expect(overlay).toHaveStyle({ height: '320px', top: '24px' });
    viewport.scale = 2;
    act(() => viewport.dispatchEvent(new Event('scroll')));
    expect(overlay.style.height).toBe('');
    expect(overlay.style.top).toBe('');
    unmount();
    expect(remove).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function));
  } finally {
    if (previous) Object.defineProperty(window, 'visualViewport', previous);
    else delete window.visualViewport;
  }
});

test('switching to desktop closes the mobile sheet instead of leaving an invisible scroll lock', () => {
  const previous = window.matchMedia;
  let change;
  const remove = jest.fn();
  window.matchMedia = jest.fn(() => ({ matches: false, addEventListener: (_event, handler) => { change = handler; }, removeEventListener: remove }));
  try {
    const { props, unmount } = mount();
    act(() => change({ matches: false }));
    expect(props.onClose).not.toHaveBeenCalled();
    act(() => change({ matches: true }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
    unmount();
    expect(remove).toHaveBeenCalledWith('change', change);
    expect(document.body.style.overflow).toBe('');
  } finally { window.matchMedia = previous; }
});
