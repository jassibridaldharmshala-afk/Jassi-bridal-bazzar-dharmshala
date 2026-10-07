import { clearRecentProducts, getRecentProductIds, rememberRecentProduct, RECENT_PRODUCTS_EVENT } from './recentProducts';
const key = slug => `samira_recent_products_v1:${slug}`;
beforeEach(() => { localStorage.clear(); });
test('history is store-scoped, unique, bounded and newest-first', () => {
  for (let n = 0; n < 15; n += 1) rememberRecentProduct(`product-${n}`, 'Nishaya');
  rememberRecentProduct('product-5', 'nishaya'); rememberRecentProduct('other', 'fashion');
  expect(getRecentProductIds('Nishaya')).toHaveLength(12);
  expect(getRecentProductIds('nishaya')[0]).toBe('product-5');
  expect(getRecentProductIds('fashion')).toEqual(['other']);
  expect(getRecentProductIds('nishaya', 2)).toHaveLength(2);
});
test('timestamps survive new views, old records expire and legacy entries remain compatible', () => {
  const now = new Date().toISOString();
  localStorage.setItem(key('nishaya'), JSON.stringify([{ id: 'old', viewedAt: new Date(Date.now() - 31 * 86400000).toISOString() }, { id: 'valid', viewedAt: now }, 'legacy', { id: 'bad', viewedAt: 'invalid' }]));
  expect(getRecentProductIds('nishaya')).toEqual(['valid', 'legacy']);
  rememberRecentProduct('new', 'nishaya');
  expect(JSON.parse(localStorage.getItem(key('nishaya'))).find(item => item.id === 'valid').viewedAt).toBe(now);
});
test('clear removes only this store and announces the change', () => {
  rememberRecentProduct('one', 'nishaya'); rememberRecentProduct('two', 'fashion');
  const changed = jest.fn(); window.addEventListener(RECENT_PRODUCTS_EVENT, changed);
  clearRecentProducts('nishaya');
  expect(getRecentProductIds('nishaya')).toEqual([]); expect(getRecentProductIds('fashion')).toEqual(['two']);
  expect(changed).toHaveBeenCalledTimes(1); window.removeEventListener(RECENT_PRODUCTS_EVENT, changed);
});
test('corrupt or unavailable storage never blocks browsing', () => {
  localStorage.setItem(key('nishaya'), 'not json'); expect(getRecentProductIds('nishaya')).toEqual([]);
  const mock = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  expect(() => rememberRecentProduct('one', 'nishaya')).not.toThrow(); mock.mockRestore();
});
