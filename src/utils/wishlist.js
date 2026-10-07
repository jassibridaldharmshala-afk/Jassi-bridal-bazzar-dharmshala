import { activeVariants, findProductVariant } from './variants';
import { getSelectableSizes, resolveSizingMode } from './productSizing';

export const wishlistId = product => String(product?._id || product?.id || product?.slug || '');
export const isUnavailable = product => Boolean(product?.unavailable || product?.isArchived || product?.isActive === false);
const unique = list => [...new Set(list.filter(value => value !== undefined && value !== null).map(String))];
export function wishlistOptions(product) {
  const variants = activeVariants(product);
  const managed = Array.isArray(product.variants) && product.variants.length > 0;
  return {
    managed,
    sizes: managed ? unique(variants.map(variant => variant.size)) : resolveSizingMode(product) === 'free-size' ? ['Free Size'] : getSelectableSizes(product),
    colors: managed ? unique(variants.map(variant => variant.color)) : unique(product.colors?.length ? product.colors : ['']),
  };
}
export function wishlistStock(product, selection) {
  if (isUnavailable(product)) return 0;
  const { managed } = wishlistOptions(product);
  if (managed) {
    const variants = activeVariants(product);
    if (!selection) return variants.reduce((sum, variant) => sum + Math.max(0, Number(variant.stock || 0)), 0);
    return Math.max(0, Number(findProductVariant(product, selection)?.stock || 0));
  }
  return product.stock == null || product.stock === '' ? null : Math.max(0, Number(product.stock) || 0);
}
export function wishlistPrice(product, variant) {
  const price = Number(variant?.price ?? product.price ?? 0);
  const original = Math.max(price, Number(variant?.originalPrice ?? product.originalPrice ?? price));
  return { price, original, discount: original > price ? Math.round((original - price) / original * 100) : 0 };
}
