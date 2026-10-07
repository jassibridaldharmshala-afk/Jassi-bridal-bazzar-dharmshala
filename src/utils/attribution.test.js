import { ATTRIBUTION_WINDOW_MS, captureAttribution, readAttribution } from './attribution';

beforeEach(() => sessionStorage.clear());

test('campaign attribution expires after the configured window', () => {
  const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
  expect(captureAttribution('/products?utm_source=email&utm_campaign=festive')).toEqual(expect.objectContaining({ source: 'email', campaign: 'festive' }));
  now.mockReturnValue(1_000_000 + ATTRIBUTION_WINDOW_MS + 1);
  expect(readAttribution()).toEqual({});
  expect(sessionStorage.getItem('samira_attribution')).toBeNull();
  now.mockRestore();
});

test('active campaign attribution remains available for checkout', () => {
  jest.spyOn(Date, 'now').mockReturnValue(2_000_000);
  captureAttribution('/product?id=one&source=facebook&campaign=launch');
  expect(readAttribution()).toEqual(expect.objectContaining({ source: 'facebook', campaign: 'launch', expiresAt: 2_000_000 + ATTRIBUTION_WINDOW_MS }));
  Date.now.mockRestore();
});
