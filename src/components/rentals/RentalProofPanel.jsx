import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../services/api';
import { compressImageFile } from '../../services/imageCompression';
import { rentalOperation, rentalUrl } from '../../utils/rentals';
import { RentalField } from './RentalUi';
export default function RentalProofPanel({ booking, base, storeSlug, staff = false, canUpload = false, onChange }) {
  const [data, setData] = useState({ photos: [], pieces: [] }), [images, setImages] = useState({}), [stage, setStage] = useState('HANDOVER'), [assetId, setAssetId] = useState(''), [consent, setConsent] = useState(false), [accepted, setAccepted] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const lock = useRef(false), generation = useRef(0), alive = useRef(true);
  const [selectedReturns, setSelectedReturns] = useState([]);
  const url = `${base}/bookings/${booking._id}`;
  const load = useCallback(async () => {
    const request = ++generation.current;
    try { const value = await api.get(rentalUrl(`${url}/proofs`, storeSlug), { silent: true, forceRefetch: true }); if (request === generation.current) setData({ photos: value.photos || [], pieces: value.pieces || [] }); }
    catch (e) { if (request === generation.current) setError(e.details || e.message); }
  }, [url, storeSlug]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { setData({ photos: [], pieces: [] }); setImages({}); setAccepted(false); load(); return () => { generation.current += 1; }; }, [load, booking.revision]);
  useEffect(() => { setAccepted(false); }, [booking.revision, stage]);
  useEffect(() => { setStage(['OUT', 'RETURNED', 'CLOSED'].includes(booking.status) ? 'RETURN' : 'HANDOVER'); }, [booking.status]);
  const act = async task => {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try { await task(); } catch (e) { if (alive.current) setError(e.details || e.message); } finally { lock.current = false; if (alive.current) setBusy(false); }
  };
  const upload = files => act(async () => {
    if (!consent || !assetId || !files.length || files.length > 4) throw new Error('Choose a piece, record consent and select 1–4 photos.');
    const prepared = [];
    for (const file of files) {
      if (file.size > 20 * 1024 * 1024) throw new Error('Each source photo must be under 20 MB.');
      const compressed = await compressImageFile(file, { maxOriginalSizeMb: 0.7, targetMaxSizeMb: 0.7, targetMinSizeMb: 0.3, maxWidthOrHeight: 1600 });
      if (compressed.size > 1024 * 1024) throw new Error('A compressed photo is still above 1 MB. Choose a smaller image.');
      prepared.push(compressed);
    }
    if (!alive.current) return;
    const result = await api.upload(rentalUrl(`${url}/proofs`, storeSlug), prepared, { silent: true, fields: { stage, assetId, revision: booking.revision, consent: 'true' } });
    if (!alive.current) return;
    onChange?.(result.booking); setData({ photos: result.photos || [], pieces: data.pieces }); setAccepted(false);
  });
  const pieces = data.pieces.length ? data.pieces : (booking.allocations || []);
  const pending = stage === 'HANDOVER' ? pieces : pieces.filter(p => !p.receivedAt && !p.lostAt);
  const chosen = stage === 'HANDOVER' ? pending : pending.filter(p => selectedReturns.includes(String(p.assetId)));
  const acknowledge = () => act(async () => {
    const result = await api.post(rentalUrl(`${url}/acknowledgements`, storeSlug), { revision: booking.revision, operationId: rentalOperation(), stage, accepted, assetIds: chosen.map(p => String(p.assetId)) }, { silent: true });
    if (!alive.current) return;
    onChange?.(result); setAccepted(false);
  });
  const stageOpen = stage === 'HANDOVER' ? ['CONFIRMED', 'PREPARING', 'READY'].includes(booking.status) : booking.status === 'OUT';
  const withdraw = photo => { const note = window.prompt('Reason for correcting this condition photo (previous evidence stays in the private audit record):'); if (!note) return; act(async () => { const result = await api.delete(`${url}/proofs/${photo._id}`, { revision: booking.revision, note }); if (!alive.current) return; onChange?.(result.booking); setData({ photos: result.photos || [], pieces: data.pieces }); setAccepted(false); }); };
  return <section className="rental-card"><h3>Private condition evidence & acknowledgement</h3>
    <p className="rental-muted">Review the actual piece checklist and photos. Customer acknowledgement uses a verified account; it is not an automatically generated signature. Evidence expires 180 days after settlement closes.</p>
    {error && <p role="alert" className="rental-notice">{error}</p>}
    <RentalField label="Evidence stage"><select value={stage} disabled={busy} onChange={e => setStage(e.target.value)}><option value="HANDOVER">Before handover</option><option value="RETURN">At return</option></select></RentalField>
    <ul>{pending.map(p => <li className="rental-muted" key={p.assetId}>{p.code} · {p.label}</li>)}</ul>
    {!staff && stage === 'RETURN' && stageOpen && <div><h4>Pieces you are returning now</h4>{pending.map(p => <label className="rental-check" key={p.assetId}><input type="checkbox" checked={selectedReturns.includes(String(p.assetId))} disabled={busy} onChange={e => { setAccepted(false); setSelectedReturns(ids => e.target.checked ? [...ids, String(p.assetId)] : ids.filter(id => id !== String(p.assetId))); }} />{p.code} · {p.label}</label>)}</div>}
    <div className="rental-proof-photos">{data.photos.filter(p => p.stage === stage).map(photo => <div key={photo._id}>{images[photo._id] ? <img src={images[photo._id]} alt={`${stage.toLowerCase()} condition evidence`} /> : <button type="button" disabled={busy} className="rental-button rental-button--secondary" onClick={() => act(async () => { const result = await api.get(rentalUrl(`${url}/proofs/${photo._id}`, storeSlug), { silent: true }); if (!alive.current) return; setImages(current => ({ ...current, [photo._id]: `data:${result.mimeType};base64,${result.base64}` })); })}>View private photo · {pieces.find(p => String(p.assetId) === String(photo.assetId))?.code || 'piece'}</button>}{staff && canUpload && stageOpen && <button type="button" className="rental-button rental-button--secondary" disabled={busy} onClick={() => withdraw(photo)}>Withdraw incorrect photo</button>}</div>)}</div>
    {staff && canUpload && stageOpen && <fieldset disabled={busy}><RentalField label="Piece being photographed"><select value={assetId} onChange={e => setAssetId(e.target.value)}><option value="">Choose piece</option>{pending.map(p => <option key={p.assetId} value={p.assetId}>{p.code} · {p.label}</option>)}</select></RentalField><label className="rental-check"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />Customer consent to store these condition photos is recorded</label><RentalField label="Upload private condition photos"><input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={!consent || !assetId || busy} onChange={e => { const files = Array.from(e.target.files || []); e.target.value = ''; upload(files); }} /></RentalField></fieldset>}
    {!staff && stageOpen && pending.length > 0 && <><label className="rental-check"><input type="checkbox" checked={accepted} disabled={busy} onChange={e => setAccepted(e.target.checked)} />I reviewed and acknowledge the listed pieces and current condition evidence</label><button type="button" className="rental-button" disabled={!accepted || !chosen.length || busy} onClick={acknowledge}>{busy ? 'Recording…' : 'Acknowledge piece condition'}</button></>}
    <p className="rental-muted">{(booking.acknowledgements || []).filter(a => a.stage === stage).length} recorded customer acknowledgements for this stage. Changed photos/pieces/dates require a fresh acknowledgement when enabled.</p>
    <button type="button" className="rental-button rental-button--secondary" disabled={busy} onClick={load}>Refresh condition evidence</button>
  </section>;
}
