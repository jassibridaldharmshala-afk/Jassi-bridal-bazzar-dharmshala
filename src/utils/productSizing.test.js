import {
  buildSizeChartPayload,
  convertMeasurement,
  getSelectableSizes,
  getSizeChartColumns,
  getSizeChartValidation,
  inferSizeChartProfile,
} from './productSizing';

describe('category-aware product sizing', () => {
  test('treats sarees as one-size products even when legacy sizes exist', () => {
    const saree = { name: 'Royal Silk Saree', category: 'Sarees', sizes: ['S', 'M', 'XL'] };
    expect(inferSizeChartProfile(saree)).toBe('free-size');
    expect(getSelectableSizes(saree)).toEqual([]);
    expect(getSizeChartColumns(saree)).toEqual([]);
  });

  test('uses the requested measurement columns for kurta sets', () => {
    const columns = getSizeChartColumns({ category: 'Ethnic Sets', subCategory: 'Kurta Set', sizes: ['S'] });
    expect(columns.map((column) => column.key)).toEqual([
      'bust', 'chest', 'frontLength', 'bottomLength', 'waist', 'sleeveLength', 'hips', 'acrossShoulder', 'outseamLength', 'inseamLength',
    ]);
  });

  test('explicit selectable sizing always exposes the fields the backend validates', () => {
    const product = { name: 'Saree blouse', category: 'Sarees', sizingMode: 'sized', sizes: ['S'], sizeChart: { rows: [] } };
    expect(getSizeChartColumns(product).map(column => column.key)).toEqual(['bust', 'chest', 'waist', 'hips', 'acrossShoulder', 'sleeveLength', 'frontLength']);
    expect(getSizeChartValidation(product)).toEqual({ valid: false, missing: ['S Bust', 'S Chest', 'S Waist', 'S Hips', 'S Across shoulder', 'S Sleeve length', 'S Front length'] });
    const withValues = { ...product, sizeChart: { unit: 'in', rows: [{ size: 'S', bust: 34, chest: 34, waist: 28, hips: 36, acrossShoulder: 14, sleeveLength: 8, frontLength: 15 }] } };
    expect(getSizeChartValidation(withValues).valid).toBe(true);
    expect(buildSizeChartPayload(withValues).rows[0].bust).toBe(34);
    expect(getSizeChartValidation({ ...withValues, sizeChart: { rows: [{ ...withValues.sizeChart.rows[0], bust: Infinity }] } }).missing).toContain('S Bust');
  });

  test('explicit free-size mode hides measurement fields even with an old garment template', () => {
    const product = { name: 'Saree', sizingMode: 'free-size', sizeChartProfile: 'dress', sizes: ['S'] };
    expect(getSizeChartColumns(product)).toEqual([]);
    expect(getSizeChartValidation(product)).toEqual({ valid: true, missing: [] });
    expect(buildSizeChartPayload(product)).toEqual({ unit: 'in', columns: [], rows: [] });
  });

  test('uses dress measurements without unrelated bottom fields', () => {
    const columns = getSizeChartColumns({ category: 'Dresses', sizes: ['S'] });
    expect(columns.map((column) => column.key)).toEqual(['acrossShoulder', 'sleeveLength', 'bust', 'waist', 'frontLength', 'hips']);
  });

  test('requires every configured measurement and builds a numeric API payload', () => {
    const product = {
      category: 'Dresses',
      sizes: ['S'],
      sizeChart: {
        unit: 'in',
        rows: [{ size: 'S', acrossShoulder: '14', sleeveLength: '18', bust: '36', waist: '30', frontLength: '51', hips: '38' }],
      },
    };
    expect(getSizeChartValidation(product)).toEqual({ valid: true, missing: [] });
    expect(buildSizeChartPayload(product).rows[0].bust).toBe(36);
  });

  test('converts inches and centimetres for the customer unit toggle', () => {
    expect(convertMeasurement(10, 'in', 'cm')).toBe(25.4);
    expect(convertMeasurement(25.4, 'cm', 'in')).toBe(10);
  });
});
