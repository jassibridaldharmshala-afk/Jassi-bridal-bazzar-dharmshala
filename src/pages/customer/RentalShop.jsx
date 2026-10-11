import Products from './Products';

// Preserve existing rental links using the ordinary shopping layout.
export default function RentalShop({ route = '/rental-book', ...props }) {
  const params = new URLSearchParams(route.split('?')[1] || '');
  for (const [oldKey, key] of [['colour', 'color'], ['minRent', 'minPrice'], ['maxRent', 'maxPrice']]) {
    if (params.has(oldKey) && !params.has(key)) params.set(key, params.get(oldKey));
    params.delete(oldKey);
  }
  if (params.get('sort') === 'title') params.delete('sort');
  params.set('mode', 'rent');
  return <Products {...props} route={`${route.split('?')[0]}?${params}`} />;
}
