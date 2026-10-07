import { allowedSmartPath, applySmartReview, emptySmartValue, reviewSmartSuggestions, smartCurrent, smartEndpoint, smartRowUnchanged, writeSmartValue } from './workflowSmartFill';
const preview = suggestions => ({ suggestions });
const row = (path, value, extra = {}) => ({ path, value, label: path, source: 'notes', ...extra });

test('empty values exclude intentional zero/false and existing strings', () => {
  for (const value of [undefined, null, '', []]) expect(emptySmartValue(value)).toBe(true);
  for (const value of [0, '0', false, 'Existing', ['one']]) expect(emptySmartValue(value)).toBe(false);
});
test('review deduplicates allowed paths, rejects dangerous/inventory/provider paths and unexpected value types', () => {
  const rows = reviewSmartSuggestions(preview([row('description', 'Draft'), row('description', 'Duplicate'), row('__proto__.polluted', 'yes'), row('price', '1'), row('description', {}), row('tags', ['valid', {}])]), {}, 'catalog');
  expect(rows).toHaveLength(1); expect(rows[0].value).toBe('Draft'); expect({}.polluted).toBeUndefined();
  expect(writeSmartValue({}, '__proto__.polluted', true)).toEqual({});
  expect(allowedSmartPath('store', 'sms.apiKey', {})).toBe(false);
});
test('apply protects existing fields and revisions; only explicit replacement can overwrite unchanged values', () => {
  const form = { name: 'Saved category', description: '', stock: 10 };
  const rows = reviewSmartSuggestions(preview([row('name', 'New name'), row('description', 'Draft')]), form, 'category');
  const result = applySmartReview(form, rows, ['name', 'description']);
  expect(result.form).toEqual({ ...form, description: 'Draft' }); expect(form.description).toBe('');
  const changed = applySmartReview({ ...form, name: 'Manual edit' }, rows, ['name'], true);
  expect(changed.applied).toHaveLength(0); expect(changed.form.name).toBe('Manual edit');
  expect(applySmartReview(form, rows, ['name'], true).form.name).toBe('New name');
});
test('undo restores last fill but preserves any later manual edits', () => {
  const original = { name: '', description: '' };
  const rows = reviewSmartSuggestions(preview([row('name', 'Draft name'), row('description', 'Draft copy')]), original, 'category');
  const result = applySmartReview(original, rows, ['name', 'description']);
  const undo = applySmartReview({ ...result.form, name: 'Manually refined' }, result.applied, ['name', 'description'], true, true);
  expect(undo.form).toEqual({ name: 'Manually refined', description: '' });
});
test('related financial rules cannot be partially applied or use a conflicting half of the preview', () => {
  const form = { type: 'Flat', discountValue: '' };
  const rows = reviewSmartSuggestions(preview([row('type', 'Percentage', { group: 'discount' }), row('discountValue', '10', { group: 'discount' })]), form, 'coupon');
  expect(applySmartReview(form, rows, ['discountValue']).applied).toHaveLength(0);
  expect(applySmartReview(form, rows, ['type', 'discountValue'], true).form).toEqual({ type: 'Percentage', discountValue: '10' });
  expect(applySmartReview({ ...form, type: 'Manual' }, rows, ['type', 'discountValue'], true).applied).toHaveLength(0);
});
test('nested and array writes are immutable and sections remain anchored during designer reordering', () => {
  const form = { colors: { primary: '#111111' }, homepage: { sections: [{ id: 'hero', heading: '' }, { id: 'newsletter', heading: '' }] } };
  const rows = reviewSmartSuggestions(preview([row('colors.primary', '#222222'), row('homepage.sections.0.heading', 'Hero copy'), row('homepage.sections.99.heading', 'Invalid')]), form, 'website');
  const result = applySmartReview(form, rows, rows.map(item => item.path), true);
  expect(result.form.homepage.sections[0].heading).toBe('Hero copy'); expect(form.homepage.sections[0].heading).toBe('');
  const reordered = { ...form, homepage: { sections: [...form.homepage.sections].reverse() } };
  expect(smartRowUnchanged(reordered, rows[1])).toBe(false);
  expect(applySmartReview(reordered, rows, ['homepage.sections.0.heading'], true).applied).toHaveLength(0);
});
test('minimal form snapshots never include unrelated credentials, banking or customer PII', () => {
  const form = { storeName: 'Nishaya', smsApiKey: 'private', payment: { apiKey: 'private' }, bankAccount: 'private', contactEmail: 'support@example.com', invoicePrefix: 'NISH' };
  const current = smartCurrent(form, 'store');
  expect(current.storeName).toBe('Nishaya'); expect(JSON.stringify(current)).not.toContain('private');
  const website = smartCurrent({ ...form, colors: { primary: '#111111', secret: 'private' }, footer: { description: 'Brand story', secret: 'private' }, homepage: { sections: [{ id: 'hero', heading: 'Headline', customerId: 'private', image: 'private' }] } }, 'website');
  expect(JSON.stringify(website)).not.toContain('private');
  expect(website.homepage.sections[0]).toEqual({ id: 'hero', heading: 'Headline', description: undefined });
});
test('store query scope survives every assistant endpoint', () => {
  expect(smartEndpoint('/admin/smart-fill?storeId=123', 'catalog/save')).toBe('/admin/smart-fill/catalog/save?storeId=123');
});
