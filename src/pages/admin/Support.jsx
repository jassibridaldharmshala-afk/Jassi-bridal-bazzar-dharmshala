import { useCallback, useEffect, useRef, useState } from 'react';
import PageHeader from '../../components/admin/PageHeader';
import DataTable from '../../components/admin/DataTable';
import SearchFilterBar from '../../components/admin/SearchFilterBar';
import StatusBadge from '../../components/admin/StatusBadge';
import { Select } from '../../components/ui/Field';
import api from '../../services/api';

const statuses = ['NEW', 'READ', 'REPLIED', 'CLOSED'];

export default function Support({ route = '' }) {
  const [messages, setMessages] = useState([]);
  const [query, setQuery] = useState(() => new URLSearchParams(route.split('?')[1] || '').get('search') || '');
  const loadSequence = useRef(0);
  useEffect(() => setQuery(new URLSearchParams(route.split('?')[1] || '').get('search') || ''), [route]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState({});
  const pendingIds = useRef(new Set());
  const messageId = /^[a-f\d]{24}$/i.test(query.trim()) ? query.trim() : '';

  const load = useCallback(() => {
    const sequence = ++loadSequence.current;
    setLoading(true);
    api.get(`/admin/contact${messageId ? `?id=${messageId}` : ''}`).then((items) => {
      if (sequence !== loadSequence.current) return;
      setMessages(items || []);
      setMessage('');
    }).catch((error) => { if (sequence === loadSequence.current) setMessage(error.message); }).finally(() => { if (sequence === loadSequence.current) setLoading(false); });
  }, [messageId]);

  useEffect(() => { load(); return () => { loadSequence.current += 1; }; }, [load]);

  const filtered = messages.filter((item) => {
    const haystack = [item._id, item.name, item.email, item.subject, item.message].join(' ').toLowerCase();
    return (!query || haystack.includes(query.toLowerCase())) && (!status || item.status === status);
  });

  const update = async (item, nextStatus) => {
    if (pendingIds.current.has(item._id)) return;
    pendingIds.current.add(item._id);
    setPending((current) => ({ ...current, [item._id]: true }));
    try {
      await api.put(`/admin/contact/${item._id}/status`, { status: nextStatus });
      setMessages((current) => current.map((entry) => (entry._id === item._id ? { ...entry, status: nextStatus } : entry)));
      setMessage('');
    } catch (error) {
      setMessage(error.message);
    } finally {
      pendingIds.current.delete(item._id);
      setPending((current) => ({ ...current, [item._id]: false }));
    }
  };

  return (
    <section className="space-y-5">
      <PageHeader title="Support inbox" note="Messages submitted from the contact form." />
      {message && <p role="alert" className="rounded-xl bg-rose/10 p-3 text-sm font-bold text-rose">{message} <button type="button" className="admin-btn-ghost" onClick={load}>Refresh inbox</button></p>}
      <SearchFilterBar search={query} onSearch={setQuery} placeholder="Search name, email or message">
        <Select value={status} onChange={(event) => setStatus(event.target.value)} className="w-full px-3 sm:w-44">
          <option value="">All Status</option>
          {statuses.map((item) => <option key={item}>{item}</option>)}
        </Select>
      </SearchFilterBar>
      <DataTable loading={loading} emptyTitle="No messages yet" heads={['From', 'Subject', 'Message', 'Status', 'Update']} rows={filtered.map((item) => (
        <tr key={item._id} className="border-t border-slate-100">
          <td className="px-4 py-4">
            <b>{item.name}</b>
            <div className="text-xs text-slate-500">{item.email}{item.phone ? ` · ${item.phone}` : ''}</div>
          </td>
          <td className="px-4 py-4">{item.subject || 'Website enquiry'}</td>
          <td className="max-w-sm px-4 py-4 text-sm">{item.message}</td>
          <td className="px-4 py-4"><StatusBadge value={item.status} /></td>
          <td className="px-4 py-4">
            <Select aria-label={`Status for ${item.name || item._id}`} disabled={pending[item._id]} value={item.status} onChange={(event) => update(item, event.target.value)} className="h-10 w-36 rounded-lg px-2">
              {statuses.map((value) => <option key={value}>{value}</option>)}
            </Select>
          </td>
        </tr>
      ))} />
    </section>
  );
}
