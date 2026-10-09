import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import ProductRentalPricing, { pricingFromOffer } from './ProductRentalPricing';

test('new product pricing enables rental visibility and explains linked real pieces', () => {
  const onChange = jest.fn();
  render(<ProductRentalPricing onChange={onChange} apiPrefix="/admin" />);
  const toggle = screen.getByRole('checkbox', { name: /Show this product in the rental shop/ });
  expect(toggle).toBeChecked();
  expect(screen.getByText(/pieces for this exact product are linked automatically/)).toBeInTheDocument();
  fireEvent.click(toggle);
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
});

test('paused offer is not enabled again by loading or changing a price', () => {
  const offer = { _id: 'saved', active: false, revision: 4, dailyRatePaise: 50000, depositPaise: 0 };
  const onChange = jest.fn();
  render(<ProductRentalPricing value={pricingFromOffer(offer)} offers={[offer]} onChange={onChange} apiPrefix="/admin" />);
  expect(screen.getByRole('checkbox', { name: /Show this product in the rental shop/ })).not.toBeChecked();
  fireEvent.change(screen.getByLabelText('Rental price per day (₹)'), { target: { value: '650' } });
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ enabled: false, dailyRatePaise: 65000 }));
  expect(screen.getByText(/New bookings are paused/)).toBeInTheDocument();
});

test('studio keeps its reviewed activation controls', () => {
  render(<ProductRentalPricing simple onChange={() => {}} />);
  expect(screen.queryByRole('checkbox', { name: /Show this product in the rental shop/ })).not.toBeInTheDocument();
});

test('product editor shows actual linked quantity and a clear missing-piece reason', () => {
  const offer = { _id: 'saved', active: true, live: false, revision: 1, dailyRatePaise: 50000,
    pieces: [{ label: 'Lehenga', configured: 0, required: 1 }],
    reasons: [{ code: 'NO_PHYSICAL_PIECES', message: 'Actual matching pieces registered for every component' }] };
  render(<ProductRentalPricing value={pricingFromOffer(offer)} offers={[offer]} onChange={() => {}} apiPrefix="/admin" />);
  expect(screen.getByRole('status')).toHaveTextContent('0 linked physical pieces');
  expect(screen.getByRole('status')).toHaveTextContent('Actual matching pieces');
  expect(screen.queryByText('Visible in rental collection')).not.toBeInTheDocument();
});
