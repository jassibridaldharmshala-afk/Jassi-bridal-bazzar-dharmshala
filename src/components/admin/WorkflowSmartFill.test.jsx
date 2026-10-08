import '@testing-library/jest-dom';
import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import WorkflowSmartFill, { CopySmartDraft } from './WorkflowSmartFill';
import ManualShipmentForm from './ManualShipmentForm';
import api from '../../services/api';
import { prepareAnalysisImageFile } from '../../services/imageCompression';
jest.mock('../../services/api', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
jest.mock('../../services/imageCompression', () => ({ ...jest.requireActual('../../services/imageCompression'), prepareAnalysisImageFile: jest.fn() }));
const suggestion = (path, value, extra = {}) => ({ path, value, label: path, source: 'notes', ...extra });
const answer = (...suggestions) => ({ suggestions, warnings: ['Review the source before applying.'] });
const open = () => fireEvent.click(screen.getByRole('button', { name: /Smart Fill.*Source/ }));
const analyze = () => fireEvent.click(screen.getByRole('button', { name: 'Suggest draft fields' }));

test('large document photos are compressed before base64 encoding and still require explicit AI consent', async () => {
  api.get.mockResolvedValue({ documentExtraction: true }); api.post.mockResolvedValue(answer());
  const source = new File([new Uint8Array(3 * 1024 * 1024)], 'invoice.jpg', { type: 'image/jpeg' });
  const optimized = new File(['optimized document'], 'invoice.webp', { type: 'image/webp' });
  prepareAnalysisImageFile.mockResolvedValue(optimized);
  render(<WorkflowSmartFill workflow="purchase" form={{}} onChange={jest.fn()} documents />); open();
  await waitFor(() => expect(screen.getByLabelText('Smart Fill source document')).toBeEnabled());
  fireEvent.change(screen.getByLabelText('Smart Fill source document'), { target: { files: [source] } });
  const consent = await screen.findByLabelText(/I may use this document/);
  expect(prepareAnalysisImageFile).toHaveBeenCalledWith(source);
  expect(api.post).not.toHaveBeenCalled(); expect(consent).not.toBeChecked();
  expect(screen.getByRole('button', { name: 'Suggest draft fields' })).toBeDisabled();
  fireEvent.click(consent); analyze();
  await waitFor(() => expect(api.post).toHaveBeenCalled());
  expect(api.post.mock.calls[0][1].document).toEqual({ mimeType: 'image/webp', data: btoa('optimized document'), consent: true });
});
function Category() {
  const [form, setForm] = useState({ name: 'Existing name', description: '' });
  return <><WorkflowSmartFill workflow="category" form={form} onChange={setForm} /><input aria-label="Manual name" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /><textarea aria-label="Manual description" value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></>;
}
beforeEach(() => { jest.resetAllMocks(); sessionStorage.clear(); api.get.mockResolvedValue({ documentExtraction: false }); });
test('closed assistants make no requests; suggestion/apply never saves or sends and undo preserves manual edits', async () => {
  api.post.mockResolvedValue(answer(suggestion('name', 'Proposed name'), suggestion('description', 'Reviewed copy')));
  render(<Category />); expect(api.get).not.toHaveBeenCalled(); expect(api.post).not.toHaveBeenCalled();
  open(); analyze();
  await screen.findByRole('heading', { name: 'Review suggestions' });
  expect(screen.getByRole('button', { name: 'Apply 1 reviewed fields to draft' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Apply 1 reviewed fields to draft' }));
  expect(screen.getByLabelText('Manual description')).toHaveValue('Reviewed copy');
  expect(screen.getByLabelText('Manual name')).toHaveValue('Existing name');
  expect(api.post).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByLabelText('Manual description'), { target: { value: 'Manual refinement' } });
  fireEvent.click(screen.getByRole('button', { name: 'Undo last fill' }));
  expect(screen.getByLabelText('Manual description')).toHaveValue('Manual refinement');
});
test('existing values need explicit replacement and selection', async () => {
  api.post.mockResolvedValue(answer(suggestion('name', 'Proposed name')));
  render(<Category />); open(); analyze(); await screen.findByText('Proposed name');
  expect(screen.getByRole('button', { name: /Apply 0/ })).toBeDisabled();
  fireEvent.click(screen.getByLabelText('Allow replacing selected existing values'));
  fireEvent.click(screen.getByRole('button', { name: 'Select eligible fields' }));
  fireEvent.click(screen.getByRole('button', { name: 'Apply 1 reviewed fields to draft' }));
  expect(screen.getByLabelText('Manual name')).toHaveValue('Proposed name');
  fireEvent.click(screen.getByRole('button', { name: 'Undo last fill' }));
  expect(screen.getByLabelText('Manual name')).toHaveValue('Existing name');
});
test('financial rules require all linked fields and source confirmation before draft apply', async () => {
  const change = jest.fn(); api.post.mockResolvedValue(answer(suggestion('type', 'Percentage', { attention: true, group: 'discount' }), suggestion('discountValue', '10', { attention: true, group: 'discount' })));
  render(<WorkflowSmartFill workflow="coupon" form={{ type: 'Flat', discountValue: '' }} onChange={change} />); open(); analyze();
  await screen.findByText(/must be reviewed together/);
  expect(screen.getByRole('button', { name: /Apply 0/ })).toBeDisabled();
  fireEvent.click(screen.getByLabelText('Allow replacing selected existing values'));
  fireEvent.click(screen.getByRole('button', { name: 'Select eligible fields' }));
  const apply = screen.getByRole('button', { name: /Apply 2/ }); expect(apply).toBeDisabled();
  fireEvent.click(screen.getByLabelText(/I checked these financial/)); fireEvent.click(apply);
  expect(change).toHaveBeenCalledWith({ type: 'Percentage', discountValue: '10' }, expect.any(Array), false, expect.objectContaining({ rows: expect.any(Array) }));
});
test('manual edits during analysis are protected and changed source invalidates the preview', async () => {
  let resolve; api.post.mockReturnValue(new Promise(done => { resolve = done; }));
  render(<Category />); open(); analyze();
  fireEvent.change(screen.getByLabelText('Manual description'), { target: { value: 'Written while loading' } });
  await act(async () => resolve(answer(suggestion('description', 'Old draft'))));
  expect(screen.getByText(/Some fields changed/)).toBeInTheDocument(); expect(screen.getByRole('button', { name: /Apply 0/ })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Category & SEO source notes'), { target: { value: 'New brief' } });
  expect(screen.getByText(/Source changed/)).toBeInTheDocument();
  expect(screen.getByLabelText('Manual description')).toHaveValue('Written while loading');
});
test('cancellation and workspace switches cannot deliver a late preview into another form', async () => {
  let resolve; api.post.mockReturnValue(new Promise(done => { resolve = done; }));
  const change = jest.fn();
  const view = render(<WorkflowSmartFill workflow="support" form={{ reply: '' }} onChange={change} context={{ orderId: 'one' }} />);
  open(); analyze(); const signal = api.post.mock.calls[0][2].signal;
  view.rerender(<WorkflowSmartFill workflow="support" form={{ reply: '' }} onChange={change} context={{ orderId: 'two' }} />);
  expect(signal.aborted).toBe(true);
  await act(async () => resolve(answer(suggestion('reply', 'Old customer reply'))));
  expect(screen.queryByText('Old customer reply')).not.toBeInTheDocument(); expect(change).not.toHaveBeenCalled();
});
test('cancel analysis releases the local request lock and does not apply a delayed answer', async () => {
  let resolve; api.post.mockReturnValueOnce(new Promise(done => { resolve = done; })).mockResolvedValueOnce(answer(suggestion('description', 'New preview')));
  render(<Category />); open(); analyze();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel analysis' })); analyze();
  await screen.findByText('New preview');
  await act(async () => resolve(answer(suggestion('description', 'Cancelled preview'))));
  expect(screen.queryByText('Cancelled preview')).not.toBeInTheDocument(); expect(api.post).toHaveBeenCalledTimes(2);
});
test('source/format errors leave the form unchanged and malformed fields are not offered', async () => {
  api.post.mockRejectedValueOnce(new Error('Source not valid')).mockResolvedValueOnce(answer(suggestion('description', {}), suggestion('stock', '999')));
  render(<Category />); open(); analyze();
  expect(await screen.findByRole('alert')).toHaveTextContent('Source not valid');
  expect(screen.getByLabelText('Manual description')).toHaveValue('');
  analyze(); await screen.findByText(/No safe changes found/);
  expect(screen.getByLabelText('Manual name')).toHaveValue('Existing name');
});
test('optional document is gated by configured extraction, file validation and explicit consent', async () => {
  api.get.mockResolvedValue({ documentExtraction: true });
  api.post.mockResolvedValue(answer());
  render(<WorkflowSmartFill workflow="shipment" form={{}} onChange={jest.fn()} documents />); open();
  const upload = screen.getByLabelText('Smart Fill source document');
  await waitFor(() => expect(upload).toBeEnabled());
  fireEvent.change(upload, { target: { files: [new File(['invalid'], 'file.exe', { type: 'application/octet-stream' })] } });
  expect(screen.getByRole('alert')).toHaveTextContent('512 KB');
  fireEvent.change(upload, { target: { files: [new File(['%PDF-1.4\ncontent'], 'source.pdf', { type: 'application/pdf' })] } });
  const consent = await screen.findByLabelText(/I may use this document/);
  expect(screen.getByRole('button', { name: 'Suggest draft fields' })).toBeDisabled();
  fireEvent.click(consent); analyze(); await screen.findByText(/No safe changes found/);
  expect(api.post.mock.calls[0][1].document).toEqual(expect.objectContaining({ consent: true, mimeType: 'application/pdf' }));
});
test('dispatched manual shipment Smart Fill cannot unlock courier identity, lifecycle or payment fields', async () => {
  api.post.mockResolvedValue(answer(suggestion('courierName', 'Wrong courier'), suggestion('trackingNumber', 'WRONG123'), suggestion('customerNote', 'Reviewed customer update'), suggestion('orderStatus', 'Delivered')));
  render(<ManualShipmentForm order={{ _id: 'o1', orderStatus: 'Shipped', revision: 1, shipment: { provider: 'manual', courierName: 'Saved courier', trackingNumber: 'SAVED123' } }} onSave={jest.fn()} />);
  open(); analyze(); await screen.findByText('Reviewed customer update');
  expect(screen.queryByText('Wrong courier')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Apply 1 reviewed fields to draft' }));
  expect(screen.getByLabelText('Courier name')).toHaveValue('Saved courier'); expect(screen.getByLabelText('Courier name')).toBeDisabled();
  expect(screen.getByLabelText(/Message for the customer/)).toHaveValue('Reviewed customer update');
});
test('a parent can reject incompatible purchase selections without a false success notice', async () => {
  api.post.mockResolvedValue(answer(suggestion('items', [{ selection: 'not-loaded', quantity: 5, unitCost: 100 }], { attention: true })));
  render(<WorkflowSmartFill workflow="purchase" form={{ items: [] }} onChange={() => false} />); open(); analyze();
  await screen.findByRole('heading', { name: 'Review suggestions' });
  fireEvent.click(screen.getByLabelText(/I checked these financial/)); fireEvent.click(screen.getByRole('button', { name: /Apply 1/ }));
  expect(screen.queryByText(/fields filled in the draft/)).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Review suggestions' })).toBeInTheDocument();
});
test('reply copying is an explicit action, with a manual fallback and no send request', async () => {
  const writeText = jest.fn().mockResolvedValue();
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  render(<CopySmartDraft value="Reviewed factual reply" />);
  expect(writeText).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Copy reviewed reply' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Nothing was sent');
  expect(writeText).toHaveBeenCalledWith('Reviewed factual reply'); expect(api.post).not.toHaveBeenCalled();
  writeText.mockRejectedValueOnce(new Error('Unavailable'));
  fireEvent.click(screen.getByRole('button', { name: 'Copy reviewed reply' }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('copy it manually'));
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
});
