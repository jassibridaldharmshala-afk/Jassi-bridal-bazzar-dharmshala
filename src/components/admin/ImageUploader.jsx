import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../services/api';
import { normalizeImageUrl } from '../../services/normalize';
import { compressImageFile, isSupportedImageFile } from '../../services/imageCompression';
import { inspectProductImage } from '../../utils/imageQuality';
import ImageBackgroundEditor from './ImageBackgroundEditor';
import { newUploadKey, selectionFingerprint } from '../../services/uploadRetry';

export default function ImageUploader({
  value = [],
  onChange,
  multiple = false,
  maxFiles = 1,
  uploadContext = 'products',
  uploadPath = '/admin/uploads',
  maxUploadMb = 20,
  label = 'Choose Images',
  helpText = 'Drag and drop or click to upload.',
  showPrimaryControl = true,
  replaceOnUpload = false,
  disabled = false,
  onBusyChange,
}) {
  const inputRef = useRef(null);
  const originalFiles = useRef(new Map());
  const [editing, setEditing] = useState(null);
  const uploadLock = useRef(false);
  const pendingUpload = useRef(null);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [phase, setPhase] = useState('');
  const [progress, setProgress] = useState(0);
  const [recentUploads, setRecentUploads] = useState([]);
  const [qualityChecks, setQualityChecks] = useState([]);

  const files = (Array.isArray(value) ? value : value ? [value] : []).filter((file) => file?.url);

  const addFiles = async (selected) => {
    if (uploadLock.current || disabled || editing) return;
    setError('');
    setPhase('');
    setProgress(0);
    setRecentUploads([]);
    setQualityChecks([]);
    const incoming = Array.from(selected);
    if (!incoming.length) return;
    if (incoming.length > 8) return setError('Choose up to 8 new images at a time. Your existing photos are kept.');
    if ((replaceOnUpload && !multiple ? 0 : files.length) + incoming.length > maxFiles) return setError(`Maximum ${maxFiles} image${maxFiles > 1 ? 's' : ''} allowed.`);

    uploadLock.current = true;
    setUploading(true);
    onBusyChange?.(true);
    try {
      const signature = `${uploadPath}:${uploadContext}:${await selectionFingerprint(incoming)}`;
      const retry = pendingUpload.current?.signature === signature ? pendingUpload.current : null;
      const converted = retry?.converted || [];
      const uploadStats = retry?.uploadStats || [];
      const inspections = retry?.inspections || [];
      if (!retry) {
        for (const file of incoming) {
          if (!isSupportedImageFile(file)) {
            throw new Error('Only JPG, JPEG, PNG, and WEBP images are allowed.');
          }
          if (file.size > maxUploadMb * 1024 * 1024) {
            throw new Error(`Each photo can be up to ${maxUploadMb} MB.`);
          }
          setPhase('preparing');
          const compressedFile = await compressImageFile(file, {
            onProgress: (value) => setProgress(Math.max(0, Math.min(100, Math.round(value || 0)))),
          });
          inspections.push(await inspectProductImage(compressedFile));
          converted.push(compressedFile);
          uploadStats.push({
            name: file.name,
            originalSize: Number(file.size || 0),
            compressedSize: Number(compressedFile.size || 0),
            convertedToWebp: Boolean(compressedFile.__compressionMeta?.convertedToWebp),
          });
        }
      }
      pendingUpload.current = retry || { signature, converted, uploadStats, inspections, key: newUploadKey() };
      setRecentUploads(uploadStats);
      setQualityChecks(inspections.filter(Boolean));

      setPhase('uploading');
      setProgress(100);
      const data = await api.upload(`${uploadPath}?folder=${encodeURIComponent(uploadContext)}`, converted, { fieldName: 'images', idempotencyKey: pendingUpload.current.key });
      const uploadedFiles = Array.isArray(data.files) ? data.files.filter((file) => file?.url) : [];
      if (uploadedFiles.length !== incoming.length) throw new Error('Not all images were confirmed. Retry to finish this upload.');
      setRecentUploads(uploadStats.map((stat, index) => ({ ...stat, compressedSize: Number(uploadedFiles[index]?.sizeBytes) || stat.compressedSize })));
      const uploaded = uploadedFiles.map((file, index) => ({
        ...file,
        originalName: file.originalName || incoming[index]?.name || converted[index]?.name || '',
        primary: files.length === 0 && index === 0,
      }));
      uploaded.forEach((file, index) => originalFiles.current.set(file.url, converted[index]));
      onChange(multiple ? [...files, ...uploaded] : uploaded.slice(0, 1));
      pendingUpload.current = null;
    } catch (uploadError) {
      if (uploadError.code === 'UPLOAD_RETRY_CONFLICT') pendingUpload.current = null;
      setError(uploadError.message || 'Image upload failed. Please try again.');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
      setUploading(false);
      uploadLock.current = false;
      onBusyChange?.(false);
      setPhase('');
      setProgress(0);
    }
  };

  const remove = (index) => {
    originalFiles.current.delete(files[index]?.background?.original?.url || files[index]?.url);
    const next = files.filter((_, itemIndex) => itemIndex !== index);
    const existingPrimary = next.findIndex((item) => item.primary);
    onChange(next.map((item, itemIndex) => ({ ...item, primary: itemIndex === (existingPrimary >= 0 ? existingPrimary : 0) })));
  };

  const markPrimary = (index) => onChange(files.map((item, itemIndex) => ({ ...item, primary: itemIndex === index })));
  const move = (index, direction) => {
    const destination = index + direction;
    if (destination < 0 || destination >= files.length) return;
    const next = [...files];
    [next[index], next[destination]] = [next[destination], next[index]];
    onChange(next);
  };

  const closeEditor = () => { setEditing(null); onBusyChange?.(false); };

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
        onDrop={(event) => { event.preventDefault(); addFiles(event.dataTransfer.files); }}
        onDragOver={(event) => event.preventDefault()}
        className="grid min-h-40 w-full place-items-center rounded-2xl border-2 border-dashed border-wine/30 bg-[#fbf8f4] p-5 text-center transition hover:border-wine"
      >
        <span>
          <span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-wine text-lg font-black text-white">+</span>
          <span className="block text-sm font-black text-charcoal">
            {uploading ? (phase === 'preparing' ? 'Preparing images...' : 'Uploading images...') : label}
          </span>
          <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">{helpText}</span>
          <span className="block text-xs leading-5 text-slate-500">Photos up to {Math.min(maxUploadMb, 20)} MB · 60 MB per batch · original quality preserved</span>
          <span className="mt-3 inline-flex rounded-xl bg-white px-4 py-2 text-xs font-black text-wine shadow-sm">Browse Files</span>
        </span>
      </button>
      {uploading && (
        <div className="rounded-xl bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>{phase === 'preparing' ? 'Preparing' : 'Uploading'}</span>
            <span>{progress}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-wine transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
      <input ref={inputRef} aria-label={label} type="file" accept=".jpg,.jpeg,.png,.webp" multiple={multiple} disabled={disabled || uploading} onChange={(event) => addFiles(event.target.files)} className="hidden" />
      {error && <p role="alert" className="text-sm font-bold text-rose">{error}</p>}
      {qualityChecks.some((item) => item.warnings.length) && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900" role="status"><strong>Photo quality review</strong>{qualityChecks.filter((item) => item.warnings.length).map((item) => <p key={item.name} className="mt-1"><b>{item.name}:</b> {item.warnings.join(', ')}{item.width && item.height ? ` (${item.width}×${item.height})` : ''}. You may continue, but a clearer portrait photo will look better.</p>)}</div>}
      {recentUploads.length > 0 && (
        <div className="space-y-2 rounded-xl bg-white p-3 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.08em] text-slate-500">Photo size · original quality preserved</p>
          {recentUploads.map((item) => (
            <div key={`${item.name}-${item.originalSize}`} className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-600">
              <span className="min-w-0 truncate">{item.name}</span>
              <span className="shrink-0 text-right">
                {formatFileSize(item.originalSize)} → {formatFileSize(item.compressedSize)}
                {item.convertedToWebp ? ' · WEBP' : ''}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {files.map((file, index) => (
          <div key={`${file.url}-${index}`} className="relative overflow-hidden rounded-xl border border-slate-200 bg-white">
            <img src={normalizeImageUrl(file.url)} alt={file.originalName || file.name || 'Upload preview'} className="h-28 w-full object-cover" />
            {file.primary && <span className="absolute left-2 top-2 rounded-full bg-wine px-2 py-1 text-[10px] font-black text-white">Primary</span>}
            {uploadContext === 'products' && <button type="button" disabled={disabled || uploading || !!editing} onClick={() => { setEditing({ index, file }); onBusyChange?.(true); }} className="min-h-11 w-full border-t border-slate-100 px-2 text-xs font-bold text-wine" aria-label={`Edit background for image ${index + 1}`}>Background{file.background ? ' · Edited' : ''}</button>}
            {file.sourceFrame && <div className="grid gap-2 p-2 text-xs text-slate-600"><a href={normalizeImageUrl(file.url)} target="_blank" rel="noreferrer" className="flex min-h-9 items-center text-wine underline">View full photo</a><label className="grid gap-1"><span>Product view</span><select disabled={disabled || uploading || !!editing} aria-label={'Product view for image ' + (index + 1)} value={file.sourceFrame.viewType || 'unknown'} onChange={(event) => onChange(files.map((item, itemIndex) => itemIndex === index ? { ...item, sourceFrame: { ...item.sourceFrame, viewType: event.target.value } } : item))} className="min-h-10 w-full rounded-lg border border-slate-200 bg-white px-2"><option value="unknown">Unspecified</option><option value="front">Front</option><option value="back">Back</option><option value="side">Side</option><option value="detail">Detail</option></select></label></div>}
            {showPrimaryControl ? (
              <div className="grid grid-cols-4 border-t border-slate-100">
                <button type="button" disabled={disabled || uploading || index === 0} onClick={() => move(index, -1)} aria-label={`Move image ${index + 1} earlier`} title="Move earlier" className="grid h-9 place-items-center text-slate-500 disabled:opacity-30"><ChevronLeft size={15} /></button>
                <button type="button" disabled={disabled || uploading || index === files.length - 1} onClick={() => move(index, 1)} aria-label={`Move image ${index + 1} later`} title="Move later" className="grid h-9 place-items-center text-slate-500 disabled:opacity-30"><ChevronRight size={15} /></button>
                <button type="button" disabled={disabled || uploading || file.primary} onClick={() => markPrimary(index)} className="h-9 text-xs font-black text-wine disabled:opacity-50">Main</button>
                <button type="button" disabled={disabled || uploading} onClick={() => remove(index)} className="h-9 text-xs font-black text-rose">Remove</button>
              </div>
            ) : (
              <button type="button" disabled={disabled || uploading} onClick={() => remove(index)} className="h-9 w-full text-xs font-black text-rose">Remove</button>
            )}
          </div>
        ))}
      </div>
      {editing && <ImageBackgroundEditor image={editing.file} originalFile={originalFiles.current.get(editing.file.background?.original?.url || editing.file.url)} uploadPath={uploadPath} onClose={closeEditor} onApply={updated => { onChange(files.map((file, index) => index === editing.index ? updated : file)); closeEditor(); }} />}
    </div>
  );
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
