export default function RentalModeSelector({ product, value, onChange, purchaseEnabled = true }) {
  const canBuy = product.commerceMode !== 'RENTAL_ONLY' && purchaseEnabled;
  return <div className="rental-mode-selector"><div className="rental-mode-tabs" role="group" aria-label="Buy or rent this product">{canBuy && <button type="button" aria-pressed={value === 'buy'} className={value === 'buy' ? 'is-selected' : ''} onClick={() => onChange?.('buy')}>Buy</button>}<button type="button" aria-pressed={value === 'rent' || !canBuy} className={value === 'rent' || !canBuy ? 'is-selected' : ''} onClick={() => onChange?.('rent')}>Rental</button></div></div>;
}
