import { buildCatalogFacets } from './catalogFacets';

describe('buildCatalogFacets', () => {
  const categories = [
    { _id: 'sarees-id', name: 'Sarees', slug: 'sarees' },
    { _id: 'kurtis-id', name: 'Kurtis', slug: 'kurtis' },
  ];
  const products = [
    {
      id: 'saree-1',
      categoryId: 'sarees-id',
      category: 'Sarees',
      sizes: ['S', 'M'],
      colors: ['Wine'],
      fabric: 'Silk Blend',
      occasion: 'Festive',
      price: 2499,
      discountPercentage: 50,
      rating: 4.4,
      stock: 6,
    },
    {
      id: 'kurti-1',
      categoryId: 'kurtis-id',
      category: 'Kurtis',
      variants: [{ size: 'XL', color: 'Sage' }],
      fabric: 'Pure Cotton',
      occasion: 'Casual',
      price: 999,
      discountPercentage: 20,
      rating: 3.6,
      stock: 0,
    },
  ];

  test('derives options and counts from API product fields instead of fallback values', () => {
    const facets = buildCatalogFacets(products, categories, {});

    expect(facets.categories.map(({ label, count }) => [label, count])).toEqual([
      ['Sarees', 1],
      ['Kurtis', 1],
    ]);
    expect(facets.sizes.map(({ value }) => value)).toEqual(['S', 'M', 'XL']);
    expect(facets.colors.map(({ value }) => value)).toEqual(['Sage', 'Wine']);
    expect(facets.fabrics.map(({ value }) => value)).toEqual(['Pure Cotton', 'Silk Blend']);
    expect(facets.occasions.map(({ value }) => value)).toEqual(['Casual', 'Festive']);
    expect(facets.availability.map(({ count }) => count)).toEqual([1, 1]);
  });

  test('facet counts honor other active filters but ignore their own filter', () => {
    const facets = buildCatalogFacets(products, categories, { category: 'sarees-id', size: 'XL' });

    expect(facets.categories.map(({ count }) => count)).toEqual([0, 1]);
    expect(facets.sizes.find(({ value }) => value === 'S').count).toBe(1);
    expect(facets.sizes.find(({ value }) => value === 'XL').count).toBe(0);
  });

  test('returns no invented category, size, or color options for an empty catalog', () => {
    const facets = buildCatalogFacets([], [], {});

    expect(facets.categories).toEqual([]);
    expect(facets.sizes).toEqual([]);
    expect(facets.colors).toEqual([]);
    expect(facets.prices).toEqual([]);
  });
});
