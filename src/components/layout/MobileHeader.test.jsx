import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import MobileHeader from './MobileHeader';

jest.mock('../../context/CartContext', () => ({
  useCart: () => ({ itemCount: 0 }),
}));

jest.mock('../../context/WishlistContext', () => ({
  useWishlist: () => ({ items: [] }),
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: null, switchMode: jest.fn() }),
}));

jest.mock('../../context/WebsiteCustomizationContext', () => ({
  useWebsiteCustomization: () => ({ config: { header: {} } }),
}));

jest.mock('../../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

describe('mobile header search', () => {
  test('keeps search collapsed until the icon is pressed, then submits the focused search view', () => {
    const navigate = jest.fn();
    render(<MobileHeader navigate={navigate} route="/wishlist" />);

    expect(screen.queryByAltText('Jassi General Store')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Search sarees, suits, kurtis...')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Search products' }));
    const searchInput = screen.getByPlaceholderText('Search sarees, suits, kurtis...');
    expect(searchInput).toHaveFocus();

    fireEvent.change(searchInput, { target: { value: 'silk saree' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(navigate).toHaveBeenCalledWith('/search?search=silk%20saree');
    expect(screen.queryByRole('dialog', { name: 'Search products' })).not.toBeInTheDocument();
  });

  test('opens the mobile shopping drawer and routes through its category links', () => {
    const navigate = jest.fn();
    render(<MobileHeader navigate={navigate} route="/" />);

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));

    expect(screen.getByRole('dialog', { name: 'Shopping menu' })).toBeInTheDocument();
    expect(screen.getByText('Secure login with mobile number and OTP')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Login \/ Sign up/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sarees' }));
    expect(navigate).toHaveBeenCalledWith('/products?search=Saree');
    expect(screen.queryByRole('dialog', { name: 'Shopping menu' })).not.toBeInTheDocument();
  });

    test('closes the shopping drawer from the visible header close button', () => {
    render(<MobileHeader navigate={jest.fn()} route="/" />);

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const drawer = screen.getByRole('dialog', { name: 'Shopping menu' });
    expect(drawer).toHaveClass('translate-x-0');
    expect(drawer).toHaveClass('transition-transform');
    fireEvent.click(screen.getByRole('button', { name: 'Close menu panel' }));

    expect(drawer).toHaveClass('-translate-x-full');
    expect(screen.queryByRole('dialog', { name: 'Shopping menu' })).not.toBeInTheDocument();
  });
});
