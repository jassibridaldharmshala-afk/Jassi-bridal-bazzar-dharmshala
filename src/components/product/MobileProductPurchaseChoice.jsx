import { CalendarDays, Check, ShoppingBag } from 'lucide-react';
import { rentalMoney } from '../../utils/rentals';

export default function MobileProductPurchaseChoice({ mode, onChange, salePrice, rental, disabled = false }) {
  return <div className="mobile-product-purchase-choice" role="group" aria-label="Buy or rent this product">
    <p>Available to buy or rent</p>
    <div className="mobile-product-purchase-choice__options">
      <button type="button" aria-label="View buy details" aria-pressed={mode === 'buy'} disabled={disabled} onClick={() => onChange('buy')}>
        <span className="mobile-product-purchase-choice__label"><ShoppingBag aria-hidden="true" />Buy<Check className="mobile-product-purchase-choice__check" aria-hidden="true" /></span>
        <strong>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(salePrice)}</strong>
        <small>Own this piece</small>
      </button>
      <button type="button" aria-label="View rental details" aria-pressed={mode === 'rent'} disabled={disabled} onClick={() => onChange('rent')}>
        <span className="mobile-product-purchase-choice__label"><CalendarDays aria-hidden="true" />Rental<Check className="mobile-product-purchase-choice__check" aria-hidden="true" /></span>
        <strong>{rental.listing ? rentalMoney(rental.listing.dailyRatePaise) : rental.loading ? 'Loading…' : 'Check details'}</strong>
        <small>{rental.listing ? 'Per use day' : 'Price & booking availability'}</small>
      </button>
    </div>
  </div>;
}
