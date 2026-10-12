import useAdminFeedback from '../../hooks/useAdminFeedback';
import AdminFeedback from '../../components/admin/AdminFeedback';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, ArrowDown, ArrowUp, ChevronDown, Eye, FolderTree, Package, Pencil, Plus, RotateCcw, Search, Trash2, X } from 'lucide-react';
import CategoryForm from '../../components/admin/CategoryForm';
import Loader from '../../components/admin/Loader';
import PageState from '../../components/ui/PageState';
import StatusBadge from '../../components/admin/StatusBadge';
import { AdminTable } from './Products';
import api from '../../services/api';
import { normalizeImageUrl } from '../../services/normalize';
import { asCatalogList } from '../../utils/catalogOptions';

const emptyImpact = { productCount: 0, activeProductCount: 0, draftCount: 0, couponCount: 0, childCount: 0, canDelete: false };

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [parent, setParent] = useState('all');
  const [message, setMessage] = useAdminFeedback({ type: '', text: '' }, 'success', 'Categories');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState('');
  const [selected, setSelected] = useState([]);
  const [editor, setEditor] = useState(null);
  const [action, setAction] = useState(null);
  const [bridalSetup, setBridalSetup] = useState(null);
  const [setupBusy, setSetupBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    setMessage({ type: '', text: '' });
    try { setCategories(asCatalogList(await api.get('/admin/categories?admin=true&archive=all'))); }
    catch (error) { setLoadError(error.message); setMessage({ type: 'error', text: error.message }); }
    finally { setLoading(false); }
  }, [setMessage]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    let active = true;
    api.get('/admin/categories/bridal-setup', { silent: true })
      .then((result) => { if (active) setBridalSetup(result); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const roots = useMemo(() => categories.filter((category) => !category.parent && !category.isArchived), [categories]);
  const filtered = useMemo(() => categories.filter((category) => {
    const search = query.trim().toLowerCase();
    const matchesSearch = !search || [category.name, category.slug, category.description, category.parent?.name].some((value) => String(value || '').toLowerCase().includes(search));
    const matchesStatus = status === 'all'
      || (status === 'active' && category.isActive && !category.isArchived)
      || (status === 'hidden' && !category.isActive && !category.isArchived)
      || (status === 'archived' && category.isArchived)
      || (status === 'empty' && Number(category.productCount || 0) === 0 && !category.isArchived);
    const matchesParent = parent === 'all' || (parent === 'root' ? !category.parent : String(category.parent?._id || category.parent || '') === parent);
    return matchesSearch && matchesStatus && matchesParent;
  }).sort(categorySort), [categories, parent, query, status]);

  const summary = useMemo(() => ({
    total: categories.filter((item) => !item.isArchived).length,
    active: categories.filter((item) => item.isActive && !item.isArchived).length,
    hidden: categories.filter((item) => !item.isActive && !item.isArchived).length,
    empty: categories.filter((item) => !item.isArchived && Number(item.productCount || 0) === 0).length,
  }), [categories]);

  const notify = (text, type = 'success') => setMessage({ type, text });

  const applyBridalSetup = async () => {
    if (setupBusy) return;
    setSetupBusy(true);
    try {
      const result = await api.post('/admin/categories/bridal-setup', {});
      setBridalSetup({ ...result, missing: [], structureUpdated: false });
      await load();
      notify(result.created?.length
        ? `${result.created.length} bridal categories added as hidden. Add real products, then make each category visible.`
        : 'Bridal catalogue is ready. Your existing categories were preserved.');
    } catch (error) { notify(error.message, 'error'); }
    finally { setSetupBusy(false); }
  };

  const toggleStatus = async (category) => {
    if (busy) return;
    setBusy(category._id);
    try {
      const updated = await api.patch(`/admin/categories/${category._id}/status`, { isActive: !category.isActive });
      await load();
      notify(`${category.name} is now ${updated.isActive ? 'visible' : 'hidden'}.`);
    } catch (error) { notify(error.message, 'error'); }
    finally { setBusy(''); }
  };

  const openAction = async (category, kind) => {
    setAction({ category, kind, impact: emptyImpact, loading: true, impactFailed: false, targetCategoryId: '', confirmation: '', error: '' });
    try {
      const impact = await api.get(`/admin/categories/${category._id}/impact`);
      setAction((current) => current?.category._id === category._id ? { ...current, impact, loading: false } : current);
    } catch (error) {
      setAction((current) => current?.category._id === category._id ? { ...current, loading: false, impactFailed: true, error: error.message } : current);
    }
  };

  const runCategoryAction = async (operation) => {
    if (!action || busy) return;
    const { category } = action;
    setBusy(category._id);
    setAction((current) => ({ ...current, error: '' }));
    try {
      let response;
      if (operation === 'archive') response = await api.patch(`/admin/categories/${category._id}/archive`, {});
      if (operation === 'restore') response = await api.patch(`/admin/categories/${category._id}/restore`, {});
      if (operation === 'reassign') response = await api.post(`/admin/categories/${category._id}/reassign`, { targetCategoryId: action.targetCategoryId });
      if (operation === 'delete') response = await api.delete(`/admin/categories/${category._id}?confirm=${encodeURIComponent(action.confirmation)}`);
      await load();
      setSelected((current) => current.filter((id) => id !== category._id));
      setAction(null);
      notify(response?.message || 'Category updated.');
    } catch (error) {
      setAction((current) => ({ ...current, error: error.message }));
    } finally { setBusy(''); }
  };

  const moveCategory = async (category, direction) => {
    if (busy) return;
    const parentId = String(category.parent?._id || category.parent || '');
    const siblings = categories.filter((item) => !item.isArchived && String(item.parent?._id || item.parent || '') === parentId).sort(categorySort);
    const index = siblings.findIndex((item) => item._id === category._id);
    const destination = index + direction;
    if (index < 0 || destination < 0 || destination >= siblings.length) return;
    [siblings[index], siblings[destination]] = [siblings[destination], siblings[index]];
    const items = siblings.map((item, itemIndex) => ({ id: item._id, displayOrder: itemIndex * 10 }));
    setBusy(category._id);
    try {
      await api.put('/admin/categories/reorder', { items });
      const orders = new Map(items.map((item) => [item.id, item.displayOrder]));
      setCategories((current) => current.map((item) => orders.has(item._id) ? { ...item, displayOrder: orders.get(item._id) } : item));
      notify('Category order updated.');
    } catch (error) { notify(error.message, 'error'); }
    finally { setBusy(''); }
  };

  const runBulk = async (operation) => {
    if (!selected.length || busy) return;
    setBusy('bulk');
    try {
      await Promise.all(selected.map((id) => operation === 'archive'
        ? api.patch(`/admin/categories/${id}/archive`, {})
        : api.patch(`/admin/categories/${id}/status`, { isActive: operation === 'show' })));
      await load();
      notify(`${selected.length} categories updated.`);
      setSelected([]);
    } catch (error) { notify(error.message, 'error'); }
    finally { setBusy(''); }
  };

  const toggleSelected = (id) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  const rows = filtered.map((category) => {
    const parentId = String(category.parent?._id || category.parent || '');
    const siblings = categories.filter((item) => !item.isArchived && String(item.parent?._id || item.parent || '') === parentId).sort(categorySort);
    const siblingIndex = siblings.findIndex((item) => item._id === category._id);
    return [
      <div className="category-list-name">
        <input type="checkbox" aria-label={`Select ${category.name}`} checked={selected.includes(category._id)} disabled={category.isArchived} onChange={() => toggleSelected(category._id)} />
        <CategoryThumb category={category} />
        <div><strong>{category.name}</strong><span>{category.parent?.name ? `${category.parent.name} / ${category.slug}` : category.slug}</span>{category.definitionKey ? <small>{category.definitionKey.replaceAll('_', ' ')}</small> : null}</div>
      </div>,
      <div className="category-count"><strong>{Number(category.activeProductCount || 0)} live</strong><span>{Number(category.productCount || 0)} products · {Number(category.draftCount || 0)} drafts</span>{Number(category.childCount || 0) > 0 ? <small>{category.childCount} subcategories</small> : null}</div>,
      category.isArchived ? <StatusBadge value="Archived" /> : <button type="button" className="category-visibility" disabled={busy === category._id} onClick={() => toggleStatus(category)} aria-label={`${category.isActive ? 'Hide' : 'Show'} ${category.name}`}><StatusBadge value={category.isActive ? 'Active' : 'Inactive'} /><span>{category.isActive ? 'Hide' : 'Show'}</span></button>,
      <div className="category-order"><button type="button" aria-label={`Move ${category.name} up`} disabled={category.isArchived || siblingIndex <= 0 || Boolean(busy)} onClick={() => moveCategory(category, -1)}><ArrowUp size={15} /></button><strong>{category.displayOrder}</strong><button type="button" aria-label={`Move ${category.name} down`} disabled={category.isArchived || siblingIndex < 0 || siblingIndex === siblings.length - 1 || Boolean(busy)} onClick={() => moveCategory(category, 1)}><ArrowDown size={15} /></button></div>,
      <div className="category-actions">
        {!category.isArchived && <a href={`/products?category=${encodeURIComponent(category._id)}`} target="_blank" rel="noreferrer" className="admin-table-action-link" aria-label={`View ${category.name} storefront`}><Eye size={14} /> View</a>}
        {!category.isArchived && <button type="button" onClick={() => setEditor({ mode: 'Update', category })} className="admin-table-action-link"><Pencil size={14} /> Edit</button>}
        {category.isArchived ? <><button type="button" onClick={() => openAction(category, 'restore')} className="admin-table-action-link is-success"><RotateCcw size={14} /> Restore</button><button type="button" onClick={() => openAction(category, 'delete')} className="admin-table-action-link is-danger"><Trash2 size={14} /> Delete</button></> : <button type="button" onClick={() => openAction(category, 'archive')} className="admin-table-action-link is-danger"><Archive size={14} /> Archive</button>}
      </div>,
    ];
  });

  return (
    <section className="category-workspace catalog-compact-workspace">
      <div className="catalog-workspace-toolbar catalog-workspace-toolbar--categories" aria-label="Category actions">
        {bridalSetup && <details className="catalog-setup-disclosure">
          <summary><span>Category setup<small>{bridalSetup.missing?.length ? `${bridalSetup.missing.length} to add` : 'Bridal categories'}{(bridalSetup.archived?.length || bridalSetup.conflicts?.length || bridalSetup.structureUpdated) ? ' · Review needed' : ''}</small></span><ChevronDown size={16} aria-hidden="true" /></summary>
          <div className="admin-card catalog-setup-disclosure__content space-y-3">
            <p className="text-sm text-[color:var(--site-muted)]">New bridal categories start hidden. Add products, then make them visible.</p>
            <p className="text-sm"><strong>{bridalSetup.missing?.length || 0}</strong> categories to add · <strong>{bridalSetup.existing?.length || 0}</strong> already present</p>
            {!!bridalSetup.missing?.length && <p className="text-sm text-[color:var(--site-muted)]">To add: {bridalSetup.missing.join(', ')}</p>}
            {!!bridalSetup.archived?.length && <p className="text-sm text-[color:var(--site-warning)]">Archived categories need manual review: {bridalSetup.archived.join(', ')}</p>}
            {!!bridalSetup.conflicts?.length && <p className="text-sm text-[color:var(--site-warning)]">Naming conflicts need manual review: {bridalSetup.conflicts.join(', ')}</p>}
            <div className="flex flex-wrap gap-3">
              {(bridalSetup.missing?.length > 0 || bridalSetup.structureUpdated) && <button type="button" className="admin-btn" disabled={setupBusy} onClick={applyBridalSetup}>{setupBusy ? 'Setting up…' : 'Add bridal categories'}</button>}
              <a className="admin-btn-ghost" href="/admin/products/add">Add product</a>
              <a className="admin-btn-ghost" href="/admin/rentals">Set rental rates and deposits</a>
            </div>
          </div>
        </details>}
        <button type="button" className="admin-btn" onClick={() => setEditor({ mode: 'Add', category: null })}><Plus size={17} /> Add category</button>
      </div>

      <div className="category-summary-grid">
        <SummaryCard label="Categories" value={summary.total} icon={FolderTree} active={status === 'all'} onClick={() => setStatus('all')} />
        <SummaryCard label="Visible" value={summary.active} tone="green" icon={Eye} active={status === 'active'} onClick={() => setStatus('active')} />
        <SummaryCard label="Hidden" value={summary.hidden} tone="amber" icon={Archive} active={status === 'hidden'} onClick={() => setStatus('hidden')} />
        <SummaryCard label="Need products" value={summary.empty} tone="rose" icon={Package} active={status === 'empty'} onClick={() => setStatus('empty')} />
      </div>

      <AdminFeedback message={message} type="success" title="Categories" onDismiss={() => setMessage(null)} />

      <section className="admin-card catalog-filter-panel" aria-label="Filter categories">
        <div className="catalog-filter-grid catalog-filter-grid--categories">
          <label className="catalog-filter-search">Search categories<span className="catalog-filter-search__control"><Search size={16} aria-hidden="true" /><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Name, parent or slug" /></span></label>
          <label>Status<select aria-label="Filter category status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option><option value="active">Visible</option><option value="hidden">Hidden</option><option value="empty">Need products</option><option value="archived">Archived</option></select></label>
          <label>Level / parent<select aria-label="Filter parent category" value={parent} onChange={(event) => setParent(event.target.value)}><option value="all">All levels</option><option value="root">Top level</option>{roots.map((category) => <option key={category._id} value={category._id}>Under {category.name}</option>)}</select></label>
        </div>
        {(query.trim() || status !== 'all' || parent !== 'all') && <div className="catalog-filter-active"><span>Filters applied</span><button type="button" onClick={() => { setQuery(''); setStatus('all'); setParent('all'); }}><X size={14} />Clear filters</button></div>}
      </section>

      {selected.length > 0 && <div className="category-bulk-bar"><strong>{selected.length} selected</strong><div><button disabled={busy === 'bulk'} type="button" onClick={() => runBulk('show')}>Make visible</button><button disabled={busy === 'bulk'} type="button" onClick={() => runBulk('hide')}>Hide</button><button disabled={busy === 'bulk'} type="button" onClick={() => runBulk('archive')} className="is-danger">Archive</button><button type="button" onClick={() => setSelected([])}>Clear</button></div></div>}

      {loading ? <Loader label="Loading categories" /> : loadError ? <PageState error={loadError} onRetry={load} retryLabel="Retry categories" /> : rows.length ? <AdminTable title="Category catalogue" heads={['Category', 'Catalogue', 'Visibility', 'Order', 'Actions']} rows={rows} /> : <div className="admin-card catalog-empty-state"><h2>{categories.length ? 'No categories match these filters' : 'No categories yet'}</h2>{categories.length ? <button type="button" className="admin-btn-ghost" onClick={() => { setQuery(''); setStatus('all'); setParent('all'); }}>Clear filters</button> : <p>Add a category to get started.</p>}</div>}

      {editor && <CategoryEditor editor={editor} categories={categories} onClose={() => setEditor(null)} onSaved={async () => { await load(); setEditor(null); notify(editor.mode === 'Add' ? 'Category added successfully.' : 'Category changes saved.'); }} />}
      {action && <CategoryActionDialog action={action} categories={categories} busy={busy === action.category._id} onChange={setAction} onClose={() => !busy && setAction(null)} onRun={runCategoryAction} />}
    </section>
  );
}

function categorySort(left, right) {
  return Number(left.level || 0) - Number(right.level || 0) || Number(left.displayOrder || 0) - Number(right.displayOrder || 0) || String(left.name || '').localeCompare(String(right.name || ''));
}

function CategoryThumb({ category }) {
  return <div className="category-thumb">{category.image ? <img src={normalizeImageUrl(category.image)} alt="" /> : <span>{String(category.name || 'SC').slice(0, 2).toUpperCase()}</span>}</div>;
}

function SummaryCard({ label, value, icon: Icon, tone = 'wine', active, onClick }) {
  return <button type="button" className={`category-summary is-${tone}${active ? ' is-active' : ''}`} aria-label={`${label}: ${value}`} aria-pressed={active} onClick={onClick}><span><Icon size={18} /></span><div><strong>{value}</strong><small>{label}</small></div></button>;
}

function CategoryEditor({ editor, categories, onClose, onSaved }) {
  const [dirty, setDirty] = useState(false);
  const attemptClose = () => { if (!dirty || window.confirm('Discard the unsaved category changes?')) onClose(); };
  return <div className="category-modal" role="dialog" aria-modal="true" aria-label={`${editor.mode} category`}><button type="button" className="category-modal__backdrop" aria-label="Close category editor" onClick={attemptClose} /><div className="category-modal__panel"><header><div><p>Catalog management</p><h2>{editor.mode === 'Add' ? 'Add a category' : `Edit ${editor.category.name}`}</h2></div><button type="button" aria-label="Close category editor" onClick={attemptClose}><X size={21} /></button></header><div className="category-modal__body"><CategoryForm mode={editor.mode} categoryId={editor.category?._id} availableCategories={categories} onSaved={onSaved} onCancel={onClose} onDirtyChange={setDirty} /></div></div></div>;
}

function CategoryActionDialog({ action, categories, busy, onChange, onClose, onRun }) {
  const { category, impact, kind, loading, error, impactFailed } = action;
  const destinations = categories.filter((item) => item._id !== category._id && !item.isArchived);
  const linked = Number(impact.productCount || 0) + Number(impact.draftCount || 0) + Number(impact.couponCount || 0);
  const title = kind === 'delete' ? 'Permanently delete category' : kind === 'restore' ? 'Restore category' : 'Archive category safely';
  return <div className="category-modal category-action-modal" role="dialog" aria-modal="true" aria-label={title}><button type="button" className="category-modal__backdrop" aria-label="Close category action" onClick={onClose} /><div className="category-action-modal__panel"><header><div><p>Category safety</p><h2>{title}</h2></div><button type="button" aria-label="Close category action" onClick={onClose}><X size={21} /></button></header><div className="category-action-modal__content"><div className="category-action-modal__identity"><CategoryThumb category={category} /><div><strong>{category.name}</strong><span>{category.slug}</span></div></div>{loading ? <p role="status">Checking linked catalogue data…</p> : <><div className="category-impact-grid"><span><strong>{impact.productCount || 0}</strong> products</span><span><strong>{impact.draftCount || 0}</strong> drafts</span><span><strong>{impact.childCount || 0}</strong> subcategories</span><span><strong>{impact.couponCount || 0}</strong> coupons</span></div>{kind === 'archive' && <><p>Archiving removes this category and its subcategories from customer navigation. Products and orders remain stored.</p>{linked > 0 && destinations.length > 0 ? <DestinationSelect action={action} destinations={destinations} onChange={onChange} optional /> : null}</>}{kind === 'restore' && <p>The category will return as hidden. Review it, then make it visible when ready.</p>}{kind === 'delete' && <>{impact.canDelete ? <label className="grid gap-2 text-sm font-black">Type “{category.name}” to confirm<input autoFocus value={action.confirmation} onChange={(event) => onChange({ ...action, confirmation: event.target.value })} className="h-12 rounded-xl border border-rose/40 px-4" /></label> : <><p className="category-action-modal__warning">Permanent deletion is blocked while this category has linked products, drafts, coupons or subcategories. Reassign linked catalogue items first.</p>{linked > 0 && destinations.length > 0 ? <DestinationSelect action={action} destinations={destinations} onChange={onChange} /> : null}</>}</>}{error && <p role="alert" className="category-action-modal__error">{error}</p>}</>}</div><footer><button type="button" className="admin-btn-ghost" onClick={onClose}>Cancel</button>{kind === 'archive' && action.targetCategoryId ? <button type="button" disabled={busy || loading || impactFailed} className="admin-btn" onClick={() => onRun('reassign')}>Move items & archive</button> : null}{kind === 'archive' && !action.targetCategoryId ? <button type="button" disabled={busy || loading || impactFailed} className="admin-btn" onClick={() => onRun('archive')}>Archive category</button> : null}{kind === 'restore' ? <button type="button" disabled={busy || loading || impactFailed} className="admin-btn" onClick={() => onRun('restore')}>Restore category</button> : null}{kind === 'delete' && !impact.canDelete && action.targetCategoryId ? <button type="button" disabled={busy || loading || impactFailed} className="admin-btn" onClick={() => onRun('reassign')}>Move linked items</button> : null}{kind === 'delete' ? <button type="button" disabled={busy || loading || impactFailed || !impact.canDelete || action.confirmation.trim().toLowerCase() !== category.name.trim().toLowerCase()} className="admin-btn-danger" onClick={() => onRun('delete')}>Delete permanently</button> : null}</footer></div></div>;
}

function DestinationSelect({ action, destinations, onChange, optional = false }) {
  return <label className="grid gap-2 text-sm font-black">Move linked products, drafts and coupons {optional ? 'first (optional)' : ''}<select value={action.targetCategoryId} onChange={(event) => onChange({ ...action, targetCategoryId: event.target.value })} className="h-12 rounded-xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)] px-4"><option value="">Choose destination category</option>{destinations.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label>;
}
