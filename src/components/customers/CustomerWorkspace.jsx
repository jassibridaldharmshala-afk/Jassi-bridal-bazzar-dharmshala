import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, Check, ChevronLeft, ChevronRight, Crown, Download,
  Eye, Filter, Heart, Mail, MessageCircle, Package, Phone, RefreshCw, Save, Search,
  Settings2, ShieldAlert, ShoppingBag, SlidersHorizontal, Sparkles, Tag, Users, X,
} from 'lucide-react';
import api from '../../services/api';
import PageState from '../ui/PageState';
import './CustomerWorkspace.css';

const FALLBACK_SEGMENTS = ['All customers', 'VIP', 'Repeat Customer', 'New Customer', 'At Risk', 'Inactive', 'Abandoned Cart', 'High-value Cart', 'Frequent Return', 'High RTO', 'Checkout Restricted', 'COD Restricted', 'Needs Follow-up', 'No marketing consent', 'Active cart', 'Birthday upcoming', 'Anniversary upcoming', 'Instagram Customer', 'Facebook Customer', 'WhatsApp Customer'];
const SORTS = [['spend', 'Highest net spend'], ['recent', 'Recent order'], ['orders', 'Most orders'], ['name', 'Customer name'], ['returns', 'Most returns'], ['rto', 'Highest RTO'], ['oldest', 'Needs re-engagement']];
const PROFILE_TAGS = ['VIP', 'At Risk', 'Wholesale', 'Priority Support', 'Needs Follow-up'];
const EMPTY_OFFER = { channel: 'IN_APP', title: 'A special offer for you', message: '', couponCode: '' };

export default function CustomerWorkspace({ apiPrefix = '/admin' }) {
  const seller = apiPrefix === '/seller';
  const crmPath = seller ? '/seller/crm' : '/admin/customer-crm';
  const [data, setData] = useState(null);
  const [coupons, setCoupons] = useState([]);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [segment, setSegment] = useState('All customers');
  const [sort, setSort] = useState('spend');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [selected, setSelected] = useState([]);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [edit, setEdit] = useState(null);
  const [restrictionEdit, setRestrictionEdit] = useState(null);
  const [busy, setBusy] = useState('');
  const [offer, setOffer] = useState(EMPTY_OFFER);
  const [prepared, setPrepared] = useState([]);
  const [bulkTag, setBulkTag] = useState('VIP');
  const [showOffer, setShowOffer] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [rules, setRules] = useState(null);
  const [savedViews, setSavedViews] = useState(() => readSavedViews(seller));
  const [viewName, setViewName] = useState('');
  const [showViews, setShowViews] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [columns, setColumns] = useState(() => readColumns(seller));
  const [masterStores, setMasterStores] = useState([]);
  const [storeSlug, setStoreSlug] = useState(() => typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('store') || '');
  const directCustomerId = useRef(typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('customer') || '');
  const directCustomerOpened = useRef(false);
  const requestSequence = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => { setDebouncedQuery(query.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const load = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', segment, sort });
      if (debouncedQuery) params.set('search', debouncedQuery);
      const response = await api.get(scopedPath(crmPath, storeSlug, params));
      if (sequence !== requestSequence.current) return;
      const normalized = Array.isArray(response) ? { items: response, total: response.length, page: 1, totalPages: 1, summary: { total: response.length } } : response;
      if (!normalized || !Array.isArray(normalized.items)) throw new Error('Customer information could not be read.');
      setData(normalized); setRules(normalized.rules || null);
      setSelected((current) => current.filter((id) => normalized.items.some((item) => item.userId === id)));
    } catch (loadError) {
      if (sequence === requestSequence.current) setError(loadError.message);
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [crmPath, debouncedQuery, page, segment, sort, storeSlug]);

  useEffect(() => { load(); return () => { requestSequence.current += 1; }; }, [load]);
  useEffect(() => {
    api.get(scopedPath(seller ? '/seller/coupons' : '/admin/coupons', storeSlug), { silent: true }).then((items) => setCoupons(Array.isArray(items) ? items : items?.items || [])).catch(() => setCoupons([]));
  }, [seller, storeSlug]);
  useEffect(() => { persistColumns(seller, columns); }, [columns, seller]);

  const items = data?.items || [];
  const capabilities = data?.capabilities || { canWrite: true, canViewPii: true, canExport: true, canMarket: true, canManageRules: true, isMaster: false };
  useEffect(() => {
    if (seller || !capabilities.isMaster || masterStores.length) return;
    api.get('/master', { silent: true }).then((workspace) => setMasterStores(Array.isArray(workspace?.stores) ? workspace.stores : [])).catch(() => setMasterStores([]));
  }, [capabilities.isMaster, masterStores.length, seller]);
  const allSelected = items.length > 0 && items.every((item) => selected.includes(item.userId));
  const activeFilters = Number(segment !== 'All customers') + Number(sort !== 'spend') + Number(Boolean(debouncedQuery));

  const toggle = (id) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const toggleVisible = () => setSelected((current) => allSelected ? current.filter((id) => !items.some((item) => item.userId === id)) : [...new Set([...current, ...items.map((item) => item.userId)])]);

  const openCustomer = useCallback(async (row) => {
    setDetail({ customer: { id: row.userId, name: row.name }, metrics: row }); setDetailLoading(true); setPrepared([]);
    try {
      const response = await api.get(scopedPath(`${crmPath}/${row.userId}`, storeSlug));
      setDetail(response);
      setEdit(profileForm(response.profile));
      setRestrictionEdit(restrictionForm(response.profile?.restrictions));
    } catch (detailError) { setNotice({ type: 'error', message: detailError.message }); setDetail(null); }
    finally { setDetailLoading(false); }
  }, [crmPath, storeSlug]);

  useEffect(() => {
    if (!directCustomerId.current || directCustomerOpened.current) return;
    directCustomerOpened.current = true;
    openCustomer({ userId: directCustomerId.current, name: 'Customer' });
  }, [openCustomer]);

  const refreshDetail = async (id) => {
    const response = await api.get(scopedPath(`${crmPath}/${id}`, storeSlug));
    setDetail(response); setEdit(profileForm(response.profile)); setRestrictionEdit(restrictionForm(response.profile?.restrictions));
  };

  const saveProfile = async () => {
    if (!detail?.customer?.id || !edit) return;
    setBusy('profile');
    try {
      await api.put(scopedPath(`${crmPath}/${detail.customer.id}`, storeSlug), {
        revision: edit.revision, manualTags: edit.manualTags, notes: edit.notes, acquisition: edit.acquisition,
        lifecycleStatus: edit.lifecycleStatus, followUpAt: edit.followUpAt || null, followUpNote: edit.followUpNote, anniversaryDate: edit.anniversaryDate || null,
        channelConsents: edit.channelConsents,
      });
      await Promise.all([refreshDetail(detail.customer.id), load()]);
      setNotice({ type: 'success', message: 'Customer profile saved.' });
    } catch (saveError) { setNotice({ type: 'error', message: saveError.message }); }
    finally { setBusy(''); }
  };

  const saveRestrictions = async () => {
    if (!detail?.customer?.id || !restrictionEdit) return;
    setBusy('restrictions');
    try {
      await api.put(scopedPath(`${crmPath}/${detail.customer.id}/restrictions`, storeSlug), { ...restrictionEdit, revision: detail.profile?.revision || 0 });
      await Promise.all([refreshDetail(detail.customer.id), load()]);
      setNotice({ type: 'success', message: 'Store restrictions updated.' });
    } catch (saveError) { setNotice({ type: 'error', message: saveError.message }); }
    finally { setBusy(''); }
  };

  const applyBulkTag = async () => {
    if (!selected.length) return;
    setBusy('bulk');
    try {
      await api.post(scopedPath(`${crmPath}/bulk-tags`, storeSlug), { customerIds: selected, add: [bulkTag], remove: [] });
      setNotice({ type: 'success', message: `${bulkTag} added to ${selected.length} customer${selected.length === 1 ? '' : 's'}.` });
      setSelected([]); await load();
    } catch (bulkError) { setNotice({ type: 'error', message: bulkError.message }); }
    finally { setBusy(''); }
  };

  const sendOffer = async () => {
    if (!selected.length) return;
    setBusy('offer'); setPrepared([]);
    try {
      const result = await api.post(scopedPath(`${apiPrefix}/business/customer-offers`, storeSlug), { customerIds: selected, ...offer });
      setPrepared(result.items || []);
      setNotice({ type: 'success', message: result.channel === 'WHATSAPP_LINK' ? `${result.prepared || 0} WhatsApp message${result.prepared === 1 ? '' : 's'} ready for review.` : `${result.sent || 0} in-app offer${result.sent === 1 ? '' : 's'} sent; ${result.skipped || 0} skipped.` });
    } catch (offerError) { setNotice({ type: 'error', message: offerError.message }); }
    finally { setBusy(''); }
  };

  const exportCsv = async () => {
    setBusy('export');
    try {
      const params = new URLSearchParams({ segment, sort }); if (debouncedQuery) params.set('search', debouncedQuery);
      const result = await api.get(scopedPath(`${crmPath}/export`, storeSlug, params));
      downloadCsv(result.filename, result.rows || []);
      setNotice({ type: 'success', message: `${result.rows?.length || 0} customer records exported.` });
    } catch (exportError) { setNotice({ type: 'error', message: exportError.message }); }
    finally { setBusy(''); }
  };

  const saveRules = async () => {
    setBusy('rules');
    try {
      const saved = await api.put(scopedPath(`${crmPath}/settings`, storeSlug), rules);
      setRules(saved); setShowRules(false); await load();
      setNotice({ type: 'success', message: 'Smart segment rules updated.' });
    } catch (rulesError) { setNotice({ type: 'error', message: rulesError.message }); }
    finally { setBusy(''); }
  };

  const privacyAction = async ({ action, customerId, requestId, type, status, resolution }) => {
    setBusy('privacy');
    try {
      if (action === 'create') await api.post(scopedPath(`${crmPath}/${customerId}/privacy-requests`, storeSlug), { type });
      else await api.patch(scopedPath(`${crmPath}/${customerId}/privacy-requests/${requestId}`, storeSlug), { status, resolution });
      await refreshDetail(customerId);
      setNotice({ type: 'success', message: action === 'create' ? 'Privacy request registered.' : 'Privacy request updated.' });
    } catch (privacyError) { setNotice({ type: 'error', message: privacyError.message }); }
    finally { setBusy(''); }
  };

  const saveView = () => {
    const name = viewName.trim(); if (!name) return;
    const next = [...savedViews.filter((item) => item.name.toLowerCase() !== name.toLowerCase()), { name, query, segment, sort }].slice(-8);
    setSavedViews(next); persistViews(seller, next); setViewName(''); setShowViews(false);
    setNotice({ type: 'success', message: `Saved view “${name}”.` });
  };

  if (!data && loading) return <PageState loading loadingLabel="Building customer intelligence..." />;
  if (!data && error) return <PageState error={error} onRetry={load} />;

  return (
    <section className="customer-workspace">
      <header className="customer-hero">
        <div><p className="customer-eyebrow">Customer intelligence</p><h1>Customer 360</h1><p>Accurate revenue, buying behaviour, service history and respectful engagement for this store.</p></div>
        <div className="customer-hero__actions">
          {masterStores.length > 0 && <label className="customer-store-picker"><span>Active store</span><select aria-label="Active customer store" value={storeSlug} onChange={(event) => { setStoreSlug(event.target.value); setPage(1); setSelected([]); setDetail(null); }}><option value="">{masterStores.find((store) => store.isDefault)?.name || 'Default store'}</option>{masterStores.filter((store) => !store.isDefault).map((store) => <option key={store.id} value={store.slug}>{store.name}</option>)}</select></label>}
          {capabilities.canManageRules && <button type="button" className="customer-button customer-button--glass" onClick={() => setShowRules(true)}><SlidersHorizontal /> Segment rules</button>}
          <button type="button" className="customer-button customer-button--glass" onClick={load} disabled={loading}><RefreshCw className={loading ? 'is-spinning' : ''} /> Refresh</button>
        </div>
        <div className="customer-metrics">
          <Metric icon={Users} label="Customers" value={data.summary?.total || 0} />
          <Metric icon={Sparkles} label="New" value={data.summary?.newCustomers || 0} />
          <Metric icon={RefreshCw} label="Repeat" value={data.summary?.repeat || 0} />
          <Metric icon={Crown} label="VIP" value={data.summary?.vip || 0} />
          <Metric icon={AlertTriangle} label="Need attention" value={data.summary?.atRisk || 0} />
          <Metric icon={ShoppingBag} label="Net revenue" value={money(data.summary?.netRevenue)} moneyValue />
        </div>
      </header>

      {notice && <Notice value={notice} close={() => setNotice(null)} />}
      {error && <Notice value={{ type: 'error', message: error }} close={() => setError('')} />}

      <div className="customer-toolbar">
        <label className="customer-search"><Search /><input aria-label="Search customers" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, phone or email" /></label>
        <label className="customer-select"><Filter /><select aria-label="Customer segment" value={segment} onChange={(event) => { setSegment(event.target.value); setPage(1); }}>{(data.segments || FALLBACK_SEGMENTS).map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="customer-select"><SlidersHorizontal /><select aria-label="Sort customers" value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}>{SORTS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <div className="customer-toolbar__buttons">
          <button type="button" className="customer-button customer-button--soft" onClick={() => { setShowColumns((value) => !value); setShowViews(false); }}><Settings2 /> Columns</button>
          <button type="button" className="customer-button customer-button--soft" onClick={() => setShowViews((value) => !value)}><Save /> Views {savedViews.length ? `(${savedViews.length})` : ''}</button>
          {capabilities.canExport && <button type="button" className="customer-button customer-button--soft" onClick={exportCsv} disabled={busy === 'export'}><Download /> {busy === 'export' ? 'Exporting' : 'Export'}</button>}
        </div>
        {showViews && <div className="customer-saved-views">
          <div className="customer-saved-views__save"><input aria-label="Saved view name" value={viewName} onChange={(event) => setViewName(event.target.value)} placeholder="Name this view" maxLength={40} /><button type="button" onClick={saveView}>Save</button></div>
          {savedViews.map((view) => <div className="customer-saved-views__item" key={view.name}><button type="button" onClick={() => { setQuery(view.query); setDebouncedQuery(view.query); setSegment(view.segment); setSort(view.sort); setPage(1); setShowViews(false); }}>{view.name}</button><button type="button" aria-label={`Delete saved view ${view.name}`} onClick={() => { const next = savedViews.filter((item) => item.name !== view.name); setSavedViews(next); persistViews(seller, next); }}><X /></button></div>)}
          {!savedViews.length && <p>No saved views yet.</p>}
        </div>}
        {showColumns && <div className="customer-column-picker"><strong>Visible columns</strong>{Object.entries({ orders: 'Orders', spend: 'Net spend', risk: 'Returns & RTO', activity: 'Last activity', signals: 'Signals' }).map(([key, label]) => <Toggle key={key} label={label} checked={columns[key]} set={(value) => setColumns({ ...columns, [key]: value })} />)}</div>}
      </div>

      {activeFilters > 0 && <div className="customer-filter-summary"><span>{activeFilters} active filter{activeFilters === 1 ? '' : 's'} · {data.total} matching customer{data.total === 1 ? '' : 's'}</span><button type="button" onClick={() => { setQuery(''); setDebouncedQuery(''); setSegment('All customers'); setSort('spend'); setPage(1); }}>Clear filters</button></div>}

      {selected.length > 0 && <div className="customer-bulk-bar">
        <strong>{selected.length} selected</strong>
        {capabilities.canWrite && <><select aria-label="Bulk customer tag" value={bulkTag} onChange={(event) => setBulkTag(event.target.value)}>{PROFILE_TAGS.map((tag) => <option key={tag}>{tag}</option>)}</select><button type="button" onClick={applyBulkTag} disabled={busy === 'bulk'}><Tag /> Add tag</button></>}
        {capabilities.canMarket && <button type="button" onClick={() => setShowOffer(true)}><MessageCircle /> Prepare offer</button>}
        <button type="button" onClick={() => setSelected([])}>Clear</button>
      </div>}

      <article className="customer-list-card" aria-busy={loading}>
        <div className="customer-list-head"><label><input type="checkbox" checked={allSelected} onChange={toggleVisible} /> Select page</label><span>{data.total} customer{data.total === 1 ? '' : 's'}</span></div>
        {!items.length ? <PageState empty emptyTitle="No customers match this view" emptyMessage="Try a different segment or clear the search." /> : <>
          <div className="customer-table-wrap"><table className="customer-table"><thead><tr><th></th><th>Customer</th>{columns.orders && <th>Orders</th>}{columns.spend && <th>Net spend</th>}{columns.risk && <th>Returns / RTO</th>}{columns.activity && <th>Last activity</th>}{columns.signals && <th>Signals</th>}<th></th></tr></thead><tbody>{items.map((row) => <CustomerRow key={row.userId} row={row} columns={columns} selected={selected.includes(row.userId)} toggle={toggle} open={openCustomer} />)}</tbody></table></div>
          <div className="customer-mobile-list">{items.map((row) => <CustomerCard key={row.userId} row={row} selected={selected.includes(row.userId)} toggle={toggle} open={openCustomer} />)}</div>
        </>}
        <Pagination page={data.page || page} pages={data.totalPages || 1} total={data.total || 0} change={setPage} />
      </article>

      {detail && <CustomerDrawer detail={detail} loading={detailLoading} edit={edit} setEdit={setEdit} restrictions={restrictionEdit} setRestrictions={setRestrictionEdit} close={() => setDetail(null)} saveProfile={saveProfile} saveRestrictions={saveRestrictions} privacyAction={privacyAction} busy={busy} apiPrefix={apiPrefix} />}
      {showOffer && <Modal title="Prepare customer offer" eyebrow={`${selected.length} selected`} close={() => setShowOffer(false)}>
        <div className="customer-form-grid">
          <Field label="Channel"><select value={offer.channel} onChange={(event) => setOffer({ ...offer, channel: event.target.value })}><option value="IN_APP">In-app notification</option><option value="WHATSAPP_LINK">WhatsApp review</option></select></Field>
          <Field label="Coupon"><select value={offer.couponCode} onChange={(event) => setOffer({ ...offer, couponCode: event.target.value })}><option value="">No coupon</option>{coupons.map((coupon) => <option key={coupon._id} value={coupon.code}>{coupon.code}</option>)}</select></Field>
          <Field label="Offer title" wide><input value={offer.title} maxLength={100} onChange={(event) => setOffer({ ...offer, title: event.target.value })} /></Field>
          <Field label="Message" wide><textarea value={offer.message} maxLength={500} onChange={(event) => setOffer({ ...offer, message: event.target.value })} placeholder="Optional message" /></Field>
        </div>
        <p className="customer-help">WhatsApp opens messages for your review and requires recorded consent. In-app duplicates are skipped for seven days.</p>
        {prepared.length > 0 && <div className="customer-prepared">{prepared.map((item) => item.available ? <a key={item.customerId} href={item.url} target="_blank" rel="noreferrer"><MessageCircle /> Review for {item.name}</a> : <p key={item.customerId}>{item.name}: {item.reason}</p>)}</div>}
        <div className="customer-modal-actions"><button type="button" className="customer-button customer-button--soft" onClick={() => setShowOffer(false)}>Cancel</button><button type="button" className="customer-button customer-button--primary" onClick={sendOffer} disabled={busy === 'offer' || !selected.length || (offer.channel === 'WHATSAPP_LINK' && selected.length > 10)}>{busy === 'offer' ? 'Preparing...' : offer.channel === 'IN_APP' ? 'Send offer' : 'Prepare messages'}</button></div>
      </Modal>}
      {showRules && rules && <RulesModal rules={rules} setRules={setRules} close={() => setShowRules(false)} save={saveRules} busy={busy === 'rules'} />}
    </section>
  );
}

function CustomerRow({ row, columns, selected, toggle, open }) {
  return <tr><td><input type="checkbox" aria-label={`Select ${row.name}`} checked={selected} onChange={() => toggle(row.userId)} /></td><td><button type="button" className="customer-identity" onClick={() => open(row)}><span>{initials(row.name)}</span><span><strong>{row.name}</strong><small>{row.phoneMasked || row.emailMasked || 'Verified shopper'}</small></span></button></td>{columns.orders && <td><strong>{row.orders}</strong><small>{row.paidOrders} paid</small></td>}{columns.spend && <td><strong>{money(row.netSpend)}</strong><small>{row.refunded ? `${money(row.refunded)} refunded` : `${money(row.aov)} AOV`}</small></td>}{columns.risk && <td><strong>{row.returns} / {row.rtoCount}</strong><small>{row.returnRate}% / {row.rtoRate}%</small></td>}{columns.activity && <td><strong>{date(row.lastOrderAt || row.cartUpdatedAt)}</strong><small>{row.cartItems ? `${row.cartItems} in bag` : 'No active bag'}</small></td>}{columns.signals && <td><TagList tags={row.tags} /></td>}<td><button type="button" className="customer-view-button" onClick={() => open(row)}><Eye /> View</button></td></tr>;
}

function CustomerCard({ row, selected, toggle, open }) {
  return <article className="customer-mobile-card"><div className="customer-mobile-card__top"><input type="checkbox" aria-label={`Select ${row.name}`} checked={selected} onChange={() => toggle(row.userId)} /><button type="button" className="customer-identity" onClick={() => open(row)}><span>{initials(row.name)}</span><span><strong>{row.name}</strong><small>{row.phoneMasked || row.emailMasked}</small></span></button><button type="button" className="customer-view-button" aria-label={`View ${row.name}`} onClick={() => open(row)}><ChevronRight /></button></div><div className="customer-mobile-card__metrics"><Mini label="Orders" value={row.orders} /><Mini label="Net spend" value={money(row.netSpend)} /><Mini label="Returns" value={row.returns} /><Mini label="RTO" value={row.rtoCount} /></div><TagList tags={row.tags} /></article>;
}

function CustomerDrawer({ detail, loading, edit, setEdit, restrictions, setRestrictions, close, saveProfile, saveRestrictions, privacyAction, busy, apiPrefix }) {
  const [tab, setTab] = useState('overview');
  const [privacyType, setPrivacyType] = useState('DATA_EXPORT');
  const [privacyResolution, setPrivacyResolution] = useState('');
  const metrics = detail.metrics || {};
  const canWrite = detail.capabilities?.canWrite !== false;
  return <div className="customer-drawer-backdrop" role="dialog" aria-modal="true" aria-label="Customer details"><aside className="customer-drawer">
    <header className="customer-drawer__header"><div className="customer-drawer__identity"><span>{initials(detail.customer?.name)}</span><div><p>Customer 360</p><h2>{detail.customer?.name || 'Customer'}</h2><small>{detail.customer?.phone || detail.customer?.email || 'Loading contact...'}</small></div></div><button type="button" onClick={close} aria-label="Close customer details"><X /></button></header>
    {loading ? <PageState loading loadingLabel="Loading complete customer history..." /> : <>
      <nav className="customer-tabs">{[['overview', 'Overview'], ['orders', 'Orders'], ['engagement', 'Engagement'], ['profile', 'Profile']].map(([key, label]) => <button type="button" key={key} className={tab === key ? 'is-active' : ''} onClick={() => setTab(key)}>{label}</button>)}</nav>
      <div className="customer-drawer__body">
        {tab === 'overview' && <>
          <div className="customer-detail-metrics"><Mini label="Net spend" value={money(metrics.netSpend)} /><Mini label="Paid orders" value={metrics.paidOrders || 0} /><Mini label="AOV" value={money(metrics.aov)} /><Mini label="Refunded" value={money(metrics.refunded)} /><Mini label="Returns" value={metrics.returns || 0} /><Mini label="Actual RTO" value={metrics.rtoCount || 0} /></div>
          <Section title="Customer signals" icon={Sparkles}><TagList tags={metrics.tags || []} all /></Section>
          <Section title="Shopping preferences" icon={Heart}><InsightList title="Products" values={(detail.insights?.favoriteProducts || []).map((item) => ({ value: item.product?.name, count: item.quantity }))} /><InsightList title="Sizes" values={detail.insights?.preferredSizes} /><InsightList title="Colours" values={detail.insights?.preferredColors} /><InsightList title="Categories" values={detail.insights?.favoriteCategories} /></Section>
          <Section title="Active shopping bag" icon={ShoppingBag}>{detail.cart?.items?.length ? <div className="customer-product-list">{detail.cart.items.map((item, index) => <p key={item._id || index}><strong>{item.product?.name || 'Product'}</strong><span>{item.quantity || 1} × {money(item.price || item.product?.price)}</span></p>)}</div> : <EmptyText>No active items in the shopping bag.</EmptyText>}</Section>
          <Section title="Recent delivery addresses" icon={Package}>{detail.addresses?.length ? detail.addresses.slice(0, 3).map((address, index) => <p className="customer-address" key={`${address.pincode}-${index}`}>{[address.houseNo, address.area, address.landmark, address.city, address.state, address.pincode].filter(Boolean).join(', ')}</p>) : <EmptyText>Address details are hidden or unavailable.</EmptyText>}</Section>
        </>}
        {tab === 'orders' && <>
          <Section title="Order timeline" icon={Package}>{detail.orders?.length ? <div className="customer-timeline">{detail.orders.map((order) => <a key={order._id} href={`${apiPrefix}/orders/detail?id=${order._id}`}><span className={`customer-status-dot is-${String(order.orderStatus).toLowerCase().replaceAll(' ', '-')}`} /><span><strong>{order.invoiceNumber || String(order._id).slice(-8).toUpperCase()}</strong><small>{dateTime(order.createdAt)} · {order.orderStatus} · {order.paymentMethod}</small></span><b>{money(order.finalAmount)}</b></a>)}</div> : <EmptyText>No orders found.</EmptyText>}</Section>
          <Section title="Returns and exchanges" icon={RefreshCw}>{detail.returns?.length ? <div className="customer-product-list">{detail.returns.map((item) => <p key={item._id}><strong>{item.type === 'exchange' ? 'Exchange' : 'Return'} · {item.status}</strong><span>{date(item.createdAt)} · {item.reason || 'No reason provided'}</span></p>)}</div> : <EmptyText>No return or exchange requests.</EmptyText>}</Section>
        </>}
        {tab === 'engagement' && <>
          <Section title="Contact" icon={Phone}><div className="customer-contact-actions">{isFullContact(detail.customer?.phone) && <a href={`tel:${detail.customer.phone}`}><Phone /> Call</a>}{isFullContact(detail.customer?.phone) && <a href={`https://wa.me/91${String(detail.customer.phone).replace(/\D/g, '').slice(-10)}`} target="_blank" rel="noreferrer"><MessageCircle /> WhatsApp</a>}{detail.customer?.email?.includes('@') && !detail.customer.email.includes('•') && <a href={`mailto:${detail.customer.email}`}><Mail /> Email</a>}</div></Section>
          <Section title="Support conversations" icon={MessageCircle}>{detail.conversations?.length ? <div className="customer-product-list">{detail.conversations.map((item) => <p key={item._id}><strong>{item.subject || item.channel}</strong><span>{item.status} · {dateTime(item.lastMessageAt)}</span></p>)}</div> : <EmptyText>No support conversations.</EmptyText>}</Section>
          <Section title="Recent messages" icon={Mail}>{detail.notifications?.length ? <div className="customer-product-list">{detail.notifications.slice(0, 10).map((item) => <p key={item._id}><strong>{item.title || item.event}</strong><span>{item.channel} · {item.status} · {dateTime(item.createdAt)}</span></p>)}</div> : <EmptyText>No customer notifications.</EmptyText>}</Section>
        </>}
        {tab === 'profile' && edit && <>
          <Section title="CRM profile" icon={Tag}><div className="customer-form-grid"><Field label="Acquisition source"><input value={edit.acquisition} maxLength={80} disabled={!canWrite} onChange={(event) => setEdit({ ...edit, acquisition: event.target.value })} /></Field><Field label="Lifecycle"><select value={edit.lifecycleStatus} disabled={!canWrite} onChange={(event) => setEdit({ ...edit, lifecycleStatus: event.target.value })}><option>ACTIVE</option><option>AT_RISK</option><option>INACTIVE</option><option>VIP</option><option>WHOLESALE</option></select></Field><Field label="Birthday"><input type="date" value={dateInput(detail.customer?.birthDate)} disabled title="Customers manage their birthday from their own profile." /></Field><Field label="Anniversary"><input type="date" value={dateInput(edit.anniversaryDate)} disabled={!canWrite} onChange={(event) => setEdit({ ...edit, anniversaryDate: event.target.value })} /></Field><Field label="Follow up on"><input type="datetime-local" value={toLocalInput(edit.followUpAt)} disabled={!canWrite} onChange={(event) => setEdit({ ...edit, followUpAt: event.target.value })} /></Field><Field label="Follow-up note"><input value={edit.followUpNote} maxLength={500} disabled={!canWrite} onChange={(event) => setEdit({ ...edit, followUpNote: event.target.value })} /></Field><Field label="Internal notes" wide><textarea value={edit.notes} maxLength={2000} disabled={!canWrite} onChange={(event) => setEdit({ ...edit, notes: event.target.value })} /></Field></div><p className="customer-field-label">Manual tags</p><div className="customer-tag-editor">{PROFILE_TAGS.map((tag) => <button type="button" disabled={!canWrite} key={tag} className={edit.manualTags.includes(tag) ? 'is-active' : ''} onClick={() => setEdit({ ...edit, manualTags: edit.manualTags.includes(tag) ? edit.manualTags.filter((item) => item !== tag) : [...edit.manualTags, tag] })}>{tag}</button>)}</div><div className="customer-consents"><Consent channel="whatsapp" edit={edit} setEdit={setEdit} disabled={!canWrite} /><Consent channel="sms" edit={edit} setEdit={setEdit} disabled={!canWrite} /><Consent channel="email" edit={edit} setEdit={setEdit} disabled={!canWrite} /></div>{canWrite && <button type="button" className="customer-button customer-button--primary" onClick={saveProfile} disabled={busy === 'profile'}><Check />{busy === 'profile' ? 'Saving...' : 'Save profile'}</button>}</Section>
          {restrictions && <Section title="Store access controls" icon={ShieldAlert}><p className="customer-help">These controls affect only this store. They never block the customer’s account on another store.</p><div className="customer-restrictions"><Toggle label="Restrict checkout" checked={restrictions.checkoutRestricted} set={(value) => setRestrictions({ ...restrictions, checkoutRestricted: value })} disabled={!canWrite} /><Toggle label="Restrict Cash on Delivery" checked={restrictions.codRestricted} set={(value) => setRestrictions({ ...restrictions, codRestricted: value })} disabled={!canWrite} /><Toggle label="Suppress marketing" checked={restrictions.marketingSuppressed} set={(value) => setRestrictions({ ...restrictions, marketingSuppressed: value })} disabled={!canWrite} /><Toggle label="Support watchlist" checked={restrictions.supportWatchlist} set={(value) => setRestrictions({ ...restrictions, supportWatchlist: value })} disabled={!canWrite} /></div><div className="customer-form-grid"><Field label="Reason" wide><textarea value={restrictions.reason} maxLength={500} disabled={!canWrite} onChange={(event) => setRestrictions({ ...restrictions, reason: event.target.value })} /></Field><Field label="Expires on"><input type="datetime-local" value={toLocalInput(restrictions.expiresAt)} disabled={!canWrite} onChange={(event) => setRestrictions({ ...restrictions, expiresAt: event.target.value })} /></Field></div>{canWrite && <button type="button" className="customer-button customer-button--warning" onClick={saveRestrictions} disabled={busy === 'restrictions'}><ShieldAlert />{busy === 'restrictions' ? 'Saving...' : 'Save access controls'}</button>}</Section>}
          <PrivacyRequests requests={edit.privacyRequests || []} type={privacyType} setType={setPrivacyType} resolution={privacyResolution} setResolution={setPrivacyResolution} disabled={!canWrite || busy === 'privacy'} create={() => privacyAction({ action: 'create', customerId: detail.customer.id, type: privacyType })} update={(requestId, status) => privacyAction({ action: 'update', customerId: detail.customer.id, requestId, status, resolution: privacyResolution })} />
        </>}
      </div>
    </>}
  </aside></div>;
}

function RulesModal({ rules, setRules, close, save, busy }) {
  const fields = [['vipSpend', 'VIP net spend (₹)'], ['repeatOrders', 'Repeat buyer orders'], ['inactiveDays', 'Inactive after days'], ['frequentReturnCount', 'Frequent return count'], ['highRtoMinimumOrders', 'Minimum orders for RTO'], ['highRtoRate', 'High RTO rate (0–1)'], ['highValueCart', 'High-value cart (₹)'], ['newCustomerDays', 'New customer window (days)']];
  return <Modal title="Smart segment rules" eyebrow="Store settings" close={close}><p className="customer-help">These thresholds recalculate smart customer signals. Manual tags remain unchanged.</p><div className="customer-form-grid">{fields.map(([key, label]) => <Field key={key} label={label}><input type="number" min="0" step={key === 'highRtoRate' ? '0.05' : '1'} value={rules[key]} onChange={(event) => setRules({ ...rules, [key]: Number(event.target.value) })} /></Field>)}</div><div className="customer-modal-actions"><button type="button" className="customer-button customer-button--soft" onClick={close}>Cancel</button><button type="button" className="customer-button customer-button--primary" onClick={save} disabled={busy}>{busy ? 'Saving...' : 'Save rules'}</button></div></Modal>;
}

function PrivacyRequests({ requests, type, setType, resolution, setResolution, disabled, create, update }) {
  return <Section title="Data privacy requests" icon={ShieldAlert}><p className="customer-help">Track export, correction and deletion requests without deleting orders or legal records automatically.</p><div className="customer-privacy-create"><select aria-label="Privacy request type" value={type} disabled={disabled} onChange={(event) => setType(event.target.value)}><option value="DATA_EXPORT">Data export</option><option value="RECTIFICATION">Data correction</option><option value="DELETION">Account deletion review</option></select><button type="button" className="customer-button customer-button--soft" disabled={disabled} onClick={create}>Register request</button></div>{requests.length ? <div className="customer-privacy-list">{[...requests].reverse().map((request) => <article key={request._id}><div><strong>{privacyLabel(request.type)}</strong><span className={`is-${String(request.status).toLowerCase()}`}>{String(request.status).replaceAll('_', ' ')}</span></div><p>Raised {dateTime(request.createdAt)} · due {date(request.dueAt)}</p>{['OPEN', 'IN_PROGRESS'].includes(request.status) && <div><input value={resolution} disabled={disabled} maxLength={500} placeholder="Resolution required before closing" onChange={(event) => setResolution(event.target.value)} />{request.status === 'OPEN' && <button type="button" disabled={disabled} onClick={() => update(request._id, 'IN_PROGRESS')}>Start</button>}<button type="button" disabled={disabled || !resolution.trim()} onClick={() => update(request._id, 'COMPLETED')}>Complete</button><button type="button" disabled={disabled || !resolution.trim()} onClick={() => update(request._id, 'REJECTED')}>Reject</button></div>}{request.resolution && <small>{request.resolution}</small>}</article>)}</div> : <EmptyText>No privacy requests are open for this customer.</EmptyText>}</Section>;
}

function Modal({ title, eyebrow, close, children }) { return <div className="customer-modal-backdrop" role="dialog" aria-modal="true" aria-label={title}><div className="customer-modal"><header><div><p>{eyebrow}</p><h2>{title}</h2></div><button type="button" onClick={close} aria-label={`Close ${title}`}><X /></button></header><div className="customer-modal__body">{children}</div></div></div>; }
function Section({ title, icon: Icon, children }) { return <section className="customer-detail-section"><h3><Icon />{title}</h3>{children}</section>; }
function EmptyText({ children }) { return <p className="customer-empty-text">{children}</p>; }
function Metric({ icon: Icon, label, value, moneyValue }) { return <div className="customer-metric"><Icon /><span>{label}</span><strong>{moneyValue ? money(value) : value}</strong></div>; }
function Mini({ label, value }) { return <div className="customer-mini"><span>{label}</span><strong>{value ?? '—'}</strong></div>; }
function Field({ label, children, wide }) { return <label className={`customer-field ${wide ? 'is-wide' : ''}`}><span>{label}</span>{children}</label>; }
function Toggle({ label, checked, set, disabled }) { return <label className="customer-toggle"><input type="checkbox" checked={Boolean(checked)} disabled={disabled} onChange={(event) => set(event.target.checked)} /><span><i />{label}</span></label>; }
function Consent({ channel, edit, setEdit, disabled }) { const current = edit.channelConsents[channel] || { granted: false, source: 'MANUAL', reference: '' }; return <div className="customer-consent"><Toggle label={`${channel[0].toUpperCase()}${channel.slice(1)} consent`} checked={current.granted} disabled={disabled} set={(granted) => setEdit({ ...edit, channelConsents: { ...edit.channelConsents, [channel]: { ...current, granted, source: granted ? current.source || 'MANUAL' : '' } } })} />{current.granted && <input aria-label={`${channel} consent reference`} disabled={disabled} value={current.reference || ''} maxLength={240} placeholder="Consent reference (optional)" onChange={(event) => setEdit({ ...edit, channelConsents: { ...edit.channelConsents, [channel]: { ...current, reference: event.target.value } } })} />}</div>; }
function TagList({ tags = [], all = false }) { const shown = all ? tags : tags.slice(0, 3); return <div className="customer-tags">{shown.map((tag) => <span key={tag} className={tag.includes('Restricted') || tag === 'High RTO' ? 'is-warning' : tag === 'VIP' ? 'is-vip' : ''}>{tag}</span>)}{!all && tags.length > 3 && <span>+{tags.length - 3}</span>}{!tags.length && <small>No signals yet</small>}</div>; }
function InsightList({ title, values = [] }) { return values?.length ? <div className="customer-insight"><strong>{title}</strong><p>{values.map((item) => `${item.value} (${item.count})`).join(' · ')}</p></div> : null; }
function Pagination({ page, pages, total, change }) { if (pages <= 1) return null; return <div className="customer-pagination"><span>Page {page} of {pages} · {total} records</span><div><button type="button" onClick={() => change(Math.max(1, page - 1))} disabled={page <= 1}><ChevronLeft /> Previous</button><button type="button" onClick={() => change(Math.min(pages, page + 1))} disabled={page >= pages}>Next <ChevronRight /></button></div></div>; }
function Notice({ value, close }) { return <div role={value.type === 'error' ? 'alert' : 'status'} className={`customer-notice is-${value.type || 'info'}`}><span>{value.type === 'error' ? <AlertTriangle /> : <Check />}</span><p>{value.message}</p><button type="button" onClick={close} aria-label="Dismiss message"><X /></button></div>; }
function profileForm(profile = {}) { return { revision: profile.revision || 0, manualTags: [...(profile.manualTags || [])], notes: profile.notes || '', acquisition: profile.acquisition || '', lifecycleStatus: profile.lifecycleStatus || 'ACTIVE', anniversaryDate: profile.anniversaryDate || '', followUpAt: profile.followUpAt || '', followUpNote: profile.followUpNote || '', privacyRequests: profile.privacyRequests || [], channelConsents: { whatsapp: { granted: Boolean(profile.channelConsents?.whatsapp?.granted || profile.marketingConsent), source: profile.channelConsents?.whatsapp?.source || profile.marketingConsentSource || 'MANUAL', reference: profile.channelConsents?.whatsapp?.reference || '' }, sms: { granted: Boolean(profile.channelConsents?.sms?.granted), source: profile.channelConsents?.sms?.source || 'MANUAL', reference: profile.channelConsents?.sms?.reference || '' }, email: { granted: Boolean(profile.channelConsents?.email?.granted), source: profile.channelConsents?.email?.source || 'MANUAL', reference: profile.channelConsents?.email?.reference || '' } } }; }
function restrictionForm(value = {}) { return { checkoutRestricted: Boolean(value.checkoutRestricted), codRestricted: Boolean(value.codRestricted), marketingSuppressed: Boolean(value.marketingSuppressed), supportWatchlist: Boolean(value.supportWatchlist), reason: value.reason || '', expiresAt: value.expiresAt || '' }; }
function initials(name = '') { return String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'CU'; }
function money(value) { return `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`; }
function date(value) { return value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'No order yet'; }
function dateTime(value) { return value ? new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'; }
function dateInput(value) { if (!value) return ''; const current = new Date(value); return Number.isFinite(current.getTime()) ? current.toISOString().slice(0, 10) : ''; }
function toLocalInput(value) { if (!value) return ''; const current = new Date(value); if (!Number.isFinite(current.getTime())) return ''; const local = new Date(current.getTime() - current.getTimezoneOffset() * 60000); return local.toISOString().slice(0, 16); }
function isFullContact(value) { return value && !String(value).includes('•') && String(value).replace(/\D/g, '').length >= 10; }
function readSavedViews(seller) { try { return JSON.parse(localStorage.getItem(`samira_customer_views_${seller ? 'seller' : 'admin'}`) || '[]'); } catch { return []; } }
function persistViews(seller, views) { try { localStorage.setItem(`samira_customer_views_${seller ? 'seller' : 'admin'}`, JSON.stringify(views)); } catch { /* Storage may be disabled. */ } }
function readColumns(seller) { const fallback = { orders: true, spend: true, risk: true, activity: true, signals: true }; try { return { ...fallback, ...JSON.parse(localStorage.getItem(`samira_customer_columns_${seller ? 'seller' : 'admin'}`) || '{}') }; } catch { return fallback; } }
function persistColumns(seller, columns) { try { localStorage.setItem(`samira_customer_columns_${seller ? 'seller' : 'admin'}`, JSON.stringify(columns)); } catch { /* Storage may be disabled. */ } }
function scopedPath(path, storeSlug, params) { const query = new URLSearchParams(params || {}); if (storeSlug) query.set('store', storeSlug); const suffix = query.toString(); return suffix ? `${path}?${suffix}` : path; }
function privacyLabel(value) { return ({ DATA_EXPORT: 'Data export', RECTIFICATION: 'Data correction', DELETION: 'Account deletion review' })[value] || value; }
function downloadCsv(filename, rows) { const columns = rows.length ? Object.keys(rows[0]) : []; const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`; const csv = [columns.map(escape).join(','), ...rows.map((row) => columns.map((key) => escape(row[key])).join(','))].join('\r\n'); const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = filename || 'customers.csv'; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); }
