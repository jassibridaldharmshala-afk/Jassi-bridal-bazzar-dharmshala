import { AlertCircle, ArrowLeft, LoaderCircle, ShoppingBag } from 'lucide-react';
import './RentalCheckoutLoading.css';

export default function RentalCheckoutLoading({ onBack, label = 'Preparing your booking', error = '', onRetry }) {
  return <section className="rental-checkout-loading" aria-busy={!error}>
    <header className="rental-checkout-loading__header">
      {onBack && <button type="button" aria-label="Back" onClick={onBack}><ArrowLeft size={20} /></button>}
      <h1><ShoppingBag size={17} aria-hidden="true" />Rental checkout</h1>
    </header>
    <div className="rental-checkout-loading__shell">
      <ol className="rental-checkout-loading__steps" aria-label="Rental checkout progress">
        {['Dates', 'Contact', 'Review'].map((step, index) => <li key={step} aria-current={index === 0 ? 'step' : undefined}><span>{index + 1}</span>{step}</li>)}
      </ol>
      <div className="rental-checkout-loading__status" role={error ? 'alert' : 'status'} aria-live="polite">
        {error ? <AlertCircle size={20} aria-hidden="true" /> : <LoaderCircle size={20} className="rental-checkout-loading__spinner" aria-hidden="true" />}
        <div><h2>{error ? 'We couldn’t open checkout' : label}</h2><p>{error || 'Loading rental details and pickup options.'}</p></div>
        {error && onRetry && <button type="button" onClick={onRetry}>Try again</button>}
      </div>
      {!error && <div className="rental-checkout-loading__layout" aria-hidden="true">
        <div className="rental-checkout-loading__main">
          <div className="rental-checkout-loading__card rental-checkout-loading__item"><div className="rental-checkout-loading__block rental-checkout-loading__image" /><div><div className="rental-checkout-loading__block rental-checkout-loading__title" /><div className="rental-checkout-loading__block rental-checkout-loading__line" /><div className="rental-checkout-loading__block rental-checkout-loading__price" /><div className="rental-checkout-loading__block rental-checkout-loading__line" /></div></div>
          <div className="rental-checkout-loading__card"><div className="rental-checkout-loading__block rental-checkout-loading__title" /><div className="rental-checkout-loading__block rental-checkout-loading__field" /><div className="rental-checkout-loading__field-pair"><div className="rental-checkout-loading__block rental-checkout-loading__field" /><div className="rental-checkout-loading__block rental-checkout-loading__field" /></div><div className="rental-checkout-loading__field-pair"><div className="rental-checkout-loading__block rental-checkout-loading__field" /><div className="rental-checkout-loading__block rental-checkout-loading__field" /></div></div>
        </div>
        <div className="rental-checkout-loading__card rental-checkout-loading__summary"><div className="rental-checkout-loading__block rental-checkout-loading__title" /><div className="rental-checkout-loading__row"><div className="rental-checkout-loading__block rental-checkout-loading__line" /><div className="rental-checkout-loading__block rental-checkout-loading__price" /></div><div className="rental-checkout-loading__row"><div className="rental-checkout-loading__block rental-checkout-loading__line" /><div className="rental-checkout-loading__block rental-checkout-loading__price" /></div><div className="rental-checkout-loading__row rental-checkout-loading__total"><div className="rental-checkout-loading__block rental-checkout-loading__line" /><div className="rental-checkout-loading__block rental-checkout-loading__price" /></div><div className="rental-checkout-loading__block rental-checkout-loading__action" /></div>
      </div>}
    </div>
  </section>;
}
