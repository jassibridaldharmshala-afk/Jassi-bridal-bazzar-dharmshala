import { useRef, useState } from 'react';
import api from '../../services/api';
import { rentalOperation } from '../../utils/rentals';
import { RentalField } from './RentalUi';
export default function RentalSaleTransfer({ base, asset, enabled, run, onConverted, busy }) {
  const [note, setNote] = useState(''), [confirmed, setConfirmed] = useState(false), operation = useRef(rentalOperation());
  if (!asset._id || !enabled) return null;
  return <section className="rental-card"><h3>Transfer this physical piece to sale stock</h3>{asset.saleConversion ? <p className="rental-muted">Already transferred. This rental code is permanently retired; the sale stock was increased once.</p> : <><p className="rental-muted">Only a ready, unassigned piece with no reservations can move. Its exact sale product/variant receives one unit. This does not sell an item or collect payment.</p><RentalField label="Stock transfer reason" value={note} onChange={setNote} /><label className="rental-check"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I physically moved this piece into the exact mapped sale inventory</label><button type="button" className="rental-button" disabled={busy || !confirmed || !note || !asset.productId || asset.status !== 'READY'} onClick={() => run(async () => { const result = await api.post(`${base}/assets/${asset._id}/convert-to-sale`, { revision: asset.revision, operationId: operation.current, productId: asset.productId, variantId: asset.variantId, confirmTransfer: confirmed, note }); onConverted(result); })}>Transfer one piece to sale inventory</button></>}</section>;
}
