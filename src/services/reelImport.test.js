jest.mock('./api', () => ({ __esModule: true, default: {} }));

import {
  buildReelProgressSteps,
  reelActivityLabel,
  uploadReelForProcessing,
} from './reelImport';

test('uploads a reel directly to the import endpoint and returns the job', async () => {
  const file = new File(['video'], 'collection.mp4', { type: 'video/mp4' });
  const onRequest = jest.fn();
  const apiClient = {
    upload: jest.fn().mockResolvedValue({ success: true, data: { _id: 'job-1', status: 'queued' } }),
  };

  const result = await uploadReelForProcessing(file, { apiClient, onRequest });

  expect(apiClient.upload).toHaveBeenCalledWith('/admin/reel-imports', [file], {
    fieldName: 'video',
    onRequest,
  });
  expect(result.job).toEqual({ _id: 'job-1', status: 'queued' });
});

test('builds a complete processing timeline from persisted stage history', () => {
  const steps = buildReelProgressSteps({
    status: 'processing',
    progress: { stage: 'extracting_frames' },
    stageHistory: [
      { key: 'queued', status: 'completed' },
      { key: 'preparing_video', status: 'completed' },
      { key: 'downloading_video', status: 'completed' },
      { key: 'reading_video', status: 'completed' },
      { key: 'extracting_frames', status: 'running', message: 'Finding frames' },
    ],
  });

  expect(steps).toHaveLength(10);
  expect(steps.find((step) => step.key === 'extracting_frames')).toMatchObject({
    status: 'running',
    message: 'Finding frames',
  });
  expect(steps.find((step) => step.key === 'saving_frames').status).toBe('pending');
  expect(steps.find((step) => step.key === 'analyzing_details').label).toBe('Smart fill');
});

test('marks the current timeline step failed and reports activity age', () => {
  const job = {
    status: 'failed',
    progress: { stage: 'downloading_video', updatedAt: '2026-09-05T00:00:00.000Z' },
  };
  const steps = buildReelProgressSteps(job);

  expect(steps.find((step) => step.key === 'downloading_video').status).toBe('failed');
  expect(reelActivityLabel(job, new Date('2026-09-05T00:02:00.000Z').getTime())).toBe('Updated 2 minutes ago');
});
