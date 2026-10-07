import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CouponForm from './CouponForm';
import api from '../../services/api';

jest.mock('../../services/api', () => ({
  __esModule: true,
  default: { post: jest.fn(), put: jest.fn() },
}));

describe('CouponForm', () => {
  beforeEach(() => jest.clearAllMocks());

  test('validates required fields before calling the API', () => {
    render(<CouponForm />);
    fireEvent.click(screen.getByRole('button', { name: 'Create Coupon' }));
    expect(screen.getByRole('status')).toHaveTextContent('Coupon code is required');
    expect(api.post).not.toHaveBeenCalled();
  });

  test('creates a normalized coupon with customer eligibility settings', async () => {
    const saved = { _id: 'coupon-1', code: 'SAVE20' };
    api.post.mockResolvedValue(saved);
    const onSaved = jest.fn();
    render(<CouponForm onSaved={onSaved} />);

    fireEvent.change(screen.getByLabelText(/Coupon code/i), { target: { value: 'save 20!' } });
    fireEvent.change(screen.getByLabelText(/Discount percentage/i), { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText(/Minimum bag value/i), { target: { value: '1500' } });
    fireEvent.change(screen.getByLabelText(/Expires at/i), { target: { value: '2030-01-01T20:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'UPI' }));
    fireEvent.click(screen.getByLabelText('First order only'));
    fireEvent.click(screen.getByRole('button', { name: 'Create Coupon' }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/coupons', expect.objectContaining({
      code: 'SAVE20',
      type: 'Percentage',
      discountValue: 20,
      minOrderAmount: 1500,
      applicablePaymentMethods: ['UPI'],
      firstOrderOnly: true,
      isPublic: true,
      isActive: true,
    })));
    expect(onSaved).toHaveBeenCalledWith(saved, 'created');
  });

  test('updates an existing coupon without exposing the usage counter as editable', async () => {
    const coupon = {
      _id: 'coupon-1', code: 'OLD100', type: 'Flat', discountValue: 100,
      minOrderAmount: 500, expiryDate: '2030-01-01T20:30:00.000Z', usedCount: 7,
      isActive: true, isPublic: true,
    };
    api.put.mockResolvedValue({ ...coupon, discountValue: 150 });
    render(<CouponForm coupon={coupon} />);

    expect(screen.getByText('7 used')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Flat discount/i), { target: { value: '150' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Coupon' }));

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/admin/coupons/coupon-1', expect.objectContaining({ discountValue: 150 })));
    expect(api.put.mock.calls[0][1]).not.toHaveProperty('usedCount');
  });
});
