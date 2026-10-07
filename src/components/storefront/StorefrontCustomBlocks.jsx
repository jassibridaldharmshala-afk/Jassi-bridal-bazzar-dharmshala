import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ChevronRight, Copy, PlayCircle } from 'lucide-react';
import { getPrimaryImageUrl, normalizeImageUrl } from '../../services/normalize';
import { productHref } from '../../utils/routing';
import './StorefrontCustomBlocks.css';

export default function StorefrontCustomBlocks({ blocks = [], catalog = [], categories = [], navigate, mobile = false, storeSlug = '' }) {
  const products = useMemo(() => new Map(catalog.map((item) => [String(item._id || item.id || item.slug), item])), [catalog]);
  const categoryMap = useMemo(() => new Map(categories.map((item) => [String(item._id || item.id || item.slug), item])), [categories]);
  const visible = blocks.filter((block) => block.visible !== false && (mobile ? block.showOnMobile !== false : block.showOnDesktop !== false));
  if (!visible.length) return null;
  return visible.map((block) => <CustomBlock key={block.id} block={block} products={products} categories={categoryMap} navigate={navigate} mobile={mobile} storeSlug={storeSlug} />);
}

function CustomBlock({ block, products, categories, navigate = () => {}, mobile, storeSlug }) {
  const image = normalizeImageUrl((mobile && block.mobileImage) || block.image);
  const selectedProducts = (block.productIds || []).map((id) => products.get(String(id))).filter(Boolean);
  const selectedCategories = (block.categoryIds || []).map((id) => categories.get(String(id))).filter(Boolean);
  const style = {
    '--custom-block-bg': block.backgroundColor || 'var(--site-surface, #fff)',
    '--custom-block-text': block.textColor || 'var(--site-text, #17161a)',
    '--custom-block-order': block.order,
    textAlign: block.alignment || 'left',
  };
  const action = block.buttonText && block.buttonLink
    ? <button type="button" className="site-theme-button sc-custom-block__button" onClick={() => navigate(block.buttonLink)}>{block.buttonText}<ChevronRight size={16} /></button>
    : null;

  if (block.type === 'product-grid') return <section className="sc-custom-block sc-custom-block--catalog" style={style} data-custom-block={block.id}>
    <BlockHeading block={block} />
    <div className="sc-custom-block__products">{selectedProducts.map((product) => <button type="button" key={product._id || product.id || product.slug} onClick={() => navigate(productHref(product, storeSlug))}>
      <span>{getPrimaryImageUrl(product.images || []) ? <img src={normalizeImageUrl(getPrimaryImageUrl(product.images || []))} alt={product.name || 'Product'} loading="lazy" decoding="async" /> : null}</span>
      <strong>{product.name}</strong><small>₹{Number(product.price || 0).toLocaleString('en-IN')}</small>
    </button>)}</div>{!selectedProducts.length && <p className="sc-custom-block__empty">Choose products in Website Designer.</p>}{action}
  </section>;

  if (['category-grid', 'category-carousel'].includes(block.type)) return <section className={`sc-custom-block sc-custom-block--catalog ${block.type === 'category-carousel' ? 'sc-custom-block--category-carousel' : ''}`} style={style} data-custom-block={block.id}>
    <BlockHeading block={block} /><div className="sc-custom-block__categories">{selectedCategories.map((category) => <button type="button" key={category._id || category.id || category.slug} onClick={() => navigate(`/products?category=${encodeURIComponent(category._id || category.slug)}`)}>
      {category.image ? <img src={normalizeImageUrl(category.image)} alt={category.name || 'Category'} loading="lazy" decoding="async" /> : null}<strong>{category.name || category.title}</strong>
    </button>)}</div>{!selectedCategories.length && <p className="sc-custom-block__empty">Choose categories in Website Designer.</p>}{action}
  </section>;

  if (block.type === 'faq') return <section className="sc-custom-block sc-custom-block--faq" style={style} data-custom-block={block.id}><BlockHeading block={block} />
    <div>{(block.items || []).map((item, index) => { const [question, answer] = String(item).split('|'); return <details key={`${item}-${index}`}><summary>{question}</summary>{answer && <p>{answer}</p>}</details>; })}</div>{action}</section>;

  if (block.type === 'trust') return <section className="sc-custom-block sc-custom-block--trust" style={style} data-custom-block={block.id}><BlockHeading block={block} />
    <div>{(block.items || []).map((item) => <span key={item}><CheckCircle2 size={19} /><strong>{item}</strong></span>)}</div>{action}</section>;

  if (block.type === 'video') return <section className="sc-custom-block sc-custom-block--media" style={style} data-custom-block={block.id}><div className="sc-custom-block__copy"><BlockHeading block={block} />{action}</div>
    {block.videoUrl ? <video controls preload="metadata" poster={image || undefined} aria-label={block.altText || block.title}><source src={normalizeImageUrl(block.videoUrl)} /></video> : <div className="sc-custom-block__video-placeholder"><PlayCircle size={40} /><span>Add an MP4 or WEBM video</span></div>}</section>;

  if (block.type === 'newsletter') return <NewsletterBlock block={block} style={style} />;
  if (block.type === 'countdown') return <CountdownBlock block={block} style={style} action={action} />;
  if (block.type === 'coupon') return <CouponBlock block={block} style={style} action={action} />;

  if (['reviews', 'social'].includes(block.type)) return <section className={`sc-custom-block sc-custom-block--${block.type}`} style={style} data-custom-block={block.id}><BlockHeading block={block} />
    {image && <img className="sc-custom-block__wide-image" src={image} alt={block.altText} loading="lazy" decoding="async" style={{ objectPosition: block.imagePosition || 'center' }} />}<div className="sc-custom-block__tiles">{(block.items || []).map((item) => <blockquote key={item}>{item}</blockquote>)}</div>{action}</section>;

  return <section className={`sc-custom-block sc-custom-block--${block.type}`} style={style} data-custom-block={block.id}>
    <div className="sc-custom-block__copy"><BlockHeading block={block} />{action}</div>
    {image && <img src={image} alt={block.altText} loading="lazy" decoding="async" style={{ objectPosition: block.imagePosition || 'center' }} />}
  </section>;
}

function NewsletterBlock({ block, style }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const locked = useRef(false);
  const submit = async (event) => {
    event.preventDefault();
    const value = email.trim();
    if (locked.current || !value) { if (!value) setStatus('Enter your email address.'); return; }
    locked.current = true; setSubmitting(true); setStatus('');
    try {
      const { default: api } = await import('../../services/api');
      const result = await api.post('/newsletter/subscribe', { email: value, source: `designer:${block.id}` });
      setStatus(result.message || 'Thank you for subscribing.'); setEmail('');
    } catch (error) { setStatus(error.message || 'Unable to subscribe right now.'); }
    finally { locked.current = false; setSubmitting(false); }
  };
  return <section className="sc-custom-block sc-custom-block--newsletter" style={style} data-custom-block={block.id}><BlockHeading block={block} /><form onSubmit={submit}><input type="email" aria-label="Email address" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Enter your email address" /><button type="submit" className="site-theme-button" disabled={submitting}>{submitting ? 'Please wait…' : (block.buttonText || 'Subscribe')}</button></form>{status && <p role="status" className="sc-custom-block__form-status">{status}</p>}</section>;
}

function CountdownBlock({ block, style, action }) {
  const [remaining, setRemaining] = useState(() => countdownParts(block.endsAt));
  useEffectSafeInterval(() => setRemaining(countdownParts(block.endsAt)), 1000, block.endsAt);
  return <section className="sc-custom-block sc-custom-block--countdown" style={style} data-custom-block={block.id}><BlockHeading block={block} /><div className="sc-custom-block__countdown">{remaining ? Object.entries(remaining).map(([label, value]) => <span key={label}><strong>{String(value).padStart(2, '0')}</strong><small>{label}</small></span>) : <p>Campaign has ended</p>}</div>{action}</section>;
}

function CouponBlock({ block, style, action }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(block.couponCode); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { setCopied(false); }
  };
  return <section className="sc-custom-block sc-custom-block--coupon" style={style} data-custom-block={block.id}><BlockHeading block={block} /><button type="button" className="sc-custom-block__coupon-code" onClick={copy}><span>{block.couponCode}</span><Copy size={17} />{copied && <small>Copied</small>}</button>{action}</section>;
}

function countdownParts(value) {
  const total = new Date(value).getTime() - Date.now();
  if (!Number.isFinite(total) || total <= 0) return null;
  return { days: Math.floor(total / 86400000), hours: Math.floor(total / 3600000) % 24, minutes: Math.floor(total / 60000) % 60, seconds: Math.floor(total / 1000) % 60 };
}

function useEffectSafeInterval(callback, delay, dependency) {
  const latest = useRef(callback); latest.current = callback;
  useEffect(() => { const timer = window.setInterval(() => latest.current(), delay); return () => window.clearInterval(timer); }, [delay, dependency]);
}

function BlockHeading({ block }) {
  return <div className="sc-custom-block__heading">{block.eyebrow && <span>{block.eyebrow}</span>}{block.title && <h2>{block.title}</h2>}{block.body && <p>{block.body}</p>}</div>;
}
