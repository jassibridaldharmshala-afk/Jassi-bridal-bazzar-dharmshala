import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, CheckCircle2, ChevronDown, CircleHelp, LifeBuoy, Lightbulb, Printer, Search, X } from 'lucide-react';
import './ContextualHelp.css';

const EMPTY_GUIDE = {
  id: 'loading', area: 'User manual', title: 'Help for this page',
  summary: 'Loading the relevant instructions…', steps: [], tips: [], related: [],
};

export default function ContextualHelp({ route = '/', navigate }) {
  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [view, setView] = useState('current');
  const [query, setQuery] = useState('');
  const launcherRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open || manual) return undefined;
    let active = true;
    import('../../config/userManual')
      .then((module) => { if (active) setManual(module); })
      .catch(() => { if (active) setLoadError('The manual could not be loaded. Refresh the page and try again.'); });
    return () => { active = false; };
  }, [manual, open]);

  useEffect(() => {
    setOpen(false);
    setView('current');
    setQuery('');
  }, [route]);

  useEffect(() => {
    if (!open) return undefined;
    const launcher = launcherRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => panelRef.current?.querySelector('[data-help-close]')?.focus(), 0);
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), summary, [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      launcher?.focus();
    };
  }, [open]);

  const current = manual?.guideForRoute(route) || EMPTY_GUIDE;
  const audienceGuides = useMemo(() => manual?.guidesForAudience(route) || [], [manual, route]);
  const results = useMemo(() => manual?.searchManual(audienceGuides, query) || [], [audienceGuides, manual, query]);
  const audience = manual?.manualAudience(route) || 'customer';
  const supportPath = audience === 'seller' ? '/seller/inbox' : audience === 'admin' || audience === 'master' ? '/admin/support' : '/contact';

  const go = (path) => {
    setOpen(false);
    if (typeof navigate === 'function') navigate(path);
  };

  const printManual = () => {
    setView('all');
    setQuery('');
    document.body.classList.add('sc-help-printing');
    const cleanup = () => document.body.classList.remove('sc-help-printing');
    window.addEventListener('afterprint', cleanup, { once: true });
    window.setTimeout(() => { window.print(); window.setTimeout(cleanup, 500); }, 80);
  };

  const overlay = open ? (
    <div className="sc-help-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <aside ref={panelRef} className="sc-help-panel" role="dialog" aria-modal="true" aria-labelledby="sc-help-title">
        <header className="sc-help-panel__header">
          <div className="sc-help-panel__brand"><span><BookOpen size={20} /></span><div><small>USER MANUAL</small><h2 id="sc-help-title">How can we help?</h2></div></div>
          <button type="button" data-help-close onClick={() => setOpen(false)} aria-label="Close user manual"><X size={20} /></button>
        </header>

        <div className="sc-help-tabs" role="tablist" aria-label="Manual view">
          <button type="button" role="tab" aria-selected={view === 'current'} className={view === 'current' ? 'is-active' : ''} onClick={() => setView('current')}>This page</button>
          <button type="button" role="tab" aria-selected={view === 'all'} className={view === 'all' ? 'is-active' : ''} onClick={() => setView('all')}>Complete manual</button>
        </div>

        {loadError ? <div className="sc-help-error" role="alert">{loadError}</div> : view === 'current' ? (
          <div className="sc-help-panel__body">
            <GuideArticle guide={current} current onNavigate={go} />
          </div>
        ) : (
          <div className="sc-help-panel__body sc-help-panel__body--manual">
            <label className="sc-help-search"><Search size={17} /><span className="sr-only">Search the manual</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the manual…" /></label>
            <div className="sc-help-manual-intro"><strong>{audienceLabel(audience)} manual</strong><p>{results.length} guide{results.length === 1 ? '' : 's'} for this workspace. Open a topic for step-by-step instructions.</p></div>
            <div className="sc-help-guide-list">
              {results.map((entry) => <GuideDisclosure key={entry.id} guide={entry} onNavigate={go} />)}
              {!results.length && <div className="sc-help-empty"><Search size={24} /><strong>No matching guide</strong><p>Try a page name or task such as order, refund, product, payment or shipping.</p></div>}
            </div>
          </div>
        )}

        <footer className="sc-help-panel__footer">
          <button type="button" onClick={printManual}><Printer size={16} /> Print / save PDF</button>
          <button type="button" className="is-primary" onClick={() => go(supportPath)}><LifeBuoy size={16} /> Contact support</button>
        </footer>
      </aside>
    </div>
  ) : null;

  return <>
    <button ref={launcherRef} type="button" className="sc-help-launcher" onClick={() => setOpen(true)} aria-label="Open help for this page" aria-haspopup="dialog" aria-expanded={open}>
      <CircleHelp size={21} /><span>Help</span>
    </button>
    {typeof document !== 'undefined' && overlay ? createPortal(overlay, document.body) : null}
  </>;
}

function GuideArticle({ guide, current = false, onNavigate }) {
  return <article className={`sc-help-article ${current ? 'is-current' : ''}`}>
    <div className="sc-help-article__heading"><span>{guide.area}</span><h3>{guide.title}</h3><p>{guide.summary}</p></div>
    {guide.steps?.length > 0 && <section><h4><CheckCircle2 size={16} /> How to use this page</h4><ol>{guide.steps.map((step, index) => <li key={`${guide.id}-step-${index}`}><span>{index + 1}</span><p>{step}</p></li>)}</ol></section>}
    {guide.tips?.length > 0 && <section className="sc-help-tips"><h4><Lightbulb size={16} /> Good to know</h4>{guide.tips.map((tip, index) => <p key={`${guide.id}-tip-${index}`}>{tip}</p>)}</section>}
    {guide.related?.length > 0 && <section className="sc-help-related"><h4>Related actions</h4><div>{guide.related.map((item) => <button type="button" key={`${guide.id}-${item.path}`} onClick={() => onNavigate(item.path)}>{item.label}</button>)}</div></section>}
  </article>;
}

function GuideDisclosure({ guide, onNavigate }) {
  return <details className="sc-help-disclosure">
    <summary><div><span>{guide.area}</span><strong>{guide.title}</strong><p>{guide.summary}</p></div><ChevronDown size={18} /></summary>
    <GuideArticle guide={guide} onNavigate={onNavigate} />
  </details>;
}

function audienceLabel(value) {
  if (value === 'master') return 'Platform owner';
  if (value === 'seller') return 'Seller workspace';
  if (value === 'admin') return 'Store administration';
  return 'Customer';
}
