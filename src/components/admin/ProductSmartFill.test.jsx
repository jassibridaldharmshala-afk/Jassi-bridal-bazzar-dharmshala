import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import api from '../../services/api';
import ProductSmartFill from './ProductSmartFill';

jest.mock('../../services/api', () => ({ get: jest.fn(), post: jest.fn() }));
const structure = { industry: 'boutique', features: { sizing: true }, attributes: [] };
beforeEach(() => jest.clearAllMocks());
afterEach(() => jest.useRealTimers());

test('opening existing photos makes no AI call; a relevant photo change analyses once and stores reviewed suggestions separately', async () => {
  jest.useFakeTimers();
  api.get.mockResolvedValue({ enabled: true, maxPhotos: 6 });
  api.post.mockResolvedValue({ suggestion: { bridalStyle: { mainColour: 'Blue', metallicTone: 'gold-tone' } }, mode: 'ai', analysisStatus: 'completed', warnings: [] });
  const onAnalysis = jest.fn(), onApply = jest.fn(), form = { images: [{ url: '/uploads/existing.webp' }], bridalStyle: { mainColour: 'Wine' } };
  const props = { form, onAnalysis, onApply, structure, categories: [] };
  const view = render(<ProductSmartFill {...props} />);
  await act(async () => jest.advanceTimersByTime(5000)); expect(api.post).not.toHaveBeenCalled();
  view.rerender(<ProductSmartFill {...props} form={{ ...form, images: [{ url: '/uploads/new.webp' }] }} />);
  await act(async () => {}); await act(async () => jest.advanceTimersByTime(1200));
  expect(api.post).toHaveBeenCalledTimes(1); expect(onAnalysis).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed', suggestion: { mainColour: 'Blue', metallicTone: 'gold-tone' } }));
  expect(onApply).not.toHaveBeenCalled();
  const protectedField = screen.getByText('Visible main colour').closest('label').querySelector('input'); expect(protectedField).toBeDisabled();
  await act(async () => jest.advanceTimersByTime(10000)); expect(api.post).toHaveBeenCalledTimes(1);
});

test('six views are sent together and bridal size suggestions are excluded from review', async () => {
  api.get.mockResolvedValue({ enabled: true, maxPhotos: 6 });
  api.post.mockResolvedValue({ suggestion: { name: 'Wine Embroidered Lehenga', sizes: ['M'], sizingMode: 'sized', highlights: ['Floral embroidery'], description: 'Wine lehenga with visible floral work.' }, mode: 'ai', warnings: [] });
  const onApply = jest.fn();
  render(<ProductSmartFill form={{ name: '', category: '', images: Array.from({ length: 6 }, (_, index) => ({ url: `/uploads/photo-${index}.jpg` })) }} categories={[]} structure={structure} onApply={onApply} />);
  fireEvent.click(screen.getByRole('button', { name: /Smart fill/ }));
  await screen.findByText('6/6 selected');
  fireEvent.click(screen.getByRole('button', { name: 'Suggest details' }));
  await screen.findAllByText('Wine Embroidered Lehenga');
  expect(api.post.mock.calls[0][1].imageUrls).toHaveLength(6);
  expect(screen.queryByText('Available sizes')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Apply .* selected details/ }));
  await waitFor(() => expect(onApply).toHaveBeenCalled());
  expect(onApply.mock.calls[0][0].some(row => ['sizes', 'sizingMode'].includes(row.key))).toBe(false);
});

test('older backend photo limits are respected during rollout', async () => {
  api.get.mockResolvedValue({ enabled: true, maxPhotos: 3 });
  render(<ProductSmartFill form={{ images: Array.from({ length: 6 }, (_, index) => ({ url: `/uploads/old-${index}.jpg` })) }} categories={[]} structure={structure} onApply={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /Smart fill/ }));
  await screen.findByText('3/3 selected');
  expect(screen.getByRole('button', { name: 'Use product photo 4' })).toBeDisabled();
});
