import { ShoppingBag } from 'lucide-react';
import { rentalMoney } from '../../utils/rentals';

export default function RentalCheckoutSummary({ data, estimate }) {
  const quote = data?.quote;
  if (!quote && !estimate) return <div className="rental-price-summary"><h2><ShoppingBag size={17} aria-hidden="true" />Price summary</h2><p className="rental-shopping-hint">Review unavailable items in your bag to see the total.</p></div>;

  const days = quote ? data.schedule.days : estimate.days;
  const rent = quote ? quote.items.reduce((sum, item) => sum + item.rentPaise, 0) : estimate.rent;
  const services = quote?.items.reduce((sum, item) => sum + (item.feesPaise || 0), 0) || 0;
  const delivery = (quote?.deliveryFeePaise || 0) + (quote?.returnFeePaise || 0);
  const deposit = quote ? quote.depositPaise : estimate.deposit;
  const total = quote ? quote.totalPaise : estimate.total;
  return <div className="sc-mobile-checkout__prices rental-price-summary" aria-label="Rental price summary">
    <h2><ShoppingBag size={17} aria-hidden="true" />Price summary</h2>
    {!quote && estimate.assumedDays && <p className="rental-price-summary__basis">Estimate for 1 use day</p>}
    <div className="rental-price-row"><span>Rent · {days} use {days === 1 ? 'day' : 'days'}</span><strong>{rentalMoney(rent)}</strong></div>
    {services > 0 && <div className="rental-price-row"><span>Cleaning / alteration services</span><strong>{rentalMoney(services)}</strong></div>}
    {delivery > 0 && <div className="rental-price-row"><span>Delivery & collection</span><strong>{rentalMoney(delivery)}</strong></div>}
    <div className="rental-price-row"><span>Refundable deposit</span><strong>{rentalMoney(deposit)}</strong></div>
    {quote?.tax?.taxPaise > 0 && <div className="rental-price-row"><span>Tax included in rent</span><strong>{rentalMoney(quote.tax.taxPaise)}</strong></div>}
    <div className="rental-price-row rental-price-row--total rental-price-summary__total"><span><strong>{quote ? 'Total' : 'Estimated total'}</strong><small>Includes refundable deposit</small></span><strong>{rentalMoney(total)}</strong></div>
    {quote && <div className="rental-price-summary__payment"><div className="rental-price-row"><span>Pay now</span><strong>{rentalMoney(quote.dueNowPaise)}</strong></div><div className="rental-price-row"><span>Remaining at pickup</span><strong>{rentalMoney(quote.remainingPaise)}</strong></div></div>}
    <p className="rental-shopping-hint rental-price-summary__note">{quote ? 'Deposit is settled after return inspection. Applicable taxes are included.' : estimate.assumedDays ? 'Select your use days to update this estimate. Availability and any additional fees are confirmed next.' : 'Pickup and return days add no rent. Availability and any additional fees are confirmed next.'}</p>
  </div>;
}
