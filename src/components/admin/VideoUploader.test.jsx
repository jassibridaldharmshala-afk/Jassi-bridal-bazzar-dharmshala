import { fireEvent, render, waitFor } from '@testing-library/react';
import VideoUploader from './VideoUploader';
import api from '../../services/api';
const mockNotify = jest.fn();
jest.mock('../../services/api', () => ({ upload: jest.fn() }));
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ notify: mockNotify }) }));
test('failed video re-selection uses the same upload operation, but a completed new selection has its own identity', async () => {
  api.upload.mockRejectedValueOnce(new Error('Upload interrupted')).mockResolvedValue({ files: [{ url: '/uploads/video.mp4' }] });
  const changed = jest.fn(); const { container } = render(<VideoUploader value={[]} onChange={changed} />);
  const select = () => fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [new File(['video'], 'video.mp4', { type: 'video/mp4' })] } });
  select(); await waitFor(() => expect(mockNotify).toHaveBeenCalledWith('Upload interrupted', 'error', 'Product video'));
  select(); await waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
  expect(api.upload.mock.calls[0][2].idempotencyKey).toBe(api.upload.mock.calls[1][2].idempotencyKey);
  select(); await waitFor(() => expect(changed).toHaveBeenCalledTimes(2));
  expect(api.upload.mock.calls[2][2].idempotencyKey).not.toBe(api.upload.mock.calls[1][2].idempotencyKey);
});
