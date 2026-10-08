import '@testing-library/jest-dom';
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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
  expect(screen.getByText(/optimized below 100 KB/)).toBeInTheDocument();
});

test('excessive sources are rejected with the source limit instead of the old 2 MB restriction', () => {
  render(<Panel />);
  const photo = new File([new Uint8Array(20 * 1024 * 1024 + 1)], 'huge.png', { type: 'image/png' });
  fireEvent.change(screen.getByLabelText('Choose product photos'), { target: { files: [photo] } });
  expect(screen.getByTestId('photo-count')).toHaveTextContent('0');
  expect(screen.getByRole('alert')).toHaveTextContent('20 MB');
});
