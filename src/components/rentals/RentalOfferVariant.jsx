import { useEffect, useState } from 'react';
import api from '../../services/api';
import { RentalField } from './RentalUi';
export default function RentalOfferVariant({ base, listing, onChange, disabled }) {
  const [variants, setVariants] = useState([]);
  useEffect(() => {
    let live = true; setVariants([]);
    if (listing.productId) api.get(`${base}/manage/products?productId=${encodeURIComponent(listing.productId)}`, { silent: true }).then(value => { if (live) setVariants((value.rows?.[0]?.variants || []).filter(v => v.isActive !== false)); }).catch(() => {});
    return () => { live = false; };
  }, [base, listing.productId]);
  return <RentalField label="Exact rental offer variant"><select disabled={disabled} value={listing.variantId || ''} onChange={e => { const variant = variants.find(v => v._id === e.target.value); onChange({ ...listing, variantId: e.target.value, size: variant?.size || '', colour: variant?.color || '' }); }}><option value="">No exact variant — match the entered size / colour</option>{listing.variantId && !variants.some(v => v._id === listing.variantId) && <option value={listing.variantId}>Current variant (check availability)</option>}{variants.map(v => <option key={v._id} value={v._id}>{v.sku} · {v.size} · {v.color}</option>)}</select></RentalField>;
}
