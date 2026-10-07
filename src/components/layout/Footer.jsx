import { useRef, useState } from 'react';
import {
  ArrowRight,
  BadgePercent,
  Bell,
  BookOpen,
  Briefcase,
  FileText,
  Gift,
  Headphones,
  HelpCircle,
  Leaf,
  LockKeyhole,
  MapPin,
  MessageCircle,
  Newspaper,
  Package,
  RefreshCcw,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Tag,
  Truck,
  XCircle,
} from 'lucide-react';
import {
  IconBrandApple,
  IconBrandFacebook,
  IconBrandGooglePlay,
  IconBrandInstagram,
  IconBrandPinterest,
  IconBrandYoutube,
} from '@tabler/icons-react';
import logo from '../../assets/generated-brand-logo.svg';
import StoreLogo from '../ui/StoreLogo';
import { useGetSettingsQuery } from '../../store/apiSlice';
import api from '../../services/api';
import { useWebsiteCustomization } from '../../context/WebsiteCustomizationContext';
import { useStorefront } from '../../context/StorefrontContext';
import { storefrontPath } from '../../utils/routing';
import { normalizeImageUrl } from '../../services/normalize';
import './Footer.css';

const shoppingLinks = [
  ['New Arrivals', '/products?newArrival=true'],
  ['Sarees', '/products?search=Saree'],
  ['Suits', '/products?search=Suit'],
  ['Kurtis', '/products?search=Kurti'],
  ['Lehengas', '/products?search=Lehenga'],
  ['Dresses', '/products?search=Dress'],
  ['Tops', '/products?search=Top'],
  ['Co-ords & Sets', '/products?search=Co-ords'],
  ['Accessories', '/products?search=Accessory'],
  ['Sale', '/products?discount=20'],
];

const policyLinks = [
  ['Track Your Order', '/orders'],
  ['Returns & Refunds', '/returns'],
  ['Shipping Policy', '/shipping-policy'],
  ['Cancellation Policy', '/cancellation-policy'],
  ['Size Guide', '/size-guide'],
  ['FAQs', '/faqs'],
  ['Contact Us', '/contact'],
];

const aboutLinks = [
  ['Our Story', '/our-story'],
  ['Reviews', '/products?bestSeller=true'],
];

const socialLinks = [
  ['Facebook', IconBrandFacebook],
  ['Instagram', IconBrandInstagram],
  ['Pinterest', IconBrandPinterest],
  ['YouTube', IconBrandYoutube],
];

const serviceItems = [
  ['100% Authentic', 'Genuine products, always', ShieldCheck],
  ['Free Shipping', 'On orders above ₹999', Truck],
  ['Easy Returns', 'Hassle-free returns', RefreshCcw],
  ['Secure Payments', '100% safe & secure', LockKeyhole],
  ['Customer Support', "We're here to help", Headphones],
];

const appPerks = [
  ['Exclusive Deals', Tag],
  ['Order Alerts', Bell],
  ['Easy Returns', BadgePercent],
];

const payments = ['visa', 'mastercard', 'rupay', 'upi', 'paytm', 'gpay', 'phonepe', 'paypal'];

const footerLinkIcons = {
  'New Arrivals': Sparkles,
  Sarees: Shirt,
  Suits: Shirt,
  Kurtis: Shirt,
  Lehengas: Sparkles,
  Dresses: Shirt,
  Tops: Shirt,
  'Co-ords & Sets': ShoppingBag,
  Accessories: Tag,
  Sale: BadgePercent,
  'Track Your Order': Package,
  'Returns & Refunds': RefreshCcw,
  'Shipping Policy': Truck,
  'Cancellation Policy': XCircle,
  'Size Guide': Shirt,
  FAQs: HelpCircle,
  'Gift Cards': Gift,
  'Store Locator': MapPin,
  'Contact Us': MessageCircle,
  'Our Story': BookOpen,
  'Why Samaira': Star,
  Reviews: Star,
  Careers: Briefcase,
  Press: Newspaper,
  Sustainability: Leaf,
  Blog: FileText,
  'Affiliate Program': Store,
};

const legalLinks = [
  ['Terms & Conditions', '/terms', FileText],
  ['Privacy Policy', '/privacy-policy', ShieldCheck],
  ['Return Policy', '/return-policy', RefreshCcw],
  ['Sitemap', '/products', MapPin],
];

export default function Footer({ navigate }) {
  const { storeSlug } = useStorefront();
  const { data: settings = {} } = useGetSettingsQuery({ store: storeSlug });
  const { config: websiteConfig } = useWebsiteCustomization();
  const footerConfig = websiteConfig.footer;
  const [email, setEmail] = useState('');
  const [newsletterStatus, setNewsletterStatus] = useState('');
  const [subscribing, setSubscribing] = useState(false);
  const subscribeLock = useRef(false);

  const go = (path) => {
    path = storefrontPath(path, storeSlug);
    if (navigate) navigate(path);
  };
  const socialUrls = Object.fromEntries(Object.entries({ ...(settings.socialLinks || {}), ...(footerConfig.socialLinks || {}) }).filter(([, value]) => value));
  const configuredShoppingLinks = menuPairs(footerConfig.menus?.shopping, shoppingLinks);
  const configuredPolicyLinks = menuPairs(footerConfig.menus?.policies, policyLinks);
  const configuredAboutLinks = menuPairs(footerConfig.menus?.about, aboutLinks);
  const footerContactText = [footerConfig.contactEmail || settings.contactEmail, footerConfig.contactPhone || settings.contactPhone, footerConfig.contactAddress].filter(Boolean).join(' · ');
  const appLinks = settings.appLinks || {};
  const playStoreUrl = appLinks.googlePlay || appLinks.playStore;
  const appStoreUrl = appLinks.appStore || appLinks.appleStore;
  const openExternal = (url, fallbackPath = '/contact') => {
    if (!url) {
      go(fallbackPath);
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };
  const subscribe = async (event) => {
    event.preventDefault();
    if (subscribeLock.current) return;
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setNewsletterStatus('Please enter your email.');
      return;
    }
    subscribeLock.current = true; setSubscribing(true); setNewsletterStatus('');
    try {
      const data = await api.post('/newsletter/subscribe', { email: trimmedEmail, source: 'footer' });
      setNewsletterStatus(data.message || 'Thanks for subscribing.');
      setEmail('');
    } catch (error) {
      setNewsletterStatus(error.message || 'Unable to subscribe right now.');
    } finally {
      subscribeLock.current = false; setSubscribing(false);
    }
  };

  if (!footerConfig.enabled) return null;
  const configuredLogo = normalizeImageUrl(footerConfig.logo || websiteConfig.branding.logo) || logo;

  return (
    <footer className="sc-footer" aria-label={`${websiteConfig.branding.websiteName} footer`} style={{ '--footer-bg': footerConfig.background, '--footer-text': footerConfig.textColor }}>
      <div className="sc-footer__top">
        <section className="sc-footer__brand">
          <button type="button" className="sc-footer__logo-link" onClick={() => go('/')}>
            <StoreLogo src={configuredLogo} name={websiteConfig.branding.websiteName} className="sc-footer__logo" />
          </button>
          <p>{footerConfig.description || settings.footerText}</p>
          {footerConfig.showContact && footerContactText && <p>{footerContactText}</p>}
          {footerConfig.showContact && settings.supportHours && <p>{settings.supportHours}</p>}
          {footerConfig.showSocialLinks && <SocialRow socialUrls={socialUrls} onOpen={openExternal} />}
        </section>

        <FooterColumn title="Online Shopping" links={configuredShoppingLinks} navigate={go} />
        <FooterColumn title="Customer Policies" links={configuredPolicyLinks} navigate={go} />
        <FooterColumn title="About" links={configuredAboutLinks} navigate={go} />

        {(playStoreUrl || appStoreUrl) ? (
        <section className="sc-footer__app">
          <h2>Experience Samaira App</h2>
          <p>Shop on the go &amp; get exclusive app-only offers.</p>
          <div className="sc-footer__stores" aria-label="Download app">
            {playStoreUrl ? (
            <button type="button" className="sc-footer__store" onClick={() => openExternal(playStoreUrl)}>
              <IconBrandGooglePlay size={24} aria-hidden="true" />
              <span>
                <small>Get it on</small>
                Google Play
              </span>
            </button>
            ) : null}
            {appStoreUrl ? (
            <button type="button" className="sc-footer__store" onClick={() => openExternal(appStoreUrl)}>
              <IconBrandApple size={26} aria-hidden="true" />
              <span>
                <small>Download on the</small>
                App Store
              </span>
            </button>
            ) : null}
          </div>
          <div className="sc-footer__perks">
            {appPerks.map(([label, Icon]) => (
              <div key={label} className="sc-footer__perk">
                <Icon size={22} aria-hidden="true" />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </section>
        ) : null}

        {footerConfig.showNewsletter && <section className="sc-footer__connect">
          <h2>Keep In Touch</h2>
          <p>Be the first to know about new arrivals, offers &amp; style inspiration.</p>
          <form className="sc-footer__email" onSubmit={subscribe}>
            <input
              type="email"
              placeholder="Enter your email"
              aria-label="Email address"
              value={email}
              disabled={subscribing}
              onChange={(event) => {
                setEmail(event.currentTarget.value);
                if (newsletterStatus) setNewsletterStatus('');
              }}
            />
            <button type="submit" aria-label={subscribing ? 'Subscribing' : 'Subscribe'} disabled={subscribing}>
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </form>
          {newsletterStatus ? <p role="status" className="sc-footer__form-status">{newsletterStatus}</p> : null}
          <div className="sc-footer__or">
            <span />
            OR
            <span />
          </div>
          <p className="sc-footer__social-title">Connect with us on</p>
          {footerConfig.showSocialLinks && <SocialRow socialUrls={socialUrls} onOpen={openExternal} />}
        </section>
        }
      </div>

      <div className="sc-footer__service-strip">
        {serviceItems.map(([title, subtitle, Icon]) => (
          <div key={title} className="sc-footer__service">
            <Icon size={32} aria-hidden="true" />
            <span>
              <strong>{title}</strong>
              <small>{subtitle}</small>
            </span>
          </div>
        ))}
      </div>

      <div className="sc-footer__payment-row">
        <div className="sc-footer__payments">
          <strong>We Accept</strong>
          {payments.map((item) => (
            <PaymentIcon key={item} type={item} />
          ))}
        </div>
        <nav className="sc-footer__legal" aria-label="Footer legal links">
          {legalLinks.map(([label, path, Icon]) => (
            <button key={label} type="button" onClick={() => go(path)}>
              <Icon size={14} aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      <div className="sc-footer__bottom">
        <p>{footerConfig.copyrightText || `© ${new Date().getFullYear()} ${websiteConfig.branding.websiteName}. All Rights Reserved.`}</p>
        <p>Made with <span aria-hidden="true">♥</span> for fashion lovers</p>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links, navigate }) {
  return (
    <nav className="sc-footer__column" aria-label={title}>
      <h2>{title}</h2>
      {links.map(([label, path]) => {
        const Icon = footerLinkIcons[label] || ArrowRight;
        return (
          <button key={label} type="button" onClick={() => navigate(path)} className={label === 'Sale' ? 'sc-footer__sale' : ''}>
            <Icon className="sc-footer__link-icon" size={13} aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </nav>
  );
}

function SocialRow({ socialUrls = {}, onOpen }) {
  return (
    <div className="sc-footer__social">
      {socialLinks.map(([label, Icon]) => (
        <button key={label} type="button" aria-label={label} onClick={() => onOpen?.(socialUrls[label.toLowerCase()] || socialUrls[label])}>
          <Icon size={16} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

function PaymentIcon({ type }) {
  const labels = {
    visa: 'Visa',
    mastercard: 'Mastercard',
    rupay: 'RuPay',
    upi: 'UPI',
    paytm: 'Paytm',
    gpay: 'Google Pay',
    phonepe: 'PhonePe',
    paypal: 'PayPal',
  };

  if (type === 'mastercard') {
    return (
      <span className="sc-footer__pay-icon sc-footer__pay-icon--mastercard" aria-label={labels[type]} title={labels[type]}>
        <i />
        <i />
      </span>
    );
  }

  if (type === 'gpay') {
    return (
      <span className="sc-footer__pay-icon sc-footer__pay-icon--gpay" aria-label={labels[type]} title={labels[type]}>
        <b>G</b>
        <span>Pay</span>
      </span>
    );
  }

  if (type === 'phonepe') {
    return (
      <span className="sc-footer__pay-icon sc-footer__pay-icon--phonepe" aria-label={labels[type]} title={labels[type]}>
        <b>पे</b>
      </span>
    );
  }

  return (
    <span className={`sc-footer__pay-icon sc-footer__pay-icon--${type}`} aria-label={labels[type]} title={labels[type]}>
      <span>{labels[type]}</span>
    </span>
  );
}

function menuPairs(items, fallback) {
  if (!Array.isArray(items)) return fallback;
  return items.map((item) => [item.label, item.path]).filter(([label, path]) => label && path);
}
