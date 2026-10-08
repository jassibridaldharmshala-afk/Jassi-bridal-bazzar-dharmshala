import { productAttributeDefinitions } from '../../utils/catalogOptions';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Check, FileVideo, GitMerge, Info, MoveRight, Plus, RefreshCcw,
  Scissors, Search, Sparkles, Trash2, Upload, WandSparkles, X,
} from 'lucide-react';
import PageHeader from '../../components/admin/PageHeader';
import EmptyState from '../../components/admin/EmptyState';
import Loader from '../../components/admin/Loader';
import StatusBadge from '../../components/admin/StatusBadge';
import ImportSizeFields from '../../components/admin/ImportSizeFields';
import { socialPublishMissing } from '../../utils/socialImport';
import './SocialProductImport.css';
import { Select, TextArea, TextInput } from '../../components/ui/Field';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import {
  buildReelProgressSteps,
  reelActivityLabel,
  uploadReelForProcessing,
} from '../../services/reelImport';
import { fetchCategories, fetchSubcategories } from '../../utils/catalogOptions';

const TERMINAL = new Set(['review_required', 'completed', 'failed', 'cancelled']);
const ACCEPTED_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);
const STATUS_OPTIONS = ['', 'queued', 'processing', 'review_required', 'completed', 'failed', 'cancelled'];

export default function ReelProductImport({ route = '', navigate }) {
  const jobId = useMemo(() => new URLSearchParams(route.split('?')[1] || '').get('jobId'), [route]);
  return jobId ? <ReviewWorkspace jobId={jobId} /> : <ImportWorkspace navigate={navigate} />;
}

function ImportWorkspace({ navigate }) {
  const { notify } = useAuth();
  const inputRef = useRef(null);
  const uploadRef = useRef(null);
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [capabilities, setCapabilities] = useState(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const query = new URLSearchParams({ page: String(pagination.page), limit: '12' });
      if (search.trim()) query.set('search', search.trim());
      if (status) query.set('status', status);
      const response = await api.get(`/admin/reel-imports?${query}`);
      const nextItems = Array.isArray(response) ? response : (Array.isArray(response?.data) ? response.data : []);
      setItems(nextItems);
      setPagination((current) => ({ ...current, ...(response?.pagination || {}) }));
    } catch (error) {
      setItems([]);
      notify(error.message, 'error', 'Reel Product Import');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [notify, pagination.page, search, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => load(), 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    let active = true;
    api.get('/admin/reel-imports/capabilities')
      .then((response) => { if (active) setCapabilities(response?.data || response); })
      .catch((error) => {
        if (active) setCapabilities({ ready: false, issues: [error.message || 'Unable to verify reel import services.'] });
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!items.some((item) => !TERMINAL.has(item.status))) return undefined;
    const timer = window.setInterval(() => load(true), 4000);
    return () => window.clearInterval(timer);
  }, [items, load]);

  const chooseFile = (incoming) => {
    const selected = Array.from(incoming || [])[0];
    if (!selected) return;
    if (!ACCEPTED_TYPES.has(selected.type)) {
      notify('Only MP4, MOV, and WebM videos are supported.', 'error', 'Upload Product Reel');
      return;
    }
    const maxFileSizeMb = Number(capabilities?.maxFileSizeMb || 250);
    if (selected.size > maxFileSizeMb * 1024 * 1024) {
      notify(`The reel must be ${maxFileSizeMb}MB or smaller.`, 'error', 'Upload Product Reel');
      return;
    }
    setFile(selected);
  };

  const upload = async () => {
    if (!file || uploading) return;
    setUploading(true);
    setUploadProgress(10);
    try {
      if (capabilities && !capabilities.ready) {
        throw new Error(capabilities.issues?.[0] || 'Reel Import is not ready on the server.');
      }
      const { response, job } = await uploadReelForProcessing(file, {
        onRequest: (request) => {
          uploadRef.current = request;
          setUploadProgress(45);
        },
      });
      setUploadProgress(100);
      if (response.warning || job.status === 'failed') {
        notify(response.warning || job.error?.safeMessage || 'Reel uploaded, but background processing is not available yet.', 'warning', 'Upload Product Reel');
      } else {
        notify('Reel uploaded. Background processing has started.', 'success', 'Upload Product Reel');
      }
      setFile(null);
      await load(true);
      if (job?._id || job?.id) navigate?.(`/admin/reel-import?jobId=${job._id || job.id}`);
    } catch (error) {
      if (error.name !== 'AbortError') notify(error.message, 'error', 'Upload Product Reel');
    } finally {
      uploadRef.current = null;
      setUploading(false);
      setUploadProgress(0);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const cancelUpload = () => {
    uploadRef.current?.cancel();
    notify('Upload cancelled.', 'warning', 'Upload Product Reel');
  };

  const cancelJob = async (job) => {
    try {
      await api.post(`/admin/reel-imports/${job._id || job.id}/cancel`, {});
      notify('Processing cancelled.', 'success', 'Reel Product Import');
      load(true);
    } catch (error) {
      notify(error.message, 'error', 'Reel Product Import');
    }
  };

  const retryJob = async (job) => {
    try {
      await api.post(`/admin/reel-imports/${job._id || job.id}/retry`, {});
      notify('Retry queued.', 'success', 'Reel Product Import');
      load(true);
    } catch (error) {
      notify(error.message, 'error', 'Reel Product Import');
    }
  };

  const deleteJob = async (job) => {
    if (!window.confirm('Delete this reel import?')) return;
    try {
      await api.delete(`/admin/reel-imports/${job._id || job.id}`);
      notify('Reel import deleted.', 'success', 'Reel Product Import');
      load(true);
    } catch (error) {
      notify(error.message, 'error', 'Reel Product Import');
    }
  };

  return (
    <section className="space-y-5">
      <PageHeader title="Reel Product Import" note="Turn a product reel into review-ready Product Drafts. Nothing is published automatically." />

      <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="admin-card p-4 md:p-6">
          <h2 className="text-lg font-black text-charcoal">Upload Product Reel</h2>
          {capabilities && !capabilities.ready && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold leading-5 text-amber-900" role="alert">
              <p>Reel Import needs attention before uploads can start:</p>
              <ul className="mt-1 list-disc pl-5">{(capabilities.issues || ['The processing service is unavailable.']).map((issue) => <li key={issue}>{issue}</li>)}</ul>
            </div>
          )}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDrop={(event) => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files); }}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            className={`mt-4 grid min-h-56 w-full place-items-center rounded-[22px] border-2 border-dashed p-5 text-center transition ${dragging ? 'border-wine bg-blush' : 'border-wine/30 bg-[#fbf8f4] hover:border-wine'}`}
          >
            <span>
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-wine text-white"><Plus className="h-6 w-6" /></span>
              <span className="mt-4 block text-base font-black text-charcoal">Drop a reel here or select a file</span>
              <span className="mt-2 block text-xs font-semibold text-slate-500">MP4, MOV or WebM · up to {capabilities?.maxDurationSeconds || 180} seconds · maximum {capabilities?.maxFileSizeMb || 250}MB</span>
              <span className="mt-4 inline-flex rounded-xl bg-white px-5 py-3 text-sm font-black text-wine shadow-sm">Select file</span>
            </span>
          </button>
          <input ref={inputRef} type="file" accept=".mp4,.mov,.webm" className="hidden" onChange={(event) => chooseFile(event.target.files)} />
          {file && (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-theme-border bg-[#fffdfa] p-4">
              <FileVideo className="h-6 w-6 text-wine" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-charcoal">{file.name}</p>
                <p className="text-xs font-semibold text-slate-500">{formatBytes(file.size)}</p>
              </div>
              {!uploading && <button type="button" onClick={() => setFile(null)} aria-label="Remove selected file"><X className="h-5 w-5 text-slate-500" /></button>}
            </div>
          )}
          {uploading && (
            <div className="mt-4">
              <div className="flex justify-between text-xs font-black text-slate-500"><span>Uploading video</span><span>{uploadProgress}%</span></div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-wine transition-all" style={{ width: `${uploadProgress}%` }} /></div>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" disabled={!file || uploading || capabilities?.ready === false} onClick={upload} className="admin-btn disabled:opacity-50">
              <Upload className="h-4 w-4" />{uploading ? 'Uploading…' : 'Upload and process'}
            </button>
            {uploading && <button type="button" onClick={cancelUpload} className="h-11 rounded-xl border border-rose-200 px-5 text-sm font-black text-rose">Cancel upload</button>}
          </div>
        </div>

        <aside className="admin-card p-5">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-wine">For better results</p>
          <ul className="mt-4 space-y-3 text-sm font-semibold leading-5 text-slate-600">
            {['Keep each dress visible for 2–4 seconds.', 'Show a clear front view in good lighting.', 'Keep the complete outfit inside the frame.', 'Pause briefly before the next dress.', 'Avoid very fast transitions or multiple dresses together.'].map((tip) => (
              <li key={tip} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-wine" />{tip}</li>
            ))}
          </ul>
          <div className="mt-5 rounded-2xl bg-blush p-4 text-xs font-bold leading-5 text-wine">The system prepares possible products and their best images. You verify every draft before publishing.</div>
        </aside>
      </div>

      <div className="admin-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-lg font-black text-charcoal">Import history</h2><p className="text-xs font-semibold text-slate-500">{pagination.total || items.length} imports</p></div>
          <div className="flex flex-1 flex-wrap justify-end gap-2">
            <label className="sc-field-shell flex h-10 min-w-[190px] items-center gap-2 rounded-xl border border-slate-200 px-3"><Search className="h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPagination((current) => ({ ...current, page: 1 })); }} placeholder="Search reels" className="w-full bg-transparent text-sm outline-none" /></label>
            <Select value={status} onChange={(event) => { setStatus(event.target.value); setPagination((current) => ({ ...current, page: 1 })); }} className="h-10">
              {STATUS_OPTIONS.map((option) => <option key={option || 'all'} value={option}>{option ? labelStatus(option) : 'All statuses'}</option>)}
            </Select>
          </div>
        </div>
        <div className="mt-4">
          {loading ? <Loader label="Loading reel imports…" /> : !items.length ? <EmptyState title="No reel imports yet" note="Upload your first product reel above." /> : (
            <div className="grid gap-3">
              {items.map((job) => <HistoryRow key={job._id || job.id} job={job} onCancel={cancelJob} onRetry={retryJob} onDelete={deleteJob} />)}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function HistoryRow({ job, onCancel, onRetry, onDelete }) {
  const id = job._id || job.id;
  const progress = Number(job.progress?.percentage || 0);
  return (
    <article className="grid gap-3 rounded-2xl border border-[#eee3da] bg-[#fffdfa] p-4 md:grid-cols-[1fr_180px_auto] md:items-center">
      <div className="min-w-0">
        <p className="truncate text-sm font-black text-charcoal">{job.sourceVideo?.originalFilename || 'Product reel'}</p>
        <p className="mt-1 text-xs font-semibold text-slate-500">{formatDate(job.createdAt)} · {formatDuration(job.sourceVideo?.durationSeconds)} · {job.statistics?.detectedProducts || 0} products</p>
        {job.status === 'failed' && job.error?.safeMessage ? (
          <p className="mt-1 text-xs font-semibold text-rose-700">{job.error.safeMessage}</p>
        ) : job.progress?.message && !TERMINAL.has(job.status) ? (
          <p className="mt-1 text-xs font-semibold text-slate-500">{job.progress.message}</p>
        ) : null}
      </div>
      <div>
        <div className="flex items-center justify-between gap-2"><StatusBadge value={labelStatus(job.status)} /><span className="text-xs font-black text-slate-500">{progress}%</span></div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-wine" style={{ width: `${progress}%` }} /></div>
      </div>
      <div className="flex flex-wrap gap-2 md:justify-end">
        <a href={`/admin/reel-import?jobId=${id}`} className="rounded-xl bg-wine px-3 py-2 text-xs font-black text-white">{job.status === 'review_required' || job.status === 'completed' ? 'Open results' : 'View progress'}</a>
        {['failed', 'cancelled'].includes(job.status) && <button type="button" onClick={() => onRetry(job)} className="rounded-xl border border-slate-200 p-2" aria-label="Retry"><RefreshCcw className="h-4 w-4" /></button>}
        {['queued', 'processing'].includes(job.status) && <button type="button" onClick={() => onCancel(job)} className="rounded-xl border border-slate-200 p-2" aria-label="Cancel"><X className="h-4 w-4" /></button>}
        {!['processing', 'creating_drafts'].includes(job.status) && <button type="button" onClick={() => onDelete(job)} className="rounded-xl border border-rose-100 p-2 text-rose" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>}
      </div>
    </article>
  );
}

function ReviewWorkspace({ jobId }) {
  const { notify } = useAuth();
  const loadInFlightRef = useRef(false);
  const [job, setJob] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [capabilities, setCapabilities] = useState(null);
  const [structure, setStructure] = useState(null);
  const [checkingSetup, setCheckingSetup] = useState(false);
  const [publishedProducts, setPublishedProducts] = useState([]);
  const [forms, setForms] = useState({});
  const [selected, setSelected] = useState([]);
  const [draftSelected, setDraftSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [smartFilling, setSmartFilling] = useState([]);
  const [smartFillingAll, setSmartFillingAll] = useState(false);
  const [jobAction, setJobAction] = useState('');
  const [pollError, setPollError] = useState('');

  const load = useCallback(async (quiet = false) => {
    if (loadInFlightRef.current) return;
    loadInFlightRef.current = true;
    if (!quiet) setLoading(true);
    try {
      const jobResponse = await api.get(`/admin/reel-imports/${jobId}`);
      const currentJob = jobResponse.data || jobResponse;
      setJob(currentJob);
      setPollError('');
      if (['review_required', 'completed'].includes(currentJob.status)) {
        const candidateResponse = await api.get(`/admin/reel-imports/${jobId}/candidates`);
        const nextCandidates = candidateResponse.data || [];
        setCandidates(nextCandidates);
        setDraftSelected((current) => {
          const eligible = nextCandidates.filter((item) => !['ignored', 'merged'].includes(item.status) && !item.savedDraft?.publishedProductId).map((item) => item._id || item.id);
          return current.length ? current.filter((id) => eligible.includes(id)) : eligible;
        });
        setForms((current) => {
          const next = { ...current };
          nextCandidates.forEach((candidate) => {
            const id = candidate._id || candidate.id;
            if (!next[id]) next[id] = candidateForm(candidate);
          });
          return next;
        });
      }
    } catch (error) {
      setPollError(error.message);
      if (!quiet) notify(error.message, 'error', 'Reel review');
    } finally {
      loadInFlightRef.current = false;
      if (!quiet) setLoading(false);
    }
  }, [jobId, notify]);

  useEffect(() => {
    load();
    fetchCategories(api).then(setCategories).catch(() => setCategories([]));
    api.get('/catalog-configuration').then(setStructure).catch(() => setStructure(null));
    api.get('/admin/reel-imports/capabilities')
      .then((response) => setCapabilities(response?.data || response))
      .catch(() => setCapabilities({ smartSuggestionsEnabled: false }));
  }, [load]);

  const checkSetup = async () => {
    setCheckingSetup(true);
    try {
      const response = await api.get('/admin/reel-imports/capabilities');
      const value = response?.data || response;
      setCapabilities(value);
      notify(value.smartSuggestionsEnabled ? 'The AI key is configured. You can now fill product details.' : value.smartSuggestionsMessage || 'The backend AI key is still missing.', value.smartSuggestionsEnabled ? 'success' : 'warning', 'Smart Reel Assistant');
    } catch (error) { notify(error.message, 'error', 'Smart Reel Assistant'); }
    finally { setCheckingSetup(false); }
  };

  useEffect(() => {
    if (!job || TERMINAL.has(job.status)) return undefined;
    const timer = window.setInterval(() => load(true), 3500);
    return () => window.clearInterval(timer);
  }, [job, load]);

  const retryJob = async () => {
    if (jobAction) return;
    setJobAction('retry');
    try {
      const response = await api.post(`/admin/reel-imports/${jobId}/retry`, {});
      setJob(response.data || response);
      notify('A new processing attempt has been queued.', 'success', 'Reel review');
      await load(true);
    } catch (error) {
      notify(error.message, 'error', 'Reel review');
    } finally {
      setJobAction('');
    }
  };

  const cancelJob = async () => {
    if (jobAction) return;
    setJobAction('cancel');
    try {
      const response = await api.post(`/admin/reel-imports/${jobId}/cancel`, {});
      setJob(response.data || response);
      notify('Processing cancelled safely.', 'success', 'Reel review');
    } catch (error) {
      notify(error.message, 'error', 'Reel review');
    } finally {
      setJobAction('');
    }
  };

  const updateForm = (id, field, value) => setForms((current) => ({ ...current, [id]: { ...current[id], [field]: value } }));

  const saveCandidate = async (candidate, quiet = false) => {
    const id = candidate._id || candidate.id;
    const form = forms[id] || candidateForm(candidate);
    const response = await api.patch(`/admin/reel-imports/${jobId}/candidates/${id}`, {
      status: form.status,
      adminOverrides: {
        name: form.name, category: form.category, subCategory: form.subCategory, primaryColor: form.primaryColor,
        pattern: form.pattern, fabric: form.fabric, occasion: form.occasion, tags: form.tags,
        description: form.description, price: form.price, sizes: form.sizingMode === 'free-size' ? '' : form.sizes,
        sizingMode: form.sizingMode, stock: form.stock, primaryFrameId: form.primaryFrameId,
        originalPrice: form.originalPrice, shortDescription: form.shortDescription, highlights: form.highlights, careInstructions: form.careInstructions, metaTitle: form.metaTitle, metaDescription: form.metaDescription, metaKeywords: form.metaKeywords, sizeChart: form.sizeChart, sizeChartProfile: form.sizeChartProfile, attributeValues: form.attributeValues,
      },
      selectedFrameIds: form.selectedFrameIds,
    });
    if (!quiet) notify('Candidate saved.', 'success', 'Reel review');
    return response;
  };

  const smartFillCandidate = async (candidate, quiet = false) => {
    const id = candidate._id || candidate.id;
    const currentForm = forms[id] || candidateForm(candidate);
    setSmartFilling((current) => current.includes(id) ? current : [...current, id]);
    try {
      const response = await api.post(`/admin/reel-imports/${jobId}/candidates/${id}/analyze`, {
        selectedFrameIds: currentForm.selectedFrameIds,
      });
      const nextCandidate = response.data || response;
      setCandidates((current) => current.map((item) => (item._id || item.id) === id ? nextCandidate : item));
      const completed = nextCandidate.analysis?.status === 'completed';
      if (completed) setForms((current) => ({
        ...current,
        [id]: mergeSmartCandidateForm(current[id] || currentForm, candidateForm(candidate), candidateForm(nextCandidate)),
      }));
      const message = response.warning || nextCandidate.analysis?.error || 'Smart suggestions need another try.';
      if (!quiet) {
        notify(
          completed ? 'Product details suggested from the selected reel views.' : message,
          completed ? 'success' : 'warning',
          'Smart Reel Assistant',
        );
      }
      return { completed, error: completed ? '' : message, errorCode: nextCandidate.analysis?.errorCode };
    } catch (error) {
      if (!quiet) notify(error.message, 'error', 'Smart Reel Assistant');
      return { completed: false, error: error.message, errorCode: error.code };
    } finally {
      setSmartFilling((current) => current.filter((item) => item !== id));
    }
  };

  const smartFillAll = async () => {
    if (smartFillingAll || capabilities?.smartSuggestionsEnabled !== true) return;
    const eligible = candidates.filter((candidate) => !['ignored', 'merged'].includes(candidate.status) && !candidate.savedDraft?.publishedProductId);
    if (!eligible.length) return notify('There are no candidates available for smart fill.', 'info', 'Smart Reel Assistant');
    setSmartFillingAll(true);
    let completed = 0; let attempted = 0; let failure = '';
    try {
      for (const candidate of eligible) {
        const result = await smartFillCandidate(candidate, true);
        attempted += 1;
        if (result.completed) completed += 1;
        else {
          failure ||= result.error;
          // A project/service failure affects every group; avoid spending quota
          // repeating the same unsuccessful request for the remaining products.
          if (['AI_QUOTA_EXCEEDED', 'AI_ACCESS_DENIED', 'AI_MODEL_UNAVAILABLE', 'AI_CONNECTION_FAILED', 'AI_PROVIDER_UNAVAILABLE', 'AI_KEY_MISSING'].includes(result.errorCode)) break;
        }
      }
      const failed = eligible.length - completed;
      notify(
        failed
          ? `${completed} of ${eligible.length} products were filled. ${failure || 'Please review the messages on the remaining products.'}${attempted < eligible.length ? ' Remaining products were not analyzed.' : ''}`
          : `${completed} product${completed === 1 ? '' : 's'} filled with catalog suggestions. Please confirm before creating drafts.`,
        failed ? 'warning' : 'success',
        'Smart Reel Assistant',
      );
    } finally {
      setSmartFillingAll(false);
    }
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      await Promise.all(candidates.filter((item) => item.status !== 'merged').map((item) => saveCandidate(item, true)));
      notify('Review saved. You can return later.', 'success', 'Reel review');
      load(true);
    } catch (error) {
      notify(error.message, 'error', 'Reel review');
    } finally {
      setSaving(false);
    }
  };

  const merge = async () => {
    if (selected.length < 2) return notify('Select at least two candidate groups to merge.', 'warning', 'Merge products');
    try {
      await api.post(`/admin/reel-imports/${jobId}/candidates/merge`, { candidateIds: selected });
      setSelected([]);
      notify('Candidate groups merged.', 'success', 'Merge products');
      load(true);
    } catch (error) {
      notify(error.message, 'error', 'Merge products');
    }
  };

  const split = async (candidate) => {
    const id = candidate._id || candidate.id;
    const value = window.prompt('Split from which video timestamp (seconds)?', String(Math.round((candidate.sourceRange?.startSeconds + candidate.sourceRange?.endSeconds) / 2)));
    if (value === null) return;
    try {
      await api.post(`/admin/reel-imports/${jobId}/candidates/${id}/split`, { fromTimestamp: Number(value) });
      notify('Candidate split into two product groups.', 'success', 'Split product');
      load(true);
    } catch (error) {
      notify(error.message, 'error', 'Split product');
    }
  };

  const moveFrame = async (candidate, frameId, targetCandidateId) => {
    if (!targetCandidateId) return;
    try {
      await api.post(`/admin/reel-imports/${jobId}/candidates/${candidate._id || candidate.id}/move-frame`, { frameId, targetCandidateId });
      notify('Frame moved to the selected product.', 'success', 'Move frame');
      load(true);
    } catch (error) {
      notify(error.message, 'error', 'Move frame');
    }
  };

  const approveHighConfidence = async () => {
    const high = candidates.filter((item) => Number(item.confidence?.overall || 0) >= 0.75 && item.status === 'suggested');
    if (!high.length) return notify('No unapproved high-confidence candidates found.', 'info', 'Reel review');
    try {
      await Promise.all(high.map((item) => api.patch(`/admin/reel-imports/${jobId}/candidates/${item._id || item.id}`, { status: 'approved' })));
      notify(`${high.length} high-confidence candidate${high.length > 1 ? 's' : ''} approved.`, 'success', 'Reel review');
      load(true);
    } catch (error) {
      notify(error.message, 'error', 'Reel review');
    }
  };

  const createDrafts = async (publish = false) => {
    if (!draftSelected.length || saving) return notify('Select at least one candidate for draft creation.', 'warning', 'Create drafts');
    if (publish && !structure) return notify('Product configuration could not be loaded. Refresh this page before publishing.', 'error', 'Publish products');
    if (publish) for (const candidate of candidates.filter((item) => draftSelected.includes(item._id || item.id))) {
      const form = forms[candidate._id || candidate.id] || candidateForm(candidate);
      const addedPhotos = (candidate.savedDraft?.images || []).filter((image) => !candidate.frames?.some((frame) => frame.url === image.url));
      const missing = socialPublishMissing({ ...form, imageIds: [...form.selectedFrameIds, ...addedPhotos.map((image) => image.url)] }, categories, structure);
      if (missing.length) return notify(`Product ${candidate.groupNumber}: complete ${missing.join(', ')}.`, 'warning', 'Publish products');
    }
    setSaving(true);
    try {
      await Promise.all(candidates.filter((item) => draftSelected.includes(item._id || item.id)).map((item) => saveCandidate(item, true)));
      const response = await api.post(`/admin/reel-imports/${jobId}/create-drafts`, { candidateIds: draftSelected });
      const count = response.data?.drafts?.length || draftSelected.length;
      if (publish) {
        const ids = (response.data?.drafts || []).map((draft) => draft._id || draft.id).filter(Boolean);
        if (!ids.length) throw new Error('The saved drafts were not confirmed. Refresh this review before publishing.');
        const result = await api.post('/admin/product-drafts/publish-selected', { ids });
        if (!result.success || !result.data?.products?.length) throw new Error('Publication was not confirmed. Your product drafts are saved for retry.');
        setPublishedProducts(result.data.products);
        notify(`${result.data.products.length} product(s) published.`, 'success', 'Publish products');
      } else notify(`${count} product draft${count > 1 ? 's' : ''} created. You can continue editing here.`, 'success', 'Create drafts');
      load(true);
    } catch (error) {
      notify(error.message, 'error', 'Create drafts');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader label="Loading reel import…" />;
  if (!job) return <EmptyState title="Reel import not found" note="Return to import history and choose another job." />;
  const progressSteps = buildReelProgressSteps(job);
  const active = !TERMINAL.has(job.status);
  const analyzedCount = candidates.filter((candidate) => candidate.analysis?.status === 'completed').length;

  return (
    <section className="space-y-5">
      <PageHeader title="Review Reel Products" note={job.sourceVideo?.originalFilename || 'Product reel'}>
        <a href="/admin/reel-import" className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-charcoal"><ArrowLeft className="h-4 w-4" />Import history</a>
      </PageHeader>
      {publishedProducts.length > 0 && <div role="status" className="admin-card p-5"><p className="font-bold text-emerald-800">Your products are published and ready to edit.</p><div className="mt-3 flex flex-wrap gap-3">{publishedProducts.map((product) => <a key={product._id} href={'/admin/products/edit?id=' + product._id} className="admin-btn-ghost">Edit {product.name}</a>)}</div></div>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Status" value={labelStatus(job.status)} />
        <Stat label="Extracted" value={job.statistics?.extractedFrames || 0} />
        <Stat label="Rejected" value={job.statistics?.rejectedFrames || 0} />
        <Stat label="Duplicates" value={job.statistics?.duplicateFrames || 0} />
        <Stat label="Review groups" value={job.statistics?.detectedProducts || 0} />
      </div>

      {(active || ['failed', 'cancelled'].includes(job.status)) && (
        <div className="admin-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black text-charcoal">{job.progress?.currentStep || 'Processing reel'}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{reelActivityLabel(job)} · Attempt {Math.max(1, Number(job.attemptCount || 0))}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-wine">{Number(job.progress?.percentage || 0)}%</span>
              {active && <button type="button" disabled={Boolean(jobAction)} onClick={cancelJob} className="h-9 rounded-xl border border-slate-200 px-3 text-xs font-black disabled:opacity-50">{jobAction === 'cancel' ? 'Cancelling…' : 'Cancel'}</button>}
              {['failed', 'cancelled'].includes(job.status) && <button type="button" disabled={Boolean(jobAction)} onClick={retryJob} className="inline-flex h-9 items-center gap-2 rounded-xl bg-wine px-3 text-xs font-black text-white disabled:opacity-50"><RefreshCcw className="h-3.5 w-3.5" />{jobAction === 'retry' ? 'Queueing…' : 'Retry'}</button>}
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-wine transition-all" style={{ width: `${job.progress?.percentage || 0}%` }} /></div>
          <p className="mt-3 text-xs font-semibold text-slate-500">{job.progress?.message}</p>
          <div className="mt-5 overflow-x-auto pb-1" aria-label="Reel import processing stages">
            <ol className="grid min-w-[840px] grid-cols-10 gap-2">
              {progressSteps.map((step, index) => (
                <li key={step.key} className="relative text-center">
                  {index > 0 && <span className={`absolute right-1/2 top-3 h-0.5 w-full ${step.status === 'pending' ? 'bg-slate-200' : 'bg-wine/50'}`} />}
                  <span className={`relative mx-auto grid h-6 w-6 place-items-center rounded-full border text-[10px] font-black ${progressStepClass(step.status)}`}>
                    {step.status === 'completed' ? <Check className="h-3.5 w-3.5" /> : ['failed', 'cancelled'].includes(step.status) ? <X className="h-3.5 w-3.5" /> : index + 1}
                  </span>
                  <span className={`relative mt-1.5 block text-[10px] font-bold ${step.status === 'pending' ? 'text-slate-400' : 'text-slate-700'}`}>{step.label}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
      {pollError && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">Live progress could not be refreshed: {pollError}</div>}
      {job.error?.safeMessage && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800">{job.error.safeMessage}</div>}

      {candidates.length > 0 && (
        <>
          <div className="relative overflow-hidden rounded-[24px] border border-wine/15 bg-gradient-to-br from-ivory via-white to-[#f8edf1] p-5 shadow-sm md:p-6">
            <div className="absolute -right-12 -top-16 h-44 w-44 rounded-full bg-wine/5" />
            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-wine text-white shadow-lg shadow-wine/15"><Sparkles className="h-5 w-5" /></span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-wine px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-white">New</span>
                    <p className="text-base font-black text-charcoal">Smart Reel Assistant</p>
                    {analyzedCount > 0 && <span className="text-xs font-bold text-wine">{analyzedCount}/{candidates.length} analyzed</span>}
                  </div>
                  <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
                    Reads product views, video text and audio to fill the name, category, description and stated details. Clear product prices are filled too. Review what is missing, then publish here.
                  </p>
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-slate-500"><Info className="h-3.5 w-3.5" />Stock stays manual. Prices, sizes and measurements are filled only when stated in the source.</p>
                  {capabilities?.smartSuggestionsEnabled === false && (
                    <div className="mt-3 space-y-3"><p className="text-xs font-black text-amber-800">{capabilities.smartSuggestionsMessage || 'AI setup could not be checked. Try checking it again.'}</p><div className="flex flex-wrap gap-2"><a className="admin-btn-ghost" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Get a Gemini API key</a><button type="button" className="admin-btn-ghost" disabled={checkingSetup} onClick={checkSetup}>{checkingSetup ? 'Checking…' : 'Check setup again'}</button></div></div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={smartFillAll}
                disabled={smartFillingAll || capabilities?.smartSuggestionsEnabled !== true}
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-wine px-5 text-sm font-black text-white shadow-lg shadow-wine/15 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <WandSparkles className={`h-4 w-4 ${smartFillingAll ? 'animate-pulse' : ''}`} />
                {smartFillingAll ? `Analyzing ${smartFilling.length ? `(${smartFilling.length})` : ''}` : (analyzedCount ? 'Refresh all suggestions' : 'Smart fill all products')}
              </button>
            </div>
          </div>
          <div className="sticky top-[74px] z-20 flex flex-wrap items-center justify-between gap-2 rounded-[20px] border border-theme-border bg-white/95 p-3 shadow-lg backdrop-blur">
            <p className="text-xs font-black text-slate-500">{draftSelected.length} selected for drafts · {selected.length} selected to merge</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={merge} disabled={selected.length < 2} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-black disabled:opacity-40"><GitMerge className="h-4 w-4" />Merge</button>
              <button type="button" onClick={approveHighConfidence} className="h-10 rounded-xl border border-slate-200 px-3 text-xs font-black">Approve high confidence</button>
              <button type="button" onClick={saveAll} disabled={saving} className="h-10 rounded-xl border border-wine px-3 text-xs font-black text-wine">Save all reviews</button>
              <button type="button" onClick={() => createDrafts(false)} disabled={saving || !draftSelected.length} className="h-10 rounded-xl border border-wine px-4 text-xs font-black text-wine disabled:opacity-50">Save for later</button>
              <button type="button" onClick={() => createDrafts(true)} disabled={saving || !draftSelected.length} className="h-10 rounded-xl bg-wine px-4 text-xs font-black text-white disabled:opacity-50">{saving ? 'Saving…' : 'Publish selected products'}</button>
            </div>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {candidates.filter((item) => item.status !== 'merged').map((candidate) => (
              <CandidateCard
                key={candidate._id || candidate.id}
                candidate={candidate}
                candidates={candidates}
                categories={categories}
                structure={structure}
                form={forms[candidate._id || candidate.id] || candidateForm(candidate)}
                smartEnabled={capabilities?.smartSuggestionsEnabled === true}
                smartFilling={smartFilling.includes(candidate._id || candidate.id)}
                mergeSelected={selected.includes(candidate._id || candidate.id)}
                draftSelected={draftSelected.includes(candidate._id || candidate.id)}
                onMergeSelect={() => toggleId(setSelected, candidate._id || candidate.id)}
                onDraftSelect={() => toggleId(setDraftSelected, candidate._id || candidate.id)}
                onUpdate={(field, value) => updateForm(candidate._id || candidate.id, field, value)}
                onSave={() => saveCandidate(candidate)}
                onSmartFill={() => smartFillCandidate(candidate)}
                onSplit={() => split(candidate)}
                onMove={(frameId, targetId) => moveFrame(candidate, frameId, targetId)}
              />
            ))}
          </div>
        </>
      )}
      {TERMINAL.has(job.status) && !candidates.length && job.status !== 'failed' && <EmptyState title="No product candidates found" note="Try a reel with better lighting, slower transitions, and a clear full-product view." />}
    </section>
  );
}

function CandidateCard({ candidate, candidates, categories, structure, form, smartEnabled, smartFilling, mergeSelected, draftSelected, onMergeSelect, onDraftSelect, onUpdate, onSave, onSmartFill, onSplit, onMove }) {
  const id = candidate._id || candidate.id;
  const confidence = Math.round(Number(candidate.confidence?.overall || 0) * 100);
  const completion = candidateFormCompletion(form);
  const analysisStatus = candidate.analysis?.status || 'pending';
  const [subcategories, setSubcategories] = useState([]);

  useEffect(() => {
    fetchSubcategories(api, form.category).then(setSubcategories);
  }, [form.category]);
  if (candidate.savedDraft?.publishedProductId) return <article className="admin-card p-5"><h2 className="font-bold">{candidate.savedDraft.name}</h2><p className="my-3 text-sm text-emerald-700">{candidate.savedDraft.publishedProductDeleted ? 'Product permanently removed. Import history retained; a duplicate cannot be created.' : 'Published product'}</p>{!candidate.savedDraft.publishedProductDeleted && <a className="admin-btn-ghost" href={'/admin/products/edit?id=' + candidate.savedDraft.publishedProductId}>Edit product</a>}</article>;
  return (
    <article className="admin-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><h2 className="text-base font-black text-charcoal">Candidate {candidate.groupNumber}</h2><StatusBadge value={labelStatus(candidate.status)} /></div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
            <span>{formatDuration(candidate.sourceRange?.startSeconds)}–{formatDuration(candidate.sourceRange?.endSeconds)}</span>
            <span>·</span>
            <span>{completion.completed}/{completion.total} catalog details ready</span>
            {analysisStatus === 'completed' && <span className="rounded-full bg-emerald-50 px-2 py-1 font-black text-emerald-700">{candidate.analysis?.source === 'gemini-reel-context' ? 'Details filled from reel' : `Smart confidence ${confidence}%`}</span>}
            {analysisStatus === 'failed' && <span className="rounded-full bg-amber-50 px-2 py-1 font-black text-amber-800">Needs another look</span>}
          </div>
        </div>
        <div className="flex gap-3 text-xs font-black">
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={mergeSelected} onChange={onMergeSelect} className="accent-wine" />Merge</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={draftSelected} onChange={onDraftSelect} className="accent-wine" />Draft</label>
        </div>
      </div>
      {candidate.analysis?.error && analysisStatus === 'failed' && (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">{candidate.analysis.error}</p>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(candidate.frames || []).map((frame) => (
          <div key={frame._id || frame.storageKey} className={`overflow-hidden rounded-xl border ${form.selectedFrameIds.includes(String(frame._id)) ? 'border-wine ring-2 ring-wine/10' : 'border-slate-200'}`}>
            <button type="button" onClick={() => onUpdate('selectedFrameIds', toggleValue(form.selectedFrameIds, String(frame._id)))} className="relative block w-full">
              <img src={frame.url} alt={candidate.suggestions?.altText || `Candidate ${candidate.groupNumber}`} className="h-36 w-full bg-slate-50 object-contain" />
              <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-bold text-white">{Number(frame.timestampSeconds || 0).toFixed(1)}s</span>
              {form.selectedFrameIds.includes(String(frame._id)) && <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-wine text-white"><Check className="h-3 w-3" /></span>}
            </button>
            <div className="grid gap-1 p-2 text-[10px] font-semibold text-slate-600">
              {frame.selectionVersion && <><span className="text-emerald-700">{frame.recommendedCover ? 'Suggested cover' : frame.recommended ? 'Recommended' : 'Alternative view'}</span><span>Clarity {Math.round((frame.qualityScore || 0) * 100)} / 100{frame.viewType && frame.viewType !== 'unknown' ? ' · ' + frame.viewType : ''}</span>{frame.qualityWarnings?.map((warning) => <span key={warning} className="text-amber-800">{warning}</span>)}</>}
              <a href={frame.url} target="_blank" rel="noreferrer" className="flex min-h-9 items-center text-wine underline">View full photo</a>
              <button type="button" aria-pressed={form.primaryFrameId === String(frame._id)} onClick={() => { if (!form.selectedFrameIds.includes(String(frame._id))) onUpdate('selectedFrameIds', [...form.selectedFrameIds, String(frame._id)]); onUpdate('primaryFrameId', String(frame._id)); }} className="min-h-9 rounded-lg border border-wine/20 text-wine">{form.primaryFrameId === String(frame._id) ? 'Cover photo' : 'Set as cover'}</button>
            </div>
            <MoveFrame frame={frame} sourceId={id} candidates={candidates} onMove={onMove} />
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#fbf7f3] px-3 py-2.5">
        <p className="text-xs font-semibold text-slate-600">Choose the clearest views, then let Smart Fill compare them.</p>
        {candidate.frames?.some((frame) => frame.selectionVersion) && <button type="button" className="min-h-10 rounded-xl border border-wine/20 bg-white px-3 text-xs font-black text-wine" onClick={() => { const recommended = candidate.frames.filter((frame) => frame.recommended !== false); onUpdate('selectedFrameIds', recommended.map((frame) => String(frame._id))); onUpdate('primaryFrameId', String((recommended.find((frame) => frame.recommendedCover) || recommended[0])?._id || '')); }}>Use recommended photos</button>}
        <button
          type="button"
          disabled={!smartEnabled || smartFilling}
          onClick={onSmartFill}
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-wine/20 bg-white px-3 text-xs font-black text-wine disabled:cursor-not-allowed disabled:opacity-45"
        >
          <WandSparkles className={`h-3.5 w-3.5 ${smartFilling ? 'animate-pulse' : ''}`} />
          {smartFilling ? 'Reading views…' : (analysisStatus === 'completed' ? 'Refresh suggestions' : 'Smart fill details')}
        </button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Labeled label="Product name" hint={analysisStatus === 'completed' ? confidenceHint(candidate.confidence?.name) : ''}><TextInput value={form.name} onChange={(event) => onUpdate('name', event.target.value)} placeholder="Please confirm" className="w-full" /></Labeled>
        <Labeled label="Category" hint={analysisStatus === 'completed' ? confidenceHint(candidate.confidence?.category) : ''}>
          <Select value={form.category} onChange={(event) => onUpdate('category', event.target.value)} className="w-full">
            <option value="">Please confirm</option>{categories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}
          </Select>
        </Labeled>
        <Labeled label="Selling price" hint={candidate.suggestions?.fieldSources?.price ? 'From source' : 'Required'}><TextInput type="number" min="0" value={form.price} onChange={(event) => onUpdate('price', event.target.value)} placeholder="Enter if missing" className="w-full" /></Labeled>
        <Labeled label="Stock" hint="Your inventory"><TextInput type="number" min="0" step="1" value={form.stock} onChange={(event) => onUpdate('stock', event.target.value)} placeholder="Available quantity" className="w-full" /></Labeled>
      </div>
      {candidate.suggestions?.fieldSources?.price && <p className="social-import__price-source">Price from {({ speech: 'reel audio', on_screen: 'video text', caption: 'the caption' })[candidate.suggestions.fieldSources.price.source] || 'the source'}: “{candidate.suggestions.fieldSources.price.quote}”</p>}
      {candidate.suggestions?.priceAmbiguous && <p className="mt-3 text-xs font-bold text-amber-800">The source has several products or an unclear price. Confirm the price for this product.</p>}
      <div className="my-4"><ImportSizeFields form={form} onUpdate={onUpdate} categories={categories} structure={structure} /></div>
      {productAttributeDefinitions(structure, categories, form).filter((item) => item.required).map((item) => <Labeled key={item.key} label={item.label} hint="Required"><TextInput value={form.attributeValues[item.key] || ''} onChange={(event) => onUpdate('attributeValues', { ...form.attributeValues, [item.key]: event.target.value })} /></Labeled>)}
      <details className="social-import__additional"><summary className="cursor-pointer text-sm font-bold text-wine">Review all filled details & optional fields</summary><div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Labeled label="Subcategory">
          <Select value={form.subCategory || ''} onChange={(event) => onUpdate('subCategory', event.target.value)} className="w-full">
            <option value="">{subcategories.length ? 'Select subcategory' : 'No subcategories yet'}</option>
            {subcategories.map((item) => <option key={item} value={item}>{item}</option>)}
          </Select>
        </Labeled>
        <Labeled label="Primary colour" hint={analysisStatus === 'completed' ? confidenceHint(candidate.confidence?.primaryColor) : ''}><TextInput value={form.primaryColor} onChange={(event) => onUpdate('primaryColor', event.target.value)} placeholder="Please confirm" className="w-full" /></Labeled>
        <Labeled label="Pattern" hint={analysisStatus === 'completed' ? confidenceHint(candidate.confidence?.pattern) : ''}><TextInput value={form.pattern} onChange={(event) => onUpdate('pattern', event.target.value)} placeholder="Please confirm" className="w-full" /></Labeled>
        <Labeled label="Fabric" hint={analysisStatus === 'completed' ? confidenceHint(candidate.confidence?.fabric) : ''}><TextInput value={form.fabric} onChange={(event) => onUpdate('fabric', event.target.value)} placeholder="Confirm if visible" className="w-full" /></Labeled>
        <Labeled label="Occasion"><TextInput value={form.occasion} onChange={(event) => onUpdate('occasion', event.target.value)} placeholder="Festive, wedding" className="w-full" /></Labeled>
        <Labeled label="Tags"><TextInput value={form.tags} onChange={(event) => onUpdate('tags', event.target.value)} placeholder="festive, maroon" className="w-full" /></Labeled>
        <Labeled label="MRP"><TextInput type="number" min="0" value={form.originalPrice} onChange={(event) => onUpdate('originalPrice', event.target.value)} placeholder="Optional" className="w-full" /></Labeled>
        <div className="sm:col-span-2"><Labeled label="Product description"><TextArea value={form.description} onChange={(event) => onUpdate('description', event.target.value)} placeholder="Describe the visible style, work and silhouette" className="w-full" maxLength={800} /></Labeled></div>
        {productAttributeDefinitions(structure, categories, form).filter((item) => !item.required).map((item) => <Labeled key={item.key} label={item.label}><TextInput value={form.attributeValues[item.key] || ''} onChange={(event) => onUpdate('attributeValues', { ...form.attributeValues, [item.key]: event.target.value })} /></Labeled>)}
      </div></details>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={onSave} className="inline-flex h-10 items-center gap-2 rounded-xl bg-wine px-4 text-xs font-black text-white"><Check className="h-4 w-4" />Save candidate</button>
        <button type="button" onClick={onSplit} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-black"><Scissors className="h-4 w-4" />Split by timestamp</button>
        <button type="button" onClick={() => onUpdate('status', form.status === 'ignored' ? 'suggested' : 'ignored')} className="h-10 rounded-xl border border-rose-100 px-4 text-xs font-black text-rose">{form.status === 'ignored' ? 'Restore' : 'Ignore product'}</button>
      </div>
    </article>
  );
}

function MoveFrame({ frame, sourceId, candidates, onMove }) {
  const [target, setTarget] = useState('');
  const targets = candidates.filter((item) => (item._id || item.id) !== sourceId && !['merged', 'draft_created'].includes(item.status));
  if (!targets.length) return null;
  return (
    <div className="flex items-center gap-1 p-1">
      <select value={target} onChange={(event) => setTarget(event.target.value)} aria-label="Move frame target" className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-1 py-1 text-[9px] font-bold">
        <option value="">Move to…</option>
        {targets.map((item) => <option key={item._id || item.id} value={item._id || item.id}>Candidate {item.groupNumber}</option>)}
      </select>
      <button type="button" disabled={!target} onClick={() => { onMove(frame._id, target); setTarget(''); }} className="grid h-6 w-6 place-items-center rounded-lg bg-slate-100 disabled:opacity-30" aria-label="Move frame"><MoveRight className="h-3 w-3" /></button>
    </div>
  );
}

function Stat({ label, value }) {
  return <div className="rounded-2xl border border-theme-border bg-white p-4"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-wine/60">{label}</p><p className="mt-2 truncate text-lg font-black text-charcoal">{value}</p></div>;
}

function Labeled({ label, hint = '', children }) {
  return <label className="grid gap-1.5"><span className="flex items-center justify-between gap-2 text-xs font-black text-slate-600"><span>{label}</span>{hint && <span className="text-[9px] font-black uppercase tracking-[0.08em] text-wine/60">{hint}</span>}</span>{children}</label>;
}

function candidateForm(candidate) {
  const draft = candidate.savedDraft;
  const overrides = { ...(candidate.adminOverrides || {}), ...(draft ? { ...draft, primaryColor: draft.colors?.join(', ') || '', price: draft.sellingPrice ?? draft.price, category: String(draft.category?._id || draft.category || '') } : {}) };
  const suggestions = candidate.suggestions || {};
  return {
    name: overrides.name && !/^(?:reel\s+)?product\s+\d+$/i.test(overrides.name) ? overrides.name : suggestions.name || overrides.name || '',
    category: overrides.category || suggestions.category || '',
    subCategory: overrides.subCategory || suggestions.subcategory || suggestions.subCategory || '',
    primaryColor: overrides.primaryColor || suggestions.primaryColor || '',
    pattern: overrides.pattern || suggestions.pattern || '',
    fabric: overrides.fabric || suggestions.fabric || '',
    occasion: Array.isArray(overrides.occasion || suggestions.occasion) ? (overrides.occasion || suggestions.occasion).join(', ') : overrides.occasion || suggestions.occasion || '',
    tags: Array.isArray(overrides.tags || suggestions.tags) ? (overrides.tags || suggestions.tags).join(', ') : overrides.tags || '',
    sizes: Array.isArray(overrides.sizes) ? (overrides.sizes.length ? overrides.sizes : suggestions.sizes || []).join(', ') : overrides.sizes || suggestions.sizes?.join(', ') || '',
    sizingMode: (overrides.sizingMode || suggestions.sizingMode || 'auto').replace('confirm', 'auto'),
    shortDescription: overrides.shortDescription || suggestions.shortDescription || '',
    highlights: overrides.highlights || suggestions.highlights || [],
    careInstructions: overrides.careInstructions || suggestions.careInstructions || '',
    metaTitle: overrides.metaTitle || suggestions.metaTitle || '',
    metaDescription: overrides.metaDescription || suggestions.metaDescription || '',
    metaKeywords: overrides.metaKeywords || suggestions.metaKeywords || '',
    description: overrides.description || suggestions.description || suggestions.shortDescription || '',
    price: Number(overrides.price ?? overrides.sellingPrice) > 0 ? overrides.price ?? overrides.sellingPrice : suggestions.price ?? '',
    originalPrice: Number(overrides.originalPrice) > 0 ? overrides.originalPrice : suggestions.originalPrice ?? '',
    sizeChart: overrides.sizeChart?.rows?.length ? overrides.sizeChart : suggestions.sizeChart || { unit: 'in', columns: [], rows: [] }, sizeChartProfile: overrides.sizeChartProfile || 'auto', attributeValues: { ...suggestions.attributeValues, ...overrides.attributeValues },
    stock: overrides.stock ?? '',
    status: candidate.status || 'suggested',
    selectedFrameIds: (candidate.frames || []).filter((frame) => draft?.images?.length ? draft.images.some((image) => image.url === frame.url) : frame.selected).map((frame) => String(frame._id)),
    primaryFrameId: draft?.images?.some((image) => image.primary) ? String(candidate.frames?.find((frame) => frame.url === draft.images.find((image) => image.primary).url)?._id || '') : overrides.primaryFrameId || String((candidate.frames || []).find((frame) => frame.selected && frame.recommendedCover)?._id || (candidate.frames || []).find((frame) => frame.selected)?._id || ''),
  };
}

function mergeSmartCandidateForm(current, before, suggested) {
  const next = { ...current };
  Object.keys(suggested).forEach((field) => {
    if (field === 'selectedFrameIds' || field === 'primaryFrameId' || field === 'status') return;
    const currentValue = current?.[field];
    const previousValue = before?.[field];
    const unchanged = JSON.stringify(currentValue) === JSON.stringify(previousValue);
    if (unchanged || currentValue === '' || currentValue == null) next[field] = suggested[field];
  });
  next.selectedFrameIds = current?.selectedFrameIds || suggested.selectedFrameIds || [];
  next.status = current?.status || suggested.status || 'suggested';
  return next;
}

function candidateFormCompletion(form = {}) {
  const values = [
    form.name && !/^product\s+\d+$/i.test(form.name) ? form.name : '',
    form.category,
    form.primaryColor,
    form.pattern,
    form.fabric,
    form.occasion,
    form.tags,
    form.description,
  ];
  return { completed: values.filter((value) => String(value || '').trim()).length, total: values.length };
}

function confidenceHint(value) {
  const score = Number(value || 0);
  if (score >= 0.75) return 'High confidence';
  if (score >= 0.5) return 'Suggested';
  return 'Please check';
}

function toggleId(setter, id) {
  setter((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
}

function toggleValue(values, value) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function labelStatus(value = '') {
  return String(value).split('_').map((part) => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ');
}

function progressStepClass(status) {
  if (status === 'completed') return 'border-wine bg-wine text-white';
  if (status === 'running') return 'border-wine bg-white text-wine ring-4 ring-wine/10';
  if (status === 'failed') return 'border-rose-500 bg-rose-50 text-rose-700';
  if (status === 'cancelled') return 'border-slate-400 bg-slate-100 text-slate-600';
  return 'border-slate-200 bg-white text-slate-400';
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}

function formatDuration(value) {
  const seconds = Math.max(0, Number(value || 0));
  return `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
