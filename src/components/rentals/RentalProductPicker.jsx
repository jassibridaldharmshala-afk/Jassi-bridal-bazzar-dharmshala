import { useEffect, useRef, useState } from 'react';
import api from '../../services/api';
export default function RentalProductPicker({ base, productId, disabled, onChoose, onResolve, label = 'Product for this rental offer' }) {
  const [search, setSearch] = useState(''), [query, setQuery] = useState(''), [data, setData] = useState(null), [page, setPage] = useState(1), [error, setError] = useState(''), [selected, setSelected] = useState(null), [reload, setReload] = useState(0);
  const resolved = useRef(onResolve); resolved.current = onResolve;
  useEffect(() => {
    let alive = true; setData(null); setError('');
    api.get(`${base}/manage/products?search=${encodeURIComponent(query)}&page=${page}`, { silent: true }).then(value => { if (!Array.isArray(value?.rows)) throw new Error('Products could not be loaded. Try again.'); if (alive) setData(value); }).catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [base, query, page, reload]);
  useEffect(() => {
    let alive = true; setSelected(null);
    if (!productId) return undefined;
    api.get(`${base}/manage/products?productId=${encodeURIComponent(productId)}&page=1`, { silent: true }).then(value => {
      const product = value?.rows?.find(row => String(row._id) === String(productId));
      if (!product) throw new Error('This product is unavailable in your shop. Choose another catalogue product.');
      if (alive) { setSelected(product); resolved.current?.(product); }
    }).catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [base, productId, reload]);
  const current = selected || data?.rows.find(row => row._id === productId);
  return <section className="rental-card rental-product-picker"><h3>Choose catalogue product</h3><p className="rental-muted">Use a product already published in your shop. Its rental offer keeps its own prices and physical pieces.</p>
    <form className="rental-picker-search" onSubmit={e => { e.preventDefault(); setQuery(search.trim()); setPage(1); }}><label className="rental-field"><span>Product name or SKU</span><input disabled={disabled} value={search} placeholder="Search your catalogue" onChange={e => setSearch(e.target.value)} /></label><button type="submit" className="rental-button rental-button--secondary" disabled={disabled}>Find products</button></form>
    {error && <p role="alert" className="rental-notice">{error} <button type="button" className="rental-text-button" onClick={() => setReload(v => v + 1)}>Retry products</button></p>}
    {!data && !error && <p role="status">Loading your catalogue…</p>}
    <label className="rental-field"><span>{label}</span><select disabled={disabled || !data} value={productId} onChange={e => { const product = data?.rows.find(row => row._id === e.target.value); if (product) onChoose(product); }}><option value="">Choose an existing product</option>{productId && !data?.rows.some(row => row._id === productId) && <option value={productId}>{current?.name || 'Selected product'}</option>}{data?.rows.map(product => <option key={product._id} value={product._id}>{product.name}{product.sku ? ' · ' + product.sku : ''}</option>)}</select></label>
    {current && <div className="rental-selected-product"><strong>{current.name}</strong><span>{current.sku ? 'SKU ' + current.sku + ' · ' : ''}{current.commerceMode === 'SALE_ONLY' ? 'Sale only — enable Rent or Sale + rent in the product editor before activation.' : 'Selected catalogue product'}</span></div>}
    {data && (data.pages > 1 || page > 1) && <div className="rental-actions"><button type="button" className="rental-button rental-button--secondary" disabled={disabled || page <= 1} onClick={() => setPage(p => p - 1)}>Previous products</button><span>{data.total} products · page {page}</span><button type="button" className="rental-button rental-button--secondary" disabled={disabled || page >= data.pages} onClick={() => setPage(p => p + 1)}>Next products</button></div>}
    {data && !data.rows.length && <p className="rental-muted">No products found. Publish the product in Product Drafts, or try another search.</p>}
  </section>;
}
