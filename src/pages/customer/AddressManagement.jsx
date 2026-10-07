import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, CardContent, CardTitle, Select, TextInput } from '../../components/ui';
import { ArrowLeft, ChevronRight, Plus, Home, BriefcaseBusiness, MapPinned, UserRound, Phone, Building2, Check, MapPin, Trash2 } from 'lucide-react';
import AccountSidebar from '../../components/layout/AccountSidebar';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { districtsForState, INDIAN_STATES } from '../../data/indiaLocations';
import { lookupPincode } from '../../utils/indiaPincode';
import { digitsOnly, isValidIndianMobile, PHONE_VALIDATION_MESSAGE } from '../../utils/phoneInput';
import './Profile.css';
import './AddressManagement.css';
import '../../styles/MobileShoppingTheme.css';

const emptyAddress = {
  fullName: '', mobile: '', alternateMobile: '', pincode: '', state: '', city: '',
  houseNo: '', area: '', landmark: '', addressType: 'Home', isDefault: false,
};
function savedAddresses(data) {
  if (!Array.isArray(data) || data.some(address => !address?._id)) throw new Error('Unable to read your saved addresses. Please try again.');
  return data;
}

export default function AddressManagement({ route = '/profile/addresses', navigate }) {
  const { user, logout } = useAuth();
  const routePath = route.split('?')[0];
  const editorId = new URLSearchParams(route.split('?')[1] || '').get('id') || '';
  const editing = routePath === '/profile/addresses/edit';
  const isEditor = editing || routePath === '/profile/addresses/new';
  const [addresses, setAddresses] = useState([]);
  const [form, setForm] = useState(emptyAddress);
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [removing, setRemoving] = useState(null);
  const [notice, setNotice] = useState('');
  const selected = addresses.find((address) => address._id === editorId);

  const load = useCallback(async (forceRefetch = false) => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await api.get('/user/addresses', { cacheFirst: true, cacheScope: String(user?._id || user?.id || user?.phone || ''), forceRefetch });
      setAddresses(savedAddresses(data));
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }, [user?._id, user?.id, user?.phone]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!isEditor) return;
    setMessage('');
    setForm(editing && selected ? {
      ...emptyAddress, ...selected,
      mobile: selected.mobile || selected.phone || '',
      houseNo: selected.houseNo || selected.houseNumber || '',
    } : { ...emptyAddress });
  }, [editing, isEditor, selected]);

  const goBack = () => navigate('/profile/addresses');
  const openNewAddress = () => { setMessage(''); navigate('/profile/addresses/new'); };
  const save = async (event) => {
    event.preventDefault();
    if (saving || (editing && !selected)) return;
    setMessage('');
    if (!isValidIndianMobile(form.mobile)) { setMessage(PHONE_VALIDATION_MESSAGE); return; }
    if (form.alternateMobile && !isValidIndianMobile(form.alternateMobile)) {
      setMessage('Enter a valid 10-digit alternate mobile number.'); return;
    }
    if (!/^[1-9]\d{5}$/.test(form.pincode)) { setMessage('Enter a valid 6-digit pincode.'); return; }
    if (['fullName', 'state', 'city', 'houseNo', 'area'].some((key) => !String(form[key] || '').trim())) {
      setMessage('Please complete all required address fields.'); return;
    }
    setSaving(true);
    try {
      const payload = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]));
      const updated = editing
        ? await api.put(`/user/addresses/${editorId}`, payload)
        : await api.post('/user/addresses', payload);
      setAddresses(savedAddresses(updated));
      setNotice(editing ? 'Address updated.' : 'New address saved.');
      goBack();
    } catch (error) { setMessage(error.message); }
    finally { setSaving(false); }
  };

  const makeDefault = async (address) => {
    if (busyId) return;
    setBusyId(address._id); setMessage(''); setNotice('');
    try {
      setAddresses(savedAddresses(await api.patch(`/user/addresses/${address._id}/default`, {})));
      setNotice('Default delivery address updated.');
    } catch (error) { setMessage(error.message); }
    finally { setBusyId(''); }
  };
  const remove = async () => {
    if (busyId) return;
    setBusyId(removing._id); setMessage(''); setNotice('');
    try {
      setAddresses(savedAddresses(await api.delete(`/user/addresses/${removing._id}`)));
      setRemoving(null);
      setNotice('Address removed.');
    } catch (error) { setMessage(error.message); }
    finally { setBusyId(''); }
  };

  return (
    <section className="sc-addresses">
      <header className="sc-addresses__mobile-header"><button type="button" aria-label="Back to profile" onClick={() => navigate('/profile')}><ArrowLeft size={22} strokeWidth={1.7} /></button><h1>Saved addresses</h1></header>
      <div className="sc-account__shell">
        <nav className="sc-account__breadcrumb sc-addresses__breadcrumb" aria-label="Breadcrumb">
          <button type="button" onClick={() => navigate('/')}>Home</button><ChevronRight size={13} />
          <button type="button" onClick={() => navigate('/profile')}>My Account</button><ChevronRight size={13} />
          <span aria-current="page">Saved Addresses</span>
        </nav>
        <div className="sc-account__layout">
          <AccountSidebar user={user} navigate={navigate} logout={logout} activePath="/profile/addresses" />
          <div className="sc-addresses__main">
            <header className="sc-addresses__heading">
              <div><p className="sc-addresses__eyebrow">MY ACCOUNT</p><h1>Saved Addresses</h1>
                <p>Keep your delivery details ready for your next order.</p></div>
              <button type="button" className="sc-addresses__primary" onClick={openNewAddress} disabled={loading || !!loadError || !!busyId}>
                <Plus size={17} />Add New Address
              </button>
            </header>
            {notice && <p role="status" className="sc-addresses__notice"><Check size={16} />{notice}</p>}
            {message && !isEditor && !removing && <p role="alert" className="sc-addresses__error">{message}</p>}
            {loading ? <div role="status" className="sc-addresses__empty">Loading your addresses…</div>
              : loadError ? <div role="alert" className="sc-addresses__empty"><p>{loadError}</p><button type="button" className="sc-addresses__secondary" onClick={() => load(true)}>Try again</button></div>
                : !addresses.length ? <div className="sc-addresses__empty">
                  <span className="sc-addresses__empty-icon"><MapPin size={32} strokeWidth={1.5} /></span>
                  <h2>A place for your next delivery</h2><p>Add your home or work address for a quicker checkout.</p>
                  <button type="button" className="sc-addresses__primary" onClick={openNewAddress}><Plus size={17} />Add your first address</button>
                </div> : <>
                  {[['Default address', addresses.filter((address) => address.isDefault)], ['Other addresses', addresses.filter((address) => !address.isDefault)]].map(([title, list]) => list.length > 0 && (
                    <section className="sc-addresses__group" key={title} aria-label={title}>
                      <h2>{title}<span>{list.length}</span></h2>
                      <div className="sc-addresses__cards">{list.map((address) => <AddressCard key={address._id} address={address}
                        disabled={!!busyId} busy={busyId === address._id} onDefault={makeDefault}
                        onEdit={() => navigate(`/profile/addresses/edit?id=${address._id}`)}
                        onRemove={() => { setMessage(''); setRemoving(address); }} />)}</div>
                    </section>
                  ))}
                  <button type="button" className="sc-addresses__add" onClick={openNewAddress} disabled={!!busyId}><Plus size={18} />Add another address</button>
                  <p className="sc-addresses__hint">Your default address is selected first at checkout. You can choose a different address before placing an order.</p>
                </>}
          </div>
        </div>
      </div>
      {isEditor && <AddressDialog label={editing ? 'Edit address' : 'Add new address'} onClose={goBack} busy={saving}>
        {loading ? <p role="status" className="sc-addresses__empty">Loading your address…</p>
          : loadError ? <div className="sc-addresses__empty" role="alert"><p>{loadError}</p><button type="button" onClick={() => load(true)}>Try again</button><button type="button" onClick={goBack}>Back to addresses</button></div>
            : editing && !selected ? <div className="sc-addresses__empty"><h2>Address not found</h2><p>This address may have been removed.</p><button type="button" className="sc-addresses__secondary" onClick={goBack}>Back to addresses</button></div>
              : <AddressForm form={form} setForm={setForm} onSubmit={save} message={message} editing={editing} onCancel={goBack} saving={saving} />}
      </AddressDialog>}
      {removing && <AddressDialog label="Remove address" onClose={() => { setRemoving(null); setMessage(''); }} busy={!!busyId} compact>
        <div className="sc-addresses__confirm">
          <Trash2 size={25} /><h2>Remove this address?</h2><p>{removing.fullName}</p>
          <p>{buildAddressLines(removing).join(', ')}</p>
          {removing.isDefault && addresses.length > 1 && <p>Another saved address will become your default.</p>}
          {message && <p role="alert" className="sc-addresses__error">{message}</p>}
          <div className="sc-addresses__confirm-actions">
            <button type="button" className="sc-addresses__secondary" disabled={!!busyId} onClick={() => { setRemoving(null); setMessage(''); }}>Cancel</button>
            <button type="button" className="sc-addresses__primary" disabled={!!busyId} onClick={remove}>{busyId ? 'Removing…' : 'Remove address'}</button>
          </div>
        </div>
      </AddressDialog>}
    </section>
  );
}

function AddressDialog({ label, onClose, busy, compact, children }) {
  const dialog = useRef(null);
  useEffect(() => {
    const node = dialog.current;
    const previousFocus = document.activeElement;
    const overflow = document.body.style.overflow;
    node.showModal();
    document.body.style.overflow = 'hidden';
    return () => { node.close(); document.body.style.overflow = overflow; previousFocus?.focus(); };
  }, []);
  return <dialog ref={dialog} className={`sc-address-dialog${compact ? ' sc-address-dialog--compact' : ''}`} aria-label={label}
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>{children}</dialog>;
}

function AddressCard({ address, onEdit, onRemove, onDefault, disabled, busy }) {
  const AddressIcon = address.addressType === 'Work' ? BriefcaseBusiness : Home;
  return <article className={`sc-address-card${address.isDefault ? ' is-default' : ''}`} aria-label={`Address for ${address.fullName}`}>
    <div className="sc-address-card__content">
      <div className="sc-address-card__top"><h3>{address.fullName}</h3><span className="sc-address-card__type"><AddressIcon size={13} />{address.addressType || 'Home'}</span></div>
      <address>{buildAddressLines(address).map((line, index) => <span key={index}>{line}</span>)}</address>
      {address.landmark && <p className="sc-address-card__landmark">Landmark: {address.landmark}</p>}
      <p className="sc-address-card__phone">Mobile: <strong>{address.mobile || address.phone}</strong></p>
      {address.alternateMobile && <p className="sc-address-card__landmark">Alternate: {address.alternateMobile}</p>}
      {address.isDefault && <p className="sc-address-card__default"><Check size={14} />Default delivery address</p>}
    </div>
    <div className="sc-address-card__actions">
      <button type="button" disabled={disabled} onClick={onEdit}>Edit</button>
      <button type="button" disabled={disabled} onClick={onRemove}>Remove</button>
      {!address.isDefault && <button type="button" disabled={disabled} onClick={() => onDefault(address)}>{busy ? 'Updating…' : 'Make default'}</button>}
    </div>
  </article>;
}

export function AddressForm({ form, setForm, onSubmit, message, editing, onCancel, saving = false }) {
  const districts = useMemo(() => districtsForState(form.state), [form.state]);
  const lookupToken = useRef(0);
  const autoPinRef = useRef('');

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const selectState = (state) => {
    setForm((current) => {
      const nextDistricts = districtsForState(state);
      const city = nextDistricts.includes(current.city) ? current.city : '';
      return { ...current, state, city, pincode: city ? current.pincode : '' };
    });
  };

  const selectDistrict = (district) => {
    setForm((current) => ({ ...current, city: district }));
  };

  useEffect(() => {
    const pin = String(form.pincode || '').replace(/\D/g, '');
    if (pin.length !== 6 || pin === autoPinRef.current) return undefined;
    const token = ++lookupToken.current;
    const timer = window.setTimeout(() => {
      lookupPincode(pin).then((match) => {
        if (!match || token !== lookupToken.current) return;
        autoPinRef.current = pin;
        setForm((current) => ({
          ...current,
          pincode: pin,
          state: match.state || current.state,
          city: match.district || match.city || current.city,
        }));
      });
    }, 250);
    return () => { window.clearTimeout(timer); lookupToken.current += 1; };
  }, [form.pincode, setForm]);

  return (
    <Card as="form" onSubmit={onSubmit} className="sc-address-form overflow-hidden border-0 bg-ivory shadow-none">
      <div className="flex items-center justify-between border-b border-theme-border bg-ivory px-2 py-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="grid h-10 w-10 place-items-center rounded-full text-wine hover:bg-white"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <CardTitle className="flex-1 text-center text-[16px] font-semibold text-wine">
          {editing ? 'Update Address' : 'Add New Address'}
        </CardTitle>
        <div className="h-10 w-10" />
      </div>

      <CardContent className="space-y-6 px-4 py-5 pb-5">
        <div className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gold">Contact details</p>
          <LabeledField icon={UserRound} label="Full name">
            <TextInput autoComplete="name" value={form.fullName || ''} onChange={(event) => update('fullName', event.target.value)} placeholder="Name as on the parcel" disabled={saving} required />
          </LabeledField>
          <LabeledField icon={Phone} label="Mobile number">
            <TextInput
              value={form.mobile || ''}
              onChange={(event) => update('mobile', digitsOnly(event.target.value, 10))}
              placeholder="10-digit mobile number"
              inputMode="numeric"
              autoComplete="tel"
              maxLength={10}
              pattern="[6-9][0-9]{9}"
              disabled={saving}
              required
            />
          </LabeledField>
          {form.mobile && !isValidIndianMobile(form.mobile) ? (
            <p className="text-[11px] font-medium text-[#c81e4a]">{PHONE_VALIDATION_MESSAGE}</p>
          ) : null}
          <LabeledField icon={Phone} label="Alternate mobile (optional)">
            <TextInput value={form.alternateMobile || ''} onChange={(event) => update('alternateMobile', digitsOnly(event.target.value, 10))}
              placeholder="Alternate 10-digit mobile number" inputMode="numeric" maxLength={10} pattern="[6-9][0-9]{9}" disabled={saving} />
          </LabeledField>
        </div>

        <div className="space-y-3 border-t border-theme-border pt-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gold">Delivery location</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <LabeledField icon={Building2} label="State">
              <Select value={form.state || ''} onChange={(event) => selectState(event.target.value)} disabled={saving} required>
                <option value="">Select state</option>
                {INDIAN_STATES.map((state) => <option key={state} value={state}>{state}</option>)}
                {form.state && !INDIAN_STATES.includes(form.state) ? <option value={form.state}>{form.state}</option> : null}
              </Select>
            </LabeledField>
            <LabeledField icon={MapPinned} label="District">
              <Select value={form.city || ''} onChange={(event) => selectDistrict(event.target.value)} disabled={saving || !form.state} required>
                <option value="">{form.state ? 'Select district' : 'Select state first'}</option>
                {districts.map((district) => <option key={district} value={district}>{district}</option>)}
                {form.city && !districts.includes(form.city) ? <option value={form.city}>{form.city}</option> : null}
              </Select>
            </LabeledField>
          </div>
          <LabeledField icon={MapPinned} label="Pincode">
            <TextInput
              value={form.pincode || ''}
              onChange={(event) => update('pincode', event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-digit pincode"
              autoComplete="postal-code"
              inputMode="numeric"
              pattern="[1-9][0-9]{5}"
              maxLength={6}
              disabled={saving}
              required
            />
          </LabeledField>
          <p className="text-[11px] leading-5 text-slate-500">Enter your exact delivery pincode to fill state and district. You can also select them manually.</p>
          <LabeledField icon={Home} label="House / flat / block">
            <TextInput value={form.houseNo || ''} onChange={(event) => update('houseNo', event.target.value)} placeholder="House no., tower or block" disabled={saving} required />
          </LabeledField>
          <LabeledField icon={MapPinned} label="Street / area">
            <TextInput value={form.area || ''} onChange={(event) => update('area', event.target.value)} placeholder="Building, street, area" disabled={saving} required />
          </LabeledField>
          <LabeledField icon={BriefcaseBusiness} label="Locality / landmark">
            <TextInput value={form.landmark || ''} onChange={(event) => update('landmark', event.target.value)} placeholder="Locality or nearby landmark" disabled={saving} />
          </LabeledField>
        </div>

        <div className="space-y-3 border-t border-theme-border pt-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gold">Address type</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: 'Home', label: 'Home', desc: 'Personal deliveries', icon: Home },
              { value: 'Work', label: 'Work', desc: 'Office deliveries', icon: BriefcaseBusiness },
            ].map((option) => {
              const active = form.addressType === option.value;
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => update('addressType', option.value)}
                  disabled={saving}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                    active ? 'border-wine bg-white shadow-[0_0_0_1px_#6d1f34]' : 'border-theme-border bg-white'
                  }`}
                >
                  <span className={`grid h-9 w-9 place-items-center rounded-full ${active ? 'bg-wine text-ivory' : 'bg-ivory text-gold'}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-bold text-[#3f2a22]">{option.label}</span>
                    <span className="block text-[11px] text-slate-500">{option.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <label className="flex items-center gap-2 rounded-xl border border-theme-border bg-white px-3 py-3 text-[12px] text-slate-600">
            <input type="checkbox" checked={form.isDefault} onChange={(event) => update('isDefault', event.target.checked)} className="accent-wine" disabled={saving} />
            Make this my default address
          </label>
        </div>

        {message && <p role="alert" className="error-text font-semibold text-wine">{message}</p>}

        <div className="grid grid-cols-2 gap-3 border-t border-theme-border pt-5">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={saving} className="h-11 rounded-xl border border-theme-border bg-white text-[#3f2a22]">
            Cancel
          </Button>
          <Button type="submit" disabled={saving} className="h-11 rounded-xl bg-wine text-ivory hover:bg-[#5a192b]">
            {saving ? 'Saving...' : editing ? 'Update Address' : 'Save Address'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function LabeledField({ icon: Icon, label, children }) {
  return (
    <label className="sc-address-form__field block min-w-0">
      <span className="mb-1.5 flex items-center gap-2 text-[12px] font-semibold text-wine">
        <Icon className="h-3.5 w-3.5 text-gold" />
        {label}
      </span>
      <div className="sc-field-shell min-w-0 max-w-full rounded-xl border border-theme-border bg-white px-3 py-1">
        {children}
      </div>
    </label>
  );
}

function buildAddressLines(address) {
  const lines = [];
  if (address.houseNo || address.houseNumber) lines.push(address.houseNo || address.houseNumber);
  if (address.area) lines.push(address.area);
  const cityLine = [address.city, address.pincode ? `- ${address.pincode}` : ''].filter(Boolean).join(' ');
  if (cityLine) lines.push(cityLine);
  if (address.state) lines.push(address.state);
  return lines;
}
