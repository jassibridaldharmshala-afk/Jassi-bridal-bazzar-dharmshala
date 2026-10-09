export function rentalActionPermission(action) {
  return ['ASSESS', 'WAIVE_ASSESSMENT', 'COLLECT', 'REFUND', 'PARTIAL_CANCEL', 'REOPEN_SETTLEMENT'].includes(action) ? 'returns.refund' : ['RECEIVE', 'DECLARE_LOST', 'INSPECT', 'RELEASE'].includes(action) ? 'returns.qc' : 'orders.write';
}
export function rentalActionPieces(action, booking) {
  return (booking.allocations || []).filter(piece => {
    if (['RECEIVE', 'DECLARE_LOST'].includes(action)) return !piece.receivedAt && !piece.lostAt;
    if (action === 'INSPECT') return piece.receivedAt && !piece.disposition && !piece.readyAt;
    if (action === 'RELEASE') return (piece.receivedAt || piece.lostAt) && piece.disposition && !piece.readyAt;
    return action === 'HANDOVER';
  });
}
export function rentalPendingRefundAmount(booking) {
  return (booking.ledger || []).filter(entry => entry.kind === 'REFUND' && !['FAILED', 'PROCESSED'].includes(entry.status)).reduce((total, entry) => total + entry.amountPaise, 0);
}
export function rentalRefundReceiptRemaining(booking, receipt) {
  if (!receipt || receipt.kind !== 'COLLECTION') return 0;
  const reserved = (booking.ledger || []).filter(entry => entry.kind === 'REFUND' && entry.reference === receipt.reference && entry.status !== 'FAILED').reduce((total, entry) => total + entry.amountPaise, 0);
  return Math.max(0, receipt.amountPaise - reserved);
}
export function rentalActionAvailable(action, booking) {
  const state = booking.status, pieces = booking.allocations || [];
  const active = ['HELD', 'CONFIRMED', 'PREPARING', 'READY', 'OUT', 'RETURNED'];
  const states = { PREPARE: ['CONFIRMED'], READY: ['PREPARING'], HANDOVER: ['READY'], RECEIVE: ['OUT'], DECLARE_LOST: ['OUT'], REPLACE: ['CONFIRMED', 'PREPARING', 'READY', 'OUT'], PARTIAL_CANCEL: ['HELD', 'CONFIRMED', 'PREPARING', 'READY'], INSPECT: ['OUT', 'RETURNED'], RELEASE: ['OUT', 'RETURNED'], ASSESS: ['OUT', 'RETURNED'], WAIVE_ASSESSMENT: ['OUT', 'RETURNED'], COLLECT: active, REFUND: [...active, 'CANCELLED', 'EXPIRED'], DATES: ['CONFIRMED', 'PREPARING', 'READY', 'OUT'], CANCEL: ['HELD', 'CONFIRMED', 'PREPARING', 'READY'], NO_SHOW: ['CONFIRMED', 'PREPARING', 'READY'], EARLY_RETURN: ['OUT', 'RETURNED'], CLOSE: ['RETURNED', 'CANCELLED', 'EXPIRED'], REOPEN_SETTLEMENT: ['CLOSED'], LOGISTICS: active, TRIAL: ['CONFIRMED', 'PREPARING', 'READY'], REQUEST: active };
  if (!(states[action] || []).includes(state)) return false;
  if (['RECEIVE', 'DECLARE_LOST', 'INSPECT', 'RELEASE'].includes(action)) return rentalActionPieces(action, booking).length > 0;
  if (action === 'CLOSE') return (state !== 'RETURNED' || pieces.every(p => p.readyAt)) && !(booking.requests || []).some(r => r.status === 'PENDING') && !(booking.financial?.refundablePaise || booking.financial?.balancePaise) && !(booking.ledger || []).some(e => e.kind === 'REFUND' && !['FAILED', 'PROCESSED'].includes(e.status));
  if (action === 'REFUND') return (booking.financial?.refundablePaise || 0) > 0 && (['RETURNED', 'CANCELLED', 'EXPIRED'].includes(state) || booking.cancelledItems?.length > 0) && (state !== 'RETURNED' || pieces.every(piece => piece.disposition || piece.readyAt));
  if (action === 'COLLECT') return (booking.financial?.balancePaise || 0) > 0;
  if (action === 'REQUEST') return booking.requests?.some(r => r.status === 'PENDING');
  return true;
}
export function rentalNextAction(booking, permissions = {}) {
  const stages = { HELD: ['COLLECT'], CONFIRMED: ['PREPARE'], PREPARING: ['READY'], READY: ['COLLECT', 'HANDOVER'], OUT: ['INSPECT', 'RELEASE', 'RECEIVE'], RETURNED: ['INSPECT', 'RELEASE', 'COLLECT', 'REFUND', 'REQUEST', 'CLOSE'], CANCELLED: ['REFUND', 'CLOSE'], EXPIRED: ['REFUND', 'CLOSE'] };
  return (stages[booking.status] || []).find(action => rentalActionAvailable(action, booking) && permissions[rentalActionPermission(action)] !== false) || '';
}

export function rentalActionLabel(action) {
  return { COLLECT: 'Collect payment', PREPARE: 'Start preparation', READY: 'Mark ready', HANDOVER: 'Verify pieces and hand over', RECEIVE: 'Receive returned pieces', INSPECT: 'Inspect returned pieces', RELEASE: 'Verify cleaning or repair and release', REFUND: 'Settle refundable balance', REQUEST: 'Resolve customer request', CLOSE: 'Close completed booking' }[action] || action.replace(/_/g, ' ');
}
