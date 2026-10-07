import ProductCatalogManager from '../admin/ProductCatalogManager';

export default function SellerProducts() {
  return <ProductCatalogManager route="/seller/products" apiPrefix="/seller" />;
}
