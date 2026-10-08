const CATEGORY_RULES = {
  saree: {
    productType: 'Saree',
    name: ({ color, work, fabric }) => joinParts([color, work, fabric, 'Saree']),
    description: ({ color, fabric, occasion, style, categoryName }) => [
      `This ${color} ${fabric} ${categoryName || 'saree'} is designed for ${occasion} styling.`,
      `It balances elegant appeal with comfortable wear for long festive days and special occasions.`,
      `Style it with traditional accessories for a polished ${style} look and confident fit.`,
      `The silhouette is easy to drape and suitable for a refined everyday or occasion wardrobe.`,
    ],
  },
  suit: {
    productType: 'Suit',
    name: ({ color, work, fabric }) => joinParts([color, work, fabric, 'Suit Set']),
    description: ({ color, fabric, occasion, style, categoryName }) => [
      `This ${color} ${fabric} ${categoryName || 'suit set'} is crafted for ${occasion} wear.`,
      `The design offers a graceful balance of comfort, structure, and seasonal styling.`,
      `Pair it with statement jewelry or minimal accessories for a versatile ${style} look.`,
      `The fit is tailored to feel comfortable while maintaining a clean and elegant finish.`,
    ],
  },
  kurti: {
    productType: 'Kurti',
    name: ({ color, fabric, style }) => joinParts([color, fabric, style, 'Kurti']),
    description: ({ color, fabric, occasion, style, categoryName }) => [
      `This ${color} ${fabric} ${categoryName || 'kurti'} is made for ${occasion} dressing.`,
      `It brings together comfort, easy styling, and a refined everyday silhouette.`,
      `The ${style} finish makes it easy to dress up or keep simple for daily wear.`,
      `A comfortable fit keeps the piece practical while still feeling polished.`,
    ],
  },
  lehenga: {
    productType: 'Lehenga',
    name: ({ color, work }) => joinParts([color, work, 'Lehenga Set']),
    description: ({ color, fabric, occasion, style, fit, categoryName }) => [
      `This ${color} ${fabric} ${categoryName || 'lehenga set'} is created for ${occasion} celebrations.`,
      `It offers a premium look with elegant styling and festive presence.`,
      `The design is suitable for wedding and party occasions with a flattering ${fit} feel.`,
      `Complete the outfit with ethnic accessories for a classic ${style} look.`,
    ],
  },
  gown: {
    productType: 'Gown',
    name: ({ color, fabric }) => joinParts([color, fabric, 'Party Wear Gown']),
    description: ({ color, fabric, occasion, style, fit }) => [
      `This ${color} ${fabric} gown is designed for ${occasion} occasions.`,
      `It delivers a graceful party-ready look with comfortable movement and a polished finish.`,
      `The style works well for celebrations, evening events, and standout occasion wear.`,
      `The fit is balanced for both comfort and a flattering silhouette.`,
    ],
  },
  dress: {
    productType: 'Dress',
    name: ({ color, style }) => joinParts([color, style, 'Dress']),
    description: ({ color, fabric, occasion, style, fit }) => [
      `This ${color} ${fabric} dress is ideal for ${occasion} styling.`,
      `It combines an easy-wear silhouette with a refined finish for modern wardrobes.`,
      `The ${style} look keeps it versatile for casual and dressy moments alike.`,
      `The fit is designed to feel comfortable while maintaining a clean shape.`,
    ],
  },
};

const DEFAULT_FIELD_ORDER = [
  'name',
  'slug',
  'sku',
  'shortDescription',
  'description',
  'category',
  'subCategory',
  'occasion',
  'fabric',
  'sizes',
  'colors',
  'tags',
  'highlights',
  'careInstructions',
  'returnPolicy',
  'metaTitle',
  'metaKeywords',
  'metaDescription',
  'caption',
  'flags',
];

export function buildAssistantSuggestions(input = {}) {
  const categoryName = normalizeText(input.categoryName || input.category || input.type || '');
  const productType = normalizeProductType(categoryName);
  const rule = CATEGORY_RULES[productType] || { productType: categoryName || 'Product', name: ({ color, work, fabric, categoryName: label }) => joinParts([color, work, fabric, label || categoryName || 'Product']) };
  const mainColor = normalizeText(input.color || input.mainColor || '');
  const secondaryColors = normalizeList(input.secondaryColors || input.secondaryColor || '');
  const fabric = normalizeText(input.fabric || '');
  const occasion = normalizeText(input.occasion || '');
  const style = normalizeText(input.style || input.type || '');
  const work = normalizeText(input.workPattern || input.work || '');
  const fit = normalizeText(input.fit || '');
  const usesSelectableSizes = input.sizingEnabled !== false && productType !== 'saree';
  const sizeRange = usesSelectableSizes ? normalizeText(input.sizeRange || input.sizes || '') : '';
  const priceSegment = normalizeText(input.priceSegment || '');
  const targetCustomer = normalizeText(input.targetCustomer || '');
  const subCategory = normalizeText(input.subCategory || '');
  const categoryLabel = normalizeText(input.categoryLabel || categoryName || rule.productType);
  const productName = dedupeSpaces((rule.name({ color: mainColor, work, fabric, style, categoryName: categoryLabel }) || 'Product').trim());
  const slug = generateSlug(productName);
  const sku = generateSku({ categoryName: categoryLabel, color: mainColor, fabric, work, productType });
  const shortDescription = generateShortDescription({
    color: mainColor,
    fabric,
    occasion,
    style,
    categoryName: categoryLabel,
  });
  const description = generateFullDescription({
    color: mainColor,
    fabric,
    occasion,
    style,
    fit,
    categoryName: categoryLabel,
    productType,
  });
  const sizes = usesSelectableSizes ? generateSizes(sizeRange) : [];
  const colors = generateColors(mainColor, secondaryColors);
  const tags = generateTags({
    categoryName: categoryLabel,
    productType,
    color: mainColor,
    secondaryColors,
    fabric,
    occasion,
    work,
    style,
    priceSegment,
    targetCustomer,
  });
  const highlights = generateHighlights({
    fabric,
    color: mainColor,
    occasion,
    work,
    style,
    fit,
    sizeRange,
  });
  const careInstructions = normalizeText(input.careInstructions || '');
  const seo = generateSeo({
    productName,
    categoryName: categoryLabel,
    occasion,
    fabric,
    color: mainColor,
    work,
    style,
    secondaryColors,
  });
  const caption = generateCaption({
    productName,
    categoryName: categoryLabel,
    occasion,
    sizes,
    color: mainColor,
    fabric,
    work,
    style,
  });
  const flags = generateFlagSuggestions({
    occasion,
    priceSegment,
    productType,
    isNewProduct: !input.productId,
  });

  return {
    category: input.categoryId || input.category || '',
    categoryName: categoryLabel,
    subCategory: subCategory || '',
    productType,
    mainColor,
    secondaryColors,
    fabric,
    occasion,
    style,
    work,
    fit,
    sizeRange,
    priceSegment,
    targetCustomer,
    productName,
    slug,
    sku,
    shortDescription,
    description,
    sizes,
    colors,
    tags,
    highlights,
    careInstructions,
    returnPolicy: normalizeText(input.returnPolicy || ''),
    seo,
    caption,
    flags,
    fieldOrder: DEFAULT_FIELD_ORDER,
  };
}

export function generateProductName(input = {}) {
  return buildAssistantSuggestions(input).productName;
}

export function generateSlug(name) {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function generateSku(input = {}) {
  const category = abbreviate(input.productType || input.categoryName || input.category || 'PRD', 4);
  const color = abbreviate(input.color || input.mainColor || 'COL', 3);
  const fabric = abbreviate(input.fabric || 'FAB', 3);
  const work = abbreviate(input.work || input.workPattern || '001', 3);
  return `SC-${category}-${color}-${fabric}-${work}`.toUpperCase();
}

export function generateShortDescription(input = {}) {
  const name = joinParts([input.color, input.fabric, input.categoryName || input.productType || 'Product']);
  return `${name}${input.occasion ? ` for ${normalizeText(input.occasion).toLowerCase()} styling` : ''}.`;
}

export function generateFullDescription(input = {}) {
  return [generateShortDescription(input), input.style && `Style: ${normalizeText(input.style)}.`, input.fit && `Fit: ${normalizeText(input.fit)}.`].filter(Boolean).join(' ');
}

export function generateTags(input = {}) {
  const category = normalizeText(input.categoryName || input.productType || 'collection').toLowerCase();
  const color = normalizeText(input.color || '').toLowerCase();
  const fabric = normalizeText(input.fabric || '').toLowerCase();
  const occasion = normalizeText(input.occasion || '').toLowerCase();
  const style = normalizeText(input.style || '').toLowerCase();
  const work = normalizeText(input.work || input.workPattern || '').toLowerCase();
  const priceSegment = normalizeText(input.priceSegment || '').toLowerCase();
  const targetCustomer = normalizeText(input.targetCustomer || '').toLowerCase();
  const tags = [
    color && `${color} ${category}`,
    fabric && `${fabric} ${category}`,
    occasion && `${occasion} wear`,
    style && `${style} wear`,
    work && `${work} detailing`,
    'ethnic wear',
    'jassi general store',
    category,
    priceSegment && `${priceSegment} collection`,
    targetCustomer && `${targetCustomer} wear`,
  ].filter(Boolean);

  return unique(tags).slice(0, 12).join(', ');
}

export function generateHighlights(input = {}) {
  const fabric = normalizeText(input.fabric || '');
  const color = normalizeText(input.color || '');
  const occasion = normalizeText(input.occasion || '').toLowerCase();
  const work = normalizeText(input.work || input.workPattern || '');
  const fit = normalizeText(input.fit || '');
  const sizeRange = normalizeText(input.sizeRange || '');
  return unique([
    fabric && `Material: ${fabric}`,
    color && `Colour: ${color}`,
    work && `${work} detailing`,
    fit && `Fit: ${fit}`,
    occasion && `Suggested for ${occasion}`,
    sizeRange && `Available in ${sizeRange}`,
  ]).slice(0, 6);
}

export function generateCareInstructions(fabric = '') {
  const value = String(fabric || '').toLowerCase();
  if (value.includes('silk')) return 'Dry clean recommended';
  if (value.includes('georgette')) return 'Gentle hand wash or dry clean';
  if (value.includes('cotton')) return 'Gentle machine wash';
  if (value.includes('chiffon')) return 'Hand wash recommended';
  if (value.includes('linen')) return 'Gentle wash recommended';
  return 'Wash with care';
}

export function generateSeo(input = {}) {
  const productName = normalizeText(input.productName || 'Elegant Product');
  const category = normalizeText(input.categoryName || input.productType || 'Collection');
  const occasion = normalizeText(input.occasion || 'special occasions').toLowerCase();
  const fabric = normalizeText(input.fabric || '').toLowerCase();
  const color = normalizeText(input.color || '').toLowerCase();
  const work = normalizeText(input.work || input.workPattern || '').toLowerCase();
  const style = normalizeText(input.style || '').toLowerCase();
  const metaTitle = `${productName} | Jassi General Store`;
  const metaKeywords = unique([
    productName,
    category,
    color,
    fabric,
    occasion,
    work,
    style,
    'Jassi General Store',
    'ethnic wear',
  ].filter(Boolean).map((item) => String(item).toLowerCase())).join(', ');
  const metaDescription = `Shop ${productName} from Jassi General Store. Perfect for ${occasion} with elegant ${fabric || category.toLowerCase()} styling and a polished finish.`;
  return { metaTitle, metaKeywords, metaDescription };
}

export function generateCaption(input = {}) {
  const productName = normalizeText(input.productName || 'Elegant Product');
  const category = normalizeText(input.categoryName || input.productType || 'Collection');
  const occasion = normalizeText(input.occasion || 'special occasions').toLowerCase();
  const sizes = Array.isArray(input.sizes) ? input.sizes.join(', ') : normalizeText(input.sizes || '');
  return [
    'New arrival at Jassi General Store ✨',
    '',
    productName,
    `Category: ${category}`,
    `Perfect for ${occasion}.`,
    ...(sizes ? [`Available Sizes: ${sizes}`] : []),
    '',
    'Order now from Jassi General Store.',
    '',
    '#SamiraCollection #EthnicWear #FestiveWear',
  ].join('\n');
}

export function generateFlagSuggestions(input = {}) {
  const occasion = normalizeText(input.occasion || '').toLowerCase();
  const priceSegment = normalizeText(input.priceSegment || '').toLowerCase();
  const productType = normalizeText(input.productType || '').toLowerCase();
  return {
    isNewArrival: Boolean(input.isNewProduct),
    showInFestive: ['festive', 'wedding', 'party', 'occasion'].some((value) => occasion.includes(value)),
    showInTrending: ['premium', 'luxury', 'trending'].some((value) => priceSegment.includes(value)) || ['gown', 'lehenga', 'saree'].some((value) => productType.includes(value)),
    isFeatured: false,
    isBestSeller: false,
    showOnHomepage: false,
  };
}

export function applyAssistantSuggestions(formData = {}, suggestions = {}, mode = 'fill-empty', selectedFields = []) {
  const next = { ...formData };
  const activeFields = Array.isArray(selectedFields) && selectedFields.length ? selectedFields : DEFAULT_FIELD_ORDER;
  const shouldApply = (field) => activeFields.includes(field);
  const setValue = (field, value) => {
    if (value === undefined || value === null || value === '') return;
    if (mode === 'fill-empty' && hasValue(next[field])) return;
    next[field] = value;
  };

  if (shouldApply('name')) setValue('name', suggestions.productName);
  if (shouldApply('slug')) setValue('slug', suggestions.slug);
  if (shouldApply('sku')) setValue('sku', suggestions.sku);
  if (shouldApply('shortDescription')) setValue('shortDescription', suggestions.shortDescription);
  if (shouldApply('description')) setValue('description', suggestions.description);
  if (shouldApply('category')) setValue('category', suggestions.category || formData.category);
  if (shouldApply('subCategory')) setValue('subCategory', suggestions.subCategory);
  if (shouldApply('occasion')) setValue('occasion', suggestions.occasion);
  if (shouldApply('fabric')) setValue('fabric', suggestions.fabric);
  if (shouldApply('sizes')) setValue('sizes', suggestions.sizes.join(', '));
  if (shouldApply('colors')) setValue('colors', suggestions.colors.join(', '));
  if (shouldApply('tags')) setValue('tags', suggestions.tags);
  if (shouldApply('highlights')) setValue('highlights', suggestions.highlights);
  if (shouldApply('careInstructions')) setValue('careInstructions', suggestions.careInstructions);
  if (shouldApply('returnPolicy')) setValue('returnPolicy', suggestions.returnPolicy);
  if (shouldApply('metaTitle')) setValue('metaTitle', suggestions.seo?.metaTitle);
  if (shouldApply('metaKeywords')) setValue('metaKeywords', suggestions.seo?.metaKeywords);
  if (shouldApply('metaDescription')) setValue('metaDescription', suggestions.seo?.metaDescription);

  if (shouldApply('flags')) {
    next.isNewArrival = mode === 'fill-empty' ? (hasValue(next.isNewArrival) ? next.isNewArrival : suggestions.flags?.isNewArrival) : suggestions.flags?.isNewArrival;
    next.showInFestive = mode === 'fill-empty' ? (hasValue(next.showInFestive) ? next.showInFestive : suggestions.flags?.showInFestive) : suggestions.flags?.showInFestive;
    next.showInTrending = mode === 'fill-empty' ? (hasValue(next.showInTrending) ? next.showInTrending : suggestions.flags?.showInTrending) : suggestions.flags?.showInTrending;
    next.isFeatured = mode === 'fill-empty' ? (hasValue(next.isFeatured) ? next.isFeatured : suggestions.flags?.isFeatured) : suggestions.flags?.isFeatured;
    next.isBestSeller = mode === 'fill-empty' ? (hasValue(next.isBestSeller) ? next.isBestSeller : suggestions.flags?.isBestSeller) : suggestions.flags?.isBestSeller;
    next.showOnHomepage = mode === 'fill-empty' ? (hasValue(next.showOnHomepage) ? next.showOnHomepage : suggestions.flags?.showOnHomepage) : suggestions.flags?.showOnHomepage;
  }

  return next;
}

function normalizeProductType(value) {
  const text = normalizeText(value).toLowerCase();
  if (text.includes('saree')) return 'saree';
  if (text.includes('suit')) return 'suit';
  if (text.includes('kurti')) return 'kurti';
  if (text.includes('lehenga')) return 'lehenga';
  if (text.includes('gown')) return 'gown';
  if (text.includes('dress')) return 'dress';
  return 'other';
}

function generateSizes(sizeRange) {
  const text = normalizeText(sizeRange || '');
  if (!text) return [];
  return unique(
    text
      .split(/[,/|]/)
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean)
  ).slice(0, 8);
}

function generateColors(mainColor, secondaryColors) {
  return unique([mainColor, ...secondaryColors].map(normalizeText).filter(Boolean)).slice(0, 6);
}

function normalizeText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.map(normalizeText).filter(Boolean);
  return String(value || '')
    .split(/[,/|]/)
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function abbreviate(value, length) {
  const cleaned = normalizeText(value)
    .replace(/[^a-z0-9]+/gi, '')
    .toUpperCase();
  if (!cleaned) return 'XXX';
  return cleaned.slice(0, length).padEnd(length, 'X');
}

function joinParts(parts) {
  return unique(parts.map(normalizeText).filter(Boolean)).join(' ').replace(/\s+/g, ' ').trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function hasValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'boolean') return true;
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function dedupeSpaces(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}
