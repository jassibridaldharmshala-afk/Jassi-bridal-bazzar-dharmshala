// Original batches can be up to 60 MB. Allow a slow photo transfer, then use
// short status reads rather than holding a request open for image processing.
export const DRAFT_UPLOAD_TIMEOUT = 5 * 60 * 1000;
export const DRAFT_STATUS_TIMEOUT = 15000;
const POLL_INTERVAL = 2000;
const MAX_WAIT = 10 * 60 * 1000;
const STALLED_AFTER = 2 * 60 * 1000;

function error(message, code = 'UPLOAD_STATUS_UNAVAILABLE') {
  return { error: { status: 408, data: { code, message } } };
}
function pause(signal) {
  return new Promise(resolve => {
    const finish = () => { clearTimeout(timer); signal?.removeEventListener('abort', finish); resolve(); };
    const timer = setTimeout(finish, POLL_INTERVAL);
    signal?.addEventListener('abort', finish, { once: true });
    if (signal?.aborted) finish();
  });
}

// An accepted upload continues on the server if this tab stops waiting. Every
// poll and retry uses its original account/store-scoped upload identity.
export async function followDraftUpload({ result, query, path, key, signal, onProgress, sameScope }) {
  const start = Date.now();
  let lastProgressAt = start, fingerprint = '', failedReads = 0;
  while (result.data?.data?.upload) {
    if (signal?.aborted || !sameScope()) return error('Waiting stopped. Your selected photos are kept. Check status with the same selection before starting another upload.', 'UPLOAD_WAIT_STOPPED');
    const progress = result.data.data.upload;
    onProgress?.(progress);
    if (progress.status !== 'RUNNING') return error(progress.message || 'Processing was interrupted. Retry with the same selected photos to continue safely.', 'UPLOAD_RETRY_REQUIRED');
    const nextFingerprint = JSON.stringify([progress.completedFiles, progress.phase, progress.photoIndex]);
    if (fingerprint !== nextFingerprint) { fingerprint = nextFingerprint; lastProgressAt = Date.now(); }
    if (Date.now() - start >= MAX_WAIT || Date.now() - lastProgressAt >= STALLED_AFTER) {
      return error('The server is taking longer than expected. Your photos are kept. Check status with this same selection; an active upload will not be started twice.', 'UPLOAD_STILL_PROCESSING');
    }
    await pause(signal);
    if (signal?.aborted || !sameScope()) continue;
    const next = await query({ url: `${path}/status`, method: 'GET', headers: { 'Idempotency-Key': key }, timeout: DRAFT_STATUS_TIMEOUT, silent: true });
    if (next.error) {
      if (['FETCH_ERROR', 'TIMEOUT_ERROR', 502, 503, 504].includes(next.error.status) && ++failedReads < 3) continue;
      return ['FETCH_ERROR', 'TIMEOUT_ERROR', 502, 503, 504].includes(next.error.status)
        ? error('Upload status could not be reached. Your selected photos are kept. Check status again to recover the existing upload.') : next;
    }
    failedReads = 0;
    result = next;
  }
  return sameScope() && !signal?.aborted ? result : error('Your session changed or waiting stopped. Check status with the original account and selection.', 'UPLOAD_WAIT_STOPPED');
}

export function draftUploadMessage(progress = {}) {
  const photo = progress.photoIndex ? `Photo ${progress.photoIndex}: ` : '';
  const labels = {
    preparing: 'Checking photos and preparing a safe upload…',
    uploading: 'Sending original photos to the store…',
    queued: 'Photos received. Waiting for processing…',
    optimizing: `${photo}preserving detail and removing private metadata…`,
    'storing-original': `${photo}saving the original photo…`,
    'creating-displays': `${photo}creating display copies…`,
    'storing-displays': `${photo}saving display copies…`,
    'saving-drafts': 'Photos saved. Creating product drafts…',
    retry: progress.message || 'Check status to continue the existing upload.',
  };
  return labels[progress.phase] || 'Checking draft creation…';
}
