import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../../services/api';
import { normalizeImageUrl } from '../../services/normalize';
import { BACKGROUND_PRESETS, applyBackgroundAsset, composeBackground, removeImageBackground, restoreOriginalAsset } from '../../services/imageBackground';
import './ImageBackgroundEditor.css';

export default function ImageBackgroundEditor({ image, originalFile, uploadPath, onApply, onClose }) {
  const original = image.background?.original || image;
  const [mode, setMode] = useState(image.background?.edited?.url === image.url ? 'saved' : 'original');
  const [preset, setPreset] = useState('white');
  const [preview, setPreview] = useState('');
  const [prepared, setPrepared] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [available, setAvailable] = useState(null);
  const cutout = useRef('');
  const request = useRef(null);
  const generation = useRef(0);
  const alive = useRef(true);
  const dialog = useRef(null);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  const abort = useRef(new AbortController());

  useEffect(() => {
    alive.current = true;
    const controller = new AbortController(); abort.current = controller;
    const previousFocus = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.focus();
    api.get(`${uploadPath}/background`, { signal: controller.signal, silent: true }).then(result => {
      if (alive.current && !controller.signal.aborted) setAvailable(result.available);
    }).catch(() => { if (alive.current && !controller.signal.aborted) setAvailable(false); });
    return () => {
      alive.current = false; generation.current += 1;
      controller.abort(); request.current?.cancel();
      document.body.style.overflow = overflow;
      previousFocus?.focus?.();
    };
  }, [uploadPath]);

  useEffect(() => () => { if (preview.startsWith('blob:')) URL.revokeObjectURL(preview); }, [preview]);

  async function select(nextMode, nextPreset = preset) {
    if (busy) return;
    setMode(nextMode); setPreset(nextPreset); setError(''); setPrepared(null); setPreview('');
    if (nextMode === 'original' || nextMode === 'saved') return;
    const version = ++generation.current;
    setBusy('Preparing background preview…');
    try {
      if (!cutout.current) {
        if (originalFile) cutout.current = await removeImageBackground(originalFile, uploadPath, handle => { request.current = handle; });
        else {
          const result = await api.post(`${uploadPath}/background/stored`, { url: original.url }, { silent: true, signal: abort.current.signal });
          if (!result.image?.startsWith('data:image/png;base64,')) throw new Error('No background preview was returned.');
          cutout.current = result.image;
        }
      }
      if (!alive.current || version !== generation.current) return;
      const file = await composeBackground(cutout.current, nextMode === 'transparent' ? 'transparent' : nextPreset);
      if (!alive.current || version !== generation.current) return;
      setPrepared(file); setPreview(URL.createObjectURL(file));
    } catch (failure) {
      if (alive.current) setError(failure.message || 'Unable to edit this photo. Keep the original or try again.');
    } finally { if (alive.current) setBusy(''); }
  }

  async function apply() {
    if (busy) return;
    if (mode === 'original') { onApply(restoreOriginalAsset(image)); return; }
    if (mode === 'saved') { onApply({ ...image, ...image.background.edited }); return; }
    if (!prepared) return;
    setBusy('Saving selected photo…'); setError('');
    try {
      const result = await api.upload(`${uploadPath}?folder=products`, [prepared], { fieldName: 'images', silent: true, onRequest: handle => { request.current = handle; } });
      if (!result.files?.[0]?.url) throw new Error('The edited photo was not saved. Please retry.');
      if (alive.current) onApply(applyBackgroundAsset(image, result.files[0], mode === 'transparent' ? 'transparent' : preset));
    } catch (failure) { if (alive.current) setError(failure.message); }
    finally { if (alive.current) setBusy(''); }
  }

  function keyboard(event) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeRef.current(); }
    if (event.key !== 'Tab') return;
    const nodes = [...dialog.current.querySelectorAll('button:not(:disabled), [href], input:not(:disabled)')];
    const first = nodes[0], last = nodes[nodes.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }

  const selectedLabel = mode === 'original' ? 'Original photo' : mode === 'saved' ? 'Previously edited photo' : mode === 'transparent' ? 'Transparent' : BACKGROUND_PRESETS.find(item => item.id === preset)?.label;
  const finalPreview = mode === 'original' ? normalizeImageUrl(original.url) : mode === 'saved' ? normalizeImageUrl(image.background.edited.url) : preview;
  return createPortal(<div className="image-background-overlay" onClick={event => event.stopPropagation()}>
    <section className="image-background-editor" role="dialog" aria-modal="true" aria-labelledby="background-title" ref={dialog} tabIndex={-1} onKeyDown={keyboard}>
      <header><div><h2 id="background-title">Product photo background</h2><p>Your original stays available. Apply a preview, then save the product.</p></div><button type="button" onClick={onClose} aria-label="Close background editor">×</button></header>
      <div className="image-background-body">
        <div className="image-background-options" aria-label="Background options">
          <button type="button" aria-pressed={mode === 'original'} disabled={!!busy} onClick={() => select('original')}>Keep Original</button>
          <button type="button" aria-pressed={mode === 'transparent'} disabled={!!busy || available !== true} onClick={() => select('transparent')}>Remove Background</button>
          <button type="button" aria-pressed={mode === 'preset'} disabled={!!busy || available !== true} onClick={() => select('preset')}>Use Preset Background</button>
          {image.background?.edited && <button type="button" aria-pressed={mode === 'saved'} disabled={!!busy} onClick={() => select('saved')}>Previous edit</button>}
        </div>
        {available === null && <p role="status">Checking background tools…</p>}
        {available === false && <p className="image-background-note" role="status">Background tools need the image worker to be connected. You can keep the original and continue uploading.</p>}
        {mode === 'preset' && <div className="image-background-presets">{BACKGROUND_PRESETS.map(item => <button key={item.id} type="button" disabled={!!busy} aria-pressed={preset === item.id} onClick={() => select('preset', item.id)}><span style={{ background: item.colors.length > 1 ? `linear-gradient(135deg, ${item.colors.join(',')})` : item.colors[0] }} />{item.label}</button>)}</div>}
        <div className="image-background-previews">
          <figure><figcaption>Original</figcaption><div><img src={normalizeImageUrl(original.url)} alt="Original product" /></div></figure>
          <figure><figcaption>Final preview · {selectedLabel}</figcaption><div aria-busy={!!busy}>{busy ? <p role="status">{busy}</p> : finalPreview ? <img src={finalPreview} alt="Selected final product" /> : <p>Choose a background to prepare a preview.</p>}</div></figure>
        </div>
        <p className="image-background-note">Check fabric edges, jewellery and transparent details before applying. Automatic removal may need a different photo for fine details.</p>
        {error && <div role="alert"><p>{error}</p>{mode !== 'original' && <button type="button" disabled={!!busy} onClick={() => select(mode, preset)}>Retry preview</button>}</div>}
      </div>
      <footer><button type="button" onClick={onClose}>Cancel</button><button type="button" disabled={!!busy || (!['original', 'saved'].includes(mode) && !prepared)} onClick={apply}>Use this photo</button></footer>
    </section>
  </div>, document.body);
}
