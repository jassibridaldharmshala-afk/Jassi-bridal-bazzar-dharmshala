import { RentalField } from './RentalUi';
export default function RentalPolicyControls({ policy: p, onChange: change }) {
  return <section className="rental-card">
    <h3>Compulsory booking advance</h3>
    <p className="rental-muted">Every new booking needs a verified positive advance before confirmation. An unpaid checkout hold is temporary. Existing bookings keep their accepted policy.</p>
    <div className="rental-fields">
      <RentalField label="Advance calculation"><select value={p.advanceMode || 'PERCENT'} onChange={e => change('advanceMode', e.target.value)}><option value="PERCENT">Percentage of rent & services</option><option value="FIXED">Fixed amount per booking</option></select></RentalField>
      {(p.advanceMode || 'PERCENT') === 'PERCENT' ? <RentalField label="Compulsory advance (%)" type="number" min="1" max="100" step="1" value={p.advancePercent} onChange={v => change('advancePercent', v === '' ? '' : Number(v))} /> : <RentalField label="Compulsory fixed advance (₹)" type="number" min="0.01" step="0.01" value={(p.advanceAmountPaise ?? 10000) / 100} onChange={v => change('advanceAmountPaise', v === '' ? '' : Math.round(Number(v) * 100))} />}
      <RentalField label="Security deposit collection"><select value={p.depositTiming || 'BOOKING'} onChange={e => change('depositTiming', e.target.value)}><option value="BOOKING">With booking advance</option><option value="PICKUP">Before handover / dispatch</option></select></RentalField>
    </div>
    <p className="rental-muted">Fixed advance is capped at the rental charge. Deposit is separate; full rent and deposit must be paid before physical handover.</p>
    <h3>Condition and customer acknowledgement</h3>
    <label className="rental-check"><input type="checkbox" checked={!!p.requireConditionPhotos} onChange={e => change('requireConditionPhotos', e.target.checked)} />Require private condition photos before handover and return</label>
    <label className="rental-check"><input type="checkbox" checked={!!p.requireCustomerAcknowledgement} onChange={e => change('requireCustomerAcknowledgement', e.target.checked)} />Require verified customer acknowledgement of pieces/condition</label>
    <p className="rental-muted">Customers acknowledge through their verified account in My rentals. Counter customers must register first if acknowledgement is required. Photos are private, metadata-stripped and retained for 180 days after settlement closes.</p>
    <h3>No-show and early return</h3>
    <div className="rental-fields">
      <RentalField label="No-show grace after pickup (hours)" type="number" min="0" max="168" value={p.noShowGraceHours ?? 24} onChange={v => change('noShowGraceHours', Number(v))} />
      <RentalField label="No-show rent retained (%)" type="number" min="0" max="100" value={p.noShowRetainPercent ?? 100} onChange={v => change('noShowRetainPercent', Number(v))} />
      <RentalField label="Early return pricing"><select value={p.earlyReturnPolicy || 'AGREED_PERIOD'} onChange={e => change('earlyReturnPolicy', e.target.value)}><option value="AGREED_PERIOD">Keep the agreed rental period</option><option value="ACTUAL_DAYS">Recalculate complete early return by actual started days</option></select></RentalField>
    </div>
    <p className="rental-muted">No-show is recorded by staff, not automatically. Retention cannot consume the deposit or exceed rent actually paid. Early-return reductions follow inspection/refund settlement; missing pieces do not qualify.</p>
    <h3>Rental invoice preferences</h3>
    <div className="rental-fields"><RentalField label="Included rental tax (%)" type="number" min="0" max="100" step="0.01" value={(p.rentalTaxBasisPoints || 0) / 100} onChange={v => change('rentalTaxBasisPoints', Math.round(Number(v) * 100))} /><RentalField label="Rental service / classification code" value={p.rentalServiceCode || ''} onChange={v => change('rentalServiceCode', v)} maxLength="30" /></div>
    <p className="rental-muted">Configure the rate and classification for your business. The invoice separates rent, included tax and refundable deposit; these settings do not change sale tax calculations.</p>
    <h3>Integrated outgoing / return couriers</h3>
    <label className="rental-check"><input type="checkbox" checked={!!p.courierIntegrationEnabled} onChange={e => change('courierIntegrationEnabled', e.target.checked)} />Enable carrier booking, pickup, labels and tracking for rental courier legs</label>
    <p className="rental-muted">Requires shipping automation access, your own configured carrier account and reverse-pickup support for returns. Booking happens only when staff explicitly requests it; manual courier and self delivery remain available.</p>
  </section>;
}
