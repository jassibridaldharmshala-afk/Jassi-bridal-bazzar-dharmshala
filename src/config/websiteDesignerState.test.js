import { designerReducer, initialDesignerState, setDesignerValue } from './websiteDesignerState';
import { getHomepageSection, mergeWebsiteConfig } from './websiteCustomization';
import { reuseEqualBranches } from '../utils/reuseEqualBranches';

const state = () => designerReducer(initialDesignerState, { type: 'reset', draft: mergeWebsiteConfig() });
const edit = (previous, path, value, time = 0) => designerReducer(previous, { type: 'edit', path, value, time });

test('edits share untouched branches and never mutate an undo snapshot', () => {
  const before = state();
  const after = edit(before, ['colors', 'primary'], '#123456');
  expect(after.draft.homepage).toBe(before.draft.homepage);
  expect(after.draft.mobile).toBe(before.draft.mobile);
  expect(after.draft.colors).not.toBe(before.draft.colors);
  expect(before.draft.colors.primary).toBe('#6d1f34');
  expect(before.draft.theme.enhancedStyles).toBe(false);
  expect(after.draft.theme.enhancedStyles).toBe(true);
  expect(after.undoStack[0]).toBe(before.draft);
  expect(setDesignerValue(after.draft, ['colors', 'primary'], '#123456')).toBe(after.draft);
});

test('1,000 continuous slider changes are one undo step; undo/redo preserve the final value', () => {
  let current = state();
  const original = current.draft;
  for (let i = 0; i < 1000; i += 1) current = edit(current, ['layout', 'gridGap'], 4 + (i % 61), i * 10);
  expect(current.undoStack).toHaveLength(1);
  expect(current.draft.homepage).toBe(original.homepage);
  const undone = designerReducer(current, { type: 'undo' });
  expect(undone.draft).toBe(original);
  expect(designerReducer(undone, { type: 'redo' }).draft).toBe(current.draft);
});

test('separate edits are bounded to 50 undo steps and editing after undo clears redo', () => {
  let current = state();
  for (let i = 0; i < 100; i += 1) current = edit(current, ['branding', 'tagline'], String(i), i * 1000);
  expect(current.undoStack).toHaveLength(50);
  current = designerReducer(current, { type: 'undo' });
  expect(current.redoStack).toHaveLength(1);
  current = edit(current, ['mobile', 'enabled'], true);
  expect(current.redoStack).toHaveLength(0);
  expect(designerReducer(current, { type: 'reset', draft: mergeWebsiteConfig() }).undoStack).toHaveLength(0);
});

test('a late section upload edits by ID even after reordering; other sections are shared', () => {
  const before = state();
  const moved = designerReducer(before, { type: 'move-section', id: 'hero', direction: 1 });
  const after = designerReducer(moved, { type: 'section', id: 'hero', field: 'image', value: '/uploads/hero.jpg', time: 1 });
  expect(after.draft.homepage.sections.find((item) => item.id === 'hero').image).toBe('/uploads/hero.jpg');
  expect(after.draft.homepage.sections.find((item) => item.id === 'categories'))
    .toBe(moved.draft.homepage.sections.find((item) => item.id === 'categories'));
  expect(before.draft.homepage.sections[0].image).toBe('');
});

test('section lookup retains legacy normalization without cloning unrelated theme branches', () => {
  const input = { homepage: { sections: [null, { id: 'hero', heading: 'First' }, { id: 'hero', heading: 'Last', visible: false }] } };
  const expected = mergeWebsiteConfig(input).homepage.sections.find((item) => item.id === 'hero');
  const clone = jest.spyOn(JSON, 'stringify');
  for (let i = 0; i < 100; i += 1) expect(getHomepageSection(input, 'hero')).toEqual(expected);
  expect(clone).not.toHaveBeenCalled();
  clone.mockRestore();
  expect(getHomepageSection(input, 'unknown')).toBeUndefined();
});

test('preview messages reuse identical JSON branches, including equal arrays and deletions', () => {
  const original = mergeWebsiteConfig();
  expect(reuseEqualBranches(original, JSON.parse(JSON.stringify(original)))).toBe(original);
  const incoming = mergeWebsiteConfig({ colors: { primary: '#123456' } });
  const next = reuseEqualBranches(original, incoming);
  expect(next.homepage).toBe(original.homepage);
  expect(next.colors).not.toBe(original.colors);
  expect(reuseEqualBranches({ a: [1, 2], b: 1 }, { a: [1] })).toEqual({ a: [1] });
});

test('reapplying the same look does not grow undo history or invalidate catalog branches', () => {
  const initial = state();
  const changed = designerReducer(initial, { type: 'replace', draft: mergeWebsiteConfig({ colors: { primary: '#123456' } }) });
  expect(changed.draft.homepage).toBe(initial.draft.homepage);
  expect(changed.draft.mobile).toBe(initial.draft.mobile);
  expect(designerReducer(changed, { type: 'replace', draft: JSON.parse(JSON.stringify(changed.draft)) })).toBe(changed);
  expect(designerReducer(changed, { type: 'undo' }).draft).toBe(initial.draft);
});
