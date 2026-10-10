import { NotificationProvider } from './context/NotificationContext';
import { lazy, Suspense, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import ApplicationTheme from './components/ui/ApplicationTheme';
import { AuthProvider } from './context/AuthContext';
import { RentalBagProvider } from './context/RentalBagContext';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';
import Navbar from './components/layout/Navbar';
import MobileHeader from './components/layout/MobileHeader';
import MobileBottomNav from './components/layout/MobileBottomNav';
import Footer from './components/layout/Footer';
import ProtectedRoute from './components/layout/ProtectedRoute';
import LazyBoundary from './components/ui/LazyBoundary';
import { StorefrontProvider, useStorefront } from './context/StorefrontContext';
import { WebsiteCustomizationProvider, useWebsiteCustomization } from './context/WebsiteCustomizationContext';
import { isWebsitePreview, websiteDataAttributes } from './config/websiteDesigner';
import { buildWebsiteCssVariables } from './config/websiteCustomization';
import { reelProductImportEnabled } from './config/features';
import { markLoginPromptDismissed } from './utils/loginPromptStorage';
import MobileOverlayLoader from './components/ui/MobileOverlayLoader';
import AdminActivityIndicator, { AdminLoadingPlaceholder } from './components/admin/AdminActivityIndicator';
import { isAdminWorkspace } from './utils/adminActivity';
import StorefrontSkeleton from './components/ui/StorefrontSkeleton';
import TrafficTracking from './components/analytics/TrafficTracking';
import MobileAppCompanion from './components/pwa/MobileAppCompanion';
import { useAuth } from './context/AuthContext';
import { getMobileLoaderSnapshot, subscribeMobileLoader } from './utils/mobileLoader';
import { createStoragePlan } from './utils/userStorage';
import { parseStoreSlug } from './utils/attribution';
import { storefrontPath, boutiquePath, consumeLegacyHash, pushAppRoute, readAppRoute, ROUTE_CHANGE_EVENT } from './utils/routing';

const AdminRoute = lazy(() => import('./components/layout/AdminRoute'));
const SellerRoute = lazy(() => import('./components/layout/SellerRoute'));
const LoginPrompt = lazy(() => import('./components/auth/LoginPrompt'));
const SystemStatus = lazy(() => import('./pages/admin/SystemStatus'));
const StoreContent = lazy(() => import('./pages/admin/StoreContent'));
const WebsitePreview = lazy(() => import('./pages/admin/WebsitePreview'));
const Home = lazy(() => import('./pages/customer/Home'));
const Products = lazy(() => import('./pages/customer/Products'));
const ProductDetail = lazy(() => import('./pages/customer/ProductDetail'));
const Wishlist = lazy(() => import('./pages/customer/Wishlist'));
const Cart = lazy(() => import('./pages/customer/Cart'));
const Checkout = lazy(() => import('./pages/customer/Checkout'));
const Login = lazy(() => import('./pages/customer/Login'));
const Register = lazy(() => import('./pages/customer/Register'));
const Profile = lazy(() => import('./pages/customer/Profile'));
const ProfileDetails = lazy(() => import('./pages/customer/ProfileDetails'));
const AddressManagement = lazy(() => import('./pages/customer/AddressManagement'));
const MyOrders = lazy(() => import('./pages/customer/MyOrders'));
const MyRentals = lazy(() => import('./pages/customer/MyRentals'));
const RentalCart = lazy(() => import('./pages/customer/RentalCart'));
const RentalSuccess = lazy(() => import('./pages/customer/RentalSuccess'));
const RentalCheckout = lazy(() => import('./pages/customer/RentalCheckout'));
const RentalOperations = lazy(() => import('./pages/admin/Rentals'));
const OrderDetail = lazy(() => import('./pages/customer/OrderDetail'));
const OrderSuccess = lazy(() => import('./pages/customer/OrderSuccess'));
const PaymentFailed = lazy(() => import('./pages/customer/PaymentFailed'));
const Contact = lazy(() => import('./pages/customer/Contact'));
const MyReturns = lazy(() => import('./pages/customer/MyReturns'));
const Notifications = lazy(() => import('./pages/customer/Notifications'));
const StoreHome = lazy(() => import('./pages/customer/StoreHome'));
const SellerDashboard = lazy(() => import('./pages/seller/Dashboard'));
const SellerOnboarding = lazy(() => import('./pages/seller/Onboarding'));
const SellerProducts = lazy(() => import('./pages/seller/Products'));
const SellerOrders = lazy(() => import('./pages/seller/Orders'));
const SellerCrm = lazy(() => import('./pages/seller/Crm'));
const SellerInbox = lazy(() => import('./pages/seller/Inbox'));
const SocialWorkspace = lazy(() => import('./pages/admin/SocialWorkspace'));
const SellerAudit = lazy(() => import('./pages/seller/Audit'));
const SellerAnalytics = lazy(() => import('./pages/seller/Analytics'));
const SellerProductForm = lazy(() => import('./pages/seller/ProductFormPage'));
const BusinessCenter = lazy(() => import('./pages/seller/BusinessCenter'));
const StoreDesigner = lazy(() => import('./pages/seller/StoreDesigner'));
const SeoHead = lazy(() => import('./components/seo/SeoHead'));
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminProducts = lazy(() => import('./pages/admin/Products'));
const ProductDrafts = lazy(() => import('./pages/admin/ProductDrafts'));
const AddProduct = lazy(() => import('./pages/admin/AddProduct'));
const QuickAddProduct = lazy(() => import('./pages/admin/QuickAddProduct'));
const EditProduct = lazy(() => import('./pages/admin/EditProduct'));
const Categories = lazy(() => import('./pages/admin/Categories'));
const EditCategory = lazy(() => import('./pages/admin/EditCategory'));
const VariantGroups = lazy(() => import('./pages/admin/VariantGroups'));
const Orders = lazy(() => import('./pages/admin/Orders'));
const AdminOrderDetail = lazy(() => import('./pages/admin/OrderDetail'));
const Customers = lazy(() => import('./pages/admin/Customers'));
const Coupons = lazy(() => import('./pages/admin/Coupons'));
const Banners = lazy(() => import('./pages/admin/Banners'));
const CampaignBuilder = lazy(() => import('./pages/admin/CampaignBuilder'));
const Reviews = lazy(() => import('./pages/admin/Reviews'));
const Returns = lazy(() => import('./pages/admin/Returns'));
const Inventory = lazy(() => import('./pages/admin/Inventory'));
const Reports = lazy(() => import('./pages/admin/Reports'));
const Settings = lazy(() => import('./pages/admin/Settings'));
const WebsiteCustomizer = lazy(() => import('./pages/admin/WebsiteCustomizer'));
const Support = lazy(() => import('./pages/admin/Support'));
const Subscribers = lazy(() => import('./pages/admin/Subscribers'));
const AuditLogs = lazy(() => import('./pages/admin/AuditLogs'));
const ReelProductImport = lazy(() => import('./pages/admin/ReelProductImport'));
const SocialProductImport = lazy(() => import('./pages/admin/SocialProductImport'));
const ContextualHelp = lazy(() => import('./components/help/ContextualHelp'));

const customerRoutes = {
  '/': Home,
  '/products': Products,
  '/category': Products,
  '/search': Products,
  '/product': ProductDetail,
  '/wishlist': Wishlist,
  '/cart': Cart,
  '/checkout': Checkout,
  '/login': Login,
  '/register': Register,
  '/profile': Profile,
  '/profile/details': ProfileDetails,
  '/profile/addresses': AddressManagement,
  '/profile/addresses/new': AddressManagement,
  '/profile/addresses/edit': AddressManagement,
  '/orders': MyOrders,
  '/rentals': MyRentals,
  '/rental-book': RentalCheckout,
  '/rental-cart': RentalCart,
  '/rental-checkout': RentalCheckout,
  '/rental-success': RentalSuccess,
  '/order-detail': OrderDetail,
  '/order-success': OrderSuccess,
  '/payment-failed': PaymentFailed,
  '/contact': Contact,
  '/privacy-policy': Contact,
  '/terms': Contact,
  '/return-policy': Contact,
  '/shipping-policy': Contact,
  '/cancellation-policy': Contact,
  '/size-guide': Contact,
  '/faqs': Contact,
  '/our-story': Contact,
  '/returns': MyReturns,
  '/notifications': Notifications,
};

const sellerRoutes = {
  '/seller': SellerDashboard,
  '/seller/notifications': Notifications,
  '/seller/onboarding': SellerOnboarding,
  '/seller/products': SellerProducts,
  '/seller/variant-groups': VariantGroups,
  '/seller/products/add': SellerProductForm,
  '/seller/products/edit': SellerProductForm,
  '/seller/inventory': Inventory,
  '/seller/orders': SellerOrders,
  '/seller/rentals': RentalOperations,
  '/seller/returns': Returns,
  '/seller/orders/detail': AdminOrderDetail,
  '/seller/crm': SellerCrm,
  '/seller/offers': Coupons,
  '/seller/banners': Banners,
  '/seller/campaigns': CampaignBuilder,
  '/seller/reviews': Reviews,
  '/seller/inbox': SellerInbox,
  '/seller/instagram': SocialWorkspace,
  '/seller/social': SocialWorkspace,
  '/seller/audit': SellerAudit,
  '/seller/analytics': SellerAnalytics,
  '/seller/reports': Reports,
  '/seller/traffic': Reports,
  '/seller/business': BusinessCenter,
  '/seller/settings': Settings,
  '/seller/design': StoreDesigner,
  '/seller/content': StoreContent,
};

const adminRoutes = {
  '/admin': Dashboard,
  '/admin/notifications': Notifications,
  '/admin/products': AdminProducts,
  '/admin/product-drafts': ProductDrafts,
  '/admin/products/add': AddProduct,
  '/admin/products/quick-add': QuickAddProduct,
  '/admin/products/edit': EditProduct,
  '/admin/categories': Categories,
  '/admin/categories/edit': EditCategory,
  '/admin/variant-groups': VariantGroups,
  '/admin/orders': Orders,
  '/admin/rentals': RentalOperations,
  '/admin/orders/detail': AdminOrderDetail,
  '/admin/customers': Customers,
  '/admin/coupons': Coupons,
  '/admin/banners': Banners,
  '/admin/campaigns': CampaignBuilder,
  '/admin/reviews': Reviews,
  '/admin/returns': Returns,
  '/admin/inventory': Inventory,
  '/admin/reports': Reports,
  '/admin/traffic': Reports,
  '/admin/support': Support,
  '/admin/subscribers': Subscribers,
  '/admin/audit': AuditLogs,
  '/admin/social-import': SocialProductImport,
  '/admin/settings': Settings,
  '/admin/customization': WebsiteCustomizer,
  '/admin/store-content': StoreContent,
  '/admin/system': SystemStatus,
  ...(reelProductImportEnabled ? { '/admin/reel-import': ReelProductImport } : {}),
  '/admin/social': SocialWorkspace,
  '/admin/business': BusinessCenter,
};


function useAppRoute() {
  const [route, setRoute] = useState(() => readAppRoute());

  useEffect(() => {
    consumeLegacyHash();
    setRoute(readAppRoute());
    const onChange = () => setRoute(readAppRoute());
    const onClick = (event) => {
      const anchor = event.target.closest?.('a[href]');
      if (!anchor || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (anchor.target && anchor.target !== '_self') return;
      const href = anchor.getAttribute('href') || '';
      if (!href.startsWith('/') || href.startsWith('//') || href.startsWith('/api') || href.startsWith('/uploads')) return;
      event.preventDefault();
      pushAppRoute(storefrontPath(href, parseStoreSlug(window.location.pathname)));
      setRoute(readAppRoute());
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('popstate', onChange);
    window.addEventListener('hashchange', onChange);
    window.addEventListener(ROUTE_CHANGE_EVENT, onChange);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('popstate', onChange);
      window.removeEventListener('hashchange', onChange);
      window.removeEventListener(ROUTE_CHANGE_EVENT, onChange);
      document.removeEventListener('click', onClick);
    };
  }, []);

  const navigate = useCallback((path) => {
    pushAppRoute(path);
    setRoute(readAppRoute());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return [route, navigate];
}

export default function App() {
  const [route, navigate] = useAppRoute();

  return (
    <WebsiteCustomizationProvider route={route}>
      <ApplicationTheme>
        {isWebsitePreview() ? <Suspense fallback={<RouteFallback />}><WebsitePreview /></Suspense> : <AuthProvider navigate={navigate}>
          <NotificationProvider navigate={navigate}><StorefrontProvider route={route}>
            <TrafficTracking route={route} />
            <AppShell route={route} navigate={navigate} />
          </StorefrontProvider></NotificationProvider>
        </AuthProvider>}
      </ApplicationTheme>
    </WebsiteCustomizationProvider>
  );
}

function AppShell({ route, navigate }) {
  const routePath = route.split('?')[0];
  const logicalPath = boutiquePath(routePath);
  const routeGuardPath = logicalPath.replace(/^\/store\/[^/]+(?=\/|$)/, '') || '/';
  const isAdmin = routePath.startsWith('/admin');
  const isSeller = routePath.startsWith('/seller');
  const { user } = useAuth();
  const { isHostStore, storeSlug } = useStorefront();
  const customerNavigate = useCallback(path => navigate(storefrontPath(path, storeSlug)), [navigate, storeSlug]);
  const { config: websiteConfig } = useWebsiteCustomization();
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches);
  const mobileLoaderActive = useSyncExternalStore(subscribeMobileLoader, getMobileLoaderSnapshot, getMobileLoaderSnapshot);
  const [showMobileLoader, setShowMobileLoader] = useState(false);
  const protectedRoutes = [
    '/profile',
    '/profile/details',
    '/profile/addresses',
    '/profile/addresses/new',
    '/profile/addresses/edit',
    '/orders',
    '/rentals',
    '/rental-success',
    '/checkout',
    '/order-detail',
    '/order-success',
    '/returns',
    '/notifications',
  ];
  const focusedMobileRoutes = ['/rental-cart', '/rental-checkout', '/rental-success', '/rentals', '/product', '/cart', '/checkout', '/wishlist', '/orders', '/order-detail', '/order-success', '/profile/addresses'];
  const hideMobileBottomNavRoutes = ['/rental-checkout', '/checkout', '/profile/details'];
  const standaloneAuthRoutes = ['/login', '/register'];
  const immersiveRoutes = ['/profile/addresses/new', '/profile/addresses/edit'];
  const cartStoragePlan = useMemo(() => createStoragePlan(storeSlug ? 'samira_cart:' + storeSlug : 'samira_cart', user), [user, storeSlug]);
  const wishlistStoragePlan = useMemo(() => createStoragePlan(storeSlug ? 'samira_wishlist:' + storeSlug : 'samira_wishlist', user), [user, storeSlug]);
  const isProductPage = routePath === '/product'
    || routePath.startsWith('/product/')
    || /^\/store\/[^/]+\/product$/.test(logicalPath)
    || /\/products\/[^/]+$/.test(logicalPath)
    || /\/product\/[^/]+$/.test(logicalPath);
  const hideMobileHeader = focusedMobileRoutes.includes(routeGuardPath) || isProductPage;
  const loginFallback = (
    <Suspense fallback={<RouteFallback />}>
      <Login route={`/login?redirect=${encodeURIComponent(route)}`} />
    </Suspense>
  );
  const Page = useMemo(() => {
    // Legacy admin-login links use the same mobile + OTP flow as every account.
    if (routePath === '/admin/login') return AdminLogin;
    if (isAdmin) return adminRoutes[routePath] || Dashboard;
    if (isSeller) return sellerRoutes[routePath] || SellerDashboard;
    if (logicalPath.startsWith('/store/')) {
      const parts = logicalPath.split('/').filter(Boolean);
      if (parts[2] === 'product') return ProductDetail;
      if (parts[2] === 'products' && parts[3]) return ProductDetail;
      if (parts[2] === 'products' || parts[2] === 'search' || parts[2] === 'category') return Products;
      if (parts[2] === 'rentals') return MyRentals;
      if (parts[2] === 'rental-book') return RentalCheckout;
      return customerRoutes['/' + parts.slice(2).join('/')] || StoreHome;
    }
    if (routePath === '/product' || routePath.startsWith('/product/')) return ProductDetail;
    if (routePath.startsWith('/products/') && routePath.split('/').filter(Boolean).length >= 2) return ProductDetail;
    if (isHostStore && routePath === '/') return StoreHome;
    return customerRoutes[routePath] || Home;
  }, [isAdmin, isHostStore, isSeller, logicalPath, routePath]);
  const page = (
    <LazyBoundary resetKey={route}><Suspense fallback={<RouteFallback />}>
      <Page navigate={isAdmin || isSeller ? navigate : customerNavigate} route={route} />
    </Suspense></LazyBoundary>
  );

  useEffect(() => { setShowLoginPrompt(false); }, [routePath, user]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const onChange = (event) => setIsMobile(event.matches);
    media.addEventListener('change', onChange);
    setIsMobile(media.matches);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setShowMobileLoader(false);
      return;
    }

    if (!mobileLoaderActive) {
      const hideTimer = window.setTimeout(() => setShowMobileLoader(false), 120);
      return () => window.clearTimeout(hideTimer);
    }

    const showTimer = window.setTimeout(() => setShowMobileLoader(true), 120);
    return () => window.clearTimeout(showTimer);
  }, [isMobile, mobileLoaderActive]);

  const closeLoginPrompt = () => {
    markLoginPromptDismissed();
    setShowLoginPrompt(false);
  };
  const desktopProfileLogin = routeGuardPath === '/profile' && !user && !isMobile;
  const shouldShowStandaloneAuth =
    standaloneAuthRoutes.includes(routeGuardPath) ||
    ((protectedRoutes.includes(routeGuardPath) && !user) && !desktopProfileLogin);
  const authContent = protectedRoutes.includes(routeGuardPath) && !user ? loginFallback : page;
  const showShell = !(isMobile && immersiveRoutes.includes(routePath));
  const websiteStyle = useMemo(() => buildWebsiteCssVariables(websiteConfig), [websiteConfig]);
  const mainContent = desktopProfileLogin
    ? loginFallback
    : protectedRoutes.includes(routeGuardPath)
      ? (
        <ProtectedRoute>
          {page}
        </ProtectedRoute>
      )
      : page;

  return (
    <div
      className={`min-h-screen bg-ivory text-charcoal ${!isAdmin && !isSeller ? 'site-storefront' : ''}`}
      style={!isAdmin && !isSeller ? websiteStyle : undefined}
      {...(!isAdmin && !isSeller ? websiteDataAttributes(websiteConfig) : {})}
    >
      <CartProvider key={cartStoragePlan.storageName} storageName={cartStoragePlan.storageName} legacyStorageNames={cartStoragePlan.legacyStorageNames}>
        <WishlistProvider key={wishlistStoragePlan.storageName} storageName={wishlistStoragePlan.storageName} legacyStorageNames={wishlistStoragePlan.legacyStorageNames}>
          <RentalBagProvider user={user} storeSlug={storeSlug}>
          <MobileAppCompanion enabled={!isAdmin && !isSeller} />
          <Suspense fallback={null}><ContextualHelp route={route} navigate={navigate} /></Suspense>
          {isAdmin ? (
            routePath === '/admin/login' ? (
              page
            ) : (
              <LazyBoundary resetKey={route}><Suspense fallback={<RouteFallback />}><AdminRoute>
                {page}
              </AdminRoute></Suspense></LazyBoundary>
            )
          ) : isSeller ? (
            routePath === '/seller/onboarding' ? (
              <ProtectedRoute>{page}</ProtectedRoute>
            ) : (
              <LazyBoundary resetKey={route}><Suspense fallback={<RouteFallback />}><SellerRoute>{page}</SellerRoute></Suspense></LazyBoundary>
            )
          ) : shouldShowStandaloneAuth ? (
            authContent
          ) : (
            <>
              {showShell && <Navbar navigate={navigate} route={route} />}
              {showShell && !hideMobileHeader && <MobileHeader navigate={navigate} route={route} />}
              <main className={`${showShell ? 'pb-20 lg:pb-0' : ''}`}>
                <Suspense fallback={null}><SeoHead route={route} /></Suspense>
                {mainContent}
              </main>
              {showShell && <Footer navigate={navigate} />}
              {showShell && !hideMobileBottomNavRoutes.includes(routePath) && <MobileBottomNav route={route} active={routePath} navigate={navigate} />}
              {showShell && showLoginPrompt && (
                <LazyBoundary resetKey={route}><Suspense fallback={null}>
                <LoginPrompt
                  open={showLoginPrompt}
                  onClose={closeLoginPrompt}
                  onContinue={(phone) => {
                    markLoginPromptDismissed();
                    setShowLoginPrompt(false);
                    const redirectQuery = `redirect=${encodeURIComponent(route)}`;
                    const phoneQuery = phone ? `phone=${encodeURIComponent(phone)}` : '';
                    const autoSendQuery = phone ? 'autoSendOtp=1' : '';
                    const consentQuery = phone ? 'consent=1' : '';
                    navigate(`/login?${[redirectQuery, phoneQuery, autoSendQuery, consentQuery].filter(Boolean).join('&')}`);
                  }}
                />
                </Suspense></LazyBoundary>
              )}
            </>
          )}
          </RentalBagProvider>
        </WishlistProvider>
      </CartProvider>
      <AdminActivityIndicator enabled={(isAdmin || isSeller) && Boolean(user)} />
      {showMobileLoader && !isAdmin && !isSeller && <MobileOverlayLoader />}
    </div>
  );
}

function RouteFallback() {
  if (isAdminWorkspace()) return <AdminLoadingPlaceholder label="Opening workspace" />;
  // Chunk downloads never cover the header, search, back button or cart.
  return <StorefrontSkeleton label="Loading page" />;
}
