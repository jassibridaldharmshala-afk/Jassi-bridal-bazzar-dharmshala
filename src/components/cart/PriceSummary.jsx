import { Button, Card, CardContent, CardHeader, CardTitle } from '../ui';

export default function PriceSummary({ cart, cta = 'Checkout', onAction }) {
  return (
    <Card as="aside">
      <CardHeader>
        <CardTitle className="small-text uppercase tracking-[0.14em] text-charcoal md:text-sm md:tracking-[0.2em]">Price Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="body-text space-y-3 text-slate-600">
        <Row label="Total MRP" value={`Rs. ${cart.totalMRP}`} />
        <Row label="Discount on MRP" value={`- Rs. ${cart.discount}`} good />
        <Row label="Coupon Discount" value={`- Rs. ${cart.couponDiscount}`} good />
        <Row label="Delivery Charges" value={cart.deliveryCharge ? `Rs. ${cart.deliveryCharge}` : 'FREE'} />
        {cart.platformFee > 0 ? <Row label="Platform Fee" value={`Rs. ${cart.platformFee}`} /> : null}
        {cart.taxAmount > 0 ? <Row label={`GST (${cart.taxRate || 5}% incl.)`} value={`Rs. ${cart.taxAmount}`} /> : null}
        {cart.codCharge > 0 ? <Row label="Cash on Delivery Fee" value={`Rs. ${cart.codCharge}`} /> : null}
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 pt-5">
          <span className="label-text text-charcoal">Total</span>
          <span className="price">Rs. {cart.finalAmount}</span>
        </div>
        <Button onClick={onAction} className="w-full" variant="accent">{cta}</Button>
      </CardContent>
    </Card>
  );
}

function Row({ label, value, good }) {
  return <div className="flex justify-between gap-4"><span>{label}</span><span className={good ? 'font-semibold text-emerald-600' : 'font-semibold text-charcoal'}>{value}</span></div>;
}
