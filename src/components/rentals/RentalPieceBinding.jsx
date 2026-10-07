import { useEffect, useState } from 'react';
import api from '../../services/api';
import RentalProductPicker from './RentalProductPicker';
import { RentalField } from './RentalUi';
export default function RentalPieceBinding({ base, asset, onChange, disabled }) {
  const [product, setProduct] = useState(null);
  useEffect(() => {
    let live = true; setProduct(null);
    if (asset.productId) api.get(`${base}/manage/products?productId=${encodeURIComponent(asset.productId)}`, { silent: true }).then(value => { if (live) setProduct(value.rows?.[0] || null); }).catch(() => {});
    return () => { live = false; };
  }, [base, asset.productId]);
  const change = (key, value) => onChange({ ...asset, [key]: value });
  return <section className="rental-card"><h3>Exact physical piece mapping</h3><RentalProductPicker base={base} productId={asset.productId || ''} label="Product bound to this physical piece" disabled={disabled} onChoose={p => { setProduct(p); onChange({ ...asset, productId: p._id, variantId: '', size: '', colour: '' }); }} />
    <div className="rental-fields"><RentalField label="Exact piece variant"><select disabled={disabled} value={asset.variantId || ''} onChange={e => { const v = product?.variants?.find(v => v._id === e.target.value); onChange({ ...asset, variantId: e.target.value, size: v?.size || '', colour: v?.color || '' }); }}><option value="">No variant / choose exact variant</option>{asset.variantId && !product?.variants?.some(v => v._id === asset.variantId) && <option value={asset.variantId}>Current variant · {asset.variantId}</option>}{product?.variants?.map(v => <option key={v._id} value={v._id}>{v.sku} · {v.size} · {v.color}</option>)}</select></RentalField><RentalField label="Physical piece size" disabled={disabled || !!asset.variantId} value={asset.size || ''} onChange={v => change('size', v)} /><RentalField label="Physical piece colour" disabled={disabled || !!asset.variantId} value={asset.colour || ''} onChange={v => change('colour', v)} /></div>
    <p className="rental-muted">Pool, product, variant, size and colour must match the rental offer. Reserved pieces cannot change their mapping. Legacy unbound pieces need an exact mapping before use in newly edited offers.</p></section>;
}
