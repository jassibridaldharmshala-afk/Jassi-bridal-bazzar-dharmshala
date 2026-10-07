import { memo, useCallback, useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, Clock3, Columns2, History, Laptop, ListFilter, PencilLine, Plus, Redo2, RotateCcw, Save, Search, Send, Settings, Smartphone, Trash2, Undo2, X } from 'lucide-react';
import PageHeader from '../../components/admin/PageHeader';
import StorefrontPreview from '../../components/admin/StorefrontPreview';
import api from '../../services/api';
import useUnsavedChanges from '../../hooks/useUnsavedChanges';
import { useWebsiteCustomization } from '../../context/WebsiteCustomizationContext';
import './StoreContent.css';

const copy = (value) => JSON.parse(JSON.stringify(value));
const keyOf = (value) => JSON.stringify(value || { sections: [], blocks: [] });
const EDITABLE = {
  sections: ['heading', 'description', 'buttonText', 'buttonLink', 'imageAlt'],
  blocks: ['eyebrow', 'title', 'body', 'buttonText', 'buttonLink', 'altText', 'items'],
};
const itemKey = (item, group) => JSON.stringify(Object.fromEntries(EDITABLE[group].map((field) => [field, item?.[field] || (field === 'items' ? [] : '')])));
const sectionFields = [
  ['heading', 'Section heading', 'sectionHeading', 'input'], ['description', 'Supporting description', 'sectionDescription', 'textarea'],
  ['buttonText', 'Button label', 'buttonText', 'input'], ['buttonLink', 'Button destination', 'buttonLink', 'input'],
  ['imageAlt', 'Image description', 'altText', 'input'],
];
const blockFields = [
  ['eyebrow', 'Eyebrow', 'blockEyebrow', 'input'], ['title', 'Block title', 'blockTitle', 'input'],
  ['body', 'Body copy', 'blockBody', 'textarea'], ['buttonText', 'Button label', 'buttonText', 'input'],
  ['buttonLink', 'Button destination', 'buttonLink', 'input'], ['altText', 'Image description', 'altText', 'input'],
];
const formatDate = (value) => {
  if (!value) return 'Not published yet';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Unknown date';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};
const storage = {
  read(key) { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } },
  write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Recovery is optional when browser storage is unavailable. */ } },
  remove(key) { try { localStorage.removeItem(key); } catch { /* Browser storage may be unavailable. */ } },
};
function sessionValue(key) { try { return sessionStorage.getItem(key) || ''; } catch { return ''; } }
function localDateTime(date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
function scheduleIso(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : '';
}
function mergeRecovery(server, recovered, base) {
  const result = copy(server); let conflicts = 0; let applied = 0;
  for (const group of ['sections', 'blocks']) {
    const localMap = new Map((recovered?.[group] || []).map((item) => [String(item.id), item]));
    const baseMap = new Map((base?.[group] || []).map((item) => [String(item.id), item]));
    const mergedRows = [];
    for (const current of result[group] || []) {
      const local = localMap.get(String(current.id)); const original = baseMap.get(String(current.id));
      if (!local) { mergedRows.push(current); continue; }
      const next = { ...current };
      for (const field of EDITABLE[group]) {
        const localChanged = !original || JSON.stringify(local[field] ?? '') !== JSON.stringify(original[field] ?? '');
        if (!localChanged) continue;
        if (original && JSON.stringify(current[field] ?? '') !== JSON.stringify(original[field] ?? '') && JSON.stringify(current[field] ?? '') !== JSON.stringify(local[field] ?? '')) conflicts += 1;
        next[field] = copy(local[field] ?? (field === 'items' ? [] : '')); applied += 1;
      }
      mergedRows.push(next);
    }
    result[group] = mergedRows;
  }
  return { content: result, conflicts, applied };
}
function applyPreviewContent(configInput, content) {
  const config = copy(configInput || {});
  const sections = new Map((content?.sections || []).map((item) => [String(item.id), item]));
  const blocks = new Map((content?.blocks || []).map((item) => [String(item.id), item]));
  for (const item of config.homepage?.sections || []) {
    const source = sections.get(String(item.id));
    if (source) EDITABLE.sections.forEach((field) => { item[field] = copy(source[field] ?? ''); });
  }
  for (const item of config.homepage?.blocks || []) {
    const source = blocks.get(String(item.id));
    if (source && source.type === item.type) EDITABLE.blocks.forEach((field) => { item[field] = copy(source[field] ?? (field === 'items' ? [] : '')); });
  }
  return config;
}

export default function StoreContent({ route = '' }) {
  const seller = route.startsWith('/seller');
  const endpoint = seller ? '/seller/content' : '/admin/store-content';
  const recoveryKey = `samira_content_studio_${seller ? sessionValue('samira_seller_store_id') || 'store' : 'admin'}`;
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState(null);
  const [savedDraft, setSavedDraft] = useState('');
  const [history, setHistory] = useState([]);
  const [historyMeta, setHistoryMeta] = useState({ page: 1, hasMore: false, total: 0 });
  const [historyError, setHistoryError] = useState('');
  const [historyQuery, setHistoryQuery] = useState('');
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState('');
  const [query, setQuery] = useState('');
  const [changedOnly, setChangedOnly] = useState(false);
  const [device, setDevice] = useState('desktop');
  const [compare, setCompare] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [review, setReview] = useState(null);
  const [publishNote, setPublishNote] = useState('');
  const [scheduleAt, setScheduleAt] = useState('');
  const [recovery, setRecovery] = useState(null);
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const lock = useRef(false);
  const { refresh } = useWebsiteCustomization();
  const dirty = Boolean(draft && keyOf(draft) !== savedDraft);
  const deferredDraft = useDeferredValue(draft);
  useUnsavedChanges(dirty, Boolean(busy));

  const historyUrl = useCallback((page = 1, value = '') => `${endpoint}/history?paged=1&page=${page}&limit=20${value ? `&q=${encodeURIComponent(value)}` : ''}`, [endpoint]);
  const normalizeHistory = (value) => Array.isArray(value) ? { items: value, pagination: { page: 1, hasMore: false, total: value.length } } : value;
  const load = useCallback(async () => {
    setBusy('load'); setMessage(null);
    try {
      const [contentResult, historyResult] = await Promise.allSettled([api.get(endpoint), api.get(historyUrl(), { silent: true })]);
      if (contentResult.status === 'rejected') throw contentResult.reason;
      const value = contentResult.value; setData(value);
      if (value.available) {
        setDraft(copy(value.draft)); setSavedDraft(keyOf(value.draft)); undoStack.current = []; redoStack.current = [];
        const stored = storage.read(recoveryKey);
        if (stored?.content && keyOf(stored.content) !== keyOf(value.draft)) setRecovery({ ...stored, stale: stored.revision !== String(value.revision) });
        else { setRecovery(null); storage.remove(recoveryKey); }
      }
      if (historyResult.status === 'fulfilled') {
        const result = normalizeHistory(historyResult.value); setHistory(result.items || []); setHistoryMeta(result.pagination || { page: 1, hasMore: false, total: result.items?.length || 0 }); setHistoryError('');
      } else { setHistory([]); setHistoryError(historyResult.reason?.message || 'Publish history could not be loaded.'); }
    } catch (error) { setMessage({ type: 'error', text: error.message || 'Content workspace could not be loaded.' }); }
    finally { setBusy(''); }
  }, [endpoint, historyUrl, recoveryKey]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!dirty || !draft || !data) return undefined;
    const timer = window.setTimeout(() => storage.write(recoveryKey, { revision: String(data.revision), baseContent: data.draft, content: draft, savedAt: new Date().toISOString() }), 700);
    return () => window.clearTimeout(timer);
  }, [data, dirty, draft, recoveryKey]);

  const commit = useCallback((builder) => {
    setDraft((current) => {
      const next = typeof builder === 'function' ? builder(current) : builder;
      if (!current || keyOf(next) === keyOf(current)) return current;
      undoStack.current = [...undoStack.current.slice(-29), copy(current)]; redoStack.current = [];
      return next;
    });
  }, []);
  const undo = () => { const previous = undoStack.current.pop(); if (!previous) return; redoStack.current = [...redoStack.current, copy(draft)]; setDraft(previous); };
  const redo = () => { const next = redoStack.current.pop(); if (!next) return; undoStack.current = [...undoStack.current, copy(draft)]; setDraft(next); };
  const changeItem = useCallback((group, id, field, value) => commit((current) => ({ ...current, [group]: current[group].map((item) => item.id === id ? { ...item, [field]: value } : item) })), [commit]);
  const resetItem = useCallback((group, id) => commit((current) => {
    const published = data?.published?.[group]?.find((item) => item.id === id); if (!published) return current;
    return { ...current, [group]: current[group].map((item) => item.id === id ? copy(published) : item) };
  }), [commit, data]);
  const revisionBody = () => data.scope === 'store' ? { expectedRevision: data.revision } : { revision: data.revision };
  const acceptServerState = (result, fallbackDraft) => {
    const nextDraft = result.draft || fallbackDraft;
    setData((current) => ({ ...current, revision: result.revision, updatedAt: result.updatedAt || current.updatedAt,
      ...(nextDraft ? { draft: copy(nextDraft) } : {}),
      ...(result.scheduledFor !== undefined ? { scheduledFor: result.scheduledFor, scheduledNote: result.scheduledNote || '', scheduledStatus: result.scheduledStatus || null, scheduledAttempts: result.scheduledAttempts || 0, scheduledError: result.scheduledError || '' } : {}) }));
    if (nextDraft) { setDraft(copy(nextDraft)); setSavedDraft(keyOf(nextDraft)); storage.remove(recoveryKey); setRecovery(null); }
  };
  const run = async (name, operation) => {
    if (lock.current) return null; lock.current = true; setBusy(name); setMessage(null);
    try { return await operation(); } catch (error) { setMessage({ type: 'error', text: error.message || 'The action could not be completed.' }); return null; }
    finally { lock.current = false; setBusy(''); }
  };
  const loadHistory = useCallback(async (page = 1, value = historyQuery, append = false) => {
    try {
      const result = normalizeHistory(await api.get(historyUrl(page, value), { silent: true }));
      setHistory((current) => append ? [...current, ...(result.items || [])] : (result.items || [])); setHistoryMeta(result.pagination || {}); setHistoryError('');
    } catch (error) { setHistoryError(error.message || 'Publish history could not be loaded.'); }
  }, [historyQuery, historyUrl]);
  const saveDraft = () => run('save', async () => {
    const result = await api.put(`${endpoint}/draft`, { ...revisionBody(), content: draft }); acceptServerState(result, result.draft || draft);
    setMessage({ type: data.scheduledFor ? 'warning' : 'success', text: data.scheduledFor ? 'Draft saved. The existing scheduled release is unchanged; review and replace its schedule when you want these edits included.' : 'Draft saved. Your live storefront has not changed.' }); return result;
  });
  const reviewChanges = () => run('review', async () => { const result = await api.post(`${endpoint}/preflight`, { ...revisionBody(), content: draft }); setReview(result); return result; });
  const publish = () => run('publish', async () => {
    const publishing = copy(draft); const result = await api.post(`${endpoint}/publish`, { ...revisionBody(), content: publishing, note: publishNote });
    acceptServerState(result, publishing); setData((current) => ({ ...current, published: publishing, publishedAt: result.publishedAt, lastVersion: result.version, scheduledFor: null, scheduledNote: '', scheduledStatus: null, scheduledError: '' }));
    setReview(null); setPublishNote(''); await refresh(); await loadHistory(1, historyQuery);
    setMessage({ type: 'success', text: result.scheduledDesignUpdated ? 'Content published. The pending Website Designer release now contains the same wording.' : 'Content published to the storefront.' }); return result;
  });
  const schedule = () => run('schedule', async () => {
    const scheduledFor = scheduleIso(scheduleAt);
    if (!scheduledFor) throw new Error('Choose a valid publish date and time.');
    const result = await api.post(`${endpoint}/schedule`, { ...revisionBody(), content: draft, note: publishNote, scheduledFor,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, replaceExisting: Boolean(data.scheduledFor) });
    acceptServerState(result, result.draft || draft); setReview(null); setScheduleAt('');
    setMessage({ type: 'success', text: `Content scheduled for ${formatDate(result.scheduledFor)}.` }); return result;
  });
  const cancelSchedule = () => run('schedule', async () => {
    const result = await api.delete(`${endpoint}/schedule`, revisionBody());
    setData((current) => ({ ...current, revision: result.revision, updatedAt: result.updatedAt, scheduledFor: null, scheduledNote: '', scheduledStatus: null, scheduledError: '' }));
    setMessage({ type: 'success', text: 'Scheduled content release cancelled.' }); return result;
  });
  const retrySchedule = () => run('schedule', async () => {
    const result = await api.post(`${endpoint}/schedule/retry`, revisionBody()); acceptServerState(result);
    setMessage({ type: 'success', text: 'Scheduled release queued for another attempt.' }); return result;
  });
  const restore = (item) => run('restore', async () => {
    const result = await api.post(`${endpoint}/history/${item._id}/restore`, revisionBody()); acceptServerState(result, result.draft); setHistoryOpen(false);
    setMessage({ type: 'success', text: result.message }); return result;
  });
  const recover = (replace = false) => {
    const merged = mergeRecovery(draft, recovery.content, replace ? null : recovery.baseContent);
    commit(merged.content); setRecovery(null);
    setMessage({ type: merged.conflicts ? 'warning' : 'success', text: merged.conflicts ? `${merged.applied} recovered fields were applied. ${merged.conflicts} server changes were replaced by your recovered values; review before saving.` : `${merged.applied} recovered field${merged.applied === 1 ? '' : 's'} applied. Review and save the draft.` });
  };

  const isChanged = useCallback((group, item) => itemKey(item, group) !== itemKey(data?.published?.[group]?.find((entry) => entry.id === item.id), group), [data]);
  const filterItem = useCallback((group, item) => {
    const text = group === 'sections' ? `${item.label} ${item.heading} ${item.description}` : `${item.type} ${item.title} ${item.body}`;
    return text.toLowerCase().includes(query.toLowerCase()) && (!changedOnly || isChanged(group, item));
  }, [changedOnly, isChanged, query]);
  const filteredSections = useMemo(() => (draft?.sections || []).filter((item) => filterItem('sections', item)), [draft, filterItem]);
  const filteredBlocks = useMemo(() => (draft?.blocks || []).filter((item) => filterItem('blocks', item)), [draft, filterItem]);
  const changedCount = useMemo(() => draft && data?.published ? ['sections', 'blocks'].reduce((total, group) => total + draft[group].filter((item) => isChanged(group, item)).length, 0) : 0, [data, draft, isChanged]);
  const previewConfig = useMemo(() => applyPreviewContent(data?.previewConfig, deferredDraft), [data?.previewConfig, deferredDraft]);

  if (!data) return <section className="space-y-5"><PageHeader title="Store content" note="Loading your content workspace…" /><div className="admin-card p-6">{message?.text ? <><p className="text-red-700">{message.text}</p><button type="button" className="admin-btn-ghost mt-4" onClick={load}>Retry</button></> : 'Loading content…'}</div></section>;
  if (!data.available) return <section className="space-y-5"><PageHeader title="Store content" note="Manage storefront wording without changing design." /><div className="admin-card p-8 text-center"><PencilLine className="mx-auto h-10 w-10 text-wine" /><h2 className="mt-4 font-display text-2xl font-bold">Publish your first website design</h2><p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">Content Studio becomes available after the storefront has an initial design.</p><a className="admin-btn mt-5 inline-flex" href={data.designerPath}>Open Website Designer</a></div></section>;
  const canWrite = data.capabilities?.write !== false;
  const canPublish = data.capabilities?.publish !== false;

  return <section className="content-studio space-y-5 pb-24">
    <PageHeader kicker={seller ? 'Seller workspace' : 'Admin'} title="Content Operations Studio" note="Write, review, schedule and restore storefront copy without changing layout, products or styling."><button type="button" className="admin-btn-ghost" onClick={() => setHistoryOpen(true)}><History size={16} /> History</button></PageHeader>
    {message && <div role="status" className={`content-notice content-notice--${message.type}`}>{message.type === 'error' || message.type === 'warning' ? <AlertTriangle /> : <Check />}{message.text}<button aria-label="Dismiss message" onClick={() => setMessage(null)}><X /></button></div>}
    {!canWrite && <div className="content-notice content-notice--info"><AlertTriangle /><span><strong>Read-only access</strong><small>Your store role can review content and history but cannot edit or publish it.</small></span></div>}
    {recovery && <div className="content-notice content-notice--warning"><Clock3 /><span><strong>{recovery.stale ? 'Unsaved edits from an older server version' : 'Recovered browser draft available'}</strong><small> Saved {formatDate(recovery.savedAt)}. Your copy is preserved until you choose.</small></span>{canWrite && <><button type="button" className="admin-btn-ghost" onClick={() => recover(false)}>{recovery.stale ? 'Merge my edits' : 'Restore'}</button>{recovery.stale && <button type="button" className="admin-btn-ghost" onClick={() => recover(true)}>Use recovered values</button>}</>}<button type="button" className="admin-btn-ghost" onClick={() => { storage.remove(recoveryKey); setRecovery(null); }}>Discard</button></div>}
    {data.scheduledFor && <div className={`content-schedule ${data.scheduledStatus === 'FAILED' ? 'is-failed' : ''}`}><div><strong>{data.scheduledStatus === 'FAILED' ? 'Scheduled release needs attention' : data.scheduledStatus === 'PROCESSING' ? 'Scheduled release is publishing' : 'Scheduled content release'}</strong><span>{formatDate(data.scheduledFor)}{data.scheduledNote ? ` · ${data.scheduledNote}` : ''}{data.scheduledError ? ` · ${data.scheduledError}` : ''}</span></div>{canPublish && <div>{data.scheduledStatus === 'FAILED' && <button type="button" className="admin-btn-ghost" disabled={Boolean(busy)} onClick={retrySchedule}>Retry release</button>}<button type="button" className="admin-btn-ghost" disabled={Boolean(busy) || data.scheduledStatus === 'PROCESSING'} onClick={cancelSchedule}>Cancel schedule</button></div>}</div>}
    {data.scheduledDesignFor && <div className="content-notice content-notice--info"><AlertTriangle /><span>A Website Designer release is scheduled for {formatDate(data.scheduledDesignFor)}. Content publishing will patch that release with the same wording.</span></div>}
    <div className="content-toolbar admin-card"><label><Search size={17} /><input aria-label="Search content sections" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search sections and custom blocks" /></label><div className="content-toolbar__actions"><button type="button" aria-label="Undo" title="Undo" disabled={!undoStack.current.length || Boolean(busy)} onClick={undo}><Undo2 /></button><button type="button" aria-label="Redo" title="Redo" disabled={!redoStack.current.length || Boolean(busy)} onClick={redo}><Redo2 /></button><button type="button" aria-pressed={changedOnly} className={changedOnly ? 'active' : ''} onClick={() => setChangedOnly((value) => !value)}><ListFilter /> Changed only</button><button type="button" aria-pressed={compare} className={compare ? 'active' : ''} onClick={() => setCompare((value) => !value)}><Columns2 /> Compare</button></div></div>
    <div className="content-grid"><main className="space-y-4">
      <section className="admin-card content-overview"><div><p className="admin-kicker">Content status</p><h2>{dirty ? 'Draft has unsaved changes' : changedCount ? `${changedCount} area${changedCount === 1 ? '' : 's'} ready to publish` : 'Content is up to date'}</h2><p>Last published {formatDate(data.publishedAt)}{data.publishedBy ? ` by ${data.publishedBy}` : ''}</p></div><div className="content-score"><strong>{(draft.sections?.length || 0) + (draft.blocks?.length || 0)}</strong><span>editable areas</span></div></section>
      <section className="admin-card content-managed"><div className="content-section-title"><div><p className="admin-kicker">Managed outside Content Studio</p><h2>Identity, contact and announcement</h2><p>Each value shows the source currently used by the storefront.</p></div><a href={data.managed.settingsPath}><Settings /> Edit in Settings</a></div><div className="content-managed__grid">{data.managed.groups.map((group) => <details key={group.id}><summary>{group.label}<span>{group.source || (group.enabled ? 'Settings override' : 'Website Designer')}</span><ChevronDown /></summary><div>{group.fields.map((field) => <label key={field.label}>{field.label}<input value={field.value || ''} readOnly /></label>)}</div></details>)}</div></section>
      <ContentGroup title="Core sections" kicker="Homepage" shown={filteredSections.length}>{filteredSections.map((item) => <ContentCard key={item.id} item={item} group="sections" fields={sectionFields} limits={data.limits} live={data.published.sections.find((entry) => entry.id === item.id)} compare={compare} busy={busy || !canWrite} onChange={changeItem} onReset={resetItem} />)}</ContentGroup>
      {draft.blocks.length > 0 ? <ContentGroup title="Custom block copy" kicker="Website Designer blocks" shown={filteredBlocks.length}>{filteredBlocks.map((item) => <ContentCard key={item.id} item={item} group="blocks" fields={blockFields} limits={data.limits} live={data.published.blocks.find((entry) => entry.id === item.id)} compare={compare} busy={busy || !canWrite} onChange={changeItem} onReset={resetItem} />)}</ContentGroup> : <div className="admin-card content-empty-blocks"><PencilLine /><div><strong>No custom blocks yet</strong><p>Add FAQ, trust, campaign or editorial blocks in Website Designer, then manage their wording here.</p></div><a className="admin-btn-ghost" href={data.designerPath}>Open Website Designer</a></div>}
      {!filteredSections.length && !filteredBlocks.length && <div className="admin-card p-8 text-center"><ListFilter className="mx-auto text-wine" /><h2 className="mt-3 font-bold">No matching content</h2><button type="button" className="mt-3 text-sm font-bold text-wine" onClick={() => { setQuery(''); setChangedOnly(false); }}>Clear filters</button></div>}
    </main><aside className="content-preview admin-card"><div className="content-preview__header"><div><p className="admin-kicker">Real storefront preview</p><h2>{device === 'mobile' ? 'Mobile' : 'Desktop'}</h2></div><div><button type="button" aria-label="Desktop preview" className={device === 'desktop' ? 'active' : ''} onClick={() => setDevice('desktop')}><Laptop /></button><button type="button" aria-label="Mobile preview" className={device === 'mobile' ? 'active' : ''} onClick={() => setDevice('mobile')}><Smartphone /></button></div></div><StorefrontPreview config={previewConfig} device={device} valid={Boolean(previewConfig?.homepage)} /></aside></div>
    <div className="content-savebar"><div><strong>{dirty ? 'Browser recovery active' : changedCount ? `${changedCount} areas differ from live` : 'All changes saved'}</strong><span>{canWrite ? (dirty ? 'Save the draft or review before publishing.' : 'Draft and server are in sync.') : 'Your role has read-only content access.'}</span></div><div><button type="button" className="admin-btn-ghost" disabled={!canWrite || Boolean(busy) || !dirty} onClick={saveDraft}><Save />{busy === 'save' ? 'Saving…' : 'Save draft'}</button><button type="button" className="admin-btn-ghost" disabled={Boolean(busy)} onClick={reviewChanges}><Check />{busy === 'review' ? 'Reviewing…' : 'Review'}</button><button type="button" className="admin-btn" disabled={!canPublish || Boolean(busy) || (!dirty && !changedCount)} onClick={reviewChanges}><Send />Publish</button></div></div>
    {review && <ReviewDialog review={review} note={publishNote} setNote={setPublishNote} scheduleAt={scheduleAt} setScheduleAt={setScheduleAt} limits={data.limits} busy={busy} timezone={data.timezone} canPublish={canPublish} replacing={Boolean(data.scheduledFor)} onClose={() => setReview(null)} onPublish={publish} onSchedule={schedule} />}
    {historyOpen && <HistoryDrawer history={history} meta={historyMeta} error={historyError} query={historyQuery} setQuery={setHistoryQuery} busy={busy} canRestore={canWrite} onSearch={() => loadHistory(1, historyQuery)} onMore={() => loadHistory((historyMeta.page || 1) + 1, historyQuery, true)} onClose={() => setHistoryOpen(false)} onRestore={restore} />}
  </section>;
}

function ContentGroup({ title, kicker, shown, children }) { return <section className="space-y-3"><div className="content-list-heading"><div><p className="admin-kicker">{kicker}</p><h2>{title}</h2></div><span>{shown} shown</span></div>{children}</section>; }
const ContentCard = memo(function ContentCard({ item, group, fields, limits, live, compare, busy, onChange, onReset }) {
  const changed = itemKey(item, group) !== itemKey(live, group);
  const [open, setOpen] = useState(item.id === 'hero');
  const panelId = `content-panel-${String(item.id).replace(/[^a-z0-9_-]/gi, '')}`;
  const items = item.items || [];
  const updateItem = (index, value) => onChange(group, item.id, 'items', items.map((entry, itemIndex) => itemIndex === index ? value : entry));
  const removeItem = (index) => onChange(group, item.id, 'items', items.filter((_, itemIndex) => itemIndex !== index));
  return <article className={`admin-card content-card ${changed ? 'is-changed' : ''}`}>
    <button type="button" className="content-card__summary" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((value) => !value)}>
      <span><span className="content-card__icon"><PencilLine /></span><span><strong>{item.label || humanize(item.type)}</strong><small>{item.visible === false ? 'Hidden in Website Designer' : changed ? 'Changed from published' : group === 'blocks' ? `${humanize(item.type)} block` : 'Matches published'}</small></span></span>
      <span>{changed && <span className="content-pill">Edited</span>}<ChevronDown /></span>
    </button>
    {open && <fieldset id={panelId} disabled={Boolean(busy)}>
      <div className={compare ? 'content-fields content-fields--compare' : 'content-fields'}>
        {fields.filter(([field]) => (field !== 'imageAlt' && field !== 'altText') || item.hasImage).map(([field, label, limitKey, kind]) => <ContentField key={field} field={field} label={label} kind={kind} value={item[field] || ''} liveValue={live?.[field] || ''} compare={compare} limit={limits[limitKey]} onChange={(value) => onChange(group, item.id, field, value)} />)}
        {group === 'blocks' && items.map((value, index) => item.type === 'faq'
          ? <FaqItem key={`item-${index}`} index={index} value={value} liveValue={live?.items?.[index] || ''} compare={compare} limit={limits.item} onChange={(next) => updateItem(index, next)} onRemove={() => removeItem(index)} />
          : <TextItem key={`item-${index}`} index={index} value={value} liveValue={live?.items?.[index] || ''} compare={compare} limit={limits.item} onChange={(next) => updateItem(index, next)} onRemove={() => removeItem(index)} />)}
      </div>
      {group === 'blocks' && <div className="content-item-actions"><button type="button" className="admin-btn-ghost" disabled={items.length >= limits.items} onClick={() => onChange(group, item.id, 'items', [...items, item.type === 'faq' ? 'Question|Answer' : 'New item'])}><Plus /> Add {item.type === 'faq' ? 'FAQ' : 'item'}</button><small>{items.length}/{limits.items} items</small></div>}
      <button type="button" className="content-reset" disabled={!changed} onClick={() => onReset(group, item.id)}><RotateCcw /> Reset this section to published</button>
    </fieldset>}
  </article>;
});
function FaqItem({ index, value, liveValue, compare, limit, onChange, onRemove }) {
  const split = (input) => { const at = String(input || '').indexOf('|'); return at < 0 ? [String(input || ''), ''] : [String(input).slice(0, at), String(input).slice(at + 1)]; };
  const [question, answer] = split(value);
  const [liveQuestion, liveAnswer] = split(liveValue);
  const questionLimit = Math.max(0, limit - answer.length - 1);
  const answerLimit = Math.max(0, limit - question.length - 1);
  return <div className="content-item-row content-item-row--faq"><div className="content-faq-fields"><ContentField field={`faq-question-${index}`} label={`FAQ question ${index + 1}`} kind="input" value={question} liveValue={liveQuestion} compare={compare} limit={questionLimit} onChange={(next) => onChange(`${next}|${answer}`)} /><ContentField field={`faq-answer-${index}`} label={`FAQ answer ${index + 1}`} kind="textarea" value={answer} liveValue={liveAnswer} compare={compare} limit={answerLimit} onChange={(next) => onChange(`${question}|${next}`)} /></div><button type="button" aria-label={`Remove FAQ item ${index + 1}`} title="Remove FAQ" onClick={onRemove}><Trash2 /></button></div>;
}
function TextItem({ index, value, liveValue, compare, limit, onChange, onRemove }) {
  return <div className="content-item-row"><ContentField field={`item-${index}`} label={`List item ${index + 1}`} kind="input" value={value} liveValue={liveValue} compare={compare} limit={limit} onChange={onChange} /><button type="button" aria-label={`Remove list item ${index + 1}`} title="Remove item" onClick={onRemove}><Trash2 /></button></div>;
}
function ContentField({ field, label, kind, value, liveValue, compare, limit, onChange }) {
  const id = useId();
  const input = kind === 'textarea' ? <textarea id={id} aria-label={label} rows={3} value={value} maxLength={limit} onChange={(event) => onChange(event.target.value)} /> : <input id={id} aria-label={label} type="text" value={value} maxLength={limit} onChange={(event) => onChange(event.target.value)} placeholder={field === 'buttonLink' ? '/products' : ''} />;
  return <div className="content-field"><label htmlFor={id}>{label}<span aria-hidden="true">{value.length}/{limit}</span></label>{compare && <div className="content-published"><small>Published</small><p>{Array.isArray(liveValue) ? liveValue.join(' · ') : liveValue || 'Empty'}</p></div>}{input}{field === 'buttonLink' && <small>Use a store path such as /products or /contact.</small>}</div>;
}
function useDialog(onClose) {
  const panel = useRef(null); const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement; const node = panel.current;
    const focusable = () => [...(node?.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href]') || [])];
    focusable()[0]?.focus();
    const keydown = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); close.current(); return; }
      if (event.key !== 'Tab') return;
      const rows = focusable(); if (!rows.length) return;
      const first = rows[0]; const last = rows[rows.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown); return () => { document.removeEventListener('keydown', keydown); previous?.focus?.(); };
  }, []);
  return panel;
}
function ReviewDialog({ review, note, setNote, scheduleAt, setScheduleAt, limits, busy, timezone, canPublish, replacing, onClose, onPublish, onSchedule }) {
  const panel = useDialog(onClose);
  return <div className="content-modal" role="dialog" aria-modal="true" aria-labelledby="content-review-title"><div ref={panel} className="content-modal__panel" tabIndex="-1"><header><div><p className="admin-kicker">Publish review</p><h2 id="content-review-title">Review storefront changes</h2><p>{review.changes.length} field{review.changes.length === 1 ? '' : 's'} will change.</p></div><button type="button" aria-label="Close review" onClick={onClose}><X /></button></header>{review.scheduledDesignUpdated && <div className="content-notice content-notice--info"><AlertTriangle />The pending Website Designer release will receive this same content patch.</div>}{replacing && <div className="content-notice content-notice--warning"><AlertTriangle />An existing content release is scheduled. Publish now will cancel it; choosing a new time and Replace schedule will update it.</div>}{(review.blocking || []).map((issue) => <div key={issue} className="content-notice content-notice--error"><AlertTriangle />{issue}</div>)}{review.warnings.map((warning) => <div key={warning} className="content-notice content-notice--warning"><AlertTriangle />{warning}</div>)}<div className="content-change-list">{review.changes.length ? review.changes.slice(0, 50).map((change) => <article key={change.path}><strong>{humanize(change.path.replaceAll('.', ' / '))}</strong><span title={`${change.before || 'Empty'} → ${change.after || 'Empty'}`}>{change.before || 'Empty'} → {change.after || 'Empty'}</span></article>) : <p>No live wording changes were detected.</p>}</div><label className="content-dialog-field">Publish note <span>{note.length}/{limits.note}</span><input value={note} maxLength={limits.note} onChange={(event) => setNote(event.target.value)} placeholder="What changed in this release?" /></label><label className="content-dialog-field">Schedule for later <small>Times are entered on this device and saved as an exact instant. Store timezone: {timezone || 'Asia/Kolkata'}.</small><input type="datetime-local" value={scheduleAt} min={localDateTime(new Date(Date.now() + 60000))} onChange={(event) => setScheduleAt(event.target.value)} /></label><footer><button type="button" className="admin-btn-ghost" onClick={onClose}>Keep editing</button><button type="button" className="admin-btn-ghost" disabled={!canPublish || !review.ready || !scheduleAt || Boolean(busy)} onClick={onSchedule}><Clock3 />{replacing ? 'Replace schedule' : 'Schedule'}</button><button type="button" className="admin-btn" disabled={!canPublish || !review.ready || !review.changes.length || Boolean(busy)} onClick={onPublish}><Send />{busy === 'publish' ? 'Publishing…' : 'Publish now'}</button></footer></div></div>;
}
function HistoryDrawer({ history, meta, error, query, setQuery, busy, canRestore, onSearch, onMore, onClose, onRestore }) {
  const panel = useDialog(onClose);
  return <div className="content-modal" role="dialog" aria-modal="true" aria-labelledby="content-history-title"><div ref={panel} className="content-modal__panel content-modal__panel--history" tabIndex="-1"><header><div><p className="admin-kicker">Content-only versions</p><h2 id="content-history-title">Publish history</h2><p>Restore wording to draft without rolling back layout or products.</p></div><button type="button" aria-label="Close history" onClick={onClose}><X /></button></header><form className="content-history-search" onSubmit={(event) => { event.preventDefault(); onSearch(); }}><Search /><input aria-label="Search publish notes" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search release notes" /><button type="submit" className="admin-btn-ghost">Search</button></form>{error && <div className="content-notice content-notice--error"><AlertTriangle />{error}<button type="button" className="admin-btn-ghost" onClick={onSearch}>Retry</button></div>}<div className="content-history">{history.length ? history.map((item) => <article key={item._id}><div><div className="content-history__title"><strong>Version {item.version}</strong><span>{humanize(item.kind || 'publish')}</span></div><span>{formatDate(item.createdAt)} · {item.publishedByName}</span><p>{item.note || 'Content published'}</p><details><summary>{item.changes?.length || 0} changed fields</summary><ul>{(item.changes || []).slice(0, 20).map((change) => <li key={change.path}><strong>{humanize(change.path)}</strong><span>{change.before || 'Empty'} → {change.after || 'Empty'}</span></li>)}</ul></details></div>{canRestore && <button type="button" className="admin-btn-ghost" disabled={Boolean(busy)} onClick={() => onRestore(item)}><RotateCcw />Restore to draft</button>}</article>) : !error && <p className="p-5 text-sm text-slate-500">No matching published versions.</p>}{meta.hasMore && <button type="button" className="admin-btn-ghost content-history__more" onClick={onMore}>Load older versions</button>}</div></div></div>;
}
function humanize(value) { return String(value || '').replace(/[-_.]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (letter) => letter.toUpperCase()); }
