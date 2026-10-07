function variantKey(size = '', color = '') {
  return `${String(size || '').trim().toLowerCase()}::${String(color || '').trim().toLowerCase()}`;
}

export function activeVariants(product = {}) {
  return (Array.isArray(product.variants) ? product.variants : []).filter((variant) => variant && variant.isActive !== false);
}

export function hasManagedVariants(product = {}) {
  return activeVariants(product).length > 0;
}

export function findProductVariant(product = {}, { variantId, size, color } = {}) {
  const variants = activeVariants(product);
  if (!variants.length) return null;
  if (variantId) {
    const match = variants.find((variant) => String(variant._id) === String(variantId));
    if (match) return match;
  }
  if (size || color) {
    return variants.find((variant) => variantKey(variant.size, variant.color) === variantKey(size, color)) || null;
  }
  return null;
}

export function variantStock(product = {}, selection = {}) {
  if (!hasManagedVariants(product)) {
    if (product.stock === undefined || product.stock === null || product.stock === '') return null;
    const stock = Number(product.stock);
    return Number.isFinite(stock) ? Math.max(0, stock) : null;
  }
  const variant = findProductVariant(product, selection);
  return variant ? Math.max(0, Number(variant.stock || 0)) : 0;
}

export function isSizeAvailable(product, size) {
  if (!hasManagedVariants(product)) return true;
  return activeVariants(product).some((variant) => String(variant.size) === String(size) && Number(variant.stock || 0) > 0);
}

export function isColorAvailable(product, color, size) {
  if (!hasManagedVariants(product)) return true;
  return activeVariants(product).some((variant) => (
    String(variant.color) === String(color)
    && (!size || String(variant.size) === String(size))
    && Number(variant.stock || 0) > 0
  ));
}

export function firstInStockVariant(product = {}) {
  return activeVariants(product).find((variant) => Number(variant.stock || 0) > 0) || activeVariants(product)[0] || null;
}

export function buildVariantMatrix(sizes = [], colors = [], existing = []) {
  const byKey = new Map((existing || []).map((variant) => [variantKey(variant.size, variant.color), variant]));
  const rows = [];
  const sizeOptions = sizes.length ? sizes : [''];
  const colorOptions = colors.length ? colors : [''];
  if (!sizes.length && !colors.length) return rows;
  for (const size of sizeOptions) {
    for (const color of colorOptions) {
      const current = byKey.get(variantKey(size, color));
      rows.push({
        ...(current?._id ? { _id: current._id } : {}),
        sku: current?.sku || '',
        size,
        color,
        stock: current?.stock ?? 0,
        price: current?.price || '',
        originalPrice: current?.originalPrice || '',
        isActive: current?.isActive !== false,
      });
    }
  }
  return rows;
}
