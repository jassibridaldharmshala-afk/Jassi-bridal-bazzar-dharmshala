import { useEffect, useState } from 'react';
import api from '../../services/api';
import DraftBatchSmartFill from './DraftBatchSmartFill';
export default function CatalogueLookBatch({ ids, apiPrefix, query = '', onClose, onSaved, onBusyChange }) {
  const [structure, setStructure] = useState(null), [error, setError] = useState('');
  useEffect(() => { let alive = true; api.get(`/catalog-configuration${query ? `?${query}` : ''}`, { silent: true }).then(value => { if (alive) setStructure(value); }).catch(e => { if (alive) setError(e.message); }); return () => { alive = false; }; }, [query]);
  if (!structure) return <section className="admin-form-card"><p role={error ? 'alert' : 'status'}>{error || 'Loading catalogue configuration…'}</p><button type="button" className="admin-btn-ghost" onClick={onClose}>Close</button></section>;
  return <DraftBatchSmartFill published query={query} drafts={ids.slice(0, 20).map(_id => ({ _id }))} categories={[]} structure={structure} apiPrefix={apiPrefix} onClose={onClose} onSaved={onSaved} onBusyChange={onBusyChange} onSave={form => api.put(`${apiPrefix}/products/${form._id}${query ? `?${query}` : ''}`, { bridalStyle: form.bridalStyle, bridalStyleAnalysis: form.bridalStyleAnalysis, expectedUpdatedAt: form.updatedAt }, { silent: true })} />;
}
