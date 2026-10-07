import { onColor, rgbChannels } from './themeTokens';

export const HOME_SECTION_DEFAULTS = [
  { id: 'hero', label: 'Hero Section', visible: true, order: 10, heading: 'Where Tradition Meets Modern Grace', description: 'Premium ethnic wear for every celebration.', buttonText: 'Shop New Arrivals', buttonLink: '/products?newArrival=true', image: '', backgroundImage: '' },
  { id: 'services', label: 'Service Highlights', visible: true, order: 15, heading: 'Why Shop With Us', description: 'Shipping, returns and secure payment benefits.', buttonText: '', buttonLink: '', image: '', backgroundImage: '' },
  { id: 'categories', label: 'Featured Categories', visible: true, order: 20, heading: 'Shop by Category', description: 'Curated styles for every occasion.', buttonText: '', buttonLink: '', image: '', backgroundImage: '' },
  { id: 'promotional', label: 'Promotional Banners', visible: true, order: 30, heading: 'Featured Collections', description: '', buttonText: 'Shop Now', buttonLink: '/products', image: '', backgroundImage: '' },
  { id: 'featured', label: 'Featured Products', visible: true, order: 40, heading: 'Featured Products', description: 'A curated edit from the collection.', buttonText: 'View All', buttonLink: '/products?featured=true', image: '', backgroundImage: '' },
  { id: 'newArrivals', label: 'New Arrivals', visible: true, order: 50, heading: 'New Arrivals', description: 'Fresh styles added to the collection.', buttonText: 'View All', buttonLink: '/products?newArrival=true', image: '', backgroundImage: '' },
  { id: 'bestSellers', label: 'Best Sellers', visible: true, order: 60, heading: 'Best Sellers', description: 'Customer favourites from Jassi General Store.', buttonText: 'View All', buttonLink: '/products?bestSeller=true', image: '', backgroundImage: '' },
  { id: 'ethnicSets', label: 'Ethnic Sets', visible: true, order: 64, heading: 'Complete Occasion-Ready Looks', description: 'Coordinated silhouettes for weddings, celebrations, and everyday elegance.', buttonText: 'View All', buttonLink: '/products?search=Set', image: '', backgroundImage: '' },
  { id: 'accessories', label: 'Accessories', visible: true, order: 66, heading: 'The Finishing Touch', description: 'Complete every look with thoughtfully selected accessories.', buttonText: 'View All', buttonLink: '/products?search=Accessory', image: '', backgroundImage: '' },
  { id: 'trending', label: 'Trending Products', visible: true, order: 70, heading: 'Trending Now', description: 'Styles customers are discovering now.', buttonText: 'View All', buttonLink: '/products?trending=true', image: '', backgroundImage: '' },
  { id: 'sale', label: 'Sale Banner', visible: true, order: 80, heading: 'Season Sale', description: 'Discover current offers across the collection.', buttonText: 'View Offers', buttonLink: '/products?discount=20', image: '', backgroundImage: '' },
  { id: 'reviews', label: 'Customer Reviews', visible: true, order: 90, heading: 'Loved by Our Customers', description: 'Real stories from the Jassi community.', buttonText: '', buttonLink: '', image: '', backgroundImage: '' },
  { id: 'newsletter', label: 'Newsletter', visible: true, order: 100, heading: 'Join Jassi Circle', description: 'Get early access to new drops, offers, and styling updates.', buttonText: 'Subscribe', buttonLink: '', image: '', backgroundImage: '' },
  { id: 'instagram', label: 'Instagram / Social', visible: true, order: 110, heading: 'Style Inspiration', description: 'Discover more from our latest collection.', buttonText: 'Explore', buttonLink: '/products', image: '', backgroundImage: '' },
].map((section) => ({ ...section, mobileImage: '', imageAlt: '', imagePosition: 'center' }));

export const DEFAULT_WEBSITE_CONFIG = {
  schemaVersion: 2,
  branding: { websiteName: 'Jassi General Store', tagline: 'Elegance for every celebration', logo: '', favicon: '' },
  colors: { primary: '#6d1f34', secondary: '#fff0f4', accent: '#b8914a', background: '#fffaf2', surface: '#ffffff', text: '#17161a', mutedText: '#6f6470' },
  header: {
    background: '#fffaf2', textColor: '#17161a', logoSize: 72, menuAlignment: 'left', sticky: true,
    announcementEnabled: true, announcementText: 'Free Shipping Above ₹999', announcementBackground: '#830b31', announcementTextColor: '#ffffff',
    announcementLink: '', announcementStartsAt: '', announcementEndsAt: '',
    menuItems: [
      { label: 'Home', path: '/' }, { label: 'Shop All', path: '/products' },
      { label: 'New Arrivals', path: '/products?newArrival=true&collection=new-arrivals' },
      { label: 'Best Sellers', path: '/products?bestSeller=true&collection=best-sellers' },
      { label: 'Featured', path: '/products?featured=true&collection=featured' },
      { label: 'Offers', path: '/products?discount=20' }, { label: 'Contact Us', path: '/contact' },
    ],
  },
  homepage: {
    sections: HOME_SECTION_DEFAULTS,
    featuredCategoryIds: [],
    categoryImages: [],
    sectionProductIds: { featured: [], newArrivals: [], bestSellers: [], trending: [], ethnicSets: [], accessories: [] },
    blocks: [],
  },
  typography: { headingFont: 'Playfair Display', bodyFont: 'Inter', headingScale: 1, bodyScale: 1, headingWeight: 700, bodyWeight: 400, buttonFont: 'Inter', buttonWeight: 700 },
  buttons: { background: '#6d1f34', textColor: '#ffffff', borderRadius: 8, style: 'solid', size: 'medium', hoverEffect: 'lift' },
  productCards: { layout: 'classic', imageRatio: '4/5', borderRadius: 12, shadow: 'soft', showTitle: true, showPrice: true, showDiscount: true, showRating: true, showWishlist: true, showAddToCart: true, quickView: false },
  footer: {
    enabled: true, background: '#4b071b', textColor: '#ffffff', logo: '', description: 'Crafted with elegance, designed for you. Premium ethnic wear for every celebration.', showContact: true, showSocialLinks: true, showNewsletter: true,
    contactEmail: '', contactPhone: '', contactAddress: '', socialLinks: { instagram: '', facebook: '', youtube: '', pinterest: '' },
    menus: {
      shopping: [{ label: 'New Arrivals', path: '/products?newArrival=true' }, { label: 'Sarees', path: '/products?search=Saree' }, { label: 'Suits', path: '/products?search=Suit' }, { label: 'Accessories', path: '/products?search=Accessory' }, { label: 'Sale', path: '/products?discount=20' }],
      policies: [{ label: 'Track Your Order', path: '/orders' }, { label: 'Returns & Refunds', path: '/returns' }, { label: 'Shipping Policy', path: '/shipping-policy' }, { label: 'Contact Us', path: '/contact' }],
      about: [{ label: 'Our Story', path: '/our-story' }, { label: 'Reviews', path: '/products?bestSeller=true' }],
    },
    copyrightText: '© Jassi General Store. All rights reserved.',
  },
  layout: { mode: 'full', maxWidth: 1520, sectionSpacing: 72, gridGap: 20, productsPerRow: { desktop: 4, tablet: 3, mobile: 2 } },
  mobile: {
    enabled: false,
    inheritThemeColors: true,
    headerBackground: '#ffffff', headerText: '#334155',
    pageBackground: '#fcfaf7', gridGap: 12, cardRadius: 14, imageRatio: 'original',
    columns: 2, useDesktopCatalog: false,
    showTitle: true, showPrice: true, showDiscount: true, showRating: true, showWishlist: true, showAddToCart: true,
    sections: ['hero', 'services', 'categories', 'sale', 'promotional', 'featured', 'trending', 'newArrivals', 'bestSellers', 'ethnicSets', 'accessories', 'recentlyViewed', 'recommended', 'instagram']
      .map((id, index) => ({ id, visible: true, order: index * 10, heading: '' })),
  },
  tablet: { enabled: false, columns: 3, gridGap: 16 },
  theme: { preset: 'default', enhancedStyles: false },
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeKnown(base, incoming) {
  if (Array.isArray(base)) return Array.isArray(incoming) ? clone(incoming) : clone(base);
  if (!base || typeof base !== 'object') {
    if (typeof base === 'boolean') return typeof incoming === 'boolean' ? incoming : base;
    if (typeof base === 'number') return typeof incoming === 'number' && Number.isFinite(incoming) ? incoming : base;
    return typeof incoming === 'string' ? incoming.slice(0, 5000) : base;
  }
  const source = incoming && typeof incoming === 'object' && !Array.isArray(incoming) ? incoming : {};
  return Object.fromEntries(Object.entries(base).map(([key, value]) => [key, mergeKnown(value, source[key])]));
}

export const WEBSITE_BLOCK_TYPES = ['hero', 'image-text', 'offer', 'trust', 'faq', 'video', 'product-grid', 'category-grid', 'category-carousel', 'reviews', 'newsletter', 'social', 'countdown', 'coupon'];
const cleanText = (value, max = 500) => String(value || '').trim().slice(0, max);
const safeInternalPath = (value) => { const path = cleanText(value, 500); return !path || (/^\/(?!\/)/.test(path) && !/[\\\s]/.test(path)) ? path : ''; };
const safeImageUrl = (value) => { const url = cleanText(value, 2000); return /^(https?:\/\/|\/(?!\/))[^\\\s]*$/i.test(url) ? url : ''; };
const safeMediaUrl = (value) => { const url = safeImageUrl(value); return /\.(mp4|webm)(?:[?#].*)?$/i.test(url) ? url : ''; };
const validOptionalColor = (value) => { const color = cleanText(value, 20); return !color || /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : ''; };
const bounded = (value, min, max, fallback) => { const number = Number(value); return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback; };
const uniqueIds = (value, max) => [...new Set((Array.isArray(value) ? value : []).map((item) => cleanText(item, 100)).filter(Boolean))].slice(0, max);

export function normalizeWebsiteBlocks(blocks) {
  const used = new Set();
  return (Array.isArray(blocks) ? blocks : []).slice(0, 24).map((input, index) => {
    const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
    let id = cleanText(source.id, 80).replace(/[^a-zA-Z0-9_-]/g, '') || `block-${index + 1}`;
    while (used.has(id)) id = `${id}-${index + 1}`;
    used.add(id);
    return {
      id, type: WEBSITE_BLOCK_TYPES.includes(source.type) ? source.type : 'image-text', visible: source.visible !== false,
      showOnDesktop: source.showOnDesktop !== false, showOnMobile: source.showOnMobile !== false,
      order: bounded(source.order, 0, 2000, 120 + index * 10), eyebrow: cleanText(source.eyebrow, 80),
      title: cleanText(source.title, 140), body: cleanText(source.body, 1200), buttonText: cleanText(source.buttonText, 80),
      buttonLink: safeInternalPath(source.buttonLink), image: safeImageUrl(source.image), mobileImage: safeImageUrl(source.mobileImage),
      altText: cleanText(source.altText, 180), videoUrl: safeMediaUrl(source.videoUrl),
      couponCode: cleanText(source.couponCode, 40).toUpperCase().replace(/[^A-Z0-9_-]/g, ''),
      endsAt: (() => { const value = cleanText(source.endsAt, 40); return value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toISOString() : ''; })(),
      alignment: ['left', 'center', 'right'].includes(source.alignment) ? source.alignment : 'left',
      imagePosition: ['top', 'center', 'bottom'].includes(source.imagePosition) ? source.imagePosition : 'center',
      backgroundColor: validOptionalColor(source.backgroundColor), textColor: validOptionalColor(source.textColor),
      productIds: uniqueIds(source.productIds, 12), categoryIds: uniqueIds(source.categoryIds, 8),
      items: (Array.isArray(source.items) ? source.items : []).slice(0, 8).map((item) => cleanText(item, 160)).filter(Boolean),
    };
  }).sort((left, right) => left.order - right.order);
}

export function mergeWebsiteConfig(config = {}) {
  const sourceVersion = Number(config?.schemaVersion || 0);
  const merged = mergeKnown(DEFAULT_WEBSITE_CONFIG, config);
  // Version 2 makes the desktop header sticky by default. Migrate published
  // version-1 themes in memory so the improvement takes effect immediately;
  // after an admin saves the v2 theme, the switch remains configurable.
  if (sourceVersion < 2) merged.header.sticky = true;
  merged.schemaVersion = 2;
  const incoming = new Map((Array.isArray(config?.homepage?.sections) ? config.homepage.sections : []).filter(Boolean).map((section) => [section.id, section]));
  merged.homepage.sections = HOME_SECTION_DEFAULTS.map((section) => {
    const next = mergeKnown(section, incoming.get(section.id));
    next.buttonLink = safeInternalPath(next.buttonLink);
    next.image = safeImageUrl(next.image);
    next.mobileImage = safeImageUrl(next.mobileImage);
    next.backgroundImage = safeImageUrl(next.backgroundImage);
    next.imageAlt = cleanText(next.imageAlt, 180);
    next.imagePosition = ['top', 'center', 'bottom'].includes(next.imagePosition) ? next.imagePosition : 'center';
    return next;
  }).sort((a, b) => Number(a.order) - Number(b.order));
  merged.homepage.blocks = normalizeWebsiteBlocks(config?.homepage?.blocks || merged.homepage.blocks);
  merged.header.menuItems = (Array.isArray(config?.header?.menuItems) ? config.header.menuItems : merged.header.menuItems)
    .slice(0, 8).map((item) => ({ label: cleanText(item?.label, 80), path: safeInternalPath(item?.path) })).filter((item) => item.label && item.path);
  merged.header.announcementLink = safeInternalPath(merged.header.announcementLink);
  for (const key of ['announcementStartsAt', 'announcementEndsAt']) {
    const value = cleanText(merged.header[key], 40);
    merged.header[key] = value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toISOString() : '';
  }
  const mobileSections = new Map((Array.isArray(config?.mobile?.sections) ? config.mobile.sections : []).filter(Boolean).map((section) => [section.id, section]));
  merged.mobile.sections = DEFAULT_WEBSITE_CONFIG.mobile.sections.map((section) => mergeKnown(section, mobileSections.get(section.id))).sort((a, b) => a.order - b.order);
  return merged;
}

export function getHomepageSection(config, id) {
  // Section rendering must not normalize/copy the entire theme for every title,
  // button and wrapper. Keep the same default/type handling for partial configs.
  const fallback = HOME_SECTION_DEFAULTS.find((section) => section.id === id);
  if (!fallback) return undefined;
  const sections = Array.isArray(config?.homepage?.sections) ? config.homepage.sections : [];
  // The last occurrence wins, matching mergeWebsiteConfig's Map semantics.
  const incoming = sections.reduce((match, section) => section?.id === id ? section : match, undefined);
  return mergeKnown(fallback, incoming);
}

const fontStacks = {
  'Playfair Display': '"Playfair Display", Georgia, serif',
  Inter: 'Inter, "Segoe UI", Arial, sans-serif',
  Figtree: 'Figtree, Inter, Arial, sans-serif',
  Georgia: 'Georgia, "Times New Roman", serif',
  Arial: 'Arial, sans-serif',
};

export function buildWebsiteCssVariables(input) {
  const config = mergeWebsiteConfig(input);
  const shadows = { none: 'none', soft: '0 8px 24px rgba(22, 14, 17, .08)', elevated: '0 16px 36px rgba(22, 14, 17, .16)' };
  const buttonSizes = { small: ['36px', '12px'], medium: ['44px', '18px'], large: ['52px', '24px'] };
  const [buttonHeight, buttonPadding] = buttonSizes[config.buttons.size] || buttonSizes.medium;
  const buttonFill = config.buttons.style === 'outline' ? 'transparent'
    : config.buttons.style === 'soft' ? config.colors.secondary : config.buttons.background;
  const buttonText = config.buttons.style === 'outline' ? config.buttons.background
    : config.buttons.style === 'soft' ? config.colors.primary : config.buttons.textColor;
  return {
    '--site-primary': config.colors.primary,
    '--site-primary-rgb': rgbChannels(config.colors.primary),
    '--site-secondary-rgb': rgbChannels(config.colors.secondary),
    '--site-accent-rgb': rgbChannels(config.colors.accent),
    '--site-background-rgb': rgbChannels(config.colors.background),
    '--site-text-rgb': rgbChannels(config.colors.text),
    '--site-on-primary': onColor(config.colors.primary),
    '--site-primary-dark': `color-mix(in srgb, ${config.colors.primary} 82%, black)`,
    '--site-border': `color-mix(in srgb, ${config.colors.text} 16%, ${config.colors.surface})`,
    '--site-skeleton': `color-mix(in srgb, ${config.colors.primary} 10%, ${config.colors.surface})`,
    '--site-loader': config.colors.primary,
    '--site-loader-track': `color-mix(in srgb, ${config.colors.primary} 18%, transparent)`,
    '--site-secondary': config.colors.secondary,
    '--site-accent': config.colors.accent,
    '--site-background': config.colors.background,
    '--site-surface': config.colors.surface,
    '--site-text': config.colors.text,
    '--site-muted': config.colors.mutedText,
    '--site-header-background': config.header.background,
    '--site-header-text': config.header.textColor,
    '--site-heading-font': fontStacks[config.typography.headingFont] || fontStacks['Playfair Display'],
    '--site-body-font': fontStacks[config.typography.bodyFont] || fontStacks.Inter,
    '--site-button-font': fontStacks[config.typography.buttonFont] || fontStacks.Inter,
    '--site-heading-scale': config.typography.headingScale,
    '--designer-heading-scale': config.theme.enhancedStyles ? config.typography.headingScale : 1,
    '--designer-body-scale': config.theme.enhancedStyles ? config.typography.bodyScale : 1,
    '--site-body-scale': config.typography.bodyScale,
    '--site-heading-weight': config.typography.headingWeight,
    '--site-body-weight': config.typography.bodyWeight,
    '--site-button-weight': config.typography.buttonWeight,
    '--site-button-bg': config.buttons.background,
    '--site-button-text': config.buttons.textColor,
    '--site-action-bg': buttonFill,
    '--site-action-text': buttonText,
    '--site-action-border': config.buttons.style === 'outline' ? config.buttons.background : buttonFill,
    '--site-button-hover-transform': config.buttons.hoverEffect === 'lift' ? 'translateY(-2px)' : 'none',
    '--site-button-hover-filter': config.buttons.hoverEffect === 'darken' ? 'brightness(.88)' : 'none',
    '--site-button-hover-shadow': config.buttons.hoverEffect === 'glow' ? '0 0 0 4px color-mix(in srgb, var(--site-accent) 24%, transparent)' : 'none',
    '--site-button-radius': `${config.buttons.borderRadius}px`,
    '--site-button-height': buttonHeight,
    '--site-button-padding': buttonPadding,
    '--site-content-max': `${config.layout.maxWidth}px`,
    '--site-section-spacing': `${config.layout.sectionSpacing}px`,
    '--site-grid-gap': `${config.layout.gridGap}px`,
    '--designer-grid-gap': config.theme.enhancedStyles ? `${config.layout.gridGap}px` : undefined,
    '--site-card-radius': `${config.productCards.borderRadius}px`,
    '--site-card-ratio': config.productCards.imageRatio,
    '--site-card-shadow': shadows[config.productCards.shadow] || shadows.soft,
    '--site-products-desktop': config.layout.productsPerRow.desktop,
    '--site-products-tablet': config.layout.productsPerRow.tablet,
    '--site-products-mobile': config.layout.productsPerRow.mobile,
    '--site-mobile-bg': config.mobile.inheritThemeColors ? config.colors.background : config.mobile.pageBackground,
    '--site-mobile-header-bg': config.mobile.inheritThemeColors ? config.header.background : config.mobile.headerBackground,
    '--site-mobile-header-text': config.mobile.inheritThemeColors ? config.header.textColor : config.mobile.headerText,
    '--site-mobile-gap': `${config.mobile.gridGap}px`,
    '--site-mobile-radius': `${config.mobile.cardRadius}px`,
    '--site-mobile-ratio': config.mobile.imageRatio === 'original' ? undefined : config.mobile.imageRatio,
    '--site-mobile-columns': config.mobile.columns,
    '--site-tablet-columns': config.tablet.columns,
    '--site-tablet-gap': `${config.tablet.gridGap}px`,
  };
}
