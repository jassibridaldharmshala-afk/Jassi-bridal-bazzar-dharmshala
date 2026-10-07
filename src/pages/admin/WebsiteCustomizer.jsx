import { lazy, Suspense, memo, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Copy, Download, History, Monitor, Palette, Plus, Redo2, RotateCcw, Save, Smartphone, Tablet, Trash2, Undo2, UploadCloud } from 'lucide-react';
import PageHeader from '../../components/admin/PageHeader';
import ImageUploader from '../../components/admin/ImageUploader';
import DeferredMount from '../../components/ui/DeferredMount';
import LazyBoundary from '../../components/ui/LazyBoundary';
import api from '../../services/api';
import { mergeWebsiteConfig, WEBSITE_BLOCK_TYPES } from '../../config/websiteCustomization';
import { applyAppearancePreset, changedConfigGroups, exportThemeFile, parseThemeFile, validateDesignerConfig } from '../../config/websiteDesigner';
import { useWebsiteCustomization } from '../../context/WebsiteCustomizationContext';
import { SETTINGS_STORAGE_KEY } from '../../config/storeSettings';
import { designerReducer, initialDesignerState } from '../../config/websiteDesignerState';
import { BEFORE_ROUTE_CHANGE_EVENT } from '../../utils/routing';
import { DesignerControlSearch, PresetGallery, QuickStylePanel, ReadabilityReview } from '../../components/admin/WebsiteDesignerTools';
import { DESIGNER_CONTROLS, matchMobileAppearance, reorderDesignerItems, restoreDesignerPanel } from '../../config/websiteDesignerTools';
import WorkflowSmartFill from '../../components/admin/WorkflowSmartFill';

const StorefrontPreview = lazy(() => import('../../components/admin/StorefrontPreview'));
const editorTabs = DESIGNER_CONTROLS.map(({ id, label }) => [id, label]);
const MOBILE_SECTION_LABELS = {
  recentlyViewed: 'Recently Viewed',
  recommended: 'Recommended Products',
};

export default function WebsiteCustomizer({ mode = 'admin' }) {
  const sellerMode = mode === 'seller';
  const { refresh: refreshPublishedConfig } = useWebsiteCustomization();
  const [workspace, setWorkspace] = useState({ themes: [], presets: [] });
  const [selectedTheme, setSelectedTheme] = useState(null);
  const [{ draft, undoStack, redoStack }, dispatchDraft] = useReducer(designerReducer, initialDesignerState);
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('presets');
  const [device, setDevice] = useState(previewDeviceForViewport);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [newThemeName, setNewThemeName] = useState('');
  const [newPreset, setNewPreset] = useState('default');
  const [catalog, setCatalog] = useState([]);
  const [categories, setCategories] = useState([]);
  const [catalogWarning, setCatalogWarning] = useState('');
  const [catalogStatus, setCatalogStatus] = useState('idle');
  const catalogRequest = useRef(false);
  const catalogSearchRequest = useRef(0);
  const mounted = useRef(false);
  const [historyWarning, setHistoryWarning] = useState('');
  const [publishReview, setPublishReview] = useState(false);
  const [publishNote, setPublishNote] = useState('');
  const [publishAt, setPublishAt] = useState('');
  const [preflight, setPreflight] = useState(null);
  const [recovery, setRecovery] = useState(null);
  const [autosaveStatus, setAutosaveStatus] = useState('');
  const [previewOpen, setPreviewOpen] = useState(true);
  const [compareSaved, setCompareSaved] = useState(false);
  const lock = useRef(false);
  const autosaveRequest = useRef(0);
  const liveDraftFingerprint = useRef('');
  const requestId = useRef(0);
  const savedName = useRef('');
  const historyRequest = useRef(0);
  const importInput = useRef(null);
  const savedConfig = useMemo(() => mergeWebsiteConfig(selectedTheme?.draftConfig), [selectedTheme?.draftConfig]);
  const savedFingerprint = useMemo(() => JSON.stringify(savedConfig), [savedConfig]);
  const draftFingerprint = useMemo(() => JSON.stringify(draft), [draft]);
  const dirty = !!draft && (selectedTheme?.name !== savedName.current || draftFingerprint !== savedFingerprint);
  liveDraftFingerprint.current = draftFingerprint;
  const issues = useMemo(() => draft ? validateDesignerConfig(draft) : [], [draft]);
  const changedGroups = useMemo(() => publishReview && draft ? changedConfigGroups(draft, selectedTheme?.publishedConfig) : [], [publishReview, draft, selectedTheme?.publishedConfig]);

  const acceptTheme = useCallback((theme) => {
    setSelectedTheme(theme);
    savedName.current = theme.name;
    dispatchDraft({ type: 'reset', draft: mergeWebsiteConfig(theme.draftConfig) });
    setCompareSaved(false);
    setPublishReview(false);
    setPreflight(null);
  }, []);

  const recoveryKey = useCallback((theme) => `storefront-designer-recovery:${sellerMode ? `store:${workspace.store?.id || 'current'}` : `theme:${theme?._id || 'current'}`}`, [sellerMode, workspace.store?.id]);
  const clearRecovery = useCallback((theme = selectedTheme) => {
    try { localStorage.removeItem(recoveryKey(theme)); } catch { /* browser storage can be unavailable */ }
    setRecovery(null);
  }, [recoveryKey, selectedTheme]);

  const loadHistory = useCallback(async (id) => {
    const sequence = ++historyRequest.current;
    setHistoryWarning(''); setHistory([]);
    try {
      const versions = await api.get(sellerMode ? '/seller/design/history' : `/admin/customization/themes/${id}/history?summary=true`);
      if (mounted.current && sequence === historyRequest.current) setHistory(versions);
    } catch {
      if (mounted.current && sequence === historyRequest.current) {
        setHistory([]); setHistoryWarning('Version history could not be loaded. Reload the theme to try again.');
      }
    }
  }, [sellerMode]);

  const loadWorkspace = useCallback(async (preferredId) => {
    const sequence = ++requestId.current;
    setLoading(true);
    try {
      const data = await api.get(sellerMode ? '/seller/design' : '/admin/customization');
      const sellerTheme = sellerMode ? sellerThemeFromData(data) : null;
      const normalizedData = sellerMode ? { ...data, selectedTheme: sellerTheme, themes: [sellerTheme], configurationLocked: false } : data;
      const target = preferredId || normalizedData.selectedTheme?._id || normalizedData.themes?.[0]?._id;
      if (!target) throw new Error('No theme was returned. Please retry.');
      const theme = normalizedData.selectedTheme?._id === target ? normalizedData.selectedTheme : await api.get(`/admin/customization/themes/${target}`);
      if (sequence !== requestId.current) return;
      setWorkspace(normalizedData); acceptTheme(theme);
      try {
        const stored = JSON.parse(localStorage.getItem(`storefront-designer-recovery:${sellerMode ? `store:${data.store?.id || 'current'}` : `theme:${theme._id}`}`) || 'null');
        setRecovery(stored?.config && stored.baseRevision === Number(theme.revision || 0) ? stored : null);
      } catch { setRecovery(null); }
      // The editor is usable immediately; history must not hold the page loader.
      loadHistory(target);

    } catch (error) { if (sequence === requestId.current) setMessage(error.message); }
    finally { if (sequence === requestId.current) setLoading(false); }
  }, [acceptTheme, loadHistory, sellerMode]);

  useEffect(() => { mounted.current = true; loadWorkspace(); return () => { mounted.current = false; requestId.current += 1; }; }, [loadWorkspace]);
  const loadCatalog = useCallback(async () => {
    if (catalogRequest.current) return;
    catalogRequest.current = true; setCatalogStatus('loading'); setCatalogWarning('');
    try {
      const prefix = sellerMode ? '/seller' : '/admin';
      const [productResult, categoryResult] = await Promise.allSettled([api.get(`${prefix}/products?customizationOptions=true&optionLimit=250`), api.get(`${prefix}/categories`)]);
      if (!mounted.current) return;
      const products = productResult.status === 'fulfilled' ? productResult.value : [];
      const categoryData = categoryResult.status === 'fulfilled' ? categoryResult.value : [];
      setCatalog(Array.isArray(products) ? products : products?.products || products?.items || []);
      setCategories(Array.isArray(categoryData) ? categoryData : categoryData?.categories || categoryData?.items || []);
      const failed = productResult.status === 'rejected' || categoryResult.status === 'rejected';
      setCatalogStatus(failed ? 'error' : 'loaded');
      setCatalogWarning(failed ? 'Some catalog data could not be loaded. Existing selections are preserved.' : '');
    } finally { catalogRequest.current = false; }
  }, [sellerMode]);
  const searchProducts = useCallback(async (term) => {
    const query = String(term || '').trim();
    if (query.length < 2) return;
    const sequence = ++catalogSearchRequest.current;
    try {
      const prefix = sellerMode ? '/seller' : '/admin';
      const data = await api.get(`${prefix}/products?customizationOptions=true&optionLimit=100&search=${encodeURIComponent(query)}`);
      if (!mounted.current || sequence !== catalogSearchRequest.current) return;
      const incoming = Array.isArray(data) ? data : data?.products || data?.items || [];
      setCatalog((current) => {
        const map = new Map(current.map((item) => [String(item._id || item.id || item.slug), item]));
        incoming.forEach((item) => map.set(String(item._id || item.id || item.slug), item));
        return [...map.values()];
      });
    } catch { /* Keep already loaded choices; the normal catalog warning handles initial failures. */ }
  }, [sellerMode]);
  useEffect(() => { if (['homepage', 'blocks'].includes(activeTab) && catalogStatus === 'idle') loadCatalog(); }, [activeTab, catalogStatus, loadCatalog]);
  useEffect(() => {
    if (!dirty && !busy) return undefined;
    const unload = (event) => { event.preventDefault(); event.returnValue = ''; };
    const navigateAway = (event) => {
      if (busy || !window.confirm('Leave Website Designer? Unsaved changes will be lost.')) event.preventDefault();
    };
    const leave = (event) => {
      const link = event.target.closest?.('a[href]');
      if (!link || link.target === '_blank' || link.hasAttribute('download') || /^[/#]/.test(link.getAttribute('href') || '')) return;
      if (busy || !window.confirm('Leave Website Designer? Unsaved changes will be lost.')) {
        event.preventDefault(); event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', unload);
    window.addEventListener(BEFORE_ROUTE_CHANGE_EVENT, navigateAway);
    document.addEventListener('click', leave, true);
    return () => { window.removeEventListener('beforeunload', unload); window.removeEventListener(BEFORE_ROUTE_CHANGE_EVENT, navigateAway); document.removeEventListener('click', leave, true); };
  }, [dirty, busy]);
  useEffect(() => {
    if (!dirty || !draft || issues.length || !selectedTheme?._id) return undefined;
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(recoveryKey(selectedTheme), JSON.stringify({
          config: draft, name: selectedTheme.name, baseRevision: Number(selectedTheme.revision || 0), savedAt: new Date().toISOString(),
        }));
      } catch { /* private browsing or storage quota can disable recovery */ }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [dirty, draft, issues.length, recoveryKey, selectedTheme]);
  useEffect(() => {
    if (!dirty || !draft || issues.length || busy || !selectedTheme?._id) return undefined;
    const snapshot = draft;
    const snapshotFingerprint = draftFingerprint;
    const snapshotName = selectedTheme.name;
    const snapshotRevision = selectedTheme.revision;
    const snapshotUpdatedAt = selectedTheme.updatedAt;
    const sequence = ++autosaveRequest.current;
    const timer = window.setTimeout(async () => {
      if (lock.current || !mounted.current || sequence !== autosaveRequest.current) return;
      lock.current = true; setAutosaveStatus('Saving recovery…');
      try {
        const result = await api.put(sellerMode ? '/seller/design' : `/admin/customization/themes/${selectedTheme._id}/draft`, sellerMode
          ? { config: snapshot, preset: snapshot.theme.preset, expectedRevision: snapshotRevision }
          : { name: snapshotName, config: snapshot, expectedUpdatedAt: snapshotUpdatedAt });
        if (!mounted.current) return;
        const saved = sellerMode
          ? { draftConfig: result.draftConfig, updatedAt: result.updatedAt, revision: result.revision }
          : { draftConfig: result.draftConfig, updatedAt: result.updatedAt, name: result.name };
        savedName.current = snapshotName;
        if (liveDraftFingerprint.current === snapshotFingerprint) {
          acceptTheme({ ...selectedTheme, ...saved, name: snapshotName }); clearRecovery();
        } else {
          setSelectedTheme((current) => ({ ...current, ...saved }));
        }
        setAutosaveStatus(`Recovered on server ${new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' }).format(new Date())}`);
      } catch (error) {
        if (mounted.current) setAutosaveStatus(error?.status === 409 ? 'Autosave paused: reload before saving over a newer version.' : 'Browser recovery active; server autosave will retry after your next edit.');
      } finally { lock.current = false; }
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [acceptTheme, busy, clearRecovery, dirty, draft, draftFingerprint, issues.length, selectedTheme, sellerMode]);

  const run = async (label, action) => {
    if (lock.current) { setMessage('A draft save is already in progress. Please retry in a moment.'); return; }
    lock.current = true; setBusy(label); setMessage('');
    try { await action(); } catch (error) { setMessage(error.message || 'Unable to complete this action. Your draft is still in the editor.'); }
    finally { lock.current = false; setBusy(''); }
  };
  const confirmLeave = () => !dirty || window.confirm('Discard unsaved editor changes and switch themes? Save or export first to keep them.');
  const reloadThemeList = async () => {
    if (sellerMode) return;
    try { const themes = await api.get('/admin/customization/themes'); setWorkspace((current) => ({ ...current, themes })); }
    catch { setMessage((current) => `${current} Theme list could not refresh; reload when connected.`.trim()); }
  };
  const selectTheme = (id) => {
    if (!confirmLeave()) return;
    run('loading-theme', async () => {
      acceptTheme(await api.get(`/admin/customization/themes/${id}`));
      loadHistory(id);
    });
  };
  const replaceDraft = useCallback((next) => {
    dispatchDraft({ type: 'replace', draft: next });
    setCompareSaved(false);
    setMessage(''); setPublishReview(false); setPreflight(null);
  }, []);
  const updateDraft = useCallback((path, value) => {
    dispatchDraft({ type: 'edit', path, value, time: Date.now() });
    setCompareSaved(false);
    setMessage(''); setPublishReview(false); setPreflight(null);
  }, []);
  const undo = () => { dispatchDraft({ type: 'undo' }); setPublishReview(false); setPreflight(null); setCompareSaved(false); };
  const redo = () => { dispatchDraft({ type: 'redo' }); setPublishReview(false); setPreflight(null); setCompareSaved(false); };
  const updateSection = useCallback((id, field, value) => {
    dispatchDraft({ type: 'section', id, field, value, time: Date.now() });
    setCompareSaved(false);
    setMessage(''); setPublishReview(false); setPreflight(null);
  }, []);
  const moveSection = useCallback((id, direction) => {
    dispatchDraft({ type: 'move-section', id, direction });
    setCompareSaved(false);
    setMessage(''); setPublishReview(false); setPreflight(null);
  }, []);
  const persistDraft = async () => {
    if (issues.length) throw new Error(issues[0]);
    if (!selectedTheme.name.trim()) throw new Error('Enter a theme name.');
    const result = await api.put(sellerMode ? '/seller/design' : `/admin/customization/themes/${selectedTheme._id}/draft`, sellerMode
      ? { config: draft, preset: draft.theme.preset, expectedRevision: selectedTheme.revision }
      : { name: selectedTheme.name, config: draft, expectedUpdatedAt: selectedTheme.updatedAt });
    const theme = sellerMode ? { ...selectedTheme, draftConfig: result.draftConfig, updatedAt: result.updatedAt, revision: result.revision } : result;
    acceptTheme(theme);
    clearRecovery(theme);
    return theme;
  };
  const saveDraft = () => run('save', async () => {
    await persistDraft(); setMessage('Draft saved. Your live storefront has not changed.'); await reloadThemeList();
  });
  const reviewPublish = () => run('preflight', async () => {
    const result = await api.post(sellerMode ? '/seller/design/preflight' : `/admin/customization/themes/${selectedTheme._id}/preflight`, {
      config: draft, ...(sellerMode ? {} : { expectedUpdatedAt: selectedTheme.updatedAt }),
    });
    setPreflight(result); setPublishReview(true);
  });
  const publish = () => run('publish', async () => {
    const saved = await persistDraft();
    const result = await api.post(sellerMode ? '/seller/design/publish' : `/admin/customization/themes/${saved._id}/publish`, sellerMode
      ? { note: publishNote.trim() || 'Published from Store Designer', expectedRevision: saved.revision }
      : { note: publishNote.trim() || 'Published from Website Designer', expectedUpdatedAt: saved.updatedAt });
    const theme = sellerMode ? { ...saved, draftConfig: result.config, publishedConfig: result.config, isActive: true, publishedAt: result.publishedAt, updatedAt: result.publishedAt, revision: result.revision } : result.theme;
    acceptTheme(theme); setPublishNote(''); setPreflight(result.preflight || preflight);
    setMessage(`Published successfully as version ${result.version.version}.`);
    await Promise.all([reloadThemeList(), loadHistory(saved._id), refreshPublishedConfig({ force: true })]);
    try { localStorage.setItem(SETTINGS_STORAGE_KEY, String(Date.now())); } catch { /* Current tab is already refreshed. */ }
  });
  const schedulePublish = () => run('schedule', async () => {
    const scheduledFor = fromLocalDateTime(publishAt);
    if (!scheduledFor || new Date(scheduledFor).getTime() < Date.now() + 60000) throw new Error('Choose a publish time at least 1 minute in the future.');
    const saved = await persistDraft();
    const result = await api.post(sellerMode ? '/seller/design/schedule' : `/admin/customization/themes/${saved._id}/schedule`, sellerMode
      ? { scheduledFor, note: publishNote.trim(), expectedRevision: saved.revision }
      : { scheduledFor, note: publishNote.trim(), expectedUpdatedAt: saved.updatedAt });
    const theme = sellerMode
      ? { ...saved, scheduledFor: result.scheduledFor, scheduledNote: result.scheduledNote, updatedAt: result.updatedAt, revision: result.revision }
      : result.theme;
    acceptTheme(theme); setPublishAt(''); setPublishNote(''); setPreflight(result.preflight || preflight);
    setMessage(`Storefront update scheduled for ${formatDate(result.scheduledFor || theme.scheduledFor)}.`);
    await reloadThemeList();
  });
  const cancelSchedule = () => run('cancel-schedule', async () => {
    const result = await api.delete(sellerMode ? '/seller/design/schedule' : `/admin/customization/themes/${selectedTheme._id}/schedule`, sellerMode
      ? { expectedRevision: selectedTheme.revision }
      : { expectedUpdatedAt: selectedTheme.updatedAt });
    const theme = sellerMode
      ? { ...selectedTheme, scheduledFor: null, scheduledNote: '', updatedAt: result.updatedAt, revision: result.revision }
      : result;
    acceptTheme(theme); setMessage('Scheduled publish cancelled. Your draft and live storefront are unchanged.'); await reloadThemeList();
  });
  const themeAction = (action, body, success) => run(action, async () => {
    const result = await api.post(sellerMode ? `/seller/design/${action}` : `/admin/customization/themes/${selectedTheme._id}/${action}`, sellerMode
      ? { ...body, expectedRevision: selectedTheme.revision }
      : { ...body, expectedUpdatedAt: selectedTheme.updatedAt });
    const theme = sellerMode ? { ...selectedTheme, draftConfig: result.draftConfig, updatedAt: result.updatedAt, revision: result.revision } : result;
    acceptTheme(theme); setMessage(success); await reloadThemeList();
    if (action === 'activate') {
      await refreshPublishedConfig({ force: true });
      try { localStorage.setItem(SETTINGS_STORAGE_KEY, String(Date.now())); } catch { /* Storage may be unavailable. */ }
    }
  });
  const createTheme = () => {
    if (!newThemeName.trim()) { setMessage('Enter a theme name first.'); return; }
    run('create', async () => {
      const preset = workspace.presets.find((item) => item.id === newPreset);
      if (!preset?.config) throw new Error('Preset data is unavailable. Reload the designer.');
      const theme = await api.post('/admin/customization/themes', {
        name: newThemeName.trim(), preset: newPreset, config: applyAppearancePreset(draft, preset.config),
      });
      acceptTheme(theme); setNewThemeName(''); historyRequest.current += 1; setHistory([]);
      setMessage('Created a private theme, preserving your content and mobile settings.'); await reloadThemeList();
    });
  };
  const duplicate = () => run('duplicate', async () => {
    const theme = await api.post('/admin/customization/themes', {
      name: `${selectedTheme.name} Copy`.slice(0, 80), preset: draft.theme.preset, config: draft,
    });
    acceptTheme(theme); historyRequest.current += 1; setHistory([]); setMessage('Current editor draft duplicated.'); await reloadThemeList();
  });
  const removeTheme = () => {
    if (selectedTheme.isActive || !window.confirm(`Delete “${selectedTheme.name}” and its version history? This cannot be undone.`)) return;
    run('delete', async () => { await api.delete(`/admin/customization/themes/${selectedTheme._id}`); await loadWorkspace(); setMessage('Theme and its version history deleted.'); });
  };
  const restoreVersion = (id) => {
    if (!window.confirm('Replace this draft with the selected version? The live storefront will not change.')) return;
    run('restore', async () => {
      const result = await api.post(sellerMode ? `/seller/design/history/${id}/restore` : `/admin/customization/themes/${selectedTheme._id}/history/${id}/restore`, sellerMode
        ? { expectedRevision: selectedTheme.revision }
        : { expectedUpdatedAt: selectedTheme.updatedAt });
      const theme = sellerMode ? { ...selectedTheme, draftConfig: result.draftConfig, updatedAt: result.updatedAt, revision: result.revision } : result.theme;
      acceptTheme(theme); clearRecovery(theme); setMessage(result.message); await reloadThemeList();
    });
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([exportThemeFile(draft, selectedTheme.name)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'samira-theme.json'; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importFile = async (event) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    try {
      if (file.size > 512000) throw new Error('Theme files must be smaller than 500 KB.');
      const config = parseThemeFile(await file.text());
      if (window.confirm('Replace the editor draft with this file? You can undo this. Nothing will be published.')) {
        replaceDraft(config); setMessage('Theme imported into the editor. Review every device before publishing.');
      }
    } catch (error) { setMessage(error instanceof SyntaxError ? 'This file is not valid JSON.' : error.message); }
  };

  const applyPreset = useCallback((preset, includeMobile) => {
    const appearance = applyAppearancePreset(draft, preset.config);
    replaceDraft(includeMobile ? matchMobileAppearance(appearance) : appearance);
    setMessage(`${preset.name} applied to the draft. Publish to update desktop, mobile, loaders and admin.${includeMobile ? ' Mobile corners also matched.' : ' Mobile layout preserved.'} Your content and product selections are kept.`);
  }, [draft, replaceDraft]);
  const restorePanel = () => {
    replaceDraft(restoreDesignerPanel(draft, savedConfig, activeTab));
    setMessage('This panel now matches the last saved draft. Other edits are kept. Use Undo to bring it back.');
  };
  const editFromReview = (tab) => { setActiveTab(tab); setPublishReview(false); };

  if (loading) return <section className="admin-card p-8 text-sm text-slate-500" role="status">Loading Website Designer…</section>;
  if (!draft) return <section className="admin-card space-y-4 p-8"><h2 className="text-lg font-bold">Website Designer could not load</h2><p role="alert">{message}</p><button type="button" className="admin-btn" onClick={() => loadWorkspace()}>Try again</button></section>;

  return <section className="min-w-0 space-y-5">
    <PageHeader title={sellerMode ? 'Storefront Studio' : 'Website Designer'} note="Your store, your style. Edit privately, preview real pages, and publish with confidence." />
    <p className="rounded-xl border border-theme-border bg-white p-4 text-xs leading-6 text-slate-600">Shared brand identity, contact details and announcements configured in <a href={sellerMode ? '/seller/settings' : '/admin/settings'} className="font-bold text-wine underline">Store settings</a> take priority over theme defaults. {workspace.managedFields?.length ? <>Currently managed there: <strong>{workspace.managedFields.join(', ')}</strong>.</> : 'No designer fields are currently overridden by Store settings.'}</p>
    <div className="admin-card space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2"><StatusDot active={selectedTheme.isActive} />
          <input maxLength={80} disabled={!!busy || sellerMode} className="h-10 min-w-0 max-w-full rounded-xl border px-3 text-sm font-bold" value={selectedTheme.name} onChange={(event) => setSelectedTheme((current) => ({ ...current, name: event.target.value }))} aria-label="Theme name" />
          <span className={`text-xs font-semibold ${dirty ? 'text-amber-700' : 'text-slate-500'}`}>{dirty ? (autosaveStatus || 'Unsaved changes') : (autosaveStatus || 'Draft saved')}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton icon={Undo2} label="Undo" onClick={undo} disabled={!!busy || !undoStack.length} />
          <ActionButton icon={Redo2} label="Redo" onClick={redo} disabled={!!busy || !redoStack.length} />
          <ActionButton icon={Save} label={busy === 'save' ? 'Saving…' : 'Save draft'} onClick={saveDraft} disabled={!!busy || !!issues.length} />
          <button type="button" onClick={reviewPublish} disabled={!!busy || !!issues.length} className="inline-flex h-10 items-center gap-2 rounded-xl bg-wine px-4 text-xs font-black text-white disabled:opacity-50"><UploadCloud className="h-4 w-4" />{busy === 'preflight' ? 'Checking…' : 'Review & publish'}</button>
        </div>
      </div>
      <p className="text-xs leading-5 text-slate-500">Desktop appearance controls do not change mobile layouts. Branding and footer content are shared. Mobile and tablet overrides are off unless you enable them.</p>
    </div>
    {recovery && <div className="admin-card flex flex-wrap items-center justify-between gap-3 border-amber-200 bg-amber-50 p-4"><div><p className="text-sm font-bold text-amber-900">A newer browser recovery draft is available.</p><p className="mt-1 text-xs text-amber-800">Saved {formatDate(recovery.savedAt)}. Restoring it changes only this private editor.</p></div><div className="flex gap-2"><button type="button" className="admin-btn" onClick={() => { replaceDraft(mergeWebsiteConfig(recovery.config)); setSelectedTheme((current) => ({ ...current, name: recovery.name || current.name })); setRecovery(null); }}>Restore recovery</button><button type="button" className="admin-btn-secondary" onClick={() => clearRecovery()}>Dismiss</button></div></div>}
    {selectedTheme.scheduledFor && <div className="admin-card flex flex-wrap items-center justify-between gap-3 border-sky-200 bg-sky-50 p-4"><div><p className="text-sm font-bold text-sky-900">A storefront update is scheduled.</p><p className="mt-1 text-xs text-sky-800">It will publish {formatDate(selectedTheme.scheduledFor)}. Later draft edits do not change the scheduled snapshot.</p></div><button type="button" className="admin-btn-secondary" disabled={!!busy} onClick={cancelSchedule}>Cancel schedule</button></div>}
    {message && <p role="status" className="rounded-xl border border-theme-border bg-white p-4 text-sm font-semibold text-wine">{message}</p>}
    {!!issues.length && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p className="font-bold">Correct these fields before saving</p><ul className="mt-2 list-disc pl-5">{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul></div>}
    {publishReview && <div className="admin-card space-y-3 border-wine p-5" role="region" aria-label="Publish review">
      <h2 className="text-lg font-bold">Ready to update the live storefront?</h2>
      <p className="text-sm text-slate-600">Changes compared with this theme’s last published version: {changedGroups.join(', ') || 'No appearance changes'}. {selectedTheme.isActive ? '' : 'This will replace the currently active theme.'}</p>
      <p className="text-sm text-slate-600">Mobile overrides: {draft.mobile.enabled ? 'enabled' : 'off — existing layout preserved'}. Tablet overrides: {draft.tablet.enabled ? 'enabled' : 'off'}.</p>
      {preflight && <div className={`rounded-xl border p-4 text-sm ${preflight.ready ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}><p className="font-bold">Storefront preflight {preflight.ready ? 'passed' : 'needs review'}</p><p className="mt-1 text-xs">Checked {preflight.summary?.productsChecked || 0} products, {preflight.summary?.categoriesChecked || 0} categories and {preflight.summary?.blocksChecked || 0} custom blocks.</p>{preflight.warnings?.length > 0 && <ul className="mt-2 list-disc pl-5">{preflight.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}</div>}
      <Field label="Version note (optional)" value={publishNote} onChange={setPublishNote} />
      <div className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)_auto]"><Field type="datetime-local" label="Schedule for later (optional)" value={publishAt} onChange={setPublishAt} /><button type="button" disabled={!!busy || !preflight?.ready || !publishAt} className="admin-btn self-end disabled:opacity-50" onClick={schedulePublish}>{busy === 'schedule' ? 'Scheduling…' : 'Schedule publish'}</button></div>
      <div className="flex flex-wrap gap-2"><button type="button" disabled={!!busy || !preflight?.ready} className="admin-btn disabled:opacity-50" onClick={publish}>{busy === 'publish' ? 'Publishing…' : 'Publish now'}</button><button type="button" disabled={!!busy} className="admin-btn-secondary" onClick={() => setPublishReview(false)}>Keep editing</button></div>
      <p className="text-xs text-slate-500">Publishing records a version. You can restore an earlier version to a draft at any time.</p>
      <details><summary className="cursor-pointer text-xs font-bold text-wine">Review color readability</summary><fieldset disabled={!!busy} className="mt-3"><ReadabilityReview draft={draft} replace={replaceDraft} onSelect={editFromReview} /></fieldset></details>
    </div>}
    <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="order-2 min-w-0 space-y-4 xl:order-1">
        {!sellerMode && <div className="admin-card space-y-3 p-4">
          <h2 className="flex items-center gap-2 text-sm font-bold"><Palette className="h-4 w-4" />My themes</h2>
          <div className="max-h-64 space-y-2 overflow-y-auto">{workspace.themes.map((theme) => <button key={theme._id} disabled={!!busy} onClick={() => selectTheme(theme._id)} className={`w-full rounded-xl border p-3 text-left text-xs ${theme._id === selectedTheme._id ? 'border-wine bg-[#fff5f6]' : 'border-theme-border'}`}><span className="block truncate font-bold">{theme.name}</span><span className="mt-1 block text-slate-500">{theme.isActive ? 'Live storefront' : theme.hasPublishedVersion ? 'Published · inactive' : 'Private draft'}</span></button>)}</div>
          <Field label="New theme name" value={newThemeName} onChange={setNewThemeName} />
          <label className="grid gap-2 text-xs font-bold">Starting preset<select disabled={!!busy} value={newPreset} onChange={(event) => setNewPreset(event.target.value)} className="h-10 max-w-full rounded-xl border bg-white px-2">{workspace.presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</select></label>
          <button type="button" disabled={!!busy || !!issues.length} onClick={createTheme} className="admin-btn inline-flex w-full items-center justify-center gap-2"><Plus className="h-4 w-4" />Create theme</button>
        </div>}
        <div className="admin-card flex flex-wrap gap-2 p-4">
          {!sellerMode && <ActionButton icon={Copy} label="Duplicate" onClick={duplicate} disabled={!!busy || !!issues.length} />}
          <ActionButton icon={Download} label="Export JSON" onClick={download} disabled={!!busy || !!issues.length} />
          <ActionButton icon={UploadCloud} label="Import JSON" onClick={() => importInput.current?.click()} disabled={!!busy} />
          <input ref={importInput} aria-label="Import theme file" type="file" accept=".json,application/json" className="hidden" onChange={importFile} />
          <ActionButton icon={RotateCcw} label="Reset draft" disabled={!!busy} onClick={() => {
            if (window.confirm('Reset this entire draft to its last published version (or its preset if never published)?')) themeAction('discard', {}, 'Draft reset. The live storefront is unchanged.');
          }} />
          {!sellerMode && !selectedTheme.isActive && selectedTheme.publishedConfig && <ActionButton icon={Check} label="Activate published" disabled={!!busy} onClick={() => {
            if (window.confirm('Activate this theme’s last published version? Saved drafts are kept, but unsaved editor changes will be discarded.')) themeAction('activate', {}, 'Published theme activated.');
          }} />}
          {!sellerMode && <ActionButton icon={Trash2} label="Delete theme" danger disabled={!!busy || selectedTheme.isActive} onClick={removeTheme} />}
        </div>
        <details className="admin-card p-4">
          <summary className="cursor-pointer text-sm font-bold"><History className="mr-2 inline h-4 w-4" />Version history ({history.length})</summary>
          {historyWarning && <p className="mt-3 text-xs text-amber-800">{historyWarning}</p>}
          {!history.length && !historyWarning && <p className="mt-3 text-xs text-slate-500">Your first publish will create version 1.</p>}
          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">{history.map((version) => <button key={version._id} disabled={!!busy} type="button" onClick={() => restoreVersion(version._id)} className="w-full rounded-xl border p-3 text-left"><span className="text-xs font-bold">Restore version {version.version}</span><span className="mt-1 block text-[10px] text-slate-500">{formatDate(version.createdAt)}</span><span className="mt-1 block break-words text-xs">{version.note}</span></button>)}</div>
        </details>
      </aside>
      <div className="order-1 min-w-0 space-y-5 xl:order-2">
        <div className="admin-card min-w-0 overflow-hidden">
          <div className="p-4"><WorkflowSmartFill key={selectedTheme._id} workflow="website" form={draft} onChange={replaceDraft} apiBase={sellerMode ? '/seller/smart-fill' : '/admin/smart-fill'} disabled={!!busy} /></div>
          <DesignerControlSearch onSelect={setActiveTab} />
          <div className="flex gap-1 overflow-x-auto border-b p-2" role="tablist" aria-label="Customization settings">
            {editorTabs.map(([id, label]) => <button key={id} role="tab" aria-selected={activeTab === id} type="button" onClick={() => setActiveTab(id)} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold ${activeTab === id ? 'bg-wine text-white' : 'text-slate-500'}`}>{label}</button>)}
          </div>
          {!['presets', 'quick'].includes(activeTab) && <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3"><span className="text-xs text-slate-500">Editing {editorTabs.find(([id]) => id === activeTab)?.[1]}</span><button type="button" disabled={!!busy} onClick={restorePanel} className="text-xs font-bold text-wine disabled:opacity-40">Restore this panel to saved</button></div>}
          {['homepage', 'blocks'].includes(activeTab) && catalogStatus === 'loading' && <p role="status" className="p-4 text-xs text-slate-500">Loading catalog choices… You can keep editing other settings.</p>}
          {catalogWarning && <p className="p-4 text-xs text-amber-800">{catalogWarning} <button type="button" disabled={catalogStatus === 'loading'} onClick={loadCatalog} className="underline">Retry catalog</button></p>}
          <fieldset disabled={!!busy} className="min-w-0 p-4 sm:p-5 lg:max-h-[700px] lg:overflow-y-auto" role="tabpanel">
            {activeTab === 'presets' ? <PresetGallery presets={workspace.presets} currentPreset={draft.theme.preset} onApply={applyPreset} />
              : activeTab === 'quick' ? <QuickStylePanel key={selectedTheme._id} draft={draft} replace={replaceDraft} onSelect={setActiveTab} />
                : <EditorPanel tab={activeTab} draft={draft} update={updateDraft} updateSection={updateSection} moveSection={moveSection} catalog={catalog} categories={categories} searchProducts={searchProducts} managedFields={workspace.managedFields || []} seoPreview={workspace.seoPreview} settingsPath={sellerMode ? '/seller/settings' : '/admin/settings'} uploadPath={sellerMode ? '/seller/uploads' : '/admin/uploads'} />}
          </fieldset>
        </div>
        <div className="admin-card min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3">
            <button type="button" onClick={() => setPreviewOpen(!previewOpen)} aria-expanded={previewOpen} className="text-left"><h2 className="text-sm font-bold">Storefront preview</h2><span className="text-xs text-slate-500">{previewOpen ? 'Hide preview' : 'Show preview'} · Private until published</span></button>
            <div className="flex rounded-xl bg-slate-100 p-1">{[['desktop', Monitor], ['tablet', Tablet], ['mobile', Smartphone]].map(([id, Icon]) => <button key={id} type="button" onClick={() => { setDevice(id); setPreviewOpen(true); }} aria-label={`${id} preview`} aria-pressed={device === id} className={`grid h-10 w-11 place-items-center rounded-lg ${device === id ? 'bg-white text-wine shadow-sm' : 'text-slate-500'}`}><Icon className="h-4 w-4" /></button>)}</div>
          </div>
          {previewOpen && <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3"><span className="text-xs text-slate-500">{compareSaved ? 'Showing last saved draft. Your current edits are kept.' : 'Showing your current draft.'}</span><button type="button" aria-pressed={compareSaved} onClick={() => setCompareSaved(!compareSaved)} className="rounded-lg border px-3 py-2 text-xs font-bold text-wine">{compareSaved ? 'Back to current draft' : 'Compare with saved draft'}</button></div>}
          {previewOpen && <DeferredMount label="storefront preview"><LazyBoundary resetKey={selectedTheme?._id}><Suspense fallback={<p role="status" className="min-h-[480px] p-6 text-sm text-slate-500">Loading storefront preview…</p>}><StorefrontPreview config={compareSaved ? savedConfig : draft} device={device} valid={compareSaved || !issues.length} /></Suspense></LazyBoundary></DeferredMount>}
        </div>
      </div>
    </div>
  </section>;
}

function EditorPanel({ tab, draft, update, updateSection, moveSection, catalog, categories, searchProducts, managedFields, seoPreview, settingsPath, uploadPath }) {
  const productOptions = useMemo(() => catalog.map((product) => ({ value: String(product._id || product.id || product.slug), label: product.name || product.title })), [catalog]);
  const categoryOptions = useMemo(() => categories.map((category) => ({ value: String(category._id || category.id || category.slug), label: category.name || category.title })), [categories]);
  const brandManaged = managedFields.includes('store name');
  const contactManaged = managedFields.includes('footer contact details');
  const announcementManaged = managedFields.includes('announcement visibility and text');
  if (tab === 'mobile') return <Panel title="Mobile storefront" note="Theme colours follow your published design across mobile, desktop, loaders and admin. Optional mobile layout overrides preserve the menu, search and shopping flow.">
    <Toggle label="Use shared theme colours on mobile" checked={draft.mobile.inheritThemeColors} onChange={(value) => update(['mobile', 'inheritThemeColors'], value)} />
    <fieldset disabled={draft.mobile.inheritThemeColors} className="grid gap-3 sm:grid-cols-3 disabled:opacity-50">{[['headerBackground', 'Header background'], ['headerText', 'Header icons'], ['pageBackground', 'Home background']].map(([key, label]) => <ColorField key={key} label={label} value={draft.mobile[key]} onChange={(value) => update(['mobile', key], value)} />)}</fieldset>
    <Toggle label="Enable mobile overrides" checked={draft.mobile.enabled} onChange={(value) => update(['mobile', 'enabled'], value)} />
    <fieldset disabled={!draft.mobile.enabled} className="space-y-4 disabled:opacity-50">
      <Range label="Products per row" value={draft.mobile.columns} min="1" max="2" onChange={(value) => update(['mobile', 'columns'], Number(value))} />
      <Range label="Product gap" value={draft.mobile.gridGap} min="8" max="24" suffix="px" onChange={(value) => update(['mobile', 'gridGap'], Number(value))} />
      <Range label="Product image corners" value={draft.mobile.cardRadius} min="0" max="24" suffix="px" onChange={(value) => update(['mobile', 'cardRadius'], Number(value))} />
      <Select label="Home product image ratio" value={draft.mobile.imageRatio} options={['original', '1/1', '4/5', '3/4']} onChange={(value) => update(['mobile', 'imageRatio'], value)} />
      <Toggle label="Use desktop catalog selections on mobile home" checked={draft.mobile.useDesktopCatalog} onChange={(value) => update(['mobile', 'useDesktopCatalog'], value)} />
      <div className="grid gap-2 sm:grid-cols-2">{[
        ['showTitle', 'Show product title'], ['showPrice', 'Show price'], ['showDiscount', 'Show discount'],
        ['showRating', 'Show rating'], ['showWishlist', 'Show wishlist'], ['showAddToCart', 'Show add to bag'],
      ].map(([key, label]) => <Toggle key={key} label={label} checked={draft.mobile[key]} onChange={(value) => update(['mobile', key], value)} />)}</div>
      <h3 className="text-sm font-bold">Mobile home sections</h3>
      {[...draft.mobile.sections].sort((a, b) => a.order - b.order).map((section, index, list) => <div key={section.id} className="space-y-3 rounded-xl border p-3">
        <div className="flex items-center gap-2"><label className="flex flex-1 items-center gap-2 text-sm font-bold"><input type="checkbox" className="accent-wine" checked={section.visible} onChange={(event) => update(['mobile', 'sections'], list.map((item) => item.id === section.id ? { ...item, visible: event.target.checked } : item))} />{draft.homepage.sections.find((item) => item.id === section.id)?.label || MOBILE_SECTION_LABELS[section.id] || section.id}</label>
          {[-1, 1].map((direction) => <IconButton key={direction} icon={direction < 0 ? ArrowUp : ArrowDown} label={direction < 0 ? 'Move mobile section up' : 'Move mobile section down'} disabled={index + direction < 0 || index + direction >= list.length} onClick={() => {
            const next = [...list]; [next[index], next[index + direction]] = [next[index + direction], next[index]];
            update(['mobile', 'sections'], next.map((item, position) => ({ ...item, order: position * 10 })));
          }} />)}
        </div>
        <Field label="Mobile heading (blank keeps current wording)" value={section.heading} onChange={(value) => update(['mobile', 'sections'], list.map((item) => item.id === section.id ? { ...item, heading: value } : item))} />
      </div>)}
    </fieldset>
  </Panel>;
  if (tab === 'tablet') return <Panel title="Tablet product layout" note="Applies from 768–1023 px only. Mobile and desktop remain independent.">
    <Toggle label="Enable tablet overrides" checked={draft.tablet.enabled} onChange={(value) => update(['tablet', 'enabled'], value)} />
    <fieldset disabled={!draft.tablet.enabled} className="space-y-4">
      <Range label="Tablet products per row" value={draft.tablet.columns} min="2" max="4" onChange={(value) => update(['tablet', 'columns'], Number(value))} />
      <Range label="Tablet product gap" value={draft.tablet.gridGap} min="8" max="32" suffix="px" onChange={(value) => update(['tablet', 'gridGap'], Number(value))} />
    </fieldset>
  </Panel>;
  if (tab === 'branding') return <Panel title="Brand identity" note="Used in the header, browser tab and search metadata.">
    {brandManaged && <ManagedNotice path={settingsPath}>Store name, tagline, logo and favicon are managed in Store settings.</ManagedNotice>}
    <Field disabled={brandManaged} label="Website name" value={draft.branding.websiteName} onChange={(value) => update(['branding', 'websiteName'], value)} />
    <Field disabled={brandManaged} label="Tagline" value={draft.branding.tagline} onChange={(value) => update(['branding', 'tagline'], value)} />
    <UploadField disabled={brandManaged} label="Logo" value={draft.branding.logo} onChange={(value) => update(['branding', 'logo'], value)} context="website-branding" uploadPath={uploadPath} />
    <UploadField disabled={brandManaged} label="Favicon" value={draft.branding.favicon} onChange={(value) => update(['branding', 'favicon'], value)} context="website-favicon" uploadPath={uploadPath} />
    <div className="rounded-2xl border border-theme-border bg-white p-4"><div className="flex items-center justify-between gap-3"><p className="text-xs font-black text-slate-600">Search result preview</p><a href={settingsPath} className="text-xs font-bold text-wine underline">Edit SEO settings</a></div><p className="mt-3 truncate text-lg text-[#1a0dab]">{seoPreview?.title || draft.branding.websiteName}</p><p className="truncate text-xs text-[#188038]">your-store.example</p><p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-600">{seoPreview?.description || draft.branding.tagline || 'Add an SEO description in Store settings.'}</p><p className="mt-2 text-[11px] text-slate-500">Search indexing: {seoPreview?.indexing === false ? 'Disabled' : 'Enabled'}</p></div>
  </Panel>;

  if (tab === 'colors') return <Panel title="Desktop theme colors" note="Desktop storefront palette. Mobile header and home colors are edited separately in the Mobile tab."><div className="grid gap-3 sm:grid-cols-2">{[
    ['primary', 'Primary'], ['secondary', 'Secondary'], ['accent', 'Accent'], ['background', 'Page background'], ['surface', 'Cards / surface'], ['text', 'Main text'], ['mutedText', 'Muted text'],
  ].map(([key, label]) => <ColorField key={key} label={label} value={draft.colors[key]} onChange={(value) => update(['colors', key], value)} />)}</div></Panel>;

  if (tab === 'header') return <Panel title="Header and announcement">
    {announcementManaged && <ManagedNotice path={settingsPath}>Announcement visibility and text are managed in Store settings. Link and schedule remain editable here.</ManagedNotice>}
    <Toggle disabled={announcementManaged} label="Show announcement bar" checked={draft.header.announcementEnabled} onChange={(value) => update(['header', 'announcementEnabled'], value)} />
    <Field disabled={announcementManaged} label="Announcement text" value={draft.header.announcementText} onChange={(value) => update(['header', 'announcementText'], value)} />
    <Field label="Announcement link" value={draft.header.announcementLink} onChange={(value) => update(['header', 'announcementLink'], value)} placeholder="/products?offer=true" />
    <div className="grid gap-3 sm:grid-cols-2"><Field type="datetime-local" label="Show from (optional)" value={toLocalDateTime(draft.header.announcementStartsAt)} onChange={(value) => update(['header', 'announcementStartsAt'], fromLocalDateTime(value))} /><Field type="datetime-local" label="Hide after (optional)" value={toLocalDateTime(draft.header.announcementEndsAt)} onChange={(value) => update(['header', 'announcementEndsAt'], fromLocalDateTime(value))} /></div>
    <div className="grid gap-3 sm:grid-cols-2"><ColorField label="Header background" value={draft.header.background} onChange={(value) => update(['header', 'background'], value)} /><ColorField label="Header text" value={draft.header.textColor} onChange={(value) => update(['header', 'textColor'], value)} /><ColorField label="Announcement background" value={draft.header.announcementBackground} onChange={(value) => update(['header', 'announcementBackground'], value)} /><ColorField label="Announcement text" value={draft.header.announcementTextColor} onChange={(value) => update(['header', 'announcementTextColor'], value)} /></div>
    <Range label="Logo size" value={draft.header.logoSize} min="36" max="140" suffix="px" onChange={(value) => update(['header', 'logoSize'], Number(value))} />
    <Select label="Menu alignment" value={draft.header.menuAlignment} options={['left', 'center', 'right']} onChange={(value) => update(['header', 'menuAlignment'], value)} />
    <Toggle label="Sticky desktop header" checked={draft.header.sticky} onChange={(value) => update(['header', 'sticky'], value)} />
    <MenuEditor label="Desktop navigation" items={draft.header.menuItems} max={8} onChange={(value) => update(['header', 'menuItems'], value)} />
  </Panel>;

  if (tab === 'homepage') return <Panel title="Desktop homepage sections" note="Hide, edit or reorder sections. All selected products and categories come from the real catalog API.">
    <MultiSelect max={8} label="Featured categories (leave empty for automatic)" value={draft.homepage.featuredCategoryIds} options={categoryOptions} onChange={(value) => update(['homepage', 'featuredCategoryIds'], value)} />
    {draft.homepage.featuredCategoryIds.length > 0 && <div className="rounded-2xl border border-theme-border p-4"><p className="mb-3 text-xs font-black text-slate-600">Category image overrides</p><div className="space-y-4">{draft.homepage.featuredCategoryIds.map((categoryId) => { const category = categories.find((item) => String(item._id || item.id || item.slug) === String(categoryId)); const current = draft.homepage.categoryImages.find((item) => String(item.categoryId) === String(categoryId)); return <UploadField key={categoryId} label={category?.name || 'Category image'} value={current?.image || ''} onChange={(image) => update(['homepage', 'categoryImages'], updateCategoryImages(draft.homepage.categoryImages, categoryId, image))} context="website-categories" uploadPath={uploadPath} />; })}</div></div>}
    <div className="space-y-3">{[...draft.homepage.sections].sort((a, b) => a.order - b.order).map((section, index, list) =>
      <HomeSectionEditor key={section.id} section={section} first={index === 0} last={index === list.length - 1}
        products={draft.homepage.sectionProductIds[section.id]} options={productOptions}
        update={update} updateSection={updateSection} moveSection={moveSection} uploadPath={uploadPath} searchProducts={searchProducts} />)}</div>
  </Panel>;

  if (tab === 'blocks') return <ContentBlockEditor blocks={draft.homepage.blocks} productOptions={productOptions} categoryOptions={categoryOptions} searchProducts={searchProducts} uploadPath={uploadPath} onChange={(blocks) => update(['homepage', 'blocks'], blocks)} />;

  if (tab === 'typography') return <Panel title="Desktop typography" note="Applied to the desktop homepage. Mobile text sizing is preserved.">
    <Select label="Heading font" value={draft.typography.headingFont} options={['Playfair Display', 'Inter', 'Georgia', 'Arial']} onChange={(value) => update(['typography', 'headingFont'], value)} />
    <Select label="Body font" value={draft.typography.bodyFont} options={['Inter', 'Figtree', 'Georgia', 'Arial']} onChange={(value) => update(['typography', 'bodyFont'], value)} />
    <Select label="Button font" value={draft.typography.buttonFont} options={['Inter', 'Figtree', 'Georgia', 'Arial']} onChange={(value) => update(['typography', 'buttonFont'], value)} />
    <Range label="Heading scale" value={draft.typography.headingScale} min="0.75" max="1.5" step="0.05" suffix="×" onChange={(value) => update(['typography', 'headingScale'], Number(value))} />
    <Range label="Body scale" value={draft.typography.bodyScale} min="0.8" max="1.3" step="0.05" suffix="×" onChange={(value) => update(['typography', 'bodyScale'], Number(value))} />
    <Select label="Body weight" value={String(draft.typography.bodyWeight)} options={['300', '400', '500', '600', '700']} onChange={(value) => update(['typography', 'bodyWeight'], Number(value))} />
    <Select label="Button weight" value={String(draft.typography.buttonWeight)} options={['400', '500', '600', '700', '800', '900']} onChange={(value) => update(['typography', 'buttonWeight'], Number(value))} />
    <Select label="Heading weight" value={String(draft.typography.headingWeight)} options={['400', '500', '600', '700', '800', '900']} onChange={(value) => update(['typography', 'headingWeight'], Number(value))} />
  </Panel>;

  if (tab === 'buttons') return <Panel title="Desktop storefront buttons"><div className="grid gap-3 sm:grid-cols-2"><ColorField label="Background" value={draft.buttons.background} onChange={(value) => update(['buttons', 'background'], value)} /><ColorField label="Text" value={draft.buttons.textColor} onChange={(value) => update(['buttons', 'textColor'], value)} /></div><Range label="Corner radius" value={draft.buttons.borderRadius} min="0" max="999" suffix="px" onChange={(value) => update(['buttons', 'borderRadius'], Number(value))} /><Select label="Style" value={draft.buttons.style} options={['solid', 'outline', 'soft']} onChange={(value) => update(['buttons', 'style'], value)} /><Select label="Size" value={draft.buttons.size} options={['small', 'medium', 'large']} onChange={(value) => update(['buttons', 'size'], value)} /><Select label="Hover effect" value={draft.buttons.hoverEffect} options={['none', 'lift', 'darken', 'glow']} onChange={(value) => update(['buttons', 'hoverEffect'], value)} /></Panel>;

  if (tab === 'cards') return <Panel title="Desktop product cards" note="Applies to desktop home and catalog cards. Shopping controls on product details and mobile are preserved."><Select label="Card layout" value={draft.productCards.layout} options={['classic', 'minimal', 'compact']} onChange={(value) => update(['productCards', 'layout'], value)} /><Select label="Image ratio" value={draft.productCards.imageRatio} options={['1/1', '4/5', '3/4']} onChange={(value) => update(['productCards', 'imageRatio'], value)} /><Range label="Corner radius" value={draft.productCards.borderRadius} min="0" max="32" suffix="px" onChange={(value) => update(['productCards', 'borderRadius'], Number(value))} /><Select label="Shadow" value={draft.productCards.shadow} options={['none', 'soft', 'elevated']} onChange={(value) => update(['productCards', 'shadow'], value)} /><div className="grid gap-2 sm:grid-cols-2">{[['showTitle', 'Show title'], ['showPrice', 'Show price'], ['showDiscount', 'Show discount'], ['showRating', 'Show rating'], ['showWishlist', 'Show wishlist'], ['showAddToCart', 'Show add to cart'], ['quickView', 'Show quick view']].map(([key, label]) => <Toggle key={key} label={label} checked={draft.productCards[key]} onChange={(value) => update(['productCards', key], value)} />)}</div></Panel>;

  if (tab === 'footer') return <Panel title="Footer"><Toggle label="Show footer" checked={draft.footer.enabled} onChange={(value) => update(['footer', 'enabled'], value)} /><UploadField label="Footer logo override" value={draft.footer.logo} onChange={(value) => update(['footer', 'logo'], value)} context="website-footer" uploadPath={uploadPath} /><Field multiline label="Description" value={draft.footer.description} onChange={(value) => update(['footer', 'description'], value)} /><div className="grid gap-3 sm:grid-cols-2"><ColorField label="Background" value={draft.footer.background} onChange={(value) => update(['footer', 'background'], value)} /><ColorField label="Text" value={draft.footer.textColor} onChange={(value) => update(['footer', 'textColor'], value)} /></div>{contactManaged && <ManagedNotice path={settingsPath}>Footer contact details are managed in Store settings.</ManagedNotice>}<Toggle disabled={contactManaged} label="Show contact details" checked={draft.footer.showContact} onChange={(value) => update(['footer', 'showContact'], value)} />{draft.footer.showContact && <div className="grid gap-3"><Field disabled={contactManaged} label="Contact email" value={draft.footer.contactEmail} onChange={(value) => update(['footer', 'contactEmail'], value)} /><Field disabled={contactManaged} label="Contact phone" value={draft.footer.contactPhone} onChange={(value) => update(['footer', 'contactPhone'], value)} /><Field disabled={contactManaged} label="Contact address" value={draft.footer.contactAddress} onChange={(value) => update(['footer', 'contactAddress'], value)} /></div>}<Toggle label="Show social links" checked={draft.footer.showSocialLinks} onChange={(value) => update(['footer', 'showSocialLinks'], value)} />{draft.footer.showSocialLinks && <div className="grid gap-3 sm:grid-cols-2">{Object.keys(draft.footer.socialLinks).map((network) => <Field key={network} label={`${network} URL`} value={draft.footer.socialLinks[network]} onChange={(value) => update(['footer', 'socialLinks', network], value)} />)}</div>}<Toggle label="Show newsletter" checked={draft.footer.showNewsletter} onChange={(value) => update(['footer', 'showNewsletter'], value)} /><MenuEditor label="Shopping menu" items={draft.footer.menus.shopping} onChange={(value) => update(['footer', 'menus', 'shopping'], value)} /><MenuEditor label="Policies menu" items={draft.footer.menus.policies} onChange={(value) => update(['footer', 'menus', 'policies'], value)} /><MenuEditor label="About menu" items={draft.footer.menus.about} onChange={(value) => update(['footer', 'menus', 'about'], value)} /><Field label="Copyright text" value={draft.footer.copyrightText} onChange={(value) => update(['footer', 'copyrightText'], value)} /></Panel>;

  return <Panel title="Store layout"><Select label="Page width" value={draft.layout.mode} options={['full', 'boxed']} onChange={(value) => update(['layout', 'mode'], value)} /><Range label="Maximum width" value={draft.layout.maxWidth} min="960" max="1920" step="40" suffix="px" onChange={(value) => update(['layout', 'maxWidth'], Number(value))} /><Range label="Section spacing" value={draft.layout.sectionSpacing} min="16" max="160" step="4" suffix="px" onChange={(value) => update(['layout', 'sectionSpacing'], Number(value))} /><Range label="Product grid gap" value={draft.layout.gridGap} min="4" max="64" step="2" suffix="px" onChange={(value) => update(['layout', 'gridGap'], Number(value))} /><div className="grid gap-3 sm:grid-cols-3"><Range label="Desktop columns" value={draft.layout.productsPerRow.desktop} min="2" max="6" onChange={(value) => update(['layout', 'productsPerRow', 'desktop'], Number(value))} /></div></Panel>;
}

function Panel({ title, note, children }) { return <div className="space-y-4"><div><h2 className="text-lg font-black text-charcoal">{title}</h2>{note && <p className="mt-1 text-xs leading-5 text-slate-500">{note}</p>}</div>{children}</div>; }
function ManagedNotice({ path, children }) { return <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs leading-5 text-sky-900"><strong>Managed in Store settings.</strong> {children} <a href={path} className="font-bold underline">Open settings</a></div>; }
function Field({ label, value, onChange, multiline = false, type = 'text', placeholder = '', disabled = false }) { const Tag = multiline ? 'textarea' : 'input'; return <label className={`grid gap-2 text-xs font-black text-slate-600 ${disabled ? 'opacity-60' : ''}`}>{label}<Tag disabled={disabled} type={multiline ? undefined : type} value={value ?? ''} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className={`${multiline ? 'min-h-24 py-3' : 'h-10'} rounded-xl border border-theme-border px-3 text-sm font-medium text-charcoal outline-none focus:border-wine disabled:bg-slate-100`} /></label>; }
function ColorField({ label, value, onChange }) { return <label className="grid gap-2 text-xs font-black text-slate-600">{label}<span className="flex h-10 overflow-hidden rounded-xl border border-theme-border bg-white"><input type="color" aria-label={`${label} picker`} value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"} onChange={(event) => onChange(event.target.value)} className="h-10 w-12 cursor-pointer border-0" /><input aria-label={`${label} hex`} value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 px-2 text-xs font-bold uppercase outline-none" /></span></label>; }
function Toggle({ label, checked, onChange, disabled = false }) { return <label className={`flex min-h-11 items-center justify-between gap-3 rounded-xl border border-theme-border bg-white px-3 text-xs font-black text-slate-600 ${disabled ? 'opacity-60' : ''}`}><span>{label}</span><input type="checkbox" disabled={disabled} checked={!!checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-wine" /></label>; }
function Range({ label, value, onChange, min, max, step = '1', suffix = '' }) { return <label className="grid gap-2 text-xs font-black text-slate-600"><span className="flex justify-between"><span>{label}</span><span className="text-wine">{value}{suffix}</span></span><input type="range" aria-label={label} value={value} min={min} max={max} step={step} onChange={(event) => onChange(event.target.value)} className="accent-wine" /></label>; }
function Select({ label, value, options, onChange }) { return <label className="grid gap-2 text-xs font-black text-slate-600">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-xl border border-theme-border bg-white px-3 text-sm font-bold capitalize"><option value="" disabled>Select</option>{options.map((option) => <option key={option} value={option}>{String(option).replace(/([A-Z])/g, ' $1')}</option>)}</select></label>; }
const HomeSectionEditor = memo(function HomeSectionEditor({ section, first, last, products, options, update, updateSection, moveSection, uploadPath, searchProducts }) {
  const [expanded, setExpanded] = useState(false);
  return <div className="rounded-2xl border border-theme-border p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <label className="flex items-center gap-2 text-sm font-black"><input type="checkbox" checked={section.visible} onChange={(event) => updateSection(section.id, 'visible', event.target.checked)} className="accent-wine" />{section.label}</label>
      <div className="flex gap-1"><button type="button" aria-expanded={expanded} aria-controls={`section-editor-${section.id}`} onClick={() => setExpanded(!expanded)} className="rounded-lg border px-3 text-xs font-bold text-wine">{expanded ? 'Close' : 'Edit'} {section.label}</button><IconButton icon={ArrowUp} label={`Move ${section.label} up`} disabled={first} onClick={() => moveSection(section.id, -1)} /><IconButton icon={ArrowDown} label={`Move ${section.label} down`} disabled={last} onClick={() => moveSection(section.id, 1)} /></div>
    </div>
    {expanded && <div id={`section-editor-${section.id}`} className="mt-3 grid gap-3">
      {section.id !== 'services' && <Field label="Heading" value={section.heading} onChange={(value) => updateSection(section.id, 'heading', value)} />}
      {!['services', 'categories'].includes(section.id) && <Field label="Description" value={section.description} onChange={(value) => updateSection(section.id, 'description', value)} />}
      {!['services', 'categories', 'reviews'].includes(section.id) && <div className="grid gap-3 sm:grid-cols-2"><Field label="Button text" value={section.buttonText} onChange={(value) => updateSection(section.id, 'buttonText', value)} />{section.id !== 'newsletter' && <Field label="Button link" value={section.buttonLink} onChange={(value) => updateSection(section.id, 'buttonLink', value)} />}</div>}
      {products && <MultiSelect label="Products (leave empty for automatic)" value={products} options={options} onSearchRequest={searchProducts} onChange={(value) => update(['homepage', 'sectionProductIds', section.id], value)} />}
      {['hero', 'sale', 'promotional'].includes(section.id) && <><UploadField label="Desktop image override" value={section.image} onChange={(value) => updateSection(section.id, 'image', value)} context={`website-${section.id}`} uploadPath={uploadPath} /><UploadField label="Mobile image override" value={section.mobileImage} onChange={(value) => updateSection(section.id, 'mobileImage', value)} context={`website-${section.id}-mobile`} uploadPath={uploadPath} /><div className="grid gap-3 sm:grid-cols-2"><Field label="Image description (alt text)" value={section.imageAlt} onChange={(value) => updateSection(section.id, 'imageAlt', value)} /><Select label="Image focus" value={section.imagePosition} options={['top', 'center', 'bottom']} onChange={(value) => updateSection(section.id, 'imagePosition', value)} /></div></>}
      <UploadField label="Section background" value={section.backgroundImage} onChange={(value) => updateSection(section.id, 'backgroundImage', value)} context={`website-${section.id}-background`} uploadPath={uploadPath} />
    </div>}
  </div>;
});

const blockLabels = {
  hero: 'Hero banner', 'image-text': 'Image + text', offer: 'Offer banner', trust: 'Trust points', faq: 'FAQs', video: 'Video',
  'product-grid': 'Product collection', 'category-grid': 'Category grid', 'category-carousel': 'Category carousel', reviews: 'Customer reviews',
  newsletter: 'Newsletter', social: 'Social proof',
  countdown: 'Countdown campaign', coupon: 'Coupon spotlight',
};

function createContentBlock(type = 'image-text') {
  const id = `block-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return {
    id, type, visible: true, showOnDesktop: true, showOnMobile: true, order: 1000,
    eyebrow: '', title: `New ${blockLabels[type] || 'content'} section`, body: '', buttonText: '', buttonLink: '',
    image: '', mobileImage: '', altText: '', videoUrl: '', couponCode: '', endsAt: '', alignment: 'left', imagePosition: 'center', backgroundColor: '', textColor: '',
    productIds: [], categoryIds: [], items: [],
  };
}

function ContentBlockEditor({ blocks = [], productOptions, categoryOptions, searchProducts, uploadPath, onChange }) {
  const ordered = useMemo(() => [...blocks].sort((left, right) => left.order - right.order), [blocks]);
  const commit = (next) => onChange(next.map((block, index) => ({ ...block, order: 200 + index * 10 })));
  const edit = (id, patch) => commit(ordered.map((block) => block.id === id ? { ...block, ...patch } : block));
  const move = (index, direction) => commit(reorderDesignerItems(ordered, index, direction));
  const add = (type) => commit([...ordered, createContentBlock(type)]);
  const duplicate = (block, index) => {
    const copy = { ...block, id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, title: `${block.title || blockLabels[block.type]} copy` };
    const next = [...ordered]; next.splice(index + 1, 0, copy); commit(next);
  };

  return <Panel title="Reusable content blocks" note="Add campaign and information sections without changing code. Every block can have separate desktop and mobile media, and is sanitized before it reaches the storefront.">
    <div className="rounded-2xl border border-theme-border bg-[#fcf7f3] p-4">
      <p className="text-xs font-black text-charcoal">Add a section</p>
      <div className="mt-3 flex flex-wrap gap-2">{WEBSITE_BLOCK_TYPES.map((type) => <button key={type} type="button" disabled={ordered.length >= 24} onClick={() => add(type)} className="rounded-xl border border-theme-border bg-white px-3 py-2 text-xs font-bold text-wine disabled:opacity-40"><Plus className="mr-1 inline h-3.5 w-3.5" />{blockLabels[type]}</button>)}</div>
      <p className="mt-2 text-[11px] text-slate-500">{ordered.length}/24 blocks. Order and device visibility are controlled per block.</p>
    </div>
    {!ordered.length && <div className="rounded-2xl border border-dashed border-[#d9c9bd] p-8 text-center"><p className="text-sm font-bold">No custom blocks yet</p><p className="mt-1 text-xs text-slate-500">Start with an offer, product collection, FAQ or trust section.</p></div>}
    <div className="space-y-3">{ordered.map((block, index) => <details key={block.id} className="rounded-2xl border border-theme-border bg-white p-4">
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-center gap-3"><span className={`h-2.5 w-2.5 rounded-full ${block.visible ? 'bg-emerald-500' : 'bg-slate-300'}`} /><span className="min-w-0 flex-1 truncate text-sm font-black">{block.title || blockLabels[block.type]}</span><span className="rounded-full bg-[#f8eef1] px-2 py-1 text-[10px] font-bold text-wine">{blockLabels[block.type]}</span></div>
      </summary>
      <div className="mt-4 space-y-4 border-t pt-4">
        <div className="grid gap-2 sm:grid-cols-3"><Toggle label="Published in layout" checked={block.visible} onChange={(visible) => edit(block.id, { visible })} /><Toggle label="Show on desktop" checked={block.showOnDesktop} onChange={(showOnDesktop) => edit(block.id, { showOnDesktop })} /><Toggle label="Show on mobile" checked={block.showOnMobile} onChange={(showOnMobile) => edit(block.id, { showOnMobile })} /></div>
        <Select label="Block type" value={block.type} options={WEBSITE_BLOCK_TYPES} onChange={(type) => edit(block.id, { type })} />
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Small heading" value={block.eyebrow} onChange={(eyebrow) => edit(block.id, { eyebrow })} /><Field label="Section title" value={block.title} onChange={(title) => edit(block.id, { title })} /></div>
        <Field multiline label="Description" value={block.body} onChange={(body) => edit(block.id, { body })} />
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Button text" value={block.buttonText} onChange={(buttonText) => edit(block.id, { buttonText })} /><Field label="Button link" value={block.buttonLink} placeholder="/products" onChange={(buttonLink) => edit(block.id, { buttonLink })} /></div>
        {['hero', 'image-text', 'offer', 'social'].includes(block.type) && <div className="grid gap-4"><UploadField label="Desktop image" value={block.image} onChange={(image) => edit(block.id, { image })} context={`website-${block.id}`} uploadPath={uploadPath} /><UploadField label="Mobile image" value={block.mobileImage} onChange={(mobileImage) => edit(block.id, { mobileImage })} context={`website-${block.id}-mobile`} uploadPath={uploadPath} /><div className="grid gap-3 sm:grid-cols-2"><Field label="Image description (alt text)" value={block.altText} onChange={(altText) => edit(block.id, { altText })} /><Select label="Image focus" value={block.imagePosition} options={['top', 'center', 'bottom']} onChange={(imagePosition) => edit(block.id, { imagePosition })} /></div></div>}
        {block.type === 'video' && <><Field label="Hosted MP4 or WebM URL" value={block.videoUrl} onChange={(videoUrl) => edit(block.id, { videoUrl })} placeholder="https://…/campaign.mp4" /><UploadField label="Video poster" value={block.image} onChange={(image) => edit(block.id, { image })} context={`website-${block.id}-poster`} uploadPath={uploadPath} /><Field label="Video description" value={block.altText} onChange={(altText) => edit(block.id, { altText })} /></>}
        {block.type === 'countdown' && <Field type="datetime-local" label="Countdown ends" value={toLocalDateTime(block.endsAt)} onChange={(value) => edit(block.id, { endsAt: fromLocalDateTime(value) })} />}
        {block.type === 'coupon' && <Field label="Coupon code" value={block.couponCode} onChange={(couponCode) => edit(block.id, { couponCode: couponCode.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 40) })} placeholder="FESTIVE20" />}
        {block.type === 'product-grid' && <MultiSelect label="Products" value={block.productIds} options={productOptions} max={12} onSearchRequest={searchProducts} onChange={(productIds) => edit(block.id, { productIds })} />}
        {['category-grid', 'category-carousel'].includes(block.type) && <MultiSelect label="Categories" value={block.categoryIds} options={categoryOptions} max={8} onChange={(categoryIds) => edit(block.id, { categoryIds })} />}
        {['faq', 'trust', 'reviews'].includes(block.type) && <Field multiline label={block.type === 'faq' ? 'Questions (one per line: Question | Answer)' : 'Items (one per line)'} value={(block.items || []).join('\n')} onChange={(value) => edit(block.id, { items: value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(0, 8) })} />}
        <div className="grid gap-3 sm:grid-cols-3"><Select label="Text alignment" value={block.alignment} options={['left', 'center', 'right']} onChange={(alignment) => edit(block.id, { alignment })} /><ColorField label="Background (optional)" value={block.backgroundColor} onChange={(backgroundColor) => edit(block.id, { backgroundColor })} /><ColorField label="Text (optional)" value={block.textColor} onChange={(textColor) => edit(block.id, { textColor })} /></div>
        <div className="flex flex-wrap justify-end gap-2"><IconButton icon={ArrowUp} label="Move block up" disabled={index === 0} onClick={() => move(index, -1)} /><IconButton icon={ArrowDown} label="Move block down" disabled={index === ordered.length - 1} onClick={() => move(index, 1)} /><ActionButton icon={Copy} label="Duplicate" onClick={() => duplicate(block, index)} /><ActionButton icon={Trash2} label="Remove" danger onClick={() => commit(ordered.filter((item) => item.id !== block.id))} /></div>
      </div>
    </details>)}</div>
  </Panel>;
}

export function MultiSelect({ label, value = [], options = [], onChange, onSearchRequest, max = 12 }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const available = useMemo(() => new Set(options.map((item) => item.value)), [options]);
  const optionLabels = useMemo(() => new Map(options.map((item) => [item.value, item.label])), [options]);
  const filtered = useMemo(() => {
    const missing = value.filter((id) => !available.has(id)).map((id) => ({ value: id, label: 'Unavailable catalog item (selected)' }));
    const query = search.trim().toLowerCase();
    return [...missing, ...options].filter((item) => String(item.label).toLowerCase().includes(query));
  }, [available, value, options, search]);
  const pageSize = 40;
  useEffect(() => {
    if (!onSearchRequest || search.trim().length < 2) return undefined;
    const timer = window.setTimeout(() => onSearchRequest(search.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [onSearchRequest, search]);
  const lastPage = Math.max(0, Math.ceil(filtered.length / pageSize) - 1);
  const currentPage = Math.min(page, lastPage);
  const start = currentPage * pageSize;
  return <div className="space-y-2 rounded-xl border p-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold">{label}</p><button type="button" onClick={() => onChange([])} className="text-xs font-bold text-wine">Clear ({value.length})</button></div>
    {!!value.length && <details className="rounded-lg bg-[#fcf7f3] p-3"><summary className="cursor-pointer text-xs font-bold text-wine">Arrange selected items ({value.length})</summary><ol className="mt-3 space-y-2">{value.map((id, index) => <li key={id} className="flex items-center gap-2 text-xs"><span className="text-slate-400">{index + 1}.</span><span className="min-w-0 flex-1 truncate" title={optionLabels.get(id) || id}>{optionLabels.get(id) || 'Unavailable catalog item'}</span><IconButton icon={ArrowUp} label={`Move selected item ${index + 1} up`} disabled={index === 0} onClick={() => onChange(reorderDesignerItems(value, index, -1))} /><IconButton icon={ArrowDown} label={`Move selected item ${index + 1} down`} disabled={index === value.length - 1} onClick={() => onChange(reorderDesignerItems(value, index, 1))} /><IconButton icon={Trash2} label={`Remove selected item ${index + 1}`} onClick={() => onChange(value.filter((item) => item !== id))} /></li>)}</ol></details>}
    <input aria-label={`Search ${label}`} placeholder="Search catalog…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} className="h-10 w-full rounded-lg border px-3 text-sm" />
    <div className="max-h-48 space-y-1 overflow-y-auto">{filtered.slice(start, start + pageSize).map((item) => <label key={item.value} className="flex min-h-10 items-center gap-3 rounded-lg p-2 text-xs hover:bg-slate-50"><input type="checkbox" disabled={!value.includes(item.value) && value.length >= max} className="h-4 w-4 accent-wine" checked={value.includes(item.value)} onChange={(event) => onChange(event.target.checked ? [...value, item.value].slice(0, max) : value.filter((id) => id !== item.value))} /><span>{item.label}</span></label>)}
      {!filtered.length && <p className="p-2 text-xs text-slate-500">{options.length ? 'No matching catalog items.' : 'No catalog items available.'}</p>}
    </div>
    {filtered.length > pageSize && <div className="flex items-center justify-between gap-2 text-xs">
      <button type="button" aria-label={`Previous ${label} results`} disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Previous</button>
      <span role="status">{start + 1}–{Math.min(start + pageSize, filtered.length)} of {filtered.length}</span>
      <button type="button" aria-label={`Next ${label} results`} disabled={currentPage === lastPage} onClick={() => setPage(currentPage + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Next</button>
    </div>}
    <p className="text-[11px] text-slate-500">Choose up to {max}. {onSearchRequest ? 'Typing searches the full catalog.' : 'Search filters the available choices.'} No selection uses the automatic collection. Selections keep their chosen order.</p>
  </div>;
}
function MenuEditor({ label, items = [], onChange, max = 20 }) {
  const edit = (index, key, value) => onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  return <div className="space-y-2">
    <div className="flex items-center justify-between"><p className="text-xs font-black text-slate-600">{label}</p><button type="button" disabled={items.length >= max} onClick={() => onChange([...items, { label: 'New link', path: '/products' }])} className="text-xs font-black text-wine disabled:opacity-40">+ Add link</button></div>
    {items.map((item, index) => <div key={index} className="rounded-xl border border-theme-border bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2"><span className="text-[10px] font-bold text-slate-500">Link {index + 1}</span><div className="flex gap-1">
        <IconButton icon={ArrowUp} label={label + ' link ' + (index + 1) + ' up'} disabled={index === 0} onClick={() => onChange(reorderDesignerItems(items, index, -1))} />
        <IconButton icon={ArrowDown} label={label + ' link ' + (index + 1) + ' down'} disabled={index === items.length - 1} onClick={() => onChange(reorderDesignerItems(items, index, 1))} />
        <IconButton icon={Trash2} label="Remove footer link" onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))} />
      </div></div>
      <div className="grid gap-2 sm:grid-cols-2"><input value={item.label} onChange={(event) => edit(index, 'label', event.target.value)} placeholder="Link title" className="h-10 min-w-0 rounded-lg border border-theme-border px-2 text-xs" aria-label={label + ' link label'} /><input value={item.path} onChange={(event) => edit(index, 'path', event.target.value)} placeholder="/products" className="h-10 min-w-0 rounded-lg border border-theme-border px-2 text-xs" aria-label={label + ' link path'} /></div>
    </div>)}
    <p className="text-[11px] text-slate-500">Use a store page path, such as /products or /contact. Arrow buttons change the display order.</p>
  </div>;
}
function UploadField({ label, value, onChange, context, uploadPath, disabled = false }) { return <div className={`space-y-2 ${disabled ? 'opacity-60' : ''}`}><p className="text-xs font-black text-slate-600">{label}</p><ImageUploader disabled={disabled} value={value ? [{ url: value, primary: true }] : []} onChange={(files) => onChange(files[0]?.url || '')} uploadContext={context} uploadPath={uploadPath} showPrimaryControl={false} label={`Upload ${label}`} helpText="JPG, PNG or WEBP. Images are compressed before upload." /></div>; }
function IconButton({ icon: Icon, label, ...props }) { return <button type="button" aria-label={label} title={label} className="grid h-8 w-8 place-items-center rounded-lg border border-theme-border text-slate-500 disabled:opacity-30" {...props}><Icon className="h-3.5 w-3.5" /></button>; }
function ActionButton({ icon: Icon, label, danger = false, ...props }) { return <button type="button" className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-xs font-black ${danger ? 'border-rose-200 text-rose-700' : 'border-theme-border bg-white text-slate-600'}`} {...props}><Icon className="h-4 w-4" />{label}</button>; }
function StatusDot({ active }) { return <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}><span className={`h-2 w-2 rounded-full ${active ? 'bg-emerald-500' : 'bg-amber-500'}`} />{active ? 'Live' : 'Draft'}</span>; }
function formatDate(value) { try { return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); } catch { return ''; } }
function toLocalDateTime(value) { if (!value) return ''; const date = new Date(value); if (Number.isNaN(date.getTime())) return ''; const offset = date.getTimezoneOffset() * 60000; return new Date(date.getTime() - offset).toISOString().slice(0, 16); }
function fromLocalDateTime(value) { if (!value) return ''; const date = new Date(value); return Number.isNaN(date.getTime()) ? '' : date.toISOString(); }
function previewDeviceForViewport() { if (typeof window === 'undefined') return 'desktop'; if (window.matchMedia('(max-width: 767px)').matches) return 'mobile'; if (window.matchMedia('(max-width: 1023px)').matches) return 'tablet'; return 'desktop'; }
function updateCategoryImages(items, categoryId, image) { const next = (items || []).filter((item) => String(item.categoryId) !== String(categoryId)); return image ? [...next, { categoryId, image }] : next; }
function sellerThemeFromData(data) {
  return {
    _id: 'store-design', name: `${data.store?.name || 'Store'} design`, isActive: true,
    draftConfig: data.draftConfig, publishedConfig: data.publishedConfig,
    updatedAt: data.updatedAt, publishedAt: data.publishedAt, revision: Number(data.revision || 0),
    scheduledFor: data.scheduledFor, scheduledNote: data.scheduledNote,
    preset: data.preset || data.draftConfig?.theme?.preset || 'default',
  };
}
