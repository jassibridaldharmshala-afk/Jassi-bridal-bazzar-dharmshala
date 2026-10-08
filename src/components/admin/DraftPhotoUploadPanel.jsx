import { useEffect, useMemo, useState } from 'react';
import { ImagePlus, Upload, X } from 'lucide-react';
import { isSupportedImageFile, PHOTO_SOURCE_MAX_BYTES } from '../../services/imageCompression';

const MAX_PHOTOS = 30;
const groupTitle = (group, index) => group.name.trim() || `Product ${index + 1}`;
const retainPhotos = (group, photos) => ({ ...group, photos, cover: photos.includes(group.cover) ? group.cover : photos[0] });

export default function DraftPhotoUploadPanel({ files, setFiles, groupMode, setGroupMode, groups, setGroups, groupingSupported, uploading, onUpload, onClose }) {
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState('');
  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files]);
  useEffect(() => () => previews.forEach((item) => URL.revokeObjectURL(item.url)), [previews]);
  const assignments = useMemo(() => new Map(groups.flatMap((group) => group.photos.map((photo) => [photo, group]))), [groups]);
  const unassigned = files.filter((photo) => !assignments.has(photo));
  const grouped = groupMode === 'grouped';
  const draftCount = groupMode === 'single' ? 1 : grouped ? groups.length : files.length;
  const ready = files.length > 0 && (!grouped || (groupingSupported && groups.length > 0 && !unassigned.length));

  const add = (incoming) => {
    const added = Array.from(incoming || []);
    if (!added.length) return;
    if (files.length + added.length > MAX_PHOTOS) return setError('Choose up to 30 photos per upload. Remove some photos or upload the remaining products in another batch.');
    if (added.some((file) => !isSupportedImageFile(file))) return setError('Choose JPG, PNG or WEBP photos only.');
    if (added.some((file) => file.size > PHOTO_SOURCE_MAX_BYTES)) return setError('Each source photo can be up to 20 MB before automatic compression.');
    setError('');
    setFiles((current) => [...current, ...added.filter((file) => !current.includes(file))]);
  };
  const clear = () => { setFiles([]); setGroups([]); setSelected([]); setError(''); };
  const removePhoto = (file) => {
    setFiles((current) => current.filter((photo) => photo !== file));
    setSelected((current) => current.filter((photo) => photo !== file));
    setGroups((current) => current.map((group) => retainPhotos(group, group.photos.filter((photo) => photo !== file))).filter((group) => group.photos.length));
  };
  const assignPhotos = (photos, targetId) => {
    setGroups((current) => current.map((group) => {
      const remaining = group.photos.filter((photo) => !photos.includes(photo));
      return retainPhotos(group, group.id === targetId ? [...remaining, ...photos] : remaining);
    }).filter((group) => group.photos.length));
    setSelected([]);
  };
  const createGroup = () => {
    if (!selected.length) return;
    const photos = files.filter((file) => selected.includes(file));
    const id = window.crypto?.randomUUID?.() || `photo-group-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setGroups((current) => [
      ...current.map((group) => retainPhotos(group, group.photos.filter((photo) => !photos.includes(photo)))).filter((group) => group.photos.length),
      { id, name: '', photos, cover: photos[0] },
    ]);
    setSelected([]);
  };
  const makeCover = (file, group) => {
    if (groupMode === 'single') setFiles((current) => [file, ...current.filter((photo) => photo !== file)]);
    else setGroups((current) => current.map((item) => item.id === group?.id ? { ...item, cover: file } : item));
  };

  return <section className="admin-card draft-upload-panel" aria-label="Create drafts from photos">
    <div className="draft-panel-heading"><div><p>FAST CATALOG SETUP</p><h2>Create drafts from product photos</h2><span>Photos stay editable before anything is published.</span></div><button type="button" disabled={uploading} onClick={onClose} aria-label="Close upload panel"><X /></button></div>
    <div className="draft-upload-options">
      <label className={groupMode === 'single' ? 'is-selected' : ''}><input type="radio" disabled={uploading} name="draft-group" checked={groupMode === 'single'} onChange={() => setGroupMode('single')} /><strong>One product, multiple photos</strong><span>Use when every photo shows the same item.</span></label>
      <label className={groupMode === 'separate' ? 'is-selected' : ''}><input type="radio" disabled={uploading} name="draft-group" checked={groupMode === 'separate'} onChange={() => setGroupMode('separate')} /><strong>One draft per photo</strong><span>Use when each photo is a different item.</span></label>
      <label className={`${grouped ? 'is-selected' : ''}${!groupingSupported ? ' is-disabled' : ''}`}><input type="radio" disabled={uploading || !groupingSupported} name="draft-group" checked={grouped} onChange={() => setGroupMode('grouped')} /><strong>Several products, grouped photos</strong><span>{groupingSupported ? 'Give each product its own set of photos: 2, 4, 6 or any number.' : 'Grouped uploads are currently unavailable.'}</span></label>
    </div>
    <label className="draft-dropzone"><Upload size={24} /><strong>Choose up to 30 product photos</strong><span>JPG, PNG or WEBP, up to 20 MB each. Automatically optimized below 100 KB before upload.</span><input aria-label="Choose product photos" type="file" disabled={uploading} multiple accept="image/jpeg,image/jpg,image/png,image/webp" onChange={(event) => { add(event.target.files); event.target.value = ''; }} /></label>
    {error && <p role="alert" className="draft-alert is-error">{error}</p>}
    {grouped && files.length > 0 && <div className="draft-group-tools">
      <p>Select all views of one product, then create its group. Repeat for the next product. Photos can be moved between groups before uploading.</p>
      <div><strong>{selected.length} selected</strong><button type="button" className="admin-btn" disabled={!selected.length || uploading} onClick={createGroup}><ImagePlus size={16} />Create product group</button>
        <select aria-label="Move selected photos to product group" disabled={!selected.length || !groups.length || uploading} value="" onChange={(event) => assignPhotos(selected, event.target.value)}><option value="" disabled>Move selected to…</option>{groups.map((group, index) => <option key={group.id} value={group.id}>{groupTitle(group, index)}</option>)}<option value="unassigned">Unassigned photos</option></select>
        <button type="button" className="admin-btn-ghost" disabled={!unassigned.length || uploading} onClick={() => setSelected(unassigned)}>Select unassigned</button><button type="button" className="admin-btn-ghost" disabled={!selected.length || uploading} onClick={() => setSelected([])}>Clear selection</button>
      </div>
    </div>}
    {!!previews.length && <div className={`draft-upload-previews${grouped ? ' is-grouped' : ''}`}>{previews.map(({ file, url }, index) => {
      const group = assignments.get(file);
      const cover = grouped ? group?.cover === file : groupMode === 'single' && index === 0;
      return <figure key={`${file.name}-${file.size}-${index}`} className={selected.includes(file) && grouped ? 'is-selected' : ''}>
        <div className="draft-photo-media">{grouped ? <label><input type="checkbox" aria-label={`Select photo ${index + 1}: ${file.name}`} disabled={uploading} checked={selected.includes(file)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, file] : current.filter((photo) => photo !== file))} /><img src={url} alt="" /></label> : <img src={url} alt="" />}
          <button type="button" className="draft-photo-remove" disabled={uploading} onClick={() => removePhoto(file)} aria-label={`Remove photo ${index + 1}: ${file.name}`}><X size={14} /></button>{cover && <b>Cover</b>}
        </div>
        <figcaption title={file.name}>{file.name}</figcaption>
        {grouped && <select aria-label={`Product group for photo ${index + 1}: ${file.name}`} disabled={uploading} value={group?.id || ''} onChange={(event) => assignPhotos([file], event.target.value)}><option value="">Unassigned</option>{groups.map((item, groupIndex) => <option key={item.id} value={item.id}>{groupTitle(item, groupIndex)}</option>)}</select>}
        {(grouped ? group && !cover : groupMode === 'single' && !cover) && <button type="button" className="draft-photo-cover" disabled={uploading} onClick={() => makeCover(file, group)}>Make cover</button>}
      </figure>;
    })}</div>}
    {grouped && !!groups.length && <div className="draft-photo-groups" aria-label="Product photo groups">{groups.map((group, index) => <section key={group.id} aria-label={`Product group ${index + 1}`}>
      <header><strong>Product {index + 1} · {group.photos.length} photos</strong><button type="button" disabled={uploading} aria-label={`Ungroup product ${index + 1} photos`} onClick={() => setGroups((current) => current.filter((item) => item.id !== group.id))}><X size={16} /></button></header>
      <label><span>Product name (optional)</span><input aria-label={`Product name for group ${index + 1}`} maxLength={160} disabled={uploading} placeholder="Add the name now or in the draft" value={group.name} onChange={(event) => setGroups((current) => current.map((item) => item.id === group.id ? { ...item, name: event.target.value } : item))} /></label>
    </section>)}</div>}
    {grouped && files.length > 0 && <p className="draft-group-progress" role="status">{groups.length} product groups · {files.length} photos · {unassigned.length} unassigned{unassigned.length > 0 ? '. Assign every photo before creating drafts.' : '. Ready to create one draft per product.'}</p>}
    <div className="draft-upload-actions"><span>{files.length ? `${files.length} photo${files.length === 1 ? '' : 's'} selected` : 'No photos selected'}</span><button type="button" className="admin-btn-ghost" disabled={!files.length || uploading} onClick={clear}>Clear</button><button type="button" className="admin-btn" disabled={!ready || uploading} onClick={onUpload}>{uploading ? 'Creating drafts...' : draftCount === 1 ? 'Create one draft' : `Create ${draftCount} drafts`}</button></div>
  </section>;
}
