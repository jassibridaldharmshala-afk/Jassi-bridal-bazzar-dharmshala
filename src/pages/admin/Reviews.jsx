import { useCallback, useEffect, useRef, useState } from 'react';
import { Archive, BarChart3, CheckCircle2, Download, Eye, Flag, Image as ImageIcon, MessageSquare, RotateCcw, Send, Sparkles, Star, X } from 'lucide-react';
import ConfirmModal from '../../components/admin/ConfirmModal';
import DataTable from '../../components/admin/DataTable';
import PageHeader from '../../components/admin/PageHeader';
import SearchFilterBar from '../../components/admin/SearchFilterBar';
import StatusBadge from '../../components/admin/StatusBadge';
import PageState from '../../components/ui/PageState';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { getPrimaryImageUrl, normalizeImageUrl } from '../../services/normalize';

const EMPTY_STATS = { total: 0, average: 0, published: 0, pending: 0, hidden: 0, rejected: 0, archived: 0, negative: 0, reported: 0, unanswered: 0, responseRate: 0, trend: [], topics: [], productHealth: [] };
const STATUS_TABS = [
  ['', 'All', 'total'], ['PENDING', 'Pending', 'pending'], ['PUBLISHED', 'Published', 'published'],
  ['REPORTED', 'Reported', 'reported'], ['HIDDEN', 'Hidden', 'hidden'], ['REJECTED', 'Rejected', 'rejected'], ['ARCHIVED', 'Archived', 'archived'],
];
const REPLY_TEMPLATES = [
  ['Thank customer', 'Thank you for taking the time to share your experience. We are glad you chose our store.'],
  ['Fit support', 'Thank you for your feedback. Our team can help you find the right size or fit. Please contact support from your order page.'],
  ['Resolve issue', 'We are sorry this did not meet your expectations. Please contact support from your order page so we can review and resolve this for you.'],
];
const moderationLabels = { PENDING: 'Pending', PUBLISHED: 'Published', HIDDEN: 'Hidden', REJECTED: 'Rejected', ARCHIVED: 'Archived' };

function statusOf(review) {
  if (review?.moderationStatus) return review.moderationStatus;
  return review?.isVisible ? 'PUBLISHED' : 'HIDDEN';
}

function formatDate(value, withTime = false) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '-';
  return new Intl.DateTimeFormat('en-IN', withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(date);
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""').replace(/[\r\n]+/g, ' ')}"`;
}

export default function Reviews({ route = '' }) {
  const isSeller = String(route).startsWith('/seller');
  const base = isSeller ? '/seller/reviews' : '/admin/reviews';
  const { user } = useAuth();
  const activeStoreId = typeof window === 'undefined' ? '' : sessionStorage.getItem('samira_seller_store_id');
  const activeRole = user?.stores?.find((store) => String(store.id) === String(activeStoreId))?.role || '';
  const canModerate = !isSeller || ['OWNER', 'MANAGER', 'SUPPORT'].includes(activeRole);
  const canReply = !isSeller || ['OWNER', 'MANAGER', 'SUPPORT', 'MARKETING'].includes(activeRole);
  const canDelete = !isSeller || ['OWNER', 'MANAGER'].includes(activeRole);
  const canExport = !isSeller || ['OWNER', 'MANAGER', 'MARKETING'].includes(activeRole);
  const isMaster = !isSeller && user?.systemRole === 'MASTER_OWNER';
  const [allStores, setAllStores] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [rating, setRating] = useState('');
  const [status, setStatus] = useState('');
  const [sentiment, setSentiment] = useState('');
  const [media, setMedia] = useState('');
  const [verified, setVerified] = useState('');
  const [productId, setProductId] = useState('');
  const [productOptions, setProductOptions] = useState([]);
  const [unanswered, setUnanswered] = useState(false);
  const [sort, setSort] = useState('newest');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState(null);
  const [busyId, setBusyId] = useState('');
  const [selected, setSelected] = useState([]);
  const [bulkAction, setBulkAction] = useState('PUBLISH');
  const [bulkReason, setBulkReason] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [reply, setReply] = useState('');
  const [moderationReason, setModerationReason] = useState('');
  const [moderationNote, setModerationNote] = useState('');
  const sequence = useRef(0);

  useEffect(() => {
    if (query === search) return undefined;
    const timer = setTimeout(() => { setSearch(query.trim()); setPage(1); }, 250);
    return () => clearTimeout(timer);
  }, [query, search]);

  const listQuery = useCallback((overrides = {}) => {
    const params = new URLSearchParams({ page: String(overrides.page || page), limit: String(overrides.limit || 20) });
    const values = { search, rating, sentiment, media, verified, productId, sort, from, to };
    Object.entries(values).forEach(([key, value]) => value && params.set(key, value));
    if (status === 'REPORTED') params.set('reported', 'true');
    else if (status) params.set('status', status);
    if (unanswered) params.set('unanswered', 'true');
    if (isMaster && allStores) params.set('scope', 'all');
    return params;
  }, [allStores, from, isMaster, media, page, productId, rating, search, sentiment, sort, status, to, unanswered, verified]);

  const managementPath = useCallback((path = '') => `${base}/management${path}${isMaster && allStores ? '?scope=all' : ''}`, [allStores, base, isMaster]);

  const loadStats = useCallback(async () => {
    const data = await api.get(managementPath('/stats'), { silent: true });
    if (data && !Array.isArray(data)) setStats({ ...EMPTY_STATS, ...data });
  }, [managementPath]);

  useEffect(() => {
    api.get(managementPath('/options'), { silent: true })
      .then((data) => setProductOptions(Array.isArray(data) ? data : []))
      .catch(() => setProductOptions([]));
  }, [managementPath]);

  const load = useCallback(async () => {
    const current = ++sequence.current;
    setLoading(true); setLoadError('');
    try {
      const data = await api.get(`${base}?${listQuery()}`);
      if (current !== sequence.current) return;
      const items = Array.isArray(data) ? data : data?.items;
      if (!Array.isArray(items)) throw new Error('Unable to read reviews. Please try again.');
      if (!Array.isArray(data) && page > Number(data.totalPages || 1)) { setPage(Math.max(1, Number(data.totalPages || 1))); return; }
      setReviews(items);
      setPagination(Array.isArray(data) ? { page: 1, totalPages: 1, total: items.length } : data);
      setSelected((currentSelection) => currentSelection.filter((id) => items.some((review) => review._id === id)));
    } catch (error) { if (current === sequence.current) setLoadError(error.message); }
    finally { if (current === sequence.current) setLoading(false); }
  }, [base, listQuery, page]);

  useEffect(() => { load(); return () => { sequence.current += 1; }; }, [load]);
  useEffect(() => { loadStats().catch(() => null); }, [loadStats]);

  const refresh = async (success) => {
    if (success) setMessage({ type: 'success', text: success });
    await Promise.allSettled([load(), loadStats()]);
  };

  const openDetail = async (review) => {
    setDetail(review); setDetailLoading(true); setReply(review.merchantReply?.body || '');
    setModerationReason(review.moderationReason || ''); setModerationNote('');
    try {
      const data = await api.get(managementPath(`/${review._id}`));
      setDetail(data); setReply(data.merchantReply?.body || ''); setModerationReason(data.moderationReason || ''); setModerationNote(data.moderationNote || '');
    } catch (error) { setMessage({ type: 'error', text: error.message }); }
    finally { setDetailLoading(false); }
  };

  const moderate = async (review, nextStatus, reason = '') => {
    if (!canModerate || busyId) return;
    setBusyId(review._id); setMessage(null);
    try {
      const updated = await api.patch(managementPath(`/${review._id}/moderation`), { status: nextStatus, reason: reason || (nextStatus === 'HIDDEN' ? 'Hidden by store team' : ''), note: moderationNote });
      setDetail((current) => current?._id === updated._id ? { ...current, ...updated } : current);
      await refresh(`Review ${nextStatus === 'PUBLISHED' ? 'published' : nextStatus.toLowerCase()} successfully.`);
    } catch (error) { setMessage({ type: 'error', text: error.message }); }
    finally { setBusyId(''); }
  };

  const archive = async () => {
    if (!archiveTarget?._id || busyId) return;
    setBusyId(archiveTarget._id);
    try {
      await api.patch(managementPath(`/${archiveTarget._id}/archive`), { reason: 'Archived by store team' });
      setArchiveTarget(null); setDetail(null); await refresh('Review archived. It can be restored later.');
    } finally { setBusyId(''); }
  };

  const restore = async (review) => {
    if (!canModerate || busyId) return;
    setBusyId(review._id);
    try { await api.patch(managementPath(`/${review._id}/restore`), {}); setDetail(null); await refresh('Review restored to the moderation queue.'); }
    catch (error) { setMessage({ type: 'error', text: error.message }); }
    finally { setBusyId(''); }
  };

  const permanentlyDelete = async () => {
    if (!deleteTarget?._id || busyId) return;
    setBusyId(deleteTarget._id);
    try { await api.delete(`${base}/management/${deleteTarget._id}?${isMaster && allStores ? 'scope=all&' : ''}confirm=PERMANENTLY_DELETE`); setDeleteTarget(null); setDetail(null); await refresh('Archived review permanently deleted.'); }
    finally { setBusyId(''); }
  };

  const saveReply = async () => {
    if (!detail?._id || !canReply || busyId) return;
    setBusyId(detail._id);
    try {
      const updated = await api.put(managementPath(`/${detail._id}/reply`), { body: reply.trim() });
      setDetail((current) => ({ ...current, ...updated })); await refresh('Store response published. The customer was notified.');
    } catch (error) { setMessage({ type: 'error', text: error.message }); }
    finally { setBusyId(''); }
  };

  const removeReply = async () => {
    if (!detail?._id || !canReply || busyId) return;
    setBusyId(detail._id);
    try { const updated = await api.delete(managementPath(`/${detail._id}/reply`)); setReply(''); setDetail((current) => ({ ...current, ...updated })); await refresh('Store response removed.'); }
    catch (error) { setMessage({ type: 'error', text: error.message }); }
    finally { setBusyId(''); }
  };

  const toggleFeatured = async (review) => {
    if (!canModerate || busyId) return;
    setBusyId(review._id);
    try { await api.patch(managementPath(`/${review._id}/featured`), { featured: !review.isFeatured }); await refresh(review.isFeatured ? 'Review removed from featured testimonials.' : 'Review added to featured testimonials.'); }
    catch (error) { setMessage({ type: 'error', text: error.message }); }
    finally { setBusyId(''); }
  };

  const runBulk = async () => {
    if (!selected.length || !canModerate || busyId) return;
    if (bulkAction === 'HIDE' && !bulkReason.trim()) { setMessage({ type: 'error', text: 'Add a reason before hiding selected reviews.' }); return; }
    setBusyId('bulk');
    try { const result = await api.post(managementPath('/bulk'), { ids: selected, action: bulkAction, reason: bulkReason.trim() }); setSelected([]); setBulkReason(''); await refresh(`${result.affected} reviews updated.`); }
    catch (error) { setMessage({ type: 'error', text: error.message }); }
    finally { setBusyId(''); }
  };

  const sendRequests = async () => {
    if (!canReply || busyId) return;
    setBusyId('reminders');
    try { const result = await api.post(managementPath('/reminders'), { daysAfterDelivery: 3 }); setMessage({ type: 'success', text: result.sent ? `${result.sent} eligible customers queued for an in-app review reminder.` : 'No eligible delivered orders need a review reminder.' }); }
    catch (error) { setMessage({ type: 'error', text: error.message }); }
    finally { setBusyId(''); }
  };

  const exportCsv = async () => {
    if (!canExport) return;
    setBusyId('export');
    try {
      const data = await api.get(`${base}/management/export?${listQuery({ page: 1, limit: 1000 })}`);
      const items = Array.isArray(data) ? data : data?.items || [];
      const rows = [['Review ID', 'Product', 'Customer', 'Rating', 'Status', 'Sentiment', 'Verified', 'Reports', 'Helpful', 'Response', 'Created']];
      items.forEach((review) => rows.push([review._id, review.product?.name, review.user?.name, review.rating, statusOf(review), review.sentiment, review.verifiedPurchase ? 'Yes' : 'No', review.reportCount || 0, review.helpfulCount || 0, review.merchantReply?.body || '', review.createdAt]));
      const blob = new Blob([rows.map((row) => row.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `reviews-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); URL.revokeObjectURL(url);
      setMessage({ type: 'success', text: `${items.length} matching reviews exported.` });
    } catch (error) { setMessage({ type: 'error', text: error.message }); }
    finally { setBusyId(''); }
  };

  const allSelected = reviews.length > 0 && reviews.every((review) => selected.includes(review._id));
  const visibleCount = reviews.length;
  const insightMax = Math.max(1, ...(stats.trend || []).map((item) => Number(item.count || 0)));

  return (
    <section className="review-center space-y-5">
      <PageHeader kicker={isSeller ? 'Seller' : 'Admin'} title="Review Trust Center" note="Protect review quality, respond to customers and learn what shoppers say about your products.">
        <button type="button" disabled={busyId === 'reminders' || !canReply} onClick={sendRequests} className="admin-btn-secondary inline-flex items-center gap-2 disabled:opacity-40"><Send size={15} />{busyId === 'reminders' ? 'Preparing...' : 'Request reviews'}</button>
        <button type="button" disabled={busyId === 'export' || !canExport} onClick={exportCsv} title={canExport ? 'Export matching reviews' : 'Your store role does not include review export'} className="admin-btn-secondary inline-flex items-center gap-2 disabled:opacity-40"><Download size={15} />Export CSV</button>
      </PageHeader>

      {message ? <p role="status" className={`rounded-xl p-3 text-sm font-bold ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose/10 text-rose'}`}>{message.text}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Average rating', `${Number(stats.average || 0).toFixed(1)} / 5`, Star, 'Across all recorded reviews'],
          ['Needs attention', stats.pending + stats.reported, Flag, `${stats.pending} pending · ${stats.reported} reported`],
          ['Customer recovery', stats.negative, MessageSquare, `${stats.unanswered} reviews await a response`],
          ['Response rate', `${stats.responseRate}%`, CheckCircle2, `${stats.published} reviews are published`],
        ].map(([label, value, Icon, note]) => <article key={label} className="admin-card flex items-center gap-4 p-5"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#fbf0f3] text-wine"><Icon size={21} /></span><div><p className="text-[10px] font-black uppercase tracking-[.12em] text-slate-400">{label}</p><p className="mt-1 text-2xl font-black text-charcoal">{value}</p><p className="mt-1 text-[11px] text-slate-500">{note}</p></div></article>)}
      </div>

      {(stats.trend?.length || stats.topics?.length || stats.productHealth?.length) ? <div className="grid gap-4 xl:grid-cols-[1.4fr_.8fr]">
        <article className="admin-card p-5"><div className="flex items-center gap-2"><BarChart3 size={18} className="text-wine" /><h2 className="text-base font-black">30-day rating pulse</h2></div><div className="mt-5 flex h-28 items-end gap-1 overflow-hidden">{stats.trend.map((item) => <div key={item.date} title={`${formatDate(item.date)} · ${item.count} reviews · ${item.average}/5`} className="group flex min-w-2 flex-1 flex-col justify-end"><span className="rounded-t bg-wine/70 transition group-hover:bg-wine" style={{ height: `${Math.max(8, (Number(item.count || 0) / insightMax) * 100)}%` }} /><span className="mt-1 hidden text-[8px] text-slate-400 2xl:block">{item.date.slice(8)}</span></div>)}</div></article>
        <article className="admin-card p-5"><div className="flex items-center gap-2"><Sparkles size={18} className="text-wine" /><h2 className="text-base font-black">Product insights</h2></div>{stats.topics?.length ? <div className="mt-4 flex flex-wrap gap-2">{stats.topics.map((item) => <button key={item.topic} type="button" onClick={() => { setQuery(item.topic); setPage(1); }} className="rounded-full bg-[#fbf0f3] px-3 py-2 text-xs font-bold capitalize text-wine">{item.topic} · {item.count}</button>)}</div> : null}{stats.productHealth?.length ? <div className="mt-4 space-y-2 border-t border-slate-100 pt-4"><p className="text-[10px] font-black uppercase tracking-[.12em] text-slate-400">Products needing attention</p>{stats.productHealth.slice(0, 4).map((item) => <button key={String(item.productId)} type="button" onClick={() => { setProductId(String(item.productId)); setPage(1); }} className="flex w-full items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-left"><span className="min-w-0"><strong className="block truncate text-xs">{item.name}</strong><small className="text-[10px] text-slate-400">{item.count} review{item.count === 1 ? '' : 's'} · {item.negative} negative</small></span><b className={`${Number(item.average) < 3 ? 'text-rose' : 'text-emerald-700'} text-xs`}>{Number(item.average || 0).toFixed(1)}★</b></button>)}</div> : null}</article>
      </div> : null}

      <div className="admin-card overflow-hidden">
        <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-3 pt-3">{STATUS_TABS.map(([value, label, key]) => <button key={`${value}-${label}`} type="button" onClick={() => { setStatus(value); setPage(1); }} className={`shrink-0 border-b-2 px-4 py-3 text-xs font-black ${status === value ? 'border-wine text-wine' : 'border-transparent text-slate-500'}`}>{label} <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px]">{stats[key] || 0}</span></button>)}</div>
        <div className="p-4">
          <SearchFilterBar search={query} onSearch={setQuery} placeholder="Search product, SKU, customer or review">
            <select aria-label="Rating filter" value={rating} onChange={(event) => { setRating(event.target.value); setPage(1); }} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold"><option value="">All ratings</option>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} star</option>)}</select>
            <select aria-label="Sentiment filter" value={sentiment} onChange={(event) => { setSentiment(event.target.value); setPage(1); }} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold"><option value="">All sentiment</option><option value="POSITIVE">Positive</option><option value="NEUTRAL">Neutral</option><option value="NEGATIVE">Negative</option></select>
          </SearchFilterBar>
          <div className="mt-3 flex flex-wrap gap-2">
            <select aria-label="Media filter" value={media} onChange={(event) => { setMedia(event.target.value); setPage(1); }} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold"><option value="">With or without media</option><option value="true">Has photos</option><option value="false">No photos</option></select>
            <select aria-label="Verified purchase filter" value={verified} onChange={(event) => { setVerified(event.target.value); setPage(1); }} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold"><option value="">All purchase types</option><option value="true">Verified purchases</option><option value="false">Unverified reviews</option></select>
            <select aria-label="Product filter" value={productId} onChange={(event) => { setProductId(event.target.value); setPage(1); }} className="h-10 max-w-64 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold"><option value="">All reviewed products</option>{productOptions.map((product) => <option key={String(product.id)} value={String(product.id)}>{product.name}{product.sku ? ` · ${product.sku}` : ''}{isMaster && allStores && product.store?.name ? ` · ${product.store.name}` : ''} ({product.reviewCount})</option>)}</select>
            <select aria-label="Sort reviews" value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="rating_high">Highest rating</option><option value="rating_low">Lowest rating</option><option value="helpful">Most helpful</option><option value="reported">Most reported</option></select>
            <label className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold"><input type="checkbox" checked={unanswered} onChange={(event) => { setUnanswered(event.target.checked); setPage(1); }} />Awaiting response</label>
            {isMaster ? <label className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold"><input type="checkbox" checked={allStores} onChange={(event) => { setAllStores(event.target.checked); setProductId(''); setPage(1); setSelected([]); }} />All stores</label> : null}
            <label className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-500">From<input aria-label="Reviews from date" type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} className="bg-transparent" /></label>
            <label className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-500">To<input aria-label="Reviews to date" type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} className="bg-transparent" /></label>
          </div>
        </div>
      </div>

      {selected.length ? <div className="admin-card sticky top-3 z-20 flex flex-wrap items-center gap-3 p-3 shadow-lg"><strong className="text-sm text-wine">{selected.length} selected</strong><select aria-label="Bulk review action" value={bulkAction} onChange={(event) => setBulkAction(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold"><option value="PUBLISH">Publish</option><option value="HIDE">Hide</option><option value="ARCHIVE">Archive</option><option value="RESTORE">Restore for review</option><option value="FEATURE">Feature</option><option value="UNFEATURE">Remove feature</option></select>{bulkAction === 'HIDE' ? <input aria-label="Bulk moderation reason" value={bulkReason} onChange={(event) => setBulkReason(event.target.value)} placeholder="Reason required" className="h-10 min-w-52 flex-1 rounded-xl border border-slate-200 px-3 text-xs" /> : null}<button type="button" onClick={runBulk} disabled={busyId === 'bulk' || !canModerate} className="admin-btn h-10 disabled:opacity-40">{busyId === 'bulk' ? 'Updating...' : 'Apply'}</button><button type="button" onClick={() => setSelected([])} className="admin-btn-ghost h-10">Clear</button></div> : null}

      {loadError ? <PageState error={loadError} onRetry={load} /> : <DataTable loading={loading} emptyTitle="No reviews found" title="Customer reviews" note={`${pagination.total || visibleCount} matching reviews`} minWidth={1180} heads={['Select', 'Product', 'Customer', 'Rating', 'Review', 'Trust signals', 'Response', 'Status', 'Actions']} rows={reviews.map((review) => {
        const reviewStatus = statusOf(review); const checked = selected.includes(review._id); const image = normalizeImageUrl(getPrimaryImageUrl(review.product?.images) || review.product?.primaryImage);
        return <tr key={review._id} className={checked ? 'is-selected' : ''}>
          <td className="px-4 py-4"><input aria-label={`Select review ${review._id}`} type="checkbox" checked={checked} onChange={(event) => setSelected((current) => event.target.checked ? [...new Set([...current, review._id])] : current.filter((id) => id !== review._id))} /></td>
          <td className="px-4 py-4"><div className="flex min-w-44 items-center gap-3">{image ? <img src={image} alt="" className="h-12 w-10 rounded-lg object-cover" /> : <span className="grid h-12 w-10 place-items-center rounded-lg bg-slate-100"><ImageIcon size={15} /></span>}<div><a href={`${isSeller ? '/seller/products' : '/admin/products'}?search=${encodeURIComponent(review.product?.sku || review.product?.name || '')}`} className="line-clamp-2 font-black hover:text-wine">{review.product?.name || 'Unavailable product'}</a><span className="mt-1 block text-[10px] text-slate-400">{review.product?.sku || 'No SKU'}{isMaster && allStores && review.storeId?.name ? ` · ${review.storeId.name}` : ''}</span></div></div></td>
          <td className="px-4 py-4"><span className="font-bold">{review.user?.name || 'Customer'}</span><span className="mt-1 block text-[10px] text-slate-400">{review.user?.phoneMasked || 'Contact protected'}</span></td>
          <td className="px-4 py-4"><span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-black text-white ${review.rating >= 4 ? 'bg-emerald-600' : review.rating === 3 ? 'bg-amber-500' : 'bg-rose'}`}>{review.rating}<Star size={11} className="fill-current" /></span><span className="mt-2 block text-[10px] capitalize text-slate-400">{String(review.sentiment || 'neutral').toLowerCase()}</span></td>
          <td className="max-w-sm px-4 py-4"><strong className="line-clamp-1 text-sm">{review.title || 'Rating only'}</strong><p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{review.comment || 'No written feedback.'}</p><div className="mt-2 flex flex-wrap gap-1">{(review.topics || []).slice(0, 3).map((topic) => <span key={topic} className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-bold capitalize text-slate-500">{topic}</span>)}</div></td>
          <td className="px-4 py-4"><div className="grid min-w-32 gap-1 text-[10px]"><span className={review.verifiedPurchase ? 'font-bold text-emerald-700' : 'text-slate-400'}>{review.verifiedPurchase ? 'Verified purchase' : 'Unverified'}</span><span>{review.helpfulCount || 0} helpful</span><span className={review.reportCount ? 'font-bold text-rose' : ''}>{review.reportCount || 0} reports</span><span>{review.photos?.length || 0} photos</span></div></td>
          <td className="px-4 py-4">{review.merchantReply?.body ? <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700"><CheckCircle2 size={14} />Replied</span> : <span className="text-xs font-semibold text-amber-700">Awaiting reply</span>}</td>
          <td className="px-4 py-4"><StatusBadge value={moderationLabels[reviewStatus] || reviewStatus} />{review.isFeatured ? <span className="mt-2 block text-[9px] font-black uppercase text-wine">Featured</span> : null}<span className="mt-2 block text-[9px] text-slate-400">{formatDate(review.createdAt)}</span></td>
          <td className="px-4 py-4"><div className="flex min-w-36 flex-wrap gap-2"><button type="button" onClick={() => openDetail(review)} className="admin-table-action-link inline-flex items-center gap-1"><Eye size={13} />View</button>{canModerate && reviewStatus !== 'ARCHIVED' ? <button type="button" disabled={Boolean(busyId)} onClick={() => moderate(review, review.isVisible ? 'HIDDEN' : 'PUBLISHED')} className="admin-table-action-link disabled:opacity-40">{review.isVisible ? 'Hide' : 'Publish'}</button> : null}{canModerate && reviewStatus === 'ARCHIVED' ? <button type="button" onClick={() => restore(review)} className="admin-table-action-link">Restore</button> : null}</div></td>
        </tr>;
      })} />}

      {!loading && !loadError && reviews.length ? <div className="admin-card flex flex-wrap items-center justify-between gap-3 p-4 text-sm"><label className="flex items-center gap-2 font-bold"><input type="checkbox" checked={allSelected} onChange={(event) => setSelected(event.target.checked ? reviews.map((review) => review._id) : [])} />Select this page</label><span>{pagination.total} matching reviews · Page {pagination.page} of {pagination.totalPages}</span><div className="flex gap-2"><button type="button" className="admin-btn-ghost" disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><button type="button" className="admin-btn-ghost" disabled={loading || page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)}>Next</button></div></div> : null}

      {detail ? <ReviewDetailDrawer review={detail} loading={detailLoading} canModerate={canModerate} canReply={canReply} canDelete={canDelete} busy={busyId === detail._id} reply={reply} setReply={setReply} moderationReason={moderationReason} setModerationReason={setModerationReason} moderationNote={moderationNote} setModerationNote={setModerationNote} onClose={() => setDetail(null)} onModerate={(nextStatus) => moderate(detail, nextStatus, moderationReason)} onArchive={() => setArchiveTarget(detail)} onRestore={() => restore(detail)} onFeature={() => toggleFeatured(detail)} onReply={saveReply} onDeleteReply={removeReply} onDelete={() => setDeleteTarget(detail)} isSeller={isSeller} /> : null}
      <ConfirmModal open={Boolean(archiveTarget)} title="Archive review?" message="The review will leave the storefront and remain available for restoration and audit history." confirmLabel="Archive" onClose={() => setArchiveTarget(null)} onConfirm={archive} />
      <ConfirmModal open={Boolean(deleteTarget)} title="Permanently delete archived review?" message="This removes the review, votes and reports permanently. This action is available only after archival." confirmLabel="Delete permanently" onClose={() => setDeleteTarget(null)} onConfirm={permanentlyDelete} />
    </section>
  );
}

function ReviewDetailDrawer({ review, loading, canModerate, canReply, canDelete, busy, reply, setReply, moderationReason, setModerationReason, moderationNote, setModerationNote, onClose, onModerate, onArchive, onRestore, onFeature, onReply, onDeleteReply, onDelete, isSeller }) {
  const status = statusOf(review);
  return <div className="fixed inset-0 z-[95] bg-black/45" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}><aside role="dialog" aria-modal="true" aria-label="Review details" className="ml-auto flex h-full w-full max-w-2xl flex-col bg-[#fffaf6] shadow-2xl"><header className="flex items-start justify-between gap-4 border-b bg-white p-5"><div><p className="text-[10px] font-black uppercase tracking-[.12em] text-wine">Review details</p><h2 className="mt-1 text-xl font-black">{review.product?.name || 'Product review'}</h2><p className="mt-1 text-xs text-slate-500">Submitted {formatDate(review.createdAt, true)}</p></div><button type="button" onClick={onClose} disabled={busy} aria-label="Close review details" className="grid h-10 w-10 place-items-center rounded-full bg-slate-50"><X size={18} /></button></header><div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">{loading ? <p role="status" className="admin-card p-5 text-sm">Loading complete review history...</p> : <>
    <article className="admin-card p-5"><div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1 rounded-lg bg-wine px-2 py-1 text-sm font-black text-white">{review.rating}<Star size={12} className="fill-current" /></span><StatusBadge value={moderationLabels[status] || status} />{review.verifiedPurchase ? <span className="text-xs font-bold text-emerald-700">Verified purchase</span> : null}{review.isFeatured ? <span className="text-xs font-black text-wine">Featured testimonial</span> : null}</div>{review.title ? <h3 className="mt-4 text-lg font-black">{review.title}</h3> : null}<p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{review.comment || 'No written feedback.'}</p>{review.photos?.length ? <div className="mt-4 grid grid-cols-4 gap-2">{review.photos.map((photo, index) => <a key={photo} href={normalizeImageUrl(photo)} target="_blank" rel="noreferrer" className="aspect-square overflow-hidden rounded-xl bg-slate-100"><img src={normalizeImageUrl(photo)} alt={`Review ${index + 1}`} className="h-full w-full object-cover" /></a>)}</div> : null}<div className="mt-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-2"><span>Customer: <strong>{review.user?.name || 'Customer'}</strong></span><span>Contact: {review.user?.phoneMasked || 'Protected'}</span><span>Purchased: {[review.purchase?.size, review.purchase?.color].filter(Boolean).join(' / ') || 'Variant not recorded'}</span><span>Helpful votes: {review.helpfulCount || 0}</span><span>Sentiment: {review.sentiment || 'NEUTRAL'}</span><span>Recommended: {typeof review.recommend === 'boolean' ? review.recommend ? 'Yes' : 'No' : 'Not answered'}</span></div><div className="mt-4 flex flex-wrap gap-3">{review.user?._id ? <a href={`${isSeller ? '/seller/crm' : '/admin/customers'}?customer=${review.user._id}${review.storeId?.slug ? `&store=${encodeURIComponent(review.storeId.slug)}` : ''}`} className="admin-table-action-link">Open customer profile</a> : null}{review.order ? <a href={`${isSeller ? '/seller/orders/detail' : '/admin/orders/detail'}?id=${review.order._id}`} className="admin-table-action-link">Open order {review.order.invoiceNumber || String(review.order._id).slice(-8).toUpperCase()}</a> : null}</div></article>
    {(review.riskSignals?.length || review.reportCount) ? <article className="admin-card border-amber-200 bg-amber-50 p-5"><div className="flex items-center gap-2 font-black text-amber-900"><Flag size={17} />Trust signals</div><p className="mt-2 text-xs leading-5 text-amber-800">{review.reportCount || 0} customer reports. {(review.riskSignals || []).map((item) => item.replaceAll('_', ' ').toLowerCase()).join(', ') || 'No automatic safety signal.'}</p>{review.reports?.length ? <div className="mt-3 space-y-2">{review.reports.map((report) => <div key={report._id} className="rounded-lg bg-white/70 p-2 text-[11px]"><p><strong>{report.reason}</strong> · {report.status} · {formatDate(report.createdAt)}</p>{report.details ? <p className="mt-1 text-amber-800">{report.details}</p> : null}</div>)}</div> : null}</article> : null}
    <article className="admin-card p-5"><h3 className="font-black">Store response</h3><p className="mt-1 text-xs text-slate-500">The response is public and the customer receives an in-app notification.</p>{canReply ? <div className="mt-3 flex flex-wrap gap-2">{REPLY_TEMPLATES.map(([label, body]) => <button key={label} type="button" onClick={() => setReply(body)} disabled={busy} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-bold text-slate-600 hover:border-wine hover:text-wine">{label}</button>)}</div> : null}<textarea aria-label="Store response" value={reply} maxLength={1000} onChange={(event) => setReply(event.target.value)} disabled={!canReply || busy} className="mt-3 min-h-28 w-full resize-none rounded-xl border border-slate-200 p-3 text-sm" placeholder="Thank the customer or explain how your team can help." /><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={onReply} disabled={!canReply || busy || !reply.trim()} className="admin-btn disabled:opacity-40">{review.merchantReply?.body ? 'Update response' : 'Publish response'}</button>{review.merchantReply?.body ? <button type="button" onClick={onDeleteReply} disabled={!canReply || busy} className="admin-btn-ghost disabled:opacity-40">Remove response</button> : null}</div>{review.merchantReplyHistory?.length ? <details className="mt-4 rounded-xl bg-slate-50 p-3"><summary className="cursor-pointer text-xs font-black text-slate-600">Response history ({review.merchantReplyHistory.length})</summary><div className="mt-3 space-y-2">{[...review.merchantReplyHistory].reverse().map((item, index) => <div key={`${item.at}-${index}`} className="rounded-lg bg-white p-3 text-xs"><p className="font-black text-slate-500">{String(item.action || '').toLowerCase()} · {formatDate(item.at, true)}</p><p className="mt-1 whitespace-pre-line text-slate-600">{item.body}</p></div>)}</div></details> : null}</article>
    {canModerate ? <article className="admin-card p-5"><h3 className="font-black">Moderation decision</h3><div className="mt-3 grid gap-3"><input aria-label="Moderation reason" value={moderationReason} onChange={(event) => setModerationReason(event.target.value)} maxLength={300} placeholder="Public reason required for hide or reject" className="h-11 rounded-xl border border-slate-200 px-3 text-sm" /><textarea aria-label="Internal moderation note" value={moderationNote} onChange={(event) => setModerationNote(event.target.value)} maxLength={1000} placeholder="Internal note — never shown to the customer" className="min-h-20 resize-none rounded-xl border border-slate-200 p-3 text-sm" /></div><div className="mt-3 flex flex-wrap gap-2">{status !== 'PUBLISHED' ? <button type="button" disabled={busy} onClick={() => onModerate('PUBLISHED')} className="admin-btn">Publish</button> : null}{status !== 'HIDDEN' ? <button type="button" disabled={busy || !moderationReason.trim()} onClick={() => onModerate('HIDDEN')} className="admin-btn-secondary disabled:opacity-40">Hide</button> : null}{status !== 'REJECTED' ? <button type="button" disabled={busy || !moderationReason.trim()} onClick={() => onModerate('REJECTED')} className="admin-btn-secondary disabled:opacity-40">Reject</button> : null}{status === 'ARCHIVED' ? <button type="button" disabled={busy} onClick={onRestore} className="admin-btn-secondary"><RotateCcw size={14} /> Restore</button> : <button type="button" disabled={busy} onClick={onArchive} className="admin-btn-secondary"><Archive size={14} /> Archive</button>}<button type="button" disabled={busy || status !== 'PUBLISHED'} onClick={onFeature} className="admin-btn-secondary disabled:opacity-40">{review.isFeatured ? 'Remove feature' : 'Feature on storefront'}</button></div></article> : null}
    {status === 'ARCHIVED' && canDelete ? <article className="rounded-2xl border border-red-200 bg-red-50 p-5"><h3 className="font-black text-red-800">Permanent deletion</h3><p className="mt-1 text-xs leading-5 text-red-700">Use only for legal or privacy removal. Archive is safer for normal moderation.</p><button type="button" onClick={onDelete} disabled={busy} className="mt-3 rounded-xl border border-red-300 px-4 py-2 text-xs font-black text-red-700">Delete permanently</button></article> : null}
  </>}</div></aside></div>;
}
