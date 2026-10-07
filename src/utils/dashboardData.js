const DAY = 86400000;
const OFFSET = 330 * 60000;
const numeric = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const dateKey = value => new Date(new Date(value).getTime() + OFFSET).toISOString().slice(0, 10);
const sameAmount = (a, b) => Math.abs(a - b) < 0.01;

// Never label a legacy, cached or mismatched response as the selected period.
export function validateDashboardResponse(data, params) {
  if (!data?.stats || Array.isArray(data.stats)) throw new Error('Dashboard data could not be read. Please try again.');
  if (data.schemaVersion !== 2) throw new Error('The dashboard API is out of date. Restart or update the backend, then refresh this page.');
  const query = params instanceof URLSearchParams ? params : new URLSearchParams(params);
  const range = data.range;
  const invalid = () => { throw new Error('The dashboard response does not match the selected dates. Refresh to fetch accurate data.'); };
  if (!range || !Number.isFinite(Date.parse(range.from)) || !Number.isFinite(Date.parse(range.to)) || !Number.isFinite(Date.parse(data.generatedAt))) invalid();
  const duration = Date.parse(range.to) - Date.parse(range.from);
  if (duration <= 0 || range.timezone !== 'Asia/Kolkata' || range.fromDate !== dateKey(range.from) || range.toDate !== dateKey(Date.parse(range.to) - 1)) invalid();
  const days = Math.round((Date.parse(range.toDate) - Date.parse(range.fromDate)) / DAY) + 1;
  if (range.days !== days) invalid();
  if (query.has('from') || query.has('to')) {
    if (range.preset !== 'custom' || range.fromDate !== query.get('from') || range.toDate !== query.get('to')) invalid();
  } else {
    const preset = query.get('range') || '30d';
    if (range.preset !== preset) invalid();
    const expectedDays = { today: 1, '7d': 7, '30d': 30, '90d': 90 }[preset];
    if (expectedDays && days !== expectedDays) invalid();
    if (preset === 'month' && (range.fromDate.slice(8) !== '01' || range.fromDate.slice(0, 7) !== range.toDate.slice(0, 7))) invalid();
  }
  if (data.scopes?.performance !== 'period' || data.scopes?.attention !== (query.get('attentionScope') || 'period') || data.scopes?.inventory !== 'live') invalid();
  for (const key of ['sales', 'revenue', 'orders', 'customers', 'average', 'products']) {
    const metric = data.stats[key];
    if (!metric || !numeric(metric.value) || !numeric(metric.previous) || (metric.delta !== null && !Number.isFinite(metric.delta))) invalid();
  }
  if (!Array.isArray(data.salesOverview) || !Array.isArray(data.orderOverview) || !Array.isArray(data.recentOrders) || !Array.isArray(data.topProducts) || !Array.isArray(data.inventory?.products)) invalid();
  const { salesOverview, orderOverview, stats } = data;
  if (salesOverview.some(item => !numeric(item.value) || !numeric(item.orders)) || orderOverview.some(item => !numeric(item.value))) invalid();
  if (!sameAmount(salesOverview.reduce((sum, item) => sum + item.value, 0), stats.revenue.value)
      || salesOverview.reduce((sum, item) => sum + item.orders, 0) !== stats.orders.value
      || orderOverview.reduce((sum, item) => sum + item.value, 0) !== stats.orders.value) invalid();
  const keys = salesOverview.map(item => item.key);
  if (new Set(keys).size !== keys.length || (range.granularity === 'day' && keys.length !== days)
      || keys.some(key => typeof key !== 'string' || key < range.fromDate.slice(0, key.length) || key > range.toDate.slice(0, key.length))) invalid();
  for (const key of ['pending', 'packing', 'dispatch', 'transit', 'cod', 'collection', 'returns']) if (!numeric(data.attention?.[key]?.value)) invalid();
  for (const key of ['active', 'total', 'alerts', 'out']) if (!numeric(data.inventory[key])) invalid();
  const page = data.recentPagination;
  const limit = Number(query.get('orderLimit') || 5);
  if (!page || page.total !== stats.orders.value || page.limit !== limit || page.totalPages !== Math.max(1, Math.ceil(page.total / limit))
      || page.page !== Math.min(Math.max(1, Number(query.get('orderPage') || 1)), page.totalPages)
      || data.recentOrders.length > limit) invalid();
  return data;
}
