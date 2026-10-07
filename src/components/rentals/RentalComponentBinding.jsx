import RentalPieceBinding from './RentalPieceBinding';
export default function RentalComponentBinding({ base, listing, onChange, disabled }) {
  if (listing.requirements.length < 2) return null;
  return <section><h3>Exact component eligibility</h3><p className="rental-muted">Map every component to its actual catalogue product. This prevents the wrong size, colour or unrelated piece being allocated from a shared pool.</p>{listing.requirements.map((requirement, index) => <div key={`${index}:${requirement.poolKey}`}><h4>{requirement.label || `Component ${index + 1}`}</h4><RentalPieceBinding base={base} disabled={disabled} asset={requirement} onChange={value => onChange({ ...listing, requirements: listing.requirements.map((r, i) => i === index ? { ...r, productId: value.productId, variantId: value.variantId, size: value.size, colour: value.colour } : r) })} /></div>)}</section>;
}
