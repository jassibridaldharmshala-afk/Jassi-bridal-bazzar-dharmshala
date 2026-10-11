import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Banknote, CalendarDays, Camera, CheckCheck, ChevronLeft, ChevronRight, Download, Info, Package, Plus, RefreshCw, Search, Settings2, ShoppingBag, Truck, Users, Wallet } from 'lucide-react';
import api from '../../services/api';
import useAdminFeedback from '../../hooks/useAdminFeedback';
import AdminFeedback from '../../components/admin/AdminFeedback';
import PageState from '../../components/ui/PageState';
import { normalizeImageUrl } from '../../services/normalize';
import { validateDashboardResponse } from '../../utils/dashboardData';
import { orderCustomer } from '../../utils/customerIdentity';
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
  const [selection, setSelection] = useState('30d');
  const [period, setPeriod] = useState({ range: '30d' });
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [dateError, setDateError] = useState('');
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [reload, setReload] = useState(0); const [page, setPage] = useState(1); const [limit, setLimit] = useState(5);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [downloadMessage, setDownloadMessage] = useAdminFeedback(null, 'success', 'Dashboard');
  const [attentionScope, setAttentionScope] = useState('period');
  const requestVersion = useRef(0); const loadingRef = useRef(true);
  const params = new URLSearchParams({ ...period, orderPage: page, orderLimit: limit, attentionScope }).toString();
  useEffect(() => {
    const version = ++requestVersion.current;
    loadingRef.current = true; setLoading(true); setError('');
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
  const download = () => { try { downloadDashboard(overview, periodLabel); setDownloadMessage({ type: 'success', text: 'Dashboard CSV download started.' }); } catch { setDownloadMessage({ type: 'error', text: 'Download could not start. Please try again in your browser.' }); } };
  return <section className="store-dashboard">
    <nav aria-label="Sale, rental and catalog tasks" className="admin-card dash-shortcuts"><a className="admin-btn-ghost" href="/admin/orders?type=sale"><ShoppingBag size={16} />Sale orders</a><a className="admin-btn-ghost" href="/admin/orders?type=rental"><CalendarDays size={16} />Rental bookings</a><a href="/admin/products/add" className="admin-btn-primary"><Plus size={16} />Add product</a><a className="admin-btn-ghost" href="/admin/product-drafts"><Camera size={16} />Photos & drafts</a><a className="admin-btn-ghost" href="/admin/rentals?tab=setup"><Settings2 size={16} />Rental setup</a><a href="/admin/reports" className="admin-btn-ghost">Reports<ArrowRight size={15} /></a></nav>
    <div className="admin-card dash-toolbar">
      <label className="dash-period">Period<select aria-label="Dashboard period" value={selection} onChange={event => chooseRange(event.target.value)}>{ranges.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <div className="dash-actions"><button type="button" className="admin-btn-ghost" disabled={loading} onClick={() => setReload(value => value + 1)}><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh</button><button type="button" className="admin-btn-ghost" onClick={download} disabled={loading || !!error || !overview}><Download size={15} /> Export sales CSV</button></div>
      {selection === 'custom' && <form className="dash-custom-range" onSubmit={applyDates} noValidate><label>From<input aria-label="From date" type="date" max={today()} value={from} onChange={event => setFrom(event.target.value)} /></label><label>To<input aria-label="To date" type="date" min={from} max={today()} value={to} onChange={event => setTo(event.target.value)} /></label><button type="submit" className="admin-btn-primary">Apply dates</button></form>}
      {dateError && <p role="alert" className="dash-error">{dateError}</p>}
      <div className="dash-freshness"><p>{periodLabel} · IST{!loading && !error && overview?.generatedAt && <span>Updated {new Date(overview.generatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}</span>}</p><label title="Refresh every minute"><input type="checkbox" checked={autoRefresh} onChange={event => setAutoRefresh(event.target.checked)} />Auto-refresh</label></div>
    </div>
    <AdminFeedback message={downloadMessage} title="Dashboard" onDismiss={() => setDownloadMessage(null)} />
    {loading ? <PageState loading loadingLabel="Loading sale performance…" /> : error ? <PageState error={error} onRetry={() => setReload(value => value + 1)} /> :
      <section className="dash-performance" aria-label="Sale performance"><div className="dash-section-heading"><h2>Sale performance</h2><a href={ordersLink({ type: 'sale' })}>View sale orders<ArrowRight size={14} /></a></div><div className="dash-metrics">{cards.map(([label, key, format, Icon]) => <article className="admin-card dash-metric" key={key}><div className="dash-metric-top"><span>{label}</span><Icon size={16} /></div><strong>{format(stats[key]?.value)}</strong><MetricChange metric={stats[key]} /></article>)}</div><details className="dash-definitions"><summary><Info size={14} />About these numbers</summary><div><p>Sale orders for the selected period. Changes compare the previous equal-length period. A dash means there is no earlier value to compare.</p><dl>{cards.map(([label, key, format, Icon, note]) => <div key={key}><dt>{label}</dt><dd>{note}</dd></div>)}<div><dt>Best-selling products</dt><dd>Top 10 by units in valid COD and paid online orders. Item value before order-level discounts, fees and returns adjustments. Cancelled, returned and refunded orders are excluded.</dd></div><div><dt>Open tasks</dt><dd>Selected dates use the order date; returns use the request date. All dates includes all open tasks.</dd></div><div><dt>Live inventory</dt><dd>Current stock across the catalog, not historical stock for the selected dates. Alerts include low or sold-out size / colour variants.</dd></div></dl></div></details></section>}
    <RentalActivity refresh={reload} />
    {!loading && !error && <>
      <Panel title="Sale orders · needs attention" tools={<label className="dash-task-scope"><span className="sr-only">Task period</span><select aria-label="Task period" value={attentionScope} onChange={event => setAttentionScope(event.target.value)}><option value="period">Selected dates</option><option value="all">All dates</option></select></label>}><div className="dash-tasks">{tasks.map(([key, label, note, Icon]) => <a key={key} title={note} href={`${key === 'returns' ? '/admin/returns' : '/admin/orders'}?${new URLSearchParams({ ...(attentionScope === 'period' ? period : {}), ...(key === 'returns' ? { status: 'Requested' } : { attention: key }) })}`} className={(overview?.attention?.[key]?.value || 0) > 0 ? 'has-work' : ''}><div><Icon size={17} /><strong>{number(overview?.attention?.[key]?.value)}</strong></div><span>{label}</span>{key === 'collection' && overview?.attention?.collection?.amount > 0 && <small>{currency(overview.attention.collection.amount)} outstanding</small>}<ArrowRight className="dash-task-arrow" size={14} /></a>)}</div></Panel>
      <div className="dash-insights"><div className="dash-insights-column">
        <Panel title="Paid order trend" note="By order date"><SalesChart series={overview?.salesOverview || []} /></Panel>
        <Panel title="Recent sale orders" note={`${number(pagination.total)} orders`} href={ordersLink({ type: 'sale' })} link="View all">
          <form action="/admin/orders" method="get" className="dash-search"><Search size={17} /><input name="search" aria-label="Search all orders" placeholder="Search all orders" title="Search all dates by order ID, customer, email or phone" maxLength={100} required /><button type="submit">Search</button></form>
          {!overview?.recentOrders?.length ? <Empty text="No orders for these dates." /> : <div className="dash-order-list">{overview.recentOrders.map(order => <a key={order._id} href={`/admin/orders/detail?id=${encodeURIComponent(order._id)}`}><div className="dash-order-avatar">{orderCustomer(order).name.slice(0, 1).toUpperCase()}</div><div className="dash-order-main"><strong>{orderCustomer(order).name}</strong><span>{order.invoiceNumber || `#${order._id.slice(-8).toUpperCase()}`}</span><small>{day(order.createdAt)} · {number(order.itemsCount)} items</small></div><div className="dash-order-amount"><strong>{currency(order.finalAmount)}</strong><span className={`dash-badge ${order.orderStatus === 'Delivered' ? 'is-success' : order.orderStatus === 'Cancelled' ? 'is-muted' : ''}`}>{order.orderStatus || 'Pending'}</span><small>{order.paymentMethod} · {order.paymentStatus}</small></div></a>)}</div>}
          <div className="dash-pagination"><label>Show <select aria-label="Orders per page" value={limit} onChange={event => { setLimit(Number(event.target.value)); setPage(1); }}>{[5, 10, 20].map(value => <option key={value}>{value}</option>)}</select></label><span>Page {pagination.page} of {pagination.totalPages}</span><div><button aria-label="Previous orders" disabled={pagination.page <= 1} onClick={() => setPage(pagination.page - 1)}><ChevronLeft size={18} /></button><button aria-label="Next orders" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage(pagination.page + 1)}><ChevronRight size={18} /></button></div></div>
        </Panel>
      </div><div className="dash-insights-column">
        <Panel title="Order status" href={ordersLink()} link="View orders">{!overview?.orderOverview?.length ? <Empty text="No orders in this period." /> : <div className="dash-status-list">{overview.orderOverview.map(item => <a key={item.label} href={ordersLink({ status: item.label })}><span>{item.label}</span><strong>{number(item.value)}</strong><span className="dash-status-track"><i style={{ width: `${stats.orders?.value ? Math.max(1, item.value / stats.orders.value * 100) : 0}%` }} /></span><small>{stats.orders?.value ? Math.round(item.value / stats.orders.value * 100) : 0}%</small><ArrowRight size={14} /></a>)}</div>}</Panel>
        <Panel title="Best-selling products" note="By units ordered" href="/admin/products" link="All products">
          {!overview?.topProducts?.length ? <Empty text="No sales for these dates." /> : <ol className="dash-products">{overview.topProducts.map((product, index) => <li key={product.key || product.id || index}><span className="dash-rank">{index + 1}</span><div className="dash-product-image">{product.image ? <img src={normalizeImageUrl(product.image)} alt="" loading="lazy" onError={event => { event.currentTarget.style.display = 'none'; }} /> : <Package size={20} />}</div><div className="dash-product-info">{product.id ? <a href={`/admin/products/edit?id=${encodeURIComponent(product.id)}`} title={product.name}>{product.name || 'Product'}</a> : <strong>{product.name || 'Removed product'}</strong>}<span>{number(product.sold)} units ordered</span></div><strong>{currency(product.revenue)}</strong></li>)}</ol>}
        </Panel>
      <Panel title="Live inventory" note="Current stock" href="/admin/inventory?filter=attention" link="Manage stock">
        <div className="dash-inventory-summary"><span><strong>{number(inventory.active)}</strong> active products</span><span><strong>{number(inventory.alerts)}</strong> need stock attention</span><span><strong>{number(inventory.out)}</strong> sold out</span><span><strong>{number(inventory.total)}</strong> total catalog products</span></div>
        {!inventory.products?.length ? <Empty text="No stock alerts." /> : <div className="dash-stock-grid">{inventory.products.map(product => <a key={product._id} href={`/admin/products/edit?id=${encodeURIComponent(product._id)}`}><div><strong title={product.name}>{product.name}</strong><small>{product.sku || 'No SKU'} · Alert at {product.lowStockAlert ?? 5}</small></div><span className={`dash-badge ${product.availableStock <= 0 ? 'is-muted' : ''}`}>{product.availableStock <= 0 ? 'Sold out' : `${number(product.availableStock)} available`}</span><ArrowRight size={15} /></a>)}</div>}
        {inventory.alerts > 6 && <p className="dash-help">Showing 6 of {number(inventory.alerts)} products needing attention. Open Manage stock for the full list.</p>}
      </Panel>
      </div></div>
    </>}
  </section>;
}

function RentalActivity({ refresh }) {
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  const metrics = [['pickups', 'Pickups today', 'Today', Package], ['returns', 'Returns today', 'Today', RefreshCw], ['overdue', 'Overdue returns', 'All dates', CalendarDays], ['balance', 'Bookings with balance', 'All dates', Wallet]];
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    api.get('/admin/rentals/daily-desk', { silent: true, cache: 'no-store', forceRefetch: true }).then(result => {
      if (!result?.day || !result?.timezone || ['pickups', 'returns', 'overdue', 'balance'].some(key => !Number.isInteger(result?.counts?.[key]) || result.counts[key] < 0)) throw new Error('Rental activity could not be loaded. Please retry.');
      if (active) setData(result);
    }).catch(err => { if (active) setError(err.message || 'Rental activity could not be loaded.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refresh, retry]);
  return <section className="admin-card dash-panel dash-rental-activity" aria-label="Rental activity" aria-busy={loading}>
    <header><div><h2>Rental activity</h2>{data && !loading && !error && <p>{day(data.day)} · {data.timezone}</p>}</div><a href="/admin/orders?type=rental">View rentals<ArrowRight size={14} /></a></header>
    {loading ? <p role="status" className="dash-help">Loading rental activity…</p> : error ? <div className="dash-rental-error"><p role="alert">{error}</p><button type="button" className="admin-btn-ghost" onClick={() => setRetry(value => value + 1)}>Retry rental activity</button></div> : <div className="dash-rental-metrics">{metrics.map(([key, label, scope, Icon]) => <article key={key}><div className="dash-metric-top"><span>{label}</span><Icon size={16} /></div><strong>{number(data.counts[key])}</strong><small>{scope}</small></article>)}</div>}
  </section>;
}

function MetricChange({ metric }) {
  const delta = metric?.delta;
  return <div className={`dash-change ${delta > 0 ? 'is-up' : delta < 0 ? 'is-down' : ''}`} title="Compared with the previous equal-length period">{delta == null ? '— No comparison' : `${delta > 0 ? '+' : ''}${delta}% vs previous`}</div>;
}
function Panel({ title, note, href, link, tools, children }) {
  return <section className="admin-card dash-panel"><header><div><h2>{title}</h2>{note && <p>{note}</p>}</div>{tools}{href && <a href={href}>{link}<ArrowRight size={14} /></a>}</header>{children}</section>;
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
