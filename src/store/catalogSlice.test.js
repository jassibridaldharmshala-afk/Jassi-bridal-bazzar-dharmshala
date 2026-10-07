import {
  clearCatalogFilters,
  createCatalogSearchParams,
  normalizeCatalogQuery,
  selectVisibleProducts,
  splitFilterValues,
  toggleFilterValue,
} from './catalogSlice';

describe('catalog category multi-select', () => {
  const categories = [
    { _id: 'gown-id', name: 'Gown', slug: 'gown' },
    { _id: 'saree-id', name: 'Sarees', slug: 'sarees' },
    { _id: 'kurti-id', name: 'Kurtis', slug: 'kurtis' },
  ];

  test('adds and removes category values without replacing other selections', () => {
    const selected = toggleFilterValue('gown-id', 'saree-id');

    expect(splitFilterValues(selected)).toEqual(['gown-id', 'saree-id']);
    expect(toggleFilterValue(selected, 'gown-id')).toBe('saree-id');
  });

  test('does not duplicate a direct URL value that only differs by letter case', () => {
    expect(toggleFilterValue('wine', 'Wine')).toBe('');
  });

  test('keeps multiple categories in the URL query', () => {
    const params = createCatalogSearchParams(normalizeCatalogQuery({ category: 'gown-id,saree-id' }));

    expect(params.get('category')).toBe('gown-id,saree-id');
  });

  test('shows products matching any selected category', () => {
    const products = [
      { _id: '1', name: 'Evening Gown', categoryId: 'gown-id' },
      { _id: '2', name: 'Silk Saree', category: 'Sarees' },
      { _id: '3', name: 'Festive Kurti', categoryId: 'kurti-id' },
    ];
    const state = { catalog: normalizeCatalogQuery({ category: 'gown-id,saree-id' }) };

    expect(selectVisibleProducts(state, products, categories).map((product) => product._id)).toEqual(['1', '2']);
  });

  test('clear all removes a navbar search before another category is selected', () => {
    const navbarFilters = normalizeCatalogQuery({ search: 'Saree' });
    const clearedFilters = clearCatalogFilters(navbarFilters);
    const nextFilters = normalizeCatalogQuery({ ...clearedFilters, category: 'gown-id' });
    const products = [
      { _id: '1', name: 'Evening Gown', categoryId: 'gown-id' },
      { _id: '2', name: 'Silk Saree', category: 'Sarees' },
    ];

    expect(clearedFilters.search).toBe('');
    expect(createCatalogSearchParams(clearedFilters).has('search')).toBe(false);
    expect(selectVisibleProducts({ catalog: nextFilters }, products, categories).map((product) => product._id)).toEqual(['1']);
  });
});

describe('catalog collection searches', () => {
  const products = [
    {
      _id: 'ethnic-set',
      name: 'Embroidered Sharara Suit Set',
      category: { name: 'Suits', slug: 'suits' },
      description: 'Enhance your ethnic style for festive celebrations.',
    },
    {
      _id: 'accessories-style',
      name: 'Black Tailored Blazer Jumpsuit',
      category: { name: 'Jumpsuits', slug: 'jumpsuits' },
      description: 'Pair it with heels and minimal accessories.',
    },
  ];

  test('matches a multi-word collection search across product fields', () => {
    const state = { catalog: normalizeCatalogQuery({ search: 'Ethnic Set' }) };

    expect(selectVisibleProducts(state, products, []).map((product) => product._id)).toEqual(['ethnic-set']);
  });

  test('treats accessory and accessories as search variants', () => {
    const state = { catalog: normalizeCatalogQuery({ search: 'Accessory' }) };

    expect(selectVisibleProducts(state, products, []).map((product) => product._id)).toEqual(['accessories-style']);
  });
});

describe('catalog desktop facet behavior', () => {
  const products = [
    {
      _id: '1',
      name: 'Silk Saree',
      sizes: ['S', 'M'],
      colors: ['Wine'],
      fabric: 'Silk Blend',
      occasion: 'Wedding, Festive Wear',
      isBestSeller: false,
      rating: 4.8,
      numReviews: 40,
    },
    {
      _id: '2',
      name: 'Cotton Kurti',
      sizes: ['L'],
      colors: ['Pink'],
      fabric: 'Pure Cotton',
      occasion: 'Office Wear, Casual Wear',
      isBestSeller: true,
      rating: 4.1,
      numReviews: 12,
    },
    {
      _id: '3',
      name: 'Festive Set',
      variants: [{ size: 'XL', color: 'Green' }],
      fabric: 'Silk Blend',
      occasion: 'Wedding, Reception',
      isBestSeller: true,
      rating: 4.6,
      numReviews: 30,
    },
  ];

  test('matches any selected size, color, and fabric value including variant values', () => {
    const state = {
      catalog: normalizeCatalogQuery({
        size: 'S,XL',
        color: 'Wine,Green',
        fabric: 'Silk Blend,Pure Cotton',
      }),
    };

    expect(selectVisibleProducts(state, products, []).map((product) => product._id)).toEqual(['1', '3']);
  });

  test('sorts best sellers before other products and uses rating as the tie breaker', () => {
    const state = { catalog: normalizeCatalogQuery({ sort: 'bestSeller' }) };

    expect(selectVisibleProducts(state, products, []).map((product) => product._id)).toEqual(['3', '2', '1']);
  });

  test('matches one occasion from a comma-separated API product value', () => {
    const state = { catalog: normalizeCatalogQuery({ occasion: 'Reception,Casual Wear' }) };

    expect(selectVisibleProducts(state, products, []).map((product) => product._id)).toEqual(['2', '3']);
  });

  test('normalizes a missing sort to the supported default', () => {
    expect(normalizeCatalogQuery({}).sort).toBe('newest');
  });
});
