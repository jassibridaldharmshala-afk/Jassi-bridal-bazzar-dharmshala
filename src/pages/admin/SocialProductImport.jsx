import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ExternalLink, Image, Link2, PackagePlus, RefreshCw, Sparkles, X } from 'lucide-react';
import { IconBrandFacebook as Facebook, IconBrandInstagram as Instagram } from '@tabler/icons-react';
import api from '../../services/api';
import PageHeader from '../../components/admin/PageHeader';
import ImportSizeFields from '../../components/admin/ImportSizeFields';
import { fetchCategories, productAttributeDefinitions } from '../../utils/catalogOptions';
import { normalizeImageUrl } from '../../services/normalize';
import { SOCIAL_IMPORT_RUNNING, SOCIAL_IMPORT_STATUS, socialReviewForm, socialReviewError, socialPublishMissing, socialUrlError } from '../../utils/socialImport';
import './SocialProductImport.css';

const endpoint = '/admin/social-imports';
const date = (value) => new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
function PlatformIcon({ platform, ...props }) { return platform === 'facebook' ? <Facebook {...props} /> : <Instagram {...props} />; }

export default function SocialProductImport({ route = '/admin/social-import', navigate }) {
  const routeId = new URLSearchParams(route.split('?')[1] || '').get('id') || '';
  const [selectedId, setSelectedId] = useState(routeId);
  const selection = useRef(selectedId); selection.current = selectedId;
  const [url, setUrl] = useState(''); const [error, setError] = useState('');
  const [job, setJob] = useState(null); const [jobError, setJobError] = useState('');
  const [busy, setBusy] = useState(false); const [actionBusy, setActionBusy] = useState(false);
  const [capabilities, setCapabilities] = useState(null); const [categories, setCategories] = useState([]);
  const [structure, setStructure] = useState(null); const [structureError, setStructureError] = useState('');
  const [history, setHistory] = useState(null); const [historyError, setHistoryError] = useState('');
  const [page, setPage] = useState(1); const [historyRevision, setHistoryRevision] = useState(0);
  const [pollRevision, setPollRevision] = useState(0); const [notice, setNotice] = useState('');
  const submitting = useRef(false); const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { setSelectedId(routeId); }, [routeId]);
  useEffect(() => {
    let alive = true;
    api.get(endpoint + '/capabilities').then((value) => { if (alive) setCapabilities(value); }).catch(() => { if (alive) setCapabilities(null); });
    fetchCategories(api).then((items) => { if (alive) setCategories(items); }).catch(() => {});
    api.get('/catalog-configuration').then((value) => { if (alive) setStructure(value); }).catch((failure) => { if (alive) setStructureError(failure.message); });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    let alive = true; setHistoryError('');
    api.get(endpoint + '?page=' + page, { silent: true }).then((value) => {
      if (!Array.isArray(value?.items)) throw new Error('Import history could not be loaded.');
      if (alive) setHistory(value);
    }).catch((failure) => { if (alive) setHistoryError(failure.message); });
    return () => { alive = false; };
  }, [page, historyRevision]);
  useEffect(() => {
    if (!selectedId) { setJob(null); return undefined; }
    let alive = true; let timer;
    setJobError(''); setJob((value) => value?._id === selectedId ? value : null);
    const poll = async () => {
      try {
        const response = await api.get(endpoint + '/' + encodeURIComponent(selectedId), { silent: true });
        if (!alive) return;
        if (response?.data?._id !== selectedId) throw new Error('Import details could not be loaded.');
        setJob(response.data); setJobError('');
        if (SOCIAL_IMPORT_RUNNING.includes(response.data.status)) timer = window.setTimeout(poll, 2500);
        else setHistoryRevision((value) => value + 1);
      } catch (failure) { if (alive) setJobError(failure.message); }
    };
    poll();
    return () => { alive = false; window.clearTimeout(timer); };
  }, [selectedId, pollRevision]);
  const open = (value, summary = false) => {
    // History only contains one thumbnail; fetch the full gallery before mounting its review.
    setJob((current) => summary ? current?._id === value._id ? current : null : value);
    setJobError(''); setSelectedId(value._id);
    navigate?.('/admin/social-import?id=' + encodeURIComponent(value._id));
  };
  const importPost = async (event) => {
    event.preventDefault(); if (submitting.current) return;
    const validation = socialUrlError(url); setError(validation); if (validation) return;
    submitting.current = true; setBusy(true); setNotice('');
    try {
      const result = await api.post(endpoint, { url: url.trim() });
      if (!mounted.current) return;
      if (!result.data?._id) throw new Error('The server did not create an import. Please retry.');
      open(result.data); setPollRevision((value) => value + 1); setHistoryRevision((value) => value + 1);
      if (result.duplicate) setNotice('This link is already in your imports. Your existing import is shown below.');
    } catch (failure) { if (mounted.current) setError(failure.message); }
    finally { submitting.current = false; if (mounted.current) setBusy(false); }
  };
  const changeStatus = async (action) => {
    if (actionBusy || !job) return;
    const actionId = job._id;
    setActionBusy(true); setJobError('');
    try {
      const response = await api.post(`${endpoint}/${job._id}/${action}`, {});
      if (mounted.current && selection.current === actionId) { setJob(response.data); setPollRevision((value) => value + 1); setHistoryRevision((value) => value + 1); }
    } catch (failure) { if (mounted.current && selection.current === actionId) setJobError(failure.message); }
    finally { if (mounted.current) setActionBusy(false); }
  };
  const draftCreated = useCallback((response) => {
    setJob((value) => response.data || ({ ...value, draftId: response.draftId, publishedProductId: response.productId })); setHistoryRevision((value) => value + 1);
  }, []);
  return <section className="social-import">
    <PageHeader title="Import from social link" note="Paste a link. Review the filled details. Publish your product here.">
      <a href="/admin/product-drafts" className="admin-btn-ghost">Product drafts <ArrowRight size={16} /></a>
    </PageHeader>
    <div className="admin-card social-import__start">
      <div className="social-import__intro"><span className="social-import__brand"><Instagram size={24} /><Facebook size={24} /></span><div><h2>From reel to product, with less typing.</h2><p>We select clear photos and fill details from the post. With AI connected, we also read video text and listen for product details and prices. Confirm what is missing, then publish.</p></div></div>
      <form onSubmit={importPost} className="social-import__url-form">
        <label htmlFor="social-product-url">Instagram or Facebook post link</label>
        <div><span className="social-import__url"><Link2 size={20} aria-hidden="true" /><input id="social-product-url" type="url" inputMode="url" autoComplete="off" maxLength={2048} required value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://www.instagram.com/p/…" aria-describedby="social-url-help" /></span>
          <button type="submit" className="admin-btn" disabled={busy || capabilities?.enabled === false}><PackagePlus size={18} />{busy ? 'Starting import…' : 'Import product'}</button></div>
        <p id="social-url-help">Up to 20 photos · Reels up to 5 minutes / 80 MB · Nothing is published automatically</p>
      </form>
      {capabilities?.photoAnalysis === false && <p>Caption autofill and photo selection are ready. Connect Smart Reel Assistant to read spoken details and text inside videos.</p>}
      {capabilities?.enabled === false && <p className="social-import__alert" role="alert">{capabilities.message}</p>}
      {error && <p className="social-import__alert" role="alert">{error}</p>}
      {notice && <p className="social-import__note" role="status">{notice}</p>}
    </div>
    <div className="social-import__workspace"><div className="social-import__main">
      {jobError && <div className="social-import__alert" role="alert">{jobError}<button className="admin-btn-ghost" onClick={() => setPollRevision((value) => value + 1)}>Reload import</button></div>}
      {selectedId && !job && !jobError && <div className="admin-card social-import__state" role="status">Loading import details…</div>}
      {job && <>
        <div className="admin-card social-import__progress">
          <div><PlatformIcon platform={job.platform} size={20} /><strong>{job.stage || SOCIAL_IMPORT_STATUS[job.status]}</strong><span className={'social-import__status is-' + job.status}>{job.publishedProductId ? 'Published' : job.draftId ? 'Saved for later' : SOCIAL_IMPORT_STATUS[job.status]}</span></div>
          <a href={job.resolvedUrl || job.sourceUrl} target="_blank" rel="noreferrer">View original post <ExternalLink size={13} /></a>
          {job.status === 'ready' && !job.draftId && job.videos?.length > 0 && job.attempts < 5 && <div><button type="button" className="admin-btn-ghost" disabled={actionBusy} onClick={() => { if (window.confirm('Recheck this video? This starts a fresh review and replaces unsaved photo selections and product edits.')) changeStatus('retry'); }}><RefreshCw size={16} />Recheck video photos</button><p className="admin-note">Run the latest photo selection again before saving a draft.</p></div>}
          {SOCIAL_IMPORT_RUNNING.includes(job.status) && <><progress value={job.progress || 0} max={100} aria-label="Import progress" /><p role="status">You can leave this page and return from import history. Processing continues on the server.</p><button type="button" className="admin-btn-ghost" onClick={() => changeStatus('cancel')} disabled={actionBusy}>Cancel import</button></>}
          {['failed', 'cancelled'].includes(job.status) && <><p role={job.status === 'failed' ? 'alert' : undefined}>{job.error || 'This import was cancelled.'}</p><div className="social-import__actions">{job.attempts < 5 && <button className="admin-btn" onClick={() => changeStatus('retry')} disabled={actionBusy}><RefreshCw size={16} />{actionBusy ? 'Please wait…' : 'Retry import'}</button>}<a href="/admin/products/quick-add" className="admin-btn-ghost">Upload photos</a><a href="/admin/reel-import" className="admin-btn-ghost">Upload a reel</a></div></>}
        </div>
        {job.status === 'ready' && <ReviewImport key={job._id} job={job} categories={categories} structure={structure} structureError={structureError} onCreated={draftCreated} />}
      </>}
      {!selectedId && <div className="admin-card social-import__welcome"><Image size={34} strokeWidth={1.3} /><h2>Less typing. More time for your store.</h2><div className="social-import__steps"><p><span>1</span>Paste a post link</p><p><span>2</span>Confirm missing details</p><p><span>3</span>Publish your product</p></div><p>Stated prices are filled automatically. Your actual stock stays yours to enter. Every detail remains editable.</p></div>}
    </div>
    <aside className="admin-card social-import__history" aria-label="Import history"><header><h2>Your imports</h2><button className="admin-btn-ghost" aria-label="Refresh import history" onClick={() => setHistoryRevision((value) => value + 1)}><RefreshCw size={16} /></button></header>
      {historyError ? <p role="alert">{historyError}</p> : !history ? <p role="status">Loading history…</p> : !history.items.length ? <p>Your imported links will appear here.</p> : history.items.map((item) => <button type="button" key={item._id} className={'social-import__history-item' + (selectedId === item._id ? ' is-selected' : '')} onClick={() => open(item, true)} aria-label={'Open ' + item.platform + ' import from ' + date(item.createdAt)}>
        {item.images?.[0]?.url ? <img src={normalizeImageUrl(item.images[0].url)} alt="" loading="lazy" /> : <span className="social-import__history-icon"><PlatformIcon platform={item.platform} size={23} /></span>}
        <span><strong>{item.platform === 'instagram' ? 'Instagram' : 'Facebook'}</strong><small>{date(item.createdAt)}</small><em className={'social-import__status is-' + item.status}>{item.draftId ? 'Draft saved' : SOCIAL_IMPORT_STATUS[item.status]}</em></span>
      </button>)}
      {history?.totalPages > 1 && <nav aria-label="Import history pages"><button className="admin-btn-ghost" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} aria-label="Previous imports"><ArrowLeft size={16} /></button><span>{page} / {history.totalPages}</span><button className="admin-btn-ghost" disabled={page >= history.totalPages} onClick={() => setPage((value) => value + 1)} aria-label="Next imports"><ArrowRight size={16} /></button></nav>}
    </aside></div>
  </section>;
}

function ReviewImport({ job, categories, structure, structureError, onCreated }) {
  const [form, setForm] = useState(() => socialReviewForm(job)); const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  const [viewer, setViewer] = useState(null); const savingRef = useRef(false); const mounted = useRef(true);
  const [saved, setSaved] = useState(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const toggle = (id) => setForm((current) => {
    const imageIds = current.imageIds.includes(id) ? current.imageIds.filter((value) => value !== id) : [...current.imageIds, id];
    return { ...current, imageIds, primaryImageId: imageIds.includes(current.primaryImageId) ? current.primaryImageId : imageIds[0] || '' };
  });
  const useRecommended = () => setForm((current) => {
    const selected = job.images.filter((image) => image.recommended !== false);
    return { ...current, imageIds: selected.map((image) => image.id), primaryImageId: (selected.find((image) => image.recommendedCover) || selected[0])?.id || '' };
  });
  const missing = socialPublishMissing(form, categories, structure);
  const save = async (event, publish = true) => {
    event.preventDefault(); if (savingRef.current) return;
    const validation = socialReviewError(form); setError(validation); if (validation) return;
    if (publish && !structure) { setError(structureError || 'Product configuration is still loading. Please retry shortly.'); return; }
    if (publish && missing.length) { setError('Complete before publishing: ' + missing.join(', ') + '.'); return; }
    savingRef.current = true; setSaving(true);
    try {
      const response = await api.post(`${endpoint}/${job._id}/${publish ? 'publish' : 'review'}`, form);
      if (!response.success || !response.draftId) throw new Error('The draft was not confirmed by the server. Please retry.');
      if (publish && !response.productId) throw new Error('Publication was not confirmed. Your review is preserved; retry when the connection is available.');
      if (mounted.current) { setForm((current) => ({ ...current, draftUpdatedAt: response.data?.savedReview?.draftUpdatedAt || current.draftUpdatedAt })); setSaved(!publish); onCreated(response); }
    } catch (failure) { if (mounted.current) setError(failure.message); }
    finally { savingRef.current = false; if (mounted.current) setSaving(false); }
  };
  if (job.publishedProductId) return <div className="admin-card social-import__saved" role="status"><Check size={32} /><h2>{job.publishedProductDeleted ? 'Published product removed' : 'Your product is published'}</h2><p>{job.publishedProductDeleted ? 'The owner permanently deleted this product. Its import history is retained and cannot create a duplicate listing.' : 'Photos, details and your selected price are saved. You can edit the product at any time.'}</p>{!job.publishedProductDeleted && <a href={'/admin/products/edit?id=' + encodeURIComponent(job.publishedProductId)} className="admin-btn">Edit product <ArrowRight size={17} /></a>}</div>;
  const field = (key, label, type = 'text', help) => <label className="admin-field"><span id={'social-label-' + key}>{label}</span><input className="admin-field__control" aria-labelledby={'social-label-' + key} aria-describedby={help ? 'social-help-' + key : undefined} type={type} min={type === 'number' ? 0 : undefined} step={type === 'number' ? key === 'stock' ? 1 : '0.01' : undefined} value={form[key]} maxLength={type === 'text' ? 240 : undefined} onChange={(event) => update(key, event.target.value)} />{help && <small id={'social-help-' + key}>{help}</small>}</label>;
  return <form className="social-import__review" onSubmit={save}>
    <div className="admin-card social-import__gallery"><header><div><h2>Choose your product photos</h2><p>{form.imageIds.length} of {job.images.length} selected · Set the cover photo</p></div><button className="admin-btn-ghost" type="button" onClick={() => setForm((value) => ({ ...value, imageIds: job.images.map((image) => image.id), primaryImageId: value.primaryImageId || job.images[0]?.id }))}>Select all</button></header>
      {job.frameSelections?.length > 0 && <div className="social-import__quality-summary"><strong>Clearer views, ready for review</strong><p>Checked {job.frameSelections.reduce((sum, item) => sum + item.analyzedFrames, 0)} video moments. Removed {job.frameSelections.reduce((sum, item) => sum + item.rejectedFrames, 0)} unclear and {job.frameSelections.reduce((sum, item) => sum + item.duplicateFrames, 0)} repeated frames.</p><p>Inspect the full-size photos, confirm each view and choose your cover. Alternatives remain available below.</p><button type="button" className="admin-btn-ghost" onClick={useRecommended}>Use recommended photos</button></div>}
      <div className="social-import__photos">{job.images.map((image, index) => <div key={image.id} className={'social-import__photo' + (form.imageIds.includes(image.id) ? ' is-selected' : '')}>
        <button type="button" className="social-import__photo-view" onClick={() => setViewer(index)} aria-label={'Preview photo ' + (index + 1)}><img src={normalizeImageUrl(image.url)} alt={'Imported product photo ' + (index + 1)} loading="lazy" />{image.kind === 'frame' && <span>Reel still · {Number(image.timestamp || 0).toFixed(1)}s</span>}</button>
        <label><input type="checkbox" checked={form.imageIds.includes(image.id)} onChange={() => toggle(image.id)} aria-label={'Select photo ' + (index + 1)} />Photo {index + 1}</label>
        {image.selectionVersion && <div className="social-import__photo-quality"><strong>{image.recommendedCover ? 'Suggested cover' : image.recommended ? 'Recommended' : 'Alternative view'}</strong><span>Clarity {Math.round((image.qualityScore || 0) * 100)} / 100</span>{image.qualityWarnings?.map((warning) => <small key={warning}>{warning}</small>)}<select aria-label={'View for photo ' + (index + 1)} value={form.viewTypes[image.id] || 'unknown'} onChange={(event) => update('viewTypes', { ...form.viewTypes, [image.id]: event.target.value })}><option value="unknown">Confirm view</option><option value="front">Front</option><option value="back">Back</option><option value="side">Side</option><option value="detail">Detail</option></select></div>}
        <button type="button" aria-pressed={form.primaryImageId === image.id} className="social-import__cover" onClick={() => setForm((value) => ({ ...value, imageIds: value.imageIds.includes(image.id) ? value.imageIds : [...value.imageIds, image.id], primaryImageId: image.id }))}>{form.primaryImageId === image.id ? '✓ Cover photo' : 'Set as cover'}</button>
      </div>)}</div>
      {job.videos?.length > 0 && <div className="social-import__video"><video controls preload="metadata" poster={normalizeImageUrl(job.videos[0].thumbnail)} src={normalizeImageUrl(job.videos[0].url)} /><label><input type="checkbox" checked={form.includeVideo} onChange={(event) => update('includeVideo', event.target.checked)} />Include original reel in the product draft</label></div>}
    </div>
    <div className="admin-card social-import__fields"><header><h2>Confirm & publish</h2>{job.suggestion?.aiSuggested && <span className="social-import__ai"><Sparkles size={14} />AI filled</span>}</header>
      {job.suggestion?.contextStatus === 'failed' && <p className="social-import__alert" role="alert">{job.suggestion.contextError || 'AI analysis was unavailable for this import.'} Available caption details are preserved below.</p>}
      <div className="social-import__autofill"><strong>{missing.length ? `${missing.length} essential ${missing.length === 1 ? 'detail needs' : 'details need'} your input` : 'Ready for your final review'}</strong><p>{missing.length ? missing.join(' · ') : 'Confirm the photos and details below, then publish.'}</p><p>Details found in the source are already filled. You can change any of them.</p></div>
      {saved && <p role="status" className="social-import__note">Your product draft is saved. Continue here whenever you are ready.</p>}
      <fieldset disabled={saving}>{field('name', 'Product name *')}
        <label className="admin-field"><span>Category</span><select className="admin-field__control" value={form.category} onChange={(event) => update('category', event.target.value)}><option value="">Choose before publishing</option>{categories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}</select></label>
        <div className="social-import__field-row">{field('price', 'Selling price (₹)', 'number', job.suggestion?.priceNeedsReview ? 'Filled from the source — confirm your selling price.' : undefined)}{field('stock', 'Stock quantity', 'number', 'Only you know the stock available in your store.')}</div>
        {job.suggestion?.fieldSources?.price && <p className="social-import__price-source">Found in {({ caption: 'the caption', on_screen: 'video text', speech: 'reel audio' })[job.suggestion.fieldSources.price.source] || 'the source'}{job.suggestion.fieldSources.price.timestampSeconds != null ? ` at ${Number(job.suggestion.fieldSources.price.timestampSeconds).toFixed(1)}s` : ''}: “{job.suggestion.fieldSources.price.quote}”</p>}
        {job.suggestion?.priceAmbiguous && <p className="social-import__alert">The source price is unclear or belongs to several products. Enter the price for this product.</p>}
        <ImportSizeFields form={form} onUpdate={update} categories={categories} structure={structure} />
        {productAttributeDefinitions(structure, categories, form).filter((item) => item.required).map((item) => <label className="admin-field" key={item.key}><span>{item.label}{item.unit ? ` (${item.unit})` : ''} *</span><input className="admin-field__control" maxLength={500} value={form.attributeValues[item.key] || ''} onChange={(event) => update('attributeValues', { ...form.attributeValues, [item.key]: event.target.value })} /></label>)}
        <details className="social-import__additional"><summary>Review all filled details & optional fields</summary>
          <label className="admin-field"><span>Description</span><textarea className="admin-field__control" rows={4} maxLength={6000} value={form.description} onChange={(event) => update('description', event.target.value)} /></label>
          <div className="social-import__field-row">{field('originalPrice', 'MRP (₹)', 'number')}{field('subCategory', 'Subcategory')}{field('colors', 'Colors (comma separated)')}{field('fabric', 'Fabric / material')}{field('occasion', 'Occasion')}</div>
          {field('shortDescription', 'Short description')}{field('tags', 'Tags (comma separated)')}{field('highlights', 'Highlights (comma separated)')}{field('careInstructions', 'Care instructions')}{field('metaTitle', 'SEO title')}{field('metaDescription', 'SEO description')}{field('metaKeywords', 'SEO keywords')}
          {productAttributeDefinitions(structure, categories, form).filter((item) => !item.required).map((item) => <label className="admin-field" key={item.key}><span>{item.label}</span><input className="admin-field__control" maxLength={500} value={form.attributeValues[item.key] || ''} onChange={(event) => update('attributeValues', { ...form.attributeValues, [item.key]: event.target.value })} /></label>)}
        </details>
      </fieldset>
      {job.warnings?.length > 0 && <details className="social-import__notes"><summary>Review notes ({job.warnings.length})</summary><ul>{job.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>}
      {job.caption && <details className="social-import__notes"><summary>Original post caption</summary><p className="social-import__caption">{job.caption}</p></details>}
      {error && <p className="social-import__alert" role="alert">{error}</p>}
      <div className="social-import__save"><p>Publish directly from here, or save your progress for later. Everything stays editable.</p><button className="admin-btn" type="submit" disabled={saving}><PackagePlus size={17} />{saving ? 'Saving…' : 'Publish product'}</button><button className="admin-btn-ghost" type="button" disabled={saving} onClick={(event) => save(event, false)}>Save for later</button></div>
    </div>
    {viewer !== null && <PhotoPreview images={job.images} index={viewer} setIndex={setViewer} onClose={() => setViewer(null)} />}
  </form>;
}
function PhotoPreview({ images, index, setIndex, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current; const focus = document.activeElement; const overflow = document.body.style.overflow;
    dialog.showModal(); document.body.style.overflow = 'hidden';
    return () => { dialog.close(); document.body.style.overflow = overflow; focus?.focus(); };
  }, []);
  return <dialog ref={ref} className="social-import__lightbox" aria-label="Product photo preview" onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <header><span>Photo {index + 1} of {images.length}</span><button type="button" onClick={onClose} aria-label="Close photo preview"><X size={24} /></button></header>
    <img src={normalizeImageUrl(images[index].url)} alt={'Product photo ' + (index + 1)} />
    <footer><button type="button" onClick={() => setIndex(index - 1)} disabled={index === 0} aria-label="Previous photo"><ArrowLeft size={22} /></button><button type="button" onClick={() => setIndex(index + 1)} disabled={index === images.length - 1} aria-label="Next photo"><ArrowRight size={22} /></button></footer>
  </dialog>;
}
