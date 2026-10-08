import { usesGarmentSizing } from '../../utils/productSizing';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive, ArchiveRestore, Check, ChevronLeft, ChevronRight, CopyPlus, Eye,
  FilePenLine, Filter, ImagePlus, PackageCheck, RefreshCw, Search, Trash2, X,
} from 'lucide-react';
import api from '../../services/api';
import { Select, TextArea, TextInput } from '../../components/ui/Field';
import PageHeader from '../../components/admin/PageHeader';
import EmptyState from '../../components/admin/EmptyState';
import Loader from '../../components/admin/Loader';
import ProductSmartFill from '../../components/admin/ProductSmartFill';
import ProductRentalPricing, { rentalPricingError } from '../../components/admin/ProductRentalPricing';
import ProductPreviewModal from '../../components/admin/ProductPreviewModal';
import ImageUploader from '../../components/admin/ImageUploader';
import DraftPhotoUploadPanel from '../../components/admin/DraftPhotoUploadPanel';
import VideoUploader from '../../components/admin/VideoUploader';
import BarcodeScanner from '../../components/admin/BarcodeScanner';
import { applySmartPatch } from '../../utils/productSmartFill';
import { buildDraftPhotoGroups } from '../../utils/draftPhotoGroups';
import { fetchCategories, fetchSubcategories } from '../../utils/catalogOptions';
import { normalizeImageUrl } from '../../services/normalize';
import useDesktopFeedback from '../../hooks/useDesktopFeedback';
import { buildVariantMatrix } from '../../utils/variants';
import {
  useArchiveProductDraftMutation, useBulkUploadProductDraftsMutation,
  useDeleteProductDraftMutation, useGetProductDraftsQuery,
  usePublishSelectedDraftsMutation, useRestoreProductDraftMutation,
  useUpdateProductDraftMutation,
} from '../../store/apiSlice';
import {
  buildSizeChartPayload, getSelectableSizes, getSizeChartColumns,
  inferSizeChartProfile, reconcileSizeChartRows, resolveSizingMode,
  SIZE_CHART_PROFILES,
} from '../../utils/productSizing';
import './ProductDrafts.css';

const PAGE_SIZE = 24;
const MAX_DRAFT_PHOTOS = 30;

export default function ProductDrafts({ route = '/admin/product-drafts' }) {
  const focusedDraftId = new URLSearchParams(route.split('?')[1] || '').get('draftId') || '';
  const apiPrefix = route.startsWith('/seller/') ? '/seller' : '/admin';
  const [categories, setCategories] = useState([]);
  const [categoryError, setCategoryError] = useState('');
  const [structure, setStructure] = useState(null);
  const [structureError, setStructureError] = useState('');
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState([]);
  const [files, setFiles] = useState([]);
  const [groupMode, setGroupMode] = useState('single');
  const [photoGroups, setPhotoGroups] = useState([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [status, setStatus] = useState('active');
  const [sourceType, setSourceType] = useState('');
  const [category, setCategory] = useState('');
  const [readiness, setReadiness] = useState('');
  const [sort, setSort] = useState('updated');
  const [page, setPage] = useState(1);
  const [editorDraft, setEditorDraft] = useState(null);
  const [editorTab, setEditorTab] = useState('basic');
  const [previewDraft, setPreviewDraft] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [bulkCategory, setBulkCategory] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const publishingRef = useRef(false);
  const deletingRef = useRef(false);
  const uploadingRef = useRef(false);
  const { notify } = useDesktopFeedback();

  const loadStructure = useCallback(() => api.get('/catalog-configuration')
    .then((value) => { setStructure(value); setStructureError(''); })
    .catch((error) => setStructureError(error.message || 'Product configuration could not be loaded.')), []);
  const loadCategories = useCallback(() => fetchCategories(api, apiPrefix)
    .then((value) => { setCategories(value.filter((item) => !item.isArchived)); setCategoryError(''); })
    .catch((error) => { setCategories([]); setCategoryError(error.message || 'Categories could not be loaded.'); }), [apiPrefix]);
  useEffect(() => { loadStructure(); loadCategories(); }, [loadCategories, loadStructure]);
  useEffect(() => {
    const timer = window.setTimeout(() => { setQuery(searchValue.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [searchValue]);

  const queryArgs = {
    apiPrefix, page, limit: PAGE_SIZE, status, sort,
    ...(query ? { q: query } : {}), ...(sourceType ? { sourceType } : {}),
    ...(category ? { category } : {}), ...(readiness ? { readiness } : {}),
  };
  const { data: draftResponse, isLoading, isFetching, error: listError, refetch } = useGetProductDraftsQuery(queryArgs);
  const [bulkUploadProductDrafts, { isLoading: uploading }] = useBulkUploadProductDraftsMutation();
  const [updateProductDraft] = useUpdateProductDraftMutation();
  const [archiveProductDraft] = useArchiveProductDraftMutation();
  const [restoreProductDraft] = useRestoreProductDraftMutation();
  const [deleteProductDraft] = useDeleteProductDraftMutation();
  const [publishSelectedDrafts] = usePublishSelectedDraftsMutation();
  const drafts = useMemo(() => Array.isArray(draftResponse?.data) ? draftResponse.data : [], [draftResponse]);
  const meta = draftResponse?.meta || { page: 1, total: drafts.length, totalPages: 1, summary: summarizeLocal(drafts) };
  const summary = meta.summary || summarizeLocal(drafts);

  useEffect(() => {
    if (Number(meta.totalPages) > 0 && page > Number(meta.totalPages)) setPage(Number(meta.totalPages));
  }, [meta.totalPages, page]);

  useEffect(() => {
    setSelected((current) => current.filter((id) => drafts.some((draft) => draftId(draft) === id && draft.status === 'draft')));
  }, [drafts]);
  useEffect(() => {
    if (!focusedDraftId || editorDraft) return;
    const visible = drafts.find((draft) => draftId(draft) === focusedDraftId);
    if (visible) { setEditorDraft(visible); return; }
    api.get(`${apiPrefix}/product-drafts/${encodeURIComponent(focusedDraftId)}`, { silent: true })
      .then((value) => setEditorDraft(value?.data || value))
      .catch(() => setMessage('The requested draft was not found or is no longer available.'));
  }, [apiPrefix, drafts, editorDraft, focusedDraftId]);

  const showFeedback = useCallback((text, type = 'info') => {
    if (!text) return;
    if (!notify(text, type, 'Product Drafts')) setMessage(text);
    else setMessage('');
  }, [notify]);

  const onUpload = async () => {
    if (uploadingRef.current) return;
    if (!files.length) return showFeedback('Choose one or more product photos first.', 'warning');
    let groups;
    if (groupMode === 'grouped') {
      if (!meta.photoGrouping?.version) return showFeedback('Grouped uploads are currently unavailable. Refresh the drafts page before trying again.', 'warning');
      try { groups = buildDraftPhotoGroups(files, photoGroups); }
      catch (error) { return showFeedback(error.message, 'warning'); }
    }
    uploadingRef.current = true;
    try {
      const result = await bulkUploadProductDrafts({ files, groupMode, ...(groups ? { photoGroups: groups } : {}), apiPrefix }).unwrap();
      const created = result?.data?.drafts?.length || (groupMode === 'single' ? 1 : groupMode === 'grouped' ? groups.length : files.length);
      setFiles([]); setPhotoGroups([]); setUploadOpen(false); setPage(1);
      showFeedback(`${created} product draft${created === 1 ? '' : 's'} created.`, 'success');
    } catch (error) { showFeedback(error.data?.message || error.message || 'Draft upload failed. Your selected photos are kept; retry to continue.', 'error'); }
    finally { uploadingRef.current = false; }
  };

  const saveDraft = useCallback(async (form, { silent = false } = {}) => {
    try {
      const response = await updateProductDraft({ id: draftId(form), body: { ...normalizeDraftBody(form, categories, structure), saveMode: silent ? 'auto' : 'manual' }, apiPrefix }).unwrap();
      if (!silent) showFeedback('Draft saved successfully.', 'success');
      return response?.data || response;
    } catch (error) {
      if (!silent || error?.data?.code === 'DRAFT_STALE') showFeedback(error.data?.message || error.message || 'Draft could not be saved.', 'error');
      throw error;
    }
  }, [apiPrefix, categories, showFeedback, structure, updateProductDraft]);

  const archiveOne = async (draft) => {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      await archiveProductDraft({ id: draftId(draft), apiPrefix }).unwrap();
      setSelected((current) => current.filter((id) => id !== draftId(draft)));
      if (draftId(editorDraft) === draftId(draft)) setEditorDraft(null);
      showFeedback('Draft archived. You can restore it from Archived.', 'success');
    } catch (error) { showFeedback(error.data?.message || error.message || 'Draft could not be archived.', 'error'); }
    finally { setActionBusy(false); }
  };

  const restoreOne = async (draft) => {
    if (actionBusy) return;
    setActionBusy(true);
    try { await restoreProductDraft({ id: draftId(draft), apiPrefix }).unwrap(); showFeedback('Draft restored.', 'success'); }
    catch (error) { showFeedback(error.data?.message || error.message || 'Draft could not be restored.', 'error'); }
    finally { setActionBusy(false); }
  };

  const permanentlyDelete = async () => {
    if (!pendingDelete || actionBusy || deletingRef.current) return;
    const expected = String(pendingDelete.name || draftId(pendingDelete)).trim();
    if (deleteConfirmation.trim() !== expected) return;
    deletingRef.current = true;
    setActionBusy(true);
    try {
      await deleteProductDraft({ id: draftId(pendingDelete), confirm: expected, baseRevision: Number(pendingDelete.revision || 0), apiPrefix }).unwrap();
      setPendingDelete(null); setDeleteConfirmation('');
      if (draftId(editorDraft) === draftId(pendingDelete)) setEditorDraft(null);
      if (draftId(previewDraft) === draftId(pendingDelete)) setPreviewDraft(null);
      setSelected(current => current.filter(id => id !== draftId(pendingDelete)));
      try { localStorage.removeItem(`samira-product-draft:${draftId(pendingDelete)}`); } catch { /* Storage may be unavailable. */ }
      showFeedback(pendingDelete.publishedProductId ? 'Published draft removed. Its product is unchanged.' : 'Draft deleted permanently.', 'success');
    } catch (error) { showFeedback(error.data?.message || error.message || 'Draft could not be deleted.', 'error'); }
    finally { deletingRef.current = false; setActionBusy(false); }
  };

  const publishIds = async (ids) => {
    if (!ids.length || publishingRef.current) return null;
    publishingRef.current = true; setPublishing(true);
    try {
      const response = await publishSelectedDrafts({ ids, apiPrefix }).unwrap();
      const results = response?.data?.results || [];
      const failed = results.filter((item) => item.status === 'failed');
      setSelected(failed.map((item) => item.id));
      showFeedback(response?.message || 'Selected drafts published.', failed.length ? 'warning' : 'success');
      return response;
    } catch (error) {
      const results = error?.data?.data?.results || [];
      if (results.length) setSelected(results.filter((item) => item.status === 'failed').map((item) => item.id));
      showFeedback(error.data?.message || error.message || 'Selected drafts could not be published.', 'error');
      throw error;
    } finally { publishingRef.current = false; setPublishing(false); }
  };

  const publishFromEditor = async (form) => {
    const saved = await saveDraft(form, { silent: true });
    const response = await publishIds([draftId(form)]);
    if (!response?.data?.results?.some((item) => item.status === 'failed')) setEditorDraft(null);
    return saved;
  };

  const applyBulkCategory = async () => {
    if (!bulkCategory || !selected.length || actionBusy) return;
    setActionBusy(true); let failures = 0;
    for (const id of selected) {
      const draft = drafts.find((item) => draftId(item) === id);
      if (!draft) continue;
      try { await saveDraft({ ...draft, category: bulkCategory }, { silent: true }); } catch { failures += 1; }
    }
    setActionBusy(false);
    if (failures) showFeedback(`${failures} selected draft${failures === 1 ? '' : 's'} could not be updated.`, 'error');
    else { setBulkCategory(''); showFeedback('Category applied to selected drafts.', 'success'); }
  };

  const archiveSelected = async () => {
    if (!selected.length || actionBusy) return;
    setActionBusy(true); let failures = 0;
    for (const id of selected) { try { await archiveProductDraft({ id, apiPrefix }).unwrap(); } catch { failures += 1; } }
    setActionBusy(false); setSelected([]);
    showFeedback(failures ? `${failures} selected draft${failures === 1 ? '' : 's'} could not be archived.` : 'Selected drafts archived.', failures ? 'warning' : 'success');
  };

  const chooseSummary = (nextReadiness, nextStatus = 'active') => {
    setStatus(nextStatus); setReadiness(nextReadiness); setPage(1); setSelected([]);
  };
  const openEditor = (draft, initialTab = 'basic') => { setEditorTab(initialTab); setEditorDraft(draft); };
  const selectable = drafts.filter((draft) => draft.status === 'draft').map(draftId);
  const allSelected = selectable.length > 0 && selectable.every((id) => selected.includes(id));

  return <section className="product-drafts-page">
    <PageHeader title="Product Drafts" note="Prepare, review and publish catalog products from one focused workspace.">
      <a href={`${apiPrefix}/social-import`} className="admin-btn-ghost">Import social link</a>
      <button type="button" className="admin-btn" disabled={uploading} onClick={() => setUploadOpen((value) => !value)}><ImagePlus size={16} />Create from photos</button>
    </PageHeader>
    {focusedDraftId && <p className="admin-note">Opened from an import. <a className="text-wine underline" href={`${apiPrefix}/product-drafts`}>Return to all drafts</a></p>}
    {(structureError || categoryError) && <div role="alert" className="draft-alert is-error"><span>{structureError || categoryError}</span><button type="button" onClick={() => { loadStructure(); loadCategories(); }}>Retry</button></div>}
    {listError && <div role="alert" className="draft-alert is-error"><span>{listError.data?.message || listError.message || 'Drafts could not be loaded.'}</span><button type="button" onClick={refetch}>Retry</button></div>}
    {message && <p role="status" className="draft-alert">{message}</p>}
    {uploadOpen && <DraftPhotoUploadPanel files={files} setFiles={setFiles} groupMode={groupMode} setGroupMode={setGroupMode} groups={photoGroups} setGroups={setPhotoGroups} groupingSupported={meta.photoGrouping?.version >= 1} uploading={uploading} onUpload={onUpload} onClose={() => { setUploadOpen(false); setFiles([]); setPhotoGroups([]); }} />}

    <div className="draft-summary-grid" aria-label="Draft summary">
      <SummaryButton label="Draft queue" value={Number(summary.draft || 0)} active={status === 'active' && !readiness} onClick={() => chooseSummary('', 'active')} />
      <SummaryButton label="Needs details" value={summary.incomplete || 0} tone="danger" active={readiness === 'incomplete'} onClick={() => chooseSummary('incomplete')} />
      <SummaryButton label="Needs review" value={summary.review || 0} active={readiness === 'review'} onClick={() => chooseSummary('review')} />
      <SummaryButton label="Ready" value={summary.ready || 0} tone="success" active={readiness === 'ready'} onClick={() => chooseSummary('ready')} />
      <SummaryButton label="Published history" value={summary.published || 0} active={status === 'published'} onClick={() => chooseSummary('', 'published')} />
      <SummaryButton label="Archived" value={summary.archived || 0} active={status === 'archived'} onClick={() => chooseSummary('', 'archived')} />
    </div>

    <div className="admin-card draft-toolbar">
      <label className="draft-search"><Search size={18} /><input value={searchValue} onChange={(event) => setSearchValue(event.target.value)} placeholder="Search name, SKU or barcode" aria-label="Search product drafts" />{searchValue && <button type="button" onClick={() => setSearchValue('')} aria-label="Clear search"><X size={15} /></button>}</label>
      <div className="draft-filters"><Filter size={16} /><Select value={sourceType} onChange={(event) => { setSourceType(event.target.value); setPage(1); }} aria-label="Filter by draft source"><option value="">All sources</option><option value="manual">Manual / upload</option><option value="social-import">Social import</option><option value="reel-import">Reel import</option></Select><Select value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }} aria-label="Filter by category"><option value="">All categories</option>{categories.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</Select><Select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }} aria-label="Sort drafts"><option value="updated">Recently updated</option><option value="oldest">Oldest first</option><option value="name">Product name</option></Select><button type="button" onClick={refetch} className="admin-btn-ghost" disabled={isFetching}><RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />Refresh</button></div>
    </div>

    {!!selected.length && <div className="draft-bulk-bar"><strong>{selected.length} selected</strong><div><Select value={bulkCategory} onChange={(event) => setBulkCategory(event.target.value)} aria-label="Category for selected drafts"><option value="">Assign category...</option>{categories.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</Select><button type="button" className="admin-btn-ghost" disabled={!bulkCategory || actionBusy} onClick={applyBulkCategory}><Check size={15} />Apply</button></div><button type="button" className="admin-btn-ghost" disabled={actionBusy} onClick={archiveSelected}><Archive size={15} />Archive</button><button type="button" className="admin-btn" disabled={publishing || actionBusy || !structure} onClick={() => publishIds(selected)}><CopyPlus size={16} />{publishing ? 'Publishing...' : 'Publish selected'}</button></div>}

    <div className="admin-card draft-queue"><div className="draft-queue__heading"><label><input type="checkbox" checked={allSelected} disabled={!selectable.length} onChange={() => setSelected(allSelected ? [] : selectable)} />Select page</label><span>{meta.total || 0} result{Number(meta.total) === 1 ? '' : 's'}</span></div>{isLoading ? <Loader label="Loading product drafts..." /> : !drafts.length ? <EmptyState title={status === 'archived' ? 'No archived drafts' : 'No product drafts found'} note={query ? 'Try a different search or clear the filters.' : 'Create drafts from photos or import a social product link.'} /> : <div className="draft-card-grid">{drafts.map((draft) => <DraftQueueCard key={draftId(draft)} draft={draft} selected={selected.includes(draftId(draft))} busy={actionBusy || publishing} onSelect={() => setSelected((current) => current.includes(draftId(draft)) ? current.filter((id) => id !== draftId(draft)) : [...current, draftId(draft)])} onEdit={() => openEditor(draft)} onAddPhotos={() => openEditor(draft, 'media')} onPreview={() => setPreviewDraft(draft)} onArchive={() => archiveOne(draft)} onRestore={() => restoreOne(draft)} onDelete={() => { setPendingDelete(draft); setDeleteConfirmation(''); }} />)}</div>}{Number(meta.totalPages || 1) > 1 && <div className="draft-pagination"><button type="button" disabled={page <= 1 || isFetching} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft size={16} />Previous</button><span>Page {meta.page || page} of {meta.totalPages}</span><button type="button" disabled={page >= meta.totalPages || isFetching} onClick={() => setPage((value) => value + 1)}>Next<ChevronRight size={16} /></button></div>}</div>

    {editorDraft && <DraftEditor key={draftId(editorDraft)} draft={editorDraft} initialTab={editorTab} categories={categories} structure={structure} apiPrefix={apiPrefix} onClose={() => setEditorDraft(null)} onSave={saveDraft} onPublish={publishFromEditor} onPreview={setPreviewDraft} />}
    {previewDraft && <ProductPreviewModal product={normalizeDraftBody(previewDraft, categories, structure)} onClose={() => setPreviewDraft(null)} />}
    {pendingDelete && <ConfirmDelete draft={pendingDelete} value={deleteConfirmation} onChange={setDeleteConfirmation} busy={actionBusy} onCancel={() => { setPendingDelete(null); setDeleteConfirmation(''); }} onDelete={permanentlyDelete} />}
  </section>;
}

function SummaryButton({ label, value, active, tone = '', onClick }) {
  return <button type="button" onClick={onClick} className={`draft-summary ${active ? 'is-active' : ''} ${tone ? `is-${tone}` : ''}`}><span>{label}</span><strong>{value}</strong></button>;
}

function DraftQueueCard({ draft, selected, busy, onSelect, onEdit, onAddPhotos, onPreview, onArchive, onRestore, onDelete }) {
  const readiness = draft.readiness || localReadiness(draft);
  const photos = getDraftImages(draft);
  const image = photos.find((item) => item.primary)?.url;
  const published = draft.status === 'published'; const archived = draft.status === 'archived';
  const statusLabel = published ? 'Published' : archived ? 'Archived' : readiness.state === 'incomplete' ? 'Needs details' : readiness.state === 'ready' ? 'Ready' : 'Review';
  return <article className={`draft-queue-card ${selected ? 'is-selected' : ''}`}>
    <div className="draft-queue-card__image">{image ? <img src={normalizeImageUrl(image)} alt={draft.name || 'Product draft'} loading="lazy" /> : <ImagePlus size={30} />}<span className={`draft-status is-${readiness.state}`}>{statusLabel}</span><span className="draft-photo-count"><ImagePlus size={13} />{photos.length} photo{photos.length === 1 ? '' : 's'}</span>{draft.status === 'draft' && <label aria-label={`Select ${draft.name || 'draft'}`}><input type="checkbox" checked={selected} disabled={busy} onChange={onSelect} /></label>}</div>
    <div className="draft-queue-card__body"><div><p>{sourceLabel(draft.sourceType)}</p><h3 title={draft.name || 'Unnamed product'}>{draft.name || 'Unnamed product'}</h3><span>{categoryName(draft.category) || 'Category not selected'} · Updated {formatRelative(draft.updatedAt)}</span></div><div className="draft-progress"><span><i style={{ width: `${readiness.score || 0}%` }} /></span><b>{readiness.score || 0}% complete</b></div>{(draft.lastPublishError || readiness.issues?.[0]) && <p className="draft-first-issue">{draft.lastPublishError || readiness.issues[0]}</p>}</div>
    <div className="draft-queue-card__actions">
      {published && draft.publishedProductId ? draft.publishedProductDeleted ? <span className="draft-inline-note">Product permanently removed</span> : <a className="admin-btn" href={`/admin/products/edit?id=${encodeURIComponent(draft.publishedProductId)}`}><FilePenLine size={15} />Edit product</a> : archived ? <button type="button" className="admin-btn" onClick={onRestore} disabled={busy}><ArchiveRestore size={15} />Restore</button> : <><button type="button" className="admin-btn" onClick={onEdit} disabled={busy}><FilePenLine size={15} />Review</button><button type="button" className="admin-btn-ghost" onClick={onAddPhotos} disabled={busy}><ImagePlus size={15} />Add photos</button><button type="button" className="admin-btn-ghost" onClick={onPreview}><Eye size={15} />Preview</button><button type="button" className="draft-icon-button" onClick={onArchive} disabled={busy} aria-label="Archive draft"><Archive size={16} /></button></>}
      {(published || archived) && <button type="button" className="draft-danger-button" onClick={onDelete} disabled={busy}><Trash2 size={15} />{published ? 'Remove draft' : 'Delete'}</button>}
    </div>
  </article>;
}

function DraftEditor({ draft, initialTab = 'basic', categories, structure, apiPrefix, onClose, onSave, onPublish, onPreview }) {
  const [form, setForm] = useState(() => draftToForm(draft));
  const [tab, setTab] = useState(initialTab);
  const [mediaOpened, setMediaOpened] = useState(initialTab === 'media');
  const [subcategories, setSubcategories] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState('saved');
  const [error, setError] = useState('');
  const [uploadBusy, setUploadBusy] = useState(false);
  const [stale, setStale] = useState(false);
  const [recovery, setRecovery] = useState(null);
  const saveLock = useRef(false);
  const editVersion = useRef(0);
  const initialized = useRef(false);
  const storageKey = `samira-product-draft:${draftId(draft)}`;
  const published = draft.status === 'published';

  useEffect(() => {
    const categoryId = form.category?._id || form.category || '';
    fetchSubcategories(api, categoryId, apiPrefix).then(setSubcategories);
  }, [apiPrefix, form.category]);
  useEffect(() => {
    try {
      const local = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (local?.form && Number(local.revision) === Number(draft.revision || 0) && new Date(local.savedAt) > new Date(draft.updatedAt || 0)) setRecovery(local);
    } catch { /* Ignore damaged local recovery state. */ }
    initialized.current = true;
  }, [draft.revision, draft.updatedAt, storageKey]);
  useEffect(() => {
    if (!initialized.current || !dirty) return;
    try { localStorage.setItem(storageKey, JSON.stringify({ form, revision: form.revision || 0, savedAt: new Date().toISOString() })); } catch { /* Browser storage may be unavailable. */ }
  }, [dirty, form, storageKey]);
  useEffect(() => {
    const beforeUnload = (event) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event) => { if (event.key === 'Escape' && !uploadBusy && !saveLock.current) { if (!dirty || window.confirm('Discard unsaved changes and close this draft?')) onClose(); } };
    window.addEventListener('keydown', onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', onKeyDown); };
  }, [dirty, onClose, uploadBusy]);

  const edit = useCallback((updater) => {
    editVersion.current += 1;
    setDirty(true); setSaveState('unsaved'); setStale(false); setError('');
    setForm((current) => typeof updater === 'function' ? updater(current) : updater);
  }, []);
  const update = (field, value) => edit((current) => ({ ...current, [field]: value }));
  const save = useCallback(async ({ silent = false } = {}) => {
    if (saveLock.current || published || uploadBusy) return null;
    saveLock.current = true; setSaveState('saving'); setError('');
    const version = editVersion.current;
    try {
      const saved = await onSave(form, { silent });
      setForm((current) => ({ ...current, revision: saved?.revision ?? current.revision, updatedAt: saved?.updatedAt || current.updatedAt }));
      if (version === editVersion.current) {
        setDirty(false); setSaveState('saved');
        try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
      } else setSaveState('unsaved');
      return saved;
    } catch (failure) {
      setSaveState('error'); setError(failure.data?.message || failure.message || 'Draft could not be saved.');
      if (failure.data?.code === 'DRAFT_STALE') setStale(true);
      throw failure;
    } finally { saveLock.current = false; }
  }, [form, onSave, published, storageKey, uploadBusy]);
  useEffect(() => {
    if (!dirty || published || stale || uploadBusy || saveState === 'saving') return undefined;
    const timer = window.setTimeout(() => save({ silent: true }).catch(() => null), 1800);
    return () => window.clearTimeout(timer);
  }, [dirty, form, published, save, saveState, stale, uploadBusy]);

  const close = () => { if (uploadBusy || saveLock.current) return; if (!dirty || window.confirm('Discard unsaved changes and close this draft?')) onClose(); };
  const publish = async () => {
    setError(''); setSaveState('saving');
    try {
      await onPublish(form);
      try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
    } catch (failure) {
      setSaveState('error'); setError(failure.data?.message || failure.message || 'Draft could not be published.');
    }
  };
  const categoryLabel = categories.find((item) => String(item._id) === String(form.category?._id || form.category))?.name || '';
  const sizingProduct = { ...form, category: categoryLabel, ...(!usesGarmentSizing(structure, form) ? { sizingMode: 'free-size', sizeChartProfile: 'free-size' } : {}) };
  const sizingMode = resolveSizingMode(sizingProduct);
  const sizes = getSelectableSizes(sizingProduct);
  const colors = list(form.colors);
  const columns = getSizeChartColumns(sizingProduct);
  const rows = reconcileSizeChartRows(form.sizeChart?.rows, sizes, columns);
  const syncVariants = () => edit((current) => ({ ...current, variants: buildVariantMatrix(sizes, colors, current.variants || []) }));
  const updateVariant = (index, field, value) => edit((current) => ({ ...current, variants: (current.variants || []).map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item) }));
  const updateMeasurement = (size, field, value) => edit((current) => ({ ...current, sizeChart: {
    unit: current.sizeChart?.unit === 'cm' ? 'cm' : 'in', columns: columns.map((item) => item.key),
    rows: reconcileSizeChartRows(current.sizeChart?.rows, getSelectableSizes({ ...current, category: categoryLabel }), columns).map((row) => row.size === size ? { ...row, [field]: value } : row),
  } }));
  const readiness = localReadiness(normalizeDraftBody(form, categories, structure));
  const common = { form, update, edit, categories, structure, apiPrefix, subcategories, sizingMode, sizingProduct, sizes, colors, columns, rows, syncVariants, updateVariant, updateMeasurement, setUploadBusy, mediaDisabled: published || stale || uploadBusy };

  return <div className="draft-editor-overlay" role="dialog" aria-modal="true" aria-labelledby="draft-editor-title"><aside className="draft-editor">
    <header className="draft-editor__header"><div><p>PRODUCT REVIEW</p><h2 id="draft-editor-title">{form.name || 'Unnamed product draft'}</h2><span className={`draft-editor-save is-${saveState}`}>{saveState === 'saving' ? 'Saving...' : saveState === 'saved' ? 'All changes saved' : saveState === 'error' ? 'Save failed' : 'Unsaved changes'}</span></div><button type="button" disabled={uploadBusy || saveState === 'saving'} onClick={close} aria-label="Close draft editor"><X /></button></header>
    {recovery && <div className="draft-recovery"><span>Newer unsaved changes were found on this device.</span><button type="button" onClick={() => { setForm(recovery.form); setDirty(true); setRecovery(null); }}>Restore</button><button type="button" onClick={() => { localStorage.removeItem(storageKey); setRecovery(null); }}>Discard</button></div>}
    {stale && <div className="draft-alert is-error"><span>This draft changed elsewhere. Reload the latest version before editing again.</span><button type="button" onClick={() => window.location.reload()}>Reload</button></div>}
    {error && <p role="alert" className="draft-alert is-error">{error}</p>}
    {uploadBusy && <p role="status" className="draft-alert">Finish uploading or editing media before saving or closing this draft.</p>}
    <div className="draft-editor__score"><span><i style={{ width: `${readiness.score}%` }} /></span><strong>{readiness.score}% complete</strong>{readiness.issues[0] && <em>{readiness.issues[0]}</em>}</div>
    <nav className="draft-editor__tabs" aria-label="Draft sections">{[['basic', 'Basics'], ['media', 'Photos & video'], ['inventory', 'Inventory'], ['shipping', 'Shipping'], ['content', 'Content & SEO'], ['visibility', 'Visibility']].map(([key, label]) => <button type="button" key={key} aria-current={tab === key ? 'page' : undefined} disabled={uploadBusy} onClick={() => { setTab(key); if (key === 'media') setMediaOpened(true); }}>{label}{key === 'media' && <span className="draft-tab-count">{form.images.length}</span>}</button>)}</nav>
    <div className="draft-editor__content"><fieldset disabled={published || stale}>{tab === 'basic' && <BasicFields {...common} />}{mediaOpened && <div hidden={tab !== 'media'}><MediaFields {...common} draft={draft} /></div>}{tab === 'inventory' && <InventoryFields {...common} />}{tab === 'shipping' && <ShippingFields {...common} />}{tab === 'content' && <ContentFields {...common} />}{tab === 'visibility' && <VisibilityFields {...common} />}</fieldset></div>
    <footer className="draft-editor__footer"><button type="button" className="admin-btn-ghost" disabled={uploadBusy} onClick={() => onPreview({ ...form, category: categories.find((item) => String(item._id) === String(form.category)) || form.category })}><Eye size={16} />Preview</button><span /><button type="button" className="admin-btn-ghost" disabled={uploadBusy || saveState === 'saving'} onClick={close}>Close</button>{!published && <button type="button" className="admin-btn-ghost" disabled={!dirty || saveState === 'saving' || stale || uploadBusy} onClick={() => save().catch(() => null)}><Check size={16} />Save draft</button>}{!published && <button type="button" className="admin-btn" disabled={saveState === 'saving' || stale || uploadBusy || !structure} onClick={publish}><PackageCheck size={16} />Save & publish</button>}</footer>
  </aside></div>;
}

function BasicFields({ form, update, edit, categories, structure, apiPrefix, subcategories }) {
  return <div className="draft-form-section"><ProductSmartFill form={form} categories={categories} structure={structure} apiPrefix={apiPrefix} priceField="sellingPrice" onApply={(patch, undo) => edit((current) => applySmartPatch(current, patch, undo))} disabled={!structure} /><SectionTitle title="Product identity" note="Customer-facing name, category and commercial identifiers." />{!categories.length && <p className="draft-inline-note">Create an active category before publishing this product.</p>}<Field label="Product name" required><TextInput value={form.name || ''} maxLength={180} onChange={(event) => update('name', event.target.value)} /></Field><div className="draft-form-grid"><Field label="Category" required><Select value={form.category?._id || form.category || ''} onChange={(event) => edit((current) => ({ ...current, category: event.target.value, subCategory: '' }))}><option value="">Select category</option>{categories.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</Select></Field><Field label="Subcategory"><Select value={form.subCategory || ''} onChange={(event) => update('subCategory', event.target.value)}><option value="">{subcategories.length ? 'Select subcategory' : 'No subcategories yet'}</option>{form.subCategory && !subcategories.includes(form.subCategory) && <option value={form.subCategory}>{form.subCategory}</option>}{subcategories.map((item) => <option key={item} value={item}>{item}</option>)}</Select></Field></div><div className="draft-form-grid"><Field label="SKU"><TextInput value={form.sku || ''} maxLength={100} onChange={(event) => update('sku', event.target.value)} /></Field><Field label="Barcode"><div className="draft-input-action"><TextInput value={form.barcode || ''} maxLength={100} onChange={(event) => update('barcode', event.target.value)} /><BarcodeScanner onDetected={(value) => update('barcode', value)} /></div></Field><Field label="Supplier SKU"><TextInput value={form.supplierSku || ''} maxLength={100} onChange={(event) => update('supplierSku', event.target.value)} /></Field><Field label="HSN code"><TextInput value={form.hsnCode || ''} maxLength={20} onChange={(event) => update('hsnCode', event.target.value)} /></Field></div><SectionTitle title="Pricing" /><Field label="Available for"><Select value={form.commerceMode || 'SALE_ONLY'} onChange={event => update('commerceMode', event.target.value)}><option value="SALE_ONLY">Sale only</option><option value="RENTAL_ONLY">Rental only</option><option value="SALE_AND_RENTAL">Sale and rental</option></Select></Field><div className="draft-form-grid four"><NumberField label={form.commerceMode === 'RENTAL_ONLY' ? 'Reference item value' : 'Selling price'} required value={form.sellingPrice ?? form.price ?? ''} onChange={(value) => update('sellingPrice', value)} />{form.commerceMode !== 'RENTAL_ONLY' && <NumberField label="MRP" required value={form.originalPrice ?? ''} onChange={(value) => update('originalPrice', value)} />}<NumberField label="Cost price" value={form.costPrice ?? ''} onChange={(value) => update('costPrice', value)} /><NumberField label="GST rate (%)" value={form.gstRate ?? ''} max="100" onChange={(value) => update('gstRate', value)} /></div>{form.commerceMode && form.commerceMode !== 'SALE_ONLY' && <ProductRentalPricing value={form.rentalPricing} onChange={value => update('rentalPricing', value)} apiPrefix={apiPrefix} />}{structure?.attributes?.map((attribute) => <Field key={attribute.key} label={`${attribute.label}${attribute.unit ? ` (${attribute.unit})` : ''}`} required={attribute.required}><TextInput value={form.attributeValues?.[attribute.key] ?? ''} maxLength={500} onChange={(event) => update('attributeValues', { ...form.attributeValues, [attribute.key]: event.target.value })} /></Field>)}</div>;
}

function MediaFields({ form, edit, update, apiPrefix, setUploadBusy, mediaDisabled, draft }) {
  return <div className="draft-form-section">
    <div className="draft-media-heading"><SectionTitle title="Product photos" note="Add multiple views of this product, then choose a cover and arrange the gallery." /><span className="draft-media-total" aria-live="polite">{form.images.length} / {MAX_DRAFT_PHOTOS} photos</span></div>
    <div className="draft-photo-guide"><ImagePlus size={22} /><div><strong>Build a complete product gallery</strong><p>Include a front view, back view and close-up of fabric or details. Mark your best photo as Main for the storefront cover.</p><span>Photos are saved automatically to this draft. Use Save draft to save immediately.</span></div></div>
    <ImageUploader value={form.images} onChange={(value) => edit((current) => ({ ...current, images: value, image: value.find((item) => item.primary)?.url || value[0]?.url || '' }))} multiple maxFiles={MAX_DRAFT_PHOTOS} uploadPath={`${apiPrefix}/uploads`} uploadContext="products" label="Add photos to this draft" helpText="Select multiple photos or drag and drop. JPG, PNG or WEBP; up to 8 new photos per upload, 20MB each before compression." disabled={mediaDisabled} onBusyChange={setUploadBusy} />
    <SectionTitle title="Product video" note="Optional short videos help customers understand fabric and fit." />
    <VideoUploader value={form.videos || []} onChange={(value) => update('videos', value)} maxFiles={3} uploadPath={`${apiPrefix}/uploads/videos`} disabled={mediaDisabled} onBusyChange={setUploadBusy} />
    {draft.sourceUrl && <a href={draft.sourceUrl} target="_blank" rel="noreferrer" className="draft-source-link">Open original {draft.sourcePlatform || 'social'} post</a>}
  </div>;
}

function InventoryFields({ form, update, structure, sizingMode, sizingProduct, sizes, columns, rows, syncVariants, updateVariant, updateMeasurement }) {
  return <div className="draft-form-section"><SectionTitle title="Inventory controls" /><div className="draft-form-grid four"><NumberField label="Total stock" required step="1" value={form.stock ?? ''} onChange={(value) => update('stock', value)} /><NumberField label="Low stock alert" step="1" value={form.lowStockAlert ?? ''} onChange={(value) => update('lowStockAlert', value)} /><NumberField label="Reorder quantity" step="1" value={form.reorderQuantity ?? ''} onChange={(value) => update('reorderQuantity', value)} /><Field label="Restock date"><TextInput type="datetime-local" value={toLocalDate(form.restockAt)} onChange={(event) => update('restockAt', event.target.value)} /></Field></div>{usesGarmentSizing(structure, form) && <><SectionTitle title="Sizing" note="Free-size products such as sarees do not require a size chart." /><div className="draft-form-grid"><Field label="Sizing mode"><Select value={form.sizingMode || 'auto'} onChange={(event) => update('sizingMode', event.target.value)}><option value="auto">Automatic from product type</option><option value="sized">Customer selects a size</option><option value="free-size">No size selection / free size</option></Select></Field>{sizingMode === 'sized' && <Field label="Available sizes" required><TextInput value={form.sizes || ''} onChange={(event) => update('sizes', event.target.value)} placeholder="S, M, L, XL" /></Field>}</div></>}{sizingMode === 'sized' && <div className="draft-size-chart"><div className="draft-form-grid"><Field label="Size chart profile"><Select value={form.sizeChartProfile || 'auto'} onChange={(event) => update('sizeChartProfile', event.target.value)}><option value="auto">Automatic ({SIZE_CHART_PROFILES[inferSizeChartProfile(sizingProduct)]?.label || 'apparel'})</option>{Object.entries(SIZE_CHART_PROFILES).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</Select></Field><Field label="Measurement unit"><Select value={form.sizeChart?.unit || 'in'} onChange={(event) => update('sizeChart', { ...(form.sizeChart || {}), unit: event.target.value })}><option value="in">Inches</option><option value="cm">Centimetres</option></Select></Field></div>{sizes.length ? <div className="draft-table-wrap"><table><thead><tr><th>Size</th>{columns.map((item) => <th key={item.key}>{item.shortLabel}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.size}><th>{row.size}</th>{columns.map((item) => <td key={item.key}><input type="number" min="0.1" step="0.1" value={row[item.key] ?? ''} onChange={(event) => updateMeasurement(row.size, item.key, event.target.value)} aria-label={`${row.size} ${item.label}`} /></td>)}</tr>)}</tbody></table></div> : <p className="draft-inline-note">Add size labels to generate the chart.</p>}<Field label="Fit notes"><TextArea value={form.sizeFitNotes || ''} onChange={(event) => update('sizeFitNotes', event.target.value)} /></Field></div>}<SectionTitle title="Options and variant stock" note="Create combinations after entering sizes and colours, then set stock or price for each option." /><Field label="Colours"><TextInput value={form.colors || ''} onChange={(event) => update('colors', event.target.value)} placeholder="Wine, Ivory, Black" /></Field><button type="button" className="admin-btn-ghost" onClick={syncVariants}>Build / refresh variant combinations</button>{form.variants?.length > 0 && <VariantTable variants={form.variants} updateVariant={updateVariant} />}</div>;
}

function VariantTable({ variants, updateVariant }) {
  return <div className="draft-table-wrap"><table><thead><tr><th>Option</th><th>SKU</th><th>Stock</th><th>Price</th><th>MRP</th><th>Active</th></tr></thead><tbody>{variants.map((variant, index) => <tr key={`${variant.size}-${variant.color}-${index}`}><th>{[variant.size, variant.color].filter(Boolean).join(' / ')}</th><td><input value={variant.sku || ''} onChange={(event) => updateVariant(index, 'sku', event.target.value)} /></td><td><input type="number" min="0" step="1" value={variant.stock ?? 0} onChange={(event) => updateVariant(index, 'stock', event.target.value)} /></td><td><input type="number" min="0" value={variant.price || ''} onChange={(event) => updateVariant(index, 'price', event.target.value)} /></td><td><input type="number" min="0" value={variant.originalPrice || ''} onChange={(event) => updateVariant(index, 'originalPrice', event.target.value)} /></td><td><input type="checkbox" checked={variant.isActive !== false} onChange={(event) => updateVariant(index, 'isActive', event.target.checked)} /></td></tr>)}</tbody></table></div>;
}

function ShippingFields({ form, update }) {
  return <div className="draft-form-section"><SectionTitle title="Package and delivery" note="These values support courier availability and accurate shipping charges." /><div className="draft-form-grid four"><NumberField label="Packed weight (kg)" value={form.shippingWeightKg ?? ''} step="0.01" onChange={(value) => update('shippingWeightKg', value)} /><NumberField label="Length (cm)" value={form.packageDimensions?.lengthCm ?? ''} onChange={(value) => update('packageDimensions', { ...form.packageDimensions, lengthCm: value })} /><NumberField label="Width (cm)" value={form.packageDimensions?.widthCm ?? ''} onChange={(value) => update('packageDimensions', { ...form.packageDimensions, widthCm: value })} /><NumberField label="Height (cm)" value={form.packageDimensions?.heightCm ?? ''} onChange={(value) => update('packageDimensions', { ...form.packageDimensions, heightCm: value })} /></div><SectionTitle title="Sourcing and compliance" /><div className="draft-form-grid"><Field label="Country of origin"><TextInput value={form.countryOfOrigin || ''} onChange={(event) => update('countryOfOrigin', event.target.value)} /></Field><Field label="Supplier name"><TextInput value={form.supplierName || ''} onChange={(event) => update('supplierName', event.target.value)} /></Field><Field label="Manufacturer / importer details"><TextArea value={form.manufacturerDetails || ''} onChange={(event) => update('manufacturerDetails', event.target.value)} /></Field><Field label="Warranty"><TextArea value={form.warranty || ''} onChange={(event) => update('warranty', event.target.value)} /></Field></div></div>;
}

function ContentFields({ form, update }) {
  return <div className="draft-form-section"><SectionTitle title="Customer content" /><Field label="Short description"><TextArea value={form.shortDescription || ''} maxLength={500} onChange={(event) => update('shortDescription', event.target.value)} /></Field><Field label="Full description"><TextArea rows={7} value={form.description || ''} maxLength={6000} onChange={(event) => update('description', event.target.value)} /></Field><div className="draft-form-grid"><Field label="Highlights"><TextArea value={form.highlights || ''} onChange={(event) => update('highlights', event.target.value)} placeholder="Separate highlights with commas" /></Field><Field label="Tags"><TextArea value={form.tags || ''} onChange={(event) => update('tags', event.target.value)} placeholder="Separate tags with commas" /></Field><Field label="Fabric / material"><TextInput value={form.fabric || ''} onChange={(event) => update('fabric', event.target.value)} /></Field><Field label="Occasion"><TextInput value={form.occasion || ''} onChange={(event) => update('occasion', event.target.value)} /></Field><Field label="Care instructions"><TextArea value={form.careInstructions || ''} onChange={(event) => update('careInstructions', event.target.value)} /></Field><Field label="Return policy"><TextArea value={form.returnPolicy || ''} onChange={(event) => update('returnPolicy', event.target.value)} /></Field></div><SectionTitle title="Search preview" /><Field label="Meta title"><TextInput value={form.metaTitle || ''} maxLength={100} onChange={(event) => update('metaTitle', event.target.value)} /></Field><Field label="Meta description"><TextArea value={form.metaDescription || ''} maxLength={300} onChange={(event) => update('metaDescription', event.target.value)} /></Field><Field label="Search keywords"><TextInput value={form.metaKeywords || ''} onChange={(event) => update('metaKeywords', event.target.value)} /></Field></div>;
}

function VisibilityFields({ form, update }) {
  return <div className="draft-form-section"><SectionTitle title="Storefront placement" note="Choose where the product should appear after publication." /><div className="draft-check-grid">{[['isFeatured', 'Featured product'], ['isNewArrival', 'New arrival'], ['isBestSeller', 'Best seller'], ['showOnHomepage', 'Show on homepage'], ['showInTrending', 'Show in trending'], ['showInFestive', 'Show in festive collection']].map(([key, label]) => <label key={key}><input type="checkbox" checked={Boolean(form[key])} onChange={(event) => update(key, event.target.checked)} /><span>{label}</span></label>)}</div><SectionTitle title="Publishing schedule" /><div className="draft-form-grid"><Field label="Publish date"><TextInput type="datetime-local" value={toLocalDate(form.publishAt)} onChange={(event) => update('publishAt', event.target.value)} /></Field><NumberField label="Scheduled sale price" value={form.salePrice ?? ''} onChange={(value) => update('salePrice', value)} /><Field label="Sale starts"><TextInput type="datetime-local" value={toLocalDate(form.saleStartAt)} onChange={(event) => update('saleStartAt', event.target.value)} /></Field><Field label="Sale ends"><TextInput type="datetime-local" value={toLocalDate(form.saleEndAt)} onChange={(event) => update('saleEndAt', event.target.value)} /></Field></div></div>;
}

function ConfirmDelete({ draft, value, onChange, busy, onCancel, onDelete }) {
  const expected = String(draft.name || draftId(draft)).trim();
  const dialogRef = useRef(null);
  const latest = useRef({ busy, onCancel });
  latest.current = { busy, onCancel };
  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const keydown = event => {
      if (event.key === 'Escape' && !latest.current.busy) { event.preventDefault(); latest.current.onCancel(); }
      if (event.key !== 'Tab') return;
      const nodes = [...dialogRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled)')];
      if (!nodes.length) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes[nodes.length - 1].focus(); }
      else if (!event.shiftKey && document.activeElement === nodes[nodes.length - 1]) { event.preventDefault(); nodes[0].focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', keydown); previousFocus?.focus?.(); };
  }, []);
  return <div ref={dialogRef} className="draft-confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="delete-draft-title"><div className="draft-confirm"><span className="draft-confirm__icon"><Trash2 /></span><h2 id="delete-draft-title">{draft.publishedProductId ? 'Remove published draft?' : 'Delete archived draft permanently?'}</h2><p>{draft.publishedProductId ? 'Only the draft record is removed. Its published product, images and inventory remain unchanged. A minimal publication receipt prevents duplicate imports.' : 'This cannot be undone. This removes the archived draft, not a live product.'}</p><label>Type <strong>{expected}</strong> to confirm<TextInput autoFocus value={value} disabled={busy} onChange={(event) => onChange(event.target.value)} /></label><div><button type="button" className="admin-btn-ghost" disabled={busy} onClick={onCancel}>Cancel</button><button type="button" className="draft-danger-button" disabled={busy || value.trim() !== expected} onClick={onDelete}>{busy ? 'Deleting...' : 'Delete permanently'}</button></div></div></div>;
}

function Field({ label, required, children }) { return <label className="draft-field"><span>{label}{required && <b>Required</b>}</span>{children}</label>; }
function NumberField({ label, required, value, onChange, step = '0.01', max }) { return <Field label={label} required={required}><TextInput type="number" min="0" step={step} max={max} value={value} onChange={(event) => onChange(event.target.value)} /></Field>; }
function SectionTitle({ title, note }) { return <div className="draft-section-title"><h3>{title}</h3>{note && <p>{note}</p>}</div>; }

function draftToForm(draft) {
  const images = getDraftImages(draft);
  return {
    ...draft, commerceMode: draft.commerceMode || 'SALE_ONLY', category: draft.category?._id || draft.category || '',
    sizes: list(draft.sizes).join(', '), colors: list(draft.colors).join(', '),
    tags: list(draft.tags).join(', '), highlights: list(draft.highlights).join(', '),
    images, image: images.find((item) => item.primary)?.url || '', videos: Array.isArray(draft.videos) ? draft.videos : [],
    variants: Array.isArray(draft.variants) ? draft.variants : [],
    sizeChart: draft.sizeChart || { unit: 'in', columns: [], rows: [] },
    packageDimensions: draft.packageDimensions || { lengthCm: '', widthCm: '', heightCm: '' },
  };
}

export function normalizeDraftBody(form, categories = [], structure) {
  const category = form.category?._id || form.category || '';
  const categoryLabel = categories.find((item) => String(item._id) === String(category))?.name || categoryName(form.category);
  const sizingProduct = { ...form, category: categoryLabel, ...(!usesGarmentSizing(structure, form) ? { sizingMode: 'free-size', sizeChartProfile: 'free-size' } : {}) };
  const mode = resolveSizingMode(sizingProduct);
  const sellingPrice = numeric(form.sellingPrice ?? form.price, 0);
  const images = getDraftImages(form);
  const payload = {
    ...form, baseRevision: Number(form.revision || 0), category: category || undefined,
    images, image: images.find((item) => item.primary)?.url || '', videos: Array.isArray(form.videos) ? form.videos : [],
    price: sellingPrice, sellingPrice, originalPrice: form.commerceMode === 'RENTAL_ONLY' ? sellingPrice : numeric(form.originalPrice, sellingPrice),
    commerceMode: form.commerceMode || 'SALE_ONLY', rentalPricing: form.commerceMode && form.commerceMode !== 'SALE_ONLY' ? form.rentalPricing : null,
    costPrice: numeric(form.costPrice, 0), gstRate: numeric(form.gstRate, 0),
    stock: integer(form.stock), lowStockAlert: integer(form.lowStockAlert), reorderQuantity: integer(form.reorderQuantity),
    shippingWeightKg: numeric(form.shippingWeightKg, 0),
    packageDimensions: { lengthCm: numeric(form.packageDimensions?.lengthCm, 0), widthCm: numeric(form.packageDimensions?.widthCm, 0), heightCm: numeric(form.packageDimensions?.heightCm, 0) },
    sizes: mode === 'sized' ? getSelectableSizes(sizingProduct) : [], colors: list(form.colors), tags: list(form.tags), highlights: list(form.highlights),
    sizingMode: sizingProduct.sizingMode || 'auto', sizeChartProfile: sizingProduct.sizeChartProfile || 'auto',
    sizeChart: buildSizeChartPayload(sizingProduct), sizeFitNotes: form.sizeFitNotes || '',
    variants: mode === 'sized' ? normalizeVariants(form.variants) : [],
    salePrice: form.commerceMode === 'RENTAL_ONLY' ? 0 : numeric(form.salePrice, 0), restockAt: form.restockAt || null, publishAt: form.publishAt || null,
    saleStartAt: form.commerceMode === 'RENTAL_ONLY' ? null : form.saleStartAt || null, saleEndAt: form.commerceMode === 'RENTAL_ONLY' ? null : form.saleEndAt || null,
  };
  ['_id', 'id', '__v', 'readiness', 'status', 'archivedAt', 'publishedProductId', 'createdAt', 'updatedAt', 'createdBy', 'lastSavedBy', 'lastPublishAttemptAt', 'lastPublishError', 'sourceType', 'sourceSocialImportId', 'sourceJobId', 'sourceCandidateId', 'sourceUrl', 'sourcePlatform', 'importContext', 'storeId'].forEach((key) => delete payload[key]);
  return payload;
}

function getDraftImages(draft = {}) {
  const images = (Array.isArray(draft.images) ? draft.images : [])
    .map((item) => typeof item === 'string' ? { url: item } : item)
    .filter((item) => item?.url);
  if (!images.length && draft.image) images.push({ url: draft.image });
  const primaryIndex = Math.max(0, images.findIndex((item) => item.primary));
  return images.map((item, index) => ({ ...item, primary: index === primaryIndex }));
}

function normalizeVariants(variants) { return (Array.isArray(variants) ? variants : []).map((item) => ({ ...item, stock: integer(item.stock), price: item.price === '' ? undefined : numeric(item.price, 0), originalPrice: item.originalPrice === '' ? undefined : numeric(item.originalPrice, 0), isActive: item.isActive !== false })); }
function list(value) { return Array.from(new Set((Array.isArray(value) ? value : String(value || '').split(',')).map((item) => String(item || '').trim()).filter(Boolean))); }
function numeric(value, fallback = 0) { if (value === '' || value === null || value === undefined) return fallback; const number = Number(value); return Number.isFinite(number) ? number : fallback; }
function integer(value) { const number = Number(value); return Number.isFinite(number) ? number : 0; }
function draftId(draft) { return String(draft?._id || draft?.id || ''); }
function categoryName(value) { return typeof value === 'object' ? value?.name || '' : ''; }
function sourceLabel(value) { return value === 'reel-import' ? 'Reel import' : value === 'social-import' ? 'Social import' : 'Manual draft'; }
function toLocalDate(value) { if (!value) return ''; const date = new Date(value); if (Number.isNaN(date.getTime())) return ''; const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000); return local.toISOString().slice(0, 16); }
function formatRelative(value) { const time = new Date(value).getTime(); if (!time) return 'recently'; const minutes = Math.max(0, Math.round((Date.now() - time) / 60000)); if (minutes < 1) return 'just now'; if (minutes < 60) return `${minutes}m ago`; if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`; return new Date(time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); }
function localReadiness(draft = {}) { const issues = []; const warnings = []; const price = Number(draft.sellingPrice ?? draft.price); const mrp = draft.commerceMode === 'RENTAL_ONLY' ? price : Number(draft.originalPrice ?? price); if (draft.commerceMode && draft.commerceMode !== 'SALE_ONLY' && rentalPricingError(draft.rentalPricing)) issues.push(rentalPricingError(draft.rentalPricing)); if (String(draft.name || '').trim().length < 3) issues.push('Add a product name'); if (!draft.category) issues.push('Choose a category'); if (!(draft.images?.length || draft.image)) issues.push('Add at least one product photo'); if (!(price > 0)) issues.push('Add a valid selling price'); if (!Number.isFinite(mrp) || mrp < price) issues.push('MRP must be equal to or above the selling price'); if (!Number.isSafeInteger(Number(draft.stock)) || Number(draft.stock) < 0) issues.push('Add a whole-number stock quantity'); if (String(draft.description || '').trim().length < 20) warnings.push('Add a useful description'); if (!draft.sku) warnings.push('Add a SKU'); if (!(Number(draft.shippingWeightKg) > 0)) warnings.push('Add packed weight'); const score = Math.max(0, Math.min(100, Math.round(((6 - Math.min(6, issues.length)) / 6) * 80 + ((3 - Math.min(3, warnings.length)) / 3) * 20))); return { state: issues.length ? 'incomplete' : warnings.length ? 'review' : 'ready', score, issues, warnings }; }
function summarizeLocal(drafts) { return drafts.reduce((summary, draft) => { summary[draft.status] = (summary[draft.status] || 0) + 1; const state = draft.readiness?.state || localReadiness(draft).state; if (draft.status === 'draft') summary[state] = (summary[state] || 0) + 1; return summary; }, { draft: 0, published: 0, archived: 0, ready: 0, review: 0, incomplete: 0 }); }
