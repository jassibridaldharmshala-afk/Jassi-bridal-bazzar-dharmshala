import { useEffect, useRef, useState } from 'react';
import api from '../../services/api';
import PageState from '../../components/ui/PageState';

export default function SellerInbox() {
  const [items, setItems] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [sending, setSending] = useState(false);
  const version = useRef(0), sendingVersion = useRef(null);

  const load = () => {
    api.get('/seller/inbox')
      .then((data) => { setItems(Array.isArray(data) ? data : data.items || []); setError(''); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);
  useEffect(() => () => { version.current += 1; }, []);

  const open = async (conversation) => {
    const current = ++version.current;
    setActive(conversation); setMessages([]); setReply(''); setError(''); setOpening(true); setSending(false);
    try {
      const data = await api.get(`/seller/inbox/${conversation._id}`);
      if (current !== version.current) return;
      setActive(data.conversation);
      setMessages(data.messages || []);
    } catch (err) {
      if (current === version.current) setError(err.message);
    } finally { if (current === version.current) setOpening(false); }
  };

  const send = async (event) => {
    event.preventDefault();
    const current = version.current;
    if (!active || opening || !reply.trim() || sendingVersion.current === current) return;
    sendingVersion.current = current; setSending(true); setError('');
    try {
      const data = await api.post(`/seller/inbox/${active._id}/reply`, { body: reply.trim() });
      if (current !== version.current) return;
      setMessages((current) => [...current, data.message]);
      setReply('');
      load();
    } catch (err) {
      if (current === version.current) setError(err.message);
    } finally {
      if (sendingVersion.current === current) sendingVersion.current = null;
      if (current === version.current) setSending(false);
    }
  };

  if (loading) return <PageState loading loadingLabel="Loading inbox..." />;

  return (
    <section className="grid gap-5 lg:grid-cols-[280px_1fr]">
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <h1 className="text-xl font-black">Inbox</h1>
        <p className="mt-1 text-xs font-semibold text-slate-500">Website, order and return enquiries.</p>
        {error && <div role="alert" className="mt-3 text-sm font-bold text-rose">{error}<button type="button" className="ml-3 underline" onClick={() => active ? open(active) : load()}>Try again</button></div>}
        <div className="mt-4 grid gap-2">
          {items.map((item) => (
            <button key={item._id} type="button" onClick={() => open(item)} className={`rounded-xl px-3 py-3 text-left text-sm font-bold ${active?._id === item._id ? 'bg-wine text-white' : 'bg-[#fbf8f4]'}`}>
              {item.subject || item.customerName || 'Conversation'}
              <span className="mt-1 block text-xs opacity-70">{item.status} · {item.channel}</span>
            </button>
          ))}
          {!items.length && <p className="text-sm text-slate-500">No conversations yet.</p>}
        </div>
      </div>
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        {opening ? <PageState loading loadingLabel="Opening conversation..." /> : !active ? <p className="text-sm font-semibold text-slate-500">Select a conversation.</p> : (
          <>
            <h2 className="font-black">{active.subject}</h2>
            <div className="mt-4 grid max-h-[50vh] gap-3 overflow-y-auto">
              {messages.map((message) => (
                <div key={message._id} className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${message.authorRole === 'seller' ? 'ml-auto bg-wine text-white' : 'bg-[#fbf8f4]'}`}>
                  {message.authorRole === 'seller' && <p className="mb-1 text-xs font-semibold opacity-75">Internal note</p>}
                  {message.body}
                </div>
              ))}
            </div>
            <p id="seller-note-help" className="mt-4 text-xs leading-5 text-slate-500">Saved in this workspace only. Contact the customer separately to share an update.</p>
            <form onSubmit={send} className="mt-2 flex gap-3">
              <input aria-label="Write an internal note" aria-describedby="seller-note-help" maxLength={4000} disabled={sending} className="h-11 min-w-0 flex-1 rounded-xl border px-3 font-semibold" value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Write an internal note" />
              <button disabled={sending || !reply.trim()} className="h-11 rounded-xl bg-wine px-5 text-sm font-black text-white disabled:opacity-50" type="submit">{sending ? 'Saving…' : 'Save note'}</button>
            </form>
          </>
        )}
      </div>
    </section>
  );
}
