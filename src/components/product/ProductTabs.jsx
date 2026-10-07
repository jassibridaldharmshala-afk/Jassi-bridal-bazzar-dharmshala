import { CheckCircle2, Info, PackageCheck, Ruler, Shirt, Tag } from 'lucide-react';
import { buildProductDetails } from '../../utils/productDetails';
import './ProductTabs.css';

export default function ProductTabs({
  product,
  returnPolicy = '',
  shippingPolicy = '',
  freeShippingMinimum = 0,
  deliveryCharge = 0,
  onOpenSizeGuide,
}) {
  const details = buildProductDetails(product);
  const hasMaterialCare = Boolean(details.fabric || details.careInstructions);
  const hasDeliveryInformation = Boolean(returnPolicy || shippingPolicy || freeShippingMinimum || deliveryCharge);

  return (
    <section className="sc-tabs" id="desktop-product-details" aria-labelledby="desktop-product-details-title">
      <header className="sc-tabs__header">
        <div>
          <p className="sc-tabs__eyebrow">Everything about this style</p>
          <h2 id="desktop-product-details-title">Product details</h2>
        </div>
        {product?.sku ? <span className="sc-tabs__code">Product code: {product.sku}</span> : null}
      </header>

      <div className={`sc-tabs__body${details.highlights.length ? '' : ' sc-tabs__body--single'}`}>
        {details.description ? (
          <section className="sc-tabs__description">
            <SectionTitle icon={Info}>Description</SectionTitle>
            <p>{details.description}</p>
          </section>
        ) : (
          <section className="sc-tabs__description sc-tabs__description--pending">
            <SectionTitle icon={Info}>Description</SectionTitle>
            <p>Detailed product copy is being updated. Please use the verified specifications below when choosing this style.</p>
          </section>
        )}

        {details.highlights.length ? (
          <section className="sc-tabs__highlights">
            <h3>Key highlights</h3>
            <ul>
              {details.highlights.map((item) => (
                <li key={item}><CheckCircle2 aria-hidden="true" /><span>{item}</span></li>
              ))}
            </ul>
          </section>
        ) : null}

        {details.specifications.length ? (
          <section className="sc-tabs__specifications">
            <h3>Specifications</h3>
            {(details.specificationGroups || groupSpecifications(details.specifications)).map(({ group, items: rows }) => (
              <div key={group} className="mb-5 last:mb-0">
                {group !== 'Product information' ? <h4 className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-slate-500">{group}</h4> : null}
                <dl className="sc-tabs__details">
                  {rows.map(({ label, value }) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
                </dl>
              </div>
            ))}
          </section>
        ) : null}

        <div className="sc-tabs__service-grid">
          {details.sizes.length ? (
            <section className="sc-tabs__service-card">
              <SectionTitle icon={Ruler}>Size &amp; fit</SectionTitle>
              <p>Available in {details.sizes.join(', ')}.</p>
              {product?.sizeFitNotes ? <p>{product.sizeFitNotes}</p> : null}
              {onOpenSizeGuide ? <button type="button" onClick={onOpenSizeGuide}>View size guide</button> : null}
            </section>
          ) : null}

          {hasMaterialCare ? (
            <section className="sc-tabs__service-card">
              <SectionTitle icon={Shirt}>Material &amp; care</SectionTitle>
              {details.fabric ? <p><strong>Fabric:</strong> {details.fabric}</p> : null}
              {details.careInstructions ? <p><strong>Care:</strong> {details.careInstructions}</p> : null}
            </section>
          ) : null}

          {hasDeliveryInformation ? (
            <section className="sc-tabs__service-card">
              <SectionTitle icon={PackageCheck}>Delivery &amp; returns</SectionTitle>
              {shippingPolicy ? <p>{shippingPolicy}</p> : freeShippingMinimum > 0 ? (
                <p>Free shipping on orders of ₹{Number(freeShippingMinimum).toLocaleString('en-IN')} or more.</p>
              ) : deliveryCharge > 0 ? (
                <p>Standard delivery charge: ₹{Number(deliveryCharge).toLocaleString('en-IN')}.</p>
              ) : null}
              {returnPolicy ? <p><strong>Returns:</strong> {returnPolicy}</p> : null}
            </section>
          ) : null}
        </div>

        {details.tags.length ? (
          <section className="sc-tabs__tags">
            <SectionTitle icon={Tag}>Style tags</SectionTitle>
            <div>{details.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
          </section>
        ) : null}
      </div>
    </section>
  );
}

function SectionTitle({ icon: Icon, children }) {
  return <h3 className="sc-tabs__section-title"><Icon aria-hidden="true" />{children}</h3>;
}

function groupSpecifications(rows = []) {
  return [{ group: 'Product information', items: rows }];
}
