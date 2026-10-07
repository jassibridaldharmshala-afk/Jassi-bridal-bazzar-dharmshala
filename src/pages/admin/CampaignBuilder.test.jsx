import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CampaignBuilder, { buildCampaignDraftStorageKey, buildInitialCampaign } from './CampaignBuilder';
import api from '../../services/api';

const mockNotify = jest.fn();
jest.mock('../../services/api', () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn() }));
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { activeMode: 'admin' }, notify: mockNotify }) }));
jest.mock('../../components/admin/ImageUploader', () => ({ label, onChange }) => <button type="button" onClick={() => onChange([{ url: `https://media.example/${label.toLowerCase().replace(/\s/g, '-')}.jpg` }])}>Upload {label}</button>);

const emptyList = { items: [], page: 1, limit: 12, total: 0, totalPages: 1, stats: { total: 0, byStatus: {}, impressions: 0, clicks: 0, orders: 0, revenue: 0 } };

beforeEach(() => {
  jest.clearAllMocks(); localStorage.clear();
  api.get.mockImplementation(async path => path.includes('/coupons/options') ? { items: [] } : emptyList);
  api.post.mockResolvedValue({ _id: 'campaign-1', lifecycle: 'Draft' });
});

test('every campaign preset starts with the safeguards its goal requires', () => {
  const first = buildInitialCampaign('FIRST_ORDER');
  expect(first.offer).toEqual(expect.objectContaining({ customerSegment: 'NEW', firstOrderOnly: true, minOrderAmount: 999, customerLimit: 1 }));
  expect(first.endsAt).toBeTruthy();

  const shipping = buildInitialCampaign('FREE_SHIPPING');
  expect(shipping.offer).toEqual(expect.objectContaining({ activationMode: 'AUTOMATIC', benefitType: 'FREE_SHIPPING', minOrderAmount: 999, maxDiscountAmount: 150 }));

  const festival = buildInitialCampaign('FESTIVAL');
  expect(festival.creative).toEqual(expect.objectContaining({ destinationType: 'COLLECTION', destinationValue: 'Festival Edit' }));
  expect(festival.offer.totalBudget).toBeGreaterThan(0);

  const flash = buildInitialCampaign('FLASH');
  expect(flash.startsAt).toBeTruthy();
  expect(flash.endsAt).toBeTruthy();

  expect(buildInitialCampaign('CATEGORY').creative.destinationType).toBe('CATEGORY');
  expect(buildInitialCampaign('BUY_GET').offer).toEqual(expect.objectContaining({ benefitType: 'BUY_X_GET_Y', buyQuantity: 2, getQuantity: 1 }));
  expect(buildInitialCampaign('REPEAT').offer.minimumPriorOrders).toBe(1);
  expect(buildInitialCampaign('VIP').offer).toEqual(expect.objectContaining({ minimumPriorOrders: 5, minimumLifetimeSpend: 25000, isPublic: false }));
});

test('unsaved campaign drafts are isolated by account, mode and active store', () => {
  expect(buildCampaignDraftStorageKey({ _id: 'owner-1', activeMode: 'seller' }, 'store-a')).toBe('samira_campaign_draft_v2:owner-1:seller:store-a');
  expect(buildCampaignDraftStorageKey({ _id: 'owner-1', activeMode: 'seller' }, 'store-b')).not.toBe(buildCampaignDraftStorageKey({ _id: 'owner-1', activeMode: 'seller' }, 'store-a'));
  expect(buildCampaignDraftStorageKey({ _id: 'owner-2', activeMode: 'admin' }, 'store-a')).not.toBe(buildCampaignDraftStorageKey({ _id: 'owner-1', activeMode: 'seller' }, 'store-a'));
});

test('campaign draft saves one campaign record and keeps publishing as a separate decision', async () => {
  render(<CampaignBuilder />);
  fireEvent.click((await screen.findAllByRole('button', { name: 'Create campaign' }))[0]);
  expect(screen.getByRole('heading', { name: 'Festival sale' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/Campaign name/), { target: { value: 'Diwali discovery' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/campaigns', expect.objectContaining({ name: 'Diwali discovery', preset: 'FESTIVAL', publish: false, offer: expect.objectContaining({ code: 'FESTIVE20' }), creative: expect.objectContaining({ position: 'Home - Middle' }) })));
  expect(api.post.mock.calls.some(([path]) => path.includes('/coupons') || path.includes('/banners'))).toBe(false);
});

test('category campaign guides targeting, responsive creative and publishes through the atomic endpoint', async () => {
  api.get.mockImplementation(async path => {
    if (path.includes('type=CATEGORY')) return { items: [{ id: '507f1f77bcf86cd799439011', label: 'Sarees' }] };
    if (path.includes('/coupons/options')) return { items: [] };
    return emptyList;
  });
  render(<CampaignBuilder />);
  fireEvent.click((await screen.findAllByRole('button', { name: 'Create campaign' }))[0]);
  fireEvent.click(screen.getByRole('button', { name: /Category offer/ }));
  fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
  fireEvent.click(await screen.findByRole('checkbox', { name: /Sarees/ }));
  fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
  expect(screen.getByDisplayValue('CATEGORY15')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Upload Desktop image' }));
  fireEvent.click(screen.getByRole('button', { name: 'Upload Mobile image' }));
  fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
  fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
  expect(screen.getByRole('button', { name: /Desktop/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Mobile/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Publish campaign' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/campaigns', expect.objectContaining({ publish: true, preset: 'CATEGORY', offer: expect.objectContaining({ applicableCategories: ['507f1f77bcf86cd799439011'] }), creative: expect.objectContaining({ destinationType: 'CATEGORY', destinationValue: '507f1f77bcf86cd799439011', image: expect.stringContaining('desktop-image'), mobileImage: expect.stringContaining('mobile-image') }) })));
});

test('campaign list exposes repair, archive and accurate server metrics without client-side totals', async () => {
  const failed = { _id: 'campaign-1', name: 'Broken campaign', preset: 'FESTIVAL', state: 'FAILED', lifecycle: 'Failed', offer: { code: 'BROKEN10', benefitType: 'DISCOUNT', type: 'Percentage', discountValue: 10 }, creative: {}, readiness: { ready: false }, health: { synchronized: false, issues: ['Banner image is required'] }, performance: { impressions: 51, clicks: 7, orders: 2, revenue: 1898 }, lastError: 'Banner image is required' };
  api.get.mockResolvedValue({ ...emptyList, items: [failed], total: 1, stats: { total: 1, byStatus: { Failed: 1 }, impressions: 51, clicks: 7, orders: 2, revenue: 1898 } });
  api.post.mockResolvedValue({ ...failed, state: 'PUBLISHED', lifecycle: 'Live' });
  render(<CampaignBuilder />);
  expect(await screen.findByText('Broken campaign')).toBeInTheDocument();
  expect(screen.getAllByText('51').length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: /Repair/ }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/campaigns/campaign-1/repair', {}));
});

test('campaign insights loads a server-calculated funnel and linked health', async () => {
  const campaign = { _id: 'campaign-2', name: 'Live launch', preset: 'FESTIVAL', state: 'PUBLISHED', lifecycle: 'Live', offer: { code: 'LIVE20', customerSegment: 'VIP', benefitType: 'DISCOUNT', type: 'Percentage', discountValue: 20 }, creative: {}, readiness: { ready: true }, health: { synchronized: true, issues: [] }, schedule: { clear: true, conflicts: [] }, performance: { impressions: 100, clicks: 20, orders: 3, revenue: 4000 } };
  const detail = { ...campaign, linkedCoupon: { code: 'LIVE20' }, linkedBanners: [{ id: 'banner-1' }], performance: { ...campaign.performance, productViews: 12, addToCarts: 7, checkouts: 5, paidOrders: 2, averageOrderValue: 1333, discountCost: 500, uniqueCustomers: 3, cancelled: 0, returned: 1, conversionRate: 15, daily: [] } };
  api.get.mockImplementation(async path => path.includes('/campaigns/campaign-2?') ? detail : { ...emptyList, items: [campaign], total: 1 });
  render(<CampaignBuilder />);
  fireEvent.click(await screen.findByRole('button', { name: /Insights/ }));
  expect(await screen.findByRole('dialog', { name: /Live launch campaign insights/ })).toBeInTheDocument();
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/admin/campaigns/campaign-2?range=30', { silent: true }));
  expect(await screen.findByText('Customer funnel')).toBeInTheDocument();
  expect(screen.getByText(/Coupon, banner and campaign settings are synchronized/)).toBeInTheDocument();
});

test('two campaigns can be compared in the same server reporting window', async () => {
  const campaigns = [
    { _id: 'campaign-a', name: 'Festival edit', preset: 'FESTIVAL', lifecycle: 'Live', offer: { code: 'FEST20' }, creative: {}, performance: { impressions: 100, clicks: 20, ctr: 20, orders: 5, conversionRate: 25, revenue: 5000, averageOrderValue: 1000, discountCost: 500 } },
    { _id: 'campaign-b', name: 'VIP reward', preset: 'VIP', lifecycle: 'Live', offer: { code: 'VIP15' }, creative: {}, performance: { impressions: 80, clicks: 24, ctr: 30, orders: 6, conversionRate: 25, revenue: 7200, averageOrderValue: 1200, discountCost: 650 } },
  ];
  api.get.mockResolvedValue({ ...emptyList, items: campaigns, total: 2 });
  render(<CampaignBuilder />);
  const compareButtons = await screen.findAllByRole('button', { name: 'Compare' });
  fireEvent.click(compareButtons[0]);
  fireEvent.click(compareButtons[1]);
  fireEvent.click(screen.getByRole('button', { name: /Compare results/ }));
  expect(screen.getByRole('dialog', { name: 'Campaign comparison' })).toBeInTheDocument();
  expect(screen.getByText('Rs. 7,200')).toBeInTheDocument();
  expect(screen.getByText(/same server-calculated reporting window/i)).toBeInTheDocument();
});

test('an ended campaign opens directly at schedule controls for extension', async () => {
  const campaign = { _id: 'campaign-ended', name: 'Ended flash', preset: 'FLASH', state: 'PUBLISHED', lifecycle: 'Ended', revision: 2, offer: { code: 'FLASH20' }, creative: {}, performance: {} };
  api.get.mockImplementation(async path => path.includes('/coupons/options') ? { items: [] } : { ...emptyList, items: [campaign], total: 1 });
  render(<CampaignBuilder />);
  fireEvent.click(await screen.findByRole('button', { name: 'Extend' }));
  expect(screen.getByRole('heading', { name: 'Control timing, usage and budget' })).toBeInTheDocument();
  expect(screen.getByText('Step 5 of 6')).toBeInTheDocument();
  await waitFor(() => expect(api.get.mock.calls.filter(([path]) => path.includes('/coupons/options')).length).toBe(3));
});
