import RentalFaq from '../../components/rentals/RentalFaq';
import TrafficPrivacyPolicy from '../../components/analytics/TrafficPrivacyPolicy';
import { useEffect, useRef, useState } from 'react';
import { Clock3, Headphones, Mail, MapPin, MessageCircle, Send } from 'lucide-react';
import { Card, CardContent } from '../../components/ui';
import PageState from '../../components/ui/PageState';
import api from '../../services/api';
import { normalizeIndianPhone } from '../../utils/phoneFormatter';
import { useStorefront } from '../../context/StorefrontContext';

const pageCopy = {
  '/return-policy': {
    title: 'Return Policy',
    key: 'returnPolicy',
    fallback: 'Returns and exchanges are accepted within the eligible return window when products are unused, unworn, and returned with original tags and packaging. Final sale items and altered products may not be eligible.',
  },
  '/privacy-policy': {
    title: 'Privacy Policy',
    key: 'privacyPolicy',
    fallback: 'We collect only the information needed to process orders, support customers, and improve the shopping experience. Customer information is handled carefully and is not sold to third parties.',
  },
  '/terms': {
    title: 'Terms and Conditions',
    key: 'termsConditions',
    fallback: 'By using Jassi Bridal Bazar Dharmshala, you agree to provide accurate account and order information, follow checkout terms, and use the website only for lawful shopping activity.',
  },
  '/shipping-policy': {
    title: 'Shipping Policy',
    key: 'shippingPolicy',
    fallback: 'Orders are packed and handed to the courier after confirmation. Delivery timelines depend on your destination and the courier. The shop will confirm dispatch timing. You will receive tracking details once the shipment is created.',
  },
  '/cancellation-policy': {
    title: 'Cancellation Policy',
    key: 'cancellationPolicy',
    fallback: 'Orders can be cancelled before they are shipped. Once packed or dispatched, cancellation is no longer available and a return can be requested after delivery.',
  },
  '/size-guide': {
    title: 'Size Guide',
    key: 'sizeGuide',
    fallback: 'Measure bust, waist and hip, then choose the closest size on the product page. If you are between sizes, we recommend the larger size for ethnic wear with lining or heavy work.',
  },
  '/faqs': {
    title: 'FAQs',
    key: 'faqs',
    fallback: 'Orders, shipping, returns and payments are handled from your account. Contact us if an order is delayed or a product arrives damaged. COD and online payments follow the methods enabled in store settings.',
  },
  '/our-story': {
    title: 'Our Story',
    key: 'ourStory',
    fallback: 'Jassi Bridal Bazar Dharmshala offers festive and everyday ethnic wear chosen for fabric, finish and occasion-ready styling.',
  },
};

export default function Contact({ route = '/contact' }) {
  const { storeSlug } = useStorefront();
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const submitLock = useRef(false);
  const [sent, setSent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' });

  useEffect(() => {
    const orderId = new URLSearchParams(route.split('?')[1] || '').get('order');
    if (orderId && /^[a-f\d]{24}$/i.test(orderId)) {
      setForm((current) => ({ ...current, subject: `Help with order #${orderId}`, message: `Order ID: ${orderId}\n\n` }));
    }
  }, [route]);

  useEffect(() => {
    let active = true;
    setLoading(true); setSettingsError('');
    api.get(`/settings${storeSlug ? `?store=${encodeURIComponent(storeSlug)}` : ''}`, { cacheFirst: true, forceRefetch: attempt > 0 })
      .then(data => { if (active) setSettings(data || {}); })
      .catch((err) => { if (active) setSettingsError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt, storeSlug]);

  const routePath = route.split('?')[0].replace(/^\/store\/[^/]+/, '') || '/';
  const policy = pageCopy[routePath];

  if (loading) {
    return (
      <section className="container-page py-6 md:py-10">
        <PageState loading loadingLabel="Loading page..." />
      </section>
    );
  }

  if (settingsError) return <section className="container-page py-6 md:py-10"><PageState error={settingsError} onRetry={() => setAttempt(value => value + 1)} /></section>;

  if (policy) {
    return (
      <section className="container-page py-6 md:py-10">
        <Card as="article" className="mx-auto max-w-3xl">
          <CardContent className="p-5 md:p-7">
          <p className="small-text font-bold uppercase tracking-[0.14em] text-wine md:text-xs md:tracking-[0.22em]">Jassi Bridal Bazar Dharmshala</p>
          <h1 className="page-title mt-3 md:text-3xl">{policy.title}</h1>
          <p className="body-text mt-5 whitespace-pre-line text-[color:var(--site-muted)] md:leading-7">
            {settings[policy.key] || policy.fallback}
          </p>
          {routePath === '/privacy-policy' && <TrafficPrivacyPolicy />}
          </CardContent>
        </Card>
        {routePath === '/faqs' || routePath === '/terms' || routePath === '/return-policy' || routePath === '/cancellation-policy' ? <RentalFaq storeSlug={storeSlug} /> : null}
      </section>
    );
  }

  const submit = async (event) => {
    event.preventDefault();
    if (submitLock.current) return;
    submitLock.current = true;
    setSent('');
    setError('');
    setSubmitting(true);
    try {
      const data = await api.post('/contact', form);
      setSent(data.message || 'Message received. We will contact you shortly.');
      setForm({ name: '', email: '', phone: '', subject: '', message: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  const email = settings.contactEmail || '';
  const phone = settings.whatsappNumber || settings.contactPhone || '';

  return (
    <section className="relative isolate overflow-hidden bg-[color:var(--site-accent-soft)] py-8 sm:py-12 lg:py-16">
      <div className="pointer-events-none absolute -left-28 top-16 h-80 w-80 rounded-full bg-[color:var(--site-tint)]/55 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-[color:var(--site-accent-soft)]/45 blur-3xl" aria-hidden="true" />

      <div className="relative mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-10">
        <div className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:gap-7">
          <aside className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-[color:var(--site-primary)] via-[color:var(--site-primary)] to-[color:var(--site-primary-dark)] p-6 text-[color:var(--site-on-fill)] shadow-[0_24px_70px_rgb(var(--site-shadow-rgb)/0.22)] sm:p-8 lg:p-10">
            <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full border-[44px] border-[color:var(--site-border)]/[0.05]" aria-hidden="true" />
            <div className="absolute -bottom-24 -left-20 h-64 w-64 rounded-full bg-[color:var(--site-accent)]/10 blur-2xl" aria-hidden="true" />

            <div className="relative flex h-full flex-col">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--site-accent)]">Contact Jassi Bridal Bazar Dharmshala</p>
                <h2 className="mt-3 text-[27px] font-semibold leading-tight sm:text-[32px]">Let&apos;s find the right answer together.</h2>
                <p className="mt-4 max-w-md text-[13px] leading-6 text-[color:color-mix(in_srgb,var(--site-on-fill)_70%,transparent)] sm:text-[14px]">
                  Choose the most convenient way to reach us. We can help with product details, sizing, orders, and after-sales support.
                </p>
              </div>

              <div className="mt-7 space-y-3 sm:mt-9">
                {email && <ContactMethod
                  icon={Mail}
                  label="Email us"
                  value={email}
                  href={`mailto:${email}`}
                />}
                {phone && <ContactMethod
                  icon={MessageCircle}
                  label="Chat on WhatsApp"
                  value={phone}
                  href={whatsAppHref(phone)}
                  external
                />}
                {settings.address ? (
                  <ContactMethod icon={MapPin} label="Our location" value={settings.address} />
                ) : null}
              </div>

              <div className="relative mt-8 grid grid-cols-2 gap-3 border-t border-[color:color-mix(in_srgb,var(--site-border)_10%,transparent)] pt-6 sm:mt-auto sm:pt-7">
                <SupportNote icon={Headphones} title="Thoughtful support" text="Product and order help" />
                <SupportNote icon={Clock3} title={settings.supportHours ? 'Support hours' : 'Quick response'} text={settings.supportHours || 'We reply as soon as possible'} />
              </div>
            </div>
          </aside>

          <form onSubmit={submit} className="rounded-[26px] border border-theme-border bg-[color:color-mix(in_srgb,var(--site-surface)_95%,transparent)] p-5 shadow-[0_20px_65px_rgb(var(--site-shadow-rgb)/0.09)] backdrop-blur sm:p-8 lg:p-10">
            <div className="flex items-start justify-between gap-4 border-b border-[color:var(--site-accent-border)] pb-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--site-accent)]">Send a message</p>
                <h2 className="mt-2 text-[25px] font-semibold text-[color:var(--site-text)] sm:text-[30px]">How can we help?</h2>
                <p className="mt-2 text-[13px] leading-6 text-[color:var(--site-muted)]">Share a few details and our team will get back to you.</p>
              </div>
              <span className="hidden h-12 w-12 shrink-0 place-items-center rounded-full bg-blush text-wine sm:grid">
                <MessageCircle className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <ContactField label="Full name" required>
                <input className={fieldClass} placeholder="Your name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
              </ContactField>
              <ContactField label="Email address" required>
                <input className={fieldClass} type="email" placeholder="you@example.com" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required />
              </ContactField>
              <ContactField label="Phone number" hint="Optional">
                <input className={fieldClass} type="tel" inputMode="tel" placeholder="Your mobile number" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
              </ContactField>
              <ContactField label="Subject">
                <input className={fieldClass} placeholder="What can we help with?" value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} />
              </ContactField>
              <ContactField label="Your message" required className="sm:col-span-2">
                <textarea className={`${fieldClass} min-h-[150px] resize-y py-3.5`} placeholder="Tell us how we can help..." value={form.message} onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} required />
              </ContactField>
            </div>

            <button type="submit" className="mt-6 inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-[12px] bg-gradient-to-r from-wine to-[color:var(--site-primary-dark)] px-5 text-[13px] font-bold uppercase tracking-[0.08em] text-[color:var(--site-on-fill)] shadow-[0_12px_28px_rgb(var(--site-shadow-rgb)/0.24)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgb(var(--site-shadow-rgb)/0.3)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0" disabled={submitting}>
              {submitting ? 'Sending...' : 'Send Message'}
              {!submitting ? <Send className="h-4 w-4" aria-hidden="true" /> : null}
            </button>
            <p className="mt-3 text-center text-[11px] leading-5 text-[color:var(--site-muted)]">Your details are used only to respond to your enquiry.</p>

            <div aria-live="polite">
              {sent ? <p role="status" className="mt-4 rounded-xl border border-[color:var(--site-success-border)] bg-[color:var(--site-success-soft)] px-4 py-3 text-[13px] font-medium text-[color:var(--site-success)]">{sent}</p> : null}
              {error ? <p role="alert" className="mt-4 rounded-xl border border-[color:var(--site-primary-border)] bg-[color:var(--site-tint)] px-4 py-3 text-[13px] font-medium text-[color:var(--site-primary)]">{error}</p> : null}
            </div>
          </form>
        </div>
      </div>
      <RentalFaq storeSlug={storeSlug} />
    </section>
  );
}

const fieldClass = 'h-12 w-full rounded-[12px] border border-[color:var(--site-border)] bg-[color:var(--site-accent-soft)] px-4 text-[14px] text-[color:var(--site-text)] outline-none transition placeholder:text-[color:var(--site-muted)] focus:border-[color:var(--site-primary-border)] focus:bg-[color:var(--site-surface)] focus:ring-4 focus:ring-[color:var(--site-primary)]/10';

function ContactField({ label, hint, required, className = '', children }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 flex items-center justify-between gap-2 text-[12px] font-bold text-[color:var(--site-text)]">
        <span>{label}{required ? <span className="ml-1 text-[color:var(--site-primary)]">*</span> : null}</span>
        {hint ? <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-[color:var(--site-muted)]">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

function ContactMethod({ icon: Icon, label, value, href, external = false }) {
  const content = (
    <>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[color:color-mix(in_srgb,var(--site-border)_15%,transparent)] bg-[color:color-mix(in_srgb,var(--site-surface)_10%,transparent)] text-[color:var(--site-accent)]">
        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-[color:color-mix(in_srgb,var(--site-on-fill)_50%,transparent)]">{label}</span>
        <span className="mt-1 block break-words text-[13px] font-semibold text-[color:var(--site-on-fill)] sm:text-[14px]">{value}</span>
      </span>
    </>
  );

  const classes = 'flex items-center gap-3 rounded-[16px] border border-[color:color-mix(in_srgb,var(--site-border)_10%,transparent)] bg-[color:var(--site-surface)]/[0.06] p-3.5 transition hover:border-[color:color-mix(in_srgb,var(--site-border)_20%,transparent)] hover:bg-[color:var(--site-surface)]/[0.1]';
  if (!href) return <div className={classes}>{content}</div>;
  return <a className={classes} href={href} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}>{content}</a>;
}

function SupportNote({ icon: Icon, title, text }) {
  return (
    <div className="flex gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--site-accent)]" aria-hidden="true" />
      <span>
        <strong className="block text-[11px] font-semibold text-[color:var(--site-on-fill)]">{title}</strong>
        <small className="mt-1 block text-[10px] leading-4 text-[color:color-mix(in_srgb,var(--site-on-fill)_50%,transparent)]">{text}</small>
      </span>
    </div>
  );
}

function whatsAppHref(value) {
  const digits = normalizeIndianPhone(value);
  return digits ? `https://wa.me/91${digits}` : undefined;
}
