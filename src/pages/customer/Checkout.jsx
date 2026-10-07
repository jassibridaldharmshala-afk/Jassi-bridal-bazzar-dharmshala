import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  Banknote,
  CreditCard,
  ChevronDown,
  Headphones,
  Landmark,
  LockKeyhole,
  MapPin,
  Minus,
  Pencil,
  Plus,
  RefreshCcw,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Truck,
  Trash2,
  Wallet,
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { openRazorpayCheckout } from '../../utils/razorpayCheckout';
import { useBrandIdentity } from '../../context/BrandIdentityContext';
import { SETTINGS_CHANGED_EVENT, SETTINGS_STORAGE_KEY } from '../../config/storeSettings';
import { trackEvent } from '../../utils/analytics';
import { readTrafficAttribution, getTrafficContext } from '../../utils/trafficTracker';
import { clearPendingPayment, pendingPaymentKey, readPendingPayment, savePendingPayment } from '../../utils/pendingPayment';
import { AddressForm } from './AddressManagement';
import { getPrimaryImageUrl, normalizeImageUrl } from '../../services/normalize';
import useDesktopFeedback from '../../hooks/useDesktopFeedback';
import { couponApplyBody } from '../../utils/couponApply';
import { shouldExitEmptyCheckout } from '../../utils/checkoutGuard';
import { bagKey, checkoutCart } from '../../utils/bag';
import { checkoutPayloadSignature, clearCheckoutAttempt, getCheckoutAttempt } from '../../utils/checkoutAttempt';
import CouponSelector from '../../components/coupon/CouponSelector';
import './Checkout.css';
import './CheckoutMobile.css';
import '../../styles/MobileShoppingTheme.css';

const PAYMENT_METHOD_NOTES = {
  UPI: 'Razorpay checkout — Google Pay, PhonePe, Paytm and other UPI apps',
  CARD: 'Secure card payment through Razorpay checkout',
  NETBANKING: 'Bank selection through Razorpay checkout',
  WALLET: 'Paytm Wallet and other wallets via Razorpay',
  COD: 'Pay when the product is delivered — no online payment',
};

function describePaymentOption(option) {
  if (option.disabledReason) return option.disabledReason;
  if (option.key === 'COD' && option.charge > 0) {
    return `${PAYMENT_METHOD_NOTES.COD} (Rs. ${option.charge} handling fee)`;
  }
  return PAYMENT_METHOD_NOTES[option.key] || '';
}

function getPlaceOrderLabel(paymentMethod, placing) {
  if (placing) return paymentMethod === 'COD' ? 'Placing order...' : 'Opening payment...';
  return paymentMethod === 'COD' ? 'Place COD Order' : 'Pay Now';
}

function OnlinePaymentNote({ paymentMethod }) {
  if (paymentMethod === 'UPI') {
    return (
      <p className="body-text mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
        Click <strong>Pay Now</strong>, then choose a supported UPI app securely in Razorpay.
      </p>
    );
  }

  if (paymentMethod !== 'COD') {
    return (
      <p className="body-text mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
        Click <strong>Pay Now</strong> to open the secure Razorpay payment window.
      </p>
    );
  }

  return <p className="body-text mt-4 rounded-2xl bg-[#fbf8f4] p-4 text-slate-600">Please keep exact amount ready at delivery.</p>;
}

const emptyAddress = {
  fullName: '',
  mobile: '',
  pincode: '',
  state: '',
  city: '',
  houseNo: '',
  area: '',
  landmark: '',
  addressType: 'Home',
  isDefault: false,
};

export default function Checkout({ navigate }) {
  const brand = useBrandIdentity();
  const fullCart = useCart();
  const currentCart = useRef(fullCart);
  currentCart.current = fullCart;
  const checkoutParams = new URLSearchParams(window.location.search);
  const buyNowItemId = checkoutParams.get('buyNow');
  const requestedBuyNowQuantity = Number(checkoutParams.get('quantity') || 1);
  const buyNowQuantity = Number.isInteger(requestedBuyNowQuantity) ? Math.max(1, Math.min(20, requestedBuyNowQuantity)) : 1;
  const checkoutSource = buyNowItemId
    ? { ...fullCart, items: fullCart.items.filter(item => String(item._id || item.id || item.cartItemId || '') === buyNowItemId).map(item => ({ ...item, selected: true, quantity: Math.min(Number(item.quantity || 1), buyNowQuantity) })) }
    : fullCart;
  const cart = checkoutCart(checkoutSource);
  const { setToast, user } = useAuth();
  const receiptStorageKey = pendingPaymentKey(user);
  const { isDesktop, notify } = useDesktopFeedback();
  const [addresses, setAddresses] = useState([]);
  const [addressLoading, setAddressLoading] = useState(true);
  const [addressError, setAddressError] = useState('');
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState('');
  const [addressForm, setAddressForm] = useState({ ...emptyAddress, fullName: user?.name || '', mobile: user?.phone || '' });
  const [couponCode, setCouponCode] = useState('');
  const [coupons, setCoupons] = useState([]);
  const [bestCouponCode, setBestCouponCode] = useState('');
  const [couponBusyCode, setCouponBusyCode] = useState('');
  const [couponFeedback, setCouponFeedback] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentOptions, setPaymentOptions] = useState([]);
  const [paymentLoading, setPaymentLoading] = useState(true);
  const [paymentError, setPaymentError] = useState('');
  const [paymentAttempt, setPaymentAttempt] = useState(0);
  const [quoteAttempt, setQuoteAttempt] = useState(0);
  useEffect(() => {
    const refresh = () => { setPaymentAttempt(value => value + 1); setQuoteAttempt(value => value + 1); };
    const storage = event => { if (event.key === SETTINGS_STORAGE_KEY) refresh(); };
    window.addEventListener(SETTINGS_CHANGED_EVENT, refresh); window.addEventListener('storage', storage);
    return () => { window.removeEventListener(SETTINGS_CHANGED_EVENT, refresh); window.removeEventListener('storage', storage); };
  }, []);
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState('');
  const [error, setError] = useState('');
  const [placing, setPlacing] = useState(false);
  const [pendingCodVerification, setPendingCodVerification] = useState(null);
  const [codOtp, setCodOtp] = useState('');
  const [codVerificationMessage, setCodVerificationMessage] = useState('');
  const [codVerificationBusy, setCodVerificationBusy] = useState(false);
  const [pendingReceipt, setPendingReceipt] = useState(() => readPendingPayment(receiptStorageKey));
  const [savingAddress, setSavingAddress] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 1023px)').matches);
  const [mobileStep, setMobileStep] = useState(2);
  const [showMobileAddressSelector, setShowMobileAddressSelector] = useState(false);
  const checkoutCompletedRef = useRef(false);
  const orderLock = useRef(false);
  const addressRequest = useRef(0);
  const emptyRedirectStartedRef = useRef(false);
  const cartHydrated = cart.hydrated;
  const cartItemCount = cart.items.length;
  const setCartCoupon = cart.setCoupon;

  useEffect(() => {
    setPendingReceipt(readPendingPayment(receiptStorageKey));
    const sync = event => { if (event.key === receiptStorageKey || event.key === null) setPendingReceipt(readPendingPayment(receiptStorageKey)); };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [receiptStorageKey]);

  useEffect(() => {
    const track = () => trackEvent('BEGIN_CHECKOUT');
    track();
    window.addEventListener('store:traffic-privacy', track);
    return () => window.removeEventListener('store:traffic-privacy', track);
  }, []);
  const showFeedback = (text, type = 'error') => {
    if (!text) return;
    setError(text);
    notify(text, type, 'Checkout');
  };

  const adoptAddresses = useCallback((nextAddresses, preferredAddressId) => {
    if (!Array.isArray(nextAddresses)) throw new Error('Unable to load delivery addresses. Please try again.');
    setAddresses(nextAddresses);
    setSelectedAddressId(current => {
      if (preferredAddressId && nextAddresses.some(item => item._id === preferredAddressId)) return preferredAddressId;
      if (current && nextAddresses.some(item => item._id === current)) return current;
      return (nextAddresses.find(item => item.isDefault) || nextAddresses[0])?._id || '';
    });
    setAddressError('');
  }, []);

  const loadAddresses = useCallback(async (preferredAddressId) => {
    const request = ++addressRequest.current;
    setAddressLoading(true);
    setAddressError('');
    try {
      const items = await api.get('/user/addresses', { cacheFirst: true, cacheScope: String(user?._id || user?.id || user?.phone || '') });
      if (request !== addressRequest.current) return;
      adoptAddresses(items, preferredAddressId);
    } catch (err) {
      if (request === addressRequest.current) setAddressError(err.message || 'Unable to load delivery addresses. Please try again.');
    } finally {
      if (request === addressRequest.current) setAddressLoading(false);
    }
  }, [adoptAddresses, user?._id, user?.id, user?.phone]);

  useEffect(() => { loadAddresses(new URLSearchParams(window.location.search).get('addressId')); return () => { addressRequest.current += 1; }; }, [loadAddresses]);

  // Which payment methods exist is decided by the store settings, not the UI.
  useEffect(() => {
    let alive = true;
    setPaymentLoading(true);
    setPaymentError('');
    api.get('/settings/payment-methods', { cacheFirst: true, forceRefetch: paymentAttempt > 0 })
      .then((data) => {
        if (!alive) return;
        const methods = Array.isArray(data?.methods) ? data.methods : [];
        setPaymentOptions(methods);
        if (!methods.some(option => option.enabled)) setPaymentError('No payment methods are currently available. Please retry or contact the store.');
        setPaymentMethod((current) => {
          if (current && methods.some((option) => option.key === current && option.enabled)) return current;
          return methods.find((option) => option.enabled)?.key || '';
        });
      })
      .catch((err) => {
        if (!alive) return;
        setPaymentOptions([]);
        setPaymentMethod('');
        setPaymentError(err.message || 'Unable to load payment options. Please try again.');
      })
      .finally(() => { if (alive) setPaymentLoading(false); });
    return () => { alive = false; };
  }, [paymentAttempt]);

  const selectedAddress = addresses.find((item) => item._id === selectedAddressId);
  const cartSignature = cart.items
    .map((item) => `${item.product._id || item.product.id}:${item.quantity}:${item.size || ''}:${item.color || ''}:${item.variantId || ''}`)
    .join('|');

  useEffect(() => {
    if (!cart.items.length || !paymentMethod) {
      setCoupons([]);
      setBestCouponCode('');
      return undefined;
    }
    let alive = true;
    api.post('/coupons/available', couponApplyBody({ cart, paymentMethod, shippingAddress: selectedAddress, deliveryCharge: quote?.shipping?.deliveryCharge }))
      .then((data) => {
        if (!alive) return;
        setCoupons(Array.isArray(data?.items) ? data.items : []);
        setBestCouponCode(data?.bestCouponCode || '');
      })
      .catch(() => {
        if (alive) {
          setCoupons([]);
          setBestCouponCode('');
        }
      });
    return () => { alive = false; };
  }, [cartSignature, paymentMethod, user?._id, selectedAddress?.pincode, quote?.shipping?.deliveryCharge]); // eslint-disable-line react-hooks/exhaustive-deps

  // Totals always come from the backend so delivery, COD fee and coupon
  // discount match exactly what the order will be created with.
  useEffect(() => {
    if (!cart.items.length || !paymentMethod) {
      setQuote(null);
      setQuoteError('');
      return undefined;
    }

    let alive = true;
    setQuoteError('');
    setQuote(null);
    api.post('/orders/quote', {
      orderItems: buildOrderItems(cart.items),
      coupon: cart.coupon,
      paymentMethod,
      shippingAddress: selectedAddress,
    })
      .then((data) => {
        if (!alive) return;
        const valid = typeof data?.totals?.finalAmount === 'number' && Number.isFinite(data.totals.finalAmount) && data.totals.finalAmount >= 0;
        setQuote(valid ? { ...data.totals, shipping: data.shipping } : null);
        if (Array.isArray(data?.paymentOptions)) {
          setPaymentOptions(data.paymentOptions);
          setPaymentMethod(current => data.paymentOptions.some(option => option.key === current && option.enabled)
            ? current
            : data.paymentOptions.find(option => option.enabled)?.key || '');
          setPaymentError(data.paymentOptions.some(option => option.enabled) ? '' : 'No payment methods are available for this order and delivery address.');
        }
        setQuoteError(valid ? '' : 'Unable to calculate order totals. Please retry.');
      })
      .catch((err) => {
        if (!alive) return;
        setQuote(null);
        if (cart.coupon?.code && ['INVALID_COUPON', 'COUPON_EXPIRED', 'VALIDATION_ERROR'].includes(err.code)) {
          const removedCode = cart.coupon.code;
          cart.setCoupon(null);
          setCouponCode('');
          setCouponFeedback(`${removedCode} was removed because it is no longer eligible: ${err.message}`);
        }
        setQuoteError(err.message || 'Unable to calculate order totals. Please refresh and try again.');
      });

    return () => { alive = false; };
  }, [cartSignature, paymentMethod, cart.coupon?.code, selectedAddressId, selectedAddress?.pincode, quoteAttempt]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)');
    const onChange = (event) => setIsMobile(event.matches);
    media.addEventListener('change', onChange);
    setIsMobile(media.matches);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setMobileStep(2);
      setShowMobileAddressSelector(false);
      setShowAddressForm(false);
      setEditingAddressId('');
    }
  }, [isMobile]);

  useEffect(() => {
    if (cart.error || cart.loading || pendingReceipt) return;
    if (!shouldExitEmptyCheckout({
      hydrated: cartHydrated,
      itemCount: cartItemCount,
      orderCompleted: checkoutCompletedRef.current,
    }) || emptyRedirectStartedRef.current) return;

    emptyRedirectStartedRef.current = true;
    setCartCoupon(null);
    setToast('Your bag is empty. Add an item before checkout.');
    navigate('/cart');
  }, [cartHydrated, cartItemCount, cart.error, cart.loading, pendingReceipt, navigate, setCartCoupon, setToast]);

  const deliveryWindow = useMemo(() => getDeliveryWindow(), []);
  const placeOrderLabel = getPlaceOrderLabel(paymentMethod, placing);
  const quoteReady = Boolean(quote) && !paymentLoading && !paymentError && !addressLoading && !addressError && !cart.error && !cart.loading && !cart.pendingCount;

  // Backend quote wins; the cart figures are only a placeholder while it loads.
  const summary = useMemo(() => ({
    items: cart.items,
    totalMRP: quote?.totalMRP ?? cart.totalMRP,
    discount: quote?.productDiscount ?? cart.discount,
    couponDiscount: quote?.couponDiscount ?? cart.couponDiscount,
    prepaidDiscount: quote?.prepaidDiscount ?? 0,
    deliveryCharge: quote?.deliveryCharge ?? cart.deliveryCharge,
    codCharge: quote?.codCharge ?? 0,
    platformFee: quote?.platformFee ?? 0,
    taxAmount: quote?.taxAmount ?? 0,
    taxRate: quote?.taxRate ?? 0,
    finalAmount: quote?.finalAmount ?? cart.finalAmount,
  }), [cart.couponDiscount, cart.deliveryCharge, cart.discount, cart.finalAmount, cart.items, cart.totalMRP, quote]);

  const resetAddressEditor = () => {
    setShowAddressForm(false);
    setEditingAddressId('');
    setAddressForm({ ...emptyAddress, fullName: user?.name || '', mobile: user?.phone || '' });
  };

  const saveAddress = async (event) => {
    event.preventDefault();
    if (savingAddress) return;
    setError('');
    setSavingAddress(true);
    try {
      const savedAddress = editingAddressId
        ? await api.put(`/user/addresses/${editingAddressId}`, addressForm)
        : await api.post('/user/addresses', addressForm);
      if (Array.isArray(savedAddress)) {
        const savedId = editingAddressId || savedAddress.find(item => !addresses.some(existing => existing._id === item._id))?._id;
        addressRequest.current += 1;
        adoptAddresses(savedAddress, savedId);
        setAddressLoading(false);
      } else {
        await loadAddresses(savedAddress?._id || editingAddressId);
      }
      resetAddressEditor();
    } catch (err) {
      showFeedback(err.message, 'error');
    } finally {
      setSavingAddress(false);
    }
  };

  const applyCoupon = async (code = couponCode) => {
    const nextCode = String(code || '').trim().toUpperCase();
    setError('');
    setCouponFeedback('');
    if (!nextCode) {
      showFeedback('Select a coupon or enter a code.', 'warning');
      return false;
    }
    setCouponBusyCode(nextCode);
    try {
      const data = await api.post('/coupons/apply', couponApplyBody({ code: nextCode, cart, paymentMethod, shippingAddress: selectedAddress, deliveryCharge: quote?.shipping?.deliveryCharge }));
      cart.setCoupon({ code: data.couponCode, discount: data.discountAmount, benefitType: data.coupon?.benefitType || 'DISCOUNT', savingAmount: Number(data.coupon?.effectiveSaving ?? (Number(data.discountAmount || 0) + Number(data.coupon?.estimatedDeliverySaving || 0))) });
      setCouponCode(data.couponCode || nextCode);
      setCouponFeedback(data.message || `${data.couponCode || nextCode} applied successfully.`);
      trackEvent('COUPON_APPLIED');
      setToast(data.message);
      return true;
    } catch (err) {
      setCouponFeedback(err.message);
      showFeedback(err.message, 'error');
      return false;
    } finally {
      setCouponBusyCode('');
    }
  };

  const removeCoupon = () => {
    const removedCode = cart.coupon?.code;
    cart.setCoupon(null);
    setCouponCode('');
    setCouponFeedback(removedCode ? `${removedCode} removed.` : 'Coupon removed.');
  };

  const orderPayload = () => {
    const payload = {
      expectedTotal: quote?.finalAmount,
      orderItems: buildOrderItems(cart.items),
      cartItems: cart.items.map(item => ({
        cartItemId: item._id || item.id || item.cartItemId,
        product: item.product._id || item.product.id,
        size: item.size || '', color: item.color || '', variantId: item.variantId || '', quantity: item.quantity,
      })),
      shippingAddress: selectedAddress,
      paymentMethod,
      coupon: cart.coupon ? { code: cart.coupon.code } : undefined,
      attribution: readTrafficAttribution(),
      traffic: getTrafficContext(),
    };
    payload.checkoutAttemptId = getCheckoutAttempt(user, checkoutPayloadSignature(payload));
    return payload;
  };

  const verifyReceipt = async ({ response, purchased, checkoutAttemptId }) => {
    const result = await api.post('/payments/verify', {
      razorpay_order_id: response.razorpay_order_id,
      razorpay_payment_id: response.razorpay_payment_id,
      razorpay_signature: response.razorpay_signature,
    });
    if (!result?.order?._id) throw new Error('Order confirmation is not available yet.');
    checkoutCompletedRef.current = true;
    const unchanged = purchased.filter(item => {
      const current = currentCart.current.items.find(line => bagKey(line) === bagKey(item));
      return !current || current.quantity === item.quantity;
    });
    const cleanup = await (buyNowItemId
      ? currentCart.current.refresh()
      : currentCart.current.completeCheckout(unchanged)).catch(() => ({ ok: false }));
    clearPendingPayment(receiptStorageKey, response);
    clearCheckoutAttempt(user, checkoutAttemptId);
    setToast(unchanged.length !== purchased.length ? 'Payment successful. Your bag changed during payment; please review the remaining quantities.' : cleanup.ok ? 'Payment successful' : 'Payment successful. Refresh your bag to check remaining items.');
    navigate(`/order-success?id=${result.order._id}`);
  };

  const retryConfirmation = async () => {
    if (orderLock.current || checkoutCompletedRef.current) return;
    orderLock.current = true; setPlacing(true); setError('');
    try { await verifyReceipt(pendingReceipt); }
    catch { setError('We still could not confirm the order. Please check My orders or contact the store before paying again.'); }
    finally { orderLock.current = false; setPlacing(false); }
  };

  const completeCodCheckout = async (orderId, checkoutAttemptId) => {
    checkoutCompletedRef.current = true;
    clearCheckoutAttempt(user, checkoutAttemptId);
    const cleanup = await (buyNowItemId ? fullCart.refresh() : fullCart.completeCheckout(cart.items)).catch(() => ({ ok: false }));
    setToast(cleanup.ok ? 'COD order confirmed successfully' : 'Order confirmed. Refresh your bag to check remaining items.');
    navigate(`/order-success?id=${orderId}`);
  };

  const verifyCodOrder = async () => {
    if (!pendingCodVerification || codVerificationBusy) return;
    if (!/^\d{6}$/.test(codOtp)) { setCodVerificationMessage('Enter the 6-digit code sent to your mobile number.'); return; }
    setCodVerificationBusy(true); setCodVerificationMessage('');
    try {
      const order = await api.post(`/orders/${pendingCodVerification.orderId}/cod-verification/verify`, { otp: codOtp });
      await completeCodCheckout(order._id, pendingCodVerification.checkoutAttemptId);
    } catch (err) { setCodVerificationMessage(err.message || 'The code could not be verified. Please try again.'); }
    finally { setCodVerificationBusy(false); }
  };

  const resendCodOtp = async () => {
    if (!pendingCodVerification || codVerificationBusy) return;
    setCodVerificationBusy(true); setCodVerificationMessage('');
    try {
      const delivery = await api.post(`/orders/${pendingCodVerification.orderId}/cod-verification/send`, {});
      setPendingCodVerification(value => ({ ...value, delivery }));
      setCodVerificationMessage(delivery.demoOtp ? `Demo code: ${delivery.demoOtp}` : 'A new verification code has been sent.');
    } catch (err) { setCodVerificationMessage(err.message || 'Please wait before requesting another code.'); }
    finally { setCodVerificationBusy(false); }
  };

  const placeOrder = async () => {
    if (orderLock.current || checkoutCompletedRef.current) return;
    const storedReceipt = readPendingPayment(receiptStorageKey);
    if (storedReceipt) { setPendingReceipt(storedReceipt); return; }
    setError('');
    if (!user) return navigate('/login');
    if (!user.isPhoneVerified) return showFeedback('Please verify your mobile number to continue checkout.', 'warning');
    if (!cart.items.length) return showFeedback('Your cart is empty.', 'warning');
    if (!selectedAddress) return showFeedback('Please select or add a delivery address.', 'warning');
    if (addressLoading || addressError) return showFeedback('Please reload your delivery addresses before placing an order.', 'warning');
    if (!paymentMethod) return showFeedback('Please choose a payment method.', 'warning');
    if (!quoteReady) return showFeedback(quoteError || 'Please wait while we calculate your order total.', 'warning');
    setPlacing(true);
    orderLock.current = true;

    let pendingPayment = null;
    let checkoutAttemptId = '';

    try {
      const payload = orderPayload();
      checkoutAttemptId = payload.checkoutAttemptId;
      if (paymentMethod === 'COD') {
        const order = await api.post('/orders/cod', payload);
        if (order.codVerification?.required && order.codVerification.status === 'PENDING') {
          setPendingCodVerification({ orderId: order._id, checkoutAttemptId: payload.checkoutAttemptId, delivery: order.codVerificationDelivery });
          setCodVerificationMessage(order.codVerificationDelivery?.message || (order.codVerificationDelivery?.demoOtp ? `Demo code: ${order.codVerificationDelivery.demoOtp}` : 'Enter the code sent to your registered mobile number.'));
          setCodOtp('');
          return;
        }
        await completeCodCheckout(order._id, payload.checkoutAttemptId);
        return;
      }

      pendingPayment = await api.post('/payments/create-order', payload);
      if (pendingPayment?.alreadyCompleted && pendingPayment?.orderId) {
        checkoutCompletedRef.current = true;
        clearCheckoutAttempt(user, payload.checkoutAttemptId);
        await fullCart.refresh().catch(() => null);
        navigate(`/order-success?id=${pendingPayment.orderId}`);
        return;
      }
      const razorpayOrderId = pendingPayment.razorpayOrderId || pendingPayment.order_id;
      const razorpayKey = pendingPayment.keyId || process.env.REACT_APP_RAZORPAY_KEY_ID;

        if (!razorpayOrderId || !razorpayKey) {
          throw new Error('Online payment is not configured. Please use Cash on Delivery.');
        }

      await openRazorpayCheckout({
        storeName: brand.websiteName,
        description: brand.websiteName + ' order',
        key: razorpayKey,
        amount: pendingPayment.amount,
        currency: pendingPayment.currency,
        orderId: razorpayOrderId,
        name: selectedAddress?.fullName || user?.name,
        email: user?.email,
        contact: selectedAddress?.mobile || user?.phone,
        preferredMethod: paymentMethod,
        onSuccess: async (response) => {
          const receipt = { response, purchased: cart.items, checkoutAttemptId: payload.checkoutAttemptId };
          savePendingPayment(receiptStorageKey, receipt);
          setPendingReceipt(receipt);
          try { await verifyReceipt(receipt); }
          catch (err) {
            setPendingReceipt(receipt);
            throw Object.assign(new Error('Payment confirmation is pending.'), { code: 'PAYMENT_CONFIRMATION_PENDING' });
          }
        },
        onDismiss: () => {
          setError('Payment cancelled. You can retry or choose Cash on Delivery.');
        },
      });
    } catch (err) {
      if (err.code === 'PAYMENT_CONFIRMATION_PENDING') return;
      if (String(err.code || '').startsWith('SHIPPING_')) {
        retryQuote();
        showFeedback(err.message, 'error');
        return;
      }
      if (paymentMethod !== 'COD') {
        const reason = err.message === 'Payment cancelled'
          ? 'Payment cancelled by customer'
          : err.message;

        const providerOrderId = pendingPayment?.razorpayOrderId || pendingPayment?.order_id;
        const setupOutcomeUnknown = !providerOrderId && (
          ['FETCH_ERROR', 'TIMEOUT_ERROR'].includes(String(err.status || ''))
          || (err.code === 'DUPLICATE_REQUEST' && /being prepared/i.test(String(err.details || err.message || '')))
        );
        if (providerOrderId) {
          try {
            await api.post('/payments/failure', { reason, razorpayOrderId: providerOrderId });
            clearCheckoutAttempt(user, checkoutAttemptId);
          } catch {
            // Keep the attempt so retry can recover a possibly-created order.
          }
        } else if (!setupOutcomeUnknown) {
          clearCheckoutAttempt(user, checkoutAttemptId);
        }

        if (setupOutcomeUnknown) {
          showFeedback('Payment setup response was interrupted. Retry here with the same checkout; you will not be charged twice.', 'error');
          return;
        }

        if (err.message !== 'Payment cancelled') {
          navigate('/payment-failed');
          return;
        }
      }
        showFeedback(err.message === 'Payment cancelled'
          ? 'Payment cancelled. You can retry or choose Cash on Delivery.'
          : err.message === 'Razorpay is not configured. Use COD or add payment keys in .env.'
            ? 'Online payment is not configured. Please use Cash on Delivery.'
            : err.message, 'error');
    } finally {
      orderLock.current = false;
      setPlacing(false);
    }
  };

  const openNewAddressForm = () => {
    setError('');
    setEditingAddressId('');
    setAddressForm({ ...emptyAddress, fullName: user?.name || '', mobile: user?.phone || '' });
    setShowAddressForm(true);
  };

  const openEditAddressForm = (address) => {
    setError('');
    setEditingAddressId(address._id);
    setAddressForm({
      ...emptyAddress,
      ...address,
      mobile: address.mobile || address.phone || '',
      houseNo: address.houseNo || address.houseNumber || '',
    });
    setShowAddressForm(true);
  };

  const removeAddress = async (addressId) => {
    setError('');
    try {
      await api.delete(`/user/addresses/${addressId}`);
      if (selectedAddressId === addressId) setSelectedAddressId('');
      if (editingAddressId === addressId) resetAddressEditor();
      await loadAddresses();
    } catch (err) {
      showFeedback(err.message, 'error');
    }
  };

  const continueToPayment = () => {
    setError('');
    if (!selectedAddress) {
      showFeedback('Please select or add a delivery address.', 'warning');
      return;
    }
    setShowMobileAddressSelector(false);
    setShowAddressForm(false);
    setEditingAddressId('');
    setMobileStep(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const confirmSelectedAddress = () => {
    setError('');
    if (!selectedAddress) {
      showFeedback('Please select a delivery address.', 'warning');
      return;
    }
    setShowMobileAddressSelector(false);
    setShowAddressForm(false);
    setEditingAddressId('');
  };

  const addressStatus = addressLoading || addressError ? <CheckoutLoadState label="delivery addresses" loading={addressLoading} error={addressError} onRetry={() => loadAddresses(selectedAddressId)} /> : null;
  const paymentStatus = paymentLoading || paymentError ? <CheckoutLoadState label="payment options" loading={paymentLoading} error={paymentError} onRetry={() => setPaymentAttempt(value => value + 1)} /> : null;
  const retryQuote = () => setQuoteAttempt(value => value + 1);

  if (pendingCodVerification) return <CodVerificationStep verification={pendingCodVerification} otp={codOtp} setOtp={setCodOtp} message={codVerificationMessage} busy={codVerificationBusy} onVerify={verifyCodOrder} onResend={resendCodOtp} onOrders={() => navigate('/orders')} />;
  if (pendingReceipt) return <section className="sc-checkout-status sc-checkout-pending">
    <ShieldCheck size={32} aria-hidden="true" /><h1>Payment confirmation pending</h1>
    <p>The payment provider responded, but we could not confirm your order with the store. Retry confirmation or check My orders before making another payment.</p>
    <div><button type="button" onClick={retryConfirmation} disabled={placing}>{placing ? 'Confirming...' : 'Retry confirmation'}</button><button type="button" onClick={() => navigate('/orders')} disabled={placing}>My orders</button><button type="button" onClick={() => navigate('/contact')} disabled={placing}>Contact support</button></div>
    {error && <p role="alert">{error}</p>}
  </section>;
  if (!cartHydrated || cart.error) return <section className="sc-checkout-status"><CheckoutLoadState label="your bag" loading={!cart.error} error={cart.error} onRetry={cart.refresh} /></section>;
  if (!cartItemCount) return null;

  if (isMobile) {
    return (
      <section className="sc-mobile-checkout">
        {addressStatus ? <><MobileStepHeader title="Delivery address" onBack={() => navigate('/cart')} /><div className="sc-mobile-checkout__content">{addressStatus}</div></> : mobileStep === 2 ? (
          showMobileAddressSelector ? (
            <MobileAddressSelector
              addresses={addresses}
              selectedAddressId={selectedAddressId}
              setSelectedAddressId={setSelectedAddressId}
              showAddressForm={showAddressForm}
              addressForm={addressForm}
              setAddressForm={setAddressForm}
              saveAddress={saveAddress}
              openNewAddressForm={openNewAddressForm}
              openEditAddressForm={openEditAddressForm}
              removeAddress={removeAddress}
              onBack={() => {
                resetAddressEditor();
                setShowMobileAddressSelector(false);
              }}
              onConfirm={confirmSelectedAddress}
              onCancelForm={resetAddressEditor}
              error={error}
              editing={Boolean(editingAddressId)}
              savingAddress={savingAddress}
            />
          ) : (
            <MobileAddressSummary
              navigate={navigate}
              selectedAddress={selectedAddress}
              cartItems={cart.items}
              deliveryWindow={deliveryWindow}
              onChange={() => {
                setError('');
                setShowMobileAddressSelector(true);
              }}
              onContinue={continueToPayment}
              error={error}
            />
          )
        ) : (
          <MobilePaymentStep
            selectedAddress={selectedAddress}
            cart={cart}
            summary={summary}
            paymentOptions={paymentOptions}
            paymentStatus={paymentStatus}
            coupons={coupons}
            bestCouponCode={bestCouponCode}
            applyCoupon={applyCoupon}
            removeCoupon={removeCoupon}
            couponBusyCode={couponBusyCode}
            couponFeedback={couponFeedback}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            placeOrder={placeOrder}
            placing={placing}
            placeOrderLabel={placeOrderLabel}
            error={error}
            quoteError={quoteError}
            quoteReady={quoteReady}
            shipping={quote?.shipping}
            retryQuote={retryQuote}
            onBack={() => setMobileStep(2)}
          />
        )}
      </section>
    );
  }

  return (
    <DesktopCheckout
      navigate={navigate}
      user={user}
      cart={cart}
      summary={summary}
      paymentOptions={paymentOptions}
      addressStatus={addressStatus}
      paymentStatus={paymentStatus}
      addresses={addresses}
      selectedAddressId={selectedAddressId}
      setSelectedAddressId={setSelectedAddressId}
      showAddressForm={showAddressForm}
      setShowAddressForm={setShowAddressForm}
      addressForm={addressForm}
      setAddressForm={setAddressForm}
      saveAddress={saveAddress}
      savingAddress={savingAddress}
      editing={Boolean(editingAddressId)}
      openNewAddressForm={openNewAddressForm}
      openEditAddressForm={openEditAddressForm}
      removeAddress={removeAddress}
      resetAddressEditor={resetAddressEditor}
      coupons={coupons}
      bestCouponCode={bestCouponCode}
      applyCoupon={applyCoupon}
      removeCoupon={removeCoupon}
      couponBusyCode={couponBusyCode}
      couponFeedback={couponFeedback}
      paymentMethod={paymentMethod}
      setPaymentMethod={setPaymentMethod}
      placeOrder={placeOrder}
      placing={placing}
      placeOrderLabel={placeOrderLabel}
      error={isDesktop ? error : ''}
      quoteError={isDesktop ? quoteError : ''}
      quoteReady={quoteReady}
      shipping={quote?.shipping}
      retryQuote={retryQuote}
    />
  );
}

function CodVerificationStep({ verification, otp, setOtp, message, busy, onVerify, onResend, onOrders }) {
  const deliveryFailed = verification.delivery?.deliveryStatus === 'FAILED';
  return <main className="sc-cod-verification" aria-labelledby="cod-verification-title">
    <section className="sc-cod-verification__card">
      <span className="sc-cod-verification__icon"><ShieldCheck size={30} aria-hidden="true" /></span>
      <p className="sc-cod-verification__eyebrow">Secure cash on delivery</p>
      <h1 id="cod-verification-title">Confirm your COD order</h1>
      <p>Enter the one-time code sent to your registered mobile number. This quick check helps us prepare your parcel safely.</p>
      <label htmlFor="cod-order-otp">6-digit verification code</label>
      <input id="cod-order-otp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} value={otp} onChange={event => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" autoFocus />
      {message && <p className={deliveryFailed ? 'is-error' : 'sc-cod-verification__message'} role="status">{message}</p>}
      <button className="sc-cod-verification__primary" type="button" disabled={busy || otp.length !== 6} onClick={onVerify}>{busy ? 'Checking…' : 'Verify and confirm order'}</button>
      <div className="sc-cod-verification__actions"><button type="button" disabled={busy} onClick={onResend}>Resend code</button><button type="button" disabled={busy} onClick={onOrders}>View my orders</button></div>
      <small>Payment will still be collected only when your order is delivered.</small>
    </section>
  </main>;
}

function DesktopCheckout({
  navigate,
  user,
  cart,
  summary,
  paymentOptions,
  addressStatus,
  paymentStatus,
  addresses,
  selectedAddressId,
  setSelectedAddressId,
  showAddressForm,
  setShowAddressForm,
  addressForm,
  setAddressForm,
  saveAddress,
  savingAddress,
  editing,
  openNewAddressForm,
  openEditAddressForm,
  removeAddress,
  resetAddressEditor,
  coupons,
  bestCouponCode,
  applyCoupon,
  removeCoupon,
  couponBusyCode,
  couponFeedback,
  paymentMethod,
  setPaymentMethod,
  placeOrder,
  placing,
  placeOrderLabel,
  error,
  quoteError,
  quoteReady,
  shipping,
  retryQuote,
}) {
  const needsLogin = !user;
  const needsVerification = Boolean(user && !user.isPhoneVerified);
  const unavailableOnlineOptions = paymentOptions.filter((option) => option.key !== 'COD' && !option.enabled);

  return (
    <section className="sc-checkout">
      <div className="sc-checkout__shell">
        <div className="sc-checkout__top">
          <h1>Checkout</h1>
          <CheckoutSteps />
          <button type="button" className="sc-checkout__support" onClick={() => navigate('/contact')}>
            <Headphones size={15} aria-hidden="true" />
            Need help? Contact Support
          </button>
        </div>

        {needsLogin || needsVerification ? (
          <div className="sc-checkout__notice">
            <ShieldCheck size={18} aria-hidden="true" />
            <span>{needsLogin ? 'Please login to continue checkout.' : 'Please verify your mobile number to continue checkout.'}</span>
            <button type="button" onClick={() => navigate('/login')}>{needsLogin ? 'Login' : 'Verify Mobile'}</button>
          </div>
        ) : null}

        <div className="sc-checkout__layout">
          <main className="sc-checkout__main">
            <section className="sc-checkout__card">
              <SectionTitle number="1" icon={MapPin} title="Delivery Address">
                <button type="button" className="sc-checkout__outline-btn" onClick={openNewAddressForm}>
                  <Plus size={14} aria-hidden="true" />
                  Add New Address
                </button>
              </SectionTitle>

              {addressStatus || (showAddressForm || !addresses.length ? (
                <div className="sc-checkout__address-form">
                  <AddressForm
                    form={addressForm}
                    setForm={setAddressForm}
                    onSubmit={saveAddress}
                    message={error}
                    editing={editing}
                    onCancel={() => {
                      resetAddressEditor();
                      if (addresses.length) setShowAddressForm(false);
                    }}
                    saving={savingAddress}
                  />
                </div>
              ) : (
                <div className="sc-checkout__address-grid">
                  {addresses.map((address) => (
                    <DesktopAddressCard
                      key={address._id}
                      address={address}
                      selected={selectedAddressId === address._id}
                      onSelect={() => setSelectedAddressId(address._id)}
                      onEdit={() => openEditAddressForm(address)}
                      onRemove={() => removeAddress(address._id)}
                    />
                  ))}
                </div>
              ))}
            </section>

            <section className="sc-checkout__card">
              <SectionTitle number="2" icon={ShoppingBag} title="Order Summary" />
              {cart.items.length ? (
                <div className="sc-checkout__items">
                  {cart.items.map((item) => (
                    <DesktopOrderItem
                      key={item.cartKey || `${item.product._id || item.product.id}-${item.size}-${item.color}`}
                      item={item}
                      onIncrease={() => cart.increaseQuantity(item.cartKey || item.product, { cartKey: item.cartKey })}
                      onDecrease={() => cart.decreaseQuantity(item.cartKey || item.product, { cartKey: item.cartKey })}
                      onRemove={() => cart.removeFromCart(item.cartKey || item.product, { cartKey: item.cartKey })}
                    />
                  ))}
                </div>
              ) : (
                <div className="sc-checkout__empty">
                  <p>Your bag is empty.</p>
                  <button type="button" onClick={() => navigate('/products')}>Continue Shopping</button>
                </div>
              )}
            </section>

            <section className="sc-checkout__card sc-checkout__coupon">
              <SectionTitle number="3" icon={Tag} title="Coupon / Offers" />
              <CouponSelector
                coupons={coupons}
                bestCouponCode={bestCouponCode}
                appliedCoupon={cart.coupon}
                busyCode={couponBusyCode}
                feedback={couponFeedback}
                onApply={applyCoupon}
                onRemove={removeCoupon}
              />
            </section>

            <section className="sc-checkout__card">
              <SectionTitle number="4" icon={CreditCard} title="Payment Method" />
              <div className="sc-checkout__payment">
                {paymentStatus || (paymentOptions.length ? (
                  <div className="sc-checkout__payment-tabs">
                    {paymentOptions.map((option) => {
                      const Icon = paymentIconFor(option.key);
                      return (
                        <button
                          key={option.key}
                          type="button"
                          disabled={!option.enabled}
                          title={option.disabledReason || undefined}
                          className={`${paymentMethod === option.key ? 'is-active' : ''}${!option.enabled ? ' is-disabled' : ''}`}
                          onClick={() => option.enabled && setPaymentMethod(option.key)}
                          aria-pressed={paymentMethod === option.key}
                        >
                          <Icon size={14} aria-hidden="true" />
                          <span>{option.label}</span>
                          {!option.enabled ? <small>Unavailable</small> : null}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="sc-checkout__payment-copy">Loading payment options...</p>
                ))}
                <div className="sc-checkout__payment-panel">
                  <p className="sc-checkout__payment-copy">{paymentCopyFor(paymentMethod)}</p>
                  {paymentMethod === 'UPI' ? (
                    <p className="sc-checkout__payment-copy">Google Pay, PhonePe, Paytm and other supported UPI apps are shown securely inside Razorpay.</p>
                  ) : null}
                  {unavailableOnlineOptions.length ? (
                    <p className="sc-checkout__payment-unavailable">
                      {unavailableOnlineOptions.map((option) => option.label).join(', ')}: {unavailableOnlineOptions[0].disabledReason || 'currently unavailable'}.
                    </p>
                  ) : null}
                  {paymentMethod === 'COD' && summary.codCharge > 0 ? (
                    <p className="sc-checkout__payment-copy">A Rs. {summary.codCharge} Cash on Delivery handling fee is added to this order.</p>
                  ) : null}
                  <p className="sc-checkout__secure-note">
                    <ShieldCheck size={14} aria-hidden="true" />
                    {paymentMethod === 'COD' ? 'Please keep exact amount ready at delivery.' : 'You will be redirected to a secure payment page to complete the transaction.'}
                  </p>
                </div>
              </div>
            </section>
          </main>

          <aside className="sc-checkout__side">
            <ShippingAvailability shipping={shipping} />
            <DesktopPriceSummary summary={summary} cta={placeOrderLabel} placing={placing} quoteReady={quoteReady} onAction={placeOrder} />
            <DesktopAssurance />
          </aside>
        </div>

        {error ? <p className="sc-checkout__error">{error}</p> : null}
        {quoteError ? <CheckoutLoadState label="order total" error={quoteError} onRetry={retryQuote} /> : null}
      </div>
    </section>
  );
}

function ShippingAvailability({ shipping }) {
  if (!shipping?.serviceable || shipping.provider === 'manual') return null;
  const provider = ({ bluedart: 'Blue Dart', shiprocket: 'Shiprocket', delhivery: 'Delhivery', xpressbees: 'Xpressbees' })[shipping.provider] || 'Courier';
  return <div role="status" className="my-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-900"><strong>{provider} delivery available</strong><p>PIN {shipping.destinationPincode} · Delivery {Number(shipping.deliveryCharge) === 0 ? 'FREE' : `₹${Number(shipping.deliveryCharge).toLocaleString('en-IN')}`}{shipping.serviceName && ` · ${shipping.serviceName}`}</p></div>;
}

function CheckoutSteps() {
  return (
    <div className="sc-checkout__steps" aria-label="Checkout steps">
      {[
        ['1', 'Bag', true],
        ['2', 'Address', true],
        ['3', 'Payment', false],
      ].map(([number, label, active]) => (
        <div key={label} className={active ? 'is-active' : ''}>
          <span>{number}</span>
          <strong>{label}</strong>
        </div>
      ))}
    </div>
  );
}

function SectionTitle({ number, icon: Icon, title, children }) {
  return (
    <div className="sc-checkout__section-head">
      <h2>
        <Icon size={16} aria-hidden="true" />
        {number}. {title}
      </h2>
      {children}
    </div>
  );
}

function DesktopAddressCard({ address, selected, onSelect, onEdit, onRemove }) {
  const lines = buildAddressLines(address);
  return (
    <article className={`sc-checkout__address${selected ? ' is-selected' : ''}`}>
      <button type="button" className="sc-checkout__radio" onClick={onSelect} aria-label={`Deliver to ${address.fullName}`}>
        <span />
      </button>
      <div className="sc-checkout__address-copy">
        <div className="sc-checkout__address-name">
          <strong>{address.fullName || 'Samaira Customer'}</strong>
          <span>{address.addressType || 'Home'}{address.isDefault ? ' (Default)' : ''}</span>
        </div>
        <p>{address.mobile || address.phone || '-'}</p>
        {lines.map((line) => <p key={line}>{line}</p>)}
        <div className="sc-checkout__address-actions">
          <button type="button" onClick={onEdit}><Pencil size={13} aria-hidden="true" /> Edit Address</button>
          <button type="button" onClick={onSelect}>Deliver Here</button>
          <button type="button" onClick={onRemove} className="sc-checkout__remove-address">Remove</button>
        </div>
      </div>
    </article>
  );
}

function DesktopOrderItem({ item, onIncrease, onDecrease, onRemove }) {
  const image = getPrimaryImageUrl(item.product.images);
  return (
    <article className="sc-checkout__item">
      <div className="sc-checkout__item-image">
        {image ? <img src={normalizeImageUrl(image)} alt={item.product.name} /> : <ShoppingBag size={22} aria-hidden="true" />}
      </div>
      <div>
        <h3>{item.product.name}</h3>
        <p>Size: {item.size || '-'} <span>•</span> Qty: {item.quantity}</p>
        <strong>₹{formatAmount(Number(item.price ?? item.product.price ?? 0) * Number(item.quantity || 1))}</strong>
        <div className="sc-checkout__item-actions">
          <div className="sc-checkout__qty-control" aria-label={`Quantity for ${item.product.name}`}>
            <button type="button" onClick={onDecrease} aria-label="Decrease quantity">
              <Minus size={12} aria-hidden="true" />
            </button>
            <span>{item.quantity}</span>
            <button type="button" onClick={onIncrease} aria-label="Increase quantity">
              <Plus size={12} aria-hidden="true" />
            </button>
          </div>
          <button type="button" className="sc-checkout__remove-item" onClick={onRemove} aria-label={`Remove ${item.product.name}`}>
            <Trash2 size={13} aria-hidden="true" />
            Remove
          </button>
        </div>
      </div>
    </article>
  );
}

function DesktopPriceSummary({ summary, cta, placing, quoteReady, onAction }) {
  return (
    <section className="sc-checkout__summary">
      <h2><ShoppingBag size={17} aria-hidden="true" /> Price Summary</h2>
      <SummaryRow label="Total MRP" value={`₹${formatAmount(summary.totalMRP)}`} />
      <SummaryRow label="Discount on MRP" value={`- ₹${formatAmount(summary.discount)}`} success />
      <SummaryRow label="Coupon Discount" value={`- ₹${formatAmount(summary.couponDiscount)}`} success />
      {summary.prepaidDiscount > 0 && <SummaryRow label="Prepaid Discount" value={`- ₹${formatAmount(summary.prepaidDiscount)}`} success />}
      <SummaryRow label="Delivery Charges" value={summary.deliveryCharge ? `₹${formatAmount(summary.deliveryCharge)}` : 'FREE'} success={!summary.deliveryCharge} />
      {summary.platformFee > 0 ? <SummaryRow label="Platform Fee" value={`₹${formatAmount(summary.platformFee)}`} /> : null}
      {summary.taxAmount > 0 ? <SummaryRow label={`GST (${summary.taxRate || 5}% incl.)`} value={`₹${formatAmount(summary.taxAmount)}`} /> : null}
      {summary.codCharge > 0 ? <SummaryRow label="Cash on Delivery Fee" value={`₹${formatAmount(summary.codCharge)}`} /> : null}
      <div className="sc-checkout__grand">
        <span>
          <strong>Grand Total</strong>
          <small>Inclusive of all taxes</small>
        </span>
        <b>₹{formatAmount(summary.finalAmount)}</b>
      </div>
      <button type="button" onClick={onAction} disabled={placing || !quoteReady || !summary.items.length}>
        <LockKeyhole size={15} aria-hidden="true" />
        {cta}
      </button>
      <p><ShieldCheck size={14} aria-hidden="true" /> Safe and secure payments. Easy returns.</p>
    </section>
  );
}

function SummaryRow({ label, value, success }) {
  return (
    <div className="sc-checkout__summary-row">
      <span>{label}</span>
      <strong className={success ? 'is-success' : ''}>{value}</strong>
    </div>
  );
}

function DesktopAssurance() {
  const items = [
    [ShieldCheck, '100% Secure Checkout', 'Your payments are safe with us'],
    [RefreshCcw, 'Easy Returns', 'Hassle-free returns within 7 days'],
    [Truck, 'Free Shipping Above ₹999', 'Enjoy free delivery on orders above ₹999'],
  ];
  return (
    <section className="sc-checkout__assurance">
      {items.map(([Icon, title, text]) => (
        <div key={title}>
          <span><Icon size={20} aria-hidden="true" /></span>
          <strong>{title}</strong>
          <p>{text}</p>
        </div>
      ))}
    </section>
  );
}

function paymentIconFor(key) {
  if (key === 'UPI') return BadgeCheck;
  if (key === 'CARD') return CreditCard;
  if (key === 'NETBANKING') return Landmark;
  if (key === 'WALLET') return Wallet;
  if (key === 'COD') return Banknote;
  return CreditCard;
}

function paymentCopyFor(key) {
  if (key === 'CARD') return 'Your card details will be entered securely in the Razorpay payment window.';
  if (key === 'NETBANKING') return 'Select your bank securely after continuing to payment.';
  if (key === 'WALLET') return 'Pay with supported wallets through secure Razorpay checkout.';
  if (key === 'COD') return 'Pay when your order is delivered to your selected address.';
  return 'Continue to complete your payment securely.';
}

function formatAmount(value) {
  return Number(value || 0).toLocaleString('en-IN');
}

function MobileAddressSummary({ navigate, selectedAddress, cartItems, deliveryWindow, onChange, onContinue, error }) {
  return <>
    <MobileStepHeader title="Delivery address" stepLabel="Step 2/3" onBack={() => navigate('/cart')} />
    <MobileCheckoutSteps step={2} onBag={() => navigate('/cart')} />
    <div className="sc-mobile-checkout__content">
      <section className="sc-mobile-checkout__card">
        <h2>Deliver to</h2>
        {selectedAddress ? <SelectedAddressCard address={selectedAddress} onChange={onChange} /> :
          <><p className="sc-mobile-checkout__muted">Add or choose an address for your order.</p><button type="button" className="sc-mobile-checkout__outline" onClick={onChange}><Plus size={17} />Select address</button></>}
      </section>
      <section className="sc-mobile-checkout__card">
        <h2>Delivery estimates <span>{cartItems.length} item{cartItems.length === 1 ? '' : 's'}</span></h2>
        {cartItems.map(item => <DeliveryEstimateRow key={item.cartKey || (item.product._id || item.product.id) + item.size + item.color} item={item} deliveryWindow={deliveryWindow} />)}
      </section>
      {error && <p role="alert" className="sc-mobile-checkout__error">{error}</p>}
    </div>
    <MobileBottomAction label={selectedAddress ? 'Continue to payment' : 'Select delivery address'} onClick={selectedAddress ? onContinue : onChange} />
  </>;
}

function MobileAddressSelector({ addresses, selectedAddressId, setSelectedAddressId, showAddressForm, addressForm, setAddressForm, saveAddress, openNewAddressForm, openEditAddressForm, removeAddress, onBack, onConfirm, onCancelForm, error, editing, savingAddress }) {
  if (showAddressForm) return <div className="sc-mobile-checkout__form">
    <AddressForm form={addressForm} setForm={setAddressForm} onSubmit={saveAddress} message={error} editing={editing} onCancel={onCancelForm} saving={savingAddress} />
  </div>;
  return <>
    <MobileStepHeader title="Select address" onBack={onBack} />
    <div className="sc-mobile-checkout__content">
      <button type="button" className="sc-mobile-checkout__outline sc-mobile-checkout__add" onClick={openNewAddressForm}><Plus size={18} />Add new address</button>
      <h2 className="sc-mobile-checkout__section-title">Saved addresses <span>{addresses.length}</span></h2>
      {addresses.length ? addresses.map(address => <SelectableAddressCard key={address._id} address={address} selected={selectedAddressId === address._id} onSelect={() => setSelectedAddressId(address._id)} onEdit={() => openEditAddressForm(address)} onRemove={() => removeAddress(address._id)} />) :
        <p className="sc-mobile-checkout__card sc-mobile-checkout__muted">No saved addresses yet. Add an address to continue.</p>}
      {error && <p role="alert" className="sc-mobile-checkout__error">{error}</p>}
    </div>
    <MobileBottomAction label="Deliver to this address" onClick={onConfirm} disabled={!selectedAddressId} />
  </>;
}

function MobilePaymentStep({ selectedAddress, cart, summary, paymentOptions, paymentStatus, coupons, bestCouponCode, applyCoupon, removeCoupon, couponBusyCode, couponFeedback, paymentMethod, setPaymentMethod, placeOrder, placing, placeOrderLabel, error, quoteError, quoteReady, shipping, retryQuote, onBack }) {
  return <>
    <MobileStepHeader title="Payment" stepLabel="Step 3/3" onBack={onBack} />
    <MobileCheckoutSteps step={3} onAddress={onBack} />
    <div className="sc-mobile-checkout__content">
      <section className="sc-mobile-checkout__card sc-mobile-checkout__delivery-brief">
        <h2><MapPin size={16} aria-hidden="true" />Deliver to</h2>
        {selectedAddress && <SelectedAddressCard address={selectedAddress} onChange={onBack} />}
      </section>
      <details className="sc-mobile-checkout__card sc-mobile-checkout__order-review">
        <summary><ShoppingBag size={18} aria-hidden="true" /><span>Review your order <small>{cart.itemCount} item{cart.itemCount === 1 ? '' : 's'}</small></span><ChevronDown size={18} className="sc-mobile-checkout__review-chevron" aria-hidden="true" /></summary>
        {cart.items.map(item => <div key={item.cartKey || (item.product._id || item.product.id) + item.size + item.color} className="sc-mobile-checkout__product">
          <CheckoutProductImage item={item} />
          <div><p>{item.product.name}</p><small>{[item.size, item.color, 'Qty: ' + item.quantity].filter(Boolean).join(' \u00b7 ')}</small></div>
          <strong>{mobileMoney(Number(item.price ?? item.product.price) * item.quantity)}</strong>
        </div>)}
      </details>
      <fieldset className="sc-mobile-checkout__coupon" disabled={placing} aria-label="Order coupons">
        <CouponSelector coupons={coupons} bestCouponCode={bestCouponCode} appliedCoupon={cart.coupon} busyCode={couponBusyCode} feedback={couponFeedback} onApply={applyCoupon} onRemove={removeCoupon} />
      </fieldset>
      <section className="sc-mobile-checkout__card">
        <h2>Choose payment method</h2>
        <div className="sc-mobile-checkout__methods">
          {paymentStatus || (paymentOptions.length ? paymentOptions.map(option => {
            const Icon = paymentIconFor(option.key);
            return <button key={option.key} type="button" disabled={!option.enabled || placing} aria-pressed={paymentMethod === option.key} onClick={() => option.enabled && setPaymentMethod(option.key)} className="sc-mobile-checkout__method">
              <Icon size={21} aria-hidden="true" />
              <span><strong>{option.label}</strong><small>{describePaymentOption(option)}</small></span>
              <span className="sc-mobile-checkout__radio" aria-hidden="true" />
            </button>;
          }) : <p className="sc-mobile-checkout__muted" role="status">Loading payment options...</p>)}
        </div>
        {paymentMethod && <OnlinePaymentNote paymentMethod={paymentMethod} />}
      </section>
      <section className="sc-mobile-checkout__card sc-mobile-checkout__prices" aria-label="Price details" aria-busy={!quoteReady}>
        <h2>Price details</h2>
        <MobilePriceRow label="Total MRP" amount={summary.totalMRP} />
        <MobilePriceRow label="Discount on MRP" amount={summary.discount} discount />
        <MobilePriceRow label="Coupon discount" amount={summary.couponDiscount} discount />
        {summary.prepaidDiscount > 0 && <MobilePriceRow label="Prepaid discount" amount={summary.prepaidDiscount} discount />}
        <MobilePriceRow label="Delivery charge" amount={summary.deliveryCharge} free />
        {summary.platformFee > 0 && <MobilePriceRow label="Platform fee" amount={summary.platformFee} />}
        {summary.codCharge > 0 && <MobilePriceRow label="Cash on delivery fee" amount={summary.codCharge} />}
        <div className="sc-mobile-checkout__total"><strong>Total amount</strong><strong>{quoteReady ? mobileMoney(summary.finalAmount) : 'Updating...'}</strong></div>
        <p className="sc-mobile-checkout__muted">{summary.taxAmount > 0 ? 'Includes ' + mobileMoney(summary.taxAmount) + ' GST (' + (summary.taxRate || 5) + '%).' : 'Inclusive of applicable taxes.'}</p>
      </section>
      {error && <p role="alert" className="sc-mobile-checkout__error">{error}</p>}
      {quoteError && <CheckoutLoadState label="order total" error={quoteError} onRetry={retryQuote} />}
      <ShippingAvailability shipping={shipping} />
    </div>
    <div className="sc-mobile-checkout__bottom"><div className="sc-mobile-checkout__bottom-inner">
      <div><small>Total amount</small><strong>{quoteReady ? mobileMoney(summary.finalAmount) : 'Updating...'}</strong></div>
      <button type="button" onClick={placeOrder} disabled={placing || !quoteReady || !paymentMethod || !selectedAddress} className="sc-mobile-checkout__primary"><LockKeyhole size={16} />{placeOrderLabel}</button>
    </div></div>
  </>;
}

function MobilePriceRow({ label, amount, discount, free }) {
  return <div className="sc-mobile-checkout__price-row"><span>{label}</span><span className={discount || (free && !amount) ? 'is-saving' : ''}>{free && !amount ? 'FREE' : (discount && amount ? '- ' : '') + mobileMoney(amount)}</span></div>;
}

function CheckoutLoadState({ label, loading = false, error, onRetry }) {
  return <div className="sc-checkout-load-state" role={error ? 'alert' : 'status'} aria-busy={loading}>
    <p>{loading ? `Loading ${label}...` : error}</p>
    {!loading && onRetry && <button type="button" onClick={onRetry}><RefreshCcw size={15} />Retry {label}</button>}
  </div>;
}
const mobileMoney = value => '\u20b9' + Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

function MobileStepHeader({ title, stepLabel, onBack }) {
  return <header className="sc-mobile-checkout__header"><div>
    <button type="button" onClick={onBack} aria-label="Back"><ArrowLeft size={22} strokeWidth={1.7} /></button>
    <h1>{title}</h1>{stepLabel && <span>{stepLabel}</span>}
  </div></header>;
}

function MobileCheckoutSteps({ step, onBag, onAddress }) {
  return <nav className="sc-mobile-checkout__steps" aria-label="Checkout progress">
    <button type="button" disabled={!onBag} onClick={onBag}><b>1</b>Bag</button><i />
    <button type="button" disabled={!onAddress} onClick={onAddress} aria-current={step === 2 ? 'step' : undefined}><b>2</b>Address</button><i />
    <span aria-current={step === 3 ? 'step' : undefined}><b>3</b>Payment</span>
  </nav>;
}

function AddressCopy({ address }) {
  return <div className="sc-mobile-checkout__address-copy">
    <div className="sc-mobile-checkout__address-name"><strong>{address.fullName}</strong><span>{address.addressType || 'Home'}</span>{address.isDefault && <small>Default</small>}</div>
    <address>{buildAddressLines(address).map(line => <p key={line}>{line}</p>)}</address>
    <p className="sc-mobile-checkout__phone">Mobile: <strong>{address.mobile || address.phone}</strong></p>
  </div>;
}

function SelectedAddressCard({ address, onChange }) {
  return <div className="sc-mobile-checkout__address"><AddressCopy address={address} /><button type="button" className="sc-mobile-checkout__text" onClick={onChange}>Change</button></div>;
}

function SelectableAddressCard({ address, selected, onSelect, onEdit, onRemove }) {
  return <article className={'sc-mobile-checkout__card sc-mobile-checkout__saved' + (selected ? ' is-selected' : '')}>
    <div className="sc-mobile-checkout__address">
      <button type="button" className="sc-mobile-checkout__select" onClick={onSelect} aria-pressed={selected} aria-label={'Select ' + address.fullName + ' address'}><span className="sc-mobile-checkout__radio" aria-hidden="true" /></button>
      <AddressCopy address={address} />
    </div>
    <div className="sc-mobile-checkout__address-actions"><button type="button" onClick={onEdit}>Edit</button><button type="button" onClick={onRemove}>Remove</button></div>
  </article>;
}

function CheckoutProductImage({ item }) {
  const image = getPrimaryImageUrl(item.product.images);
  return <div className="sc-mobile-checkout__image">{image ? <img src={normalizeImageUrl(image)} alt={item.product.name} /> : <ShoppingBag size={22} aria-hidden="true" />}</div>;
}

function DeliveryEstimateRow({ item, deliveryWindow }) {
  return <div className="sc-mobile-checkout__product"><CheckoutProductImage item={item} /><div><p>{item.product.name}</p><small>{[item.size, item.color, 'Qty: ' + item.quantity].filter(Boolean).join(' \u00b7 ')}</small><p className="sc-mobile-checkout__estimate"><Truck size={14} />Estimated delivery: {deliveryWindow}</p></div></div>;
}

function MobileBottomAction({ label, onClick, disabled = false }) {
  return <div className="sc-mobile-checkout__bottom"><div className="sc-mobile-checkout__bottom-inner"><button type="button" onClick={onClick} disabled={disabled} className="sc-mobile-checkout__primary sc-mobile-checkout__full">{label}</button></div></div>;
}

/**
 * Only identifiers and chosen options are sent. Prices come from the
 * database on the server, never from this payload.
 */
function buildOrderItems(items) {
  return items.map((item) => ({
    product: item.product._id || item.product.id,
    size: item.size || '',
    color: item.color || '',
    variantId: item.variantId || '',
    quantity: item.quantity,
  }));
}

function buildAddressLines(address) {
  const lines = [];
  if (address.houseNo || address.houseNumber) lines.push(address.houseNo || address.houseNumber);
  if (address.area) lines.push(address.area);
  const cityStateLine = [address.city, address.state, address.pincode].filter(Boolean).join(', ').replace(/, ([^,]+)$/, ' $1');
  if (cityStateLine) lines.push(cityStateLine);
  return lines;
}

function getDeliveryWindow() {
  const start = new Date();
  start.setDate(start.getDate() + 5);
  const end = new Date();
  end.setDate(end.getDate() + 7);
  const startLabel = start.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  const endLabel = end.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  return `${startLabel} - ${endLabel}`;
}
