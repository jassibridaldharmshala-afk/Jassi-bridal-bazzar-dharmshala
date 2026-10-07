import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Archive, BadgePercent, CheckCircle2, Clock3, Copy, Download, Eye, FlaskConical, PencilLine, Plus, RotateCcw, Share2, ToggleLeft, Users, X } from 'lucide-react';
import CouponForm from '../../components/admin/CouponForm';
import ConfirmModal from '../../components/admin/ConfirmModal';
import DataTable from '../../components/admin/DataTable';
import PageHeader from '../../components/admin/PageHeader';
import SearchFilterBar from '../../components/admin/SearchFilterBar';
import StatusBadge from '../../components/admin/StatusBadge';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function Coupons() {
  const { user } = useAuth();
  const base = user?.activeMode === 'seller' ? '/seller' : '/admin';
  const [coupons, setCoupons] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [archive, setArchive] = useState('active');
  const [benefitType, setBenefitType] = useState('');
  const [sort, setSort] = useState('priority');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [serverStats, setServerStats] = useState(null);
  const [selected, setSelected] = useState([]);
  const [details, setDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [optionsLoaded, setOptionsLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [actionId, setActionId] = useState('');
  const [message, setMessage] = useState(null);
  const [loadError, setLoadError] = useState('');
  const loadSequence = useRef(0);
  const deferredQuery = useDeferredValue(query);

  const searchCouponOptions = useCallback(async (type, search = '', selectedIds = []) => {
    const params = new URLSearchParams({ type, limit: '50' });
    if (String(search).trim()) params.set('search', String(search).trim());
    if (selectedIds.length) params.set('selected', selectedIds.join(','));
    const data = await api.get(`${base}/coupons/options?${params}`, { silent: true });
    return (data?.items || []).map((item) => [String(item.id), item.label, item.subtitle || '']);
  }, [base]);

  const loadOptions = useCallback(async () => {
    if (optionsLoaded) return;
    const [productOptions, categoryOptions, customerOptions] = await Promise.all([
      searchCouponOptions('PRODUCT'),
      searchCouponOptions('CATEGORY'),
      searchCouponOptions('CUSTOMER'),
    ]);
    setProducts(optionPairsToRecords(productOptions));
    setCategories(optionPairsToRecords(categoryOptions));
    setCustomers(optionPairsToRecords(customerOptions));
    setOptionsLoaded(true);
  }, [optionsLoaded, searchCouponOptions]);

  const load = useCallback(async ({ quiet = false } = {}) => {
    const sequence = ++loadSequence.current;
    setLoadError('');
    if (!quiet) setLoading(true);
    try {
      const params = new URLSearchParams({ admin: 'true', archive, page: String(page), limit: '24', sort });
      if (deferredQuery.trim()) params.set('search', deferredQuery.trim());
      if (status) params.set('status', status);
      if (benefitType) params.set('benefitType', benefitType);
      const [couponData, statsData] = await Promise.all([
        api.get(`${base}/coupons?${params}`),
        api.get(`${base}/coupons/stats`, { silent: true }).catch(() => null),
      ]);
      if (sequence !== loadSequence.current) return;
      setCoupons(asList(couponData));
      setPagination(readPagination(couponData));
      if (statsData && !Array.isArray(statsData)) setServerStats(statsData);
      setSelected([]);
    } catch (error) {
      if (sequence === loadSequence.current) setLoadError(error.message || 'Unable to load coupons.');
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, [archive, base, benefitType, deferredQuery, page, sort, status]);

  useEffect(() => { load(); return () => { loadSequence.current += 1; }; }, [load]);

  const filtered = coupons;

  const localStats = useMemo(() => ({
    total: coupons.length,
    live: coupons.filter((coupon) => couponStatus(coupon).key === 'live').length,
    scheduled: coupons.filter((coupon) => couponStatus(coupon).key === 'scheduled').length,
    redemptions: coupons.reduce((sum, coupon) => sum + Number(coupon.usedCount || 0), 0),
  }), [coupons]);
  const stats = serverStats || localStats;

  const openCreate = async () => {
    await loadOptions().catch((error) => setMessage({ type: 'error', text: error.message || 'Unable to load coupon options.' }));
    setEditingCoupon(null);
    setShowEditor(true);
    setMessage(null);
    window.setTimeout(() => document.getElementById('coupon-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };

  const openEdit = async (coupon) => {
    await loadOptions().catch((error) => setMessage({ type: 'error', text: error.message || 'Unable to load coupon options.' }));
    setEditingCoupon(coupon);
    setShowEditor(true);
    setMessage(null);
    window.setTimeout(() => document.getElementById('coupon-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };

  const handleSaved = async (saved, mode) => {
    setCoupons((current) => mode === 'updated'
      ? current.map((item) => item._id === saved._id ? saved : item)
      : [saved, ...current]);
    setEditingCoupon(null);
    setShowEditor(false);
    setMessage({ type: 'success', text: `Coupon ${saved.code} ${mode} successfully.` });
    await load({ quiet: true });
  };

  const toggleStatus = async (coupon) => {
    if (actionId) return;
    setActionId(coupon._id);
    setMessage(null);
    try {
      const updated = await api.patch(`${base}/coupons/${coupon._id}/status`, { isActive: !coupon.isActive });
      setCoupons((current) => current.map((item) => item._id === coupon._id ? updated : item));
      if (editingCoupon?._id === coupon._id) setEditingCoupon(updated);
      setMessage({ type: 'success', text: `${coupon.code} ${updated.isActive ? 'activated' : 'paused'} successfully.` });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Unable to change coupon status.' });
    } finally {
      setActionId('');
    }
  };

  const quickAction = async (coupon, action) => {
    if (actionId) return;
    setActionId(coupon._id); setMessage(null);
    try {
      const result = action === 'duplicate' ? await api.post(`${base}/coupons/${coupon._id}/duplicate`, {}) : await api.patch(`${base}/coupons/${coupon._id}/restore`, {});
      await load({ quiet: true });
      setMessage({ type: 'success', text: action === 'duplicate' ? `${result.code} created as a paused copy.` : `${result.code} restored as a paused coupon.` });
    } catch (error) { setMessage({ type: 'error', text: error.message }); }
    finally { setActionId(''); }
  };

  const remove = async () => {
    if (!deleteTarget?._id || actionId) return;
    const target = deleteTarget;
    setActionId(target._id);
    setMessage(null);
    try {
      const result = await api.patch(`${base}/coupons/${target._id}/archive`, {});
      setCoupons((current) => current.filter((item) => item._id !== target._id));
      if (editingCoupon?._id === target._id) {
        setEditingCoupon(null);
        setShowEditor(false);
      }
      setDeleteTarget(null);
      setMessage({ type: 'success', text: result?.message || 'Coupon deleted successfully.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Unable to delete coupon.' });
    } finally {
      setActionId('');
    }
  };

  const openDetails = async (coupon) => {
    setDetails({ coupon, days: 30, summary: null, daily: [], recentOrders: [] });
    setDetailsLoading(true);
    setMessage(null);
    loadOptions().catch(() => null);
    try {
      const data = await api.get(`${base}/coupons/${coupon._id}/insights?days=30`);
      setDetails(data);
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Unable to load coupon performance.' });
      setDetails(null);
    } finally { setDetailsLoading(false); }
  };

  const reloadDetails = async (days) => {
    if (!details?.coupon?._id) return;
    setDetailsLoading(true);
    try { setDetails(await api.get(`${base}/coupons/${details.coupon._id}/insights?days=${days}`)); }
    catch (error) { setMessage({ type: 'error', text: error.message || 'Unable to refresh coupon performance.' }); }
    finally { setDetailsLoading(false); }
  };

  const runBulk = async (action) => {
    if (!selected.length || actionId) return;
    setActionId('bulk'); setMessage(null);
    try {
      const result = await api.post(`${base}/coupons/bulk`, { ids: selected, action });
      await load({ quiet: true });
      setMessage({ type: 'success', text: `${result.count || selected.length} coupon(s) updated.` });
    } catch (error) { setMessage({ type: 'error', text: error.message || 'Unable to update selected coupons.' }); }
    finally { setActionId(''); }
  };

  const exportCoupon = async (coupon) => {
    setActionId(coupon._id);
    try {
      const data = await api.get(`${base}/coupons/${coupon._id}/export`);
      downloadCsv(`${coupon.code}-redemptions.csv`, data?.rows || []);
      setMessage({ type: 'success', text: `${coupon.code} redemption report downloaded.` });
    } catch (error) { setMessage({ type: 'error', text: error.message || 'Unable to export coupon report.' }); }
    finally { setActionId(''); }
  };

  const selectableCoupons = filtered.filter((coupon) => !coupon.campaignId);
  const allVisibleSelected = selectableCoupons.length > 0 && selectableCoupons.every((coupon) => selected.includes(coupon._id));
  const toggleSelected = (id) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  return (
    <section className="space-y-5">
      <PageHeader title="Coupons" note="Create targeted offers and manage their schedule, limits and visibility.">
        <button type="button" onClick={openCreate} className="admin-btn"><Plus className="h-4 w-4" /> Create Coupon</button>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={BadgePercent} label="Total coupons" value={stats.total} tone="wine" />
        <Metric icon={CheckCircle2} label="Live now" value={stats.live} tone="green" />
        <Metric icon={Clock3} label="Scheduled" value={stats.scheduled} tone="amber" />
        <Metric icon={Users} label="Redemptions" value={stats.redemptions} tone="blue" />
      </div>
      {Number(stats.expiring || 0) + Number(stats.exhausted || 0) > 0 ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-900">{stats.expiring ? `${stats.expiring} coupon(s) expire within 7 days. ` : ''}{stats.exhausted ? `${stats.exhausted} coupon(s) have exhausted their usage or budget.` : ''}</div> : null}

      {showEditor ? <div id="coupon-editor"><CouponForm coupon={editingCoupon} products={products} categories={categories} customers={customers} loadProductOptions={(search, ids) => searchCouponOptions('PRODUCT', search, ids)} loadCategoryOptions={(search, ids) => searchCouponOptions('CATEGORY', search, ids)} loadCustomerOptions={(search, ids) => searchCouponOptions('CUSTOMER', search, ids)} apiBase={base} timezone={stats.timezone || 'Asia/Kolkata'} onSaved={handleSaved} onCancel={() => { setEditingCoupon(null); setShowEditor(false); }} /></div> : null}

      {message ? <p role="status" className={`rounded-xl p-3 text-sm font-bold ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose/10 text-rose'}`}>{message.text}</p> : null}

      <div className="flex gap-2 overflow-x-auto">{[['active', 'Current'], ['archived', 'Archived'], ['all', 'All']].map(([value, label]) => <button key={value} onClick={() => { setArchive(value); setPage(1); }} className={`min-w-max rounded-full px-4 py-2 text-xs font-black ${archive === value ? 'bg-wine text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>{label}</button>)}</div>

      <SearchFilterBar search={query} onSearch={setQuery} placeholder="Search coupon code, title or description">
        <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold">
          <option value="">All Status</option>
          <option value="live">Live</option>
          <option value="scheduled">Scheduled</option>
          <option value="expiring">Expiring soon</option>
          <option value="expired">Expired</option>
          <option value="paused">Paused</option>
          <option value="exhausted">Exhausted</option>
        </select>
        <select value={benefitType} onChange={(event) => { setBenefitType(event.target.value); setPage(1); }} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold"><option value="">All benefits</option><option value="DISCOUNT">Price discount</option><option value="FREE_SHIPPING">Free delivery</option><option value="BUY_X_GET_Y">Buy X get Y</option></select>
        <select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold"><option value="priority">Priority</option><option value="newest">Newest</option><option value="ending">Ending soon</option><option value="usage">Most used</option><option value="budget">Highest spend</option></select>
      </SearchFilterBar>

      {filtered.length ? <div className="admin-card flex flex-wrap items-center justify-between gap-3 p-3"><label className="flex items-center gap-2 text-xs font-bold text-slate-600"><input type="checkbox" disabled={!selectableCoupons.length} checked={allVisibleSelected} onChange={() => setSelected(allVisibleSelected ? selected.filter((id) => !selectableCoupons.some((coupon) => coupon._id === id)) : Array.from(new Set([...selected, ...selectableCoupons.map((coupon) => coupon._id)])))} className="h-4 w-4 accent-wine disabled:opacity-40" />Select editable coupons on this page</label>{selected.length ? <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-black text-wine">{selected.length} selected</span>{archive !== 'archived' ? <><button onClick={() => runBulk('ACTIVATE')} disabled={!!actionId} className="admin-table-action-link">Activate</button><button onClick={() => runBulk('PAUSE')} disabled={!!actionId} className="admin-table-action-link">Pause</button><button onClick={() => runBulk('ARCHIVE')} disabled={!!actionId} className="admin-table-action-link is-danger">Archive</button></> : <button onClick={() => runBulk('RESTORE')} disabled={!!actionId} className="admin-table-action-link">Restore</button>}</div> : null}</div> : null}

      <div className="hidden lg:block"><DataTable
        error={loadError} onRetry={load}
        loading={loading}
        emptyTitle="No coupons found"
        emptyNote="Create a coupon or clear the current filters."
        minWidth={1050}
        heads={['Offer', 'Discount', 'Conditions', 'Usage', 'Schedule', 'Visibility', 'Status', 'Actions']}
        rows={filtered.map((coupon) => {
          const state = couponStatus(coupon);
          return (
            <tr key={coupon._id} className="border-t border-slate-100 align-top">
              <td className="px-4 py-4"><div className="flex items-start gap-2"><input aria-label={`Select ${coupon.code}`} title={coupon.campaignId ? 'Managed from Campaigns' : undefined} disabled={Boolean(coupon.campaignId)} type="checkbox" checked={selected.includes(coupon._id)} onChange={() => toggleSelected(coupon._id)} className="mt-1 h-4 w-4 accent-wine disabled:opacity-40" /><div><span className="inline-flex rounded-md border border-dashed border-wine px-2 py-1 text-xs font-black text-wine">{coupon.code}</span>{coupon.campaignId ? <span className="ml-2 inline-flex rounded-full bg-violet-50 px-2 py-1 text-[9px] font-black uppercase text-violet-700">Campaign managed</span> : null}{coupon.title ? <span className="mt-2 block max-w-[190px] font-bold text-charcoal">{coupon.title}</span> : null}{coupon.description ? <span className="mt-1 block max-w-[220px] text-xs leading-4 text-slate-500">{shorten(coupon.description, 75)}</span> : null}</div></div></td>
              <td className="px-4 py-4"><strong className="text-charcoal">{benefitLabel(coupon)}</strong><span className="mt-1 block text-xs text-slate-500">{coupon.activationMode === 'AUTOMATIC' ? 'Automatic' : 'Code required'}</span>{coupon.maxDiscountAmount ? <span className="mt-1 block text-xs text-slate-500">Up to Rs. {formatNumber(coupon.maxDiscountAmount)}</span> : null}</td>
              <td className="px-4 py-4 text-xs leading-5 text-slate-600"><span className="block">Min. Rs. {formatNumber(coupon.minOrderAmount || 0)}</span>{coupon.firstOrderOnly ? <span className="block font-bold text-wine">First order only</span> : null}<span className="block">{restrictionLabel(coupon)}</span></td>
              <td className="px-4 py-4"><strong>{formatNumber(coupon.usedCount || 0)}</strong><span className="block text-xs text-slate-500">of {coupon.usageLimit ? formatNumber(coupon.usageLimit) : 'unlimited'}</span>{coupon.customerLimit ? <span className="mt-1 block text-xs text-slate-500">{coupon.customerLimit}/customer</span> : null}</td>
              <td className="whitespace-nowrap px-4 py-4 text-xs"><span className="block text-slate-500">Starts {coupon.validFrom ? formatDate(coupon.validFrom) : 'immediately'}</span><span className="mt-1 block font-bold text-charcoal">Ends {coupon.expiryDate ? formatDate(coupon.expiryDate) : 'Never'}</span></td>
              <td className="px-4 py-4"><StatusBadge value={coupon.isPublic === false ? 'Private' : 'Public'} /></td>
              <td className="px-4 py-4"><button type="button" onClick={() => toggleStatus(coupon)} disabled={!!actionId || state.key === 'expired' || Boolean(coupon.campaignId)} title={coupon.campaignId ? 'Pause or publish this offer from Campaigns' : state.key === 'expired' ? 'Edit the expiry date to reactivate this coupon' : `Click to ${coupon.isActive ? 'pause' : 'activate'}`}><StatusBadge value={state.label} /></button></td>
              <td className="px-4 py-4"><CouponActions coupon={coupon} state={state} base={base} disabled={!!actionId} onView={() => openDetails(coupon)} onExport={() => exportCoupon(coupon)} onEdit={() => openEdit(coupon)} onToggle={() => toggleStatus(coupon)} onDuplicate={() => quickAction(coupon, 'duplicate')} onArchive={() => setDeleteTarget(coupon)} onRestore={() => quickAction(coupon, 'restore')} /></td>
            </tr>
          );
        })}
      /></div>
      <div className="grid gap-3 lg:hidden">{filtered.map((coupon) => { const state = couponStatus(coupon); return <article key={coupon._id} className="admin-card p-4"><div className="flex items-start justify-between gap-3"><div className="flex items-start gap-2"><input aria-label={`Select ${coupon.code}`} title={coupon.campaignId ? 'Managed from Campaigns' : undefined} disabled={Boolean(coupon.campaignId)} type="checkbox" checked={selected.includes(coupon._id)} onChange={() => toggleSelected(coupon._id)} className="mt-1 h-4 w-4 accent-wine disabled:opacity-40" /><div><span className="rounded-md border border-dashed border-wine px-2 py-1 text-xs font-black text-wine">{coupon.code}</span>{coupon.campaignId ? <span className="ml-2 rounded-full bg-violet-50 px-2 py-1 text-[9px] font-black uppercase text-violet-700">Campaign managed</span> : null}<h3 className="mt-3 font-black text-charcoal">{coupon.title || benefitLabel(coupon)}</h3><p className="mt-1 text-xs text-slate-500">{benefitLabel(coupon)} · {coupon.activationMode === 'AUTOMATIC' ? 'Automatic' : 'Code'}</p></div></div><StatusBadge value={state.label} /></div><Progress label="Usage" value={coupon.usedCount} limit={coupon.usageLimit} /><Progress label="Budget" value={coupon.spentAmount} limit={coupon.totalBudget} money /><div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-xs"><span>Ends <strong className="block">{coupon.expiryDate ? formatDate(coupon.expiryDate) : 'Never'}</strong></span><span>Audience <strong className="block">{coupon.customerSegment || 'ALL'}</strong></span><span>Scope <strong className="block">{restrictionLabel(coupon)}</strong></span><span>Stacking <strong className="block">{coupon.stackingMode === 'EXCLUSIVE' ? 'Full-price only' : 'Allowed'}</strong></span></div><div className="mt-4"><CouponActions mobile coupon={coupon} state={state} base={base} disabled={!!actionId} onView={() => openDetails(coupon)} onExport={() => exportCoupon(coupon)} onEdit={() => openEdit(coupon)} onToggle={() => toggleStatus(coupon)} onDuplicate={() => quickAction(coupon, 'duplicate')} onArchive={() => setDeleteTarget(coupon)} onRestore={() => quickAction(coupon, 'restore')} /></div></article>; })}</div>

      {pagination.totalPages > 1 ? <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3"><span className="text-xs font-bold text-slate-500">Page {pagination.page} of {pagination.totalPages} · {pagination.total} coupons</span><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="admin-btn-ghost disabled:opacity-40">Previous</button><button type="button" disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)} className="admin-btn-ghost disabled:opacity-40">Next</button></div></div> : null}

      {details ? <CouponInsights details={details} loading={detailsLoading} products={products} customers={customers} base={base} onRange={reloadDetails} onClose={() => setDetails(null)} onExport={() => exportCoupon(details.coupon)} /> : null}

      <ConfirmModal open={!!deleteTarget} title="Archive coupon?" message={`${deleteTarget?.code || 'This coupon'} will be hidden, while its settings and redemption history remain available for restore.`} confirmLabel="Archive" onClose={() => !actionId && setDeleteTarget(null)} onConfirm={remove} />
    </section>
  );
}

function Metric({ icon: Icon, label, value, tone }) {
  const tones = { wine: 'bg-blush text-wine', green: 'bg-emerald-50 text-emerald-700', amber: 'bg-amber-50 text-amber-700', blue: 'bg-sky-50 text-sky-700' };
  return <div className="admin-card flex items-center gap-3 p-4"><span className={`grid h-11 w-11 place-items-center rounded-xl ${tones[tone]}`}><Icon className="h-5 w-5" /></span><span><small className="block text-xs font-bold text-slate-500">{label}</small><strong className="mt-1 block text-xl font-black text-charcoal">{formatNumber(value)}</strong></span></div>;
}

function CouponActions({ coupon, state, base, disabled, onView, onExport, onEdit, onToggle, onDuplicate, onArchive, onRestore, mobile = false }) {
  const label = (value) => mobile ? `${value} ${coupon.code} on mobile` : value;
  if (coupon.campaignId) return <div className="flex flex-wrap gap-2"><button aria-label={label('View')} type="button" onClick={onView} disabled={disabled} className="admin-table-action-link"><Eye className="h-3.5 w-3.5" />View</button><a href={`${base}/campaigns`} className="admin-table-action-link"><BadgePercent className="h-3.5 w-3.5" />Open campaign</a><button aria-label={label('Duplicate')} type="button" onClick={onDuplicate} disabled={disabled} className="admin-table-action-link"><Copy className="h-3.5 w-3.5" />Independent copy</button></div>;
  if (coupon.isArchived) return <div className="flex flex-wrap gap-2"><button aria-label={label('View')} type="button" onClick={onView} disabled={disabled} className="admin-table-action-link"><Eye className="h-3.5 w-3.5" />View</button><button aria-label={label('Export')} type="button" onClick={onExport} disabled={disabled} className="admin-table-action-link"><Download className="h-3.5 w-3.5" />Export</button><button aria-label={label('Restore')} type="button" onClick={onRestore} disabled={disabled} className="admin-table-action-link"><RotateCcw className="h-3.5 w-3.5" />Restore</button></div>;
  return <div className="flex flex-wrap gap-2"><button aria-label={label('View')} type="button" onClick={onView} disabled={disabled} className="admin-table-action-link"><Eye className="h-3.5 w-3.5" />View</button><button aria-label={label('Edit')} type="button" onClick={onEdit} disabled={disabled} className="admin-table-action-link"><PencilLine className="h-3.5 w-3.5" />Edit</button><button aria-label={label(coupon.isActive ? 'Pause' : 'Activate')} type="button" onClick={onToggle} disabled={disabled || state.key === 'expired'} className="admin-table-action-link"><ToggleLeft className="h-3.5 w-3.5" />{coupon.isActive ? 'Pause' : 'Activate'}</button><button aria-label={label('Duplicate')} type="button" onClick={onDuplicate} disabled={disabled} className="admin-table-action-link"><Copy className="h-3.5 w-3.5" />Duplicate</button><button aria-label={label('Archive')} type="button" onClick={onArchive} disabled={disabled} className="admin-table-action-link is-danger"><Archive className="h-3.5 w-3.5" />Archive</button></div>;
}

function couponStatus(coupon) {
  const now = Date.now();
  if (coupon.isArchived) return { key: 'archived', label: 'Archived' };
  if (!coupon.isActive) return { key: 'inactive', label: 'Paused' };
  if (coupon.expiryDate && new Date(coupon.expiryDate).getTime() < now) return { key: 'expired', label: 'Expired' };
  if (coupon.validFrom && new Date(coupon.validFrom).getTime() > now) return { key: 'scheduled', label: 'Scheduled' };
  if ((coupon.usageLimit && Number(coupon.usedCount || 0) >= Number(coupon.usageLimit)) || (coupon.totalBudget && Number(coupon.spentAmount || 0) >= Number(coupon.totalBudget))) return { key: 'exhausted', label: 'Exhausted' };
  if (coupon.expiryDate && new Date(coupon.expiryDate).getTime() <= now + 7 * 86400000) return { key: 'expiring', label: 'Expiring soon' };
  return { key: 'live', label: 'Live' };
}

function restrictionLabel(coupon) {
  const rules = [];
  if (coupon.applicableCategories?.length) rules.push(`${coupon.applicableCategories.length} categories`);
  if (coupon.applicableProducts?.length) rules.push(`${coupon.applicableProducts.length} products`);
  if (coupon.applicablePaymentMethods?.length) rules.push(coupon.applicablePaymentMethods.join(', '));
  return rules.length ? rules.join(' · ') : 'All products & payments';
}

function benefitLabel(coupon) {
  if (coupon.benefitType === 'FREE_SHIPPING') return 'Free delivery';
  if (coupon.benefitType === 'BUY_X_GET_Y') return `Buy ${coupon.buyQuantity || 1}, get ${coupon.getQuantity || 1}`;
  return coupon.type === 'Percentage' ? `${coupon.discountValue}%` : `Rs. ${formatNumber(coupon.discountValue)}`;
}

function asList(value) {
  const items = Array.isArray(value) ? value : value?.items;
  if (!Array.isArray(items) || items.some(item => !item?._id)) throw new Error('Unable to read coupons. Please try again.');
  return items;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-IN');
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function shorten(value, max) {
  const text = String(value || '');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function readPagination(value) {
  return {
    page: Number(value?.pagination?.page || value?.page || 1),
    totalPages: Math.max(1, Number(value?.pagination?.totalPages || value?.totalPages || 1)),
    total: Number(value?.pagination?.total || value?.total || (Array.isArray(value) ? value.length : value?.items?.length || 0)),
  };
}

function optionPairsToRecords(items = []) {
  return items.map(([id, label, subtitle]) => ({ _id: id, id, name: label, label, subtitle }));
}

function Progress({ label, value = 0, limit, money = false }) {
  if (!Number(limit || 0)) return null;
  const percent = Math.min(100, Math.round((Number(value || 0) / Number(limit)) * 100));
  return <div className="mt-3"><div className="mb-1 flex justify-between text-[10px] font-bold text-slate-500"><span>{label}</span><span>{money ? 'Rs. ' : ''}{formatNumber(value)} / {money ? 'Rs. ' : ''}{formatNumber(limit)}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${percent >= 90 ? 'bg-rose' : 'bg-emerald-500'}`} style={{ width: `${percent}%` }} /></div></div>;
}

function CouponInsights({ details, loading, products, customers, base, onRange, onClose, onExport }) {
  const coupon = details.coupon || {};
  const summary = details.summary || {};
  const [simulation, setSimulation] = useState({ productId: '', quantity: '1', cartTotal: '1000', deliveryCharge: '99', paymentMethod: 'COD', pincode: '', salesChannel: 'STOREFRONT', customerId: '' });
  const [result, setResult] = useState(null);
  const [notice, setNotice] = useState('');
  const [testing, setTesting] = useState(false);
  const runTest = async (event) => {
    event.preventDefault(); setTesting(true); setResult(null);
    try {
      const body = {
        cartTotal: Number(simulation.cartTotal || 0), deliveryCharge: Number(simulation.deliveryCharge || 0), paymentMethod: simulation.paymentMethod,
        pincode: simulation.pincode, salesChannel: simulation.salesChannel, customerId: simulation.customerId || undefined,
        ...(simulation.productId ? { items: [{ product: simulation.productId, quantity: Number(simulation.quantity || 1) }] } : {}),
      };
      setResult(await api.post(`${base}/coupons/${coupon._id}/simulate`, body));
    } catch (error) { setResult({ eligible: false, reason: error.message || 'Unable to test this coupon.' }); }
    finally { setTesting(false); }
  };
  const campaignUrl = `${window.location.origin}/cart?coupon=${encodeURIComponent(coupon.code || '')}`;
  const copyText = async (value, success) => {
    try { await navigator.clipboard.writeText(value); setNotice(success); }
    catch { setNotice('Clipboard access was blocked. Select and copy the value manually.'); }
  };
  const share = async () => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: coupon.title || `${coupon.code} offer`, text: `Use coupon ${coupon.code}`, url: campaignUrl });
        setNotice('Campaign share sheet opened.');
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
      }
    }
    await copyText(campaignUrl, 'Campaign link copied.');
  };
  return <aside className="fixed inset-0 z-[80] flex justify-end bg-black/35" role="dialog" aria-modal="true" aria-label={`${coupon.code} performance`}><div className="h-full w-full overflow-y-auto bg-[#fffaf6] shadow-2xl sm:max-w-2xl"><div className="sticky top-0 z-10 flex items-start justify-between border-b border-theme-border bg-white px-5 py-4"><div><span className="text-[10px] font-black uppercase tracking-widest text-wine">Coupon performance</span><h2 className="mt-1 text-xl font-black text-charcoal">{coupon.code}</h2><p className="text-xs text-slate-500">{coupon.title || benefitLabel(coupon)}</p></div><button type="button" onClick={onClose} aria-label="Close coupon details" className="grid h-10 w-10 place-items-center rounded-full border border-slate-200"><X className="h-5 w-5" /></button></div>
    <div className="space-y-5 p-5">
      <div className="flex flex-wrap gap-2"><select value={details.days || 30} onChange={(event) => onRange(Number(event.target.value))} disabled={loading} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold"><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last year</option></select><button type="button" onClick={onExport} className="admin-btn-ghost"><Download className="h-4 w-4" /> Export CSV</button><button type="button" onClick={() => copyText(coupon.code || '', 'Coupon code copied.')} className="admin-btn-ghost"><Copy className="h-4 w-4" /> Copy code</button><button type="button" onClick={share} className="admin-btn-ghost"><Share2 className="h-4 w-4" /> Share campaign</button></div>
      {notice ? <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">{notice}</p> : null}
      {loading ? <p className="rounded-xl bg-white p-5 text-sm text-slate-500">Loading coupon performance...</p> : <>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Insight label="Orders" value={summary.orders} /><Insight label="Paid revenue" value={`Rs. ${formatNumber(summary.paidRevenue)}`} /><Insight label="Customers" value={summary.uniqueCustomers} /><Insight label="Avg. order" value={`Rs. ${formatNumber(summary.averageOrderValue)}`} /><Insight label="Offer spend" value={`Rs. ${formatNumber(summary.saving)}`} /><Insight label="Cancelled" value={summary.cancelled} /><Insight label="Returns" value={summary.returned} /><Insight label="Budget left" value={summary.remainingBudget == null ? 'Unlimited' : `Rs. ${formatNumber(summary.remainingBudget)}`} /></div>
        <div className="admin-card p-4"><h3 className="font-black text-charcoal">Daily performance</h3>{details.daily?.length ? <div className="mt-4 space-y-2">{details.daily.slice(-14).map((row) => <div key={row.date} className="grid grid-cols-[90px_1fr_auto] items-center gap-3 text-xs"><span className="text-slate-500">{row.date}</span><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-wine" style={{ width: `${Math.max(4, Math.min(100, Number(row.orders || 0) * 12))}%` }} /></div><strong>{row.orders} orders</strong></div>)}</div> : <p className="mt-3 text-xs text-slate-500">No coupon orders in this period.</p>}</div>
      </>}

      <form onSubmit={runTest} className="admin-card p-4"><div className="flex items-center gap-2"><FlaskConical className="h-5 w-5 text-wine" /><div><h3 className="font-black text-charcoal">Test this coupon</h3><p className="text-xs text-slate-500">Check the same eligibility rules used at checkout.</p></div></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><MiniField label="Bag value"><input type="number" min="1" value={simulation.cartTotal} onChange={(event) => setSimulation({ ...simulation, cartTotal: event.target.value })} className="admin-coupon-input" /></MiniField><MiniField label="Delivery charge"><input type="number" min="0" value={simulation.deliveryCharge} onChange={(event) => setSimulation({ ...simulation, deliveryCharge: event.target.value })} className="admin-coupon-input" /></MiniField><MiniField label="Product (optional)"><select value={simulation.productId} onChange={(event) => setSimulation({ ...simulation, productId: event.target.value })} className="admin-coupon-input"><option value="">No product selected</option>{products.slice(0, 200).map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></MiniField><MiniField label="Quantity"><input type="number" min="1" max="100" value={simulation.quantity} onChange={(event) => setSimulation({ ...simulation, quantity: event.target.value })} className="admin-coupon-input" /></MiniField><MiniField label="Payment"><select value={simulation.paymentMethod} onChange={(event) => setSimulation({ ...simulation, paymentMethod: event.target.value })} className="admin-coupon-input"><option value="COD">COD</option><option value="UPI">UPI</option><option value="CARD">Card</option><option value="NETBANKING">Net banking</option><option value="WALLET">Wallet</option></select></MiniField><MiniField label="PIN code"><input value={simulation.pincode} maxLength={6} onChange={(event) => setSimulation({ ...simulation, pincode: event.target.value.replace(/\D/g, '') })} className="admin-coupon-input" placeholder="302001" /></MiniField><MiniField label="Customer (optional)"><select value={simulation.customerId} onChange={(event) => setSimulation({ ...simulation, customerId: event.target.value })} className="admin-coupon-input"><option value="">Guest customer</option>{customers.map((item) => <option key={item._id || item.id} value={item._id || item.id}>{item.name || item.phone || item.email}</option>)}</select></MiniField><MiniField label="Channel"><select value={simulation.salesChannel} onChange={(event) => setSimulation({ ...simulation, salesChannel: event.target.value })} className="admin-coupon-input"><option value="STOREFRONT">Online store</option><option value="ADMIN">Admin order</option><option value="SOCIAL">Social selling</option></select></MiniField></div><button disabled={testing} className="admin-btn mt-4"><FlaskConical className="h-4 w-4" />{testing ? 'Testing...' : 'Run eligibility test'}</button>{result ? <p role="status" className={`mt-3 rounded-xl p-3 text-xs font-bold ${result.eligible ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{result.eligible ? `Eligible · Estimated saving Rs. ${formatNumber(result.effectiveSaving)}` : result.reason}</p> : null}</form>

      <div className="admin-card overflow-hidden"><div className="border-b border-slate-100 p-4"><h3 className="font-black text-charcoal">Recent coupon orders</h3></div>{details.recentOrders?.length ? details.recentOrders.map((order) => <button type="button" key={order.id} onClick={() => { window.location.href = `${base}/orders?search=${encodeURIComponent(order.invoiceNumber || order.id)}`; }} className="flex w-full items-center justify-between gap-3 border-b border-slate-100 p-4 text-left last:border-0"><span><strong className="block text-sm text-charcoal">{order.invoiceNumber || String(order.id).slice(-8).toUpperCase()}</strong><small className="text-slate-500">{order.customer?.name || 'Customer'} · {formatDate(order.createdAt)}</small></span><span className="text-right"><strong className="block text-sm">Rs. {formatNumber(order.finalAmount)}</strong><small className="text-slate-500">{order.orderStatus}</small></span></button>) : <p className="p-5 text-sm text-slate-500">No redemption history yet.</p>}</div>
    </div></div></aside>;
}

function Insight({ label, value }) {
  return <div className="rounded-xl border border-theme-border bg-white p-3"><small className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</small><strong className="mt-1 block text-base font-black text-charcoal">{value ?? 0}</strong></div>;
}

function MiniField({ label, children }) {
  return <label><span className="mb-1 block text-[11px] font-bold text-slate-600">{label}</span>{children}</label>;
}

function downloadCsv(filename, rows) {
  const headers = ['orderId', 'invoiceNumber', 'customer', 'phone', 'email', 'amount', 'saving', 'paymentStatus', 'orderStatus', 'createdAt'];
  const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const csv = [headers.join(','), ...rows.map((row) => headers.map((key) => escape(row[key])).join(','))].join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
