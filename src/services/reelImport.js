import api from './api';

export const REEL_PIPELINE_STEPS = [
  { key: 'queued', label: 'Queued' },
  { key: 'preparing_video', label: 'Prepare' },
  { key: 'downloading_video', label: 'Download' },
  { key: 'reading_video', label: 'Inspect' },
  { key: 'extracting_frames', label: 'Extract' },
  { key: 'analyzing_frames', label: 'Group' },
  { key: 'analyzing_details', label: 'Smart fill' },
  { key: 'saving_frames', label: 'Save photos' },
  { key: 'finalizing_results', label: 'Finalize' },
  { key: 'ready_for_review', label: 'Review' },
];

export function buildReelProgressSteps(job = {}) {
  const history = Array.isArray(job.stageHistory) ? job.stageHistory : [];
  const byKey = new Map();
  history.forEach((entry) => {
    if (entry?.key) byKey.set(entry.key, entry);
  });
  let currentKey = job.progress?.stage || job.health?.stage;
  if (currentKey === 'remote_processing') {
    currentKey = 'analyzing_frames';
    const remote = byKey.get('remote_processing');
    if (remote) byKey.set(currentKey, { ...remote, key: currentKey, label: 'Analyze' });
  }
  const currentIndex = REEL_PIPELINE_STEPS.findIndex((step) => step.key === currentKey);

  return REEL_PIPELINE_STEPS.map((step, index) => {
    const tracked = byKey.get(step.key);
    let status = tracked?.status || 'pending';
    if (!tracked && currentIndex > index) status = 'completed';
    if (step.key === currentKey && !['failed', 'cancelled', 'completed'].includes(status)) status = 'running';
    if (step.key === currentKey && job.status === 'failed') status = 'failed';
    if (step.key === currentKey && job.status === 'cancelled') status = 'cancelled';
    if (step.key === 'ready_for_review' && ['review_required', 'completed'].includes(job.status)) status = 'completed';
    return { ...step, ...tracked, status };
  });
}

export function reelActivityLabel(job = {}, now = Date.now()) {
  const value = job.health?.lastActivityAt || job.progress?.updatedAt || job.updatedAt;
  const timestamp = value ? new Date(value).getTime() : NaN;
  if (!Number.isFinite(timestamp)) return 'Waiting for the first worker update';
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 10) return 'Updated just now';
  if (seconds < 60) return `Updated ${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Updated ${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  return `Updated ${hours} hour${hours === 1 ? '' : 's'} ago`;
}

export async function uploadReelForProcessing(file, { apiClient = api, onRequest } = {}) {
  if (!file) throw new Error('Please select a reel first.');
  const response = await apiClient.upload('/admin/reel-imports', [file], {
    fieldName: 'video',
    onRequest,
  });
  const job = response?.data || response;
  if (!job || (!job._id && !job.id)) {
    throw new Error('The server did not create a reel import job. Please try again.');
  }
  return {
    response,
    job,
  };
}
