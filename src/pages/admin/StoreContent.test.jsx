import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import StoreContent from './StoreContent';
import api from '../../services/api';

const mockRefresh = jest.fn();
jest.mock('../../services/api', () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() }));
jest.mock('../../context/WebsiteCustomizationContext', () => ({ useWebsiteCustomization: () => ({ refresh: mockRefresh }) }));

const section = { id: 'hero', label: 'Hero Section', heading: 'New arrivals', description: 'Fresh styles', buttonText: 'Shop', buttonLink: '/products', imageAlt: '', hasImage: false };
const data = {
  available: true, scope: 'theme', revision: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z',
  draft: { sections: [section], blocks: [] }, published: { sections: [section], blocks: [] },
  limits: { sectionHeading: 160, sectionDescription: 600, buttonText: 80, buttonLink: 500, blockEyebrow: 80, blockTitle: 140, blockBody: 1200, altText: 180, item: 160, note: 240 },
  managed: { settingsPath: '/admin/settings', groups: [{ id: 'identity', label: 'Store identity', enabled: true, fields: [{ label: 'Company / store name', value: 'Client shop' }] }] },
  scheduledFor: null, scheduledDesignFor: null, publishedAt: '2026-09-01T00:00:00Z', publishedBy: 'Owner',
  capabilities: { read: true, write: true, publish: true }, previewConfig: { homepage: { sections: [section], blocks: [] } }, timezone: 'Asia/Kolkata',
};

beforeEach(() => {
  jest.clearAllMocks(); localStorage.clear();
  api.get.mockImplementation((path) => Promise.resolve(path.includes('/history') ? { items: [], pagination: { page: 1, hasMore: false, total: 0 } } : data));
  mockRefresh.mockResolvedValue();
});

test('saves wording as a draft without publishing layout fields', async () => {
  api.put.mockResolvedValue({ revision: '2026-09-02T00:00:00Z', updatedAt: '2026-09-02T00:00:00Z' });
  render(<StoreContent route="/admin/store-content" />);
  const heading = (await screen.findAllByLabelText('Section heading'))[0];
  fireEvent.change(heading, { target: { value: 'Festive arrivals' } });
  fireEvent.click(screen.getByRole('button', { name: /Save draft/i }));
  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/admin/store-content/draft', {
    revision: data.revision,
    content: { sections: [{ ...section, heading: 'Festive arrivals' }], blocks: [] },
  }));
  expect(await screen.findByText('Draft saved. Your live storefront has not changed.')).toBeInTheDocument();
  expect(mockRefresh).not.toHaveBeenCalled();
});

test('shows Settings-owned identity as read-only with its edit destination', async () => {
  render(<StoreContent route="/admin/store-content" />);
  expect(await screen.findByText('Identity, contact and announcement')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Store identity'));
  expect(screen.getByDisplayValue('Client shop')).toHaveAttribute('readonly');
  expect(screen.getByRole('link', { name: /Edit in Settings/i })).toHaveAttribute('href', '/admin/settings');
});

test('reviews exact content changes before publishing', async () => {
  api.post.mockResolvedValue({ ready: true, warnings: [], scheduledDesignUpdated: false, changes: [{ path: 'sections.hero.heading', before: 'New arrivals', after: 'Wedding edit' }] });
  render(<StoreContent route="/admin/store-content" />);
  fireEvent.change((await screen.findAllByLabelText('Section heading'))[0], { target: { value: 'Wedding edit' } });
  fireEvent.click(screen.getByRole('button', { name: /^Review$/i }));
  expect(await screen.findByRole('dialog', { name: 'Review storefront changes' })).toBeInTheDocument();
  expect(screen.getByText(/1 field will change/i)).toBeInTheDocument();
});

test('missing published configuration links directly to Website Designer', async () => {
  api.get.mockImplementation((path) => Promise.resolve(path.includes('/history') ? [] : { available: false, designerPath: '/admin/customization' }));
  render(<StoreContent route="/admin/store-content" />);
  expect(await screen.findByText('Publish your first website design')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Open Website Designer' })).toHaveAttribute('href', '/admin/customization');
});

test('keeps an expanded editor open while typing', async () => {
  render(<StoreContent route="/admin/store-content" />);
  const heading = (await screen.findAllByLabelText('Section heading'))[0];
  fireEvent.change(heading, { target: { value: 'A premium festive collection' } });
  expect(screen.getByRole('button', { name: /Hero Section/i })).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByLabelText('Section heading')).toHaveValue('A premium festive collection');
});

test('preserves and merges a stale browser recovery instead of deleting it', async () => {
  const recovered = { ...section, heading: 'Recovered festive copy' };
  localStorage.setItem('samira_content_studio_admin', JSON.stringify({ revision: 'older-revision', baseContent: data.draft, content: { sections: [recovered], blocks: [] }, savedAt: new Date().toISOString() }));
  render(<StoreContent route="/admin/store-content" />);
  expect(await screen.findByText('Unsaved edits from an older server version')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Merge my edits' }));
  expect(screen.getByLabelText('Section heading')).toHaveValue('Recovered festive copy');
  expect(localStorage.getItem('samira_content_studio_admin')).not.toBeNull();
});

test('schedules the exact local instant and saves the edited server draft', async () => {
  const scheduledDraft = { sections: [{ ...section, heading: 'Scheduled collection' }], blocks: [] };
  api.post.mockImplementation((path) => {
    if (path.endsWith('/preflight')) return Promise.resolve({ ready: true, blocking: [], warnings: [], scheduledDesignUpdated: false, changes: [{ path: 'sections.hero.heading', before: section.heading, after: 'Scheduled collection' }] });
    if (path.endsWith('/schedule')) return Promise.resolve({ revision: '2026-09-03T00:00:00Z', updatedAt: '2026-09-03T00:00:00Z', draft: scheduledDraft, scheduledFor: '2026-12-01T04:30:00.000Z', scheduledNote: 'Launch', scheduledStatus: 'SCHEDULED' });
    return Promise.resolve({});
  });
  render(<StoreContent route="/admin/store-content" />);
  fireEvent.change((await screen.findAllByLabelText('Section heading'))[0], { target: { value: 'Scheduled collection' } });
  fireEvent.click(screen.getByRole('button', { name: /^Review$/i }));
  await screen.findByRole('dialog', { name: 'Review storefront changes' });
  const localValue = localDateFuture();
  fireEvent.change(screen.getByLabelText(/Schedule for later/i), { target: { value: localValue } });
  fireEvent.click(screen.getByRole('button', { name: /^Schedule$/i }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/store-content/schedule', expect.objectContaining({
    revision: data.revision, content: scheduledDraft, scheduledFor: new Date(localValue).toISOString(), replaceExisting: false,
  })));
  expect(await screen.findByText(/Content scheduled for/i)).toBeInTheDocument();
});

test('adds and removes bounded custom block items', async () => {
  const faq = { id: 'faq-1', type: 'faq', eyebrow: '', title: 'Questions', body: '', buttonText: '', buttonLink: '', altText: '', items: ['Delivery?|In 3 days'], hasImage: false, visible: true };
  api.get.mockImplementation((path) => Promise.resolve(path.includes('/history') ? { items: [], pagination: { page: 1, hasMore: false, total: 0 } } : {
    ...data,
    draft: { sections: [section], blocks: [faq] },
    published: { sections: [section], blocks: [faq] },
    previewConfig: { homepage: { sections: [section], blocks: [faq] } },
  }));
  render(<StoreContent route="/admin/store-content" />);
  fireEvent.click(await screen.findByRole('button', { name: /Faq block/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Add FAQ' }));
  expect(screen.getByLabelText('FAQ question 2')).toHaveValue('Question');
  expect(screen.getByLabelText('FAQ answer 2')).toHaveValue('Answer');
  fireEvent.click(screen.getByRole('button', { name: 'Remove FAQ item 1' }));
  expect(screen.getByLabelText('FAQ question 1')).toHaveValue('Question');
});

function localDateFuture() {
  const date = new Date(Date.now() + 3 * 86400000);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
