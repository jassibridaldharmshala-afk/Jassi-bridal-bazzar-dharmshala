import fs from 'fs';
import path from 'path';
import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';
import { compare, selectorSpecificity } from '@csstools/selector-specificity';
import tailwindcss from 'tailwindcss';

const themeCss = postcss.parse(fs.readFileSync(path.join(__dirname, 'applicationTheme.css'), 'utf8'));
const focusRules = [];
themeCss.walkRules(rule => {
  if (rule.selector.includes(':focus-visible') && rule.nodes.some(node => node.prop === 'outline-color')) {
    focusRules.push(rule);
  }
});

function specificity(selector) {
  return selectorSpecificity(selectorParser().astSync(selector).nodes[0]);
}

test('theme focus colour is a zero-specificity fallback, not a forced inner outline', () => {
  expect(focusRules).toHaveLength(1);
  expect(specificity(focusRules[0].selector)).toEqual({ a: 0, b: 0, c: 0 });
  expect(focusRules[0].nodes).toEqual(expect.arrayContaining([
    expect.objectContaining({ prop: 'outline-color', value: 'var(--site-primary)' }),
  ]));
  expect(focusRules[0].nodes.every(node => !node.important)).toBe(true);
});

test.each([
  '.outline-none',
  '.focus\\:outline-none:focus',
  '.focus-visible\\:outline-none:focus-visible',
  '.sc-navbar__search-input',
  '.category-form__slug input',
  '.store-settings__field input',
  '.mantine-focus-auto:focus-visible',
])('component-owned focus styling wins over the theme fallback: %s', selector => {
  expect(compare(specificity(selector), specificity(focusRules[0].selector))).toBeGreaterThan(0);
});

test('compiled Tailwind outline-none stays transparent and keeps forced-colour support', async () => {
  const compiled = await postcss([tailwindcss({
    content: [{ raw: 'outline-none focus:outline-none focus-visible:outline-none', extension: 'html' }],
    corePlugins: { preflight: false },
  })]).process('@tailwind utilities;', { from: undefined });
  const outlineRules = [];
  compiled.root.walkRules(rule => {
    if (rule.selector.includes('outline-none')) outlineRules.push(rule);
  });
  expect(outlineRules).toHaveLength(3);
  outlineRules.forEach(rule => {
    expect(rule.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ prop: 'outline', value: '2px solid transparent' }),
      expect.objectContaining({ prop: 'outline-offset', value: '2px' }),
    ]));
    expect(compare(specificity(rule.selector), specificity(focusRules[0].selector))).toBeGreaterThan(0);
  });
});

const fieldCss = postcss.parse(fs.readFileSync(path.join(__dirname, 'formControls.css'), 'utf8'));
const fieldFocusRules = [];
fieldCss.walkRules(rule => { fieldFocusRules.push(rule); });
const innerFocusRule = fieldFocusRules.find(rule => rule.selector.includes(':where('));
const outerFocusRule = fieldFocusRules.find(rule => rule.nodes.some(node => node.prop === 'box-shadow' && node.value !== 'none'));
const highContrastRule = fieldFocusRules.find(rule => rule.parent.params === '(forced-colors: active)');

function wrapperAliases(selector) {
  const aliases = [];
  selectorParser().astSync(selector).walkClasses(node => { aliases.push(node.value); });
  return [...new Set(aliases)].sort();
}

test('all registered composite wrappers share the same outer, inner and high-contrast policy', () => {
  expect(wrapperAliases(outerFocusRule.selector)).toHaveLength(21);
  expect(wrapperAliases(innerFocusRule.selector)).toEqual(wrapperAliases(outerFocusRule.selector));
  expect(wrapperAliases(highContrastRule.selector)).toEqual(wrapperAliases(outerFocusRule.selector));
  expect(outerFocusRule.selector).toContain(':focus-within');
  expect(highContrastRule.nodes).toEqual(expect.arrayContaining([
    expect.objectContaining({ prop: 'outline-color', value: 'Highlight' }),
  ]));
  expect(innerFocusRule.nodes).toEqual(expect.arrayContaining([
    expect.objectContaining({ prop: 'outline', value: 'none' }),
    expect.objectContaining({ prop: 'box-shadow', value: 'none' }),
  ]));
});

test.each([
  '.sc-wishlist :is(button, a, select, input):focus-visible',
  '.sc-orders :is(button, a, input, select):focus-visible',
  '.sc-bag :is(button, input, a, select):focus-visible',
  '.sc-mobile-checkout :is(button, input, select):focus-visible',
  '.store-settings :is(input, textarea, select, button, a):focus-visible',
  '.category-form input:focus',
])('composite fields suppress page-specific inner outlines: %s', selector => {
  expect(compare(specificity(innerFocusRule.selector), specificity(selector))).toBeGreaterThan(0);
});

test('composite reset is limited to text controls and never globally removes focus accessibility', () => {
  const selector = innerFocusRule.selector;
  expect(selector).toContain('html[data-app-theme]');
  ['checkbox', 'radio', 'file', 'color', 'range', 'hidden', 'button', 'submit', 'reset'].forEach(type => {
    expect(selector).toContain(`[type="${type}"]`);
  });
  expect(selector).toContain('select');
  expect(selector).toContain('textarea');
  expect(innerFocusRule.nodes.every(node => !node.important)).toBe(true);
  expect(outerFocusRule.nodes.every(node => !node.important)).toBe(true);
});

const addressCss = postcss.parse(fs.readFileSync(path.join(__dirname, '../pages/customer/AddressManagement.css'), 'utf8'));
const addressInnerRule = addressCss.nodes.find(node => node.type === 'rule' && node.selector.includes('.sc-field-shell > :is(input, select)'));

test('address controls have no independent box in idle, focus, autofill or disabled states', () => {
  expect(addressInnerRule).toBeDefined();
  expect(addressInnerRule.parent.type).toBe('root');
  expect(addressInnerRule.selector).not.toMatch(/:focus|:disabled|:autofill/);
  ['border', 'border-radius', 'padding-inline'].forEach(prop => {
    expect(addressInnerRule.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ prop, value: '0' }),
    ]));
  });
  ['outline', 'box-shadow'].forEach(prop => {
    expect(addressInnerRule.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ prop, value: 'none' }),
    ]));
  });
  expect(addressInnerRule.nodes).toEqual(expect.arrayContaining([
    expect.objectContaining({ prop: 'background', value: 'transparent' }),
    expect.objectContaining({ prop: 'min-width', value: '0' }),
    expect.objectContaining({ prop: 'max-width', value: '100%' }),
  ]));
});

test.each([
  '.border', '.rounded-xl', '.bg-white', '.disabled\\:bg-slate-50:disabled',
  '.focus\\:ring-2:focus', '.sc-mobile-checkout :is(button, input, select):focus-visible',
])('address reset wins over the shared standalone decoration: %s', selector => {
  expect(compare(specificity(addressInnerRule.selector), specificity(selector))).toBeGreaterThan(0);
});

test('legacy address-only outlines no longer add a second focus edge around the shell', () => {
  const legacyOutlines = [];
  addressCss.walkRules(rule => {
    if (rule.selector.includes(':focus-within') && rule.nodes.some(node => node.prop === 'outline')) {
      legacyOutlines.push(rule);
    }
  });
  expect(legacyOutlines).toEqual([]);
});
