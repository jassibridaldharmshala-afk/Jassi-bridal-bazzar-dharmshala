import { rentalNextAction, rentalActionAvailable, rentalActionPieces, rentalRefundReceiptRemaining } from './rentalActions';
test('next action advances through pieces and settlement and respects staff permission', () => {
  const b = { status: 'RETURNED', allocations: [{ receivedAt: 'today' }], financial: { refundablePaise: 50000 }, requests: [], ledger: [] };
  expect(rentalNextAction(b)).toBe('INSPECT');
  b.allocations[0].disposition = 'CLEANING'; expect(rentalNextAction(b)).toBe('RELEASE');
  b.allocations[0].readyAt = 'today'; expect(rentalNextAction(b)).toBe('REFUND');
  expect(rentalNextAction(b, { 'returns.refund': false })).toBe('');
  b.financial.refundablePaise = 0; b.requests = [{ status: 'PENDING' }]; expect(rentalNextAction(b)).toBe('REQUEST');
  b.requests[0].status = 'RESOLVED'; expect(rentalNextAction(b)).toBe('CLOSE');
});

test('partially returned sets prompt inspection and cleaning without selecting outstanding or released pieces', () => {
  const b = { status: 'OUT', allocations: [
    { assetId: 'inspect', receivedAt: 'today' },
    { assetId: 'clean', receivedAt: 'today', disposition: 'CLEANING' },
    { assetId: 'lost', lostAt: 'today', disposition: 'LOST' },
    { assetId: 'done', receivedAt: 'today', disposition: 'REPAIR', readyAt: 'today' },
    { assetId: 'out' },
  ] };
  expect(rentalNextAction(b)).toBe('INSPECT');
  expect(rentalActionPieces('INSPECT', b).map(p => p.assetId)).toEqual(['inspect']);
  expect(rentalActionPieces('RELEASE', b).map(p => p.assetId)).toEqual(['clean', 'lost']);
  expect(rentalActionPieces('RECEIVE', b).map(p => p.assetId)).toEqual(['out']);
  expect(rentalNextAction(b, { 'returns.qc': false })).toBe('');
  b.allocations[0].disposition = 'CLEANING';
  expect(rentalNextAction(b)).toBe('RELEASE');
});

test('refund eligibility follows return inspection, partial cancellation and explicit reopening of closed settlements', () => {
  const b = { status: 'RETURNED', allocations: [{ receivedAt: 'today' }], financial: { refundablePaise: 20000 } };
  expect(rentalActionAvailable('REFUND', b)).toBe(false);
  b.allocations[0].disposition = 'CLEANING';
  expect(rentalActionAvailable('REFUND', b)).toBe(true);
  b.status = 'READY';
  expect(rentalActionAvailable('REFUND', b)).toBe(false);
  b.cancelledItems = [{ listingId: 'cancelled-line' }];
  expect(rentalActionAvailable('REFUND', b)).toBe(true);
  b.status = 'CLOSED';
  expect(rentalActionAvailable('REFUND', b)).toBe(false);
  expect(rentalActionAvailable('REOPEN_SETTLEMENT', b)).toBe(true);
  b.status = 'CANCELLED';
  expect(rentalActionAvailable('REFUND', b)).toBe(true);
});

test('pending and processed refunds reserve their original receipt, while failed refunds release it', () => {
  const receipt = { kind: 'COLLECTION', reference: 'CASH-1', amountPaise: 100000 };
  const b = { ledger: [
    receipt,
    { kind: 'REFUND', reference: 'CASH-1', amountPaise: 60000, status: 'PROCESSED' },
    { kind: 'REFUND', reference: 'CASH-1', amountPaise: 20000, status: 'REVIEW' },
    { kind: 'REFUND', reference: 'CASH-1', amountPaise: 5000, status: 'FAILED' },
    { kind: 'REFUND', reference: 'BANK-2', amountPaise: 5000, status: 'PENDING' },
  ] };
  expect(rentalRefundReceiptRemaining(b, receipt)).toBe(20000);
  expect(rentalRefundReceiptRemaining(b, undefined)).toBe(0);
});
