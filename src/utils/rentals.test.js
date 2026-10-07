import { localDateTime, rentalInstant, rentalMoney } from './rentals';
test('rental time is resolved in the store timezone rather than browser timezone', () => {
  expect(rentalInstant('2030-01-10T10:00', 'Asia/Kolkata')).toBe('2030-01-10T04:30:00.000Z');
  expect(localDateTime('2030-01-10T04:30:00Z', 'Asia/Kolkata')).toBe('2030-01-10T10:00');
});
test('timezone conversion rejects nonexistent DST wall times and incomplete dates', () => {
  expect(() => rentalInstant('2030-03-10T02:30', 'America/New_York')).toThrow();
  expect(() => rentalInstant('', 'Asia/Kolkata')).toThrow();
});
test('rental amounts use paise', () => { expect(rentalMoney(12345)).toContain('123.45'); });
