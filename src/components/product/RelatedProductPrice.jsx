import { wishlistPrice } from '../../utils/wishlist';
import './RelatedProductCarousel.css';

export function isRentalRecommendation(product, purchaseMode = 'buy') {
  return product.commerceMode === 'RENTAL_ONLY'
    || product.discoveryPurchase === 'RENTAL'
    || (purchaseMode === 'rent' && product.commerceMode === 'SALE_AND_RENTAL');
}

export default function RelatedProductPrice({ product, rental }) {
  const { price, original, discount } = wishlistPrice(product);
  const dailyRatePaise = Number(product.rentalPreview?.dailyRatePaise);
  const hasRentalRate = Number.isFinite(dailyRatePaise) && dailyRatePaise > 0;
  const money = amount => `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  const amount = rental ? hasRentalRate ? money(dailyRatePaise / 100) : 'Check rental rates' : money(price);

  return (
    <div className="sc-related-price">
      <div className="sc-related-price__row">
        <span className="sc-related-price__amount">
          {amount}{rental && hasRentalRate && <> <span className="sc-related-price__unit">/ use day</span></>}
        </span>
        {!rental && original > price && <span className="sc-related-price__original">{money(original)}</span>}
      </div>
      {rental ? <p className="sc-related-price__rental">Rental</p> : discount > 0 ? <p className="sc-related-price__discount">({discount}% OFF)</p> : null}
    </div>
  );
}
