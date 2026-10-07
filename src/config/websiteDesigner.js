import { mergeWebsiteConfig } from './websiteCustomization';

export const PREVIEW_PATH = '/website-preview';
export const PREVIEW_PAGES = [
  { path: '/', label: 'Home' }, { path: '/products', label: 'Product listing' },
  { path: '/product-preview', label: 'Product detail' }, { path: '/wishlist', label: 'Wishlist' },
  { path: '/cart', label: 'Shopping bag' }, { path: '/checkout', label: 'Checkout' },
  { path: '/payment-preview', label: 'Payment' },
  { path: '/addresses', label: 'Addresses' }, { path: '/orders', label: 'Orders' },
  { path: '/order-preview', label: 'Order detail' }, { path: '/returns', label: 'Returns' },
  { path: '/notifications', label: 'Notifications' }, { path: '/contact', label: 'Contact' },
  { path: '/empty-preview', label: 'Empty state' }, { path: '/error-preview', label: 'Error state' },
];
export const isWebsitePreview = () => typeof window !== 'undefined' && window.location.pathname === PREVIEW_PATH;

// Presets only replace appearance. Store identity, content, selected products,
// contact information, navigation and mobile layout stay with the store.
export function applyAppearancePreset(current, preset) {
  const base = mergeWebsiteConfig(current);
  const look = mergeWebsiteConfig(preset);
  return mergeWebsiteConfig({
    ...base,
    colors: look.colors, typography: look.typography, buttons: look.buttons,
    productCards: look.productCards, theme: { ...look.theme, enhancedStyles: true },
    mobile: { ...base.mobile, inheritThemeColors: true },
    header: { ...base.header, background: look.header.background, textColor: look.header.textColor,
      announcementBackground: look.header.announcementBackground, announcementTextColor: look.header.announcementTextColor },
    footer: { ...base.footer, background: look.footer.background, textColor: look.footer.textColor },
  });
}

export function changedConfigGroups(current, saved) {
  const before = mergeWebsiteConfig(saved);
  return Object.keys(mergeWebsiteConfig(current)).filter((key) =>
    key !== 'schemaVersion' && JSON.stringify(current[key]) !== JSON.stringify(before[key]));
}

export function validateDesignerConfig(input) {
  const config = mergeWebsiteConfig(input);
  const issues = [];
  const validId = (id) => typeof id === 'string' && !!id.trim() && id.length <= 100;
  if (config.homepage.featuredCategoryIds.length > 8 || !config.homepage.featuredCategoryIds.every(validId)) {
    issues.push('Featured categories: choose at most 8 valid catalog IDs.');
  }
  Object.entries(config.homepage.sectionProductIds).forEach(([id, ids]) => {
    if (ids.length > 12 || !ids.every(validId)) issues.push(`${id}: choose at most 12 valid product IDs.`);
  });
  if (config.homepage.categoryImages.length > 50 || config.homepage.categoryImages.some((item) =>
    !item || !validId(item.categoryId) || typeof item.image !== 'string')) {
    issues.push('Category image overrides must contain at most 50 valid category IDs and image URLs.');
  }
  const color = /^#[0-9a-f]{6}$/i;
  Object.entries(config.colors).forEach(([key, value]) => {
    if (!color.test(value)) issues.push(`Colors: ${key} must be a six-digit hex color.`);
  });
  [['header', ['background', 'textColor', 'announcementBackground', 'announcementTextColor']],
    ['buttons', ['background', 'textColor']], ['footer', ['background', 'textColor']],
    ['mobile', ['headerBackground', 'headerText', 'pageBackground']]].forEach(([group, keys]) => {
    keys.forEach((key) => { if (!color.test(config[group][key])) issues.push(`${group}: ${key} must be a six-digit hex color.`); });
  });
  if (!config.branding.websiteName.trim()) issues.push('Enter a website name.');
  const safePath = (path) => !path || (/^\/(?!\/)/.test(path) && !/[\\\s]/.test(path));
  config.homepage.sections.forEach((section) => {
    if (!safePath(section.buttonLink)) issues.push(`${section.label}: use an internal link such as /products.`);
    if ((section.image || section.mobileImage) && !section.imageAlt.trim()) issues.push(`${section.label}: add image alt text.`);
  });
  if (config.header.menuItems.length > 8) issues.push('Header: use at most 8 navigation links.');
  config.header.menuItems.forEach((item) => {
    if (!item.label || !safePath(item.path)) issues.push('Header: each navigation item needs a label and valid internal path.');
  });
  if (!safePath(config.header.announcementLink)) issues.push('Header: announcement link must be an internal store path.');
  if (config.header.announcementStartsAt && config.header.announcementEndsAt && new Date(config.header.announcementStartsAt) >= new Date(config.header.announcementEndsAt)) {
    issues.push('Header: announcement end time must be after its start time.');
  }
  if (config.homepage.blocks.length > 24) issues.push('Custom blocks: use at most 24 blocks.');
  config.homepage.blocks.forEach((block, index) => {
    const name = block.title || `Block ${index + 1}`;
    if (!safePath(block.buttonLink)) issues.push(`${name}: use a valid internal button link.`);
    if (block.visible && (block.image || block.mobileImage) && !block.altText.trim()) issues.push(`${name}: add image alt text.`);
    if (block.visible && block.type === 'video' && !block.videoUrl) issues.push(`${name}: add a hosted MP4 or WEBM video URL.`);
    if (block.visible && block.type === 'countdown' && (!block.endsAt || new Date(block.endsAt).getTime() <= Date.now())) issues.push(`${name}: choose a future countdown end time.`);
    if (block.visible && block.type === 'coupon' && !block.couponCode) issues.push(`${name}: add a coupon code.`);
    if (block.visible && !block.title && !block.body && !block.image && !block.videoUrl && !block.productIds.length && !block.categoryIds.length && !block.items.length) issues.push(`${name}: add content or hide the empty block.`);
  });
  Object.entries(config.footer.menus).forEach(([group, items]) => {
    if (items.length > 20) issues.push(`${group}: use at most 20 menu links.`);
    items.forEach((item) => {
      if (typeof item?.label !== 'string' || !item.label.trim() || typeof item?.path !== 'string' || !item.path || !safePath(item.path)) issues.push(`${group}: each link needs a label and a valid internal path.`);
    });
  });
  Object.values(config.footer.socialLinks).forEach((url) => {
    if (url && !/^https:\/\/[^\s]+$/i.test(url)) issues.push('Social links must start with https://.');
  });
  const images = [config.branding.logo, config.branding.favicon, config.footer.logo,
    ...config.homepage.sections.flatMap((section) => [section.image, section.mobileImage, section.backgroundImage]),
    ...config.homepage.categoryImages.map((item) => item?.image)];
  images.forEach((url) => {
    if (url && !/^(https?:\/\/|\/(?!\/))[^\\\s]*$/i.test(url)) issues.push('Images must use an uploaded image path or an HTTP(S) URL.');
  });
  const bounds = [
    ['header.logoSize', 36, 140], ['typography.headingScale', .75, 1.5], ['typography.bodyScale', .8, 1.3],
    ['typography.headingWeight', 400, 900], ['typography.bodyWeight', 300, 700], ['typography.buttonWeight', 400, 900],
    ['buttons.borderRadius', 0, 999], ['productCards.borderRadius', 0, 32], ['layout.maxWidth', 960, 1920],
    ['layout.sectionSpacing', 16, 160], ['layout.gridGap', 4, 64], ['layout.productsPerRow.desktop', 2, 6],
    ['mobile.columns', 1, 2], ['mobile.gridGap', 8, 24], ['mobile.cardRadius', 0, 24],
    ['tablet.columns', 2, 4], ['tablet.gridGap', 8, 32],
  ];
  bounds.forEach(([path, min, max]) => {
    const value = path.split('.').reduce((item, key) => item?.[key], config);
    if (!Number.isFinite(value) || value < min || value > max || (/columns|productsPerRow/.test(path) && !Number.isInteger(value))) {
      issues.push(`${path}: choose a value from ${min} to ${max}.`);
    }
  });
  const choices = {
    'header.menuAlignment': ['left', 'center', 'right'],
    'typography.headingFont': ['Playfair Display', 'Inter', 'Georgia', 'Arial'],
    'typography.bodyFont': ['Inter', 'Figtree', 'Georgia', 'Arial'],
    'typography.buttonFont': ['Inter', 'Figtree', 'Georgia', 'Arial'],
    'buttons.style': ['solid', 'outline', 'soft'], 'buttons.size': ['small', 'medium', 'large'],
    'buttons.hoverEffect': ['none', 'lift', 'darken', 'glow'],
    'productCards.imageRatio': ['1/1', '4/5', '3/4'], 'productCards.layout': ['classic', 'minimal', 'compact'],
    'productCards.shadow': ['none', 'soft', 'elevated'], 'layout.mode': ['full', 'boxed'],
    'mobile.imageRatio': ['original', '1/1', '4/5', '3/4'],
  };
  Object.entries(choices).forEach(([path, allowed]) => {
    if (!allowed.includes(path.split('.').reduce((item, key) => item?.[key], config))) issues.push(`${path}: choose a supported option.`);
  });
  return [...new Set(issues)];
}

export function parseThemeFile(text) {
  if (text.length > 512000) throw new Error('Theme files must be smaller than 500 KB.');
  const data = JSON.parse(text);
  if (data?.format !== 'samira-website-theme' || data.version !== 1 || !data.config || typeof data.config !== 'object' || Array.isArray(data.config)) {
    throw new Error('Choose a theme JSON file exported from Website Designer.');
  }
  const config = mergeWebsiteConfig(data.config);
  const issues = validateDesignerConfig(config);
  if (issues.length) throw new Error(issues[0]);
  return config;
}

export function exportThemeFile(config, name) {
  return JSON.stringify({ format: 'samira-website-theme', version: 1, name, config: mergeWebsiteConfig(config) }, null, 2);
}

export function websiteDataAttributes(config) {
  return {
    'data-desktop-enhanced': config.theme.enhancedStyles,
    'data-layout': config.layout.mode, 'data-button-style': config.buttons.style,
    'data-button-hover': config.buttons.hoverEffect, 'data-card-layout': config.productCards.layout,
    ...Object.fromEntries([['title', 'showTitle'], ['price', 'showPrice'], ['discount', 'showDiscount'],
      ['rating', 'showRating'], ['wishlist', 'showWishlist'], ['cart', 'showAddToCart'], ['quick', 'quickView']]
      .map(([attribute, key]) => [`data-card-${attribute}`, config.productCards[key]])),
    'data-mobile-custom': config.mobile.enabled, 'data-tablet-custom': config.tablet.enabled,
    ...Object.fromEntries([['title', 'showTitle'], ['price', 'showPrice'], ['discount', 'showDiscount'],
      ['rating', 'showRating'], ['wishlist', 'showWishlist'], ['cart', 'showAddToCart']]
      .map(([attribute, key]) => [`data-mobile-card-${attribute}`, config.mobile[key]])),
  };
}
