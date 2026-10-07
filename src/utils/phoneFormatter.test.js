import { normalizeIndianPhone } from './phoneFormatter';

test.each([
  ['9123456789', '9123456789'],
  ['+91 91234 56789', '9123456789'],
  ['9876543210', '9876543210'],
  ['+91-98765-43210', '9876543210'],
  ['91234567', ''],
  ['98765432101', ''],
  ['5123456789', ''],
  ['', ''],
])('normalizes %s without confusing a local 91 prefix with the country code', (input, expected) => {
  expect(normalizeIndianPhone(input)).toBe(expected);
});
