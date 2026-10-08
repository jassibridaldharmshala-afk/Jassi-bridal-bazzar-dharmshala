import { DRAFT_STATUS_TIMEOUT, followDraftUpload } from './draftUploadProgress';

const running = (completedFiles = 0, phase = 'queued') => ({ data: { success: true, data: { upload: { status: 'RUNNING', completedFiles, fileCount: 16, phase } } } });
const complete = { data: { success: true, data: { drafts: [{ _id: 'existing-draft' }] } } };
let clock;
beforeEach(() => { jest.useFakeTimers(); clock = jest.spyOn(Date, 'now').mockReturnValue(1000); });
afterEach(() => { clock.mockRestore(); jest.useRealTimers(); });
async function tick() { jest.advanceTimersByTime(2000); for (let n = 0; n < 12; n++) await Promise.resolve(); }
const args = extra => ({ result: running(), path: '/admin/product-drafts/bulk-upload', key: 'original-key', signal: new AbortController().signal, sameScope: () => true, ...extra });

test('accepted drafts are polled with the same identity until the stored result arrives', async () => {
  const query = jest.fn().mockResolvedValueOnce(running(8, 'storing-displays')).mockResolvedValueOnce(complete);
  const progress = jest.fn();
  const pending = followDraftUpload(args({ query, onProgress: progress }));
  await tick(); await tick();
  expect(await pending).toEqual(complete);
  expect(query).toHaveBeenCalledTimes(2);
  expect(query).toHaveBeenCalledWith(expect.objectContaining({ method: 'GET', url: '/admin/product-drafts/bulk-upload/status', timeout: DRAFT_STATUS_TIMEOUT, headers: { 'Idempotency-Key': 'original-key' } }));
  expect(progress).toHaveBeenCalledWith(expect.objectContaining({ completedFiles: 8 }));
});

test('a stalled server ends waiting with recovery guidance rather than reposting photos', async () => {
  const query = jest.fn().mockResolvedValue(running());
  const pending = followDraftUpload(args({ query }));
  clock.mockReturnValue(122000);
  await tick();
  expect(await pending).toMatchObject({ error: { data: { code: 'UPLOAD_STILL_PROCESSING', message: expect.stringContaining('Check status') } } });
  expect(query).toHaveBeenCalledTimes(1);
});

test('cancel or an account change stops polling without releasing the upload identity', async () => {
  const controller = new AbortController(), query = jest.fn();
  const pending = followDraftUpload(args({ query, signal: controller.signal }));
  controller.abort(); await tick();
  expect(await pending).toMatchObject({ error: { data: { code: 'UPLOAD_WAIT_STOPPED' } } });
  expect(query).not.toHaveBeenCalled();
  expect(await followDraftUpload(args({ query, result: complete, sameScope: () => false }))).toMatchObject({ error: { data: { code: 'UPLOAD_WAIT_STOPPED' } } });
});

test('repeated network failures stop polling and a server failure keeps its correction', async () => {
  const query = jest.fn().mockResolvedValue({ error: { status: 'TIMEOUT_ERROR' } });
  const pending = followDraftUpload(args({ query }));
  await tick(); await tick(); await tick();
  expect(await pending).toMatchObject({ error: { data: { code: 'UPLOAD_STATUS_UNAVAILABLE' } } });
  expect(query).toHaveBeenCalledTimes(3);
  const result = running(); result.data.data.upload = { status: 'PENDING', message: 'Choose a valid JPG photo.' };
  expect(await followDraftUpload(args({ query, result }))).toMatchObject({ error: { data: { message: 'Choose a valid JPG photo.' } } });
});
