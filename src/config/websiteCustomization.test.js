import { buildWebsiteCssVariables, getHomepageSection, mergeWebsiteConfig } from './websiteCustomization';

describe('website customization helpers', () => {
  test('merges safe defaults and keeps every supported homepage section', () => {
    const config = mergeWebsiteConfig({
      branding: { websiteName: 'My Boutique' },
      homepage: { sections: [{ id: 'hero', visible: false, order: 500, heading: 'Custom hero' }] },
      unknown: { shouldNotLeak: true },
    });

    expect(config.branding.websiteName).toBe('My Boutique');
    expect(config.colors.primary).toBeTruthy();
    expect(config.unknown).toBeUndefined();
    expect(getHomepageSection(config, 'hero')).toMatchObject({ visible: false, order: 500, heading: 'Custom hero' });
    expect(config.homepage.sections.some((section) => section.id === 'accessories')).toBe(true);
  });

  test('produces centralized storefront variables from the active configuration', () => {
    const variables = buildWebsiteCssVariables({
      colors: { primary: '#123456' },
      layout: { maxWidth: 1280, productsPerRow: { desktop: 5 } },
      productCards: { imageRatio: '1/1', shadow: 'none' },
    });

    expect(variables['--site-primary']).toBe('#123456');
    expect(variables['--site-content-max']).toBe('1280px');
    expect(variables['--site-products-desktop']).toBe(5);
    expect(variables['--site-card-ratio']).toBe('1/1');
    expect(variables['--site-card-shadow']).toBe('none');
  });

  test('migrates existing themes to a sticky desktop header while preserving the v2 admin switch', () => {
    const migrated = mergeWebsiteConfig({ schemaVersion: 1, header: { sticky: false } });
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.header.sticky).toBe(true);

    const explicitlyStatic = mergeWebsiteConfig({ schemaVersion: 2, header: { sticky: false } });
    expect(explicitlyStatic.header.sticky).toBe(false);
  });
});
