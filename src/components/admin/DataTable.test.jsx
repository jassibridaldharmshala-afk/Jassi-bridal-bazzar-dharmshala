import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import DataTable from './DataTable';

describe('admin data table', () => {
  test('adds mobile labels and displays the live record count', () => {
    render(
      <DataTable
        title="Orders"
        heads={['Order ID', 'Customer']}
        rows={[
          <tr key="1">
            <td>SC-1001</td>
            <td>Jassi Customer</td>
          </tr>,
        ]}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Orders' })).toBeInTheDocument();
    expect(screen.getByText('1 record')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'SC-1001' })).toHaveAttribute('data-label', 'Order ID');
    expect(screen.getByRole('cell', { name: 'Jassi Customer' })).toHaveAttribute('data-label', 'Customer');
  });
});
