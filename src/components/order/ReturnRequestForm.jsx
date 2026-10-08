import { useEffect, useMemo, useState } from 'react';
import { Camera, CheckCircle2, MapPin, ShieldCheck } from 'lucide-react';
import api from '../../services/api';
import { productIdOf } from '../../utils/orderActions';
import { money, orderDate } from '../../utils/orderPresentation';
import { OrderItem } from './OrderUi';

const REASONS = ['Size or fit issue', 'Damaged or defective item', 'Wrong item received', 'Different from description', 'Quality not as expected', 'Other'];
const needsEvidence = reason => /damaged|defective|wrong item|different from description/i.test(reason);

export default function ReturnRequestForm({ item, eligibility, paymentMethod = 'COD', pickupAddress = {}, onSubmit, busy, error, onCancel }) {
  const initialType = eligibility.canReturn ? 'return' : 'exchange';
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ type: initialType, quantity: 1, reason: '', comment: '', exchangeVariantId: '', exchangeSize: '', exchangeColor: '', refundMethod: paymentMethod === 'COD' ? 'UPI' : 'ORIGINAL_PAYMENT', refundDestination: { vpa: '', accountHolder: '', accountNumber: '', ifsc: '' }, pickupAddress: normalizeAddress(pickupAddress) });
  const [files, setFiles] = useState([]);
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const [localBusy, setLocalBusy] = useState(false);
  const [localError, setLocalError] = useState('');
  const [productError, setProductError] = useState('');
  const [retry, setRetry] = useState(0);
  const update = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const updateAddress = (key, value) => setForm(current => ({ ...current, pickupAddress: { ...current.pickupAddress, [key]: value } }));
  const updateRefund = (key, value) => setForm(current => ({ ...current, refundDestination: { ...current.refundDestination, [key]: value } }));

  useEffect(() => {
    if (form.type !== 'exchange') return undefined;
    let active = true; setLoading(true); setProductError(''); setProduct(null);
    api.get(`/products/${productIdOf(item)}`, { silent: true, cacheFirst: true }).then(data => {
      if (active) { setProduct(data); setForm(current => ({ ...current, exchangeVariantId: '', exchangeSize: !data.sizes?.length || data.sizes.includes(item.size) ? item.size || '' : '', exchangeColor: !data.colors?.length || data.colors.includes(item.color) ? item.color || '' : '' })); }
    }).catch(err => { if (active) setProductError(err.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [form.type, item, retry]);

  const variants = (product?.variants || []).filter(variant => variant.isActive !== false);
  const exchangeAvailable = product && product.isActive !== false && !product.isArchived && (variants.length ? variants.some(variant => Number(variant.stock) >= form.quantity) : Number(product.stock) >= form.quantity);
  const sizes = product?.sizes?.length ? product.sizes : [item.size].filter(Boolean);
  const colors = product?.colors?.length ? product.colors : [item.color].filter(Boolean);
  const selectedVariant = variants.find(variant => String(variant._id) === form.exchangeVariantId);
  const selectionAvailable = !variants.length || (selectedVariant && Number(selectedVariant.stock) >= form.quantity);
  const replacementUnitPrice = Number(selectedVariant?.price ?? product?.price ?? item.price ?? 0);
  const exchangePriceDifference = Math.round((replacementUnitPrice - Number(item.price || 0)) * Number(form.quantity) * 100) / 100;
  const previews = useMemo(() => files.map(file => ({ file, url: URL.createObjectURL(file) })), [files]);
  useEffect(() => () => previews.forEach(preview => URL.revokeObjectURL(preview.url)), [previews]);
  const evidenceRequired = needsEvidence(form.reason);
  const maxQuantity = Math.max(1, Math.min(20, Number(eligibility.remainingQuantity || 1)));

  const validate = () => {
    if (!form.reason) return 'Choose a reason for this request.';
    if (evidenceRequired && !files.some(file => String(file.type || '').startsWith('image/'))) return 'Add at least one clear photo showing the issue.';
    if (form.type === 'exchange' && (!exchangeAvailable || !selectionAvailable || loading || productError)) return 'Choose an available replacement.';
    if (form.type === 'return' && form.refundMethod === 'UPI' && !/^[a-z0-9._-]{2,}@[a-z0-9.-]{2,}$/i.test(form.refundDestination.vpa.trim())) return 'Enter a valid UPI ID for the refund.';
    if (form.type === 'return' && form.refundMethod === 'BANK_TRANSFER' && (!/^\d{6,20}$/.test(form.refundDestination.accountNumber.replace(/\s/g, '')) || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.refundDestination.ifsc.trim().toUpperCase()) || form.refundDestination.accountHolder.trim().length < 2)) return 'Complete the bank refund details.';
    const address = form.pickupAddress;
    if (!address.fullName || !/^[6-9]\d{9}$/.test(String(address.mobile).replace(/\D/g, '')) || !/^\d{6}$/.test(String(address.pincode).replace(/\D/g, '')) || !address.houseNo || !address.area || !address.city || !address.state) return 'Complete the reverse pickup address.';
    return '';
  };

  const review = event => { event.preventDefault(); const message = validate(); setLocalError(message); if (!message) setStep(2); };
  const submit = async event => {
    event.preventDefault(); const message = validate(); setLocalError(message); if (message || localBusy || busy) return;
    setLocalBusy(true);
    try {
      let photos = []; let customerEvidence = [];
      if (files.length) { const uploaded = await api.upload('/returns/evidence/uploads', files, { fieldName: 'files' }); customerEvidence = (uploaded.files || []).map(file => ({ ...file, type: String(file.mimeType || '').startsWith('video/') ? 'CUSTOMER_VIDEO' : 'CUSTOMER_PHOTO' })); photos = customerEvidence.filter(file => file.type === 'CUSTOMER_PHOTO').map(file => file.fileUrl); }
      const variant = variants.find(entry => String(entry._id) === form.exchangeVariantId);
      await onSubmit({ ...form, photos, customerEvidence, ...(variant ? { exchangeSize: variant.size, exchangeColor: variant.color } : {}), quantity: Number(form.quantity), pickupAddress: { ...form.pickupAddress, mobile: String(form.pickupAddress.mobile).replace(/\D/g, ''), pincode: String(form.pickupAddress.pincode).replace(/\D/g, '') } });
    } catch (err) { setLocalError(err.message); }
    finally { setLocalBusy(false); }
  };

  return <form className="sc-order-form sc-return-form" onSubmit={step === 1 ? review : submit}>
    <div className="sc-return-steps"><span className="is-active">1 <small>Request</small></span><i /><span className={step === 2 ? 'is-active' : ''}>2 <small>Confirm</small></span></div>
    <OrderItem item={item} />
    {step === 1 ? <fieldset disabled={busy || localBusy}>
      <legend>Choose a resolution</legend>
      <div className="sc-order-form__choices"><label className={!eligibility.canReturn ? 'is-disabled' : ''}><input disabled={!eligibility.canReturn} type="radio" name="requestType" checked={form.type === 'return'} onChange={() => update('type', 'return')} />Return for refund</label><label className={!eligibility.canExchange ? 'is-disabled' : ''}><input disabled={!eligibility.canExchange} type="radio" name="requestType" checked={form.type === 'exchange'} onChange={() => update('type', 'exchange')} />Exchange item</label></div>
      <div className="sc-return-policy"><ShieldCheck size={18} /><div><strong>{eligibility.deadline ? `Request by ${orderDate(eligibility.deadline)}` : 'Eligible under this order’s policy'}</strong><p>{eligibility.returnPolicy || `${eligibility.windowDays} day return / exchange window`}</p></div></div>
      <div className="sc-return-grid"><label>Quantity<select value={form.quantity} onChange={event => update('quantity', Number(event.target.value))}>{Array.from({ length: maxQuantity }, (_, index) => <option key={index} value={index + 1}>{index + 1}</option>)}</select></label><label>Reason<select required value={form.reason} onChange={event => update('reason', event.target.value)}><option value="">Select a reason</option>{REASONS.map(reason => <option key={reason}>{reason}</option>)}</select></label></div>
      {form.type === 'exchange' && <div className="sc-order-form__exchange">{loading ? <p role="status">Checking exchange availability…</p> : productError ? <div role="alert"><p>{productError}</p><button type="button" className="sc-orders__text" onClick={() => setRetry(value => value + 1)}>Retry availability</button></div> : !exchangeAvailable ? <p role="status">A replacement is currently out of stock. Choose return instead.</p> : variants.length ? <label>Replacement size / colour<select required value={form.exchangeVariantId} onChange={event => update('exchangeVariantId', event.target.value)}><option value="">Select replacement</option>{variants.map(variant => <option key={variant._id} value={variant._id} disabled={Number(variant.stock) < form.quantity}>{[variant.size, variant.color].filter(Boolean).join(' / ') || 'Standard'}{Number(variant.stock) < form.quantity ? ' — out of stock' : ''}</option>)}</select></label> : <div className="sc-return-grid"><label>Replacement size<select required={sizes.length > 0} value={form.exchangeSize} onChange={event => update('exchangeSize', event.target.value)}><option value="">{sizes.length ? 'Select size' : 'Standard / free size'}</option>{sizes.map(size => <option key={size}>{size}</option>)}</select></label><label>Replacement colour<select required={colors.length > 0} value={form.exchangeColor} onChange={event => update('exchangeColor', event.target.value)}><option value="">{colors.length ? 'Select colour' : 'Same colour'}</option>{colors.map(color => <option key={color}>{color}</option>)}</select></label></div>}</div>}
      {form.type === 'return' && <div className="sc-return-refund"><h3>Where should we send the refund?</h3><label>Refund destination<select value={form.refundMethod} onChange={event => update('refundMethod', event.target.value)}>{paymentMethod !== 'COD' && <option value="ORIGINAL_PAYMENT">Original payment method</option>}<option value="UPI">UPI</option><option value="BANK_TRANSFER">Bank account</option><option value="MANUAL">Arrange with store support</option></select></label>{form.refundMethod === 'UPI' && <label>UPI ID<input value={form.refundDestination.vpa} onChange={event => updateRefund('vpa', event.target.value)} placeholder="name@bank" /></label>}{form.refundMethod === 'BANK_TRANSFER' && <div className="sc-return-grid"><label>Account holder<input value={form.refundDestination.accountHolder} onChange={event => updateRefund('accountHolder', event.target.value)} /></label><label>Account number<input inputMode="numeric" value={form.refundDestination.accountNumber} onChange={event => updateRefund('accountNumber', event.target.value)} /></label><label>IFSC code<input value={form.refundDestination.ifsc} onChange={event => updateRefund('ifsc', event.target.value.toUpperCase())} /></label></div>}<p>Estimated item refund: up to <strong>{money(Number(item.price || 0) * Number(form.quantity))}</strong>. Allocated discounts and any configured return charge are applied during review.</p></div>}
      {form.type === 'exchange' && product && exchangeAvailable && selectionAvailable && (!variants.length || selectedVariant) && <div className="sc-return-price-difference"><strong>{exchangePriceDifference > 0 ? `${money(exchangePriceDifference)} extra` : exchangePriceDifference < 0 ? `${money(Math.abs(exchangePriceDifference))} credit` : 'No price difference'}</strong><span>{exchangePriceDifference > 0 ? 'The store will collect this before allocating the replacement.' : exchangePriceDifference < 0 ? 'The store will confirm how this credit will be returned.' : 'The replacement has the same item price.'}</span></div>}
      <label>Additional details (optional)<textarea rows={3} maxLength={2000} value={form.comment} onChange={event => update('comment', event.target.value)} placeholder="Tell us what happened and what condition the item is in" /></label>
      <label className="sc-return-upload"><span><Camera size={18} />Photos or video {evidenceRequired ? '(photo required)' : '(optional)'}</span><input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" multiple onChange={event => { const next = Array.from(event.target.files || []).slice(0, 8); setFiles(next); event.target.value = ''; }} /><small>Up to 8 private files: photos 8 MB each, videos 50 MB each, 60 MB total. Original photo detail is preserved. Show the product, label, packaging and issue clearly.</small></label>
      {previews.length > 0 && <div className="sc-return-previews">{previews.map((preview, index) => <button type="button" key={`${preview.file.name}-${index}`} onClick={() => setFiles(current => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${preview.file.name}`}>{String(preview.file.type || '').startsWith('video/') ? <video src={preview.url} muted /> : <img src={preview.url} alt="" />}<span>×</span></button>)}</div>}
      <div className="sc-return-address"><h3><MapPin size={18} />Reverse pickup address</h3><div className="sc-return-grid">{[['fullName', 'Full name'], ['mobile', 'Mobile'], ['houseNo', 'House / building'], ['area', 'Area / street'], ['city', 'City'], ['state', 'State'], ['pincode', 'PIN code'], ['landmark', 'Landmark (optional)']].map(([key, label]) => <label key={key}>{label}<input value={form.pickupAddress[key] || ''} inputMode={['mobile', 'pincode'].includes(key) ? 'numeric' : undefined} onChange={event => updateAddress(key, event.target.value)} /></label>)}</div></div>
      <p className="sc-orders__muted">Keep the item unused with original tags and packaging. Approval, courier pickup, inspection and refund are tracked separately.</p>
    </fieldset> : <section className="sc-return-confirm"><CheckCircle2 size={34} /><h3>Review your request</h3><dl><div><dt>Resolution</dt><dd>{form.type === 'exchange' ? 'Exchange item' : 'Return for refund'}</dd></div><div><dt>Reason</dt><dd>{form.reason}</dd></div><div><dt>Quantity</dt><dd>{form.quantity}</dd></div>{form.type === 'return' ? <><div><dt>Refund destination</dt><dd>{form.refundMethod.replaceAll('_', ' ')}</dd></div><div><dt>Estimated item value</dt><dd>{money(Number(item.price || 0) * Number(form.quantity))}</dd></div></> : <><div><dt>Replacement</dt><dd>{[selectedVariant?.size || form.exchangeSize, selectedVariant?.color || form.exchangeColor].filter(Boolean).join(' / ') || 'Standard item'}</dd></div><div><dt>{exchangePriceDifference > 0 ? 'Amount payable' : exchangePriceDifference < 0 ? 'Credit due' : 'Price difference'}</dt><dd>{money(Math.abs(exchangePriceDifference))}</dd></div></>}<div><dt>Pickup</dt><dd>{[form.pickupAddress.houseNo, form.pickupAddress.area, form.pickupAddress.city, form.pickupAddress.pincode].filter(Boolean).join(', ')}</dd></div><div><dt>Evidence</dt><dd>{files.length ? `${files.length} photo(s)` : 'Not required'}</dd></div></dl><p>After submission, the store will review the request before any pickup or refund begins.</p></section>}
    {(localError || error) && <p className="sc-orders__error" role="alert">{localError || error}</p>}
    <div className="sc-order-form__actions">{step === 1 ? <button type="button" className="sc-orders__outline" onClick={onCancel} disabled={busy || localBusy}>Cancel</button> : <button type="button" className="sc-orders__outline" onClick={() => { setStep(1); setLocalError(''); }} disabled={busy || localBusy}>Back</button>}<button className="sc-orders__button" disabled={busy || localBusy || (form.type === 'exchange' && (!exchangeAvailable || !selectionAvailable || loading || !!productError))}>{localBusy ? 'Uploading…' : busy ? 'Submitting…' : step === 1 ? 'Review request' : 'Confirm request'}</button></div>
  </form>;
}

function normalizeAddress(address = {}) {
  return { fullName: address.fullName || '', mobile: address.mobile || address.phone || '', houseNo: address.houseNo || address.houseNumber || '', area: address.area || '', city: address.city || '', state: address.state || '', pincode: address.pincode || '', landmark: address.landmark || '', alternateMobile: address.alternateMobile || '', addressType: address.addressType || 'Home' };
}
