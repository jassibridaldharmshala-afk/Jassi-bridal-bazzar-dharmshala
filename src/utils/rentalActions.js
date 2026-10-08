export function rentalActionPermission(action) {
  return ['ASSESS', 'WAIVE_ASSESSMENT', 'COLLECT', 'REFUND', 'PARTIAL_CANCEL', 'REOPEN_SETTLEMENT'].includes(action) ? 'returns.refund' : ['RECEIVE', 'DECLARE_LOST', 'INSPECT', 'RELEASE'].includes(action) ? 'returns.qc' : 'orders.write';
}
export function rentalActionAvailable(action, booking) {
  const state = booking.status, pieces = booking.allocations || [];
  const active = ['HELD', 'CONFIRMED', 'PREPARING', 'READY', 'OUT', 'RETURNED'];
  const states = { PREPARE: ['CONFIRMED'], READY: ['PREPARING'], HANDOVER: ['READY'], RECEIVE: ['OUT'], DECLARE_LOST: ['OUT'], REPLACE: ['CONFIRMED', 'PREPARING', 'READY', 'OUT'], PARTIAL_CANCEL: ['HELD', 'CONFIRMED', 'PREPARING', 'READY'], INSPECT: ['OUT', 'RETURNED'], RELEASE: ['OUT', 'RETURNED'], ASSESS: ['OUT', 'RETURNED'], WAIVE_ASSESSMENT: ['OUT', 'RETURNED'], COLLECT: active, REFUND: ['RETURNED', 'CANCELLED', 'EXPIRED', 'CLOSED'], DATES: ['CONFIRMED', 'PREPARING', 'READY', 'OUT'], CANCEL: ['HELD', 'CONFIRMED', 'PREPARING', 'READY'], NO_SHOW: ['CONFIRMED', 'PREPARING', 'READY'], EARLY_RETURN: ['OUT', 'RETURNED'], CLOSE: ['RETURNED', 'CANCELLED', 'EXPIRED'], REOPEN_SETTLEMENT: ['CLOSED'], LOGISTICS: active, TRIAL: ['CONFIRMED', 'PREPARING', 'READY'], REQUEST: active };
  if (!(states[action] || []).includes(state)) return false;
  if (action === 'INSPECT') return pieces.some(p => (p.receivedAt || p.lostAt) && !p.disposition);
  if (action === 'RELEASE') return pieces.some(p => p.disposition && !p.readyAt);
  if (action === 'CLOSE') return (state !== 'RETURNED' || pieces.every(p => p.readyAt)) && !(booking.requests || []).some(r => r.status === 'PENDING') && !(booking.financial?.refundablePaise || booking.financial?.balancePaise) && !(booking.ledger || []).some(e => e.kind === 'REFUND' && !['FAILED', 'PROCESSED'].includes(e.status));
  if (action === 'REFUND') return (booking.financial?.refundablePaise || 0) > 0;
  if (action === 'COLLECT') return (booking.financial?.balancePaise || 0) > 0;
  if (action === 'REQUEST') return booking.requests?.some(r => r.status === 'PENDING');
  return true;
}
export function rentalNextAction(booking, permissions = {}) {
  const stages = { HELD: ['COLLECT'], CONFIRMED: ['PREPARE'], PREPARING: ['READY'], READY: ['COLLECT', 'HANDOVER'], OUT: ['RECEIVE'], RETURNED: ['INSPECT', 'RELEASE', 'COLLECT', 'REFUND', 'REQUEST', 'CLOSE'], CANCELLED: ['REFUND', 'CLOSE'], EXPIRED: ['REFUND', 'CLOSE'] };
  return (stages[booking.status] || []).find(action => rentalActionAvailable(action, booking) && permissions[rentalActionPermission(action)] !== false) || '';
}

export function rentalActionLabel(action) {
  return { COLLECT: 'Collect payment', PREPARE: 'Start preparation', READY: 'Mark ready', HANDOVER: 'Verify pieces and hand over', RECEIVE: 'Receive returned pieces', INSPECT: 'Inspect returned pieces', RELEASE: 'Verify cleaning or repair and release', REFUND: 'Settle refundable balance', REQUEST: 'Resolve customer request', CLOSE: 'Close completed booking' }[action] || action.replace(/_/g, ' ');
}
