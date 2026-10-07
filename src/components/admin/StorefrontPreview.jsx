import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { PREVIEW_PAGES, PREVIEW_PATH } from '../../config/websiteDesigner';

const widths = { desktop: 1440, tablet: 820, mobile: 390 };
export const PREVIEW_UPDATE_DELAY = 500;

function StorefrontPreview({ config, device, valid = true }) {
  const frame = useRef(null);
  const container = useRef(null);
  const lastValid = useRef(valid ? config : null);
  if (valid) lastValid.current = config;
  const latest = useRef(null);
  const sent = useRef(null);
  const [token] = useState(() => window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const [availableWidth, setAvailableWidth] = useState(widths[device]);
  const [fit, setFit] = useState(true);
  const [path, setPath] = useState('/');
  const [ready, setReady] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [automatic, setAutomatic] = useState(true);
  const [visible, setVisible] = useState(() => document.visibilityState !== 'hidden');
  const [inView, setInView] = useState(true);
  latest.current = { config: lastValid.current, path };

  const send = useCallback(() => {
    const payload = latest.current;
    if (!payload.config || !frame.current?.contentWindow ||
      (sent.current?.config === payload.config && sent.current?.path === payload.path)) return;
    frame.current.contentWindow.postMessage({ type: 'samira:theme-preview', token, ...payload }, window.location.origin);
    sent.current = payload;
  }, [token]);

  useEffect(() => {
    let scheduled;
    const measure = () => {
      cancelAnimationFrame(scheduled);
      scheduled = requestAnimationFrame(() => {
        if (container.current?.clientWidth) setAvailableWidth(Math.max(1, Math.round(container.current.clientWidth - 24)));
      });
    };
    measure();
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    const intersection = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting), { rootMargin: '100px' },
    );
    if (container.current) { resize?.observe(container.current); intersection?.observe(container.current); }
    const visibility = () => setVisible(document.visibilityState !== 'hidden');
    window.addEventListener('resize', measure);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      cancelAnimationFrame(scheduled); resize?.disconnect(); intersection?.disconnect();
      window.removeEventListener('resize', measure); document.removeEventListener('visibilitychange', visibility);
    };
  }, []);

  useEffect(() => {
    setReady(false); setTimedOut(false); setPreviewError(false); sent.current = null;
    const timeout = window.setTimeout(() => setTimedOut(true), 20000);
    const receive = (event) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow || event.data?.token !== token) return;
      if (event.data.type === 'samira:preview-error') { setPreviewError(true); return; }
      if (event.data.type !== 'samira:preview-ready') return;
      window.clearTimeout(timeout); setReady(true); setTimedOut(false); setPreviewError(false);
      sent.current = null; send();
    };
    window.addEventListener('message', receive);
    return () => { window.clearTimeout(timeout); window.removeEventListener('message', receive); };
  }, [token, attempt, send]);

  useEffect(() => {
    // Never reload the frame for incomplete input. Send only the latest valid
    // draft after typing settles; paused/offscreen previews do no update work.
    if (!ready || !valid || !automatic || !visible || !inView || previewError) return undefined;
    const timer = window.setTimeout(send, PREVIEW_UPDATE_DELAY);
    return () => window.clearTimeout(timer);
  }, [config, path, ready, valid, automatic, visible, inView, previewError, send]);

  const scale = fit ? Math.min(1, availableWidth / widths[device]) : 1;
  return <div>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3 text-xs text-slate-600">
      <label>Preview page <select aria-label="Preview page" value={path} onChange={(event) => setPath(event.target.value)} className="ml-2 rounded-lg border bg-white p-2">
        {PREVIEW_PAGES.map((page) => <option key={page.path} value={page.path}>{page.label}</option>)}
      </select></label>
      <span>{widths[device]} px · Read-only · Real catalog</span>
      <div className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={automatic} onClick={() => setAutomatic(!automatic)} className="rounded-lg border bg-white px-3 py-2">{automatic ? 'Pause live preview' : 'Resume live preview'}</button>
        {!automatic && <button type="button" disabled={!ready || !valid || previewError} onClick={send} className="rounded-lg border bg-white px-3 py-2 disabled:opacity-50">Update preview</button>}
        <button type="button" aria-pressed={fit} onClick={() => setFit(!fit)} className="rounded-lg border bg-white px-3 py-2">{fit ? `Fit (${Math.round(scale * 100)}%)` : '100% size'}</button>
      </div>
    </div>
    {!valid && <p role="status" className="p-3 text-xs text-amber-800">Showing the last valid preview. Complete the invalid fields to resume updates; your edits are kept.</p>}
    {!automatic && <p className="p-3 text-xs text-slate-500">Live preview paused. Edit freely, then update when ready. Saving still includes all your edits.</p>}
    {(!ready || previewError) && <p role="status" className="p-3 text-xs">{previewError ? 'Preview could not render. Your draft is safe.' : timedOut ? 'Preview did not load. Your draft is safe.' : 'Loading storefront preview…'} {(timedOut || previewError) && <button type="button" className="underline" onClick={() => setAttempt((value) => value + 1)}>Retry preview</button>}</p>}
    <div ref={container} className="overflow-x-auto bg-slate-100 p-3">
      <div className="relative mx-auto" style={{ width: widths[device] * scale, height: 720 * scale }}>
        <iframe key={attempt} ref={frame} title={`${device} storefront preview`} src={`${PREVIEW_PATH}?token=${token}`}
          className="absolute left-0 top-0 block origin-top-left rounded-xl border bg-white" style={{ width: widths[device], height: 720, maxWidth: 'none', transform: `scale(${scale})` }}
          sandbox="allow-scripts allow-same-origin" />
      </div>
    </div>
    <p className="p-3 text-xs leading-5 text-slate-500">Scroll inside the preview. Updates wait until typing stops and pause when the preview is offscreen. Fit preserves the selected device layout. Shopping actions are disabled here; no customer cart or account is changed.</p>
  </div>;
}

export default memo(StorefrontPreview);
