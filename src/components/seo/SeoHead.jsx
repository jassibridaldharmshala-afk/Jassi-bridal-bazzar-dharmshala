import { useEffect } from 'react';
import { useStorefront } from '../../context/StorefrontContext';

const DEFAULT_TITLE = 'Jassi General Store';
const DEFAULT_DESCRIPTION = 'Ethnic wear, festive styles and everyday luxury from Jassi General Store.';

function upsertMeta(attr, key, content) {
  if (!content) return;
  let tag = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

export default function SeoHead({ route = '', product, page } = {}) {
  const { store } = useStorefront();
  const path = String(route).split('?')[0];

  useEffect(() => {
    const storeName = store?.name || DEFAULT_TITLE;
    let title = storeName;
    let description = store?.bio || DEFAULT_DESCRIPTION;

    if (product?.name) {
      title = product.metaTitle || `${product.name} | ${storeName}`;
      description = product.metaDescription || product.shortDescription || product.description || description;
    } else if (page?.title) {
      title = `${page.title} | ${storeName}`;
      description = page.description || description;
    } else if (path.startsWith('/products')) title = `Shop | ${storeName}`;
    else if (path.startsWith('/cart')) title = `Bag | ${storeName}`;
    else if (path.startsWith('/checkout')) title = `Checkout | ${storeName}`;
    else if (path.startsWith('/contact')) title = `Contact | ${storeName}`;
    else if (path.startsWith('/store/')) title = storeName;

    document.title = title;
    upsertMeta('name', 'description', String(description).slice(0, 180));
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', String(description).slice(0, 180));
    upsertMeta('property', 'og:type', product ? 'product' : 'website');
    upsertMeta('name', 'twitter:card', product ? 'summary_large_image' : 'summary');
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', String(description).slice(0, 180));
    const image = product?.images?.find((item) => item.primary)?.url || product?.images?.[0]?.url || page?.image || store?.logo;
    if (image) {
      upsertMeta('property', 'og:image', image);
      upsertMeta('name', 'twitter:image', image);
    }
    const canonical = `${window.location.origin}${window.location.pathname}${window.location.search || ''}` || `${window.location.origin}/`;
    let link = document.head.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', canonical);

    const existing = document.getElementById('samira-jsonld');
    if (existing) existing.remove();
    if (product?.name) {
      const script = document.createElement('script');
      script.id = 'samira-jsonld';
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        description,
        sku: product.sku,
        image: product.images?.[0]?.url,
        offers: {
          '@type': 'Offer',
          priceCurrency: 'INR',
          price: product.price,
          availability: Number(product.stock) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        },
      });
      document.head.appendChild(script);
    }
  }, [page, path, product, store]);

  return null;
}
