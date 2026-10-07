import { Card, CardContent, CardHeader, CardTitle } from '../ui';

export default function OrderSummary({ items }) {
  return (
    <Card as="section">
      <CardHeader>
        <CardTitle className="text-xl">Order Summary</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {items.map((item) => (
          <div key={item.cartKey || `${item.product._id || item.product.id}-${item.size || ''}-${item.color || ''}`} className="flex justify-between gap-4">
            <span className="body-text text-slate-600">{item.product.name} x {item.quantity}</span>
            <span className="price">Rs. {item.product.price * item.quantity}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
