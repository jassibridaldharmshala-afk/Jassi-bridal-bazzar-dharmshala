import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CouponSelector from './CouponSelector';

const coupons = [
  {
    code: 'SAVE350',
    title: 'Save Rs. 350',
    type: 'Flat',
    discountValue: 350,
    estimatedDiscount: 350,
    eligible: true,
    expiryDate: '2030-01-01T00:00:00.000Z',
    terms: 'Cannot be combined with another offer.',
  },
  {
    code: 'SPEND3000',
    title: 'Save Rs. 500',
    type: 'Flat',
    discountValue: 500,
    eligible: false,
    reason: 'Add items worth Rs. 1000 more to use this coupon',
  },
];

describe('CouponSelector', () => {
  test('shows the best saving, explains unavailable offers and applies an eligible coupon', async () => {
    const onApply = jest.fn().mockResolvedValue(true);
    render(<CouponSelector coupons={coupons} bestCouponCode="SAVE350" onApply={onApply} onRemove={jest.fn()} />);

    expect(screen.getByText(/Save up to Rs. 350 with SAVE350/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /apply coupons/i }));

    expect(screen.getByText('Best saving')).toBeInTheDocument();
    expect(screen.getByText('Add items worth Rs. 1000 more to use this coupon')).toBeInTheDocument();
    const unavailableApply = screen.getAllByRole('button', { name: 'Apply' }).find((button) => button.disabled);
    expect(unavailableApply).toBeDisabled();

    const availableApply = screen.getAllByRole('button', { name: 'Apply' }).find((button) => !button.disabled);
    fireEvent.click(availableApply);
    await waitFor(() => expect(onApply).toHaveBeenCalledWith('SAVE350'));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Apply coupons' })).not.toBeInTheDocument());
  });

  test('normalizes a manual code and stays open when validation fails', async () => {
    const onApply = jest.fn().mockResolvedValue(false);
    render(<CouponSelector coupons={[]} feedback="Coupon is not valid" onApply={onApply} onRemove={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /apply coupons/i }));
    const input = screen.getByPlaceholderText('Enter coupon code');
    fireEvent.change(input, { target: { value: ' save 20! ' } });
    expect(input).toHaveValue('SAVE20');
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => expect(onApply).toHaveBeenCalledWith('SAVE20'));
    expect(screen.getByRole('dialog', { name: 'Apply coupons' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Coupon is not valid');
  });

  test('supports removing an applied coupon from the compact card', () => {
    const onRemove = jest.fn();
    render(<CouponSelector coupons={coupons} appliedCoupon={{ code: 'SAVE350', discount: 350 }} onApply={jest.fn()} onRemove={onRemove} />);

    expect(screen.getByText(/SAVE350 applied/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  test('shows delivery savings for a free-shipping offer', () => {
    const freeDelivery = { code: 'SHIPFREE', title: 'Free delivery', benefitType: 'FREE_SHIPPING', effectiveSaving: 99, estimatedDiscount: 0, eligible: true };
    render(<CouponSelector coupons={[freeDelivery]} bestCouponCode="SHIPFREE" onApply={jest.fn()} onRemove={jest.fn()} />);
    expect(screen.getByText(/Save up to Rs. 99 with SHIPFREE/i)).toBeInTheDocument();
  });
});
