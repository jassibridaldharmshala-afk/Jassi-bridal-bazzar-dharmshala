import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Banknote, CheckCheck, ChevronLeft, ChevronRight, Download, Package, Plus, RefreshCw, Search, ShoppingBag, Truck, Users, Wallet } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import PageState from '../../components/ui/PageState';
import { normalizeImageUrl } from '../../services/normalize';
import { validateDashboardResponse } from '../../utils/dashboardData';
import './Dashboard.css';

const ranges = [['today', 'Today'], ['7d', '7 days'], ['30d', '30 days'], ['month', 'This month'], ['90d', '90 days'], ['custom', 'Custom']];
const tasks = [
  ['pending', 'New orders', 'Review & confirm', ShoppingBag], ['packing', 'To pack', 'Prepare confirmed orders', Package],
  ['dispatch', 'To dispatch', 'Arrange shipment', Truck], ['cod', 'Confirm COD', 'Verify with the customer', CheckCheck],
  ['collection', 'COD to collect', 'Delivered, payment pending', Wallet], ['returns', 'Return requests', 'Review return / exchange', RefreshCw],
];
const currency = value => value == null ? '—' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value));
const number = value => value == null ? '—' : new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 }).format(Number(value));
const compact = value => new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value || 0));
const day = value => value ? new Date(value.length === 7 ? `${value}-01T00:00:00+05:30` : value.length === 10 ? `${value}T00:00:00+05:30` : value).toLocaleDateString('en-IN', { day: value.length === 7 ? undefined : 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }) : '—';
const today = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);

export default function Dashboard() {
  const { user } = useAuth();
  const [selection, setSelection] = useState('30d');
  const [period, setPeriod] = useState({ range: '30d' });
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [dateError, setDateError] = useState('');
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [reload, setReload] = useState(0); const [page, setPage] = useState(1); const [limit, setLimit] = useState(5);
  const [autoRefresh, setAutoRefresh] = useState(false); const [downloadError, setDownloadError] = useState('');
  const [attentionScope, setAttentionScope] = useState('period');
  const requestVersion = useRef(0); const loadingRef = useRef(true);
  const params = new URLSearchParams({ ...period, orderPage: page, orderLimit: limit, attentionScope }).toString();
  useEffect(() => {
    const version = ++requestVersion.current;
    loadingRef.current = true; setLoading(true); setError(''); setDownloadError('');
    api.get(`/admin/dashboard/overview?${params}`, { silent: true, cache: 'no-store' }).then(data => {
      if (version !== requestVersion.current) return;
      setOverview(validateDashboardResponse(data, new URLSearchParams(params)));
    }).catch(err => { if (version === requestVersion.current) setError(err.message || 'Unable to load dashboard'); })
      .finally(() => { if (version === requestVersion.current) { setLoading(false); loadingRef.current = false; } });
    return () => { requestVersion.current += 1; };
  }, [params, reload]);
  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible' && !loadingRef.current) setReload(value => value + 1); }, 60000);
    return () => window.clearInterval(timer);
  }, [autoRefresh]);
  const chooseRange = value => { setSelection(value); setDateError(''); if (value !== 'custom') { setPeriod({ range: value }); setPage(1); } };
  const applyDates = event => {
    event.preventDefault();
    if (!from || !to || from > to || to > today() || (new Date(to) - new Date(from)) / 86400000 >= 366) {
      setDateError('Choose a valid start and end date, up to today (maximum 366 days).'); return;
    }
    setDateError(''); setPeriod({ from, to }); setPage(1);
  };
  const ordersLink = extra => `/admin/orders?${new URLSearchParams({ ...period, ...extra })}`;
  const stats = overview?.stats || {}; const inventory = overview?.inventory || {};
  const pagination = overview?.recentPagination || { page: 1, totalPages: 1, total: overview?.recentOrders?.length || 0, limit };
  const periodLabel = overview?.range ? `${day(overview.range.fromDate)}${overview.range.fromDate?.slice(0, 4) !== overview.range.toDate?.slice(0, 4) ? ` ${overview.range.fromDate?.slice(0, 4)}` : ''} – ${day(overview.range.toDate)}, ${overview.range.toDate?.slice(0, 4)}` : ranges.find(([key]) => key === period.range)?.[1] || 'Selected period';
  const cards = [
    ['Booked order value', 'sales', currency, ShoppingBag, 'Valid COD and paid online orders; excludes cancelled, returned and refunded orders.'],
    ['Paid order value', 'revenue', currency, Banknote, 'Paid order totals, including fees and tax, before partial refunds. Based on order date, not payment date.'],
    ['Total orders', 'orders', number, Package, 'All orders in this period, including cancellations and unpaid checkouts.'],
    ['Buying customers', 'customers', number, Users, 'Unique customers with a valid COD or paid online order in this period.'],
    ['Average order value', 'average', currency, Wallet, 'Booked order value divided by valid orders in this period.'],
    ['Products added', 'products', number, Package, 'Catalog products created within these dates, including products later archived.'],
  ];
  const download = () => { try { downloadDashboard(overview, periodLabel); setDownloadError(''); } catch { setDownloadError('Download could not start. Please try again in your browser.'); } };
  return <section className="store-dashboard">
    <header className="dash-heading"><div><p className="admin-kicker">Business overview</p><h1>Dashboard</h1><p className="admin-note">Hello, {user?.name?.split(' ')[0] || 'Admin'}. Here is how your store is doing.</p></div><div className="dash-actions"><a href="/admin/products/add" className="admin-btn-primary"><Plus size={16} /> Add product</a><a href="/admin/reports" className="admin-btn-ghost">Reports <ArrowRight size={15} /></a></div></header>
    <div className="admin-card dash-toolbar">
      <div className="dash-range-buttons" aria-label="Dashboard period">{ranges.map(([value, label]) => <button key={value} type="button" aria-pressed={selection === value} onClick={() => chooseRange(value)}>{label}</button>)}</div>
      <div className="dash-actions"><button type="button" className="admin-btn-ghost" disabled={loading} onClick={() => setReload(value => value + 1)}><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh</button><button type="button" className="admin-btn-ghost" onClick={download} disabled={loading || !!error || !overview}><Download size={15} /> Export CSV</button></div>
      {selection === 'custom' && <form className="dash-custom-range" onSubmit={applyDates} noValidate><label>From<input aria-label="From date" type="date" max={today()} value={from} onChange={event => setFrom(event.target.value)} /></label><label>To<input aria-label="To date" type="date" min={from} max={today()} value={to} onChange={event => setTo(event.target.value)} /></label><button type="submit" className="admin-btn-primary">Apply dates</button><span>Apply to update the overview.</span></form>}
      {dateError && <p role="alert" className="dash-error">{dateError}</p>}
      <div className="dash-freshness"><p>{loading ? 'Updating dashboard…' : error ? 'Update failed' : <><span className="dash-live-dot" /><span>Live data connected</span>{overview?.generatedAt && <> · Updated {new Date(overview.generatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })} IST</>}</>}</p><label><input type="checkbox" checked={autoRefresh} onChange={event => setAutoRefresh(event.target.checked)} /> Refresh every minute</label></div>
    </div>
    {downloadError && <p role="alert" className="dash-error">{downloadError}</p>}
    {loading ? <PageState loading loadingLabel="Loading store performance…" /> : error ? <PageState error={error} onRetry={() => setReload(value => value + 1)} /> : <>
      <div className="dash-section-label"><h2>{periodLabel}</h2><span>All matching records · India time (IST)</span></div>
      <div className="dash-metrics">{cards.map(([label, key, format, Icon, note]) => <article className="admin-card dash-metric" key={key}><div className="dash-metric-top"><span>{label}</span><Icon size={18} /></div><strong>{format(stats[key]?.value)}</strong><MetricChange metric={stats[key]} /><p>{note}</p></article>)}</div>
      <p className="dash-comparison-note">Changes compare the previous equal-length period. A dash means there is no earlier value to compare.</p>
      <Panel title="Needs your attention" note={attentionScope === 'period' ? 'Open tasks for orders placed in these dates; returns use the request date.' : 'Open tasks across all dates.'}><div className="dash-task-scope"><label>Tasks for <select aria-label="Task period" value={attentionScope} onChange={event => setAttentionScope(event.target.value)}><option value="period">Selected dates</option><option value="all">All dates</option></select></label></div><div className="dash-tasks">{tasks.map(([key, label, note, Icon]) => <a key={key} href={`${key === 'returns' ? '/admin/returns' : '/admin/orders'}?${new URLSearchParams({ ...(attentionScope === 'period' ? period : {}), ...(key === 'returns' ? { status: 'Requested' } : { attention: key }) })}`} className={(overview?.attention?.[key]?.value || 0) > 0 ? 'has-work' : ''}><div><Icon size={19} /><strong>{number(overview?.attention?.[key]?.value)}</strong></div><span>{label}</span><small>{key === 'collection' && overview?.attention?.collection?.amount ? `${currency(overview.attention.collection.amount)} outstanding` : note}</small><ArrowRight className="dash-task-arrow" size={15} /></a>)}</div></Panel>
      <div className="dash-two-columns">
        <Panel title="Paid order trend" note="Paid order value by order date for the selected period."><SalesChart series={overview?.salesOverview || []} /></Panel>
        <Panel title="Order status" note="Select a status to see matching orders." href={ordersLink()} link="View orders">{!overview?.orderOverview?.length ? <Empty text="No orders in this period." /> : <div className="dash-status-list">{overview.orderOverview.map(item => <a key={item.label} href={ordersLink({ status: item.label })}><span>{item.label}</span><strong>{number(item.value)}</strong><span className="dash-status-track"><i style={{ width: `${stats.orders?.value ? Math.max(1, item.value / stats.orders.value * 100) : 0}%` }} /></span><small>{stats.orders?.value ? Math.round(item.value / stats.orders.value * 100) : 0}%</small><ArrowRight size={14} /></a>)}</div>}</Panel>
      </div>
      <div className="dash-two-columns">
        <Panel title="Recent orders" note={`${number(pagination.total)} orders in the selected period.`} href={ordersLink()} link="View all">
          <form action="/admin/orders" method="get" className="dash-search"><Search size={17} /><input name="search" aria-label="Search all orders" placeholder="Order ID, customer, email or phone" maxLength={100} required /><button type="submit">Search</button></form><p className="dash-help">Search looks across all order dates.</p>
          {!overview?.recentOrders?.length ? <Empty text="No orders in this period. Try a wider date range." /> : <div className="dash-order-list">{overview.recentOrders.map(order => <a key={order._id} href={`/admin/orders/detail?id=${encodeURIComponent(order._id)}`}><div className="dash-order-avatar">{(order.user?.name || order.shippingAddress?.fullName || 'C').slice(0, 1).toUpperCase()}</div><div className="dash-order-main"><strong>{order.user?.name || order.shippingAddress?.fullName || 'Customer'}</strong><span>{order.invoiceNumber || `#${order._id.slice(-8).toUpperCase()}`}</span><small>{day(order.createdAt)} · {number(order.itemsCount)} items</small></div><div className="dash-order-amount"><strong>{currency(order.finalAmount)}</strong><span className={`dash-badge ${order.orderStatus === 'Delivered' ? 'is-success' : order.orderStatus === 'Cancelled' ? 'is-muted' : ''}`}>{order.orderStatus || 'Pending'}</span><small>{order.paymentMethod} · {order.paymentStatus}</small></div></a>)}</div>}
          <div className="dash-pagination"><label>Show <select aria-label="Orders per page" value={limit} onChange={event => { setLimit(Number(event.target.value)); setPage(1); }}>{[5, 10, 20].map(value => <option key={value}>{value}</option>)}</select></label><span>Page {pagination.page} of {pagination.totalPages}</span><div><button aria-label="Previous orders" disabled={pagination.page <= 1} onClick={() => setPage(pagination.page - 1)}><ChevronLeft size={18} /></button><button aria-label="Next orders" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage(pagination.page + 1)}><ChevronRight size={18} /></button></div></div>
        </Panel>
        <Panel title="Best-selling products" note="Top 10 by units in valid COD and paid online orders." href="/admin/products" link="All products">
          {!overview?.topProducts?.length ? <Empty text="Products will appear when valid orders are placed in this period." /> : <ol className="dash-products">{overview.topProducts.map((product, index) => <li key={product.key || product.id || index}><span className="dash-rank">{index + 1}</span><div className="dash-product-image">{product.image ? <img src={normalizeImageUrl(product.image)} alt="" loading="lazy" onError={event => { event.currentTarget.style.display = 'none'; }} /> : <Package size={20} />}</div><div className="dash-product-info">{product.id ? <a href={`/admin/products/edit?id=${encodeURIComponent(product.id)}`} title={product.name}>{product.name || 'Product'}</a> : <strong>{product.name || 'Removed product'}</strong>}<span>{number(product.sold)} units ordered</span></div><strong>{currency(product.revenue)}</strong></li>)}</ol>}
          <p className="dash-help">Item value before order-level discounts, fees and returns adjustments. Cancelled, returned and refunded orders are excluded.</p>
        </Panel>
      </div>
      <Panel title="Live inventory" note="Current stock across the catalog, not historical stock for the selected dates. Alerts include low or sold-out size / colour variants." href="/admin/inventory?filter=attention" link="Manage stock">
        <div className="dash-inventory-summary"><span><strong>{number(inventory.active)}</strong> active products</span><span><strong>{number(inventory.alerts)}</strong> need stock attention</span><span><strong>{number(inventory.out)}</strong> sold out</span><span><strong>{number(inventory.total)}</strong> total catalog products</span></div>
        {!inventory.products?.length ? <Empty text="No stock alerts for active products." /> : <div className="dash-stock-grid">{inventory.products.map(product => <a key={product._id} href={`/admin/products/edit?id=${encodeURIComponent(product._id)}`}><div><strong title={product.name}>{product.name}</strong><small>{product.sku || 'No SKU'} · Alert at {product.lowStockAlert ?? 5}</small></div><span className={`dash-badge ${product.availableStock <= 0 ? 'is-muted' : ''}`}>{product.availableStock <= 0 ? 'Sold out' : `${number(product.availableStock)} available`}</span><ArrowRight size={15} /></a>)}</div>}
        {inventory.alerts > 6 && <p className="dash-help">Showing 6 of {number(inventory.alerts)} products needing attention. Open Manage stock for the full list.</p>}
      </Panel>
    </>}
  </section>;
}

function MetricChange({ metric }) {
  const delta = metric?.delta;
  return <div className={`dash-change ${delta > 0 ? 'is-up' : delta < 0 ? 'is-down' : ''}`}>{delta == null ? '— No comparison' : `${delta > 0 ? '+' : ''}${delta}% vs previous period`}</div>;
}
function Panel({ title, note, href, link, children }) {
  return <section className="admin-card dash-panel"><header><div><h2>{title}</h2><p>{note}</p></div>{href && <a href={href}>{link}<ArrowRight size={14} /></a>}</header>{children}</section>;
}
function Empty({ text }) { return <div className="dash-empty"><Package size={23} /><p>{text}</p></div>; }
function SalesChart({ series }) {
  if (!series.length) return <Empty text="No paid orders in this period." />;
  const max = Math.max(1, ...series.map(item => Number(item.value || 0)));
  const bottom = 194;
  const points = series.map((item, index) => ({ ...item, x: 55 + index / Math.max(series.length - 1, 1) * 565, y: bottom - Number(item.value || 0) / max * 165 }));
  const tick = Math.max(1, Math.ceil(points.length / 6));
  return <div className="dash-chart"><svg viewBox="0 0 640 230" role="img" aria-label="Paid order value trend; exact values are available in the table below"><title>Paid order value by order date</title>
    {[0, 0.5, 1].map(ratio => <g key={ratio}><line x1={55} x2={625} y1={bottom - ratio * 165} y2={bottom - ratio * 165} stroke="#eee6e2" /><text x={47} y={bottom - ratio * 165 + 4} textAnchor="end">{compact(max * ratio)}</text></g>)}
    <path d={`M${points[0].x},${bottom} ${points.map(p => `L${p.x},${p.y}`).join(' ')} L${points.at(-1).x},${bottom} Z`} fill="#f8e9ed" /><path d={points.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ')} fill="none" stroke="#781c3b" strokeWidth="2.5" strokeLinejoin="round" />
    {points.map((p, index) => <g key={p.key || p.label}><circle cx={p.x} cy={p.y} r={series.length > 31 ? 2 : 3} fill="#781c3b"><title>{day(p.key || p.label)}: {currency(p.value)}, {number(p.orders)} orders</title></circle>{index % tick === 0 && <text x={p.x} y={220} textAnchor="middle">{day(p.key || p.label)}</text>}</g>)}
  </svg><details><summary>View exact values</summary><div className="dash-table-scroll"><table><thead><tr><th>Date (IST)</th><th>All orders</th><th>Paid order value</th></tr></thead><tbody>{series.map((item, index) => <tr key={item.key || index}><td>{item.key || item.label}</td><td>{number(item.orders)}</td><td>{currency(item.value)}</td></tr>)}</tbody></table></div></details></div>;
}

export function dashboardCsv(data, label) {
  const rows = [['Dashboard period', label], ['Time zone', 'Asia/Kolkata'], ['Generated at', data.generatedAt || ''], [], ['Metric', 'Value', 'Previous period']];
  [['Booked order value', 'sales'], ['Paid order value (before partial refunds)', 'revenue'], ['All orders', 'orders'], ['Buying customers', 'customers'], ['Average order value', 'average'], ['Products added', 'products']].forEach(([name, key]) => rows.push([name, data.stats?.[key]?.value ?? '', data.stats?.[key]?.previous ?? '']));
  rows.push([], ['Order date (IST)', 'All orders', 'Paid order value']);
  (data.salesOverview || []).forEach(item => rows.push([item.key || item.label, item.orders, item.value]));
  rows.push([], ['Order status', 'Count']); (data.orderOverview || []).forEach(item => rows.push([item.label, item.value]));
  rows.push([], ['Top 10 products', 'Units ordered', 'Item value before order discounts / fees']);
  (data.topProducts || []).forEach(item => rows.push([item.name, item.sold, item.revenue]));
  rows.push([], [`Open task (${data.scopes?.attention === 'all' ? 'all dates' : 'selected dates'})`, 'Count']); tasks.forEach(([key, title]) => rows.push([title, data.attention?.[key]?.value ?? '']));
  rows.push([], ['Current inventory', 'Products']);
  [['Active products', 'active'], ['Need stock attention', 'alerts'], ['Sold out', 'out'], ['Total catalog products', 'total']].forEach(([title, key]) => rows.push([title, data.inventory?.[key] ?? '']));
  return '\uFEFF' + rows.map(row => row.map(value => { const text = String(value ?? ''); return `"${(/^\s*[=+@-]/.test(text) ? "'" + text : text).replace(/"/g, '""')}"`; }).join(',')).join('\r\n');
}
function downloadDashboard(data, label) {
  const url = URL.createObjectURL(new Blob([dashboardCsv(data, label)], { type: 'text/csv;charset=utf-8;' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `dashboard-${data.range?.fromDate || 'summary'}-${data.range?.toDate || today()}.csv`;
  document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
