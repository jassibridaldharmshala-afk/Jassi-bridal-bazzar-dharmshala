import Orders from '../admin/Orders';

export default function SellerOrders({ route = '/seller/orders' }) {
  return <Orders route={route} />;
}
