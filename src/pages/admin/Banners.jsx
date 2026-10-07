import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Archive, ArrowDown, ArrowUp, BarChart3, Copy, Eye, Image as ImageIcon, MousePointerClick, PauseCircle, Pencil, PlayCircle, Plus, RotateCcw } from 'lucide-react';
import BannerForm from '../../components/admin/BannerForm';
import ConfirmModal from '../../components/admin/ConfirmModal';
import PageHeader from '../../components/admin/PageHeader';
import SearchFilterBar from '../../components/admin/SearchFilterBar';
import StatusBadge from '../../components/admin/StatusBadge';
import { Select } from '../../components/ui/Field';
import api from '../../services/api';
import { normalizeImageUrl } from '../../services/normalize';
import { asCatalogList, fetchCategories } from '../../utils/catalogOptions';
import { useAuth } from '../../context/AuthContext';

const positions = ['', 'Home - Top', 'Home - Middle', 'Home - Bottom', 'Cart - Bottom', 'Category - Featured', 'Offer Strip'];

export default function Banners() {
  const { user } = useAuth();
  const base = user?.activeMode === 'seller' ? '/seller' : '/admin';
  const [banners, setBanners] = useState([]), [products, setProducts] = useState([]), [categories, setCategories] = useState([]), [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [loadError, setLoadError] = useState(''), [message, setMessage] = useState(null);
  const [search, setSearch] = useState(''), [status, setStatus] = useState(''), [position, setPosition] = useState(''), [archive, setArchive] = useState('active');
  const [editing, setEditing] = useState(null), [showForm, setShowForm] = useState(false), [confirmTarget, setConfirmTarget] = useState(null), [actionId, setActionId] = useState('');
  const sequence = useRef(0);

  const load = useCallback(async ({ quiet = false } = {}) => {
    const request = ++sequence.current;
    if (!quiet) setLoading(true);
    setLoadError('');
    try {
      const query = new URLSearchParams({ admin: 'true', archive, page: '1', limit: '100' });
      const [bannerData, productData, categoryData, couponData] = await Promise.all([
        api.get(`${base}/banners?${query}`), api.get(`${base}/products?admin=true`), fetchCategories(api, base), api.get(`${base}/coupons?admin=true&archive=active&page=1&limit=100`),
      ]);
      if (request !== sequence.current) return;
      setBanners(asList(bannerData)); setProducts(asCatalogList(productData)); setCategories(categoryData); setCoupons(asList(couponData));
    } catch (error) { if (request === sequence.current) setLoadError(error.message || 'Unable to load banners.'); }
    finally { if (request === sequence.current) setLoading(false); }
  }, [archive, base]);

  useEffect(() => { load(); return () => { sequence.current += 1; }; }, [load]);
  const filtered = useMemo(() => banners.filter((banner) => {
    const term = search.trim().toLowerCase();
    return (!term || [banner.title, banner.subtitle, banner.link, banner.position, banner.campaignKey].filter(Boolean).join(' ').toLowerCase().includes(term))
      && (!position || banner.position === position)
      && (!status || String(banner.status || '').toLowerCase() === status);
  }), [banners, position, search, status]);
  const stats = useMemo(() => ({
    total: banners.length, live: banners.filter((item) => item.status === 'Live').length,
    impressions: banners.reduce((sum, item) => sum + Number(item.impressions || item.views || 0), 0),
    clicks: banners.reduce((sum, item) => sum + Number(item.clicks || 0), 0),
    revenue: banners.reduce((sum, item) => sum + Number(item.attributedRevenue || 0), 0),
  }), [banners]);

  const save = async (payload) => {
    setSaving(true); setMessage(null);
    try {
      const saved = editing?._id ? await api.put(`${base}/banners/${editing._id}`, payload) : await api.post(`${base}/banners`, payload);
      setShowForm(false); setEditing(null); await load({ quiet: true });
      setMessage({ type: 'success', text: `${saved.title} ${editing?._id ? 'updated' : 'created'} successfully.` });
    } catch (error) { setMessage({ type: 'error', text: error.message }); }
    finally { setSaving(false); }
  };

  const act = async (banner, action) => {
    if (actionId) return;
    setActionId(banner._id); setMessage(null);
    try {
      let result;
      if (action === 'status') result = await api.patch(`${base}/banners/${banner._id}/status`, { isActive: !banner.isActive });
      if (action === 'duplicate') result = await api.post(`${base}/banners/${banner._id}/duplicate`, {});
      if (action === 'restore') result = await api.patch(`${base}/banners/${banner._id}/restore`, {});
      if (action === 'archive') result = await api.delete(`${base}/banners/${banner._id}`);
      setConfirmTarget(null); await load({ quiet: true });
      setMessage({ type: 'success', text: result?.message || `Banner ${action} completed.` });
    } catch (error) { setMessage({ type: 'error', text: error.message }); }
    finally { setActionId(''); }
  };

  const move = async (banner, direction) => {
    const siblings = banners.filter((item) => item.position === banner.position && !item.isArchived).sort((a, b) => Number(a.displayOrder || 0) - Number(b.displayOrder || 0));
    const index = siblings.findIndex((item) => item._id === banner._id), swap = index + direction;
    if (index < 0 || swap < 0 || swap >= siblings.length || actionId) return;
    const next = siblings.map((item, itemIndex) => ({ id: item._id, displayOrder: itemIndex === index ? swap : itemIndex === swap ? index : itemIndex }));
    setActionId(banner._id);
    try { await api.put(`${base}/banners/reorder`, { items: next }); await load({ quiet: true }); }
    catch (error) { setMessage({ type: 'error', text: error.message }); }
    finally { setActionId(''); }
  };

  return <section className="space-y-5">
    <PageHeader title="Banners and campaigns" note="Publish responsive storefront creatives and measure their real performance."><a href={`${base}/campaigns`} className="admin-btn-ghost"><BarChart3 className="h-4 w-4" />Open campaigns</a><button type="button" onClick={() => { setEditing(null); setShowForm(true); }} className="admin-btn"><Plus className="h-4 w-4" />Add New Banner</button></PageHeader>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Metric icon={ImageIcon} label="Banners" value={stats.total} /><Metric icon={PlayCircle} label="Live" value={stats.live} /><Metric icon={Eye} label="Impressions" value={formatNumber(stats.impressions)} /><Metric icon={MousePointerClick} label="Clicks" value={formatNumber(stats.clicks)} /><Metric icon={BarChart3} label="Revenue" value={`Rs. ${formatNumber(stats.revenue)}`} /></div>
    {showForm ? <BannerForm initialValues={editing} saving={saving} message={message?.type === 'error' ? message.text : ''} products={products} categories={categories} coupons={coupons} onSubmit={save} onCancel={() => { setShowForm(false); setEditing(null); }} /> : null}
    {message && !showForm ? <p role="status" className={`rounded-xl p-3 text-sm font-bold ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose/10 text-wine'}`}>{message.text}</p> : null}
    <div className="flex gap-2 overflow-x-auto">{[['active', 'Current'], ['archived', 'Archived'], ['all', 'All']].map(([value, label]) => <button key={value} onClick={() => setArchive(value)} className={`min-w-max rounded-full px-4 py-2 text-xs font-black ${archive === value ? 'bg-wine text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>{label}</button>)}</div>
    <SearchFilterBar search={search} onSearch={setSearch} placeholder="Search title, campaign or destination"><Select value={position} onChange={(event) => setPosition(event.target.value)}><option value="">All positions</option>{positions.filter(Boolean).map((item) => <option key={item}>{item}</option>)}</Select><Select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All status</option>{['live', 'scheduled', 'paused', 'ended', 'archived'].map((item) => <option key={item} value={item}>{capitalize(item)}</option>)}</Select></SearchFilterBar>
    {loadError ? <div className="admin-card p-8 text-center"><p className="font-bold text-rose">{loadError}</p><button type="button" onClick={() => load()} className="admin-btn mt-4">Try again</button></div> : loading ? <div className="admin-card p-10 text-center font-bold text-slate-500">Loading banners...</div> : !filtered.length ? <div className="admin-card p-10 text-center"><h2>No banners found</h2><p className="admin-note mt-2">Clear filters or create a new campaign creative.</p></div> : <div className="grid gap-4 xl:grid-cols-2">{filtered.map((banner) => <BannerCard key={banner._id} banner={banner} base={base} busy={actionId === banner._id} onEdit={() => { setEditing(banner); setShowForm(true); }} onAction={(action) => action === 'archive' ? setConfirmTarget(banner) : act(banner, action)} onMove={move} />)}</div>}
    <ConfirmModal open={!!confirmTarget} title="Archive banner?" message={`Archive ${confirmTarget?.title || 'this banner'}? Its images and performance history will be preserved.`} confirmLabel="Archive" onClose={() => !actionId && setConfirmTarget(null)} onConfirm={() => act(confirmTarget, 'archive')} />
  </section>;
}

function BannerCard({ banner, base, busy, onEdit, onAction, onMove }) {
  const impressions = Number(banner.impressions || banner.views || 0);
  const ctr = impressions ? (Number(banner.clicks || 0) / impressions) * 100 : 0;
  const managed = Boolean(banner.campaignId);
  return (
    <article className="admin-card overflow-hidden">
      <div className="relative aspect-[16/6] bg-[#f5e9e2]">
        {banner.image ? <img src={normalizeImageUrl(banner.image)} alt={banner.altText || banner.title} className="h-full w-full object-cover" style={{ objectPosition: banner.focalPoint || 'center' }} /> : null}
        <span className="absolute left-3 top-3"><StatusBadge value={banner.status || (banner.isActive ? 'Live' : 'Paused')} /></span>
        {managed ? <span className="absolute right-3 top-3 rounded-full bg-violet-50 px-2.5 py-1 text-[9px] font-black uppercase text-violet-700 shadow-sm">Campaign managed</span> : null}
      </div>
      <div className="p-4 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[.12em] text-wine">{banner.position}</p>
            <h3 className="mt-1 text-lg font-black text-charcoal">{banner.title}</h3>
            <p className="mt-1 line-clamp-2 text-xs text-slate-500">{banner.subtitle || banner.link}</p>
          </div>
          <div className="flex gap-1">
            <button onClick={() => onMove(banner, -1)} disabled={busy || managed} className="admin-catalog-action disabled:opacity-35" title={managed ? 'Change placement order from Campaigns' : 'Move up'}><ArrowUp className="h-4 w-4" /></button>
            <button onClick={() => onMove(banner, 1)} disabled={busy || managed} className="admin-catalog-action disabled:opacity-35" title={managed ? 'Change placement order from Campaigns' : 'Move down'}><ArrowDown className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2 rounded-xl bg-[#faf7f4] p-3 text-center">
          <SmallMetric label="Views" value={formatNumber(impressions)} />
          <SmallMetric label="Clicks" value={formatNumber(banner.clicks)} />
          <SmallMetric label="CTR" value={`${ctr.toFixed(1)}%`} />
          <SmallMetric label="Orders" value={formatNumber(banner.attributedOrders)} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {managed ? <>
            <a href={`${base}/campaigns`} className="admin-table-action-link"><BarChart3 className="h-3.5 w-3.5" />Open campaign</a>
            <button onClick={() => onAction('duplicate')} disabled={busy} className="admin-table-action-link"><Copy className="h-3.5 w-3.5" />Independent copy</button>
          </> : <>
            <button onClick={onEdit} disabled={busy || banner.isArchived} className="admin-table-action-link"><Pencil className="h-3.5 w-3.5" />Edit</button>
            {banner.isArchived
              ? <button onClick={() => onAction('restore')} disabled={busy} className="admin-table-action-link"><RotateCcw className="h-3.5 w-3.5" />Restore</button>
              : <>
                <button onClick={() => onAction('status')} disabled={busy} className="admin-table-action-link">{banner.isActive ? <PauseCircle className="h-3.5 w-3.5" /> : <PlayCircle className="h-3.5 w-3.5" />}{banner.isActive ? 'Pause' : 'Activate'}</button>
                <button onClick={() => onAction('duplicate')} disabled={busy} className="admin-table-action-link"><Copy className="h-3.5 w-3.5" />Duplicate</button>
                <button onClick={() => onAction('archive')} disabled={busy} className="admin-table-action-link is-danger"><Archive className="h-3.5 w-3.5" />Archive</button>
              </>}
          </>}
        </div>
      </div>
    </article>
  );
}
function Metric({ icon: Icon, label, value }) { return <div className="admin-card flex items-center gap-3 p-4"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blush text-wine"><Icon className="h-5 w-5" /></span><span><small className="block text-xs font-bold text-slate-500">{label}</small><strong className="block text-lg font-black text-charcoal">{value}</strong></span></div>; }
function SmallMetric({ label, value }) { return <span><small className="block text-[10px] font-bold uppercase text-slate-400">{label}</small><strong className="mt-1 block text-xs text-charcoal">{value || 0}</strong></span>; }
function asList(value) { const items = Array.isArray(value) ? value : value?.items; if (!Array.isArray(items)) throw new Error('The server returned invalid campaign data.'); return items; }
function formatNumber(value) { return Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 }); }
function capitalize(value) { return `${String(value).charAt(0).toUpperCase()}${String(value).slice(1)}`; }
