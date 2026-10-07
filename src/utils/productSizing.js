export const SIZE_MEASUREMENTS = {
  acrossShoulder: { label: 'Across shoulder', shortLabel: 'Shoulder', help: 'Measure straight across the back from one shoulder edge to the other.' },
  sleeveLength: { label: 'Sleeve length', shortLabel: 'Sleeve', help: 'Measure from the shoulder seam to the end of the sleeve.' },
  bust: { label: 'Bust', shortLabel: 'Bust', help: 'Measure around the fullest part of the bust, keeping the tape level.' },
  chest: { label: 'Chest', shortLabel: 'Chest', help: 'Measure around the chest just below the armholes.' },
  waist: { label: 'Waist', shortLabel: 'Waist', help: 'Measure around the natural waist without pulling the tape tight.' },
  frontLength: { label: 'Front length', shortLabel: 'Front length', help: 'Measure from the highest shoulder point down to the garment hem.' },
  bottomLength: { label: 'Bottom length', shortLabel: 'Bottom length', help: 'Measure the bottom garment from the waistband to the hem.' },
  hips: { label: 'Hips', shortLabel: 'Hips', help: 'Measure around the fullest part of the hips with feet together.' },
  outseamLength: { label: 'Outseam length', shortLabel: 'Outseam', help: 'Measure from the top of the waistband to the bottom hem along the outer leg.' },
  inseamLength: { label: 'Inseam length', shortLabel: 'Inseam', help: 'Measure from the crotch seam to the bottom hem along the inner leg.' },
};

export const SIZE_CHART_PROFILES = {
  'kurta-set': {
    label: 'Kurta / ethnic set',
    fields: ['bust', 'chest', 'frontLength', 'bottomLength', 'waist', 'sleeveLength', 'hips', 'acrossShoulder', 'outseamLength', 'inseamLength'],
  },
  kurti: {
    label: 'Short kurti / kurta',
    fields: ['bust', 'chest', 'waist', 'frontLength', 'hips', 'acrossShoulder'],
  },
  dress: {
    label: 'Dress / gown',
    fields: ['acrossShoulder', 'sleeveLength', 'bust', 'waist', 'frontLength', 'hips'],
  },
  'top-shirt': {
    label: 'Top / shirt / blouse',
    fields: ['acrossShoulder', 'sleeveLength', 'bust', 'chest', 'waist', 'frontLength'],
  },
  bottom: {
    label: 'Pant / trouser / bottom',
    fields: ['waist', 'hips', 'outseamLength', 'inseamLength', 'bottomLength'],
  },
  'skirt-lehenga': {
    label: 'Skirt / lehenga',
    fields: ['waist', 'hips', 'bottomLength'],
  },
  jumpsuit: {
    label: 'Jumpsuit',
    fields: ['acrossShoulder', 'sleeveLength', 'bust', 'waist', 'hips', 'frontLength', 'outseamLength', 'inseamLength'],
  },
  apparel: {
    label: 'Other sized apparel',
    fields: ['bust', 'chest', 'waist', 'hips', 'acrossShoulder', 'sleeveLength', 'frontLength'],
  },
};

const NON_SIZED_TERMS = [
  'saree', 'sari', 'dupatta', 'stole', 'scarf', 'shawl', 'jewellery', 'jewelry',
  'earring', 'necklace', 'bracelet', 'bangle', 'handbag', 'clutch', 'purse', 'accessor',
];

export function inferSizeChartProfile(product = {}) {
  const explicit = String(product.sizeChartProfile || '').trim();
  if (explicit && explicit !== 'auto' && (explicit === 'free-size' || SIZE_CHART_PROFILES[explicit])) return explicit;

  const text = productSizingText(product);
  if (NON_SIZED_TERMS.some((term) => text.includes(term))) return 'free-size';
  if (/(jumpsuit|romper)/.test(text)) return 'jumpsuit';
  if (/(kurta set|kurti set|ethnic set|suit set|\bsuits?\b|salwar|co-?ord)/.test(text)) return 'kurta-set';
  if (/(short kurti|short kurta|kurti|kurta|tunic)/.test(text)) return 'kurti';
  if (/(dress|gown|maxi|frock)/.test(text)) return 'dress';
  if (/(pant|trouser|palazzo|legging|jogger|bottom|jean)/.test(text)) return 'bottom';
  if (/(skirt|lehenga)/.test(text)) return 'skirt-lehenga';
  if (/(shirt|top|blouse|choli|tee|t-shirt)/.test(text)) return 'top-shirt';
  return 'apparel';
}

export function resolveSizingMode(product = {}) {
  const explicit = String(product.sizingMode || 'auto').toLowerCase();
  if (explicit === 'sized') return 'sized';
  if (explicit === 'free-size') return 'free-size';
  return inferSizeChartProfile(product) === 'free-size' ? 'free-size' : 'sized';
}

export function getSelectableSizes(product = {}) {
  if (resolveSizingMode(product) !== 'sized') return [];
  return uniqueStrings(product.sizes).filter((size) => !/^free\s*size$/i.test(size));
}

export function getSizeChartColumns(product = {}) {
  if (resolveSizingMode(product) !== 'sized') return [];
  const profile = inferSizeChartProfile(product);
  // An explicit selectable-size override still needs an editable chart even
  // when the category/name normally implies free size. Match the API fallback.
  const keys = SIZE_CHART_PROFILES[profile]?.fields || SIZE_CHART_PROFILES.apparel.fields;
  return keys.map((key) => ({ key, ...SIZE_MEASUREMENTS[key] }));
}

export function reconcileSizeChartRows(rows = [], sizes = [], columns = []) {
  const existing = new Map((Array.isArray(rows) ? rows : []).map((row) => [normalizeSize(row?.size), row || {}]));
  const keys = columns.map((column) => typeof column === 'string' ? column : column.key).filter((key) => SIZE_MEASUREMENTS[key]);
  return uniqueStrings(sizes).map((size) => {
    const current = existing.get(normalizeSize(size)) || {};
    const next = { size };
    keys.forEach((key) => { next[key] = current[key] ?? ''; });
    return next;
  });
}

export function buildSizeChartPayload(product = {}) {
  if (resolveSizingMode(product) !== 'sized') return { unit: 'in', columns: [], rows: [] };
  const sizes = getSelectableSizes(product);
  const columns = getSizeChartColumns(product);
  const rows = reconcileSizeChartRows(product.sizeChart?.rows, sizes, columns).map((row) => {
    const next = { size: row.size };
    columns.forEach(({ key }) => {
      const value = Number(row[key]);
      if (Number.isFinite(value) && value > 0) next[key] = value;
    });
    return next;
  });
  return {
    unit: product.sizeChart?.unit === 'cm' ? 'cm' : 'in',
    columns: columns.map(({ key }) => key),
    rows,
  };
}

export function getSizeChartValidation(product = {}) {
  if (resolveSizingMode(product) !== 'sized') return { valid: true, missing: [] };
  const sizes = getSelectableSizes(product);
  if (!sizes.length) return { valid: false, missing: ['Add at least one selectable size.'] };
  const columns = getSizeChartColumns(product);
  const rows = reconcileSizeChartRows(product.sizeChart?.rows, sizes, columns);
  const missing = [];
  rows.forEach((row) => {
    columns.forEach(({ key, label }) => {
      if (!Number.isFinite(Number(row[key])) || !(Number(row[key]) > 0)) missing.push(`${row.size} ${label}`);
    });
  });
  return { valid: missing.length === 0, missing };
}

export function convertMeasurement(value, fromUnit, toUnit) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '';
  if (fromUnit === toUnit) return trimMeasurement(numeric);
  return trimMeasurement(fromUnit === 'cm' ? numeric / 2.54 : numeric * 2.54);
}

function productSizingText(product) {
  const category = typeof product.category === 'object' ? product.category?.name : product.category;
  return [category, product.subCategory, product.name, product.productType]
    .map((value) => String(value || '').toLowerCase())
    .join(' ');
}

function uniqueStrings(values) {
  return Array.from(new Set((Array.isArray(values) ? values : String(values || '').split(','))
    .map((value) => String(value || '').trim())
    .filter(Boolean)));
}

function normalizeSize(value) {
  return String(value || '').trim().toLowerCase();
}

function trimMeasurement(value) {
  return Number(Number(value).toFixed(1));
}
