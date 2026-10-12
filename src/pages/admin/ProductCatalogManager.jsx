import useAdminFeedback from '../../hooks/useAdminFeedback';
import AdminFeedback from '../../components/admin/AdminFeedback';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, Archive, Banknote, Camera, Check, ChevronDown, Copy, Download, Eye,
  FilePlus2, MessageSquareText, MoreHorizontal, Package, PackageCheck, PackageSearch,
  PackageX, PencilLine, Plus, RotateCcw, Sparkles, Square, Trash2, X,
} from 'lucide-react';
import api from '../../services/api';
import ConfirmModal from '../../components/admin/ConfirmModal';
import ProductDeleteDialog from '../../components/admin/ProductDeleteDialog';
import StatusBadge from '../../components/admin/StatusBadge';
import ProductForm from '../../components/admin/ProductForm';
import BulkCatalogSmartFill from '../../components/admin/BulkCatalogSmartFill';
import { Select as UiSelect } from '../../components/ui/Field';
import { fetchCategories } from '../../utils/catalogOptions';
import { getPrimaryImageUrl } from '../../services/normalize';
import ProductPosterModal from '../../components/admin/ProductPosterModal';
import ProductCaptionModal from '../../components/admin/ProductCaptionModal';
import StockInput from '../../components/admin/StockInput';
import PageState from '../../components/ui/PageState';
import '../../components/admin/AdminShell.css';

const DEFAULT_SUMMARY = { total: 0, active: 0, low: 0, out: 0, archived: 0, retailValue: 0, costValue: 0 };

export default function ProductCatalogManager({ route = '/admin/products', apiPrefix, navigate }) {
  const prefix = apiPrefix || (route.startsWith('/seller') ? '/seller' : '/admin');
  const productsPath = `${prefix}/products`;
  const isAdmin = prefix === '/admin';
  const routeParams = new URLSearchParams(route.split('?')[1] || '');
  const routeSearch = routeParams.get('search') || '';
  const routeStoreId = isAdmin ? (routeParams.get('storeId') || '') : '';
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [query, setQuery] = useState(routeSearch);
  const deferredQuery = useDeferredValue(query);
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [stock, setStock] = useState('');
  const [archive, setArchive] = useState('');
  const [completeness, setCompleteness] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [summary, setSummary] = useState(DEFAULT_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useAdminFeedback(null, 'success', 'Products');
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState('');
  const [actionBusy, setActionBusy] = useState('');
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editor, setEditor] = useState(null);
  useEffect(() => { const id = new URLSearchParams(route.split('?')[1] || '').get('edit'); if (/^[a-f\d]{24}$/i.test(id || '')) setEditor({ mode: 'Edit', id }); }, [route]);
  const [settings, setSettings] = useState(null);
  const [posterProduct, setPosterProduct] = useState(null);
  const [captionProduct, setCaptionProduct] = useState(null);
  const [smartBatch, setSmartBatch] = useState(null);
  const [smartBusy, setSmartBusy] = useState(false);
  const requestRevision = useRef(0);
  const isDesktop = useResponsiveDesktop();

  const activeFilters = useMemo(() => ({
    search: deferredQuery.trim(), category, status, stock, archive, completeness, sort,
  }), [archive, category, completeness, deferredQuery, sort, status, stock]);

  const loadCatalog = useCallback(async () => {
    const revision = ++requestRevision.current;
    setLoading(true);
    setLoadError('');
    const params = new URLSearchParams({ admin: 'true', page: String(page), limit: String(pageSize), includeSummary: 'true', sort });
    if (routeStoreId) params.set('storeId', routeStoreId);
    Object.entries(activeFilters).forEach(([key, value]) => { if (value && key !== 'sort') params.set(key, value); });
    try {
      const response = await api.get(`${productsPath}?${params.toString()}`);
      if (revision !== requestRevision.current) return;
      if (!Array.isArray(response) && !Array.isArray(response?.items)) {
        throw new Error('Product catalog returned invalid data. Please try again.');
      }
      const items = Array.isArray(response) ? response : response.items;
      setProducts(items);
      setTotal(Array.isArray(response) ? response.length : Number(response.total || 0));
      setPageCount(Array.isArray(response) ? 1 : Math.max(1, Number(response.totalPages || 1)));
      setSummary(response?.summary || summarize(items));
    } catch (error) {
      if (revision === requestRevision.current) setLoadError(error.message);
    } finally {
      if (revision === requestRevision.current) setLoading(false);
    }
  }, [activeFilters, page, pageSize, productsPath, routeStoreId, sort]);

  useEffect(() => { loadCatalog(); }, [loadCatalog]);
  useEffect(() => {
    let alive = true;
    Promise.allSettled([
      fetchCategories(api, prefix, routeStoreId),
      api.get(isAdmin ? '/settings' : '/seller/settings'),
    ]).then(([categoryResult, settingsResult]) => {
      if (!alive) return;
      if (categoryResult.status === 'fulfilled') setCategories(categoryResult.value);
      if (settingsResult.status === 'fulfilled') setSettings(settingsResult.value);
    });
    return () => { alive = false; };
  }, [isAdmin, prefix, routeStoreId]);
  useEffect(() => { setQuery(routeSearch); setPage(1); }, [routeSearch]);
  useEffect(() => { setPage((current) => Math.min(current, pageCount)); }, [pageCount]);

  const reload = loadCatalog;
  const clearFilters = () => {
    setQuery(''); setCategory(''); setStatus(''); setStock(''); setArchive(''); setCompleteness(''); setSort('newest'); setPage(1);
  };
  const changeFilter = (setter) => (value) => { setter(value); setPage(1); setSelectedIds([]); };
  const selectedOnPage = products.length > 0 && products.every((product) => selectedIds.includes(product._id));
  const toggleSelected = (id) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const toggleSelectAll = () => setSelectedIds((current) => selectedOnPage
    ? current.filter((id) => !products.some((product) => product._id === id))
    : [...new Set([...current, ...products.map((product) => product._id)])]);

  const runAction = async (key, action, success) => {
    if (actionBusy) return;
    setActionBusy(key);
    setMessage(null);
    try {
      const result = await action();
      setMessage({ tone: 'success', text: success || result?.message || 'Product updated.' });
      reload();
      return result;
    } catch (error) {
      setMessage({ tone: 'error', text: error.message });
      throw error;
    } finally {
      setActionBusy('');
    }
  };

  const setVisibility = (product) => runAction(`status:${product._id}`, () => api.patch(`${productsPath}/${product._id}/status`, { isActive: !product.isActive }), `${product.name} is now ${product.isActive ? 'hidden' : 'visible'} on the storefront.`).catch(() => {});
  const updateStock = (product, value) => runAction(`stock:${product._id}`, () => api.patch(`${productsPath}/${product._id}/stock`, { stock: Number(value) }), 'Stock updated.');
  const duplicate = (product) => runAction(`duplicate:${product._id}`, () => api.post(`${productsPath}/${product._id}/duplicate`, {}), 'Inactive product copy created. Review it before publishing.').catch(() => {});
  const restore = (product) => runAction(`restore:${product._id}`, () => api.patch(`${productsPath}/${product._id}/restore`, {}), `${product.name} restored as inactive.`).catch(() => {});
  const requestArchive = (product) => setConfirmTarget({
    title: 'Archive product?',
    message: `${product.name} will leave the live catalog. Orders and reports remain unchanged, and you can restore it later.`,
    label: 'Archive product',
    run: () => runAction(`archive:${product._id}`, () => api.delete(`${productsPath}/${product._id}`), 'Product archived.'),
  });
  const requestOutOfStock = (product) => setConfirmTarget({
    title: 'Mark product out of stock?',
    message: `All available stock for ${product.name}${product.variants?.length ? ', including every variant,' : ''} will be set to zero.`,
    label: 'Set stock to zero',
    run: () => runAction(`out:${product._id}`, () => api.patch(`${productsPath}/${product._id}/mark-out-of-stock`, { confirm: true, expectedRevision: product.inventoryRevision ?? 0, reasonCode: 'CORRECTION' }), 'Product marked out of stock.'),
  });

  const executeBulk = () => {
    if (!bulkAction || !selectedIds.length) return;
    const labels = { archive: 'archive', 'out-of-stock': 'mark out of stock' };
    const run = () => runAction(`bulk:${bulkAction}`, () => api.post(`${productsPath}/bulk`, { ids: selectedIds, action: bulkAction }), `${selectedIds.length} selected product${selectedIds.length === 1 ? '' : 's'} updated.`).then(() => { setSelectedIds([]); setBulkAction(''); });
    if (['archive', 'out-of-stock'].includes(bulkAction)) {
      setConfirmTarget({ title: `${labels[bulkAction]} selected products?`, message: `This will ${labels[bulkAction]} ${selectedIds.length} selected product${selectedIds.length === 1 ? '' : 's'}.`, label: 'Continue', run });
    } else run().catch(() => {});
  };

  const exportCatalog = async () => {
    const params = new URLSearchParams();
    if (selectedIds.length) params.set('ids', selectedIds.join(','));
    else Object.entries(activeFilters).forEach(([key, value]) => { if (value) params.set(key, value); });
    await runAction('export', async () => {
      const result = await api.get(`${productsPath}/export?${params.toString()}`);
      downloadCsv(result.items || [], `product-catalog-${new Date().toISOString().slice(0, 10)}.csv`);
      return { message: `${result.items?.length || 0} products exported.` };
    }).catch(() => {});
  };

  const openAdd = () => setEditor({ mode: 'Add', id: '' });
  const openEdit = (product) => setEditor({ mode: 'Update', id: product._id });
  const closeEditor = () => setEditor(null);
  const applyMetric = (key) => {
    setPage(1); setSelectedIds([]);
    if (key === 'total') { setArchive(''); setStatus(''); setStock(''); }
    if (key === 'active') { setArchive(''); setStatus('active'); setStock(''); }
    if (key === 'low') { setArchive(''); setStatus(''); setStock('low'); }
    if (key === 'out') { setArchive(''); setStatus(''); setStock('out'); }
    if (key === 'archived') { setArchive('only'); setStatus(''); setStock(''); }
  };

  if (loadError && !products.length) return <PageState error={loadError} onRetry={reload} />;
  const hasCatalogFilters = Boolean(query.trim() || category || status || stock || completeness || archive || sort !== 'newest');

  return (
    <section className="product-catalog-workspace catalog-compact-workspace">
      <div className="catalog-workspace-toolbar catalog-workspace-toolbar--products" aria-label="Product actions">
        <button type="button" onClick={exportCatalog} disabled={actionBusy === 'export'} className="admin-btn-ghost disabled:opacity-50"><Download className="h-4 w-4" />{actionBusy === 'export' ? 'Exporting...' : selectedIds.length ? `Export ${selectedIds.length}` : 'Export CSV'}</button>
        {isAdmin && <details className="catalog-add-menu">
          <summary className="admin-btn-ghost cursor-pointer list-none" aria-label="More ways to add">Add options <ChevronDown className="h-4 w-4" /></summary>
          <div className="catalog-add-menu__options absolute right-0 z-40 mt-2 grid w-64 gap-1 rounded-2xl border border-theme-border bg-[color:var(--site-surface)] p-2 shadow-xl">
            <AddLink href="/admin/products/quick-add" icon={Sparkles} title="Quick Add from photos" note="Create a product with fewer fields" />
            <AddLink href="/admin/social-import" icon={Download} title="Import social link" note="Instagram or Facebook post" />
            <AddLink href="/admin/reel-import" icon={Camera} title="Import product reel" note="Choose clear video frames" />
            <AddLink href="/admin/product-drafts" icon={FilePlus2} title="Product drafts" note="Review saved and imported work" />
          </div>
        </details>}
        <button type="button" onClick={openAdd} className="admin-btn"><Plus className="h-4 w-4" />Add Product</button>
      </div>

      {smartBatch && <BulkCatalogSmartFill key={`${prefix}:${routeStoreId}`} ids={smartBatch} apiBase={`${prefix}/smart-fill${routeStoreId ? `?storeId=${encodeURIComponent(routeStoreId)}` : ''}`} disabled={!!actionBusy} onBusyChange={setSmartBusy} onClose={() => setSmartBatch(null)} onSaved={count => { setMessage({ tone: 'success', text: `${count} products: reviewed content saved. Any individual failures are shown in the Smart Fill panel.` }); reload(); }} />}
      <div className="admin-kpi-strip">
        <KpiTile icon={Package} tone="wine" label="Current catalog" value={summary.total} note="All current products" active={!archive && !status && !stock} onClick={() => applyMetric('total')} />
        <KpiTile icon={PackageCheck} tone="green" label="Active" value={summary.active} note="Enabled listings" active={!archive && status === 'active'} onClick={() => applyMetric('active')} />
        <KpiTile icon={AlertTriangle} tone="amber" label="Low stock" value={summary.low} note="Needs attention" active={!archive && stock === 'low'} onClick={() => applyMetric('low')} />
        <KpiTile icon={PackageX} tone="rose" label="Out of stock" value={summary.out} note="No units available" active={!archive && stock === 'out'} onClick={() => applyMetric('out')} />
        <KpiTile icon={Archive} tone="slate" label="Archived" value={summary.archived} note="Restorable products" active={archive === 'only'} onClick={() => applyMetric('archived')} />
        <KpiTile icon={Banknote} tone="gold" label="Retail stock value" value={formatCurrency(summary.retailValue)} note="Selling price × available stock" />
      </div>

      <section className="admin-card catalog-filter-panel" aria-label="Filter products">
        <div className="catalog-filter-grid">
          <label className="catalog-filter-search">Search products<span className="catalog-filter-search__control"><PackageSearch size={16} aria-hidden="true" /><input type="search" aria-label="Search products" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Name, SKU, fabric or details" /></span></label>
          <label>Category<Select label="Category filter" value={category} onChange={changeFilter(setCategory)} options={[['', 'All categories'], ...categories.map((item) => [item._id, item.name])]} /></label>
          <label>Visibility<Select label="Status filter" value={status} onChange={changeFilter(setStatus)} options={[['', 'All visibility'], ['active', 'Active'], ['inactive', 'Inactive']]} /></label>
          <label>Sort by<Select label="Sort products" value={sort} onChange={changeFilter(setSort)} options={[['newest', 'Newest'], ['updated', 'Recently updated'], ['priceHighLow', 'Price: high to low'], ['priceLowHigh', 'Price: low to high'], ['stock', 'Lowest stock']]} /></label>
        </div>
        <details className="catalog-filter-more"><summary>More filters{stock || completeness ? ` (${[stock, completeness].filter(Boolean).length})` : ''}</summary><div>
          <label>Stock<Select label="Stock filter" value={stock} onChange={changeFilter(setStock)} options={[['', 'All stock'], ['low', 'Low stock'], ['out', 'Out of stock'], ['in', 'In stock']]} /></label>
          <label>Listing quality<Select label="Completeness filter" value={completeness} onChange={changeFilter(setCompleteness)} options={[['', 'All quality'], ['missing-media', 'Missing media'], ['missing-seo', 'Missing SEO']]} /></label>
        </div></details>
        {hasCatalogFilters && <div className="catalog-filter-active"><span>{archive === 'only' ? 'Archived products' : 'Filters applied'}</span><button type="button" onClick={clearFilters}><X size={14} />Clear filters</button></div>}
      </section>

      <AdminFeedback message={message} type="success" title="Products" onDismiss={() => setMessage(null)} />

      {selectedIds.length > 0 && <div className="admin-card catalog-product-bulk-bar sticky top-3 z-30 flex flex-wrap items-center justify-between gap-3 border-wine/20 bg-[color:var(--site-tint)] p-3 shadow-lg">
        <strong title="Selections can continue across pages.">{selectedIds.length} selected</strong>
        <div className="flex flex-1 flex-wrap justify-end gap-2">
          <button type="button" disabled={!!actionBusy || smartBusy} onClick={() => { if (!smartBatch || window.confirm('Replace the open Smart Fill batch? Unsaved staged content will be discarded.')) setSmartBatch([...selectedIds]); }} className="admin-btn-ghost"><Sparkles className="h-4 w-4" />Smart Fill selected</button>
          <Select label="Bulk action" value={bulkAction} onChange={setBulkAction} options={[['', 'Choose bulk action'], ...(archive === 'only' ? [['restore', 'Restore as inactive']] : [['activate', 'Make active'], ['deactivate', 'Make inactive'], ['feature', 'Mark featured'], ['unfeature', 'Remove featured'], ['best-seller', 'Mark best seller'], ['remove-best-seller', 'Remove best seller'], ['out-of-stock', 'Set stock to zero'], ['archive', 'Archive']])]} />
          <button type="button" onClick={executeBulk} disabled={!bulkAction || !!actionBusy} className="admin-btn disabled:opacity-50">Apply</button>
          <button type="button" onClick={() => setSelectedIds([])} disabled={!!actionBusy} className="admin-btn-ghost">Clear</button>
        </div>
      </div>}

      <div className="admin-card catalog-list-panel overflow-hidden">
        <div className="catalog-list-panel__header">
          <h2>{archive === 'only' ? 'Archived products' : 'Product catalog'} ({total})</h2>
          <button type="button" onClick={toggleSelectAll} disabled={!products.length || loading} className="admin-btn-ghost"><span className="grid h-5 w-5 place-items-center rounded border border-[color:var(--site-border)] bg-[color:var(--site-surface)]">{selectedOnPage ? <Check className="h-3 w-3 text-wine" /> : <Square className="h-3 w-3 text-[color:var(--site-faint)]" />}</span>{selectedOnPage ? 'Clear this page' : 'Select this page'}</button>
        </div>

        {loading ? <CatalogSkeleton /> : products.length ? <>
          {isDesktop ? <div className="overflow-x-auto">
            <table className="admin-catalog-table">
              <thead><tr><th className="w-12">Select</th><th className="admin-catalog-product">Product</th><th>SKU / category</th><th>Pricing</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>{products.map((product) => <DesktopRow key={product._id} product={product} inventoryPath={`${prefix}/inventory`} selected={selectedIds.includes(product._id)} busy={actionBusy} onSelect={toggleSelected} onEdit={openEdit} onStatus={setVisibility} onStock={updateStock} onPoster={setPosterProduct} onCaption={setCaptionProduct} onOut={requestOutOfStock} onArchive={requestArchive} onRestore={restore} onDuplicate={duplicate} onDelete={setDeleteTarget} />)}</tbody>
            </table>
          </div> : <div className="divide-y divide-[#f0e5dc]">{products.map((product) => <MobileProductCard key={product._id} product={product} selected={selectedIds.includes(product._id)} busy={actionBusy} onSelect={toggleSelected} onEdit={openEdit} onStatus={setVisibility} onOut={requestOutOfStock} onArchive={requestArchive} onRestore={restore} onDuplicate={duplicate} onDelete={setDeleteTarget} />)}</div>}
        </> : <div className="catalog-empty-state"><h3>{archive === 'only' ? 'No archived products' : hasCatalogFilters ? 'No products match these filters' : 'No products yet'}</h3>{archive !== 'only' && hasCatalogFilters ? <button type="button" onClick={clearFilters} className="admin-btn-ghost">Clear filters</button> : <p>{archive === 'only' ? 'Archived products can be restored here.' : 'Add a product to get started.'}</p>}</div>}

        <div className="catalog-list-panel__pagination flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
          <label className="flex items-center gap-2 text-[color:var(--site-muted)]">Rows <select aria-label="Products per page" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} className="h-9 rounded-xl border border-theme-border bg-[color:var(--site-surface)] px-3 font-bold"><option>10</option><option>25</option><option>50</option></select></label>
          <span className="text-[color:var(--site-muted)]">Showing {products.length} of {total}</span>
          <div className="flex items-center gap-2"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} className="admin-btn-ghost min-h-9 px-3 disabled:opacity-40">Previous</button><span className="min-w-16 text-center font-bold">{page} / {pageCount}</span><button type="button" disabled={page >= pageCount || loading} onClick={() => setPage((value) => value + 1)} className="admin-btn-ghost min-h-9 px-3 disabled:opacity-40">Next</button></div>
        </div>
      </div>

      {editor && <div className="catalog-product-editor">
        <div className="catalog-product-editor__panel" role="dialog" aria-modal="true" aria-labelledby="catalog-product-editor-title">
          <header className="catalog-product-editor__header">
            <h2 id="catalog-product-editor-title">{editor.mode === 'Add' ? 'Add product' : 'Edit product'}</h2>
            <button type="button" onClick={closeEditor} aria-label="Close product editor"><X size={20} /></button>
          </header>
          <div className="catalog-product-editor__body">
            <ProductForm compact mode={editor.mode} productId={editor.id} apiPrefix={prefix} uploadPrefix={`${prefix}/uploads`} cancelPath={`${prefix}/products`} onCancel={closeEditor} onSaved={() => { closeEditor(); reload(); }} />
          </div>
        </div>
      </div>}

      <ConfirmModal open={!!confirmTarget} title={confirmTarget?.title} message={confirmTarget?.message} confirmLabel={confirmTarget?.label} onClose={() => setConfirmTarget(null)} onConfirm={async () => { await confirmTarget?.run(); setConfirmTarget(null); }} />
      {deleteTarget && <ProductDeleteDialog product={deleteTarget} productsPath={productsPath} onClose={() => setDeleteTarget(null)} onArchived={reload} onDeleted={id => {
        setDeleteTarget(null); setSelectedIds(current => current.filter(item => item !== id));
        setProducts(current => current.filter(item => item._id !== id));
        setMessage({ tone: 'success', text: 'Product permanently deleted. Uploaded files and audit history were retained.' }); reload();
      }} />}
      <ProductPosterModal open={!!posterProduct} product={posterProduct} settings={settings} onClose={() => setPosterProduct(null)} />
      <ProductCaptionModal open={!!captionProduct} product={captionProduct} settings={settings} onClose={() => setCaptionProduct(null)} />
    </section>
  );
}

function DesktopRow({ product, inventoryPath, selected, busy, onSelect, onEdit, onStatus, onStock, onPoster, onCaption, onOut, onArchive, onRestore, onDuplicate, onDelete }) {
  const state = productState(product);
  const score = completenessScore(product);
  return <tr className={selected ? 'is-selected' : ''}>
    <td><button type="button" onClick={() => onSelect(product._id)} className={`grid h-5 w-5 place-items-center rounded border ${selected ? 'border-wine bg-wine text-[color:var(--site-on-fill)]' : 'border-[color:var(--site-border)] bg-[color:var(--site-surface)]'}`} aria-label={`Select ${product.name}`}>{selected && <Check className="h-3 w-3" />}</button></td>
    <td className="admin-catalog-product"><ProductIdentity product={product} score={score} /></td>
    <td><p className="admin-catalog-sku" title={product.sku || ''}>{product.sku || 'No SKU'}</p><p className="mt-1 whitespace-nowrap text-xs text-[color:var(--site-muted)]">{product.category?.name || 'Unassigned'}</p></td>
    <td><p className="whitespace-nowrap text-[15px] font-black">Rs. {formatNumber(product.price)}</p>{Number(product.originalPrice) > Number(product.price) && <p className="text-xs text-[color:var(--site-faint)] line-through">Rs. {formatNumber(product.originalPrice)}</p>}{Number(product.costPrice) > 0 && <p className="mt-1 text-[10px] font-bold text-[color:var(--site-success)]">{marginLabel(product)}</p>}</td>
    <td>{product.commerceMode === 'RENTAL_ONLY' ? <span className="text-xs text-[color:var(--site-muted)]">Rental pieces → setup</span> : product.isArchived ? <span className="text-xs text-[color:var(--site-faint)]">Archived</span> : product.variants?.length ? <a href={inventoryPath} className="admin-table-action-link" title="Update each variant in inventory">{product.stock} · Variants</a> : <StockInput value={product.stock} disabled={!!busy} onSave={(value) => onStock(product, value)} className="h-9 w-[76px] rounded-lg border border-theme-border bg-[color:var(--site-surface)] px-2.5 text-sm font-semibold" aria-label={`${product.name} stock`} />}</td>
    <td><button type="button" disabled={!!busy || product.isArchived} onClick={() => onStatus(product)} aria-label={`Toggle ${product.name} status`} className="disabled:cursor-not-allowed disabled:opacity-60"><StatusBadge value={state.label} /></button><p className={`mt-1 text-[10px] font-bold ${state.tone}`}>{state.note}</p></td>
    <td><div className="flex items-center gap-1.5"><ProductActions product={product} busy={busy} onEdit={onEdit} onPoster={onPoster} onCaption={onCaption} onOut={onOut} onArchive={onArchive} onRestore={onRestore} onDuplicate={onDuplicate} /><button type="button" disabled={!!busy} onClick={() => onDelete(product)} className="admin-catalog-action text-[color:var(--site-primary)]" aria-label={`Delete ${product.name} permanently`} title="Delete permanently"><Trash2 className="h-4 w-4" /></button></div></td>
  </tr>;
}

function MobileProductCard({ product, selected, busy, onSelect, onEdit, onStatus, onOut, onArchive, onRestore, onDuplicate, onDelete }) {
  const state = productState(product);
  const score = completenessScore(product);
  return <article className={`p-4 ${selected ? 'bg-[color:var(--site-tint)]' : 'bg-[color:var(--site-surface)]'}`}>
    <div className="flex gap-3"><button type="button" onClick={() => onSelect(product._id)} className={`mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-md border ${selected ? 'border-wine bg-wine text-[color:var(--site-on-fill)]' : 'border-[color:var(--site-border)]'}`} aria-label={`Select ${product.name}`}>{selected && <Check className="h-3.5 w-3.5" />}</button><div className="h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-[color:var(--site-accent-soft)]"><img src={getPrimaryImageUrl(product.images) || '/uploads/placeholder.jpg'} alt="" className="h-full w-full object-cover" /></div><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-black" title={product.name}>{product.name}</h3><RentalInventoryBadge product={product} /><p className="mt-1 truncate text-xs text-[color:var(--site-muted)]">{product.sku || 'No SKU'} · {product.category?.name || 'Unassigned'}</p><div className="mt-2 flex flex-wrap items-center gap-2"><strong>Rs. {formatNumber(product.price)}</strong><StatusBadge value={state.label} /><span className={`rounded-full px-2 py-1 text-[10px] font-black ${score === 100 ? 'bg-[color:var(--site-success-soft)] text-[color:var(--site-success)]' : 'bg-[color:var(--site-warning-soft)] text-[color:var(--site-warning)]'}`}>{score}% complete</span></div><p className="mt-2 text-xs font-bold text-[color:var(--site-muted)]">{product.commerceMode === 'RENTAL_ONLY' ? 'Rental inventory is tracked separately' : `Sale: ${Number(product.stock || 0)} units · Alert at ${product.lowStockAlert ?? 5}`}</p></div></div>
    <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => onEdit(product)} className="admin-btn"><PencilLine className="h-4 w-4" />Edit</button><a href={`/product?id=${encodeURIComponent(product._id)}`} target="_blank" rel="noreferrer" className="admin-btn-ghost"><Eye className="h-4 w-4" />Preview</a></div>
    <div className="mt-2 flex flex-wrap gap-2">{product.isArchived ? <button type="button" disabled={!!busy} onClick={() => onRestore(product)} className="admin-table-action-link"><RotateCcw className="mr-1 h-3.5 w-3.5" />Restore</button> : <><button type="button" disabled={!!busy} onClick={() => onStatus(product)} className="admin-table-action-link">{product.isActive ? 'Hide' : 'Make active'}</button><button type="button" disabled={!!busy} onClick={() => onDuplicate(product)} className="admin-table-action-link">Duplicate</button>{Number(product.stock || 0) > 0 && <button type="button" disabled={!!busy} onClick={() => onOut(product)} className="admin-table-action-link">Out of stock</button>}<button type="button" disabled={!!busy} onClick={() => onArchive(product)} className="admin-table-action-link is-danger">Archive</button></>}</div>
    <button type="button" disabled={!!busy} onClick={() => onDelete(product)} className="admin-table-action-link is-danger mt-2 inline-flex min-h-11 items-center gap-1" aria-label={`Delete ${product.name} permanently`}><Trash2 className="h-3.5 w-3.5" />Delete permanently</button>
  </article>;
}

function RentalInventoryBadge({ product }) {
  if (!['RENTAL_ONLY', 'SALE_AND_RENTAL'].includes(product.commerceMode)) return null;
  const status = product.rentalStatus, p = status?.pieces;
  return <p className="mt-1 text-xs font-semibold text-wine">Catalogue: {product.isArchived ? 'Archived' : !product.isActive ? 'Hidden' : product.publishAt && +new Date(product.publishAt) > Date.now() ? 'Scheduled' : 'Published'} · Rental: {status?.label || 'Setup pending'}{p && ` · ${p.ready} ready condition · ${p.reserved || 0} reserved by date · ${p.booked} with customers · ${p.cleaning} cleaning / repair`}</p>;
}

function ProductIdentity({ product, score }) {
  const description = product.shortDescription || product.description || '';
  return <div className="flex items-center gap-3"><div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[color:var(--site-accent-soft)]"><img src={getPrimaryImageUrl(product.images) || '/uploads/placeholder.jpg'} alt="" className="h-full w-full object-cover" /></div><div className="min-w-0"><p className="truncate text-sm font-black" title={product.name}>{product.name}</p><RentalInventoryBadge product={product} />{description && <p className="mt-1 truncate text-xs text-[color:var(--site-muted)]" title={description}>{description}</p>}<div className="mt-1.5 flex flex-wrap gap-1">{product.isNewArrival && <Tag label="New" />}{product.isBestSeller && <Tag label="Best seller" />}{product.isFeatured && <Tag label="Featured" />}<span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${score === 100 ? 'bg-[color:var(--site-success-soft)] text-[color:var(--site-success)]' : 'bg-[color:var(--site-warning-soft)] text-[color:var(--site-warning)]'}`} title="Product information completeness">{score}%</span></div></div></div>;
}

function ProductActions({ product, busy, onEdit, onPoster, onCaption, onOut, onArchive, onRestore, onDuplicate }) {
  return <div className="flex items-center gap-1.5"><button type="button" disabled={!!busy} onClick={() => onEdit(product)} className="admin-catalog-action" aria-label={`Edit ${product.name}`} title="Edit"><PencilLine className="h-4 w-4" /></button><a href={`/product?id=${encodeURIComponent(product._id)}`} target="_blank" rel="noreferrer" className="admin-catalog-action" aria-label={`Preview ${product.name}`} title="Preview storefront"><Eye className="h-4 w-4" /></a><details className="relative"><summary className="admin-catalog-action cursor-pointer list-none" aria-label={`More actions for ${product.name}`} title="More actions"><MoreHorizontal className="h-4 w-4" /></summary><div className="absolute right-0 z-30 mt-2 grid min-w-52 gap-1 rounded-2xl border border-theme-border bg-[color:var(--site-surface)] p-2 shadow-xl">{product.isArchived ? <Action onClick={() => onRestore(product)} icon={RotateCcw}>Restore as inactive</Action> : <><Action onClick={() => onDuplicate(product)} icon={Copy}>Duplicate product</Action><Action onClick={() => onPoster(product)} icon={Camera}>Create poster</Action><Action onClick={() => onCaption(product)} icon={MessageSquareText}>Create caption</Action>{Number(product.stock || 0) > 0 && <Action onClick={() => onOut(product)} icon={PackageX}>Mark out of stock</Action>}<Action onClick={() => onArchive(product)} icon={Archive} danger>Archive product</Action></>}</div></details></div>;
}

function Action({ icon: Icon, children, onClick, danger }) { return <button type="button" onClick={onClick} className={`flex min-h-10 items-center gap-2 rounded-xl px-3 text-left text-xs font-bold hover:bg-[color:var(--site-accent-soft)] ${danger ? 'text-[color:var(--site-primary)]' : 'text-[color:var(--site-muted)]'}`}><Icon className="h-4 w-4" />{children}</button>; }
function AddLink({ href, icon: Icon, title, note }) { return <a href={href} className="flex items-center gap-3 rounded-xl p-3 hover:bg-[color:var(--site-accent-soft)]"><span className="grid h-9 w-9 place-items-center rounded-xl bg-wine/10 text-wine"><Icon className="h-4 w-4" /></span><span><strong className="block text-xs">{title}</strong><small className="text-[10px] text-[color:var(--site-muted)]">{note}</small></span></a>; }
function Tag({ label }) { return <span className="rounded-full bg-[color:var(--site-tint)] px-2 py-0.5 text-[10px] font-bold text-wine">{label}</span>; }
function Select({ label, value, onChange, options }) { return <UiSelect aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="w-full min-w-36 rounded-[16px]">{options.map(([optionValue, text]) => <option key={optionValue} value={optionValue}>{text}</option>)}</UiSelect>; }
function KpiTile({ icon: Icon, tone, label, value, note, active, onClick }) { const Element = onClick ? 'button' : 'div'; return <Element type={onClick ? 'button' : undefined} onClick={onClick} title={note} aria-label={`${label}: ${value}`} aria-pressed={onClick ? active : undefined} className={`admin-kpi-tile is-${tone}${active ? ' is-active' : ''}`}><span className="admin-kpi-tile__icon"><Icon className="h-4 w-4" /></span><p className="admin-kpi-tile__value">{value}</p><p className="admin-kpi-tile__label">{label}</p></Element>; }
function CatalogSkeleton() { return <div className="space-y-3 p-4 lg:p-5">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-[84px] animate-pulse rounded-[18px] bg-[color:color-mix(in_srgb,var(--site-surface-alt)_80%,transparent)]" />)}</div>; }

function useResponsiveDesktop() {
  const read = () => typeof window === 'undefined' || typeof window.matchMedia !== 'function' || window.matchMedia('(min-width: 1024px)').matches;
  const [desktop, setDesktop] = useState(read);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia('(min-width: 1024px)');
    const update = () => setDesktop(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);
  return desktop;
}

function summarize(items) {
  return items.reduce((result, item) => {
    result.total += item.isArchived ? 0 : 1;
    result.archived += item.isArchived ? 1 : 0;
    result.active += !item.isArchived && item.isActive ? 1 : 0;
    result.low += !item.isArchived && item.commerceMode !== 'RENTAL_ONLY' && Number(item.stock || 0) > 0 && Number(item.stock || 0) <= Number(item.lowStockAlert ?? 5) ? 1 : 0;
    result.out += !item.isArchived && item.commerceMode !== 'RENTAL_ONLY' && Number(item.stock || 0) <= 0 ? 1 : 0;
    result.retailValue += !item.isArchived ? Number(item.price || 0) * Number(item.stock || 0) : 0;
    result.costValue += !item.isArchived ? Number(item.costPrice || 0) * Number(item.stock || 0) : 0;
    return result;
  }, { ...DEFAULT_SUMMARY });
}

function productState(product) {
  if (product.isArchived) return { label: 'Archived', note: 'Recoverable', tone: 'text-[color:var(--site-muted)]' };
  if (!product.isActive) return { label: 'Inactive', note: 'Hidden from store', tone: 'text-[color:var(--site-muted)]' };
  if (product.publishAt && new Date(product.publishAt) > new Date()) return { label: 'Scheduled', note: `Publishes ${formatDate(product.publishAt)}`, tone: 'text-[color:var(--site-violet)]' };
  if (product.commerceMode === 'RENTAL_ONLY') return { label: 'Active', note: 'Published · rental inventory tracked separately', tone: 'text-[color:var(--site-success)]' };
  if (Number(product.stock || 0) <= 0) return { label: 'Active', note: 'Published · sale unavailable', tone: 'text-[color:var(--site-primary)]' };
  return { label: 'Active', note: 'Visible on store', tone: 'text-[color:var(--site-success)]' };
}

function completenessScore(product) {
  const checks = [product.name, product.sku, product.category?._id || product.category, Number(product.price) > 0, product.images?.length, String(product.description || '').trim().length >= 20, Number(product.shippingWeightKg) > 0, product.metaTitle, product.metaDescription];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function marginLabel(product) {
  const price = Number(product.price || 0); const cost = Number(product.costPrice || 0);
  return price > 0 && cost >= 0 ? `${Math.round(((price - cost) / price) * 100)}% gross margin` : '';
}
function formatNumber(value) { return Number(value || 0).toLocaleString('en-IN'); }
function formatCurrency(value) { const amount = Number(value || 0); if (amount >= 10000000) return `Rs. ${(amount / 10000000).toFixed(1)}Cr`; if (amount >= 100000) return `Rs. ${(amount / 100000).toFixed(1)}L`; return `Rs. ${amount.toLocaleString('en-IN')}`; }
function formatDate(value) { return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }); }

function downloadCsv(items, filename) {
  const columns = ['id', 'name', 'sku', 'barcode', 'category', 'subCategory', 'price', 'originalPrice', 'costPrice', 'gstRate', 'hsnCode', 'stock', 'lowStockAlert', 'active', 'archived', 'updatedAt'];
  const csv = [columns.join(','), ...items.map((item) => columns.map((column) => csvCell(item[column])).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}
function csvCell(value) { const text = value == null ? '' : String(value); return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
