import { useState } from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ImageUploader from './ImageUploader';
import api from '../../services/api';
jest.mock('../../services/api', () => ({upload:jest.fn()}));
const initial=[{url:'/uploads/front.jpg',primary:false,sourceFrame:{viewType:'front',timestampSeconds:2,qualityScore:.8}},{url:'/uploads/side.jpg',primary:true,sourceFrame:{viewType:'side',timestampSeconds:4,qualityScore:.9}},{url:'/uploads/detail.jpg',primary:false}];
function Harness(){const [images,setImages]=useState(initial);return <><ImageUploader multiple maxFiles={20} value={images} onChange={setImages}/><output data-testid="images">{JSON.stringify(images)}</output></>;}
test('changing a saved product view preserves frame provenance and the selected main photo',()=>{
  render(<Harness/>);
  fireEvent.change(screen.getByLabelText('Product view for image 1'),{target:{value:'back'}});
  const images=JSON.parse(screen.getByTestId('images').textContent);
  expect(images[0].sourceFrame).toEqual({viewType:'back',timestampSeconds:2,qualityScore:.8});
  expect(images.filter(image=>image.primary)).toHaveLength(1);
  expect(images[1].primary).toBe(true);
});
test('removing an unrelated imported photo does not create two main photos',()=>{
  render(<Harness/>);
  fireEvent.click(screen.getAllByRole('button',{name:'Remove'})[2]);
  const images=JSON.parse(screen.getByTestId('images').textContent);
  expect(images.filter(image=>image.primary)).toHaveLength(1);
  expect(images[1].url).toBe('/uploads/side.jpg');expect(images[1].primary).toBe(true);
  fireEvent.click(screen.getAllByRole('button',{name:'Remove'})[1]);
  expect(JSON.parse(screen.getByTestId('images').textContent)[0].primary).toBe(true);
});
test('gallery order can be changed without losing the selected main photo',()=>{
  render(<Harness/>);
  fireEvent.click(screen.getByRole('button',{name:'Move image 3 earlier'}));
  const images=JSON.parse(screen.getByTestId('images').textContent);
  expect(images.map(image=>image.url)).toEqual(['/uploads/front.jpg','/uploads/detail.jpg','/uploads/side.jpg']);
  expect(images.find(image=>image.primary)?.url).toBe('/uploads/side.jpg');
});
test('oversized upload batches are rejected locally while saved images remain intact',()=>{
  render(<Harness/>);
  fireEvent.change(screen.getByLabelText('Choose Images'),{target:{files:Array.from({length:9},(_,index)=>new File(['photo'],index+'.jpg',{type:'image/jpeg'}))}});
  expect(screen.getByText(/Choose up to 8 new images/)).toBeInTheDocument();
  expect(api.upload).not.toHaveBeenCalled();expect(JSON.parse(screen.getByTestId('images').textContent)).toHaveLength(3);
});

test('background tools are offered only on product photos, not category or branding uploads', () => {
  const { rerender } = render(<ImageUploader value={initial} onChange={jest.fn()} uploadContext="products" />);
  expect(screen.getAllByRole('button', { name: /Edit background for image/ })).toHaveLength(3);
  rerender(<ImageUploader value={initial} onChange={jest.fn()} uploadContext="categories" />);
  expect(screen.queryByRole('button', { name: /Edit background for image/ })).not.toBeInTheDocument();
});

test('re-selecting a failed upload keeps the same prepared file and retry key', async () => {
  api.upload.mockReset();
  api.upload.mockRejectedValueOnce(new Error('Network interrupted')).mockResolvedValue({ files: [{ url: '/uploads/recovered.webp' }] });
  const change = jest.fn();
  render(<ImageUploader value={[]} onChange={change} />);
  const select = () => fireEvent.change(screen.getByLabelText('Choose Images'), { target: { files: [new File(['photo'], 'photo.webp', { type: 'image/webp' })] } });
  select(); await screen.findByText('Network interrupted');
  select(); await waitFor(() => expect(change).toHaveBeenCalledTimes(1));
  expect(api.upload.mock.calls[0][2].idempotencyKey).toBe(api.upload.mock.calls[1][2].idempotencyKey);
  expect(api.upload.mock.calls[0][1][0]).toBe(api.upload.mock.calls[1][1][0]);
  expect(change.mock.calls[0][0]).toHaveLength(1);
});
