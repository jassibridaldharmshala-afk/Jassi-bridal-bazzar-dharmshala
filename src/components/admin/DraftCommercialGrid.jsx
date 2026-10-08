import { useEffect, useRef, useState } from 'react';
import { emptyRentalPricing, rentalPricingError } from './ProductRentalPricing';
const id = row => row._id || row.id;
function values(row) {
  return { ...row, commerceMode: row.commerceMode || 'SALE_ONLY', rentalPricing: { ...emptyRentalPricing, ...row.rentalPricing }, sellingPrice: row.sellingPrice ?? row.price ?? '', stock: row.stock ?? '' };
}
export default function DraftCommercialGrid({ drafts, onSave, onClose }) {
  const [rows, setRows] = useState(() => drafts.map(values)), [results, setResults] = useState({}), [busy, setBusy] = useState(false);
  const alive = useRef(true), lock = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const patch = (rowId, key, value) => { setRows(current => current.map(row => id(row) === rowId ? { ...row, [key]: value } : row)); setResults(current => ({ ...current, [rowId]: '' })); };
  const money = (row, key, raw) => patch(id(row), 'rentalPricing', { ...row.rentalPricing, [key]: raw === '' ? '' : Math.round(Number(raw) * 100) });
  const save = async () => {
    if (lock.current) return; lock.current = true; setBusy(true);
    try { for (const row of rows) {
      let error = row.commerceMode !== 'SALE_ONLY' ? rentalPricingError(row.rentalPricing) : '';
      if (row.commerceMode !== 'RENTAL_ONLY' && (!Number.isFinite(Number(row.sellingPrice)) || Number(row.sellingPrice) <= 0 || row.stock === '' || !Number.isInteger(Number(row.stock)) || Number(row.stock) < 0)) error = 'Enter an actual positive sale price and verified non-negative stock.';
      if (row.variants?.length || row.trackVariants) error = 'Use the full editor for SKU-specific stock and prices.';
      if (!error) { try { const saved = await onSave({ ...row, sellingPrice: Number(row.sellingPrice), stock: row.commerceMode === 'RENTAL_ONLY' ? row.stock : Number(row.stock) }, { silent: true }); if (alive.current) setRows(current => current.map(item => id(item) === id(row) ? values(saved) : item)); }
      catch (err) { error = err.data?.message || err.message || 'Save failed. Reload this draft if it changed in another session.'; } }
      if (!alive.current) break;
      setResults(current => ({ ...current, [id(row)]: error || 'Saved — review before publishing' }));
    } } finally { lock.current = false; if (alive.current) setBusy(false); }
  };
  return <section className="admin-card p-4" aria-label="Bulk commercial review"><h2>Review prices and verified stock</h2><p>Enter real per-product values. Rental pieces are registered separately after publishing. AI does not fill business prices or inventory here.</p>
    <div className="overflow-x-auto"><table className="w-full"><thead><tr><th>Product</th><th>Sell / rent</th><th>Sale price ₹</th><th>Sale stock</th><th>Daily rent ₹</th><th>Refundable security ₹</th><th>Result</th></tr></thead><tbody>{rows.map(row => <tr key={id(row)}>
      <th>{row.name || 'Untitled draft'}</th><td><select aria-label={`Mode for ${row.name}`} disabled={busy || row.trackVariants} value={row.commerceMode} onChange={e => patch(id(row), 'commerceMode', e.target.value)}><option value="SALE_ONLY">Sale</option><option value="RENTAL_ONLY">Rental</option><option value="SALE_AND_RENTAL">Both</option></select></td>
      <td><input aria-label={`Sale price for ${row.name}`} disabled={busy || row.commerceMode === 'RENTAL_ONLY'} type="number" min="0.01" step="0.01" value={row.sellingPrice} onChange={e => patch(id(row), 'sellingPrice', e.target.value)} /></td>
      <td><input aria-label={`Sale stock for ${row.name}`} disabled={busy || row.commerceMode === 'RENTAL_ONLY'} type="number" min="0" step="1" value={row.stock} onChange={e => patch(id(row), 'stock', e.target.value)} /></td>
      {['dailyRatePaise', 'depositPaise'].map(key => <td key={key}><input aria-label={`${key === 'dailyRatePaise' ? 'Daily rent' : 'Security deposit'} for ${row.name}`} disabled={busy || row.commerceMode === 'SALE_ONLY'} type="number" min={key === 'dailyRatePaise' ? '0.01' : '0'} step="0.01" value={row.rentalPricing[key] === '' || row.rentalPricing[key] === undefined ? '' : row.rentalPricing[key] / 100} onChange={e => money(row, key, e.target.value)} /></td>)}
      <td role="status">{results[id(row)] || 'Awaiting review'}</td>
    </tr>)}</tbody></table></div><p>Existing per-offer advance and fitting rules are preserved. Use the individual editor to configure them.</p><div className="flex gap-3"><button type="button" className="admin-btn" disabled={busy} onClick={save}>{busy ? 'Saving reviewed values…' : 'Save reviewed values'}</button><button type="button" className="admin-btn-ghost" disabled={busy} onClick={onClose}>Close review</button></div>
  </section>;
}

