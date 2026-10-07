import { Component, lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { CartContext } from '../../context/CartContext';
import { WishlistContext } from '../../context/WishlistContext';
import { useWebsiteCustomization } from '../../context/WebsiteCustomizationContext';
import { buildWebsiteCssVariables } from '../../config/websiteCustomization';
import { PREVIEW_PAGES, websiteDataAttributes } from '../../config/websiteDesigner';
import Navbar from '../../components/layout/Navbar';
import MobileHeader from '../../components/layout/MobileHeader';
import MobileBottomNav from '../../components/layout/MobileBottomNav';
import Footer from '../../components/layout/Footer';

const Home = lazy(() => import('../customer/Home'));
const Products = lazy(() => import('../customer/Products'));
const Contact = lazy(() => import('../customer/Contact'));
const noop = () => {};
const guest = { user: null, loading: false, switchMode: noop };
const emptyCart = { items: [], itemCount: 0, loading: false, getCartItem: noop, addToCart: noop };
const emptyWishlist = { items: [], loading: false, toggleWishlist: noop, addToWishlist: noop, removeFromWishlist: noop };

// A fresh iframe document supplies real CSS/media-query boundaries. No auth,
// cart syncing, attribution or shopper storage providers run in this route.
export default function WebsitePreview() {
  return <PreviewErrorBoundary><PreviewContent /></PreviewErrorBoundary>;
}

export class PreviewErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() {
    const token = new URLSearchParams(window.location.search).get('token');
    if (token && window.parent !== window) {
      window.parent.postMessage({ type: 'samira:preview-error', token }, window.location.origin);
    }
  }
  render() {
    return this.state.failed
      ? <p role="alert" className="p-6 text-sm text-slate-600">This preview could not render. Your editor draft is safe. Use Retry preview in Website Designer.</p>
      : this.props.children;
  }
}

function PreviewContent() {
  const { config, loading } = useWebsiteCustomization();
  const [path, setPath] = useState('/');
  const websiteStyle = useMemo(() => buildWebsiteCssVariables(config), [config]);
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token || window.parent === window) return undefined;
    const receive = (event) => {
      if (event.origin !== window.location.origin || event.source !== window.parent ||
        event.data?.token !== token || event.data?.type !== 'samira:theme-preview') return;
      if (PREVIEW_PAGES.some((page) => page.path === event.data.path)) setPath(event.data.path);
    };
    const prevent = (event) => { event.preventDefault(); event.stopImmediatePropagation(); };
    window.addEventListener('message', receive);
    document.addEventListener('click', prevent, true);
    document.addEventListener('submit', prevent, true);
    window.parent.postMessage({ type: 'samira:preview-ready', token }, window.location.origin);
    return () => {
      window.removeEventListener('message', receive);
      document.removeEventListener('click', prevent, true);
      document.removeEventListener('submit', prevent, true);
    };
  }, []);
  if (loading) return <p className="p-6 text-sm text-slate-500">Open this preview from Website Designer.</p>;
  const Page = path === '/products' ? Products : path === '/contact' ? Contact : path === '/' ? Home : null;
  return <AuthContext.Provider value={guest}><CartContext.Provider value={emptyCart}><WishlistContext.Provider value={emptyWishlist}>
    <div className="site-storefront min-h-screen bg-ivory text-charcoal" style={websiteStyle} {...websiteDataAttributes(config)}>
      <Navbar navigate={noop} route={path} />
      <MobileHeader navigate={noop} route={path} />
      <main className="pb-20 lg:pb-0"><Suspense fallback={<p className="p-6">Loading storefront…</p>}>{Page ? <Page key={path} navigate={noop} route={path} /> : <CommerceFlowPreview path={path} config={config} />}</Suspense></main>
      <Footer navigate={noop} /><MobileBottomNav active={path} navigate={noop} />
    </div>
  </WishlistContext.Provider></CartContext.Provider></AuthContext.Provider>;
}

const sampleProducts = [
  { name: 'Premium signature product', price: '₹2,899', note: 'New season' },
  { name: 'Customer favourite', price: '₹1,799', note: 'Best seller' },
  { name: 'Everyday essential', price: '₹999', note: 'Popular' },
];

function CommerceFlowPreview({ path, config }) {
  if (path === '/empty-preview') return <PreviewShell eyebrow="Empty state" title="Nothing here yet" note="Empty collections, bags and wishlists keep a clear next step."><div className="grid min-h-72 place-items-center rounded-2xl border border-dashed bg-white p-8 text-center"><div><div className="mx-auto h-20 w-20 rounded-full bg-[var(--site-secondary)]" /><h2 className="mt-5 text-xl font-bold">Your collection is waiting</h2><p className="mt-2 text-sm text-slate-500">Explore the latest products and save your favourites.</p><button className="site-theme-button mt-5 px-5 py-3">Continue shopping</button></div></div></PreviewShell>;
  if (path === '/error-preview') return <PreviewShell eyebrow="Service state" title="We could not load this page" note="Customers get a calm message and a safe retry action."><div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center"><h2 className="text-xl font-bold text-amber-950">Please try again</h2><p className="mt-2 text-sm text-amber-800">Your information is safe. Check the connection and retry.</p><button className="mt-5 rounded-xl border border-amber-400 bg-white px-5 py-3 font-bold text-amber-900">Retry</button></div></PreviewShell>;
  if (path === '/product-preview') return <PreviewShell eyebrow="Product detail" title="Premium signature product" note="This checks product copy, pricing, buttons and card styles together.">
    <div className="grid gap-5 lg:grid-cols-2"><PreviewImage tall /><div className="space-y-4 rounded-2xl border bg-white p-5"><p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--site-primary)]">{config.branding.websiteName}</p><h2 className="text-2xl font-bold">Premium signature product</h2><p className="text-2xl font-black">₹2,899 <span className="text-sm font-medium text-slate-400 line-through">₹5,999</span></p><p className="text-sm text-emerald-700">Inclusive of all taxes</p><div className="flex gap-2"><button className="site-theme-button flex-1 px-4 py-3">Add to bag</button><button className="rounded-xl border px-4 py-3 font-bold">Buy now</button></div></div></div>
  </PreviewShell>;
  if (path === '/wishlist') return <PreviewShell eyebrow="Saved styles" title="My Wishlist" note="Items saved for later appear here."><PreviewProductGrid /></PreviewShell>;
  if (path === '/cart') return <PreviewShell eyebrow="Step 1 of 3" title="Shopping bag" note="2 items ready for checkout."><div className="grid gap-5 lg:grid-cols-[1fr_320px]"><div className="space-y-3">{sampleProducts.slice(0, 2).map((product) => <PreviewLine key={product.name} product={product} />)}</div><SummaryCard button="Continue to address" /></div></PreviewShell>;
  if (path === '/checkout') return <PreviewShell eyebrow="Secure checkout" title="Delivery & payment" note="Review address, delivery and payment before placing the order."><div className="grid gap-5 lg:grid-cols-[1fr_320px]"><div className="space-y-4"><PreviewPanel title="Delivery address" body="Rohit Kumar · Kangra, Himachal Pradesh · 176001" /><PreviewPanel title="Payment method" body="UPI, cards and Cash on Delivery are presented according to store settings." /></div><SummaryCard button="Place order" /></div></PreviewShell>;
  if (path === '/payment-preview') return <PreviewShell eyebrow="Step 3 of 3" title="Choose payment method" note="Available methods follow payment settings and order eligibility."><div className="grid gap-5 lg:grid-cols-[1fr_320px]"><div className="space-y-3"><PreviewPanel title="UPI" body="Pay securely using any supported UPI app." /><PreviewPanel title="Credit or debit card" body="Card details are handled by the configured payment provider." /><PreviewPanel title="Cash on Delivery" body="Availability is checked separately from online payment status." /></div><SummaryCard button="Pay ₹3,498" /></div></PreviewShell>;
  if (path === '/addresses') return <PreviewShell eyebrow="Account" title="Saved addresses" note="Customers can add, edit and choose delivery addresses."><div className="grid gap-4 md:grid-cols-2"><PreviewPanel title="Home · Default" body="Rohit Kumar · Ward no. 5, Kangra, Himachal Pradesh · 176001" /><div className="grid min-h-36 place-items-center rounded-2xl border border-dashed bg-white text-sm font-bold text-[var(--site-primary)]">+ Add a new address</div></div></PreviewShell>;
  if (path === '/orders') return <PreviewShell eyebrow="Account" title="My orders" note="Payment and delivery status stay separate."><div className="space-y-3"><PreviewOrder status="In transit" /><PreviewOrder status="Delivered" /><PreviewOrder status="Processing" /></div></PreviewShell>;
  if (path === '/order-preview') return <PreviewShell eyebrow="Order SC-DEMO123" title="Order details" note="Estimated delivery: 14 Sep"><PreviewPanel title="Shipment progress" body="Order placed  •  Packed  •  In transit  •  Out for delivery  •  Delivered" /><div className="mt-4"><PreviewLine product={sampleProducts[0]} /></div></PreviewShell>;
  if (path === '/returns') return <PreviewShell eyebrow="After-sales support" title="Returns & exchanges" note="Eligible items, return reasons and refund progress are easy to understand."><PreviewPanel title="Return requested" body="Premium signature product · Pickup will be scheduled after approval · Refund method: original payment source" /></PreviewShell>;
  if (path === '/notifications') return <PreviewShell eyebrow="Latest updates" title="Notifications" note="Order, delivery, return and offer updates."><div className="overflow-hidden rounded-2xl border bg-white">{['Your order is on the way', 'New collection is now live', 'Return request approved'].map((title, index) => <div key={title} className="flex gap-3 border-b p-4 last:border-0"><span className={`mt-1 h-2.5 w-2.5 rounded-full ${index ? 'bg-slate-200' : 'bg-[var(--site-primary)]'}`} /><div><p className="font-bold">{title}</p><p className="mt-1 text-xs text-slate-500">Preview notification details and timestamp</p></div></div>)}</div></PreviewShell>;
  return null;
}

function PreviewShell({ eyebrow, title, note, children }) { return <section className="mx-auto max-w-[var(--site-content-max)] px-4 py-6 sm:px-6 lg:py-10"><p className="text-xs font-bold uppercase tracking-[.22em] text-[var(--site-primary)]">{eyebrow}</p><h1 className="mt-2 text-3xl font-bold">{title}</h1><p className="mt-1 text-sm text-slate-500">{note}</p><div className="mt-6">{children}</div></section>; }
function PreviewImage({ tall = false }) { return <div className={`rounded-2xl bg-gradient-to-br from-[var(--site-secondary)] via-white to-[var(--site-accent)]/20 ${tall ? 'min-h-[430px]' : 'aspect-[4/5]'}`} aria-label="Product image placeholder" />; }
function PreviewProductGrid() { return <div className="grid grid-cols-2 gap-4 md:grid-cols-3">{sampleProducts.map((product) => <article key={product.name} className="overflow-hidden rounded-[var(--site-card-radius)] bg-white shadow-sm"><PreviewImage /><div className="p-3"><p className="truncate font-bold">{product.name}</p><p className="mt-1 text-sm font-black">{product.price}</p><button className="site-theme-button mt-3 w-full px-3 py-2 text-xs">Move to bag</button></div></article>)}</div>; }
function PreviewLine({ product }) { return <article className="flex gap-4 rounded-2xl border bg-white p-4"><div className="h-24 w-20 shrink-0 rounded-xl bg-[var(--site-secondary)]" /><div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase text-[var(--site-primary)]">{product.note}</p><p className="mt-1 truncate font-bold">{product.name}</p><p className="mt-2 font-black">{product.price}</p><p className="mt-2 text-xs text-slate-500">Qty 1 · Ready to ship</p></div></article>; }
function PreviewPanel({ title, body }) { return <div className="min-h-36 rounded-2xl border bg-white p-5"><p className="font-black">{title}</p><p className="mt-3 text-sm leading-6 text-slate-600">{body}</p><button className="mt-4 text-xs font-bold text-[var(--site-primary)]">Change</button></div>; }
function SummaryCard({ button }) { return <aside className="h-fit rounded-2xl border bg-white p-5"><p className="font-black">Price details</p><dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between"><dt>Total MRP</dt><dd>₹4,698</dd></div><div className="flex justify-between text-emerald-700"><dt>Discount</dt><dd>- ₹1,200</dd></div><div className="flex justify-between"><dt>Delivery</dt><dd>FREE</dd></div><div className="flex justify-between border-t pt-3 font-black"><dt>Total</dt><dd>₹3,498</dd></div></dl><button className="site-theme-button mt-5 w-full px-4 py-3">{button}</button></aside>; }
function PreviewOrder({ status }) { return <article className="flex flex-wrap items-center gap-4 rounded-2xl border bg-white p-4"><div className="h-16 w-14 rounded-lg bg-[var(--site-secondary)]" /><div className="min-w-0 flex-1"><p className="font-bold">SC-DEMO123 · Premium signature product</p><p className="mt-1 text-xs text-slate-500">Placed 10 Sep · ₹2,899</p></div><span className="rounded-full bg-[var(--site-secondary)] px-3 py-1 text-xs font-bold text-[var(--site-primary)]">{status}</span></article>; }
