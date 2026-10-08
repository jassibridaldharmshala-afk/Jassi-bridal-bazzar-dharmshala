import '@testing-library/jest-dom';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import ReelProductImport from './ReelProductImport';
import api from '../../services/api';
import {fetchCategories,fetchSubcategories} from '../../utils/catalogOptions';
const mockNotify=jest.fn();
jest.mock('../../context/AuthContext',()=>({useAuth:()=>({notify:mockNotify})}));
jest.mock('../../services/api',()=>({get:jest.fn(),patch:jest.fn(),post:jest.fn()}));
jest.mock('../../utils/catalogOptions',()=>({...jest.requireActual('../../utils/catalogOptions'),fetchCategories:jest.fn(),fetchSubcategories:jest.fn()}));
const candidate={_id:'candidate',groupNumber:1,status:'suggested',sourceRange:{startSeconds:1,endSeconds:4},suggestions:{name:'Pink embroidered saree',sizingMode:'free-size'},analysis:{status:'unavailable'},frames:[
  {_id:'front',url:'/uploads/front.jpg',timestampSeconds:1,selected:true,recommended:true,recommendedCover:true,selectionVersion:'quality-v1',qualityScore:.9,viewType:'front'},
  {_id:'side',url:'/uploads/side.jpg',timestampSeconds:4,selected:false,recommended:false,selectionVersion:'quality-v1',qualityScore:.8,viewType:'side'},
]};
beforeEach(()=>{
  jest.clearAllMocks();fetchCategories.mockResolvedValue([]);fetchSubcategories.mockResolvedValue([]);api.patch.mockResolvedValue({data:candidate});
  api.get.mockImplementation(async(path)=>path==='/catalog-configuration'?{features:{sizing:true},attributes:[]}:path.endsWith('/capabilities')?{data:{smartSuggestionsEnabled:false}}:path.endsWith('/candidates')?{data:[candidate]}:{data:{_id:'job',status:'review_required',sourceVideo:{originalFilename:'Product reel.mp4'},statistics:{extractedFrames:60,rejectedFrames:10,duplicateFrames:20}}});
});
test('choosing an alternative cover also selects it and persists the chosen frame id',async()=>{
  render(<ReelProductImport route="/admin/reel-import?jobId=job"/>);
  fireEvent.click(await screen.findByRole('button',{name:'Set as cover'}));
  fireEvent.click(screen.getByRole('button',{name:'Save candidate'}));
  await waitFor(()=>expect(api.patch).toHaveBeenCalledWith('/admin/reel-imports/job/candidates/candidate',expect.objectContaining({adminOverrides:expect.objectContaining({primaryFrameId:'side'}),selectedFrameIds:['front','side']})));
  expect(screen.getAllByRole('link',{name:'View full photo'})).toHaveLength(2);
});
test('recommended selection restores the clear cover and keeps alternatives visible',async()=>{
  render(<ReelProductImport route="/admin/reel-import?jobId=job"/>);
  fireEvent.click(await screen.findByRole('button',{name:'Set as cover'}));
  fireEvent.click(screen.getByRole('button',{name:'Use recommended photos'}));
  fireEvent.click(screen.getByRole('button',{name:'Save candidate'}));
  await waitFor(()=>expect(api.patch).toHaveBeenCalledWith('/admin/reel-imports/job/candidates/candidate',expect.objectContaining({adminOverrides:expect.objectContaining({primaryFrameId:'front'}),selectedFrameIds:['front']})));
  expect(screen.getByText('Alternative view')).toBeInTheDocument();
});

test('deleted published product receipt never offers a broken edit link or editable candidate', async () => {
  const original = api.get.getMockImplementation();
  api.get.mockImplementation(async path => path.endsWith('/candidates') ? { data: [{ ...candidate, status: 'draft_created', savedDraft: { name: 'Deleted product', publishedProductId: 'removed', publishedProductDeleted: true, draftRemoved: true } }] } : original(path));
  render(<ReelProductImport route="/admin/reel-import?jobId=job" />);
  expect(await screen.findByText(/Product permanently removed/)).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Edit product' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Save candidate' })).not.toBeInTheDocument();
});

test('a stated price is filled and the reviewed reel publishes without visiting drafts', async () => {
  fetchCategories.mockResolvedValue([{ _id: 'sarees', name: 'Sarees' }]);
  const ready = { ...candidate, suggestions: { ...candidate.suggestions, category: 'sarees', price: 1299, fieldSources: { price: { source: 'speech', quote: 'Price is 1299 rupees' } } } };
  const original = api.get.getMockImplementation();
  api.get.mockImplementation(async (path) => path.endsWith('/candidates') ? { data: [ready] } : original(path));
  api.post.mockImplementation(async (path) => path.endsWith('/create-drafts') ? { success: true, data: { drafts: [{ id: 'draft' }] } } : { success: true, data: { products: [{ _id: 'product', name: ready.suggestions.name }] } });
  render(<ReelProductImport route="/admin/reel-import?jobId=job" />);
  await screen.findByDisplayValue('Pink embroidered saree');
  expect(screen.getByLabelText(/Selling price/)).toHaveValue(1299);
  expect(screen.getByLabelText(/^Stock/)).toHaveValue(null);
  fireEvent.change(screen.getByLabelText(/^Stock/), { target: { value: '4' } });
  fireEvent.click(screen.getByRole('button', { name: 'Publish selected products' }));
  await screen.findByText('Your products are published and ready to edit.');
  expect(api.post).toHaveBeenCalledWith('/admin/product-drafts/publish-selected', { ids: ['draft'] });
  expect(api.patch).toHaveBeenCalledWith('/admin/reel-imports/job/candidates/candidate', expect.objectContaining({ adminOverrides: expect.objectContaining({ price: 1299, stock: '4' }) }));
});

test('setup can be rechecked after configuring the key without losing product edits', async () => {
  const original = api.get.getMockImplementation(); let configured = false;
  api.get.mockImplementation(async (path) => path.endsWith('/capabilities') ? { data: { smartSuggestionsEnabled: configured, smartSuggestionsMessage: 'The Gemini API key is missing.' } } : original(path));
  render(<ReelProductImport route="/admin/reel-import?jobId=job" />);
  await screen.findByText('The Gemini API key is missing.');
  expect(screen.getByRole('button', { name: 'Smart fill all products' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText(/^Product name/), { target: { value: 'My product edit' } });
  configured = true;
  fireEvent.click(screen.getByRole('button', { name: 'Check setup again' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Smart fill all products' })).toBeEnabled());
  expect(screen.getByDisplayValue('My product edit')).toBeInTheDocument();
});

test('smart fill works for a saved unpublished candidate and keeps manual edits', async () => {
  const saved = { ...candidate, status: 'draft_created', savedDraft: { name: 'My saved saree', category: '', price: 0, stock: 4, sizingMode: 'free-size' } };
  const original = api.get.getMockImplementation();
  api.get.mockImplementation(async (path) => path.endsWith('/candidates') ? { data: [saved] } : path.endsWith('/capabilities') ? { data: { smartSuggestionsEnabled: true } } : original(path));
  api.post.mockResolvedValue({ data: { ...saved, analysis: { status: 'completed', source: 'gemini-reel-context' }, suggestions: { ...saved.suggestions, name: 'Suggested new name', price: 899, fieldSources: { price: { source: 'on_screen', quote: '₹899' } } } } });
  render(<ReelProductImport route="/admin/reel-import?jobId=job" />);
  await screen.findByDisplayValue('My saved saree');
  fireEvent.click(screen.getByRole('button', { name: 'Smart fill all products' }));
  await waitFor(() => expect(screen.getByLabelText(/Selling price/)).toHaveValue(899));
  expect(screen.getByDisplayValue('My saved saree')).toBeInTheDocument();
  expect(screen.getByLabelText(/^Stock/)).toHaveValue(4);
  expect(api.post).toHaveBeenCalledWith('/admin/reel-imports/job/candidates/candidate/analyze', { selectedFrameIds: ['front'] });
});

test('a failed refresh preserves filled fields and reports the actual model failure', async () => {
  const ready = { ...candidate, suggestions: { ...candidate.suggestions, price: 1299 } };
  const original = api.get.getMockImplementation();
  api.get.mockImplementation(async path => path.endsWith('/candidates') ? { data: [ready] } : path.endsWith('/capabilities') ? { data: { smartSuggestionsEnabled: true } } : original(path));
  const error = 'No supported Gemini model is available.';
  // Even an older backend returning generic suggestions must not clear the form.
  api.post.mockResolvedValue({ data: { ...candidate, suggestions: { name: 'Product 1' }, analysis: { status: 'failed', error, errorCode: 'AI_MODEL_UNAVAILABLE' } } });
  render(<ReelProductImport route="/admin/reel-import?jobId=job" />);
  await screen.findByDisplayValue('Pink embroidered saree');
  fireEvent.change(screen.getByLabelText(/^Stock/), { target: { value: '5' } });
  fireEvent.click(screen.getByRole('button', { name: 'Smart fill details' }));
  await waitFor(() => expect(mockNotify).toHaveBeenCalledWith(error, 'warning', 'Smart Reel Assistant'));
  expect(screen.getByDisplayValue('Pink embroidered saree')).toBeInTheDocument();
  expect(screen.getByLabelText(/Selling price/)).toHaveValue(1299);
  expect(screen.getByLabelText(/^Stock/)).toHaveValue(5);
});

test('bulk smart fill stops on account or service failures and keeps the real explanation', async () => {
  const original = api.get.getMockImplementation();
  api.get.mockImplementation(async path => path.endsWith('/candidates') ? { data: [candidate, { ...candidate, _id: 'second', groupNumber: 2 }] } : path.endsWith('/capabilities') ? { data: { smartSuggestionsEnabled: true } } : original(path));
  const error = 'The Gemini quota is currently exhausted.';
  api.post.mockResolvedValue({ data: { ...candidate, analysis: { status: 'failed', error, errorCode: 'AI_QUOTA_EXCEEDED' } } });
  render(<ReelProductImport route="/admin/reel-import?jobId=job" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Smart fill all products' }));
  await waitFor(() => expect(mockNotify).toHaveBeenCalledWith(expect.stringContaining(error), 'warning', 'Smart Reel Assistant'));
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(mockNotify.mock.calls.at(-1)[0]).toContain('Remaining products were not analyzed');
  expect(mockNotify.mock.calls.at(-1)[0]).not.toContain('clearer photos');
});
