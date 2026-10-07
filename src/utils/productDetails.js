import { getSelectableSizes } from './productSizing';

const DETAIL_LINE = /^[\s•*\-–—]*([^:]{2,48})\s*:\s*(.+)$/;

export function buildProductDetails(product = {}) {
  const selectableSizes = getSelectableSizes(product);
  const descriptionSource = [product.description, product.shortDescription]
    .find((value) => hasMeaningfulProductCopy(value)) || '';
  const parsed = parseDescription(descriptionSource);
  const explicit = [
    ['Category', product.category],
    ['Subcategory', product.subCategory],
    ['Fabric', product.fabric],
    ['Occasion', product.occasion],
    ['Colour', joinValues(product.colors)],
    ['Available sizes', joinValues(selectableSizes)],
    ['Product code', product.sku],
    ['Variant', product.variantName],
  ];
  const rows = [];
  const usedLabels = new Set();
  const groupsByLabel = new Map();

  const configured = (Array.isArray(product.specifications) ? product.specifications : [])
    .filter((item) => item?.label && item?.value && item.active !== false && item.showOnDetail !== false)
    .map((item) => [item.label, [item.value, item.unit].filter(Boolean).join(' '), item.group || 'Specifications']);
  [...explicit, ...configured, ...parsed.specifications].forEach(([label, value, group]) => {
    const cleanLabel = cleanText(label);
    const cleanValue = cleanText(value);
    const key = normalizeLabel(cleanLabel);
    if (!cleanLabel || !cleanValue || usedLabels.has(key)) return;
    usedLabels.add(key);
    rows.push({ label: cleanLabel, value: cleanValue });
    groupsByLabel.set(key, cleanText(group) || 'Product information');
  });

  return {
    description: parsed.description,
    specifications: rows,
    specificationGroups: buildSpecificationGroups(rows, groupsByLabel),
    highlights: uniqueList(product.highlights),
    tags: uniqueList(product.tags),
    sizes: uniqueList(selectableSizes),
    colors: uniqueList(product.colors),
    fabric: cleanText(product.fabric),
    careInstructions: cleanText(product.careInstructions),
  };
}

function buildSpecificationGroups(rows, groupsByLabel) {
  const grouped = new Map();
  rows.forEach((row) => {
    const group = groupsByLabel.get(normalizeLabel(row.label)) || 'Product information';
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group).push(row);
  });
  return Array.from(grouped.entries()).map(([group, items]) => ({ group, items }));
}

export function hasMeaningfulProductCopy(value = '') {
  const text = String(value || '').trim();
  const words = text.match(/[a-z]{2,}/gi) || [];
  return text.length >= 24 && words.length >= 4;
}

export function parseDescription(value = '') {
  const text = String(value || '').replace(/\r\n/g, '\n').trim();
  if (!text) return { description: '', specifications: [] };

  const narrative = [];
  const specifications = [];
  let reachedDetails = false;

  text.split('\n').forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      if (!reachedDetails && narrative.length && narrative[narrative.length - 1] !== '') narrative.push('');
      return;
    }
    if (/^product\s+details\s*:?$/i.test(line)) {
      reachedDetails = true;
      return;
    }

    const match = line.match(DETAIL_LINE);
    if (match && (reachedDetails || /^[•*\-–—]/.test(line))) {
      specifications.push([match[1], match[2]]);
      reachedDetails = true;
      return;
    }

    if (!reachedDetails) narrative.push(line.replace(/^[•*\-–—]\s*/, ''));
  });

  while (narrative[narrative.length - 1] === '') narrative.pop();
  return {
    description: narrative.filter(Boolean).join('\n\n') || (specifications.length ? '' : text),
    specifications,
  };
}

function uniqueList(values) {
  const source = Array.isArray(values) ? values : [];
  const seen = new Set();
  return source.reduce((items, value) => {
    const cleaned = cleanText(value);
    const key = cleaned.toLowerCase();
    if (!cleaned || seen.has(key)) return items;
    seen.add(key);
    items.push(cleaned);
    return items;
  }, []);
}

function joinValues(values) {
  return uniqueList(values).join(', ');
}

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeLabel(value) {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (['color', 'colour', 'colors', 'colours'].includes(normalized)) return 'colour';
  if (normalized === 'size' || normalized === 'sizes') return 'availablesizes';
  if (normalized === 'productcode' || normalized === 'sku') return 'productcode';
  return normalized;
}
