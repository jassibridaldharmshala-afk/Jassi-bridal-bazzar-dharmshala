import { useEffect, useState } from 'react';
import api from '../../services/api';
export default function RentalProductPicker({ base, productId, disabled, onChoose, label = 'Product for this rental offer' }) {
  const [search, setSearch] = useState(''), [query, setQuery] = useState(''), [data, setData] = useState(null), [page, setPage] = useState(1), [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    api.get(`${base}/manage/products?search=${encodeURIComponent(query)}&page=${page}`, { silent: true }).then(value => { if (alive) { setData(value); setError(''); } }).catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [base, query, page]);
  return <section className="rental-card"><h3>Choose catalogue product</h3><div className="rental-fields"><label className="rental-field"><span>Product name or SKU</span><input disabled={disabled} value={search} onChange={e => setSearch(e.target.value)} /></label><button type="button" className="rental-button rental-button--secondary" disabled={disabled} onClick={() => { setQuery(search); setPage(1); }}>Find products</button></div>{error && <p role="alert">{error}</p>}<label className="rental-field"><span>{label}</span><select disabled={disabled} value={productId} onChange={e => { const product = data?.rows.find(row => row._id === e.target.value); if (product) onChoose(product); }}><option value="">Choose an existing product</option>{productId && !data?.rows.some(row => row._id === productId) && <option value={productId}>Current product · {productId}</option>}{data?.rows.map(product => <option key={product._id} value={product._id}>{product.name} · {product.sku || 'No SKU'}</option>)}</select></label>{data && <div className="rental-actions"><button type="button" className="rental-button rental-button--secondary" disabled={disabled || page <= 1} onClick={() => setPage(p => p - 1)}>Previous products</button><span>{data.total} products · page {page}</span><button type="button" className="rental-button rental-button--secondary" disabled={disabled || page >= data.pages} onClick={() => setPage(p => p + 1)}>Next products</button></div>}</section>;
}
