import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CompleteLook from './CompleteLook';
import api from '../../services/api';
jest.mock('../../services/api', () => ({ get: jest.fn(), post: jest.fn() }));
const mockAdd = jest.fn(), mockAppend = jest.fn();
let mockItems = [];
let mockUser = null;
jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('../../context/CartContext', () => ({ useCart: () => ({ items: [], addToCartConfirmed: mockAdd }) }));
jest.mock('../../context/RentalBagContext', () => ({ useRentalBag: () => ({ items: mockItems, ready: true, addMany: mockAppend }) }));
const outfitId = '700000000000000000000001', offerId = '700000000000000000000002', accessoryId = '700000000000000000000003', otherOffer = '700000000000000000000004';
const product = { _id: accessoryId, name: 'Matching necklace', slug: 'matching-necklace', price: 900, stock: 10, images: [], look: { group: 'necklace', reason: 'Gold-tone finish coordinates with visible work.', mode: 'rent', selectedOptionId: otherOffer, availability: 'DATES_REQUIRED', options: [{ id: otherOffer, listingId: otherOffer, mode: 'rent', dailyRatePaise: 20000, depositPaise: 30000, unit: 'set', size: '' }] } };
const rental = { listingId: offerId, data: { policy: { timezone: 'Asia/Kolkata', minimumDays: 1, maximumDays: 90, pickupStart: '10:00', pickupEnd: '18:00', slotMinutes: 60, paymentPlans: ['ADVANCE'] } } };
const quote = { quoteFingerprint: 'fresh', quote: { rentalPaise: 84000, depositPaise: 43000, totalPaise: 127000, dueNowPaise: 25000, remainingPaise: 102000 } };
beforeEach(() => { jest.clearAllMocks(); sessionStorage.clear(); mockUser = null; mockItems = []; mockAppend.mockReturnValue(true); mockAdd.mockResolvedValue({ ok: true }); api.post.mockResolvedValue(quote); api.get.mockResolvedValue({ enabled: true, products: [product] }); });
test('rent context is store scoped, optional and dates never promise availability', async () => {
  render(<CompleteLook productId={outfitId} storeSlug="boutique" navigate={jest.fn()} mode="rent" colour="Wine" quantity={2} rental={rental} />);
  expect(await screen.findByText('Matching necklace')).toBeInTheDocument();
  const url = new URL(api.get.mock.calls[0][0], 'http://test'); const context = JSON.parse(url.searchParams.get('context'));
  expect(url.searchParams.get('mode')).toBe('rent'); expect(url.searchParams.get('store')).toBe('boutique'); expect(context.sourceListingId).toBe(offerId); expect(context.colour).toBe('Wine');
  expect(screen.queryByText(/Available for selected dates/)).not.toBeInTheDocument(); expect(mockAppend).not.toHaveBeenCalled(); expect(api.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByLabelText('Add to my look')); await waitFor(() => expect(screen.getByText('Add selected accessories')).toBeEnabled()); fireEvent.click(screen.getByText('Add selected accessories'));
  await waitFor(() => expect(mockAppend).toHaveBeenCalledWith([{ listingId: offerId, quantity: 2 }, { listingId: otherOffer, quantity: 1 }])); expect(mockAdd).not.toHaveBeenCalled();
});
test('fresh period quote is displayed and existing bag outfit quantity is preserved', async () => {
  mockItems = [{ listingId: offerId, quantity: 3 }];
  const { saveRentalSession } = require('../../utils/rentalPlan'); saveRentalSession('checkout-dates', 'boutique', { useStart: '2027-01-12', pickupAt: '2027-01-11T10:00', returnDueAt: '2027-01-13T10:00' });
  api.get.mockResolvedValue({ enabled: true, products: [{ ...product, look: { ...product.look, availability: 'AVAILABLE' } }] });
  render(<CompleteLook productId={outfitId} storeSlug="boutique" navigate={jest.fn()} mode="rent" rental={rental} />);
  fireEvent.click(await screen.findByLabelText('Add to my look'));
  expect(await screen.findByText('₹1,270.00', {}, { timeout: 2500 })).toBeInTheDocument(); expect(screen.getByText('₹1,020.00')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Add selected accessories'));
  await waitFor(() => expect(mockAppend).toHaveBeenCalledWith([{ listingId: otherOffer, quantity: 1 }]));
  expect(api.post.mock.calls.at(-1)[1].items).toEqual([{ listingId: offerId, quantity: 3 }, { listingId: otherOffer, quantity: 1 }]);
  expect(require('../../utils/rentalPlan').readRentalSession('checkout-dates', 'boutique').useStart).toBe('2027-01-12');
});
test('bangle size must be deliberately selected and exact listing is appended', async () => {
  const big = '700000000000000000000005';
  api.get.mockResolvedValue({ enabled: true, products: [{ ...product, name: 'Wine bangles', look: { ...product.look, group: 'bangles', options: [{ ...product.look.options[0], size: '2.4' }, { ...product.look.options[0], id: big, listingId: big, size: '2.6' }] } }] });
  render(<CompleteLook productId={outfitId} navigate={jest.fn()} mode="rent" rental={rental} />);
  expect(await screen.findByLabelText('Add to my look')).toBeDisabled(); fireEvent.change(screen.getByLabelText('Bangle size'), { target: { value: big } });
  await waitFor(() => expect(screen.getByLabelText('Add to my look')).toBeEnabled());
  fireEvent.click(screen.getByLabelText('Add to my look')); await waitFor(() => expect(screen.getByText('Add selected accessories')).toBeEnabled()); fireEvent.click(screen.getByText('Add selected accessories'));
  await waitFor(() => expect(mockAppend).toHaveBeenCalledWith(expect.arrayContaining([{ listingId: big, quantity: 1 }])));
});
test('sale accessories use confirmed sale cart mutation and never rental append', async () => {
  api.get.mockResolvedValue({ enabled: true, products: [{ ...product, look: { ...product.look, mode: 'buy', availability: 'IN_STOCK', selectedOptionId: 'sale:Gold', options: [{ id: 'sale:Gold', mode: 'buy', size: '', colour: 'Gold', price: 900, unit: 'set' }] } }] });
  render(<CompleteLook productId={outfitId} navigate={jest.fn()} />);
  fireEvent.click(await screen.findByLabelText('Add to my look')); await waitFor(() => expect(screen.getByText('Add selected accessories')).toBeEnabled()); fireEvent.click(screen.getByText('Add selected accessories'));
  await waitFor(() => expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({ _id: accessoryId }), '', 'Gold', '', 1)); expect(mockAppend).not.toHaveBeenCalled();
});
test('unavailable options are disabled; errors retry and empty state stays understandable', async () => {
  api.get.mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce({ enabled: true, products: [{ ...product, look: { ...product.look, availability: 'UNAVAILABLE' } }] }).mockResolvedValue({ enabled: true, products: [] });
  render(<CompleteLook productId={outfitId} navigate={jest.fn()} mode="rent" rental={rental} />);
  fireEvent.click(await screen.findByText('Retry matching accessories')); expect(await screen.findByLabelText('Add to my look')).toBeDisabled();
  fireEvent.click(screen.getByLabelText('Refresh matching accessories')); expect(await screen.findByText('No suitable accessories for this selection yet.')).toBeInTheDocument();
});
test('stale results cannot replace suggestions after colour changes', async () => {
  let resolveOld; api.get.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; })).mockResolvedValue({ enabled: true, products: [] });
  const view = render(<CompleteLook productId={outfitId} navigate={jest.fn()} colour="Wine" />);
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1)); view.rerender(<CompleteLook productId={outfitId} navigate={jest.fn()} colour="Blue" />);
  expect(await screen.findByText('No suitable accessories for this selection yet.')).toBeInTheDocument(); resolveOld({ enabled: true, products: [product] });
  await new Promise(resolve => setTimeout(resolve, 50)); expect(screen.queryByText('Matching necklace')).not.toBeInTheDocument();
});

test('OTP remount restores selections after the exact rental offer finishes loading', async () => {
  const { saveRentalSession, readRentalSession } = require('../../utils/rentalPlan');
  saveRentalSession('look-selection', 'boutique', { scope: `boutique:${outfitId}:rent:::${offerId}`, selected: { [accessoryId]: otherOffer }, choices: { [accessoryId]: otherOffer } });
  mockUser = { _id: 'signed-in' };
  const view = render(<CompleteLook productId={outfitId} storeSlug="boutique" navigate={jest.fn()} mode="rent" />);
  expect(api.get).not.toHaveBeenCalled(); expect(readRentalSession('look-selection', 'boutique').selected[accessoryId]).toBe(otherOffer);
  view.rerender(<CompleteLook productId={outfitId} storeSlug="boutique" navigate={jest.fn()} mode="rent" rental={rental} />);
  expect(await screen.findByLabelText('Selected')).toBeChecked();
  expect(readRentalSession('look-selection', 'boutique', 'signed-in').selected[accessoryId]).toBe(otherOffer);
  expect(readRentalSession('look-selection', 'boutique')).toBeNull();
  mockUser = { _id: 'other-account' }; view.rerender(<CompleteLook productId={outfitId} storeSlug="boutique" navigate={jest.fn()} mode="rent" rental={rental} />);
  await waitFor(() => expect(screen.getByLabelText('Add to my look')).not.toBeChecked());
});

test('account changes during a fresh quote prevent additions to another account bag', async () => {
  const { saveRentalSession } = require('../../utils/rentalPlan'); saveRentalSession('checkout-dates', '', { useStart: '2027-01-12', pickupAt: '2027-01-11T10:00', returnDueAt: '2027-01-13T10:00' });
  let finish; api.post.mockResolvedValueOnce(quote).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const view = render(<CompleteLook productId={outfitId} navigate={jest.fn()} mode="rent" rental={rental} />);
  fireEvent.click(await screen.findByLabelText('Add to my look')); await screen.findByText('₹1,270.00', {}, { timeout: 2500 }); fireEvent.click(screen.getByText('Add selected accessories'));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2)); mockUser = { _id: 'other' }; view.rerender(<CompleteLook productId={outfitId} navigate={jest.fn()} mode="rent" rental={rental} />);
  finish(quote); await screen.findByText(/Your account or product selection changed/); expect(mockAppend).not.toHaveBeenCalled();
});

test('a legacy server response with no look options shows a retry state instead of crashing the product page', async () => {
  // Shape observed from the running local backend, despite its HTTP 200 status.
  api.get.mockResolvedValueOnce({ enabled: true, strategy: 'CONTEXT_MATCHED', products: [{ _id: accessoryId, name: 'Bridal Necklace Set', stock: 2, images: [], discoveryPurchase: 'SALE' }] }).mockResolvedValue({ enabled: true, products: [product] });
  render(<CompleteLook productId={outfitId} navigate={jest.fn()} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Matching accessories are temporarily unavailable');
  fireEvent.click(screen.getByText('Retry matching accessories'));
  expect(await screen.findByText('Matching necklace')).toBeInTheDocument();
});

test('a cancelled slow Rent request cannot fail or cancel the current Buy request', async () => {
  let finishRent, finishBuy;
  api.get.mockImplementationOnce(() => new Promise(resolve => { finishRent = resolve; })).mockImplementationOnce(() => new Promise(resolve => { finishBuy = resolve; }));
  const view = render(<CompleteLook productId={outfitId} navigate={jest.fn()} mode="rent" rental={rental} />);
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
  const rentSignal = api.get.mock.calls[0][1].signal;
  view.rerender(<CompleteLook productId={outfitId} navigate={jest.fn()} mode="buy" rental={rental} />);
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  const buySignal = api.get.mock.calls[1][1].signal;
  expect(rentSignal.aborted).toBe(true); expect(buySignal.aborted).toBe(false);
  finishRent({ enabled: true, products: [product] });
  finishBuy({ enabled: true, products: [] });
  expect(await screen.findByText('No suitable accessories for this selection yet.')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(buySignal.aborted).toBe(false);
});
