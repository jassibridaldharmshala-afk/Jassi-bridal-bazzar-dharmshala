import { useEffect, useState } from 'react';
import api from '../../services/api';
export default function PrivateEvidenceMedia({ entry }) {
  const [source, setSource] = useState(''), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setSource(''); setError('');
    if (!/^\/api\/evidence\/[a-f0-9]{24}$/i.test(entry.fileUrl || '')) { setError('This historical evidence needs private-storage migration.'); return undefined; }
    const controller = new AbortController(); let url;
    api.file(entry.fileUrl.slice(4), { signal: controller.signal }).then(blob => {
      if (controller.signal.aborted) return;
      url = URL.createObjectURL(blob); setSource(url);
    }).catch(err => { if (!controller.signal.aborted) setError(err.message); });
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [entry.fileUrl, attempt]);
  if (error) return <div role="status"><p>{error}</p>{entry.privateFileId && <button type="button" onClick={() => setAttempt(value => value + 1)}>Retry private evidence</button>}</div>;
  if (!source) return <p role="status">Loading private evidence…</p>;
  return String(entry.mimeType || '').startsWith('video/') ? <video controls preload="metadata" src={source} />
    : <a href={source} target="_blank" rel="noreferrer"><img src={source} alt={entry.type?.replaceAll('_', ' ').toLowerCase() || 'Private evidence'} /></a>;
}

