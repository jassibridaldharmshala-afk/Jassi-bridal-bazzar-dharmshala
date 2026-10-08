import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DraftCommercialGrid from './DraftCommercialGrid';
test('bulk review keeps per-row revisions and fitting, saves real separate prices and reports partial failure', async () => {
  const draft = { _id: 'one', name: 'Lehenga', revision: 7, commerceMode: 'SALE_AND_RENTAL', sellingPrice: 9000, stock: 2, rentalPricing: { dailyRatePaise: 80000, depositPaise: 200000, advanceMode: 'PERCENT', advancePercent: 40, fitting: { adjustable: true } } };
  const save = jest.fn(async row => { if (row._id === 'two') throw new Error('This draft changed'); return { ...row, revision: 8 }; });
  render(<DraftCommercialGrid drafts={[draft, { ...draft, _id: 'two', name: 'Necklace' }]} onSave={save} onClose={jest.fn()} />);
  fireEvent.change(screen.getByLabelText('Daily rent for Lehenga'), { target: { value: '950.50' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save reviewed values' }));
  await screen.findByText('This draft changed'); expect(save).toHaveBeenCalledTimes(2);
  expect(save.mock.calls[0][0]).toEqual(expect.objectContaining({ revision: 7, sellingPrice: 9000, stock: 2, rentalPricing: expect.objectContaining({ dailyRatePaise: 95050, depositPaise: 200000, advancePercent: 40, fitting: { adjustable: true } }) }));
  expect(screen.getByText('Saved — review before publishing')).toBeInTheDocument();
});
test('invalid or missing rental rates do not invent prices or create physical stock', async () => {
  const save = jest.fn(); render(<DraftCommercialGrid drafts={[{ _id: 'one', name: 'Rental', commerceMode: 'RENTAL_ONLY' }]} onSave={save} onClose={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Save reviewed values' }));
  await waitFor(() => expect(screen.getByText(/Enter a rental price per day/)).toBeInTheDocument()); expect(save).not.toHaveBeenCalled();
});
