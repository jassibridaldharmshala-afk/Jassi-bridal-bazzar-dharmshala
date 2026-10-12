import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, Check, Clock3, Copy, CreditCard, Download, FileText, Headphones, Package, ShoppingBag, Store, UserRound } from 'lucide-react';
import { OrderItem, OrderModal } from '../order/OrderUi';
import RentalDocuments from './RentalDocuments';
import { buildRentalReceipt, rentalConfirmationState } from '../../utils/rentalReceipt';
import { customerName, customerEmail } from '../../utils/customerIdentity';
import { rentalCopy } from '../../utils/rentalCopy';
import { rentalUseDayLabel } from '../../utils/rentalShopping';
import { rentalDate, rentalMoney } from '../../utils/rentals';
import { invoiceAddress } from '../../utils/receiptData';
import { downloadReceiptPdf } from '../../utils/printReceipt';
import '../../pages/customer/OrderSuccess.css';
import './RentalBookingConfirmation.css';

const steps = [['Booked', ShoppingBag], ['Preparing', Package], ['With you', UserRound], ['Returned', Check]];

export default function RentalBookingConfirmation({ booking, clockNow, busy, methods, method, setMethod, methodError, methodsLoading, loadMethods, pay, contact, navigate, refresh, refreshing, error, message }) {
  const [invoiceOpen, setInvoiceOpen] = useState(false), [downloading, setDownloading] = useState(false);
  const [documentError, setDocumentError] = useState(''), [notice, setNotice] = useState('');
  const alive = useRef(false), documentLock = useRef(false), paymentRef = useRef(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const receipt = useMemo(() => { try { return buildRentalReceipt(booking); } catch { return null; } }, [booking]);
  const state = rentalConfirmationState(booking, clockNow);
  const StatusIcon = state.tone === 'success' ? Check : state.tone === 'warning' ? Clock3 : FileText;
  const b = booking, quote = b.quote || {}, finance = b.financial || {}, tz = b.policy?.timezone || 'Asia/Kolkata';
  const held = b.status === 'HELD' && state.tone === 'warning';
  const terminal = state.tone === 'neutral' || ['RETURNED', 'CLOSED'].includes(b.status);
  const canPay = state.tone !== 'neutral' && ['HELD', 'CONFIRMED', 'PREPARING', 'READY', 'OUT', 'RETURNED'].includes(b.status) && Number(finance.balancePaise) > 0;
  const due = held ? Math.max(0, Number(quote.dueNowPaise || 0) - Number(finance.collectedPaise || 0)) : finance.balancePaise;
  const total = (b.adjustedRentalPaise ?? quote.rentalPaise ?? 0) + Number(quote.depositPaise || 0);
  const paid = finance.balancePaise === 0 && finance.collectedPaise > 0;
  const paymentLabel = terminal ? 'Settlement details' : paid ? 'Payment received' : finance.collectedPaise > 0 ? 'Advance received' : quote.paymentPlan === 'PICKUP' && !held ? 'Payment due at pickup' : 'Payment pending';
  const pickup = quote.deliveryMode === 'STORE_PICKUP';
  const seller = b.documents?.invoice?.seller || b.billingIdentity || {};
  const collection = pickup ? invoiceAddress(seller.billingAddress || seller.address || contact?.address) : invoiceAddress(b.bookingDetails?.deliveryAddress || b.logistics?.address);
  const viewBooking = () => navigate('/rentals?id=' + encodeURIComponent(b._id));
  const download = async () => {
    if (documentLock.current) return;
    documentLock.current = true; setDownloading(true); setDocumentError('');
    try { await downloadReceiptPdf(buildRentalReceipt(b)); if (alive.current) setNotice('Your rental PDF is ready. Check your downloads.'); }
    catch (err) { if (alive.current) setDocumentError(err.message || 'Unable to prepare your rental invoice. Please try again.'); }
    finally { documentLock.current = false; if (alive.current) setDownloading(false); }
  };
  const copy = async () => {
    try { if (!navigator.clipboard?.writeText) throw new Error('Select the booking number to copy it.'); await navigator.clipboard.writeText(b.number); if (alive.current) setNotice('Booking number copied.'); }
    catch (err) { if (alive.current) setNotice(err.message || 'Unable to copy the booking number.'); }
  };
  const documentLabel = b.documents?.invoice?.kind === 'PROFORMA' ? 'proforma' : 'invoice';
  const days = `${b.schedule.days} ${b.schedule.billingBasis === 'USE_DAYS' ? 'use' : 'rental'} day${b.schedule.days === 1 ? '' : 's'}`;
  const paymentRows = [['Rent & services', b.adjustedRentalPaise ?? quote.rentalPaise], ['Refundable deposit', quote.depositPaise], ['Payment received', finance.collectedPaise], ['Balance due', finance.balancePaise], ...(finance.deductionsPaise ? [['Approved charges', finance.deductionsPaise]] : []), ...(terminal || finance.refundedPaise ? [['Refund processed', finance.refundedPaise], ['Approved refund available', finance.refundablePaise]] : []), ...(finance.reservedRefundPaise > finance.refundedPaise ? [['Refund processing', finance.reservedRefundPaise - finance.refundedPaise]] : [])];
  const itemCount = quote.items.reduce((sum, item) => sum + item.quantity, 0);
  return <div className="sc-confirmation__shell">
    <nav className="sc-confirmation__nav" aria-label="Booking navigation"><button type="button" onClick={() => navigate('/orders?type=rental')}><ArrowLeft size={16} />My orders</button><span>Your rental</span></nav>
    <header className={`sc-confirmation__hero sc-confirmation__hero--${state.tone}`}>
      <div className="sc-confirmation__welcome"><span className="sc-confirmation__seal"><StatusIcon size={32} strokeWidth={1.6} /></span><div><p className="sc-confirmation__eyebrow">{state.label}</p><h1>{state.title}</h1><p className="sc-confirmation__intro">{state.message}</p><p className="sc-confirmation__quick-facts"><strong>{rentalMoney(total)}</strong><span aria-hidden="true">·</span><span>{paymentLabel}</span></p></div></div>
      <div className="sc-confirmation__actions"><button type="button" className="sc-confirmation__button" onClick={held ? () => { paymentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); paymentRef.current?.focus({ preventScroll: true }); } : viewBooking}>{held ? 'Complete payment' : state.step < 3 ? 'Track booking' : 'View booking'}<ArrowRight size={17} /></button><button type="button" className="sc-confirmation__button sc-confirmation__button--outline" onClick={() => navigate('/rental-book')}>Continue shopping</button></div>
      <div className="sc-confirmation__meta"><div><span>Booking</span><strong>{b.number}</strong><button type="button" aria-label="Copy booking number" onClick={copy}><Copy size={15} /></button></div><p>{b.createdAt ? `Booked ${rentalDate(b.createdAt, tz)}` : 'Booking details'}</p><button type="button" className="sc-confirmation__link" disabled={busy || refreshing} onClick={refresh}>{refreshing ? 'Updating…' : 'Refresh status'}</button></div>
    </header>
    {(notice || message) && <p className="sc-confirmation__notice" role="status">{notice || message}</p>}{error && <p className="sc-confirmation__error" role="alert">{error}</p>}
    {state.step !== undefined && <section className="sc-confirmation__progress" aria-label="Rental booking progress"><ol>{steps.map(([label, Icon], index) => <li key={label} className={index <= state.step ? 'is-reached' : ''} aria-current={index === state.step ? 'step' : undefined}><span className="sc-confirmation__step-icon">{index < state.step ? <Check size={17} /> : <Icon size={18} />}</span><span>{label}</span><span className="sr-only">{index < state.step ? ' — completed' : index === state.step ? ' — current step' : ' — upcoming'}</span></li>)}</ol><p><Clock3 size={15} />{state.message}</p></section>}
    <div className="sc-confirmation__grid">
      <div className="sc-confirmation__main">
        <section className="sc-confirmation__panel"><header><div><ShoppingBag size={19} /><h2>Your rental at a glance</h2></div><span>{itemCount} {itemCount === 1 ? 'item' : 'items'}</span></header><div className="sc-confirmation__items">{quote.items.map(item => <OrderItem key={item.listingId} item={{ ...item, name: item.title }}><p className="rental-confirmation__item-rent"><strong>{rentalMoney(item.rentPaise)}</strong><span>{days}</span></p><p className="rental-confirmation__item-deposit">Refundable deposit {rentalMoney(item.depositPaise)}{item.feesPaise > 0 && ` · Services ${rentalMoney(item.feesPaise)}`}</p></OrderItem>)}</div><div className="sc-confirmation__item-footer"><p>Changes, requests and booking updates</p><button type="button" className="sc-confirmation__link" onClick={viewBooking}>Manage booking<ArrowRight size={14} /></button></div></section>
        <section className="sc-confirmation__panel"><header><div><CalendarDays size={19} /><h2>Dates & collection</h2></div><span className="sc-confirmation__tag">{rentalCopy(quote.deliveryMode)}</span></header><div className="rental-confirmation__schedule"><dl><div><dt>Pickup / delivery</dt><dd>{rentalDate(b.schedule.pickupAt, tz)}</dd></div>{b.schedule.useDates?.length > 0 && <div><dt>Use days</dt><dd>{b.schedule.useDates.map(rentalUseDayLabel).join(', ')}<small>{days}</small></dd></div>}<div><dt>Return by</dt><dd>{rentalDate(b.schedule.returnDueAt, tz)}</dd></div></dl><p>Times in {tz}</p>{b.overdue && <p className="sc-confirmation__error" role="alert">Your return is overdue. Contact the store to arrange return.</p>}</div><address className="rental-confirmation__collection"><Store size={18} /><div><strong>{pickup ? `Pick up at ${seller.storeName || contact?.storeName || 'the store'}` : 'Delivery address'}</strong>{collection.map((line, index) => <p key={index}>{line}</p>)}{!collection.length && <p>{pickup ? 'Collect and return at the store.' : 'Your collection arrangement is saved with this booking.'}</p>}</div></address></section>
        <section className="sc-confirmation__panel"><header><div><UserRound size={19} /><h2>Booking contact</h2></div></header><address className="sc-confirmation__address"><strong>{customerName(b.customer?.name) || 'Customer'}</strong>{b.customer?.phone && <p>{b.customer.phone}</p>}{customerEmail(b.customer?.email) && <p>{customerEmail(b.customer.email)}</p>}</address></section>
      </div>
      <aside className="sc-confirmation__aside">
        <section className="sc-confirmation__panel sc-confirmation__payment rental-confirmation__payment" ref={paymentRef} tabIndex={-1}><header><div><CreditCard size={19} /><h2>Payment summary</h2></div></header><div className="sc-confirmation__total"><span>Rent + deposit</span><strong>{rentalMoney(total)}</strong></div><div className={'sc-confirmation__payment-status' + (paid && !terminal ? ' is-paid' : '')}><span>{paid && !terminal ? <Check size={16} /> : <Clock3 size={16} />}{paymentLabel}</span><p>{held ? `Pay before ${rentalDate(b.expiresAt, tz)} to confirm.` : quote.paymentPlan === 'PICKUP' && !terminal && !paid ? 'Pay at pickup before handover.' : terminal ? 'Your latest settlement is recorded below.' : 'Includes the refundable deposit.'}</p></div><div className="sc-confirmation__prices"><dl>{paymentRows.map(([label, amount]) => <div key={label}><dt>{label}</dt><dd>{rentalMoney(amount)}</dd></div>)}</dl></div><p className="sc-confirmation__muted">Deposit is settled after return inspection.</p>
          {canPay && <div className="rental-confirmation__pay">{methodsLoading && <p role="status">Loading payment options…</p>}{methodError && <div><p className="sc-confirmation__error" role="alert">{methodError}</p><button type="button" className="sc-confirmation__link" disabled={busy || methodsLoading} onClick={loadMethods}>Retry payment options</button></div>}{methods.length > 0 && <label>Online payment method<select value={method} onChange={event => setMethod(event.target.value)}>{methods.map(row => <option key={row.key} value={row.key}>{row.label}</option>)}</select></label>}{method && <button type="button" className="sc-confirmation__button" disabled={busy} onClick={pay}>{busy ? 'Opening payment…' : 'Pay ' + rentalMoney(due)}</button>}</div>}
        </section>
        <section className="sc-confirmation__panel sc-confirmation__invoice"><header><div><FileText size={19} /><h2>Your {documentLabel} & receipts</h2></div><span className="sc-confirmation__tag">PDF</span></header><p className="sc-confirmation__muted">Keep your booking, dates and payment records together.</p><button type="button" className="sc-confirmation__button sc-confirmation__button--outline" disabled={downloading} onClick={download}><Download size={16} />{downloading ? 'Preparing PDF…' : `Download ${documentLabel}`}</button><button type="button" className="sc-confirmation__link" onClick={() => { if (receipt) setInvoiceOpen(true); else setDocumentError('Your rental invoice is not available yet. Refresh the booking and try again.'); }}>View, print or share</button>{documentError && <p className="sc-confirmation__error" role="alert">{documentError}</p>}</section>
        <section className="sc-confirmation__help"><Headphones size={22} /><div><h2>Need help with your rental?</h2><p>Contact the store with your booking number.</p><button type="button" className="sc-confirmation__link" onClick={() => navigate('/contact')}>Contact store<ArrowRight size={14} /></button></div></section>
      </aside>
    </div>
    {invoiceOpen && <OrderModal title={receipt?.rentalDetails.documentTitle || 'Rental documents'} className="sc-order-modal--invoice" onClose={() => setInvoiceOpen(false)}><RentalDocuments booking={b} /></OrderModal>}
  </div>;
}
