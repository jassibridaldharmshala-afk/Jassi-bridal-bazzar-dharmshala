import { useCallback, useEffect, useState } from 'react';
import PageHeader from '../../components/admin/PageHeader';
import DataTable from '../../components/admin/DataTable';
import SearchFilterBar from '../../components/admin/SearchFilterBar';
import StatusBadge from '../../components/admin/StatusBadge';
import api from '../../services/api';

export default function Subscribers() {
  const [subscribers, setSubscribers] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setMessage('');
    api.get('/admin/newsletter').then((items) => {
      setSubscribers(items || []);
      setMessage('');
    }).catch((error) => setMessage(error.message)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = subscribers.filter((item) => String(item.email || '').toLowerCase().includes(query.toLowerCase()));

  return (
    <section className="space-y-5">
      <PageHeader title="Newsletter subscribers" note="Emails collected from the store footer." />
      {message && <p role="alert" className="rounded-xl bg-rose/10 p-3 text-sm font-bold text-rose">{message} <button type="button" className="admin-btn-ghost" onClick={load}>Retry subscribers</button></p>}
      <SearchFilterBar search={query} onSearch={setQuery} placeholder="Search email" />
      <DataTable loading={loading} emptyTitle="No subscribers yet" heads={['Email', 'Source', 'Status', 'Joined']} rows={filtered.map((item) => (
        <tr key={item._id} className="border-t border-slate-100">
          <td className="px-4 py-4 font-black">{item.email}</td>
          <td className="px-4 py-4">{item.source || 'footer'}</td>
          <td className="px-4 py-4"><StatusBadge value={item.isActive ? 'Active' : 'Unsubscribed'} /></td>
          <td className="px-4 py-4">{item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-IN') : '-'}</td>
        </tr>
      ))} />
    </section>
  );
}
