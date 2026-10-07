import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Archive, Boxes, ChevronDown, ClipboardCheck, Clock3,
  Download, History, IndianRupee, Plus, RefreshCw, Search,
  ShieldCheck, ShoppingCart, TrendingDown, Truck, Undo2, Upload, Warehouse, X,
} from 'lucide-react';
import DataTable from '../../components/admin/DataTable';
import PageHeader from '../../components/admin/PageHeader';
import api from '../../services/api';
import WorkflowSmartFill from '../../components/admin/WorkflowSmartFill';
import './Inventory.css';

const REASONS = [
  ['PURCHASE_RECEIPT', 'Supplier stock received'], ['STOCK_COUNT', 'Physical stock count'],
  ['CORRECTION', 'Inventory correction'], ['CUSTOMER_RETURN', 'Customer return'],
  ['DAMAGED', 'Damaged stock'], ['LOST', 'Lost or missing stock'],
  ['SAMPLE', 'Sample or internal use'], ['IMPORT', 'Inventory import'],
];
const TYPES = ['SALE', 'CANCELLATION', 'RETURN', 'MANUAL_ADJUSTMENT', 'RESTOCK', 'IMPORT', 'DAMAGE', 'SHRINKAGE', 'SAMPLE', 'PURCHASE_RECEIPT', 'REVERSAL'];
const EMPTY_PAGE = { items: [], page: 1, limit: 25, total: 0, totalPages: 1 };

const number = (value) => Number(value || 0).toLocaleString('en-IN');
const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const label = (value) => String(value || '').replaceAll('_', ' ').toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
const requestKey = () => window.crypto?.randomUUID?.() || `inventory-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const params = (values) => {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => { if (value !== '' && value !== undefined && value !== null) query.set(key, value); });
  return query.toString();
};

export default function Inventory({ route = '' }) {
  const base = route.startsWith('/seller') ? '/seller' : '/admin';
  const routeFilter = new URLSearchParams(route.split('?')[1] || '').get('filter') || '';
  const [tab, setTab] = useState('stock');
  const [catalog, setCatalog] = useState(EMPTY_PAGE);
  const [summary, setSummary] = useState(null);
  const [historyPage, setHistoryPage] = useState(EMPTY_PAGE);
  const [purchasePage, setPurchasePage] = useState(EMPTY_PAGE);
  const [filters, setFilters] = useState({ q: '', status: routeFilter, sort: 'updated', page: 1, limit: 25 });
  const [historyFilters, setHistoryFilters] = useState({ q: '', type: '', bucket: '', from: '', to: '', page: 1, limit: 25 });
  const [purchaseFilters, setPurchaseFilters] = useState({ q: '', status: '', page: 1, limit: 20 });
  const [loading, setLoading] = useState({ catalog: true, summary: true, history: false, purchase: false });
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);
  const [adjustment, setAdjustment] = useState(null);
  const [markOut, setMarkOut] = useState(null);
  const [hideTarget, setHideTarget] = useState(null);
  const [bulk, setBulk] = useState(false);
  const [purchase, setPurchase] = useState(null);
  const [receiving, setReceiving] = useState(null);
  const [cancelPurchase, setCancelPurchase] = useState(null);
  const [reversal, setReversal] = useState(null);

  useEffect(() => setFilters((current) => ({ ...current, status: routeFilter, page: 1 })), [routeFilter]);
  const refresh = useCallback(() => setReload((value) => value + 1), []);

  useEffect(() => {
    let live = true;
    setLoading((value) => ({ ...value, summary: true }));
    api.get(`${base}/inventory/summary`, { silent: true }).then((data) => {
      if (live) { setSummary(data); setErrors((value) => ({ ...value, summary: '' })); }
    }).catch((error) => { if (live) setErrors((value) => ({ ...value, summary: error.message })); })
      .finally(() => { if (live) setLoading((value) => ({ ...value, summary: false })); });
    return () => { live = false; };
  }, [base, reload]);

  useEffect(() => {
    let live = true;
    const timer = window.setTimeout(() => {
      setLoading((value) => ({ ...value, catalog: true }));
      api.get(`${base}/inventory/catalog?${params(filters)}`, { silent: true }).then((data) => {
        if (live) { setCatalog({ ...EMPTY_PAGE, ...data }); setErrors((value) => ({ ...value, catalog: '' })); }
      }).catch((error) => { if (live) setErrors((value) => ({ ...value, catalog: error.message })); })
        .finally(() => { if (live) setLoading((value) => ({ ...value, catalog: false })); });
    }, filters.q ? 250 : 0);
    return () => { live = false; window.clearTimeout(timer); };
  }, [base, filters, reload]);

  useEffect(() => {
    if (tab !== 'history') return undefined;
    let live = true;
    const timer = window.setTimeout(() => {
      setLoading((value) => ({ ...value, history: true }));
      api.get(`${base}/inventory/history?${params(historyFilters)}`, { silent: true }).then((data) => {
        if (live) { setHistoryPage({ ...EMPTY_PAGE, ...data }); setErrors((value) => ({ ...value, history: '' })); }
      }).catch((error) => { if (live) setErrors((value) => ({ ...value, history: error.message })); })
        .finally(() => { if (live) setLoading((value) => ({ ...value, history: false })); });
    }, historyFilters.q ? 250 : 0);
    return () => { live = false; window.clearTimeout(timer); };
  }, [base, historyFilters, reload, tab]);

  useEffect(() => {
    if (tab !== 'purchase') return undefined;
    let live = true;
    setLoading((value) => ({ ...value, purchase: true }));
    api.get(`${base}/inventory/purchase-orders?${params(purchaseFilters)}`, { silent: true }).then((data) => {
      if (live) { setPurchasePage({ ...EMPTY_PAGE, ...data }); setErrors((value) => ({ ...value, purchase: '' })); }
    }).catch((error) => { if (live) setErrors((value) => ({ ...value, purchase: error.message })); })
      .finally(() => { if (live) setLoading((value) => ({ ...value, purchase: false })); });
    return () => { live = false; };
  }, [base, purchaseFilters, reload, tab]);

  const access = summary?.capabilities || catalog.capabilities || {};
  const productOptions = useMemo(() => catalog.items.flatMap((product) => product.variants?.length
    ? product.variants.map((variant) => ({ product, variant, key: `${product._id}:${variant._id}`, name: `${product.name} · ${[variant.size, variant.color].filter(Boolean).join(' / ') || variant.sku || 'Variant'}` }))
    : [{ product, variant: null, key: product._id, name: product.name }]), [catalog.items]);

  const completeAction = (message) => { setNotice(message); refresh(); };
  const hideProduct = async (product) => {
    await api.patch(`${base}/products/${product._id}/hide`, {});
    setHideTarget(null);
    completeAction(`${product.name} is hidden from the storefront.`);
  };

  const exportInventory = async () => {
    try {
      const data = await api.get(`${base}/inventory/export`, { silent: true });
      downloadCsv('inventory-export.csv', data.items || [], ['Product', 'SKU', 'Variant', 'Sellable', 'Reserved', 'Incoming', 'Damaged', 'Quarantine', 'Low alert', 'Location', 'Updated']);
      setNotice('Inventory export downloaded.');
    } catch (error) { setErrors((value) => ({ ...value, catalog: error.message })); }
  };

  return <section className="inventory-workspace">
    <PageHeader title="Inventory operations" note="Know what can sell, what is committed, what is arriving, and why every quantity changed." kicker={base === '/seller' ? 'Seller' : 'Admin'}>
      <button type="button" className="admin-btn-ghost" onClick={refresh} disabled={Object.values(loading).some(Boolean)}><RefreshCw size={16} /> Refresh</button>
      {access.canExport && <button type="button" className="admin-btn-ghost" onClick={exportInventory}><Download size={16} /> Export</button>}
      {access.canReceive && <button type="button" className="admin-btn" onClick={() => setPurchase({ supplier: { name: '', phone: '', email: '' }, expectedAt: '', notes: '', items: [{ selection: productOptions[0]?.key || '', quantity: 1, unitCost: productOptions[0]?.product?.costPrice || 0 }] })}><Plus size={16} /> Purchase order</button>}
    </PageHeader>

    {notice && <div className="inventory-notice" role="status"><ShieldCheck size={18} /><span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Dismiss message"><X size={15} /></button></div>}
    {errors.summary && <div className="inventory-warning" role="alert"><AlertTriangle size={18} />Summary is temporarily unavailable. Stock controls can still be used.</div>}
    <SummaryCards data={summary} loading={loading.summary} canViewCost={access.canViewCost} onFilter={(status) => { setTab('stock'); setFilters((value) => ({ ...value, status, page: 1 })); }} />

    <nav className="inventory-tabs" aria-label="Inventory sections">
      {[['stock', Boxes, 'Stock'], ['purchase', Truck, 'Restocking'], ['history', History, 'Movement history']].map(([value, Icon, text]) => <button key={value} type="button" className={tab === value ? 'is-active' : ''} aria-current={tab === value ? 'page' : undefined} onClick={() => setTab(value)}><Icon size={17} />{text}</button>)}
    </nav>

    {tab === 'stock' && <StockPanel
      base={base} page={catalog} loading={loading.catalog} error={errors.catalog} filters={filters} setFilters={setFilters}
      access={access} onAdjust={(product, variant = null, bucket = 'SELLABLE') => setAdjustment({ product, variant, bucket })}
      onMarkOut={setMarkOut} onHide={setHideTarget} onOrder={(product, variant) => setPurchase({ supplier: { name: product.supplierName || '', phone: '', email: '' }, expectedAt: product.restockAt?.slice?.(0, 10) || '', notes: '', items: [{ selection: `${product._id}${variant ? `:${variant._id}` : ''}`, quantity: product.reorderQuantity || 1, unitCost: product.costPrice || 0 }] })}
      onBulk={() => setBulk(true)} onRetry={refresh}
    />}
    {tab === 'purchase' && <PurchasePanel page={purchasePage} loading={loading.purchase} error={errors.purchase} filters={purchaseFilters} setFilters={setPurchaseFilters} access={access} onReceive={setReceiving} onCancel={setCancelPurchase} onRetry={refresh} />}
    {tab === 'history' && <HistoryPanel page={historyPage} loading={loading.history} error={errors.history} filters={historyFilters} setFilters={setHistoryFilters} access={access} onReverse={setReversal} onRetry={refresh} />}

    {adjustment && <AdjustmentDialog base={base} selection={adjustment} onClose={() => setAdjustment(null)} onSaved={(message) => { setAdjustment(null); completeAction(message); }} />}
    {markOut && <MarkOutDialog base={base} product={markOut} onClose={() => setMarkOut(null)} onSaved={() => { setMarkOut(null); completeAction(`${markOut.name} is now out of stock.`); }} />}
    {hideTarget && <ConfirmDialog title="Hide this product?" note={`${hideTarget.name} will disappear from the storefront. Its stock and movement history will remain available.`} confirm="Hide from storefront" onClose={() => setHideTarget(null)} onConfirm={() => hideProduct(hideTarget)} />}
    {bulk && <BulkDialog base={base} onClose={() => setBulk(false)} onSaved={(message) => { setBulk(false); completeAction(message); }} />}
    {purchase && <PurchaseOrderDialog base={base} value={purchase} setValue={setPurchase} options={productOptions} onClose={() => setPurchase(null)} onSaved={(message) => { setPurchase(null); setTab('purchase'); completeAction(message); }} />}
    {receiving && <ReceivingDialog base={base} order={receiving} onClose={() => setReceiving(null)} onSaved={(message) => { setReceiving(null); completeAction(message); }} />}
    {cancelPurchase && <ConfirmDialog title="Cancel purchase order?" note={`${cancelPurchase.number} will stop contributing to incoming stock. Received quantities stay unchanged.`} confirm="Cancel purchase order" danger onClose={() => setCancelPurchase(null)} onConfirm={async () => { await api.post(`${base}/inventory/purchase-orders/${cancelPurchase._id}/cancel`, { revision: cancelPurchase.revision }); setCancelPurchase(null); completeAction(`${cancelPurchase.number} cancelled.`); }} />}
    {reversal && <ConfirmDialog title="Reverse this adjustment?" note={`A compensating movement will be recorded. Existing history will remain unchanged.`} confirm="Reverse adjustment" onClose={() => setReversal(null)} onConfirm={async () => { await api.post(`${base}/inventory/adjustments/${reversal._id}/reverse`, { note: 'Reversed from inventory history' }); setReversal(null); completeAction('Inventory adjustment reversed and recorded.'); }} />}
  </section>;
}

function SummaryCards({ data, loading, canViewCost, onFilter }) {
  const cards = [
    ['Sellable now', data?.sellable, Boxes, '', 'Units customers can currently buy'],
    ['Reserved', data?.reserved, ShoppingCart, '', 'Committed to orders being fulfilled'],
    ['Incoming', data?.incoming, Truck, '', 'Open supplier purchase orders'],
    ['Needs attention', data?.lowProducts, AlertTriangle, 'attention', `${number(data?.lowVariants)} variants low or sold out`],
    ['Sold out', data?.soldOutProducts, Archive, 'out', 'Products with no sellable units'],
    ['Non-sellable', Number(data?.damaged || 0) + Number(data?.quarantine || 0), Warehouse, '', `${number(data?.damaged)} damaged · ${number(data?.quarantine)} quarantine`],
    ['Slow moving', data?.slowMovingProducts, TrendingDown, '', `${number(data?.slowMovingUnits)} units with no sale in 60 days`],
    ['Aged stock', data?.agedStockProducts, Clock3, '', `${number(data?.agedStockUnits)} units unchanged for 90 days`],
  ];
  if (canViewCost) cards.push(['Stock cost', money(data?.costValue), IndianRupee, '', `Retail value ${money(data?.retailValue)}`]);
  return <div className="inventory-summary" aria-busy={loading}>{cards.map(([title, value, Icon, filter, note]) => <button type="button" key={title} onClick={() => filter && onFilter(filter)} disabled={loading || !filter} className={filter ? 'is-actionable' : ''}><span><Icon size={18} /></span><div><small>{title}</small><strong>{loading ? '—' : typeof value === 'number' ? number(value) : value || '—'}</strong><p>{note}</p></div></button>)}</div>;
}

function StockPanel({ page, loading, error, filters, setFilters, access, onAdjust, onMarkOut, onHide, onOrder, onBulk, onRetry }) {
  return <section className="inventory-panel">
    <div className="inventory-filters">
      <label className="inventory-search"><Search size={17} /><input aria-label="Search inventory" value={filters.q} onChange={(event) => setFilters((value) => ({ ...value, q: event.target.value, page: 1 }))} placeholder="Product, SKU or barcode" /></label>
      <select aria-label="Stock filter" value={filters.status} onChange={(event) => setFilters((value) => ({ ...value, status: event.target.value, page: 1 }))}><option value="">All stock</option><option value="attention">Needs attention</option><option value="low">Low stock</option><option value="out">Sold out products</option><option value="variant-out">Variant sold out</option><option value="healthy">Healthy</option><option value="hidden">Hidden</option></select>
      <select aria-label="Inventory sort" value={filters.sort} onChange={(event) => setFilters((value) => ({ ...value, sort: event.target.value, page: 1 }))}><option value="updated">Recently changed</option><option value="name">Product name</option><option value="stock-low">Lowest stock</option><option value="stock-high">Highest stock</option></select>
      {access.canBulkAdjust && <button type="button" className="admin-btn-ghost" onClick={onBulk}><Upload size={16} /> Bulk import</button>}
    </div>
    <DataTable loading={loading} error={error} onRetry={onRetry} title="Live inventory" note={`${number(page.total)} matching products · Sellable excludes reserved and non-sellable units`} emptyTitle="No matching inventory" emptyNote="Try another search or stock filter." heads={['Product', 'Location', 'Sellable / on hand', 'Committed', 'Incoming', 'Non-sellable', 'Status', 'Actions']} minWidth={1120} rows={page.items.map((product) => <InventoryRow key={product._id} product={product} access={access} onAdjust={onAdjust} onMarkOut={onMarkOut} onHide={onHide} onOrder={onOrder} />)} />
    <Pagination page={page} loading={loading} noun="products" onPage={(next) => setFilters((value) => ({ ...value, page: next }))} onLimit={(limit) => setFilters((value) => ({ ...value, limit, page: 1 }))} />
  </section>;
}

function InventoryRow({ product, access, onAdjust, onMarkOut, onHide, onOrder }) {
  const photo = product.images?.find((image) => image.primary)?.url || product.images?.[0]?.url || product.primaryImage || '';
  return <tr>
    <td><div className="inventory-product">{photo ? <img src={photo} alt="" /> : <span><Boxes size={18} /></span>}<div><strong title={product.name}>{product.name}</strong><small>{product.sku || 'No product SKU'} · Alert at {product.lowStockAlert ?? 5}</small>{product.variants?.length > 0 && <details><summary>{product.variants.length} variants <ChevronDown size={13} /></summary><div>{product.variants.map((variant) => { const variantAvailable = Number(variant.available ?? variant.stock ?? 0); const variantStatus = variant.status || (variantAvailable <= 0 ? 'SOLD_OUT' : variantAvailable <= Number(variant.lowStockAlert ?? product.lowStockAlert ?? 5) ? 'LOW' : 'HEALTHY'); return <button type="button" key={variant._id} onClick={() => access.canAdjust && onAdjust(product, { ...variant, available: variantAvailable, status: variantStatus })}><span>{[variant.size, variant.color].filter(Boolean).join(' / ') || variant.sku || 'Variant'}</span><b className={`is-${variantStatus.toLowerCase()}`}>{variantAvailable} sellable</b><small>{variant.reserved || 0} reserved · {variant.incoming || 0} incoming</small></button>; })}</div></details>}</div></div></td>
    <td><strong>{product.inventoryLocation || 'Main stockroom'}</strong><small>{product.binLocation || 'No bin assigned'}</small></td>
    <td><strong>{number(product.available)}</strong><small>{number(product.onHand)} physical/on hand</small></td>
    <td><strong>{number(product.reserved)}</strong><small>Open fulfilment</small></td>
    <td><strong>{number(product.incoming)}</strong><small>Supplier orders</small></td>
    <td><strong>{number(product.damaged + product.quarantine)}</strong><small>{product.damaged} damaged · {product.quarantine} hold</small></td>
    <td><InventoryStatus value={product.inventoryStatus} variants={product.variants} /><small>{product.lastInventoryChangeAt ? `${new Date(product.lastInventoryChangeAt).toLocaleString('en-IN')} · ${product.lastInventoryChangedBy?.name || 'System'} · r${product.inventoryRevision ?? 0}` : `No stock change recorded · r${product.inventoryRevision ?? 0}`}</small></td>
    <td><div className="inventory-actions">{access.canAdjust && !product.variants?.length && <button type="button" onClick={() => onAdjust(product)}>Adjust</button>}{access.canReceive && !product.variants?.length && <button type="button" onClick={() => onOrder(product, null)}>Order stock</button>}{access.canAdjust && product.available > 0 && <button type="button" className="is-danger" onClick={() => onMarkOut(product)}>Mark out</button>}{access.canManageCatalog && product.isActive && <button type="button" onClick={() => onHide(product)}>Hide</button>}</div></td>
  </tr>;
}

function InventoryStatus({ value, variants = [] }) {
  const notes = { HEALTHY: 'Healthy', LOW: 'Low stock', SOLD_OUT: 'Sold out', VARIANT_OUT: 'Variant attention', HIDDEN: 'Hidden' };
  const affected = variants.filter((variant) => variant.status !== 'HEALTHY').length;
  return <span className={`inventory-status is-${String(value).toLowerCase()}`}>{notes[value] || label(value)}{affected > 0 && value !== 'SOLD_OUT' ? ` · ${affected}` : ''}</span>;
}

function PurchasePanel({ page, loading, error, filters, setFilters, access, onReceive, onCancel, onRetry }) {
  return <section className="inventory-panel"><div className="inventory-filters"><label className="inventory-search"><Search size={17} /><input value={filters.q} onChange={(event) => setFilters((value) => ({ ...value, q: event.target.value, page: 1 }))} placeholder="PO number, supplier, product or SKU" /></label><select value={filters.status} onChange={(event) => setFilters((value) => ({ ...value, status: event.target.value, page: 1 }))}><option value="">All purchase orders</option>{['ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'].map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></div>
    <DataTable loading={loading} error={error} onRetry={onRetry} title="Supplier purchase orders" note={`${number(page.total)} purchase orders · Incoming stock updates after receiving`} emptyTitle="No purchase orders yet" emptyNote="Create a purchase order to track expected and received stock." heads={['Purchase order', 'Supplier', 'Ordered', 'Received', 'Remaining', 'Expected', 'Status', 'Actions']} minWidth={980} rows={page.items.map((order) => <tr key={order._id}><td><strong>{order.number}</strong><small>{order.items.length} product lines</small></td><td><strong>{order.supplier?.name}</strong><small>{order.supplier?.phone || order.supplier?.email || 'No contact added'}</small></td><td><strong>{number(order.totals?.ordered)}</strong><small>{money(order.totals?.cost)}</small></td><td><strong>{number(order.totals?.received)}</strong><small>{number(order.totals?.damaged)} damaged</small></td><td><strong>{number(order.remaining)}</strong><small>Incoming units</small></td><td>{order.expectedAt ? new Date(order.expectedAt).toLocaleDateString('en-IN') : 'Not set'}</td><td><span className={`inventory-status is-${order.status.toLowerCase()}`}>{label(order.status)}</span></td><td><div className="inventory-actions">{access.canReceive && ['ORDERED', 'PARTIALLY_RECEIVED'].includes(order.status) && <button type="button" onClick={() => onReceive(order)}>Receive</button>}{access.canApprove && ['ORDERED', 'PARTIALLY_RECEIVED'].includes(order.status) && <button type="button" className="is-danger" onClick={() => onCancel(order)}>Cancel</button>}</div></td></tr>)} />
    <Pagination page={page} loading={loading} noun="purchase orders" onPage={(next) => setFilters((value) => ({ ...value, page: next }))} onLimit={(limit) => setFilters((value) => ({ ...value, limit, page: 1 }))} />
  </section>;
}

function HistoryPanel({ page, loading, error, filters, setFilters, access, onReverse, onRetry }) {
  const exportPage = () => downloadCsv('inventory-history.csv', page.items.map((item) => [item.createdAt, item.product?.name || '', item.sku || '', item.type, item.bucket || 'SELLABLE', item.quantity, item.stockBefore, item.stockAfter, item.reason || '', item.note || '', item.reference || '', item.createdBy?.name || 'System']), ['Time', 'Product', 'SKU', 'Type', 'Bucket', 'Change', 'Before', 'After', 'Reason', 'Note', 'Reference', 'Actor']);
  return <section className="inventory-panel"><div className="inventory-filters inventory-filters--history"><label className="inventory-search"><Search size={17} /><input value={filters.q} onChange={(event) => setFilters((value) => ({ ...value, q: event.target.value, page: 1 }))} placeholder="Product, SKU, actor, reason or reference" /></label><select value={filters.type} onChange={(event) => setFilters((value) => ({ ...value, type: event.target.value, page: 1 }))}><option value="">All movements</option>{TYPES.map((item) => <option key={item} value={item}>{label(item)}</option>)}</select><select value={filters.bucket} onChange={(event) => setFilters((value) => ({ ...value, bucket: event.target.value, page: 1 }))}><option value="">All buckets</option><option value="SELLABLE">Sellable</option><option value="DAMAGED">Damaged</option><option value="QUARANTINE">Quarantine</option></select><input aria-label="History from date" type="date" value={filters.from} onChange={(event) => setFilters((value) => ({ ...value, from: event.target.value, page: 1 }))} /><input aria-label="History to date" type="date" value={filters.to} onChange={(event) => setFilters((value) => ({ ...value, to: event.target.value, page: 1 }))} />{access.canExport && <button type="button" className="admin-btn-ghost" disabled={!page.items.length} onClick={exportPage}><Download size={16} /> Export page</button>}</div>
    <DataTable loading={loading} error={error} onRetry={onRetry} title="Append-only stock ledger" note={`${number(page.total)} movements · Existing records are never edited or deleted`} emptyTitle="No stock movements found" emptyNote="Try another filter or record a stock adjustment." heads={['Product', 'Movement', 'Before → after', 'Reason / reference', 'Actor', 'Time', 'Action']} minWidth={1080} rows={page.items.map((item) => <tr key={item._id}><td><strong>{item.product?.name || item.sku || 'Removed product'}</strong><small>{item.variantId ? `Variant …${item.variantId.slice(-6)}` : item.sku || 'Product level'}</small></td><td><strong className={item.quantity < 0 ? 'inventory-negative' : 'inventory-positive'}>{item.quantity > 0 ? '+' : ''}{item.quantity}</strong><small>{label(item.type)} · {label(item.bucket || 'SELLABLE')}</small></td><td><strong>{number(item.stockBefore)} → {number(item.stockAfter)}</strong><small>{label(item.mode || 'SYSTEM')}</small></td><td><strong>{item.reason || label(item.type)}</strong><small>{item.reference || item.note || 'No reference'}</small></td><td>{item.createdBy?.name || 'System'}</td><td><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString('en-IN')}</time></td><td>{access.canApprove && item.reversible ? <button className="admin-table-action-link" type="button" onClick={() => onReverse(item)}><Undo2 size={14} /> Undo</button> : item.reversedBy ? <small>Reversed</small> : '—'}</td></tr>)} />
    <Pagination page={page} loading={loading} noun="movements" onPage={(next) => setFilters((value) => ({ ...value, page: next }))} onLimit={(limit) => setFilters((value) => ({ ...value, limit, page: 1 }))} />
  </section>;
}

function AdjustmentDialog({ base, selection, onClose, onSaved }) {
  const { product, variant, bucket: initialBucket } = selection;
  const [form, setForm] = useState({ mode: 'ADD', bucket: initialBucket, quantity: '', reasonCode: initialBucket === 'DAMAGED' ? 'DAMAGED' : 'PURCHASE_RECEIPT', note: '', reference: '' });
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const source = variant || product;
  const before = form.bucket === 'SELLABLE' ? Number(source.available ?? source.stock ?? 0) : Number(source[form.bucket === 'DAMAGED' ? 'damaged' : 'quarantine'] || 0);
  const quantity = Number(form.quantity || 0);
  const after = form.mode === 'SET' ? quantity : form.mode === 'ADD' ? before + quantity : before - quantity;
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await api.post(`${base}/inventory/adjustments`, { productId: product._id, ...(variant ? { variantId: variant._id } : {}), ...form, quantity, expectedStock: before, expectedRevision: product.inventoryRevision ?? 0, idempotencyKey: requestKey() });
      onSaved(`${product.name}${variant ? ` · ${[variant.size, variant.color].filter(Boolean).join(' / ')}` : ''} changed from ${before} to ${after}.`);
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  };
  return <Dialog title="Adjust inventory" eyebrow="Controlled stock change" onClose={onClose} busy={busy}><form className="inventory-dialog-form" onSubmit={submit}><div className="inventory-selection"><Boxes size={20} /><div><strong>{product.name}</strong><small>{variant ? [variant.size, variant.color, variant.sku].filter(Boolean).join(' · ') : product.sku || 'Product level stock'}</small></div></div><div className="inventory-three"><Field label="Action"><select value={form.mode} onChange={(event) => setForm({ ...form, mode: event.target.value })}><option value="ADD">Add</option><option value="REMOVE">Remove</option><option value="SET">Set exact</option></select></Field><Field label="Stock bucket"><select value={form.bucket} onChange={(event) => setForm({ ...form, bucket: event.target.value })}><option value="SELLABLE">Sellable</option><option value="DAMAGED">Damaged</option><option value="QUARANTINE">Quarantine</option></select></Field><Field label="Quantity"><input autoFocus required min={form.mode === 'SET' ? 0 : 1} step="1" type="number" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></Field></div><div className="inventory-preview"><span>Current <b>{before}</b></span><span>Change <b>{form.mode === 'REMOVE' ? '-' : form.mode === 'ADD' ? '+' : '='}{quantity}</b></span><span>After <b className={after < 0 ? 'inventory-negative' : ''}>{after}</b></span></div><Field label="Reason"><select required value={form.reasonCode} onChange={(event) => setForm({ ...form, reasonCode: event.target.value })}>{REASONS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></Field><div className="inventory-two"><Field label="Reference (optional)"><input maxLength="120" value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} placeholder="Invoice, GRN or count sheet" /></Field><Field label="Staff note (optional)"><input maxLength="500" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Why this changed" /></Field></div>{error && <p role="alert" className="inventory-form-error">{error}</p>}<DialogActions onClose={onClose} busy={busy} confirm="Save adjustment" disabled={!form.quantity || after < 0} /></form></Dialog>;
}

function MarkOutDialog({ base, product, onClose, onSaved }) {
  const [confirmed, setConfirmed] = useState(false); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const submit = async () => { setBusy(true); setError(''); try { await api.patch(`${base}/products/${product._id}/mark-out-of-stock`, { confirm: true, expectedRevision: product.inventoryRevision ?? 0, reasonCode: 'STOCK_COUNT', note, idempotencyKey: requestKey() }); onSaved(); } catch (failure) { setError(failure.message); } finally { setBusy(false); } };
  return <Dialog title="Mark all sellable stock out?" eyebrow="Inventory confirmation" onClose={onClose} busy={busy}><div className="inventory-danger-box"><AlertTriangle size={22} /><div><strong>{product.name}</strong><p>This changes {number(product.available)} sellable units to zero across every active variant. Reserved, damaged and quarantine quantities are not changed.</p></div></div><Field label="Reason note"><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength="500" placeholder="Describe the stock count or correction" /></Field><label className="inventory-check"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />I reviewed the quantity and want to set all sellable variants to zero.</label>{error && <p role="alert" className="inventory-form-error">{error}</p>}<div className="inventory-dialog-actions"><button type="button" onClick={onClose} disabled={busy}>Keep stock</button><button type="button" className="is-danger" disabled={!confirmed || busy} onClick={submit}>{busy ? 'Saving…' : 'Mark out of stock'}</button></div></Dialog>;
}

function BulkDialog({ base, onClose, onSaved }) {
  const [form, setForm] = useState({ mode: 'ADD', reasonCode: 'IMPORT', note: '', rows: '' }); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const parsed = useMemo(() => form.rows.split(/\r?\n/).map((row) => row.trim()).filter(Boolean).map((row) => { const [sku, quantity] = row.split(',').map((cell) => cell.trim()); return { sku, quantity: Number(quantity) }; }), [form.rows]);
  const valid = parsed.length > 0 && parsed.length <= 100 && parsed.every((row) => row.sku && Number.isSafeInteger(row.quantity) && row.quantity >= (form.mode === 'SET' ? 0 : 1));
  const submit = async (event) => { event.preventDefault(); setBusy(true); setError(''); try { const result = await api.post(`${base}/inventory/bulk-adjustments`, { mode: form.mode, bucket: 'SELLABLE', reasonCode: form.reasonCode, note: form.note, idempotencyKey: requestKey(), items: parsed }); if (result.failed) throw new Error(`${result.updated} updated; ${result.failed} failed. ${result.results.find((item) => !item.success)?.message || ''}`); onSaved(`${result.updated} inventory records updated.`); } catch (failure) { setError(failure.message); } finally { setBusy(false); } };
  return <Dialog title="Bulk inventory import" eyebrow="Preview before applying" onClose={onClose} busy={busy}><form className="inventory-dialog-form" onSubmit={submit}><p className="inventory-help">Paste one item per line as <b>SKU or barcode, quantity</b>. Barcode scanners and variant SKUs are supported. Up to 100 rows are processed with duplicate-request protection.</p><div className="inventory-two"><Field label="Action"><select value={form.mode} onChange={(event) => setForm({ ...form, mode: event.target.value })}><option value="ADD">Add quantities</option><option value="REMOVE">Remove quantities</option><option value="SET">Set exact quantities</option></select></Field><Field label="Reason"><select value={form.reasonCode} onChange={(event) => setForm({ ...form, reasonCode: event.target.value })}>{REASONS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></Field></div><Field label="Inventory rows"><textarea className="inventory-csv" required value={form.rows} onChange={(event) => setForm({ ...form, rows: event.target.value })} placeholder={'SAREE-RED, 12\nKURTA-M-BLUE, 6'} /></Field><Field label="Import note"><input maxLength="500" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Stock count sheet or supplier invoice" /></Field><div className={valid ? 'inventory-import-preview is-valid' : 'inventory-import-preview'}><ClipboardCheck size={18} /><span>{parsed.length} rows detected</span><b>{valid ? 'Ready to apply' : 'Check SKU and whole quantities'}</b></div>{error && <p role="alert" className="inventory-form-error">{error}</p>}<DialogActions onClose={onClose} busy={busy} confirm="Apply inventory import" disabled={!valid} /></form></Dialog>;
}

export function PurchaseOrderDialog({ base, value, setValue, options: initialOptions = [], onClose, onSaved }) {
  const [resolvedOptions, setResolvedOptions] = useState([]);
  const options = [...new Map([...resolvedOptions, ...initialOptions].map(option => [option.key, option])).values()];
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const updateLine = (index, patch) => setValue({ ...value, items: value.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) });
  const submit = async (event) => { event.preventDefault(); setBusy(true); setError(''); try { const items = value.items.map((item) => { const option = options.find((choice) => choice.key === item.selection); return { productId: option?.product._id, ...(option?.variant ? { variantId: option.variant._id } : {}), quantity: Number(item.quantity), unitCost: Number(item.unitCost || 0) }; }); const result = await api.post(`${base}/inventory/purchase-orders`, { supplier: value.supplier, expectedAt: value.expectedAt || undefined, notes: value.notes, items }); onSaved(`${result.number} created for ${result.supplier.name}.`); } catch (failure) { setError(failure.message); } finally { setBusy(false); } };
  return <Dialog title="Create purchase order" eyebrow="Incoming stock" onClose={onClose} busy={busy}><form className="inventory-dialog-form" onSubmit={submit}><WorkflowSmartFill workflow="purchase" form={value} onChange={(next, rows, undoing, result) => { const incoming = (result?.purchaseOptions || []).filter(option => /^[a-f0-9]{24}$/i.test(option.productId) && (!option.variantId || /^[a-f0-9]{24}$/i.test(option.variantId)) && option.key === `${option.productId}${option.variantId ? `:${option.variantId}` : ""}`).map(option => ({ key: option.key, name: `${option.name} · ${option.sku}`, product: { _id: option.productId, name: option.name, sku: option.sku }, ...(option.variantId ? { variant: { _id: option.variantId, sku: option.sku } } : {}) })); const known = new Set([...options, ...incoming].map(option => option.key)); if (next.items.some(item => item.selection && !known.has(item.selection))) { setError("This purchase preview is incomplete. Refresh suggestions before applying its SKU lines."); return false; } setResolvedOptions(current => [...new Map([...current, ...incoming].map(option => [option.key, option])).values()]); setValue(next); setError(""); }} apiBase={`${base}/smart-fill`} documents disabled={busy} /><div className="inventory-three"><Field label="Supplier name"><input autoFocus required maxLength="160" value={value.supplier.name} onChange={(event) => setValue({ ...value, supplier: { ...value.supplier, name: event.target.value } })} /></Field><Field label="Supplier phone"><input maxLength="30" value={value.supplier.phone} onChange={(event) => setValue({ ...value, supplier: { ...value.supplier, phone: event.target.value } })} /></Field><Field label="Supplier email"><input type="email" maxLength="160" value={value.supplier.email} onChange={(event) => setValue({ ...value, supplier: { ...value.supplier, email: event.target.value } })} /></Field></div><Field label="Expected arrival"><input type="date" value={value.expectedAt} onChange={(event) => setValue({ ...value, expectedAt: event.target.value })} /></Field><div className="inventory-po-lines"><header><strong>Products to order</strong><button type="button" onClick={() => setValue({ ...value, items: [...value.items, { selection: options[0]?.key || '', quantity: 1, unitCost: options[0]?.product?.costPrice || 0 }] })}><Plus size={14} /> Add line</button></header>{value.items.map((item, index) => <div key={index} className="inventory-po-line"><select aria-label={`Purchase product ${index + 1}`} required value={item.selection} onChange={(event) => { const option = options.find((choice) => choice.key === event.target.value); updateLine(index, { selection: event.target.value, unitCost: option?.product.costPrice || 0 }); }}><option value="">Choose product or variant</option>{options.map((option) => <option key={option.key} value={option.key}>{option.name}</option>)}</select><input aria-label={`Purchase quantity ${index + 1}`} required type="number" min="1" step="1" value={item.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} /><input aria-label={`Unit cost ${index + 1}`} type="number" min="0" step="0.01" value={item.unitCost} onChange={(event) => updateLine(index, { unitCost: event.target.value })} />{value.items.length > 1 && <button type="button" aria-label={`Remove purchase line ${index + 1}`} onClick={() => setValue({ ...value, items: value.items.filter((_, itemIndex) => itemIndex !== index) })}><X size={15} /></button>}</div>)}</div><Field label="Purchase note"><textarea maxLength="1000" value={value.notes} onChange={(event) => setValue({ ...value, notes: event.target.value })} placeholder="Supplier terms, reference or delivery instructions" /></Field>{!options.length && <p className="inventory-form-error">Search for the product in the Stock tab before creating its purchase order.</p>}{error && <p role="alert" className="inventory-form-error">{error}</p>}<DialogActions onClose={onClose} busy={busy} confirm="Create purchase order" disabled={!options.length || !value.items.every((item) => item.selection && Number(item.quantity) > 0)} /></form></Dialog>;
}

function ReceivingDialog({ base, order, onClose, onSaved }) {
  const initial = order.items.filter((item) => Number(item.orderedQuantity) > Number(item.receivedQuantity || 0) + Number(item.damagedQuantity || 0)).map((item) => ({ itemId: item._id, name: item.productName, sku: item.sku, remaining: Number(item.orderedQuantity) - Number(item.receivedQuantity || 0) - Number(item.damagedQuantity || 0), quantity: 0, damagedQuantity: 0 }));
  const [items, setItems] = useState(initial); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const update = (index, patch) => setItems((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  const selected = items.filter((item) => Number(item.quantity) + Number(item.damagedQuantity) > 0);
  const submit = async (event) => { event.preventDefault(); setBusy(true); setError(''); try { const result = await api.post(`${base}/inventory/purchase-orders/${order._id}/receive`, { revision: order.revision, note, items: selected.map(({ itemId, quantity, damagedQuantity }) => ({ itemId, quantity: Number(quantity), damagedQuantity: Number(damagedQuantity) })) }); onSaved(`${result.number}: ${selected.reduce((sum, item) => sum + Number(item.quantity), 0)} sellable units received.`); } catch (failure) { setError(failure.message); } finally { setBusy(false); } };
  return <Dialog title={`Receive ${order.number}`} eyebrow="Goods receiving" onClose={onClose} busy={busy}><form className="inventory-dialog-form" onSubmit={submit}><p className="inventory-help">Record only quantities physically checked. Damaged units are kept out of sellable stock.</p><div className="inventory-receive-lines">{items.map((item, index) => <div key={item.itemId}><div><strong>{item.name}</strong><small>{item.sku || 'No SKU'} · {item.remaining} remaining</small></div><Field label="Sellable"><input type="number" min="0" max={item.remaining - Number(item.damagedQuantity || 0)} step="1" value={item.quantity} onChange={(event) => update(index, { quantity: event.target.value })} /></Field><Field label="Damaged"><input type="number" min="0" max={item.remaining - Number(item.quantity || 0)} step="1" value={item.damagedQuantity} onChange={(event) => update(index, { damagedQuantity: event.target.value })} /></Field></div>)}</div><Field label="Receiving note"><textarea value={note} maxLength="500" onChange={(event) => setNote(event.target.value)} placeholder="Package condition, invoice or GRN reference" /></Field>{error && <p role="alert" className="inventory-form-error">{error}</p>}<DialogActions onClose={onClose} busy={busy} confirm="Receive selected stock" disabled={!selected.length || items.some((item) => Number(item.quantity) + Number(item.damagedQuantity) > item.remaining)} /></form></Dialog>;
}

function ConfirmDialog({ title, note, confirm, danger, onClose, onConfirm }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const run = async () => { setBusy(true); setError(''); try { await onConfirm(); } catch (failure) { setError(failure.message); setBusy(false); } };
  return <Dialog title={title} eyebrow="Please review" onClose={onClose} busy={busy}><p className="inventory-confirm-note">{note}</p>{error && <p role="alert" className="inventory-form-error">{error}</p>}<div className="inventory-dialog-actions"><button type="button" onClick={onClose} disabled={busy}>Keep unchanged</button><button type="button" className={danger ? 'is-danger' : 'is-primary'} onClick={run} disabled={busy}>{busy ? 'Saving…' : confirm}</button></div></Dialog>;
}

function Dialog({ title, eyebrow, onClose, busy, children }) {
  useEffect(() => { const close = (event) => { if (event.key === 'Escape' && !busy) onClose(); }; document.addEventListener('keydown', close); return () => document.removeEventListener('keydown', close); }, [busy, onClose]);
  return <div className="inventory-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}><section role="dialog" aria-modal="true" aria-labelledby="inventory-dialog-title" className="inventory-dialog"><header><div><small>{eyebrow}</small><h2 id="inventory-dialog-title">{title}</h2></div><button type="button" onClick={onClose} disabled={busy} aria-label="Close dialog"><X size={19} /></button></header>{children}</section></div>;
}

function Field({ label: title, children }) { return <label className="inventory-field"><span>{title}</span>{children}</label>; }
function DialogActions({ onClose, busy, confirm, disabled }) { return <div className="inventory-dialog-actions"><button type="button" onClick={onClose} disabled={busy}>Cancel</button><button type="submit" className="is-primary" disabled={busy || disabled}>{busy ? 'Saving…' : confirm}</button></div>; }
function Pagination({ page, loading, noun, onPage, onLimit }) { return <nav className="inventory-pagination" aria-label={`${noun} pagination`}><label>Show<select value={page.limit} onChange={(event) => onLimit(Number(event.target.value))}><option value="20">20</option><option value="25">25</option><option value="50">50</option><option value="100">100</option></select></label><p>Page {page.page} of {page.totalPages} · {number(page.total)} {noun}</p><div><button type="button" disabled={loading || page.page <= 1} onClick={() => onPage(page.page - 1)}>Previous</button><button type="button" disabled={loading || page.page >= page.totalPages} onClick={() => onPage(page.page + 1)}>Next</button></div></nav>; }
function downloadCsv(filename, rows, headers) { const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`; const body = [headers, ...rows.map((row) => Array.isArray(row) ? row : Object.values(row))].map((row) => row.map(escape).join(',')).join('\r\n'); const url = URL.createObjectURL(new Blob([body], { type: 'text/csv;charset=utf-8' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 500); }
