export function getDesktopActiveLink(routePath, routeParams = new URLSearchParams()) {
  if (routePath === '/') return 'Home';
  if (routePath === '/contact') return 'Contact Us';
  if (routePath !== '/products') return '';

  const collection = String(routeParams.get('collection') || '').toLowerCase();
  if (collection === 'new-arrivals' || routeParams.get('newArrival') === 'true') return 'New Arrivals';
  if (collection === 'best-sellers' || routeParams.get('bestSeller') === 'true') return 'Best Sellers';
  if (collection === 'featured' || routeParams.get('featured') === 'true') return 'Featured';
  if (routeParams.has('discount')) return 'Offers';
  return 'Shop All';
}
