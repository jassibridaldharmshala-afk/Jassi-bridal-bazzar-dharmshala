import { RentalField } from './RentalUi';
export default function RentalFittingFields({ value, onChange, disabled = false }) {
  const fitting = value || { adjustable: false, alterationsAvailable: false, instructions: '' };
  const patch = (key, next) => onChange({ ...fitting, [key]: next });
  return <fieldset disabled={disabled} className="rental-fitting-fields"><legend>Fitting & adjustments</legend>
    <label className="rental-check"><input type="checkbox" checked={fitting.adjustable === true} onChange={e => patch('adjustable', e.target.checked)} />Adjustable fitting — no compulsory fixed size</label>
    <label className="rental-check"><input type="checkbox" checked={fitting.alterationsAvailable === true} onChange={e => patch('alterationsAvailable', e.target.checked)} />Stitching / alterations available</label>
    <RentalField label="Customer fitting instructions (optional)" multiline maxLength={1000} value={fitting.instructions} onChange={value => patch('instructions', value)} />
    <p className="rental-muted">Confirm fitting with the customer before handover. Actual measurements stay optional and private; alteration fees appear in the quote.</p>
  </fieldset>;
}
export function RentalFittingInfo({ value }) {
  if (!value) return null;
  return <div className="rental-fitting-info">{(value.adjustable || value.alterationsAvailable) && <p>{value.adjustable && <span>Adjustable fitting</span>}{value.alterationsAvailable && <span>Stitching / alterations available</span>}</p>}{value.instructions && <p className="rental-muted">{value.instructions}</p>}</div>;
}
