export default function PaymentMethod() {
  return (
    <section className="rounded-xl bg-[color:var(--site-surface)] p-4 shadow-sm md:rounded-3xl md:p-5">
      <h2 className="text-lg font-black">Payment Method</h2>
      <div className="mt-4 grid gap-3">
        {['Cash on Delivery', 'UPI', 'Card', 'Online Payment'].map((method, index) => (
          <label key={method} className="flex items-center gap-3 rounded-xl border border-[color:var(--site-border)] p-3 text-sm font-bold md:rounded-2xl md:p-4">
            <input type="radio" name="payment" defaultChecked={index === 0} className="accent-rose" />
            {method}
          </label>
        ))}
      </div>
    </section>
  );
}
