import { buildProductDetails, hasMeaningfulProductCopy, parseDescription } from './productDetails';

describe('product detail formatting', () => {
  test('displays API-configured specification labels, values and units', () => {
    const details = buildProductDetails({ specifications: [{ key: 'ram', label: 'RAM', value: '8', unit: 'GB' }] });
    expect(details.specifications).toContainEqual({ label: 'RAM', value: '8 GB' });
  });
  test('separates narrative copy from labelled API specifications', () => {
    const result = parseDescription(`An elegant style for evening occasions.\n\nDesigned with a graceful silhouette.\n\nProduct Details:\n• Color: Ivory White\n• Work: Thread embroidery\n• Wash Care: Dry clean only`);

    expect(result.description).toBe('An elegant style for evening occasions.\n\nDesigned with a graceful silhouette.');
    expect(result.specifications).toEqual([
      ['Color', 'Ivory White'],
      ['Work', 'Thread embroidery'],
      ['Wash Care', 'Dry clean only'],
    ]);
  });

  test('combines explicit product fields with extra description specifications without duplication', () => {
    const details = buildProductDetails({
      description: 'Catalog description.\n\nProduct Details:\n• Color: Ivory White\n• Neckline: Sweetheart Neck',
      category: 'Gown',
      colors: ['Ivory White'],
      sizes: ['S', 'M'],
      sku: 'SC-001',
      highlights: ['Detailed embroidery'],
    });

    expect(details.specifications.filter(({ label }) => /colou?r/i.test(label))).toHaveLength(1);
    expect(details.specifications).toContainEqual({ label: 'Neckline', value: 'Sweetheart Neck' });
    expect(details.specifications).toContainEqual({ label: 'Product code', value: 'SC-001' });
    expect(details.highlights).toEqual(['Detailed embroidery']);
  });

  test('does not invent descriptions, highlights, sizes, or colours', () => {
    expect(buildProductDetails({})).toEqual(expect.objectContaining({
      description: '',
      highlights: [],
      sizes: [],
      colors: [],
      specifications: [],
    }));
  });

  test('rejects obvious placeholder copy while accepting useful catalog descriptions', () => {
    expect(hasMeaningfulProductCopy('fsjfklaj afajfja afkajkfja')).toBe(false);
    expect(hasMeaningfulProductCopy('Elegant silk saree with handwoven zari details.')).toBe(true);
  });
});
