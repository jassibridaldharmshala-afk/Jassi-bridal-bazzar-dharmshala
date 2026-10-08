import '@testing-library/jest-dom';
import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
jest.mock('../../services/api', () => ({ upload: jest.fn() }));
import api from '../../services/api';
import DraftPhotoUploadPanel from './DraftPhotoUploadPanel';

beforeEach(() => {
  URL.createObjectURL = jest.fn(() => 'blob:preview');
  URL.revokeObjectURL = jest.fn();
});

function Panel() {
  const [files, setFiles] = useState([]), [groups, setGroups] = useState([]), [groupMode, setGroupMode] = useState('separate');
  return <><output data-testid="photo-count">{files.length}</output><DraftPhotoUploadPanel {...{ files, setFiles, groups, setGroups, groupMode, setGroupMode }} groupingSupported uploading={false} onUpload={jest.fn()} onClose={jest.fn()} /></>;
}

test('draft selection accepts a photo larger than 2 MB for automatic compression before upload', () => {
  render(<Panel />);
  const photo = new File([new Uint8Array(3 * 1024 * 1024)], 'bridal.jpg', { type: 'image/jpeg' });
  fireEvent.change(screen.getByLabelText('Choose product photos'), { target: { files: [photo] } });
  expect(screen.getByTestId('photo-count')).toHaveTextContent('1');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByText(/Original quality preserved/)).toBeInTheDocument();
});

test('excessive sources are rejected with the source limit instead of the old 2 MB restriction', () => {
  render(<Panel />);
  const photo = new File([new Uint8Array(20 * 1024 * 1024 + 1)], 'huge.png', { type: 'image/png' });
  fireEvent.change(screen.getByLabelText('Choose product photos'), { target: { files: [photo] } });
  expect(screen.getByTestId('photo-count')).toHaveTextContent('0');
  expect(screen.getByRole('alert')).toHaveTextContent('20 MB');
});

test('AI group suggestions require review and applying keeps all original photos', async () => {
  api.upload.mockResolvedValue({ photoCount: 3, groups: [{ indices: [0, 2], name: 'Lehenga', confidence: 0.9 }, { indices: [1], name: 'Necklace', confidence: 0.4 }], reviewRequired: true });
  render(<Panel />);
  const files = [0, 1, 2].map(i => new File(['source-' + i], 'photo-' + i + '.jpg', { type: 'image/jpeg' }));
  fireEvent.change(screen.getByLabelText('Choose product photos'), { target: { files } });
  fireEvent.click(screen.getByRole('button', { name: 'Suggest photo groups with AI' }));
  await screen.findByRole('button', { name: 'Apply reviewed groups' });
  expect(screen.queryByLabelText('Product photo groups')).not.toBeInTheDocument();
  expect(api.upload).toHaveBeenCalledWith('/admin/products/photo-grouping', files, expect.objectContaining({ silent: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Apply reviewed groups' }));
  expect(screen.getByText('Product 1 · 2 photos')).toBeInTheDocument(); expect(screen.getByText('Product 2 · 1 photos')).toBeInTheDocument();
  expect(screen.getByTestId('photo-count')).toHaveTextContent('3');
});

test('upload progress reports completed photos and explains stopping the wait', () => {
  const stop = jest.fn();
  const files = [new File(['original'], 'bridal.png', { type: 'image/png' })];
  render(<DraftPhotoUploadPanel files={files} groups={[]} groupMode="separate" setFiles={jest.fn()} setGroups={jest.fn()} setGroupMode={jest.fn()} uploading uploadProgress={{ phase: 'storing-original', photoIndex: 1, fileCount: 16, completedFiles: 2 }} onStopWaiting={stop} onUpload={jest.fn()} />);
  expect(screen.getByRole('status')).toHaveTextContent('Photo 1: saving the original photo');
  expect(screen.getByRole('status')).toHaveTextContent('2 of 16 photos fully saved');
  expect(screen.getByRole('status')).toHaveTextContent('processing already accepted by the server continues');
  fireEvent.click(screen.getByRole('button', { name: 'Stop waiting' }));
  expect(stop).toHaveBeenCalledTimes(1);
});

test('an interrupted upload offers status recovery with the retained selection', () => {
  const files = [new File(['original'], 'bridal.png', { type: 'image/png' })];
  render(<DraftPhotoUploadPanel files={files} groups={[]} groupMode="separate" setFiles={jest.fn()} setGroups={jest.fn()} setGroupMode={jest.fn()} uploading={false} uploadProgress={{ phase: 'retry', message: 'Storage is slow. Check this upload again.' }} onUpload={jest.fn()} />);
  expect(screen.getByRole('button', { name: 'Retry / check status' })).toBeEnabled();
  expect(screen.getByRole('alert')).toHaveTextContent('Storage is slow');
});
