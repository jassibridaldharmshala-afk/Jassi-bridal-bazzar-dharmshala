// Editor-only helpers. These shortcuts use existing theme fields so exports,
// version restore and the storefront need no new runtime or dependencies.
import { setDesignerValue } from './websiteDesignerState';

export const DESIGNER_CONTROLS = [
  { id: 'presets', label: 'Presets', keywords: 'premium collection palette style gallery' },
  { id: 'quick', label: 'Quick styling', keywords: 'brand color font pairs spacing density mobile match contrast readability' },
  { id: 'branding', label: 'Branding', keywords: 'logo favicon website name tagline identity' },
  { id: 'colors', label: 'Colors', keywords: 'primary secondary accent background surface text palette' },
  { id: 'header', label: 'Desktop header', keywords: 'announcement banner sticky navigation logo size' },
  { id: 'homepage', label: 'Desktop home', keywords: 'hero image products categories collections section order hide show newsletter' },
  { id: 'blocks', label: 'Content blocks', keywords: 'custom image text offer faq video products categories trust reviews newsletter social reusable section' },
  { id: 'typography', label: 'Typography', keywords: 'font heading body size weight text' },
  { id: 'buttons', label: 'Buttons', keywords: 'hover corners rounded radius style size' },
  { id: 'cards', label: 'Desktop cards', keywords: 'product image ratio title price rating discount wishlist cart shadow' },
  { id: 'footer', label: 'Footer', keywords: 'contact social instagram facebook menu links email phone copyright' },
  { id: 'layout', label: 'Desktop layout', keywords: 'width columns spacing gap grid boxed' },
  { id: 'mobile', label: 'Mobile', keywords: 'phone header background home sections products columns' },
  { id: 'tablet', label: 'Tablet', keywords: 'ipad products columns gap grid' },
];

export const FONT_PAIRS = [
  { id: 'editorial', name: 'Editorial elegance', note: 'Playfair Display + Inter', heading: 'Playfair Display', body: 'Inter', weight: 600 },
  { id: 'modern', name: 'Modern boutique', note: 'Inter + Figtree', heading: 'Inter', body: 'Figtree', weight: 600 },
  { id: 'heritage', name: 'Timeless heritage', note: 'Georgia + Arial', heading: 'Georgia', body: 'Arial', weight: 400 },
];
export const LAYOUT_STYLES = [
  { id: 'compact', name: 'Compact', note: 'More products, less scrolling', spacing: 36, gap: 16, columns: 5, width: 1520 },
  { id: 'balanced', name: 'Balanced', note: 'Comfortable everyday browsing', spacing: 56, gap: 20, columns: 4, width: 1440 },
  { id: 'editorial', name: 'Editorial', note: 'Larger product photography', spacing: 80, gap: 28, columns: 3, width: 1360 },
];

export function searchDesignerControls(query) {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return terms.length ? DESIGNER_CONTROLS.filter((item) => terms.every((term) => `${item.label} ${item.keywords}`.toLowerCase().includes(term))) : [];
}

export function reorderDesignerItems(items, index, direction) {
  const target = index + direction;
  if (![-1, 1].includes(direction) || !Number.isInteger(index) || index < 0 || index >= items.length || target < 0 || target >= items.length) return items;
  const next = items.slice();
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

const colorPattern = /^#[0-9a-f]{6}$/i;
export function contrastRatio(foreground, background) {
  if (!colorPattern.test(foreground) || !colorPattern.test(background)) return null;
  const luminance = (color) => {
    const channels = color.slice(1).match(/../g).map((hex) => {
      const value = parseInt(hex, 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const a = luminance(foreground); const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function readableText(backgrounds) {
  const list = Array.isArray(backgrounds) ? backgrounds : [backgrounds];
  const score = (text) => Math.min(...list.map((bg) => contrastRatio(text, bg) || 0));
  return score('#17161a') >= score('#ffffff') ? '#17161a' : '#ffffff';
}

export function themeReadability(config) {
  const { colors, header, buttons, footer, mobile } = config;
  const pairs = [
    ['Main text', ['colors', 'text'], colors.text, [colors.background, colors.surface], 'colors'],
    ['Muted text', ['colors', 'mutedText'], colors.mutedText, [colors.background, colors.surface], 'colors'],
    ['Header text', ['header', 'textColor'], header.textColor, [header.background], 'header'],
    ['Navigation accents', null, colors.primary, [header.background], 'colors'],
  ];
  if (buttons.style === 'solid') pairs.push(['Button text', ['buttons', 'textColor'], buttons.textColor, [buttons.background], 'buttons']);
  else if (buttons.style === 'soft') pairs.push(['Soft buttons', null, colors.primary, [colors.secondary], 'buttons']);
  else pairs.push(['Outline buttons', null, buttons.background, [colors.background, colors.surface], 'buttons']);
  if (header.announcementEnabled) pairs.push(['Announcement text', ['header', 'announcementTextColor'], header.announcementTextColor, [header.announcementBackground], 'header']);
  if (footer.enabled) pairs.push(['Footer text', ['footer', 'textColor'], footer.textColor, [footer.background], 'footer']);
  if (mobile.enabled) pairs.push(['Mobile header icons', ['mobile', 'headerText'], mobile.headerText, [mobile.headerBackground], 'mobile']);
  return pairs.map(([label, path, text, backgrounds, tab]) => {
    const ratios = backgrounds.map((bg) => contrastRatio(text, bg));
    const ratio = ratios.some((value) => value === null) ? null : Math.min(...ratios);
    const suggestion = readableText(backgrounds);
    return { label, path, tab, ratio, needsAttention: ratio === null || ratio < 4.5,
      suggestedText: path && backgrounds.every((bg) => (contrastRatio(suggestion, bg) || 0) >= 4.5) ? suggestion : null };
  });
}

export function improveThemeReadability(config) {
  return themeReadability(config).reduce((next, item) => item.needsAttention && item.suggestedText
    ? setDesignerValue(next, item.path, item.suggestedText) : next, config);
}

export function matchMobileAppearance(config) {
  return { ...config, mobile: { ...config.mobile, enabled: true, inheritThemeColors: true,
    headerBackground: config.header.background, headerText: config.header.textColor,
    pageBackground: config.colors.background, cardRadius: Math.min(24, config.productCards.borderRadius) } };
}

export function applyBrandColor(config, color) {
  if (!colorPattern.test(color)) return config;
  const text = readableText(color);
  return { ...config, colors: { ...config.colors, primary: color },
    buttons: { ...config.buttons, background: color, textColor: text },
    header: { ...config.header, announcementBackground: color, announcementTextColor: text },
    footer: { ...config.footer, background: color, textColor: text },
    theme: { ...config.theme, enhancedStyles: true } };
}

export function applyFontPair(config, id) {
  const pair = FONT_PAIRS.find((item) => item.id === id);
  return pair ? { ...config, typography: { ...config.typography, headingFont: pair.heading,
    headingWeight: pair.weight, bodyFont: pair.body, buttonFont: pair.body }, theme: { ...config.theme, enhancedStyles: true } } : config;
}

export function applyLayoutStyle(config, id) {
  const layout = LAYOUT_STYLES.find((item) => item.id === id);
  return layout ? { ...config, layout: { ...config.layout, sectionSpacing: layout.spacing, gridGap: layout.gap,
    maxWidth: layout.width, productsPerRow: { ...config.layout.productsPerRow, desktop: layout.columns } },
  theme: { ...config.theme, enhancedStyles: true } } : config;
}

export function restoreDesignerPanel(config, saved, tab) {
  if (tab === 'blocks') return setDesignerValue(config, ['homepage', 'blocks'], saved.homepage?.blocks || []);
  const group = tab === 'cards' ? 'productCards' : tab;
  if (!['branding', 'colors', 'header', 'homepage', 'typography', 'buttons', 'productCards', 'footer', 'layout', 'mobile', 'tablet'].includes(group)) return config;
  return setDesignerValue(config, [group], saved[group]);
}
