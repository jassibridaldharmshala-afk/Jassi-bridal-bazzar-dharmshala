import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight, BarChart3, CalendarDays, ChevronDown, Download, FileText, Filter,
  Info, Package, RefreshCw, Save, Send, ShoppingBag, Trash2, TrendingDown, Globe2,
  TrendingUp, Truck, Users, WalletCards, X,
} from 'lucide-react';
import PageHeader from '../../components/admin/PageHeader';
import PageState from '../../components/ui/PageState';
import { useAuth } from '../../context/AuthContext';
import { normalizeImageUrl } from '../../services/normalize';
import api from '../../services/api';
import { downloadReportPdf, downloadTextFile } from '../../utils/reportExport';
import './Reports.css';
import TrafficReport from '../../components/admin/TrafficReport';

const REPORT_SECTIONS = ['summary', 'products', 'customers', 'marketing', 'fulfillment', 'traffic'];
const ranges = [['today', 'Today'], ['yesterday', 'Yesterday'], ['7d', '7 days'], ['30d', '30 days'], ['month', 'This month'], ['90d', '90 days'], ['custom', 'Custom']];
const tabs = [
  ['overview', 'Overview', BarChart3], ['finance', 'Sales & finance', WalletCards],
  ['products', 'Products & inventory', Package], ['customers', 'Customers', Users],
  ['marketing', 'Marketing', TrendingUp], ['fulfillment', 'Shipping & returns', Truck],
  ['traffic', 'Traffic & visitors', Globe2],
];
const tabSection = { overview: 'summary', finance: 'summary', products: 'products', customers: 'customers', marketing: 'marketing', fulfillment: 'fulfillment', traffic: 'traffic' };
const todayForTimezone = (timezone = 'Asia/Kolkata') => {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date());
    const value = Object.fromEntries(parts.filter(item => item.type !== 'literal').map(item => [item.type, item.value]));
    return `${value.year}-${value.month}-${value.day}`;
  } catch { return new Date().toISOString().slice(0, 10); }
};
const money = (value, currency = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value || 0));
const number = (value, digits = 1) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: Number.isInteger(digits) ? digits : 1 }).format(Number(value || 0));
const dateTime = value => value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

function cleanFilters(filters) {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== '' && value != null));
}

export default function Reports({ route = '/admin/reports' }) {
  const isSeller = route.startsWith('/seller');
  const base = isSeller ? '/seller' : '/admin';
  const { notify } = useAuth() || {};
  const [activeTab, setActiveTab] = useState(route.endsWith('/traffic') ? 'traffic' : 'overview');
  const [filters, setFilters] = useState({ range: route.endsWith('/traffic') ? 'today' : '30d' });
  const [draft, setDraft] = useState({ range: route.endsWith('/traffic') ? 'today' : '30d' });
  const [options, setOptions] = useState(null);
  const [sections, setSections] = useState({});
  const [loading, setLoading] = useState({});
  const [errors, setErrors] = useState({});
  const [savedViews, setSavedViews] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [editingView, setEditingView] = useState(null);
  const [exporting, setExporting] = useState('');
  const [reload, setReload] = useState(0);
  const requestVersion = useRef(0);

  const query = useMemo(() => new URLSearchParams(cleanFilters(filters)).toString(), [filters]);
  const scopeQuery = useMemo(() => new URLSearchParams(cleanFilters({ scope: filters.scope, store: filters.store })).toString(), [filters.scope, filters.store]);
  const currency = sections.summary?.currency || options?.currentStore?.currency || 'INR';
  const maximumDate = todayForTimezone((activeTab === 'traffic' ? sections.traffic?.timezone : sections.summary?.timezone) || options?.timezone || options?.currentStore?.timezone);
  const capabilities = options?.capabilities || sections.summary?.capabilities || {};
  const permittedSections = useMemo(() => REPORT_SECTIONS.filter((section) => capabilities.sections?.[section] !== false), [capabilities.sections]);
  const visibleTabs = useMemo(() => tabs.filter(([value]) => permittedSections.includes(tabSection[value])), [permittedSections]);

  const loadOptions = useCallback(() => {
    let active = true;
    api.get(`${base}/reports/options?${query}`, { silent: true, cache: 'no-store' })
      .then((data) => { if (active) setOptions(data); })
      .catch((error) => { if (active) notify?.(error.message, 'error', 'Reports'); });
    api.get(`${base}/reports/views?${scopeQuery}`, { silent: true, cache: 'no-store' })
      .then((data) => { if (active) setSavedViews(data.items || []); })
      .catch(() => { if (active) setSavedViews([]); });
    return () => { active = false; };
  }, [base, notify, query, scopeQuery]);

  useEffect(() => loadOptions(), [loadOptions]);
  useEffect(() => { if (route.split('?')[0].endsWith('/traffic')) { setActiveTab('traffic'); setFilters({ range: 'today' }); setDraft({ range: 'today' }); } }, [route]);
  useEffect(() => {
    if (activeTab !== 'traffic' || capabilities.sections?.traffic === false) return undefined;
    let active = true; const controller = new AbortController();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      api.get(`${base}/reports/center/traffic?${query}`, { silent: true, cache: 'no-store', signal: controller.signal })
        .then(data => { if (active) { setSections(current => ({ ...current, traffic: data })); setErrors(current => ({ ...current, traffic: '' })); } })
        .catch(error => { if (active && error.name !== 'AbortError') setErrors(current => ({ ...current, traffic: error.message })); });
    }, 30000);
    return () => { active = false; controller.abort(); window.clearInterval(timer); };
  }, [activeTab, base, query, capabilities.sections?.traffic]);

  useEffect(() => {
    const version = ++requestVersion.current;
    const requestedSections = permittedSections.length ? permittedSections : REPORT_SECTIONS;
    const controllers = requestedSections.map(() => new AbortController());
    setLoading(Object.fromEntries(requestedSections.map((section) => [section, true])));
    setErrors({});
    requestedSections.forEach((section, index) => {
      api.get(`${base}/reports/center/${section}?${query}`, { silent: true, cache: 'no-store', signal: controllers[index].signal })
        .then((data) => { if (version === requestVersion.current) setSections((old) => ({ ...old, [section]: data })); })
        .catch((error) => { if (version === requestVersion.current && error?.name !== 'AbortError') setErrors((old) => ({ ...old, [section]: error.message })); })
        .finally(() => { if (version === requestVersion.current) setLoading((old) => ({ ...old, [section]: false })); });
    });
    return () => { requestVersion.current += 1; controllers.forEach((controller) => controller.abort()); };
  }, [base, permittedSections, query, reload]);

  useEffect(() => {
    if (visibleTabs.length && !visibleTabs.some(([value]) => value === activeTab)) setActiveTab(visibleTabs[0][0]);
  }, [activeTab, visibleTabs]);

  const applyFilters = (event) => {
    event?.preventDefault();
    if (draft.range === 'custom' && (!draft.from || !draft.to || draft.from > draft.to || draft.to > maximumDate)) {
      notify?.('Choose a valid start and end date up to today.', 'error', 'Reports'); return;
    }
    const next = cleanFilters(draft);
    if (next.range !== 'custom') { delete next.from; delete next.to; }
    setFilters(next); setShowFilters(false);
  };

  const chooseRange = (range) => {
    const next = { ...draft, range };
    setDraft(next);
    if (range !== 'custom') {
      delete next.from; delete next.to;
      setFilters(cleanFilters(next));
    }
  };

  const exportReport = async (type) => {
    setExporting(type);
    try {
      const result = await api.post(`${base}/reports/export?${scopeQuery}`, { filters, sections: activeTab === 'traffic' ? ['traffic'] : permittedSections }, { silent: true });
      if (type === 'csv') downloadTextFile(result.csv, result.filename);
      else await downloadReportPdf(result.bundle, result.filename);
      notify?.(`${type.toUpperCase()} report downloaded.`, 'success', 'Reports');
    } catch (error) { notify?.(error.message, 'error', 'Reports'); }
    finally { setExporting(''); }
  };

  const removeView = async (id) => {
    try {
      await api.delete(`${base}/reports/views/${id}?${scopeQuery}`);
      setSavedViews((items) => items.filter((item) => item.id !== id));
      notify?.('Saved report removed.', 'success', 'Reports');
    } catch (error) { notify?.(error.message, 'error', 'Reports'); }
  };

  const applyView = (view) => { setDraft(view.filters || { range: '30d' }); setFilters(view.filters || { range: '30d' }); };
  const sendView = async (view) => {
    try {
      const sent = await api.post(`${base}/reports/views/${view.id}/run?${scopeQuery}`, {});
      setSavedViews((items) => items.map((item) => item.id === sent.id ? sent : item));
      notify?.('Report emailed to the saved recipient.', 'success', 'Reports');
    } catch (error) { notify?.(error.message, 'error', 'Reports'); }
  };
  const currentSection = tabSection[activeTab];
  const rangeInfo = sections[currentSection]?.range || sections.summary?.range;
  const activeFilters = Object.entries(filters).filter(([key, value]) => !['range', 'from', 'to', 'scope', 'store'].includes(key) && value);

  return <section className="report-center">
    <PageHeader title="Reports & Insights" kicker={isSeller ? 'Seller' : 'Admin'} note="Accurate store performance, finance, customers, marketing, inventory and delivery data in one place.">
      <button type="button" className="admin-btn-ghost" onClick={() => setReload((value) => value + 1)} disabled={Object.values(loading).some(Boolean)}><RefreshCw size={16} className={Object.values(loading).some(Boolean) ? 'animate-spin' : ''} /> Refresh</button>
    </PageHeader>

    <section className="report-toolbar admin-card">
      <div className="report-range" aria-label="Report period">{ranges.map(([value, label]) => <button type="button" key={value} aria-pressed={draft.range === value} onClick={() => chooseRange(value)}>{label}</button>)}</div>
      <div className="report-toolbar__actions">
        <button type="button" className="admin-btn-ghost" onClick={() => setShowFilters((value) => !value)}><Filter size={16} /> Filters{activeFilters.length ? ` (${activeFilters.length})` : ''}<ChevronDown size={15} /></button>
        {capabilities.canManage && <button type="button" className="admin-btn-ghost" onClick={() => { setEditingView(null); setSaveOpen(true); }}><Save size={16} /> Save view</button>}
        {capabilities.canExport && <><button type="button" className="admin-btn-ghost" disabled={!!exporting} onClick={() => exportReport('csv')}><Download size={16} /> {exporting === 'csv' ? 'Preparing…' : 'CSV'}</button><button type="button" className="admin-btn-primary" disabled={!!exporting} onClick={() => exportReport('pdf')}><FileText size={16} /> {exporting === 'pdf' ? 'Preparing…' : 'PDF report'}</button></>}
      </div>
      {draft.range === 'custom' && <form className="report-custom" onSubmit={applyFilters}><label>From<input type="date" max={maximumDate} value={draft.from || ''} onChange={(event) => setDraft({ ...draft, from: event.target.value })} /></label><label>To<input type="date" min={draft.from} max={maximumDate} value={draft.to || ''} onChange={(event) => setDraft({ ...draft, to: event.target.value })} /></label><button className="admin-btn-primary" type="submit">Apply dates</button></form>}
      {showFilters && <FilterPanel values={draft} setValues={setDraft} options={options || {}} showStore={!isSeller} onApply={applyFilters} onClear={() => { const value = { range: draft.range || '30d' }; setDraft(value); setFilters(value); setShowFilters(false); }} />}
      <div className="report-context">
        <span className="report-live"><i />Live store data</span>
        <span>{rangeInfo ? `${rangeInfo.fromDate} to ${rangeInfo.toDate}` : 'Loading period…'}</span>
        <span>{sections.summary?.timezone || options?.currentStore?.timezone || 'Asia/Kolkata'}</span>
        {sections.summary?.generatedAt && <span>Updated {dateTime(sections.summary.generatedAt)}</span>}
        {options?.currentStore?.name && <span>{options.currentStore.name}</span>}
      </div>
      {!!activeFilters.length && <div className="report-chips">{activeFilters.map(([key, value]) => <button type="button" key={key} onClick={() => { const next = { ...draft }; delete next[key]; setDraft(next); setFilters(cleanFilters(next)); }}>{key}: {value}<X size={12} /></button>)}</div>}
    </section>

    {!!savedViews.length && <section className="report-saved" aria-label="Saved reports"><strong>Saved reports</strong>{savedViews.map((view) => <span key={view.id}><button type="button" onClick={() => applyView(view)} title={view.schedule?.lastStatus ? `Last email: ${view.schedule.lastStatus}` : ''}>{view.name}{view.schedule?.enabled ? ` · ${view.schedule.frequency.toLowerCase()}` : ''}</button>{capabilities.canManage && <button type="button" aria-label={`Manage ${view.name}`} onClick={() => { setEditingView(view); setSaveOpen(true); }}><CalendarDays size={13} /></button>}{capabilities.canSchedule && view.schedule?.recipient && <button type="button" aria-label={`Email ${view.name} now`} onClick={() => sendView(view)}><Send size={13} /></button>}{capabilities.canManage && <button type="button" aria-label={`Delete ${view.name}`} onClick={() => removeView(view.id)}><Trash2 size={13} /></button>}</span>)}</section>}

    <nav className="report-tabs" aria-label="Report sections">{visibleTabs.map(([value, label, Icon]) => <button key={value} type="button" aria-current={activeTab === value ? 'page' : undefined} onClick={() => setActiveTab(value)}><Icon size={17} />{label}</button>)}</nav>

    <SectionState loading={loading[currentSection]} error={errors[currentSection]} retry={() => setReload((value) => value + 1)}>
      {activeTab === 'overview' && <Overview data={sections.summary?.data} currency={currency} base={base} />}
      {activeTab === 'finance' && <Finance data={sections.summary?.data} currency={currency} base={base} />}
      {activeTab === 'products' && <ProductsReport data={sections.products?.data} currency={currency} base={base} canViewProfit={sections.products?.capabilities?.canViewProfit} />}
      {activeTab === 'customers' && <CustomersReport data={sections.customers?.data} currency={currency} />}
      {activeTab === 'marketing' && <MarketingReport data={sections.marketing?.data} currency={currency} />}
      {activeTab === 'fulfillment' && <FulfillmentReport data={sections.fulfillment?.data} currency={currency} base={base} />}
      {activeTab === 'traffic' && <TrafficReport data={sections.traffic?.data} base={base} currency={currency} />}
    </SectionState>

    {saveOpen && <SaveDialog initial={editingView} customRange={filters.range === 'custom'} onClose={() => { setSaveOpen(false); setEditingView(null); }} onSave={async (payload) => {
      try {
        const body = { ...payload, filters, sections: activeTab === 'traffic' ? ['traffic'] : permittedSections };
        const view = editingView ? await api.put(`${base}/reports/views/${editingView.id}?${scopeQuery}`, body) : await api.post(`${base}/reports/views?${scopeQuery}`, body);
        setSavedViews((items) => editingView ? items.map((item) => item.id === view.id ? view : item) : [view, ...items]);
        setSaveOpen(false); setEditingView(null); notify?.(editingView ? 'Saved report updated.' : 'Report view saved.', 'success', 'Reports');
      }
      catch (error) { notify?.(error.message, 'error', 'Reports'); }
    }} canSchedule={capabilities.canSchedule} />}
  </section>;
}

function SectionState({ loading, error, retry, children }) {
  if (loading) return <PageState loading loadingLabel="Preparing this report…" />;
  if (error) return <PageState error={error} onRetry={retry} />;
  return children;
}

function FilterPanel({ values, setValues, options, showStore, onApply, onClear }) {
  const field = (key, label, items, valueKey = 'id', labelKey = 'name') => <label>{label}<select value={values[key] || ''} onChange={(event) => setValues({ ...values, [key]: event.target.value })}><option value="">All</option>{(items || []).map((item) => typeof item === 'string' ? <option key={item} value={item}>{item}</option> : <option key={item[valueKey]} value={item[valueKey]}>{item[labelKey]}{item.sku ? ` · ${item.sku}` : ''}</option>)}</select></label>;
  return <form className="report-filter-panel" onSubmit={onApply}>
    {showStore && options.stores?.length > 0 && <label>Store<select value={values.scope === 'all' ? '__all' : values.store || ''} onChange={(event) => event.target.value === '__all' ? setValues({ ...values, scope: 'all', store: '' }) : setValues({ ...values, scope: '', store: event.target.value })}><option value="">Current store</option><option value="__all">All managed stores</option>{options.stores.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}</select></label>}
    {field('product', 'Product', options.products)}{field('category', 'Category', options.categories)}
    {field('status', 'Order status', options.statuses)}{field('paymentMethod', 'Payment method', options.paymentMethods)}
    {field('coupon', 'Coupon', options.coupons, 'code', 'code')}{field('campaign', 'Campaign', options.campaigns)}
    {field('source', 'Source', options.sources)}{field('city', 'City', options.cities)}{field('provider', 'Courier', options.providers)}
    {field('device', 'Traffic device', ['mobile', 'desktop', 'tablet'])}{field('browser', 'Traffic browser', ['Chrome', 'Safari', 'Firefox', 'Edge', 'Opera', 'Other'])}
    <label>PIN code<input inputMode="numeric" maxLength={6} placeholder="All PIN codes" value={values.pincode || ''} onChange={(event) => setValues({ ...values, pincode: event.target.value.replace(/\D/g, '').slice(0, 6) })} /></label>
    <div className="report-filter-actions"><button type="button" className="admin-btn-ghost" onClick={onClear}>Clear</button><button type="submit" className="admin-btn-primary">Apply filters</button></div>
  </form>;
}

function Overview({ data, currency, base }) {
  if (!data) return <Empty text="No overview data is available." />;
  const cards = [
    ['Booked order value', 'bookedValue', money, ShoppingBag, `${base}/orders`], ['Net sales revenue', 'recognizedRevenue', money, WalletCards, `${base}/orders?paymentStatus=Paid`],
    ['Valid orders', 'orders', number, Package, `${base}/orders`], ['Average order value', 'averageOrderValue', money, TrendingUp, `${base}/orders`],
    ['Buying customers', 'customers', number, Users, base === '/seller' ? `${base}/crm` : `${base}/customers`], ['Units ordered', 'units', number, Package, `${base}/products`],
  ];
  return <div className="report-section">
    <div className="report-kpis">{cards.map(([label, key, formatter, Icon, href]) => <Kpi key={key} label={label} metric={data.metrics?.[key]} value={formatter(data.metrics?.[key]?.value, currency)} Icon={Icon} href={href} />)}</div>
    <div className="report-grid-2"><Panel title="Collections and refund trend" note="Successful non-cancelled payments and recorded refunds by order date."><TrendChart rows={data.series || []} currency={currency} /></Panel><Panel title="Order status" note="Includes every order created in this period."><Distribution rows={data.statusBreakdown || []} total={data.current?.allOrders} link={label => `${base}/orders?status=${encodeURIComponent(label)}`} /></Panel></div>
    <div className="report-grid-2"><Panel title="Payment mix" note="Valid orders by payment method."><Distribution rows={data.paymentBreakdown || []} total={data.current?.orders} /></Panel><Insights data={data} currency={currency} base={base} /></div>
  </div>;
}

function Finance({ data, currency, base }) {
  if (!data) return <Empty text="No finance data is available." />;
  const current = data.current || {};
  const rows = [
    ['Gross MRP', current.grossSales], ['Product discount', -current.productDiscount], ['Coupon discount', -current.couponDiscount], ['Prepaid discount', -current.prepaidDiscount],
    ['Merchandise selling value', current.merchandiseSales], ['Delivery charge', current.deliveryCharge], ['COD charge', current.codCharge], ['Platform fee', current.platformFee], ['Tax recorded', current.tax],
    ['Booked order value', current.bookedValue], ['Payments collected', current.paymentCollected], ['Refunds recorded', -current.refunds], ['Net collected', current.netCollected],
  ];
  return <div className="report-section"><div className="report-kpis"><Kpi label="Gross sales" metric={data.metrics?.grossSales} value={money(current.grossSales, currency)} Icon={TrendingUp} /><Kpi label="Total discounts" metric={data.metrics?.discounts} value={money(current.discounts, currency)} Icon={TrendingDown} /><Kpi label="Refunds" metric={data.metrics?.refunds} value={money(current.refunds, currency)} Icon={TrendingDown} href={`${base}/returns`} /><Kpi label="Recognized revenue" metric={data.metrics?.recognizedRevenue} value={money(current.recognizedRevenue, currency)} Icon={WalletCards} /></div>
    <div className="report-grid-2"><Panel title="Gross-to-net reconciliation" note="All figures use the selected order-date period."><div className="report-reconcile">{rows.map(([label, value], index) => <div className={index >= rows.length - 2 ? 'is-total' : ''} key={label}><span>{label}</span><strong className={value < 0 ? 'is-negative' : ''}>{money(value, currency)}</strong></div>)}</div></Panel><Panel title="Metric definitions" note="Use these definitions when matching reports with payment or accounting data."><Definitions items={data.definitions} /><div className="report-health"><Info size={17} /><p>Cost coverage: <strong>{number(current.costCoverage)}%</strong>. Profit is an estimate when an older order has no checkout-time cost snapshot.</p></div></Panel></div>
  </div>;
}

function ProductsReport({ data, currency, base, canViewProfit }) {
  if (!data) return <Empty text="No product report data is available." />;
  const inventory = data.inventory || {};
  return <div className="report-section">
    <div className="report-kpis"><PlainKpi label="Catalog products" value={number(inventory.products)} Icon={Package} /><PlainKpi label="Available units" value={number(inventory.units)} Icon={Package} /><PlainKpi label="Retail inventory value" value={money(inventory.valueAtRetail, currency)} Icon={WalletCards} />{canViewProfit && <PlainKpi label="Inventory at cost" value={money(inventory.valueAtCost, currency)} Icon={WalletCards} />}<PlainKpi label="Low / out of stock" value={`${number(inventory.lowStock)} / ${number(inventory.outOfStock)}`} Icon={TrendingDown} /><PlainKpi label="Stock aged 90+ days" value={`${number(inventory.agedUnits)} units · ${number(inventory.agedProducts)} products`} Icon={TrendingDown} /></div>
    <Panel title="Product performance" note="Ranked by net units after recorded returns, then net product sales. Open a product to review or edit it."><ResponsiveTable headers={['#', 'Product', 'Category', 'Gross / net units', 'Orders', 'Net sales', ...(canViewProfit ? ['Profit / margin'] : []), 'Returns']} rows={(data.items || []).map((item, index) => [index + 1, <ProductCell item={item} base={base} />, item.category || '—', `${number(item.units)} / ${number(item.netUnits)}`, number(item.orders), money(item.itemRevenue, currency), ...(canViewProfit ? [`${money(item.estimatedProfit, currency)} · ${number(item.estimatedMargin)}%`] : []), `${number(item.returnedUnits)} · ${number(item.returnRate)}%`])} empty="No products were sold in this period." /></Panel>
    <div className="report-grid-2"><Panel title="Slow-moving stock" note="In-stock products with no valid sales in this period."><SimpleList rows={data.slowMoving || []} primary="name" secondary={item => `${item.sku || 'No SKU'} · ${number(item.available)} available`} value={item => money(Number(item.available) * Number(item.price), currency)} /></Panel><Panel title="Stockout exposure" note="Customer product views recorded while the current product is sold out."><SimpleList rows={data.stockoutExposure || []} primary="name" secondary={item => item.sku || 'No SKU'} value={item => `${number(item.views)} views`} /></Panel></div>
  </div>;
}

function CustomersReport({ data, currency }) {
  if (!data) return <Empty text="No customer report data is available." />;
  const summary = data.summary || {};
  return <div className="report-section"><div className="report-kpis"><PlainKpi label="Buying customers" value={number(summary.buyingCustomers)} Icon={Users} /><PlainKpi label="New customers" value={number(summary.newCustomers)} Icon={Users} /><PlainKpi label="Returning customers" value={number(summary.returningCustomers)} Icon={Users} /><PlainKpi label="Repeat rate" value={`${number(summary.repeatRate)}%`} Icon={TrendingUp} /><PlainKpi label="Average customer value" value={money(summary.averageCustomerValue, currency)} Icon={WalletCards} /></div>
    <div className="report-grid-2"><Panel title="Top customers" note="Period and lifetime spend are net of recorded refunds."><ResponsiveTable headers={['Customer', 'Type', 'Period orders', 'Net spend', 'AOV', 'Lifetime orders', 'Lifetime value']} rows={(data.topCustomers || []).map(item => [item.name, <Badge>{item.type}</Badge>, number(item.orders), money(item.netSpend, currency), money(item.averageOrderValue, currency), number(item.lifetimeOrders), money(item.lifetimeValue, currency)])} empty="No signed-in customers bought in this period." /></Panel><Panel title="Customer locations" note="Grouped from delivery addresses on matching orders."><ResponsiveTable headers={['City', 'State / PIN', 'Customers', 'Orders', 'Revenue']} rows={(data.locations || []).map(item => [item.city, `${item.state || '—'} · ${item.pincode || '—'}`, number(item.customers), number(item.orders), money(item.revenue, currency)])} empty="No location data is available." /></Panel></div>
  </div>;
}

function MarketingReport({ data, currency }) {
  if (!data) return <Empty text="No marketing data is available." />;
  return <div className="report-section"><div className="report-kpis"><PlainKpi label="Store conversion" value={`${number(data.conversionRate)}%`} Icon={TrendingUp} /><PlainKpi label="Tracked sources" value={number(data.sources?.length)} Icon={BarChart3} /><PlainKpi label="Attributed orders" value={number((data.attribution || []).reduce((sum, item) => sum + item.orders, 0))} Icon={ShoppingBag} /><PlainKpi label="Coupon orders" value={number((data.coupons || []).reduce((sum, item) => sum + item.orders, 0))} Icon={WalletCards} /></div>
    <Panel title="Storefront funnel" note="First-party activity recorded by this application."><Funnel rows={data.funnel || []} /></Panel>
    <Panel title="Mobile home engagement" note="Section visibility and taps recorded on the mobile storefront home screen."><ResponsiveTable headers={['Interaction', 'Section / category', 'Action', 'Count']} rows={(data.homeEngagement || []).map(item => [homeEventLabel(item.event), item.category || item.section || (item.milestone ? `${item.milestone}% scroll depth` : 'Home'), item.action || '—', number(item.value)])} empty="No mobile home engagement has been recorded in this period." /></Panel>
    <div className="report-grid-2"><Panel title="Campaign and social attribution" note="Orders carrying a source, campaign or reel reference."><ResponsiveTable headers={['Source', 'Campaign / reel', 'Orders', 'Customers', 'Revenue']} rows={(data.attribution || []).map(item => [item.source || 'Direct', item.campaign || item.reelId || '—', number(item.orders), number(item.customers), money(item.revenue, currency)])} empty="No attributed orders in this period." /></Panel><Panel title="Coupon performance" note="Compare generated value with the discount granted."><ResponsiveTable headers={['Coupon', 'Orders', 'Discount', 'Revenue', 'Revenue / ₹1']} rows={(data.coupons || []).map(item => [item.code, number(item.orders), money(item.discount, currency), money(item.revenue, currency), item.returnOnDiscount == null ? '—' : number(item.returnOnDiscount)])} empty="No coupons were used." /></Panel></div>
    <Panel title="Banner performance" note={data.note}><ResponsiveTable headers={['Banner / campaign', 'Impressions', 'Clicks', 'CTR']} rows={(data.banners || []).map(item => [item.campaign || item.bannerId || 'Banner', number(item.impressions), number(item.clicks), `${number(item.ctr)}%`])} empty="No banner tracking data in this period." /></Panel>
  </div>;
}

function homeEventLabel(event) {
  return ({ HOME_SECTION_VIEW: 'Section viewed', HOME_PRODUCT_CLICK: 'Product tap', HOME_CATEGORY_CLICK: 'Category tap', HOME_VIEW_ALL: 'View all tap', HOME_SCROLL: 'Scroll depth' })[event] || String(event || '').replaceAll('_', ' ').toLowerCase();
}

function FulfillmentReport({ data, currency, base }) {
  if (!data) return <Empty text="No shipping report data is available." />;
  const summary = data.summary || {};
  return <div className="report-section"><div className="report-kpis"><PlainKpi label="Waiting for shipment" value={number(summary.waitingForShipment)} Icon={Package} href={`${base}/orders?deliveryStatus=WAITING`} /><PlainKpi label="Delayed shipments" value={number(summary.delayed)} Icon={Truck} /><PlainKpi label="Delivery time" value={summary.averageDeliveryHours == null ? '—' : `${number(summary.averageDeliveryHours)} hrs`} Icon={Truck} /><PlainKpi label="RTO shipments" value={number(summary.rto)} Icon={TrendingDown} /><PlainKpi label="COD outstanding" value={money(summary.codOutstandingAmount, currency)} Icon={WalletCards} /></div>
    <div className="report-grid-2"><Panel title="Courier performance" note="Shipment outcomes and provider-recorded charges."><ResponsiveTable headers={['Courier', 'Shipments', 'Delivered', 'Delivery rate', 'RTO rate', 'Exceptions', 'Cost']} rows={(data.providers || []).map(item => [item.provider, number(item.shipments), number(item.delivered), `${number(item.deliveryRate)}%`, `${number(item.rtoRate)}%`, number(item.exceptions), money(item.charge, currency)])} empty="No shipments were created in this period." /></Panel><Panel title="Returns & refunds" note="Requests are grouped by request date."><div className="report-reconcile"><div><span>Return requests</span><strong>{number(summary.returnRequests)}</strong></div><div><span>Returns / exchanges</span><strong>{number(summary.returns)} / {number(summary.exchanges)}</strong></div><div><span>Refunded amount</span><strong>{money(summary.refunded, currency)}</strong></div><div><span>Refunds pending</span><strong>{number(summary.refundPending)}</strong></div><div><span>Overdue requests</span><strong>{number(summary.overdueReturns)}</strong></div><div><span>Shipping collected</span><strong>{money(summary.shippingCollected, currency)}</strong></div><div><span>Carrier cost recorded</span><strong>{money(summary.carrierCost, currency)}</strong></div><div className="is-total"><span>Average resolution</span><strong>{summary.averageResolutionHours == null ? '—' : `${number(summary.averageResolutionHours)} hrs`}</strong></div></div></Panel></div>
    <div className="report-grid-2"><Panel title="Shipment statuses"><Distribution rows={data.shipmentStatuses || []} total={summary.shipments} /></Panel><Panel title="Return statuses"><Distribution rows={data.returnStatuses || []} total={summary.returnRequests} /></Panel></div>
  </div>;
}

function Kpi({ label, metric, value, Icon, href }) {
  const delta = metric?.delta;
  const content = <><div className="report-kpi__top"><span>{label}</span><Icon size={18} /></div><strong>{value}</strong><small className={delta > 0 ? 'is-up' : delta < 0 ? 'is-down' : ''}>{delta == null ? 'No previous value' : `${delta > 0 ? '+' : ''}${number(delta)}% vs previous period`}</small>{href && <em>Open details <ArrowRight size={13} /></em>}</>;
  return href ? <a className="report-kpi admin-card" href={href}>{content}</a> : <article className="report-kpi admin-card">{content}</article>;
}
function PlainKpi({ label, value, Icon, href }) { return <Kpi label={label} value={value} Icon={Icon} href={href} />; }
function Panel({ title, note, children }) { return <section className="report-panel admin-card"><header><div><h2>{title}</h2>{note && <p>{note}</p>}</div></header>{children}</section>; }
function Badge({ children }) { return <span className="report-badge">{children}</span>; }
function Empty({ text }) { return <div className="report-empty"><Package size={24} /><p>{text}</p></div>; }

function TrendChart({ rows, currency }) {
  if (!rows.length) return <Empty text="No paid revenue was recorded in this period." />;
  const max = Math.max(1, ...rows.map(item => Math.max(Number(item.revenue || 0), Number(item.refunds || 0))));
  const width = 720; const height = 220; const pad = 24;
  const points = field => rows.map((item, index) => ({
    x: pad + (index * (width - pad * 2) / Math.max(1, rows.length - 1)),
    y: height - pad - (Number(item[field] || 0) / max * (height - pad * 2)), item,
  }));
  const revenuePoints = points('revenue'); const refundPoints = points('refunds');
  const path = values => values.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
  const revenuePath = path(revenuePoints); const refundPath = path(refundPoints);
  const areaPath = `${revenuePath} L${revenuePoints.at(-1).x.toFixed(1)},${height - pad} L${revenuePoints[0].x.toFixed(1)},${height - pad} Z`;
  const axisRows = rows.length < 3 ? rows : [rows[0], rows[Math.floor((rows.length - 1) / 2)], rows.at(-1)];
  return <><div className="report-chart" role="img" aria-label="Successful payment collections and refunds over the selected period"><svg className="report-chart__svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none"><defs><linearGradient id="reportRevenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#a72a51" stopOpacity=".22" /><stop offset="1" stopColor="#a72a51" stopOpacity="0" /></linearGradient></defs>{[0, 1, 2, 3].map(line => <line className="report-chart__grid" key={line} x1={pad} x2={width - pad} y1={pad + line * ((height - pad * 2) / 3)} y2={pad + line * ((height - pad * 2) / 3)} />)}<path className="report-chart__area" d={areaPath} /><path className="report-chart__line is-revenue" d={revenuePath} /><path className="report-chart__line is-refund" d={refundPath} />{revenuePoints.map(point => <circle className="report-chart__point is-revenue" key={`revenue-${point.item.key}`} cx={point.x} cy={point.y} r={rows.length > 45 ? 1.5 : 3}><title>{`${point.item.label}: collections ${money(point.item.revenue, currency)}`}</title></circle>)}{refundPoints.map(point => <circle className="report-chart__point is-refund" key={`refund-${point.item.key}`} cx={point.x} cy={point.y} r={rows.length > 45 ? 1.5 : 3}><title>{`${point.item.label}: refunds ${money(point.item.refunds, currency)}`}</title></circle>)}</svg><div className="report-chart__scale"><span>{money(max, currency)}</span><span>{money(0, currency)}</span></div><div className="report-chart__axis">{axisRows.map(item => <span key={item.key}>{item.label}</span>)}</div><div className="report-chart__legend"><span><i />Collections</span><span><i className="is-refund" />Refunds</span></div></div><details className="report-exact"><summary>View exact values</summary><ResponsiveTable headers={['Date', 'Orders', 'Collections', 'Refunds', 'Net']} rows={rows.map(item => [item.label, number(item.orders), money(item.revenue, currency), money(item.refunds, currency), money(item.net, currency)])} /></details></>;
}

function Distribution({ rows, total, link }) {
  if (!rows.length) return <Empty text="No matching records." />;
  const maximum = Math.max(1, Number(total || rows.reduce((sum, item) => sum + item.value, 0)));
  const palette = ['#7a1d3b', '#c54a70', '#e69aac', '#e0b45f', '#4f8f7c', '#747ba8', '#b4856a'];
  let cursor = 0;
  const gradient = rows.map((item, index) => { const start = cursor; cursor += Number(item.value || 0) / maximum * 100; return `${palette[index % palette.length]} ${start}% ${cursor}%`; }).join(', ');
  return <div className="report-distribution__layout"><span className="report-donut" style={{ background: `conic-gradient(${gradient})` }} aria-hidden="true"><span><strong>{number(maximum, 0)}</strong><small>Total</small></span></span><div className="report-distribution">{rows.map((item, index) => { const content = <><div><span><i className="report-distribution__swatch" style={{ background: palette[index % palette.length] }} />{item.label}</span><strong>{number(item.value)} <small>{number(item.value / maximum * 100)}%</small></strong></div><span className="report-track"><i style={{ width: `${Math.max(item.value ? 2 : 0, item.value / maximum * 100)}%`, background: palette[index % palette.length] }} /></span></>; return link ? <a key={item.label} href={link(item.label)}>{content}<ArrowRight size={14} /></a> : <div key={item.label}>{content}</div>; })}</div></div>;
}

function Insights({ data, currency, base }) {
  const current = data.current || {};
  const insights = [
    current.cancellationRate > 10 && ['Cancellation rate needs attention', `${number(current.cancellationRate)}% of created orders were cancelled.`, `${base}/orders?status=Cancelled`],
    current.refunds > 0 && ['Refunds affected collections', `${money(current.refunds, currency)} is recorded against paid orders.`, `${base}/returns`],
    current.costCoverage < 100 && ['Complete product costs', `${number(current.costCoverage)}% of ordered units have a cost snapshot.`, `${base}/products`],
  ].filter(Boolean);
  return <Panel title="Business insights" note="Actions derived from the selected period.">{insights.length ? <div className="report-insights">{insights.map(([title, note, href]) => <a href={href} key={title}><TrendingUp size={18} /><span><strong>{title}</strong><small>{note}</small></span><ArrowRight size={15} /></a>)}</div> : <div className="report-good"><TrendingUp size={20} /><div><strong>No urgent reporting signal</strong><p>Keep reviewing sales, stock and fulfillment regularly.</p></div></div>}</Panel>;
}

function Definitions({ items = {} }) { return <div className="report-definitions">{Object.entries(items).map(([key, value]) => <div key={key}><strong>{key.replace(/([A-Z])/g, ' $1')}</strong><p>{value}</p></div>)}</div>; }
function ProductCell({ item, base }) { return <a className="report-product" href={`${base}/products/edit?id=${encodeURIComponent(item.id)}`}><span>{item.image ? <img src={normalizeImageUrl(item.image)} alt="" loading="lazy" /> : <Package size={18} />}</span><span><strong title={item.name}>{item.name}</strong><small>{item.sku || 'No SKU'}</small></span></a>; }
function SimpleList({ rows, primary, secondary, value }) { if (!rows.length) return <Empty text="No matching products." />; return <div className="report-list">{rows.map((item, index) => <div key={item.id || index}><span><strong>{item[primary]}</strong><small>{secondary(item)}</small></span><b>{value(item)}</b></div>)}</div>; }
function Funnel({ rows }) { if (!rows.length) return <Empty text="No storefront events in this period." />; const max = Math.max(1, rows[0]?.value || 0); return <div className="report-funnel">{rows.map((item, index) => <div key={item.name}><span>{item.name.replaceAll('_', ' ').toLowerCase()}</span><b style={{ width: `${Math.max(12, item.value / max * 100)}%` }}>{number(item.value)}</b><small>{index ? `${number(item.rateFromPrevious)}% from prior step` : 'Starting activity'}</small></div>)}</div>; }

function ResponsiveTable({ headers, rows = [], empty }) {
  if (!rows.length && empty) return <Empty text={empty} />;
  return <div className="report-table-wrap"><table className="report-table"><thead><tr>{headers.map(item => <th key={item}>{item}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex} data-label={headers[cellIndex]}>{cell}</td>)}</tr>)}</tbody></table></div>;
}

function SaveDialog({ initial, onClose, onSave, canSchedule, customRange }) {
  const [name, setName] = useState(initial?.name || ''); const [frequency, setFrequency] = useState(initial?.schedule?.frequency || 'NONE'); const [recipient, setRecipient] = useState(initial?.schedule?.recipient || '');
  const scheduleAllowed = canSchedule && !customRange;
  return <div className="report-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form role="dialog" aria-modal="true" aria-labelledby="save-report-title" onSubmit={(event) => { event.preventDefault(); onSave({ name, ...(scheduleAllowed ? { schedule: { frequency, recipient } } : {}) }); }}><header><div><p className="admin-kicker">Reusable reporting</p><h2 id="save-report-title">{initial ? 'Manage saved report' : 'Save report view'}</h2></div><button type="button" aria-label="Close" onClick={onClose}><X /></button></header><label>View name<input autoFocus required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Example: Monthly finance review" /></label><label>Email schedule<select value={scheduleAllowed ? frequency : 'NONE'} onChange={(event) => setFrequency(event.target.value)} disabled={!scheduleAllowed}><option value="NONE">Do not email automatically</option><option value="DAILY">Daily</option><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option></select></label>{scheduleAllowed && frequency !== 'NONE' && <label>Recipient<input type="email" required value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="owner@example.com" /></label>}{!scheduleAllowed && <p className="report-dialog-note"><Info size={15} /> {customRange ? 'Email schedules use rolling periods. Choose 7, 30 or 90 days before adding a schedule.' : 'Email schedules become available after Brevo transactional email is configured. You can still save and reuse this view.'}</p>}<footer><button type="button" className="admin-btn-ghost" onClick={onClose}>Cancel</button><button type="submit" className="admin-btn-primary"><Save size={16} /> {initial ? 'Update view' : 'Save view'}</button></footer></form></div>;
}
