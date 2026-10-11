import useAdminFeedback from '../../hooks/useAdminFeedback';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, RefreshCw } from 'lucide-react';
import PageHeader from '../../components/admin/PageHeader';
import AdminFeedback from '../../components/admin/AdminFeedback';
import DataTable from '../../components/admin/DataTable';
import SearchFilterBar from '../../components/admin/SearchFilterBar';
import { Select } from '../../components/ui/Field';
import api from '../../services/api';
import './Support.css';

const statuses = ['NEW', 'READ', 'REPLIED', 'CLOSED'];
const statusLabels = { NEW: 'New', READ: 'Read', REPLIED: 'Replied', CLOSED: 'Closed' };

export default function Support({ route = '' }) {
  const [messages, setMessages] = useState([]);
  const [query, setQuery] = useState(() => new URLSearchParams(route.split('?')[1] || '').get('search') || '');
  const loadSequence = useRef(0);
  useEffect(() => setQuery(new URLSearchParams(route.split('?')[1] || '').get('search') || ''), [route]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useAdminFeedback('', 'error', 'Support');
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
    }).catch((error) => { if (sequence === loadSequence.current) setMessage(error.message, 'error'); }).finally(() => { if (sequence === loadSequence.current) setLoading(false); });
  }, [messageId, setMessage]);

  useEffect(() => { load(); return () => { loadSequence.current += 1; }; }, [load]);

  const filtered = messages.filter((item) => {
    const haystack = [item._id, item.name, item.email, item.phone, item.subject, item.message].join(' ').toLowerCase();
    return (!query.trim() || haystack.includes(query.trim().toLowerCase())) && (!status || item.status === status);
  });

  const update = async (item, nextStatus) => {
    if (pendingIds.current.has(item._id)) return;
    pendingIds.current.add(item._id);
    setPending((current) => ({ ...current, [item._id]: true }));
    try {
      await api.put(`/admin/contact/${item._id}/status`, { status: nextStatus });
      setMessages((current) => current.map((entry) => (entry._id === item._id ? { ...entry, status: nextStatus } : entry)));
      setMessage({ text: `Message marked ${statusLabels[nextStatus].toLowerCase()}.`, type: 'success' });
    } catch (error) {
      setMessage(error.message, 'error');
    } finally {
      pendingIds.current.delete(item._id);
      setPending((current) => ({ ...current, [item._id]: false }));
    }
  };

  return (
    <section className="support-inbox admin-compact">
      <PageHeader compact title="Support inbox" />
      <AdminFeedback message={message} type="error" title="Support" onDismiss={() => setMessage('')} />
      <div className="support-inbox__desk admin-card">
        <SearchFilterBar search={query} onSearch={setQuery} placeholder="Search customer or message">
          <Select aria-label="Filter message status" value={status} onChange={(event) => setStatus(event.target.value)} className="px-3">
            <option value="">All statuses</option>
            {statuses.map((value) => <option key={value} value={value}>{statusLabels[value]}</option>)}
          </Select>
          <button type="button" className="admin-btn-ghost" aria-label="Refresh inbox" disabled={loading} onClick={load}>
            <RefreshCw size={16} aria-hidden="true" /> Refresh
          </button>
        </SearchFilterBar>
        <DataTable title="Messages" minWidth={600} loading={loading}
          emptyTitle={query.trim() || status ? 'No matching messages' : 'No messages yet'}
          emptyNote={query.trim() || status ? 'Try a different search or status.' : 'Customer enquiries will appear here.'}
          heads={['Customer', 'Message', 'Status']} rows={filtered.map((item) => (
            <tr key={item._id}>
              <td>
                <div className="support-inbox__customer">
                  <strong>{item.name}</strong>
                  <span>{item.email}</span>
                  {item.phone && <span>{item.phone}</span>}
                </div>
              </td>
              <td>
                <details className="support-inbox__message">
                  <summary aria-label={`Read message from ${item.name || item.email}`}>
                    <span className="support-inbox__subject">{item.subject || 'Website enquiry'} <ChevronDown size={15} aria-hidden="true" /></span>
                    <span className="support-inbox__preview" aria-hidden="true">{item.message}</span>
                  </summary>
                  <p className="support-inbox__body">{item.message}</p>
                </details>
              </td>
              <td>
                <Select aria-label={`Status for ${item.name || item._id}`} disabled={pending[item._id]} value={item.status} onChange={(event) => update(item, event.target.value)} className="support-inbox__status px-3">
                  {statuses.map((value) => <option key={value} value={value}>{statusLabels[value]}</option>)}
                </Select>
              </td>
            </tr>
          ))} />
      </div>
    </section>
  );
}
