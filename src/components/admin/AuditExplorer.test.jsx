import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import AuditExplorer, { exportAuditPage } from './AuditExplorer';
import api from '../../services/api';
jest.mock('../../services/api', () => ({ get: jest.fn(), delete: jest.fn() }));
const ID = '0123456789abcdef01234567';
const event = { _id: ID, action: 'STOCK_UPDATE', entityType: 'Product', entityId: 'product-1', actor: { name: 'Manager', role: 'admin' }, outcome: 'SUCCESS', source: 'ADMIN', createdAt: '2026-09-05T08:00:00.000Z', requestId: 'request-1' };
const page = { items: [event], page: 1, limit: 25, total: 51, totalPages: 3, asOf: '2026-09-05T09:00:00.000Z' };
const choices = { actions: ['STOCK_UPDATE', 'ADMIN_REQUEST'], entityTypes: ['Product', 'AdminRequest'] };
function defaultApi(path) { return Promise.resolve(path.endsWith('/options') ? choices : path.endsWith('/' + ID) ? { ...event, canDelete: true, before: { stock: 5 }, after: { stock: 0 }, changedFields: ['stock'] } : page); }
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function close() { this.removeAttribute('open'); };
});
beforeEach(() => { jest.clearAllMocks(); api.get.mockImplementation(defaultApi); api.delete.mockReset(); });

test('loads real API data with mobile table labels and bounded pagination', async () => {
  render(<AuditExplorer />);
  expect(await screen.findByText('Manager')).toBeInTheDocument();
  expect(screen.getByText(/51 matching events/)).toBeInTheDocument();
  expect(screen.getByRole('cell', { name: /Manager/ })).toHaveAttribute('data-label', 'Actor');
  expect(api.get).toHaveBeenCalledWith('/admin/audit-logs?page=1&limit=25');
  expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
});
test('applying filters sends encoded server filters and resets pagination', async () => {
  render(<AuditExplorer />); await screen.findByText('Manager');
  fireEvent.change(screen.getByLabelText('Search activity'), { target: { value: 'stock & price' } });
  fireEvent.change(screen.getByLabelText('Outcomes'), { target: { value: 'FAILED' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/admin/audit-logs?page=1&limit=25&q=stock+%26+price&outcome=FAILED'));
});
test('pagination keeps the same history snapshot and refresh starts a new one', async () => {
  api.get.mockImplementation((path) => path.includes('page=2') ? Promise.resolve({ ...page, page: 2 }) : defaultApi(path));
  render(<AuditExplorer />); await screen.findByText('Manager');
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByText('Page 2 of 3');
  expect(api.get).toHaveBeenCalledWith('/admin/audit-logs?page=2&limit=25&asOf=2026-09-05T09%3A00%3A00.000Z');
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  await screen.findByText('Page 1 of 3');
});
test('invalid date ranges show validation without another history request', async () => {
  render(<AuditExplorer />); await screen.findByText('Manager');
  const previous = api.get.mock.calls.length;
  fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2026-09-05' } });
  fireEvent.change(screen.getByLabelText('To date'), { target: { value: '2026-09-01' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Start date must be on or before end date.');
  expect(api.get.mock.calls.length).toBe(previous);
});
test('failed request is not shown as an empty audit history and can be retried', async () => {
  api.get.mockImplementation((path) => path.endsWith('/options') ? Promise.resolve(choices) : Promise.reject(new Error('Service unavailable')));
  render(<AuditExplorer />);
  expect(await screen.findByRole('alert')).toHaveTextContent('History could not be loaded');
  expect(screen.queryByText('No audit events yet')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Export this page' })).toBeDisabled();
  api.get.mockImplementation(defaultApi);
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('Manager')).toBeInTheDocument();
});
test('empty history remains honest without fake counters or rows', async () => {
  api.get.mockImplementation((path) => path.endsWith('/options') ? Promise.resolve(choices) : Promise.resolve({ ...page, items: [], total: 0, totalPages: 1 }));
  render(<AuditExplorer />);
  expect(await screen.findByText('No audit events yet')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
});
test('details load on demand, show zero changes correctly and restore keyboard focus', async () => {
  render(<AuditExplorer />); await screen.findByText('Manager');
  const button = screen.getByRole('button', { name: 'View details for ' + ID });
  expect(api.get).not.toHaveBeenCalledWith('/admin/audit-logs/' + ID);
  fireEvent.click(button);
  const region = await screen.findByRole('dialog', { name: 'Event details' });
  expect(region).toHaveAttribute('open');
  expect(region).toHaveAttribute('aria-modal', 'true');
  expect(document.body.style.overflow).toBe('hidden');
  expect(await within(region).findByText('0')).toBeInTheDocument();
  expect(within(region).getByText('5')).toBeInTheDocument();
  fireEvent.keyDown(region, { key: 'Escape' });
  expect(screen.queryByRole('dialog', { name: 'Event details' })).not.toBeInTheDocument();
  expect(document.body.style.overflow).toBe('');
  expect(button).toHaveFocus();
});
test('detail failure can be retried without discarding the table', async () => {
  let fail = true;
  api.get.mockImplementation((path) => path.endsWith('/' + ID) && fail ? Promise.reject(new Error('Details unavailable')) : defaultApi(path));
  render(<AuditExplorer />); await screen.findByText('Manager');
  fireEvent.click(screen.getByRole('button', { name: 'View details for ' + ID }));
  expect(await screen.findByText('Details unavailable')).toBeInTheDocument();
  fail = false; fireEvent.click(screen.getByRole('button', { name: 'Retry details' }));
  expect(await screen.findByText('Recorded changes')).toBeInTheDocument();
});
test('a late old response cannot overwrite new filtered results', async () => {
  let resolveOld;
  api.get.mockImplementation((path) => path.endsWith('/options') ? Promise.resolve(choices) : path.includes('q=fresh') ? Promise.resolve({ ...page, items: [{ ...event, actor: { name: 'Fresh result' } }] }) : new Promise((resolve) => { resolveOld = resolve; }));
  render(<AuditExplorer />);
  fireEvent.change(screen.getByLabelText('Search activity'), { target: { value: 'fresh' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  await screen.findByText('Fresh result');
  await act(async () => { resolveOld(page); });
  expect(screen.queryByText('Manager')).not.toBeInTheDocument();
});
test('seller workspace uses only seller endpoints', async () => {
  render(<AuditExplorer endpoint="/seller/audit-logs" seller />);
  await screen.findByText('Manager');
  expect(api.get).toHaveBeenCalledWith('/seller/audit-logs?page=1&limit=25');
  fireEvent.click(screen.getByRole('button', { name: 'View details for ' + ID }));
  await screen.findByText('Recorded changes');
  expect(screen.queryByRole('button', { name: 'Delete event' })).not.toBeInTheDocument();
  expect(api.get.mock.calls.every(([path]) => path.startsWith('/seller/'))).toBe(true);
});

async function openDeletion() {
  fireEvent.click(await screen.findByRole('button', { name: 'View details for ' + ID }));
  fireEvent.click(await screen.findByRole('button', { name: 'Delete event' }));
  return screen.findByRole('alertdialog', { name: 'Delete audit event' });
}

test('delete requires confirmation and cancel returns to the same event without an API mutation', async () => {
  render(<AuditExplorer />);
  const dialog = await openDeletion();
  expect(within(dialog).getByText(ID)).toBeInTheDocument();
  expect(within(dialog).getByRole('button', { name: 'Cancel deletion' })).toHaveFocus();
  expect(api.delete).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel deletion' }));
  expect(screen.getByRole('dialog', { name: 'Event details' })).toHaveTextContent('Recorded changes');
  expect(api.delete).not.toHaveBeenCalled();
});

test('successful deletion removes only the selected event and updates the visible history', async () => {
  let removed = false;
  api.delete.mockImplementation(async () => { removed = true; return { success: true, id: ID }; });
  api.get.mockImplementation((path) => removed && path.includes('?') ? Promise.resolve({ ...page, items: [], total: 0, totalPages: 1 }) : defaultApi(path));
  render(<AuditExplorer />);
  await openDeletion();
  fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }));
  expect(await screen.findByText('Audit event deleted.')).toBeInTheDocument();
  await screen.findByText('No audit events yet');
  expect(api.delete).toHaveBeenCalledTimes(1);
  expect(api.delete).toHaveBeenCalledWith('/admin/audit-logs/' + ID);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Audit history' })).toHaveFocus();
  expect(document.body.style.overflow).toBe('');
});

test('deletion failure keeps the event and supports retry while preventing duplicate submissions and dismissal', async () => {
  let rejectDelete;
  api.delete.mockImplementationOnce(() => new Promise((resolve, reject) => { rejectDelete = reject; }));
  render(<AuditExplorer />);
  const dialog = await openDeletion();
  const button = screen.getByRole('button', { name: 'Delete permanently' });
  fireEvent.click(button); fireEvent.click(button);
  expect(button).toBeDisabled();
  expect(api.delete).toHaveBeenCalledTimes(1);
  fireEvent.keyDown(dialog, { key: 'Escape' });
  fireEvent(dialog, new Event('cancel', { cancelable: true }));
  expect(dialog).toBeInTheDocument();
  await act(async () => { rejectDelete(new Error('Could not delete event')); });
  expect(screen.getByRole('alert')).toHaveTextContent('Could not delete event');
  expect(screen.getByRole('button', { name: 'Delete permanently' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'View details for ' + ID })).toBeInTheDocument();
  api.delete.mockRejectedValueOnce(new Error('Still unavailable'));
  fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }));
  expect(await screen.findByText('Still unavailable')).toBeInTheDocument();
  expect(api.delete).toHaveBeenCalledTimes(2);
});

test('an event removed in another tab refreshes the list without claiming a new deletion', async () => {
  api.delete.mockRejectedValue(Object.assign(new Error('Not found'), { status: 404, code: 'AUDIT_EVENT_NOT_FOUND' }));
  render(<AuditExplorer />);
  await openDeletion();
  api.get.mockImplementation((path) => path.endsWith('/options') ? Promise.resolve(choices) : Promise.resolve({ ...page, items: [], total: 0, totalPages: 1 }));
  fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }));
  expect(await screen.findByText('This audit event is no longer available. History refreshed.')).toBeInTheDocument();
  await screen.findByText('No audit events yet');
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
});

test('delete is hidden unless the detail API explicitly grants permission', async () => {
  api.get.mockImplementation((path) => path.endsWith('/' + ID) ? Promise.resolve({ ...event, canDelete: false }) : defaultApi(path));
  render(<AuditExplorer />);
  fireEvent.click(await screen.findByRole('button', { name: 'View details for ' + ID }));
  await screen.findByText('Recorded changes');
  expect(screen.queryByRole('button', { name: 'Delete event' })).not.toBeInTheDocument();
});

test('deleting the final event on a later page returns to the previous page and retains filters', async () => {
  let removed = false;
  api.get.mockImplementation((path) => {
    if (!path.includes('?')) return defaultApi(path);
    const currentPage = Number(new URLSearchParams(path.split('?')[1]).get('page'));
    return Promise.resolve({ ...page, page: currentPage, total: removed ? 25 : 26, totalPages: removed ? 1 : 2,
      items: currentPage === 2 ? [event] : [{ ...event, _id: 'other-event', actor: { name: 'Another actor' } }] });
  });
  api.delete.mockImplementation(async () => { removed = true; return { success: true, id: ID }; });
  render(<AuditExplorer />); await screen.findByText('Another actor');
  fireEvent.change(screen.getByLabelText('Search activity'), { target: { value: 'stock' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/admin/audit-logs?page=1&limit=25&q=stock'));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await openDeletion();
  fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }));
  await screen.findByText('Page 1 of 1');
  expect(screen.getByText('Another actor')).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledWith('/admin/audit-logs?page=1&limit=25&asOf=2026-09-05T09%3A00%3A00.000Z&q=stock');
});

test('closing or unmounting the popup restores the previous body scroll setting', async () => {
  document.body.style.overflow = 'auto';
  const { unmount } = render(<AuditExplorer />);
  fireEvent.click(await screen.findByRole('button', { name: 'View details for ' + ID }));
  await screen.findByText('Recorded changes');
  expect(document.body.style.overflow).toBe('hidden');
  unmount();
  expect(document.body.style.overflow).toBe('auto');
  document.body.style.overflow = '';
});

test('an unavailable delete endpoint never reports success or removes the event', async () => {
  api.delete.mockRejectedValue(Object.assign(new Error('Not found - /api/admin/audit-logs/' + ID), { status: 404, code: 'NOT_FOUND' }));
  render(<AuditExplorer />);
  await openDeletion();
  const readCount = api.get.mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Deletion is unavailable on the connected server');
  expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  expect(screen.queryByText('Audit event deleted.')).not.toBeInTheDocument();
  expect(api.get).toHaveBeenCalledTimes(readCount);
  expect(screen.getByRole('button', { name: 'View details for ' + ID })).toBeInTheDocument();
});

test.each([{}, { success: false, id: ID }, { success: true, id: 'different-event' }])('unconfirmed deletion responses keep the event: %j', async (response) => {
  api.delete.mockResolvedValue(response);
  render(<AuditExplorer />);
  await openDeletion();
  fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('The server did not confirm deletion');
  expect(screen.queryByText('Audit event deleted.')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'View details for ' + ID })).toBeInTheDocument();
});

test('invalid detail responses show a retry instead of a fabricated event', async () => {
  api.get.mockImplementation((path) => path.endsWith('/' + ID) ? Promise.resolve({ ...event, _id: 'different-event' }) : defaultApi(path));
  render(<AuditExplorer />);
  fireEvent.click(await screen.findByRole('button', { name: 'View details for ' + ID }));
  expect(await screen.findByRole('alert')).toHaveTextContent('The server did not return the selected event');
  expect(screen.queryByRole('button', { name: 'Delete event' })).not.toBeInTheDocument();
});
test('CSV export includes only supplied page metadata and neutralizes formulas', () => {
  const csv = exportAuditPage([{ ...event, actor: { name: '=HYPERLINK("unsafe")' }, before: { secret: 'never-export' } }]);
  expect(csv).toContain("'=HYPERLINK");
  expect(csv).toContain(ID);
  expect(csv).not.toContain('never-export');
});
test('logging health warning remains visible instead of claiming complete history', async () => {
  api.get.mockImplementation((path) => path.endsWith('/options') ? Promise.resolve(choices) : Promise.resolve({ ...page, recordingWarning: 'Some events could not be saved.' }));
  render(<AuditExplorer />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Some events could not be saved.');
});
