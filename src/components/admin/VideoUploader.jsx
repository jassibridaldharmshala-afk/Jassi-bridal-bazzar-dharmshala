import { useRef, useState } from 'react';
import api from '../../services/api';
import { normalizeImageUrl } from '../../services/normalize';
import { useAuth } from '../../context/AuthContext';
import { newUploadKey, selectionFingerprint } from '../../services/uploadRetry';

const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime'];

export default function VideoUploader({
  value = [],
  onChange,
  multiple = true,
  maxFiles = 2,
  uploadContext = 'product-videos',
  uploadPath = '/admin/uploads/videos',
  label = 'Choose Videos',
  helpText = 'Upload optional product videos in MP4, WEBM, or MOV format.',
  disabled = false,
  onBusyChange,
}) {
  const { notify } = useAuth();
  const inputRef = useRef(null);
  const uploadLock = useRef(false);
  const pendingUpload = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const videos = (Array.isArray(value) ? value : value ? [value] : []).filter((item) => item?.url);

  const addFiles = async (selected) => {
    if (uploadLock.current || disabled) return;
    setProgress(0);
    const incoming = Array.from(selected || []);
    if (!incoming.length) return;
    if (videos.length + incoming.length > maxFiles) {
      notify(`Maximum ${maxFiles} videos allowed.`, 'warning', 'Product video');
      return;
    }

    for (const file of incoming) {
      if (!allowedTypes.includes(file.type)) {
        notify('Only MP4, WEBM, and MOV videos are allowed.', 'error', 'Product video');
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        notify('Each video must be under 20MB.', 'error', 'Product video');
        return;
      }
    }

    uploadLock.current = true;
    setUploading(true);
    onBusyChange?.(true);
    try {
      const signature = `${uploadPath}:${uploadContext}:${await selectionFingerprint(incoming)}`;
      if (pendingUpload.current?.signature !== signature) pendingUpload.current = { signature, key: newUploadKey() };
      setProgress(35);
      const data = await api.upload(`${uploadPath}?folder=${encodeURIComponent(uploadContext)}`, incoming, { fieldName: 'videos', idempotencyKey: pendingUpload.current.key });
      setProgress(100);
      const uploaded = Array.isArray(data.files) ? data.files.filter((file) => file?.url) : [];
      if (uploaded.length !== incoming.length) throw new Error('Not all videos were confirmed. Retry to finish this upload.');
      onChange(multiple ? [...videos, ...uploaded].slice(0, maxFiles) : uploaded.slice(0, 1));
      pendingUpload.current = null;
      notify(`${uploaded.length} product video${uploaded.length > 1 ? 's' : ''} uploaded successfully.`, 'success', 'Product video');
    } catch (uploadError) {
      if (uploadError.code === 'UPLOAD_RETRY_CONFLICT') pendingUpload.current = null;
      notify(uploadError.message || 'Video upload failed. Please try again.', 'error', 'Product video');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
      setUploading(false);
      uploadLock.current = false;
      onBusyChange?.(false);
      setProgress(0);
    }
  };

  const remove = (index) => {
    const next = videos.filter((_, itemIndex) => itemIndex !== index);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
        className="grid min-h-36 w-full place-items-center rounded-2xl border-2 border-dashed border-wine/30 bg-[#fbf8f4] p-5 text-center transition hover:border-wine disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span>
          <span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-wine text-lg font-black text-white">+</span>
          <span className="block text-sm font-black text-charcoal">{uploading ? 'Uploading videos...' : label}</span>
          <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">{helpText}</span>
          <span className="mt-3 inline-flex rounded-xl bg-white px-4 py-2 text-xs font-black text-wine shadow-sm">
            Browse Files
          </span>
        </span>
      </button>
      {uploading && (
        <div className="rounded-xl bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Uploading</span>
            <span>{progress}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-wine transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".mp4,.webm,.mov"
        multiple={multiple}
        disabled={disabled || uploading}
        onChange={(event) => addFiles(event.target.files)}
        className="hidden"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {videos.map((video, index) => (
          <div key={`${video.url}-${index}`} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <video controls preload="metadata" src={normalizeImageUrl(video.url)} className="h-40 w-full bg-black object-cover" />
            <div className="flex items-center justify-between gap-3 p-3">
              <p className="min-w-0 truncate text-xs font-semibold text-slate-600">{video.originalName || video.publicId || 'Uploaded video'}</p>
              <button type="button" disabled={disabled || uploading} onClick={() => remove(index)} className="text-xs font-black text-rose disabled:opacity-50">
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
