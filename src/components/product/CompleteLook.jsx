import { useEffect, useState } from 'react';
import api from '../../services/api';
import { normalizeProducts } from '../../services/normalize';
import RelatedProductCarousel from './RelatedProductCarousel';
import { SETTINGS_CHANGED_EVENT, SETTINGS_STORAGE_KEY } from '../../config/storeSettings';
export default function CompleteLook({ productId, storeSlug = '', navigate }) {
  const [rows, setRows] = useState([]), [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    const storage = event => { if (event.key === SETTINGS_STORAGE_KEY || event.key === null) refresh(); };
    window.addEventListener(SETTINGS_CHANGED_EVENT, refresh); window.addEventListener('storage', storage); window.addEventListener('focus', refresh);
    return () => { window.removeEventListener(SETTINGS_CHANGED_EVENT, refresh); window.removeEventListener('storage', storage); window.removeEventListener('focus', refresh); };
  }, []);
  useEffect(() => {
    let alive = true; setRows([]);
    if (!productId) return undefined;
    Promise.resolve(api.get(`/products/${encodeURIComponent(productId)}/complete-look?store=${encodeURIComponent(storeSlug)}`, { silent: true, cacheScope: `complete-look:${storeSlug}:${productId}:${revision}` })).then(value => { if (alive && value?.enabled && Array.isArray(value.products)) setRows(normalizeProducts(value.products)); }).catch(() => {});
    return () => { alive = false; };
  }, [productId, storeSlug, revision]);
  if (!rows.length) return null;
  return <div className="container-page py-6"><RelatedProductCarousel products={rows} navigate={navigate} title="Complete the look" description="Matching pieces, chosen by the store or matched to this product’s occasion and colours. Each item is optional and selected separately." /></div>;
}
