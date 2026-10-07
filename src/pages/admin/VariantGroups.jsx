import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Archive, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, ChevronLeft,
  ChevronRight, Eye, GitBranch, HeartPulse, PackageSearch, PencilLine, Plus, RefreshCcw,
  RotateCcw, Search, ShieldCheck, SlidersHorizontal, Trash2, X,
} from 'lucide-react';
import PageHeader from '../../components/admin/PageHeader';
import EmptyState from '../../components/admin/EmptyState';
import PageState from '../../components/ui/PageState';
import { getPrimaryImageUrl, normalizeImageUrl } from '../../services/normalize';
import {
  useArchiveVariantGroupMutation,
  useCreateVariantGroupMutation,
  useDeleteVariantGroupMutation,
  useGetManagementCategoriesQuery,
  useGetVariantGroupCandidatesQuery,
  useGetVariantGroupsQuery,
  useReconcileVariantGroupMutation,
  useRestoreVariantGroupMutation,
  useUpdateVariantGroupMutation,
} from '../../store/apiSlice';
import './VariantGroups.css';

const EMPTY_SUMMARY = { total: 0, active: 0, draft: 0, archived: 0 };
const OPTION_PRESETS = [
  ['color', 'Colour', 'swatch'], ['size', 'Size', 'text'], ['storage', 'Storage', 'text'],
  ['ram', 'RAM', 'text'], ['material', 'Material', 'text'], ['purity', 'Purity', 'text'],
  ['pack_size', 'Pack size', 'text'], ['style', 'Style', 'image'],
];

export default function VariantGroups({ route = '/admin/variant-groups', apiPrefix }) {
  const prefix = apiPrefix || (route.startsWith('/seller') ? '/seller' : '/admin');
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [status, setStatus] = useState('');
  const [health, setHealth] = useState('');
  const [sort, setSort] = useState('updated');
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState(null);
  const [message, setMessage] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteText, setDeleteText] = useState('');
  const [transferTarget, setTransferTarget] = useState(null);
  const groupArgs = useMemo(() => ({ apiPrefix: prefix, page, limit: 12, q: deferredQuery.trim(), status, health, sort }), [deferredQuery, health, page, prefix, sort, status]);
  const { data: response, isLoading, isFetching, error, refetch } = useGetVariantGroupsQuery(groupArgs);
  const [createGroup, createState] = useCreateVariantGroupMutation();
  const [updateGroup, updateState] = useUpdateVariantGroupMutation();
  const [archiveGroup, archiveState] = useArchiveVariantGroupMutation();
  const [restoreGroup, restoreState] = useRestoreVariantGroupMutation();
  const [deleteGroup, deleteState] = useDeleteVariantGroupMutation();
  const [reconcileGroup, reconcileState] = useReconcileVariantGroupMutation();
  const groups = Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : [];
  const meta = response?.meta || { page, totalPages: 1, total: groups.length, summary: EMPTY_SUMMARY };
  const summary = { ...EMPTY_SUMMARY, ...(meta.summary || {}) };
  const busy = createState.isLoading || updateState.isLoading || archiveState.isLoading || restoreState.isLoading || deleteState.isLoading || reconcileState.isLoading;

  useEffect(() => { setPage(1); }, [deferredQuery, health, sort, status]);

  const openNew = () => setEditor({ mode: 'create', form: emptyForm(), dirty: false, step: 1, recovery: readRecovery(prefix, '') });
  const openEdit = (group) => {
    const form = groupToForm(group);
    const stored = readRecovery(prefix, group._id);
    setEditor({ mode: 'edit', form, dirty: false, step: 1, recovery: stored?.revision === group.revision ? stored : null });
  };
  const closeEditor = () => {
    if (editor?.dirty) return setConfirmTarget({ title: 'Discard unsaved changes?', message: 'Your saved variant family will stay unchanged. The local recovery copy will also be removed.', label: 'Discard changes', danger: true, run: () => { clearRecovery(prefix, editor.form.id); setEditor(null); } });
    setEditor(null);
  };
  const announce = (tone, text) => setMessage({ tone, text });

  const save = async (confirmTransfers = false) => {
    if (!editor || busy) return;
    const validation = validateForm(editor.form);
    if (validation) return announce('error', validation);
    const payload = formPayload(editor.form, confirmTransfers);
    try {
      const result = editor.form.id
        ? await updateGroup({ id: editor.form.id, body: payload, apiPrefix: prefix }).unwrap()
        : await createGroup({ ...payload, apiPrefix: prefix }).unwrap();
      clearRecovery(prefix, editor.form.id);
      setEditor(null);
      setTransferTarget(null);
      announce('success', result?.message || 'Variant family saved successfully.');
    } catch (saveError) {
      const data = saveError?.data || {};
      if (data.code === 'VARIANT_GROUP_TRANSFER_CONFIRMATION_REQUIRED') {
        setTransferTarget({ kind: 'save', transfers: data.details?.transfers || [] });
        return;
      }
      if (data.code === 'VARIANT_GROUP_STALE') {
        announce('error', 'This family changed in another tab. Close the editor and reload the latest version before saving.');
        return;
      }
      announce('error', errorText(saveError));
    }
  };

  const runMutation = async (action, success) => {
    if (busy) return;
    try {
      const result = await action();
      announce('success', result?.message || success);
      setConfirmTarget(null);
      return result;
    } catch (mutationError) { announce('error', errorText(mutationError)); return null; }
  };

  const requestArchive = (group) => setConfirmTarget({
    title: 'Archive variant family?',
    message: `${group.name} will stop appearing as a storefront family. Its ${group.products.length} products and their inventory remain safe.`,
    label: 'Archive family', danger: true,
    run: () => runMutation(() => archiveGroup({ id: group._id, apiPrefix: prefix }).unwrap(), 'Variant family archived.'),
  });
  const restore = async (group, confirmTransfers = false) => {
    try {
      const result = await restoreGroup({ id: group._id, body: { confirmTransfers }, apiPrefix: prefix }).unwrap();
      setTransferTarget(null);
      announce('success', result?.message || 'Variant family restored.');
    } catch (restoreError) {
      const data = restoreError?.data || {};
      if (data.code === 'VARIANT_GROUP_TRANSFER_CONFIRMATION_REQUIRED') return setTransferTarget({ kind: 'restore', group, transfers: data.details?.transfers || [] });
      announce('error', errorText(restoreError));
    }
  };

  if (error && !groups.length) return <PageState error={errorText(error)} onRetry={refetch} />;

  return <section className="variant-family-page">
    <PageHeader title="Variant Families" note="Connect separate products as customer-facing colour, style, storage or material choices.">
      <button type="button" className="admin-btn" onClick={openNew}><Plus size={17} /> Create family</button>
    </PageHeader>

    {message && <div className={`variant-family-alert is-${message.tone}`} role={message.tone === 'error' ? 'alert' : 'status'}>
      <span>{message.text}</span><button type="button" onClick={() => setMessage(null)} aria-label="Dismiss message"><X size={16} /></button>
    </div>}

    <div className="variant-family-metrics">
      {[
        ['All families', summary.total, ''], ['Live', summary.active, 'active'],
        ['Drafts', summary.draft, 'draft'], ['Archived', summary.archived, 'archived'],
      ].map(([label, value, key]) => <button key={label} type="button" className={status === key ? 'is-active' : ''} onClick={() => setStatus(key)}><span>{label}</span><strong>{value}</strong></button>)}
    </div>

    <div className="admin-card variant-family-toolbar">
      <label className="variant-family-search"><Search size={17} /><input aria-label="Search variant families" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search family name…" />{query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><X size={15} /></button>}</label>
      <div>
        <SlidersHorizontal size={16} />
        <select aria-label="Filter family health" value={health} onChange={(event) => setHealth(event.target.value)}><option value="">All health</option><option value="healthy">Healthy</option><option value="attention">Needs attention</option></select>
        <select aria-label="Sort variant families" value={sort} onChange={(event) => setSort(event.target.value)}><option value="updated">Recently updated</option><option value="oldest">Oldest first</option><option value="name">Name A–Z</option></select>
        <button type="button" onClick={refetch} aria-label="Refresh variant families"><RefreshCcw size={16} className={isFetching ? 'animate-spin' : ''} /></button>
      </div>
    </div>

    {isLoading ? <PageState loading label="Loading variant families…" /> : !groups.length ? <div className="admin-card p-6"><EmptyState title="No matching variant families" note="Create a family or clear the current search and filters." /></div> : <div className="variant-family-grid">
      {groups.map((group) => <FamilyCard key={group._id} group={group} busy={busy} onEdit={() => openEdit(group)} onArchive={() => requestArchive(group)} onRestore={() => restore(group)} onDelete={() => { setDeleteTarget(group); setDeleteText(''); }} onRepair={() => runMutation(() => reconcileGroup({ id: group._id, apiPrefix: prefix }).unwrap(), 'Variant family repaired.')} />)}
    </div>}

    {meta.totalPages > 1 && <nav className="variant-family-pagination" aria-label="Variant family pages"><button type="button" disabled={page <= 1 || isFetching} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={16} /> Previous</button><span>Page {meta.page} of {meta.totalPages} · {meta.total} families</span><button type="button" disabled={page >= meta.totalPages || isFetching} onClick={() => setPage((value) => value + 1)}>Next <ChevronRight size={16} /></button></nav>}

    {editor && <FamilyEditor editor={editor} setEditor={setEditor} apiPrefix={prefix} busy={busy} onClose={closeEditor} onSave={save} />}
    {confirmTarget && <ConfirmDialog target={confirmTarget} busy={busy} onClose={() => setConfirmTarget(null)} />}
    {transferTarget && <TransferDialog target={transferTarget} busy={busy} onClose={() => setTransferTarget(null)} onConfirm={() => transferTarget.kind === 'save' ? save(true) : restore(transferTarget.group, true)} />}
    {deleteTarget && <DeleteDialog group={deleteTarget} value={deleteText} setValue={setDeleteText} busy={busy} onClose={() => setDeleteTarget(null)} onDelete={() => runMutation(() => deleteGroup({ id: deleteTarget._id, confirm: deleteText, apiPrefix: prefix }).unwrap(), 'Variant family permanently deleted.').then((result) => { if (result) { setDeleteTarget(null); setDeleteText(''); } })} />}
  </section>;
}

function FamilyCard({ group, busy, onEdit, onArchive, onRestore, onDelete, onRepair }) {
  const image = productImage(group.baseProduct || group.products?.[0]);
  const health = group.health || { state: 'review', score: 0, issues: [], warnings: [] };
  const issue = health.issues?.[0] || health.warnings?.[0];
  const baseId = group.baseProduct?._id || group.products?.[0]?._id;
  return <article className="variant-family-card">
    <div className="variant-family-card__visual">{image ? <img src={image} alt="" /> : <GitBranch size={30} />}<span className={`variant-status is-${group.status}`}>{group.status}</span></div>
    <div className="variant-family-card__body">
      <div className="variant-family-card__heading"><div><small>{group.optionDefinitions?.map((item) => item.label).join(' · ') || 'Product family'}</small><h2 title={group.name}>{group.name}</h2></div><HealthRing health={health} /></div>
      <div className="variant-family-card__stats"><span><b>{group.products?.length || 0}</b> products</span><span><b>{group.totalStock || 0}</b> stock</span><span><b>{group.inStockCount || 0}</b> available</span></div>
      <div className="variant-family-swatches">{(group.members || []).slice(0, 6).map((member) => <span key={member.productId} title={member.label}>{safeSwatch(member.swatch) && <i style={{ backgroundColor: member.swatch }} />}{member.label}</span>)}{group.members?.length > 6 && <span>+{group.members.length - 6}</span>}</div>
      {issue && <p className={`variant-family-issue ${health.issues?.length ? 'is-error' : ''}`}><AlertTriangle size={14} /> {issue}</p>}
    </div>
    <div className="variant-family-card__actions">
      {!group.isArchived && <button type="button" className="admin-btn" onClick={onEdit}><PencilLine size={15} /> Manage</button>}
      {baseId && !group.isArchived && <a className="variant-icon-btn" href={`/product?id=${baseId}`} aria-label={`Preview ${group.name}`}><Eye size={16} /></a>}
      {!group.isArchived && health.state !== 'healthy' && <button type="button" disabled={busy} className="variant-icon-btn" onClick={onRepair} aria-label={`Repair ${group.name}`}><HeartPulse size={16} /></button>}
      {group.isArchived ? <><button type="button" disabled={busy} className="variant-secondary-btn" onClick={onRestore}><RotateCcw size={15} /> Restore</button><button type="button" disabled={busy} className="variant-danger-btn" onClick={onDelete}><Trash2 size={15} /> Delete</button></> : <button type="button" disabled={busy} className="variant-icon-btn" onClick={onArchive} aria-label={`Archive ${group.name}`}><Archive size={16} /></button>}
    </div>
  </article>;
}

function FamilyEditor({ editor, setEditor, apiPrefix, busy, onClose, onSave }) {
  const { form, step } = editor;
  const [candidateQuery, setCandidateQuery] = useState('');
  const deferredCandidateQuery = useDeferredValue(candidateQuery);
  const [candidatePage, setCandidatePage] = useState(1);
  const [category, setCategory] = useState('');
  const [stock, setStock] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [compatible, setCompatible] = useState(false);
  const candidateArgs = { apiPrefix, page: candidatePage, limit: 18, q: deferredCandidateQuery.trim(), category, stock, group: groupFilter, baseProductId: form.baseProduct, compatible };
  const { data: candidateResponse, isLoading: candidatesLoading, isFetching: candidatesFetching, error: candidateError, refetch: refetchCandidates } = useGetVariantGroupCandidatesQuery(candidateArgs, { skip: step !== 2 });
  const { data: categories = [] } = useGetManagementCategoriesQuery({ apiPrefix });
  const candidates = Array.isArray(candidateResponse?.items) ? candidateResponse.items : [];

  useEffect(() => { setCandidatePage(1); }, [deferredCandidateQuery, category, stock, groupFilter, compatible]);
  useEffect(() => {
    if (!editor.dirty) return undefined;
    const timer = window.setTimeout(() => writeRecovery(apiPrefix, form), 700);
    return () => window.clearTimeout(timer);
  }, [apiPrefix, editor.dirty, form]);
  useEffect(() => {
    const beforeUnload = (event) => { if (!editor.dirty) return; event.preventDefault(); event.returnValue = ''; };
    const keyDown = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('keydown', keyDown);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('beforeunload', beforeUnload); window.removeEventListener('keydown', keyDown); document.body.style.overflow = ''; };
  }, [editor.dirty, onClose]);

  const change = (update) => setEditor((current) => ({ ...current, dirty: true, form: typeof update === 'function' ? update(current.form) : { ...current.form, ...update } }));
  const chooseRecovery = (accept) => {
    if (!accept) clearRecovery(apiPrefix, form.id);
    setEditor((current) => ({ ...current, recovery: null, dirty: accept, form: accept ? current.recovery.form : current.form }));
  };
  const toggleProduct = (product) => change((current) => current.selectedProducts.some((item) => item._id === product._id) ? removeProduct(current, product._id) : addProduct(current, product));
  const addDefinition = (preset) => change((current) => addOptionDefinition(current, preset));
  const removeDefinition = (key) => change((current) => ({ ...current, optionDefinitions: current.optionDefinitions.filter((item) => item.key !== key), members: mapMemberValues(current.members, (values) => { const next = { ...values }; delete next[key]; return next; }) }));
  const updateDefinition = (key, field, value) => change((current) => ({ ...current, optionDefinitions: current.optionDefinitions.map((item) => item.key === key ? { ...item, [field]: value } : item) }));
  const updateMember = (productId, update) => change((current) => ({ ...current, members: { ...current.members, [productId]: { ...current.members[productId], ...update } } }));
  const updateMemberValue = (productId, key, value) => change((current) => ({ ...current, members: { ...current.members, [productId]: { ...current.members[productId], optionValues: { ...(current.members[productId]?.optionValues || {}), [key]: value } } } }));
  const reorder = (index, direction) => change((current) => { const items = [...current.selectedProducts]; const target = index + direction; if (target < 0 || target >= items.length) return current; [items[index], items[target]] = [items[target], items[index]]; return { ...current, selectedProducts: items }; });
  const currentError = step === 4 ? validateForm(form) : validateStep(form, step);

  return <div className="variant-editor-overlay" role="dialog" aria-modal="true" aria-labelledby="variant-editor-title">
    <button type="button" className="variant-editor-backdrop" onClick={onClose} aria-label="Close variant family editor" />
    <div className="variant-editor">
      <header><div><p>{form.id ? 'EDIT VARIANT FAMILY' : 'NEW VARIANT FAMILY'}</p><h2 id="variant-editor-title">{form.name || 'Build a product family'}</h2><span>Changes are saved locally for recovery until you publish them.</span></div><button type="button" onClick={onClose} aria-label="Close editor"><X /></button></header>
      <nav className="variant-editor-steps" aria-label="Variant family setup">{[['Family', 1], ['Products', 2], ['Options', 3], ['Preview', 4]].map(([label, number]) => <button type="button" key={label} className={step === number ? 'is-active' : step > number ? 'is-complete' : ''} onClick={() => setEditor((current) => ({ ...current, step: number }))}><i>{step > number ? <Check size={13} /> : number}</i><span>{label}</span></button>)}</nav>
      {editor.recovery && <div className="variant-recovery"><div><strong>Unsaved work found</strong><p>A newer local copy is available for this family.</p></div><button type="button" onClick={() => chooseRecovery(true)}>Restore it</button><button type="button" onClick={() => chooseRecovery(false)}>Use saved version</button></div>}
      <main>
        {step === 1 && <section className="variant-editor-section"><SectionTitle eyebrow="STEP 1" title="Family identity" note="The base product becomes the default choice customers see first." />
          <div className="variant-field-grid"><label><span>Family name *</span><input value={form.name} maxLength={120} onChange={(event) => change({ name: event.target.value })} placeholder="Example: Aurora silk saree colours" /></label><label><span>Base product *</span><select value={form.baseProduct} onChange={(event) => change({ baseProduct: event.target.value })}><option value="">Choose from selected products</option>{form.selectedProducts.map((product) => <option key={product._id} value={product._id}>{product.name}</option>)}</select></label></div>
          <label className="variant-active-toggle"><input type="checkbox" checked={form.isActive} onChange={(event) => change({ isActive: event.target.checked })} /><span><b>Show this family on the storefront</b><small>Active families require at least two available products and complete, unique option values.</small></span></label>
          <div className="variant-concept"><GitBranch /><div><strong>Product variants and variant families have different jobs</strong><p>Use product variants for inventory combinations on one product page. Use this family when each colour, storage or style has its own product, photos, price or URL.</p></div></div>
        </section>}

        {step === 2 && <section className="variant-editor-section"><SectionTitle eyebrow="STEP 2" title="Choose related products" note="Search the catalog and keep only genuinely related products in one family." />
          <div className="variant-candidate-toolbar"><label><Search size={16} /><input aria-label="Search products for family" value={candidateQuery} onChange={(event) => setCandidateQuery(event.target.value)} placeholder="Name, SKU or barcode" /></label><select aria-label="Filter products by category" value={category} onChange={(event) => setCategory(event.target.value)}><option value="">All categories</option>{categories.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select><select aria-label="Filter products by stock" value={stock} onChange={(event) => setStock(event.target.value)}><option value="">Any stock</option><option value="in">In stock</option><option value="out">Out of stock</option></select><select aria-label="Filter grouped products" value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}><option value="">All products</option><option value="ungrouped">Ungrouped only</option></select></div>
          <label className="variant-compatible"><input type="checkbox" checked={compatible} disabled={!form.baseProduct} onChange={(event) => setCompatible(event.target.checked)} /> Suggest products matching the base product’s category and industry</label>
          {candidateError ? <div className="variant-inline-error"><span>{errorText(candidateError)}</span><button type="button" onClick={refetchCandidates}>Try again</button></div> : candidatesLoading ? <PageState loading label="Finding products…" /> : <div className="variant-candidate-grid">{candidates.map((product) => <CandidateCard key={product._id} product={product} selected={form.selectedProducts.some((item) => item._id === product._id)} onClick={() => toggleProduct(product)} />)}</div>}
          {candidateResponse?.totalPages > 1 && <div className="variant-candidate-pages"><button type="button" disabled={candidatePage <= 1 || candidatesFetching} onClick={() => setCandidatePage((value) => value - 1)}><ChevronLeft size={15} /> Previous</button><span>{candidatePage} / {candidateResponse.totalPages}</span><button type="button" disabled={candidatePage >= candidateResponse.totalPages || candidatesFetching} onClick={() => setCandidatePage((value) => value + 1)}>Next <ChevronRight size={15} /></button></div>}
          <SelectedTray form={form} change={change} />
        </section>}

        {step === 3 && <section className="variant-editor-section"><SectionTitle eyebrow="STEP 3" title="Define customer choices" note="Choose attributes that clearly distinguish one product from another." />
          <div className="variant-option-presets">{OPTION_PRESETS.map((preset) => <button type="button" key={preset[0]} disabled={form.optionDefinitions.some((item) => item.key === preset[0]) || form.optionDefinitions.length >= 6} onClick={() => addDefinition(preset)}><Plus size={13} /> {preset[1]}</button>)}</div>
          <div className="variant-definition-list">{form.optionDefinitions.map((definition) => <div key={definition.key}><label><span>Option label</span><input value={definition.label} maxLength={80} onChange={(event) => updateDefinition(definition.key, 'label', event.target.value)} /></label><label><span>Display</span><select value={definition.displayType} onChange={(event) => updateDefinition(definition.key, 'displayType', event.target.value)}><option value="text">Text</option><option value="swatch">Colour swatch</option><option value="image">Product image</option></select></label><button type="button" onClick={() => removeDefinition(definition.key)} aria-label={`Remove ${definition.label}`}><Trash2 size={16} /></button></div>)}</div>
          {!form.optionDefinitions.length && <div className="variant-inline-error"><span>Add at least one customer-facing option.</span></div>}
          <div className="variant-member-map">{form.selectedProducts.map((product, index) => { const member = form.members[product._id] || { optionValues: {} }; return <article key={product._id}><div className="variant-member-map__product"><ProductThumb product={product} /><div><strong>{product.name}</strong><span>{product.sku || 'No SKU'} · ₹{Number(product.price || 0).toLocaleString('en-IN')}</span></div><div><button type="button" disabled={index === 0} onClick={() => reorder(index, -1)} aria-label={`Move ${product.name} up`}><ArrowUp size={14} /></button><button type="button" disabled={index === form.selectedProducts.length - 1} onClick={() => reorder(index, 1)} aria-label={`Move ${product.name} down`}><ArrowDown size={14} /></button></div></div><div className="variant-member-map__fields">{form.optionDefinitions.map((definition) => <label key={definition.key}><span>{definition.label} *</span><input value={member.optionValues?.[definition.key] || ''} maxLength={100} onChange={(event) => updateMemberValue(product._id, definition.key, event.target.value)} placeholder={`Example ${exampleFor(definition.key)}`} /></label>)}{form.optionDefinitions.some((item) => item.displayType === 'swatch') && <label><span>Swatch hex</span><input value={member.swatch || ''} onChange={(event) => updateMember(product._id, { swatch: event.target.value })} placeholder="#7a1f36" /></label>}<label className="variant-member-active"><input type="checkbox" checked={member.isActive !== false} onChange={(event) => updateMember(product._id, { isActive: event.target.checked })} /> Available choice</label></div></article>; })}</div>
        </section>}

        {step === 4 && <section className="variant-editor-section"><SectionTitle eyebrow="STEP 4" title="Review storefront experience" note="Confirm labels, order, price and stock before saving." /><FamilyPreview form={form} /><HealthPreview form={form} /></section>}
      </main>
      <footer><div>{currentError ? <span className="is-error"><AlertTriangle size={15} /> {currentError}</span> : <span><ShieldCheck size={15} /> This step is ready</span>}</div><div>{step > 1 && <button type="button" className="variant-secondary-btn" onClick={() => setEditor((current) => ({ ...current, step: current.step - 1 }))}><ArrowLeft size={15} /> Back</button>}{step < 4 ? <button type="button" className="admin-btn" onClick={() => setEditor((current) => ({ ...current, step: current.step + 1 }))} disabled={Boolean(currentError)}>Continue <ArrowRight size={15} /></button> : <button type="button" className="admin-btn" onClick={() => onSave(false)} disabled={busy}>{busy ? 'Saving…' : form.isActive ? 'Save & activate' : 'Save draft'}</button>}</div></footer>
    </div>
  </div>;
}

function CandidateCard({ product, selected, onClick }) {
  const grouped = Boolean(product.variantGroupId);
  return <button type="button" className={`variant-candidate ${selected ? 'is-selected' : ''}`} onClick={onClick}><ProductThumb product={product} /><span><strong title={product.name}>{product.name}</strong><small>{product.sku || 'No SKU'} · {categoryName(product.category)}</small><em className={Number(product.stock || 0) > 0 ? '' : 'is-out'}>{Number(product.stock || 0)} in stock{grouped ? ' · Already grouped' : ''}</em></span><i>{selected ? <Check size={15} /> : <Plus size={15} />}</i></button>;
}

function SelectedTray({ form, change }) {
  if (!form.selectedProducts.length) return <div className="variant-selected-empty"><PackageSearch size={25} /><p>No products selected yet.</p></div>;
  return <div className="variant-selected-tray"><div><strong>{form.selectedProducts.length} selected</strong><span>Choose the default product and remove mistakes before continuing.</span></div><div>{form.selectedProducts.map((product) => <article key={product._id}><ProductThumb product={product} /><span><b>{product.name}</b><small>{form.baseProduct === product._id ? 'Base product' : product.sku || 'No SKU'}</small></span><button type="button" className={form.baseProduct === product._id ? 'is-base' : ''} onClick={() => change({ baseProduct: product._id })}>{form.baseProduct === product._id ? 'Default' : 'Set default'}</button><button type="button" onClick={() => change((current) => removeProduct(current, product._id))} aria-label={`Remove ${product.name}`}><X size={15} /></button></article>)}</div></div>;
}

function FamilyPreview({ form }) {
  const base = form.selectedProducts.find((item) => item._id === form.baseProduct) || form.selectedProducts[0];
  return <div className="variant-storefront-preview"><div className="variant-storefront-preview__hero"><ProductThumb product={base} /><div><small>DEFAULT PRODUCT</small><h3>{base?.name || 'Choose a base product'}</h3><strong>₹{Number(base?.price || 0).toLocaleString('en-IN')}</strong></div></div><div className="variant-storefront-preview__choices"><span>{form.optionDefinitions.map((item) => item.label).join(' / ') || 'Choose an option'}</span><div>{form.selectedProducts.map((product) => { const member = form.members[product._id] || {}; const label = form.optionDefinitions.map((item) => member.optionValues?.[item.key]).filter(Boolean).join(' / ') || product.name; const active = product._id === form.baseProduct; return <button type="button" key={product._id} className={active ? 'is-active' : ''} disabled={Number(product.stock || 0) <= 0 || member.isActive === false}>{safeSwatch(member.swatch) ? <i style={{ backgroundColor: member.swatch }} /> : <ProductThumb product={product} />}<span><b>{label}</b><small>{Number(product.stock || 0) > 0 ? `₹${Number(product.price || 0).toLocaleString('en-IN')}` : 'Out of stock'}</small></span></button>; })}</div></div></div>;
}

function HealthPreview({ form }) {
  const error = validateForm(form);
  const warnings = [];
  const categories = new Set(form.selectedProducts.map((product) => categoryName(product.category)).filter(Boolean));
  if (categories.size > 1) warnings.push('Products from different categories are selected. Confirm that they are truly the same family.');
  if (form.selectedProducts.some((product) => product.isActive === false)) warnings.push('Hidden products will not appear to customers.');
  return <div className={`variant-health-preview ${error ? 'is-error' : ''}`}><div>{error ? <AlertTriangle /> : <ShieldCheck />}<strong>{error ? 'Needs attention' : 'Ready to save'}</strong></div>{error && <p>{error}</p>}{warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>;
}

function SectionTitle({ eyebrow, title, note }) { return <div className="variant-section-title"><p>{eyebrow}</p><h3>{title}</h3><span>{note}</span></div>; }
function ProductThumb({ product }) { const image = productImage(product); return <span className="variant-product-thumb">{image ? <img src={image} alt="" /> : <GitBranch size={18} />}</span>; }
function HealthRing({ health }) { return <span className={`variant-health-ring is-${health.state}`} title={`${health.score}% family health`}><b>{health.score}</b><small>%</small></span>; }

function ConfirmDialog({ target, busy, onClose }) { return <div className="variant-modal" role="dialog" aria-modal="true"><div><button type="button" className="variant-modal__close" onClick={onClose} aria-label="Close confirmation"><X /></button><AlertTriangle className="variant-modal__icon" /><h2>{target.title}</h2><p>{target.message}</p><footer><button type="button" className="variant-secondary-btn" onClick={onClose}>Cancel</button><button type="button" disabled={busy} className={target.danger ? 'variant-danger-solid' : 'admin-btn'} onClick={target.run}>{busy ? 'Working…' : target.label}</button></footer></div></div>; }
function TransferDialog({ target, busy, onClose, onConfirm }) { return <div className="variant-modal" role="dialog" aria-modal="true"><div><button type="button" className="variant-modal__close" onClick={onClose} aria-label="Close transfer confirmation"><X /></button><GitBranch className="variant-modal__icon" /><h2>Move products to this family?</h2><p>The following products will leave their current family. Their catalog data and inventory remain unchanged.</p><ul>{target.transfers.map((item) => <li key={item.productId}><b>{item.productName}</b><span>From {item.fromGroupName}</span></li>)}</ul><footer><button type="button" className="variant-secondary-btn" onClick={onClose}>Keep current groups</button><button type="button" disabled={busy} className="admin-btn" onClick={onConfirm}>{busy ? 'Moving…' : 'Confirm transfer'}</button></footer></div></div>; }
function DeleteDialog({ group, value, setValue, busy, onClose, onDelete }) { const valid = value.trim() === group.name; return <div className="variant-modal" role="dialog" aria-modal="true"><div><button type="button" className="variant-modal__close" onClick={onClose} aria-label="Close delete confirmation"><X /></button><Trash2 className="variant-modal__icon is-danger" /><h2>Delete permanently?</h2><p>Products and inventory will remain safe. Type <b>{group.name}</b> to confirm.</p><input aria-label="Type family name to confirm deletion" value={value} onChange={(event) => setValue(event.target.value)} autoComplete="off" /><footer><button type="button" className="variant-secondary-btn" onClick={onClose}>Cancel</button><button type="button" disabled={!valid || busy} className="variant-danger-solid" onClick={onDelete}>{busy ? 'Deleting…' : 'Delete permanently'}</button></footer></div></div>; }

function emptyForm() { return { id: '', revision: 0, name: '', baseProduct: '', selectedProducts: [], optionDefinitions: [{ key: 'color', label: 'Colour', displayType: 'swatch' }], members: {}, isActive: false }; }
function groupToForm(group) {
  const products = (group.members?.length ? group.members.map((item) => item.product).filter(Boolean) : group.products || []);
  const members = Object.fromEntries((group.members || []).map((member, index) => [member.productId || member.product?._id, { optionValues: member.optionValues || {}, swatch: member.swatch || '', sortOrder: member.sortOrder ?? index, isActive: member.isActive !== false }]));
  return { id: group._id, revision: group.revision || 0, name: group.name || '', baseProduct: group.baseProduct?._id || products[0]?._id || '', selectedProducts: products, optionDefinitions: group.optionDefinitions?.length ? group.optionDefinitions : [{ key: 'style', label: 'Style', displayType: 'image' }], members, isActive: Boolean(group.isActive) };
}
function addProduct(form, product) { const members = { ...form.members, [product._id]: { optionValues: Object.fromEntries(form.optionDefinitions.map((definition) => [definition.key, inferValue(product, definition.key)])), swatch: '', isActive: true } }; return { ...form, selectedProducts: [...form.selectedProducts, product], baseProduct: form.baseProduct || product._id, members }; }
function removeProduct(form, productId) { const selectedProducts = form.selectedProducts.filter((item) => item._id !== productId); const members = { ...form.members }; delete members[productId]; return { ...form, selectedProducts, members, baseProduct: form.baseProduct === productId ? selectedProducts[0]?._id || '' : form.baseProduct }; }
function addOptionDefinition(form, [key, label, displayType]) { if (form.optionDefinitions.some((item) => item.key === key) || form.optionDefinitions.length >= 6) return form; return { ...form, optionDefinitions: [...form.optionDefinitions, { key, label, displayType }], members: Object.fromEntries(Object.entries(form.members).map(([id, member]) => { const product = form.selectedProducts.find((item) => item._id === id); return [id, { ...member, optionValues: { ...member.optionValues, [key]: inferValue(product, key) } }]; })) }; }
function mapMemberValues(members, transform) { return Object.fromEntries(Object.entries(members).map(([id, member]) => [id, { ...member, optionValues: transform(member.optionValues || {}) }])); }
function inferValue(product, key) { if (!product) return ''; if (['color', 'colour'].includes(key)) return product.variantColor || product.colors?.[0] || ''; if (key === 'size') return product.variantSize || product.sizes?.[0] || ''; if (key === 'style') return product.name || ''; return product.attributeValues?.[key] || ''; }
function formPayload(form, confirmTransfers) { return { name: form.name.trim(), baseProduct: form.baseProduct, productIds: form.selectedProducts.map((product) => product._id), optionDefinitions: form.optionDefinitions, members: form.selectedProducts.map((product, index) => ({ product: product._id, optionValues: form.members[product._id]?.optionValues || {}, swatch: form.members[product._id]?.swatch || '', sortOrder: index, isActive: form.members[product._id]?.isActive !== false })), isActive: form.isActive, baseRevision: form.id ? form.revision : undefined, confirmTransfers }; }
function validateStep(form, step) { if (step === 1) return !form.name.trim() ? 'Enter a family name.' : form.baseProduct && !form.selectedProducts.some((item) => item._id === form.baseProduct) ? 'Base product must be selected in this family.' : ''; if (step === 2) return !form.selectedProducts.length ? 'Select at least one product.' : !form.baseProduct ? 'Choose a base product.' : form.isActive && form.selectedProducts.length < 2 ? 'A live family needs at least two products.' : ''; if (step === 3) return validateOptions(form); return ''; }
function validateForm(form) { return validateStep(form, 1) || validateStep(form, 2) || validateStep(form, 3); }
function validateOptions(form) { if (!form.optionDefinitions.length) return 'Add at least one customer-facing option.'; const activeProducts = form.selectedProducts.filter((product) => form.members[product._id]?.isActive !== false); if (form.isActive && activeProducts.length < 2) return 'A live family needs at least two available choices.'; if (form.isActive && !activeProducts.some((product) => product._id === form.baseProduct)) return 'The default product must remain an available choice.'; const signatures = new Set(); for (const product of activeProducts) { const member = form.members[product._id] || {}; const values = form.optionDefinitions.map((definition) => String(member.optionValues?.[definition.key] || '').trim()); if (form.isActive && values.some((value) => !value)) return `Complete option values for ${product.name}.`; const signature = values.map((value) => value.toLowerCase()).join('|'); if (form.isActive && signatures.has(signature)) return 'Every available product needs a unique option combination.'; signatures.add(signature); } return ''; }
function writeRecovery(prefix, form) { try { localStorage.setItem(recoveryKey(prefix, form.id), JSON.stringify({ revision: form.revision, savedAt: Date.now(), form })); } catch { /* storage is optional */ } }
function readRecovery(prefix, id) { try { const value = JSON.parse(localStorage.getItem(recoveryKey(prefix, id)) || 'null'); return value?.form ? value : null; } catch { return null; } }
function clearRecovery(prefix, id) { try { localStorage.removeItem(recoveryKey(prefix, id)); } catch { /* storage is optional */ } }
function recoveryKey(prefix, id) { return `samira-variant-family:${prefix}:${id || 'new'}`; }
function productImage(product) { return normalizeImageUrl(getPrimaryImageUrl(product?.images || []) || product?.primaryImage || ''); }
function categoryName(value) { return typeof value === 'object' ? value?.name || 'Uncategorised' : value || 'Uncategorised'; }
function safeSwatch(value) { return /^#[0-9a-f]{3,8}$/i.test(String(value || '')); }
function errorText(error) { return error?.data?.message || error?.message || 'Unable to complete this action. Please try again.'; }
function exampleFor(key) { return ({ color: 'Rose', colour: 'Rose', size: 'Large', storage: '256 GB', ram: '8 GB', material: 'Silk', purity: '22K', pack_size: 'Pack of 2', style: 'Floral' })[key] || 'Option value'; }
