import { mergeWebsiteConfig, buildWebsiteCssVariables } from './websiteCustomization';
import { applyAppearancePreset, changedConfigGroups, exportThemeFile, parseThemeFile, validateDesignerConfig, websiteDataAttributes } from './websiteDesigner';
import { applyBrandColor, applyFontPair, applyLayoutStyle, contrastRatio, improveThemeReadability, matchMobileAppearance, reorderDesignerItems, restoreDesignerPanel, searchDesignerControls, themeReadability } from './websiteDesignerTools';

test('oversized or malformed imported selections are rejected before mounting expensive controls', () => {
  const oversized = mergeWebsiteConfig({ homepage: { featuredCategoryIds: Array.from({ length: 10000 }, (_, i) => String(i)) } });
  expect(() => parseThemeFile(exportThemeFile(oversized, 'Oversized'))).toThrow('at most 8');
  const malformed = mergeWebsiteConfig({ homepage: { categoryImages: [null] } });
  expect(() => parseThemeFile(exportThemeFile(malformed, 'Malformed'))).toThrow('Category image overrides');
  const products = mergeWebsiteConfig({ homepage: { sectionProductIds: { featured: [{}] } } });
  expect(() => parseThemeFile(exportThemeFile(products, 'Bad product'))).toThrow('valid product IDs');
});

test('legacy themes preserve mobile, tablet and existing desktop appearance', () => {
  const config = mergeWebsiteConfig({ schemaVersion: 2, header: { sticky: false } });
  expect(config.mobile.enabled).toBe(false);
  expect(config.tablet.enabled).toBe(false);
  expect(config.theme.enhancedStyles).toBe(false);
  expect(config.header.sticky).toBe(false);
  expect(websiteDataAttributes(config)['data-mobile-custom']).toBe(false);
  expect(validateDesignerConfig(config)).toEqual([]);
});

test('applying a preset changes appearance without replacing business content or handheld settings', () => {
  const original = mergeWebsiteConfig({
    branding: { websiteName: 'My store', logo: '/uploads/logo.png' },
    mobile: { enabled: true, columns: 1 },
    tablet: { enabled: true, columns: 4 },
    header: { announcementText: 'My announcement', sticky: false },
    footer: { contactEmail: 'support@example.com', menus: { shopping: [{ label: 'All', path: '/products' }] } },
    homepage: { sectionProductIds: { featured: ['product-1'] } },
  });
  const before = JSON.stringify(original);
  const result = applyAppearancePreset(original, { colors: { primary: '#31594c' }, theme: { preset: 'sage' } });
  for (const key of ['branding', 'mobile', 'tablet', 'homepage', 'layout']) expect(result[key]).toEqual(original[key]);
  expect(result.footer.contactEmail).toBe(original.footer.contactEmail);
  expect(result.footer.menus).toEqual(original.footer.menus);
  expect(result.header.announcementText).toBe('My announcement');
  expect(result.header.sticky).toBe(original.header.sticky);
  expect(result.colors.primary).toBe('#31594c');
  expect(JSON.stringify(original)).toBe(before);
});

test('mobile settings are separately merged and exported as device-specific variables', () => {
  const config = mergeWebsiteConfig({ mobile: { enabled: true, columns: 1, sections: [{ id: 'hero', visible: false, order: 0 }] } });
  expect(config.mobile.sections).toHaveLength(14);
  expect(config.mobile.sections.find((section) => section.id === 'hero').visible).toBe(false);
  expect(config.homepage.sections.find((section) => section.id === 'hero').visible).toBe(true);
  const vars = buildWebsiteCssVariables(config);
  expect(vars['--site-mobile-columns']).toBe(1);
  expect(vars['--site-products-desktop']).toBe(4);
});

test('export and import round trip without publishing or unknown keys', () => {
  const config = mergeWebsiteConfig({ colors: { primary: '#abcdef' } });
  expect(parseThemeFile(exportThemeFile(config, 'Export'))).toEqual(config);
  expect(() => parseThemeFile('{}')).toThrow('exported from Website Designer');
  expect(() => parseThemeFile('x'.repeat(512001))).toThrow('500 KB');
  const file = JSON.parse(exportThemeFile(config, 'Export'));
  file.config.unknown = { script: '<script>unsafe</script>' };
  expect(parseThemeFile(JSON.stringify(file)).unknown).toBeUndefined();
});

test('invalid colors, links, image schemes and unsafe layout values cannot be previewed or saved', () => {
  const config = mergeWebsiteConfig({
    colors: { primary: 'red' },
    footer: { menus: { shopping: [{ label: 'Bad', path: '/\\evil.test' }, { label: 12, path: '/products' }] }, socialLinks: { instagram: 'javascript:alert(1)' } },
    branding: { logo: 'data:image/svg+xml,unsafe' },
    mobile: { columns: 100 },
  });
  const issues = validateDesignerConfig(config);
  expect(issues.some((item) => item.includes('six-digit'))).toBe(true);
  expect(issues.some((item) => item.includes('internal path'))).toBe(true);
  expect(issues.some((item) => item.includes('Images'))).toBe(true);
  expect(issues.some((item) => item.includes('mobile.columns'))).toBe(true);
  expect(() => parseThemeFile(exportThemeFile(config, 'Bad'))).toThrow();
});

test('malformed section arrays and primitive values cannot crash normal default merging', () => {
  const config = mergeWebsiteConfig({ homepage: { sections: {} }, mobile: { sections: [null], enabled: 'true' }, colors: { primary: { invalid: true } } });
  expect(config.mobile.enabled).toBe(false);
  expect(config.homepage.sections).toHaveLength(14);
  expect(validateDesignerConfig(config)).toEqual([]);
  expect(changedConfigGroups(config, config)).toEqual([]);
});

test('quick styling is exportable, leaves commerce content intact and keeps handheld layout separate', () => {
  const original = mergeWebsiteConfig({
    branding: { websiteName: 'My boutique' },
    homepage: { sectionProductIds: { featured: ['sku-2', 'sku-1'] } },
    mobile: { enabled: true, columns: 1, imageRatio: '3/4', sections: [{ id: 'hero', order: 90, visible: false }] },
    footer: { contactPhone: '1234567890' },
  });
  const before = JSON.stringify(original);
  const updated = applyLayoutStyle(applyFontPair(applyBrandColor(original, '#ecd9bf'), 'modern'), 'compact');
  expect(updated.homepage).toBe(original.homepage);
  expect(updated.branding).toBe(original.branding);
  expect(updated.mobile).toBe(original.mobile);
  expect(updated.footer.menus).toBe(original.footer.menus);
  expect(updated.footer.contactPhone).toBe('1234567890');
  expect(contrastRatio(updated.buttons.textColor, updated.buttons.background)).toBeGreaterThan(4.5);
  expect(validateDesignerConfig(updated)).toEqual([]);
  expect(parseThemeFile(exportThemeFile(updated, 'Quick style'))).toEqual(updated);
  expect(JSON.stringify(original)).toBe(before);
  expect(applyBrandColor(original, 'red')).toBe(original);
});

test('matching mobile appearance changes colors and corners without changing content or layout choices', () => {
  const original = mergeWebsiteConfig({ mobile: { columns: 1, imageRatio: '3/4', useDesktopCatalog: true }, productCards: { borderRadius: 32 } });
  const result = matchMobileAppearance(original);
  expect(result.homepage).toBe(original.homepage);
  expect(result.mobile.sections).toBe(original.mobile.sections);
  expect(result.mobile.columns).toBe(1);
  expect(result.mobile.imageRatio).toBe('3/4');
  expect(result.mobile.useDesktopCatalog).toBe(true);
  expect(result.mobile.enabled).toBe(true);
  expect(result.mobile.cardRadius).toBe(24);
  expect(validateDesignerConfig(result)).toEqual([]);
});

test('contrast guidance handles invalid colors and only fixes text when it can meet the target', () => {
  expect(contrastRatio('#000000', '#ffffff')).toBe(21);
  expect(contrastRatio('#123456', '#123456')).toBe(1);
  expect(contrastRatio('#', '#ffffff')).toBeNull();
  const input = mergeWebsiteConfig({ colors: { text: '#eeeeee', mutedText: '#eeeeee', primary: '#ffffff' }, buttons: { textColor: '#6d1f34' } });
  const improved = improveThemeReadability(input);
  expect(improved.colors.primary).toBe(input.colors.primary);
  expect(improved.buttons.background).toBe(input.buttons.background);
  expect(improved.homepage).toBe(input.homepage);
  expect(themeReadability(improved).find((item) => item.label === 'Main text').needsAttention).toBe(false);
  expect(themeReadability(improved).find((item) => item.label === 'Navigation accents').needsAttention).toBe(true);
  const mixed = mergeWebsiteConfig({ colors: { background: '#000000', surface: '#ffffff' } });
  expect(themeReadability(mixed).find((item) => item.label === 'Main text').suggestedText).toBeNull();
});

test('restoring one panel keeps other edits and reordering selections preserves every ID', () => {
  const saved = mergeWebsiteConfig();
  const current = applyBrandColor(saved, '#123456');
  const restored = restoreDesignerPanel(current, saved, 'colors');
  expect(restored.colors).toBe(saved.colors);
  expect(restored.buttons).toBe(current.buttons);
  expect(restored.homepage).toBe(current.homepage);
  expect(restoreDesignerPanel(current, saved, 'presets')).toBe(current);
  const items = ['a', 'b', 'c'];
  expect(reorderDesignerItems(items, 1, -1)).toEqual(['b', 'a', 'c']);
  expect(reorderDesignerItems(items, 0, -1)).toBe(items);
  expect(items).toEqual(['a', 'b', 'c']);
  expect(searchDesignerControls('logo').map((item) => item.id)).toContain('branding');
  expect(searchDesignerControls('')).toEqual([]);
});

test('every compact backend preset can be applied, exported and saved without normalization drift', () => {
  const { getPresetList, normalizeWebsiteConfig } = require('../../backend/config/websiteCustomization');
  const original = mergeWebsiteConfig({ branding: { websiteName: 'Keep my store' }, homepage: { sectionProductIds: { featured: ['sku-1'] } } });
  for (const preset of getPresetList({ appearanceOnly: true })) {
    const applied = matchMobileAppearance(applyAppearancePreset(original, preset.config));
    expect(validateDesignerConfig(applied)).toEqual([]);
    expect(normalizeWebsiteConfig(applied)).toEqual(applied);
    expect(parseThemeFile(exportThemeFile(applied, preset.name))).toEqual(applied);
    expect(applied.branding).toEqual(original.branding);
    expect(applied.homepage).toEqual(original.homepage);
    expect(themeReadability(applied).filter((item) => item.needsAttention)).toEqual([]);
  }
});
