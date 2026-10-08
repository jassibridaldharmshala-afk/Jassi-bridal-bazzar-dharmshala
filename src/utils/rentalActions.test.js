import { rentalNextAction } from './rentalActions';
test('next action advances through pieces and settlement and respects staff permission', () => {
  const b = { status: 'RETURNED', allocations: [{ receivedAt: 'today' }], financial: { refundablePaise: 50000 }, requests: [], ledger: [] };
  expect(rentalNextAction(b)).toBe('INSPECT');
  b.allocations[0].disposition = 'CLEANING'; expect(rentalNextAction(b)).toBe('RELEASE');
  b.allocations[0].readyAt = 'today'; expect(rentalNextAction(b)).toBe('REFUND');
  expect(rentalNextAction(b, { 'returns.refund': false })).toBe('');
  b.financial.refundablePaise = 0; b.requests = [{ status: 'PENDING' }]; expect(rentalNextAction(b)).toBe('REQUEST');
  b.requests[0].status = 'RESOLVED'; expect(rentalNextAction(b)).toBe('CLOSE');
});
