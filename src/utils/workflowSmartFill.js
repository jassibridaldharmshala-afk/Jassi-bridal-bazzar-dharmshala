export const WORKFLOW_FIELDS = {
  category: ['name', 'slug', 'description', 'metaTitle', 'metaDescription'],
  banner: ['title', 'subtitle', 'buttonText', 'link', 'altText', 'destinationType'],
  campaign: ['name', 'creative.title', 'creative.subtitle', 'creative.buttonText', 'creative.link', 'creative.altText', 'creative.destinationType'],
  coupon: ['code', 'title', 'type', 'discountValue', 'minOrderAmount', 'maxDiscountAmount', 'customerSegment', 'firstOrderOnly', 'benefitType'],
  shipment: ['courierName', 'trackingNumber', 'trackingUrl', 'expectedDeliveryAt', 'customerNote'],
  purchase: ['supplier.name', 'supplier.phone', 'supplier.email', 'expectedAt', 'items'],
  store: ['storeName', 'tagline', 'legalBusinessName', 'contactEmail', 'contactPhone', 'address', 'billingAddress', 'gstin', 'invoicePrefix', 'brandIdentityEnabled', 'contactDetailsEnabled'],
  support: ['reply', 'summary'], returns: ['customerReply', 'internalNote'],
  catalog: ['shortDescription', 'description', 'tags', 'metaTitle', 'metaDescription', 'metaKeywords'],
  website: ['colors.primary', 'colors.secondary', 'colors.accent', 'colors.background', 'colors.surface', 'colors.text', 'colors.mutedText', 'buttons.background', 'buttons.textColor', 'header.background', 'header.textColor', 'footer.background', 'footer.textColor', 'typography.headingFont', 'typography.bodyFont', 'mobile.inheritThemeColors', 'theme.enhancedStyles', 'footer.description'],
};
const unsafe = path => typeof path !== 'string' || path.split('.').some(key => ['__proto__', 'constructor', 'prototype'].includes(key));
export const readSmartValue = (form, path) => unsafe(path) ? undefined : path.split('.').reduce((value, key) => value?.[key], form);
export const sameSmartValue = (a, b) => JSON.stringify(a ?? '') === JSON.stringify(b ?? '');
export function smartRowUnchanged(form, row, undo = false) {
  if (row.sectionId && readSmartValue(form, row.path.split('.').slice(0, -1).concat('id').join('.')) !== row.sectionId) return false;
  return sameSmartValue(readSmartValue(form, row.path), undo ? row.value : row.before);
}
export const emptySmartValue = value => value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length);
const booleanFields = new Set(['firstOrderOnly', 'brandIdentityEnabled', 'contactDetailsEnabled', 'mobile.inheritThemeColors', 'theme.enhancedStyles']);
function validSmartValue(path, value) {
  if (booleanFields.has(path)) return typeof value === 'boolean';
  if (path === 'tags') return Array.isArray(value) && value.length <= 15 && value.every(item => typeof item === 'string' && item.length <= 80);
  if (path === 'items') return Array.isArray(value) && value.length <= 50 && value.every(item => item && typeof item.selection === 'string' && item.selection.length <= 100 && Number.isSafeInteger(item.quantity) && item.quantity > 0 && item.quantity <= 100000 && Number.isFinite(item.unitCost) && item.unitCost >= 0 && item.unitCost <= 10000000);
  return typeof value === 'string' && value.length <= 10000;
}
export function allowedSmartPath(workflow, path, form) {
  if (unsafe(path)) return false;
  if (WORKFLOW_FIELDS[workflow]?.includes(path)) return true;
  const match = workflow === 'website' && path.match(/^homepage\.sections\.(\d{1,2})\.(heading|description)$/);
  return Boolean(match && form.homepage?.sections?.[Number(match[1])]);
}
export function writeSmartValue(form, path, value) {
  if (unsafe(path)) return form;
  const keys = path.split('.');
  const next = { ...form }; let target = next, previous = form;
  for (const key of keys.slice(0, -1)) {
    const old = previous?.[key];
    if (!old || typeof old !== 'object') return form;
    target[key] = Array.isArray(old) ? [...old] : { ...old }; target = target[key]; previous = old;
  }
  target[keys[keys.length - 1]] = value; return next;
}
export function reviewSmartSuggestions(result, baseline, workflow) {
  if (!Array.isArray(result?.suggestions)) throw new Error('Smart Fill returned an invalid preview. Nothing was applied.');
  const used = new Set();
  return result.suggestions.flatMap(row => {
    if (!row || !allowedSmartPath(workflow, row.path, baseline) || !validSmartValue(row.path, row.value) || used.has(row.path) || JSON.stringify(row.value).length > 20000) return [];
    const sectionId = workflow === 'website' && row.path.startsWith('homepage.sections.') ? readSmartValue(baseline, row.path.split('.').slice(0, -1).concat('id').join('.')) : undefined;
    used.add(row.path); return [{ ...row, sectionId, before: readSmartValue(baseline, row.path), empty: emptySmartValue(readSmartValue(baseline, row.path)) }];
  });
}
export function applySmartReview(form, rows, selected, replace = false, undo = false) {
  let next = form; const applied = [];
  const blockedGroups = new Set(!undo ? rows.filter(row => row.group && selected.includes(row.path)).filter(row => rows.some(peer => peer.group === row.group && (!selected.includes(peer.path) || (!peer.empty && !replace) || !smartRowUnchanged(form, peer)))).map(row => row.group) : []);
  for (const row of rows) {
    if (blockedGroups.has(row.group) || !selected.includes(row.path) || (!undo && !row.empty && !replace) || !smartRowUnchanged(next, row, undo)) continue;
    const updated = writeSmartValue(next, row.path, undo ? row.before : row.value);
    if (updated !== next) { next = updated; applied.push(row); }
  }
  return { form: next, applied };
}
export const smartEndpoint = (base, path) => { const [root, query] = base.split('?'); return `${root}/${path}${query ? '?' + query : ''}`; };
export function smartCurrent(form, workflow) {
  // No unrelated provider credentials, customer PII or form state is sent.
  if (workflow === 'website') return { ...Object.fromEntries(['colors', 'buttons', 'header', 'footer', 'typography', 'mobile', 'theme'].map(key => [key, Object.fromEntries((WORKFLOW_FIELDS.website || []).filter(path => path.startsWith(key + '.')).map(path => [path.split('.')[1], readSmartValue(form, path)]))])), homepage: { sections: (form.homepage?.sections || []).map(({ id, heading, description }) => ({ id, heading, description })) } };
  let current = {};
  for (const path of WORKFLOW_FIELDS[workflow] || []) {
    const keys = path.split('.'); let target = current;
    keys.slice(0, -1).forEach(key => { target[key] ||= {}; target = target[key]; });
    target[keys[keys.length - 1]] = readSmartValue(form, path);
  }
  if (workflow === 'shipment') current.fulfillmentMode = form.fulfillmentMode;
  return current;
}
