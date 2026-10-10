import { CalendarDays, ShoppingBag } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStorefront } from '../../context/StorefrontContext';
import { storefrontPath } from '../../utils/routing';
import { OrderShell, OrderState } from '../../components/order/OrderUi';
import CustomerSaleOrders from '../../components/order/CustomerSaleOrders';
import CustomerRentalOrders from '../../components/order/CustomerRentalOrders';

export default function MyOrders({ navigate: navigateRoute, route = '/orders' }) {
  const { user } = useAuth();
  const { storeSlug } = useStorefront();
  const navigate = path => navigateRoute(storefrontPath(path, storeSlug));
  const rental = new URLSearchParams(route.split('?')[1] || '').get('type') === 'rental';
  const actor = String(user?._id || user?.id || user?.phone || '');
  const types = [['Sale', ShoppingBag, '/orders'], ['Rental', CalendarDays, '/orders?type=rental']];
  return <OrderShell title="My Orders" subtitle="Your purchases and rental bookings in one place." navigate={navigate} showReturns={!rental}>
    <nav className="sc-orders__types" aria-label="Order types">{types.map(([label, Icon, path], index) =>
      <a key={label} href={storefrontPath(path, storeSlug)} aria-current={rental === Boolean(index) ? 'page' : undefined}
        onClick={event => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) { event.preventDefault(); navigate(path); } }}>
        <Icon size={19} aria-hidden="true" /><span>{label}</span>
      </a>)}</nav>
    <p className="sc-orders__type-description">{rental ? 'Use dates, pickup, return and payment updates.' : 'Delivery updates, invoices, returns and exchanges.'}</p>
    {!user ? <OrderState title="Sign in to view your orders"><p>Your orders are private to your account.</p><button className="sc-orders__button" onClick={() => navigate('/login?redirect=' + encodeURIComponent(storefrontPath(rental ? '/orders?type=rental' : '/orders', storeSlug)))}>Sign in</button></OrderState>
      : rental ? <CustomerRentalOrders key={actor + ':' + storeSlug + ':rental'} route={route} navigate={navigate} storeSlug={storeSlug} />
        : <CustomerSaleOrders key={actor + ':' + storeSlug + ':sale'} route={route} navigate={navigate} storeSlug={storeSlug} />}
  </OrderShell>;
}
