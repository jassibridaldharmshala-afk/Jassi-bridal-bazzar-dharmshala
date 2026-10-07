import { rentalBarcode } from './rentalBarcode';
test('Code 39 labels have start/end symbols, quiet-zone-compatible bits and no unsupported characters', () => {
  const bits = rentalBarcode('LEHENGA-001');
  expect(bits).toMatch(/^[01]+$/); expect(bits.startsWith((35770).toString(2))).toBe(true); expect(bits.endsWith((35770).toString(2))).toBe(true);
  expect(rentalBarcode('LEHENGA_001')).toBeNull(); expect(rentalBarcode('A'.repeat(31))).toBeNull();
});
