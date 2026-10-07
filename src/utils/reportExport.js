let pdfRuntime;

async function loadPdfRuntime() {
  if (!pdfRuntime) pdfRuntime = Promise.all([
    // eslint-disable-next-line import/no-webpack-loader-syntax
    import('!!pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ]).then(([module, fonts]) => {
    const pdfMake = module.default || module;
    pdfMake.addVirtualFileSystem(fonts.default || fonts);
    return pdfMake;
  }).catch((error) => { pdfRuntime = null; throw error; });
  return pdfRuntime;
}

export function downloadTextFile(contents, filename, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const money = (value, currency) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: currency || 'INR', maximumFractionDigits: 2,
}).format(Number(value || 0));

function table(title, headers, rows) {
  if (!rows?.length) return [];
  return [
    { text: title, style: 'sectionTitle', margin: [0, 16, 0, 6] },
    {
      table: {
        headerRows: 1,
        widths: headers.map(() => '*'),
        body: [headers.map((item) => ({ text: item, style: 'tableHeader' })), ...rows],
      },
      layout: { fillColor: (row) => row === 0 ? '#f8eaf0' : row % 2 ? '#ffffff' : '#fbf8f4', hLineColor: '#eadfd5', vLineColor: '#eadfd5' },
    },
  ];
}

export async function downloadReportPdf(bundle, filename = 'business-report.pdf') {
  const pdfMake = await loadPdfRuntime();
  const summary = bundle?.sections?.summary;
  const products = bundle?.sections?.products?.data;
  const customers = bundle?.sections?.customers?.data;
  const marketing = bundle?.sections?.marketing?.data;
  const fulfillment = bundle?.sections?.fulfillment?.data;
  const traffic = bundle?.sections?.traffic?.data;
  const currency = summary?.currency || Object.values(bundle?.sections || {})[0]?.currency || 'INR';
  const period = summary?.range || Object.values(bundle?.sections || {})[0]?.range || {};
  const timezone = summary?.timezone || Object.values(bundle?.sections || {})[0]?.timezone || 'Asia/Kolkata';
  const metrics = summary?.data?.metrics || {};
  const financial = summary?.data?.current || {};
  const metricRows = [
    ['Gross sales', 'grossSales'], ['Discounts', 'discounts'], ['Booked value', 'bookedValue'],
    ['Payments collected', 'paymentCollected'], ['Refunds', 'refunds'], ['Net collected', 'netCollected'],
    ['Average order value', 'averageOrderValue'], ['Estimated profit', 'estimatedProfit'],
  ].filter(([, key]) => metrics[key]).map(([label, key]) => [label, money(metrics[key].value, currency), metrics[key].delta == null ? 'No prior value' : `${metrics[key].delta > 0 ? '+' : ''}${metrics[key].delta}%`]);
  const reconciliationRows = [
    ['Gross MRP', financial.grossSales], ['Product discount', -Number(financial.productDiscount || 0)],
    ['Coupon discount', -Number(financial.couponDiscount || 0)], ['Prepaid discount', -Number(financial.prepaidDiscount || 0)],
    ['Merchandise selling value', financial.merchandiseSales], ['Delivery charge', financial.deliveryCharge],
    ['COD charge', financial.codCharge], ['Platform fee', financial.platformFee], ['Tax recorded', financial.tax],
    ['Booked order value', financial.bookedValue], ['Payments collected', financial.paymentCollected],
    ['Refunds recorded', -Number(financial.refunds || 0)], ['Net collected', financial.netCollected],
  ].map(([label, value]) => [label, money(value, currency)]);
  const inventory = products?.inventory || {};
  const customerSummary = customers?.summary || {};
  const fulfillmentSummary = fulfillment?.summary || {};
  const content = [
    { columns: [{ stack: [{ text: bundle?.storeName || 'Business report', style: 'brand' }, { text: 'Reports & Insights Center', style: 'subtitle' }] }, { stack: [{ text: 'PERFORMANCE REPORT', style: 'eyebrow', alignment: 'right' }, { text: `${period.fromDate || ''} to ${period.toDate || ''}`, alignment: 'right' }], width: 180 }] },
    { text: `Generated ${new Date(bundle?.generatedAt || Date.now()).toLocaleString('en-IN', { timeZone: timezone })} · ${timezone}`, color: '#6b6470', fontSize: 8, margin: [0, 8, 0, 12] },
    ...table('Traffic & visitors (browser-based estimates)', ['Metric', 'Current', 'Previous'], Object.entries(traffic?.metrics || {}).map(([key, value]) => [key, String(value.value), String(value.previous)])),
    ...(traffic ? [{ text: `Traffic timezone: ${traffic.timezone}. Collection: ${traffic.health?.state}. ${traffic.funnel?.note || ''}`, margin: [0, 8, 0, 8] }] : []),
    ...table('Traffic trend', ['Period', 'Visitors', 'Visits', 'Page views'], (traffic?.series || []).map(row => [row.key, String(row.visitors), String(row.sessions), String(row.pageViews)])),
    ...table('Visit acquisition', ['Source', 'Visitors', 'Visits'], (traffic?.sources || []).map(row => [row.label, String(row.visitors), String(row.sessions)])),
    ...['firstSources', 'campaigns', 'devices', 'browsers', 'operatingSystems'].flatMap(key => table(`Traffic: ${key}`, ['Label', 'Visitors', 'Visits', 'Page views'], (traffic?.[key] || []).map(row => [row.label, String(row.visitors), String(row.sessions), String(row.pageViews)]))),
    ...table('Verified traffic funnel', ['Step', 'Visits', 'Rate from previous'], (traffic?.funnel?.steps || []).map(row => [row.label, String(row.value), `${row.rate}%`])),
    ...Object.entries(traffic?.details || {}).flatMap(([key, rows]) => table(`Traffic: ${key}`, ['Label', 'Count'], rows.map(row => [row.label, String(row.value)]))),
    ...table('All-store order cohort (not limited to tracked visitors)', ['Metric', 'Value'], traffic ? ['ordersPlaced', 'codPlaced', 'onlinePaid', 'codCollected', 'cancelled', 'refunds'].map(key => [key, key === 'refunds' ? money(traffic.commerce?.[key], currency) : String(traffic.commerce?.[key] || 0)]) : []),
    ...(traffic ? [{ text: traffic.commerce?.note || '', margin: [0, 8, 0, 8] }, { text: `Active visitors in last 5 minutes: ${traffic.activeVisitors || 0}. Detailed retention: ${traffic.retention?.rawDays || 90} days; compact retention: ${traffic.retention?.summaryDays || 365} days.`, margin: [0, 8, 0, 8] }, ...Object.values(traffic.definitions || {}).map(text => ({ text, margin: [0, 2, 0, 2] }))] : []),
    ...table('Key performance indicators', ['Metric', 'Current', 'Change'], metricRows),
    ...table('Financial reconciliation', ['Metric', 'Amount'], reconciliationRows),
    ...table('Inventory position', ['Products', 'Units', 'Retail value', 'Low / out'], products ? [[String(inventory.products || 0), String(inventory.units || 0), money(inventory.valueAtRetail, currency), `${inventory.lowStock || 0} / ${inventory.outOfStock || 0}`]] : []),
    ...table('Product performance', ['Product', 'Gross / net units', 'Net sales', 'Returns'], (products?.items || []).slice(0, 30).map((item) => [item.name, `${item.units || 0} / ${item.netUnits || 0}`, money(item.itemRevenue, currency), `${item.returnedUnits || 0} · ${item.returnRate || 0}%`])),
    ...table('Slow-moving inventory', ['Product', 'SKU', 'Available', 'Retail value'], (products?.slowMoving || []).slice(0, 20).map((item) => [item.name, item.sku || '—', String(item.available || 0), money(Number(item.available || 0) * Number(item.price || 0), currency)])),
    ...table('Customer summary', ['Buying', 'New', 'Returning', 'Repeat rate'], customers ? [[String(customerSummary.buyingCustomers || 0), String(customerSummary.newCustomers || 0), String(customerSummary.returningCustomers || 0), `${customerSummary.repeatRate || 0}%`]] : []),
    ...table('Customer performance', ['Customer', 'Type', 'Orders', 'Net spend'], (customers?.topCustomers || []).slice(0, 20).map((item) => [item.name, item.type, String(item.orders), money(item.netSpend, currency)])),
    ...table('Customer locations', ['City', 'State / PIN', 'Orders', 'Net revenue'], (customers?.locations || []).slice(0, 20).map((item) => [item.city, `${item.state || '—'} · ${item.pincode || '—'}`, String(item.orders || 0), money(item.revenue, currency)])),
    ...table('Storefront funnel', ['Step', 'Events', 'Conversion'], (marketing?.funnel || []).map((item) => [String(item.name || '').replaceAll('_', ' '), String(item.value || 0), `${item.rateFromPrevious || 0}%`])),
    ...table('Campaign attribution', ['Source', 'Campaign', 'Orders', 'Revenue'], (marketing?.attribution || []).slice(0, 20).map((item) => [item.source || 'Direct', item.campaign || '—', String(item.orders), money(item.revenue, currency)])),
    ...table('Coupon performance', ['Coupon', 'Orders', 'Discount', 'Revenue'], (marketing?.coupons || []).slice(0, 20).map((item) => [item.code, String(item.orders || 0), money(item.discount, currency), money(item.revenue, currency)])),
    ...table('Banner performance', ['Banner / campaign', 'Impressions', 'Clicks', 'CTR'], (marketing?.banners || []).slice(0, 20).map((item) => [item.campaign || item.bannerId || 'Banner', String(item.impressions || 0), String(item.clicks || 0), `${item.ctr || 0}%`])),
    ...table('Shipping and returns summary', ['Metric', 'Value'], fulfillment ? [
      ['Waiting for shipment', String(fulfillmentSummary.waitingForShipment || 0)], ['Delayed shipments', String(fulfillmentSummary.delayed || 0)],
      ['Average delivery time', fulfillmentSummary.averageDeliveryHours == null ? '—' : `${fulfillmentSummary.averageDeliveryHours} hours`],
      ['COD outstanding', money(fulfillmentSummary.codOutstandingAmount, currency)], ['Return requests', String(fulfillmentSummary.returnRequests || 0)],
      ['Refunded amount', money(fulfillmentSummary.refunded, currency)], ['Refunds pending', String(fulfillmentSummary.refundPending || 0)],
    ] : []),
    ...table('Courier performance', ['Courier', 'Shipments', 'Delivery rate', 'RTO rate'], (fulfillment?.providers || []).map((item) => [item.provider, String(item.shipments), `${item.deliveryRate}%`, `${item.rtoRate}%`])),
    ...table('Shipment statuses', ['Status', 'Shipments'], (fulfillment?.shipmentStatuses || []).map((item) => [item.label, String(item.value || 0)])),
    ...table('Return statuses', ['Status', 'Requests'], (fulfillment?.returnStatuses || []).map((item) => [item.label, String(item.value || 0)])),
  ];
  pdfMake.createPdf({
    pageSize: 'A4', pageMargins: [36, 38, 36, 42], content,
    defaultStyle: { fontSize: 8, color: '#211a20' },
    styles: {
      brand: { fontSize: 20, bold: true, color: '#751d39' }, subtitle: { fontSize: 10, color: '#6b6470' },
      eyebrow: { fontSize: 8, bold: true, color: '#9b3154', characterSpacing: 1.2 },
      sectionTitle: { fontSize: 11, bold: true, color: '#751d39' }, tableHeader: { bold: true, color: '#751d39', fontSize: 8 },
    },
    footer: (page, pages) => ({ text: `${page} / ${pages}`, alignment: 'right', margin: [0, 0, 36, 0], color: '#8d8290', fontSize: 8 }),
  }).download(filename.replace(/\.csv$/i, '.pdf'));
}
