import ProductForm from '../../components/admin/ProductForm';

export default function SellerProductFormPage({ navigate, route = '' }) {
  const productId = new URLSearchParams(route.split('?')[1] || '').get('id');
  const editing = Boolean(productId);
  return (
    <section className="space-y-5">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-wine">Boutique / Catalog</p>
        <h1 className="text-xl font-black text-charcoal md:text-3xl">{editing ? 'Edit product' : 'Add product'}</h1>
        <p className="text-sm font-semibold text-slate-500">Saved to this boutique only. Drafts never auto-publish to the live storefront until you mark the product active.</p>
      </div>
      <ProductForm
        mode={editing ? 'Update' : 'Add'}
        productId={productId}
        apiPrefix="/seller"
        uploadPrefix="/seller/uploads"
        cancelPath="/seller/products"
        onSaved={() => navigate('/seller/products')}
      />
    </section>
  );
}
