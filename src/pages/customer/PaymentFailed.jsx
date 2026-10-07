import { Button, Card, CardContent } from '../../components/ui';

export default function PaymentFailed({ navigate }) {
  return (
    <section className="container-page grid min-h-[60vh] place-items-center py-10">
      <Card className="max-w-lg text-center">
        <CardContent className="p-5 md:p-8">
        <p className="small-text font-bold uppercase tracking-[0.14em] text-rose md:text-sm md:tracking-[0.22em]">Payment failed</p>
        <h1 className="page-title mt-3 md:text-3xl">We could not confirm your payment.</h1>
        <p className="body-text mt-3 text-slate-500">Your cart is still saved. You can retry online payment or choose Cash on Delivery.</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button onClick={() => navigate('/checkout')}>Retry Checkout</Button>
          <Button onClick={() => navigate('/cart')} variant="outline">View Cart</Button>
        </div>
        </CardContent>
      </Card>
    </section>
  );
}
