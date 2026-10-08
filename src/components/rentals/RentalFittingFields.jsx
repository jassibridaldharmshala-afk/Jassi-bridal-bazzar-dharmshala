import { RentalField } from './RentalUi';
export default function RentalFittingFields({ value, onChange, disabled = false }) {
  const fitting = value || { adjustable: false, alterationsAvailable: false, instructions: '' };
  const patch = (key, next) => onChange({ ...fitting, [key]: next });
  return <fieldset disabled={disabled} className="rental-fitting-fields"><legend>Fitting & adjustments</legend>
    <label className="rental-check"><input type="checkbox" checked={fitting.adjustable === true} onChange={e => patch('adjustable', e.target.checked)} />Adjustable fitting — no compulsory fixed size</label>
    <label className="rental-check"><input type="checkbox" checked={fitting.alterationsAvailable === true} onChange={e => patch('alterationsAvailable', e.target.checked)} />Stitching / alterations available</label>
    <RentalField label="Owner fitting template (optional)"><select value={fitting.type || 'OTHER'} onChange={e => patch('type', e.target.value)}><option value="OTHER">General / adjustable</option><option value="LEHENGA">Lehenga / bridal clothing</option><option value="BANGLES_RINGS">Bangles / rings</option><option value="NECKLACE">Necklace</option><option value="BRIDAL_SET">Bridal set</option></select></RentalField>
    {['LEHENGA', 'NECKLACE'].includes(fitting.type) && <><RentalField label="Measurement unit"><select value={fitting.unit || 'cm'} onChange={e => patch('unit', e.target.value)}><option value="cm">Centimetres</option><option value="in">Inches</option></select></RentalField><div className="rental-fields">{(fitting.type === 'LEHENGA' ? [['waistMin', 'Waist minimum'], ['waistMax', 'Waist maximum'], ['bustMin', 'Bust minimum'], ['bustMax', 'Bust maximum'], ['length', 'Outfit length'], ['alterationAllowance', 'Alteration allowance']] : [['necklaceLength', 'Necklace length'], ['necklaceWidth', 'Necklace width']]).map(([key, label]) => <RentalField key={key} label={label + ' (owner measured, optional)'} type="number" min="0" max="10000" step="0.1" value={fitting.measurements?.[key] ?? ''} onChange={raw => onChange({ ...fitting, unit: fitting.unit || 'cm', measurements: { ...fitting.measurements, [key]: raw === '' ? '' : Number(raw) } })} />)}</div></>}
    {fitting.type === 'BANGLES_RINGS' && <RentalField label="Actual bangle / ring size (optional, owner checked)" value={fitting.actualSize} maxLength={100} onChange={size => patch('actualSize', size)} />}
    <RentalField label="Exact included items / set contents (optional)" multiline maxLength={1000} value={fitting.includedItems} onChange={items => patch('includedItems', items)} />
    <RentalField label="Customer fitting instructions (optional)" multiline maxLength={1000} value={fitting.instructions} onChange={value => patch('instructions', value)} />
    <p className="rental-muted">Confirm fitting with the customer before handover. Actual measurements stay optional and private; alteration fees appear in the quote.</p>
  </fieldset>;
}
export function RentalFittingInfo({ value }) {
  if (!value) return null;
  return <div className="rental-fitting-info">{(value.adjustable || value.alterationsAvailable) && <p>{value.adjustable && <span>Adjustable fitting</span>}{value.alterationsAvailable && <span>Stitching / alterations available</span>}</p>}{value.instructions && <p className="rental-muted">{value.instructions}</p>}{value.actualSize && <p>Owner-checked size: {value.actualSize}</p>}{value.includedItems && <p>Included: {value.includedItems}</p>}{value.measurements && <p className="rental-muted">{Object.entries(value.measurements).filter(([, v]) => v !== '' && v !== null).map(([key, v]) => `${key.replace(/([A-Z])/g, ' $1')}: ${v} ${value.unit || 'cm'}`).join(' · ')}</p>}</div>;
}
