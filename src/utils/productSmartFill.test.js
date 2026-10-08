import { applySmartPatch, selectedSmartPatch, suggestionRows } from './productSmartFill';
import { usesGarmentSizing } from './productSizing';
import { productAttributeDefinitions } from './catalogOptions';
import { buildAssistantSuggestions } from './productAssistant';
import { applyVisionSuggestion, buildQuickAddPayload } from './quickAddProduct';

const structure = { industry: 'boutique', features: { sizing: true }, attributes: [{ key: 'size', label: 'Size' }, { key: 'pattern', label: 'Pattern' }], categoryDefinitions: [{ key: 'jewellery', name: 'Bridal Jewellery', attributes: [{ key: 'jewellery_type', label: 'Jewellery type' }] }] };
const categories = [{ _id: 'jewellery', name: 'Bridal Jewellery', definitionKey: 'jewellery' }, { _id: 'lehenga', name: 'Lehengas' }];

test('bridal Smart Fill reviews rich fields, SEO and category specifications without any size suggestions', () => {
  const form = { name: '', category: '', sizes: '', attributeValues: {} };
  const result = { suggestion: { name: 'Gold Bridal Necklace', category: 'jewellery', description: 'Gold-tone necklace with visible floral detailing.', highlights: ['Floral detailing'], tags: ['bridal', 'necklace'], sizes: ['M'], sizingMode: 'sized', attributeValues: { size: 'M', jewellery_type: 'Necklace Set', pattern: 'Floral' } } };
  const rows = suggestionRows(result, form, { categories, structure });
  expect(rows.map(row => row.key)).toEqual(expect.arrayContaining(['category', 'highlights', 'metaTitle', 'metaDescription', 'attributeValues.jewellery_type']));
  expect(rows.some(row => ['sizes', 'sizingMode', 'attributeValues.size'].includes(row.key))).toBe(false);
  const patch = selectedSmartPatch(rows, rows.map(row => row.key), form);
  expect(applySmartPatch(form, patch).attributeValues.jewellery_type).toBe('Necklace Set');
  expect(selectedSmartPatch(rows, ['attributeValues.jewellery_type'], form)).toEqual([]);
  expect(selectedSmartPatch(rows, rows.map(row => row.key), { ...form, category: 'lehenga' }).some(row => row.key === 'attributeValues.jewellery_type')).toBe(false);
});

test('new bridal products need no size chart and legacy size or variant inventory remains editable', () => {
  expect(usesGarmentSizing(structure, { sizes: '' })).toBe(false);
  expect(usesGarmentSizing(structure, { sizes: 'M, L', sizingMode: 'auto' })).toBe(true);
  expect(usesGarmentSizing(structure, { variants: [{ size: 'M', stock: 2 }] })).toBe(true);
  expect(productAttributeDefinitions(structure, categories, { category: 'jewellery' }).map(item => item.key)).toEqual(['pattern', 'jewellery_type']);
  const copy = buildAssistantSuggestions({ categoryName: 'Lehenga', sizingEnabled: false });
  expect(copy.sizes).toEqual([]); expect(copy.caption).not.toContain('Available Sizes');
});

test('quick add persists richer AI details and preserves manually entered specifications', () => {
  const form = { name: 'Manual necklace title', category: 'jewellery', colors: '', tags: '', images: [], price: '1000', stock: '1', attributeValues: { pattern: 'Manual pattern' } };
  const next = applyVisionSuggestion(form, { name: 'AI title', categoryId: 'jewellery', description: 'Gold necklace with floral detailing.', shortDescription: 'Floral bridal necklace.', tags: ['bridal'], highlights: ['Floral detailing'], careInstructions: 'Keep dry', attributeValues: { pattern: 'Floral', jewellery_type: 'Necklace Set' } }, { name: true }, categories);
  const payload = buildQuickAddPayload(next);
  expect(payload.name).toBe(form.name); expect(payload.attributeValues.pattern).toBe('Manual pattern');
  expect(payload.attributeValues.jewellery_type).toBe('Necklace Set'); expect(payload.highlights).toEqual(['Floral detailing']);
  expect(payload.careInstructions).toBe('Keep dry'); expect(payload.metaTitle).toBe(form.name); expect(payload.metaDescription).toBe('Floral bridal necklace.');
  const conflicting = applyVisionSuggestion({ ...form, category: 'lehenga' }, { categoryId: 'jewellery', attributeValues: { jewellery_type: 'Necklace Set' } }, { category: true }, categories);
  expect(conflicting.attributeValues.jewellery_type).toBeUndefined();
});
