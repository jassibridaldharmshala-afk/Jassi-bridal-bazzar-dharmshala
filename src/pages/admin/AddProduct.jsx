import ProductForm from '../../components/admin/ProductForm';
import PageHeader from '../../components/admin/PageHeader';

export default function AddProduct({ navigate }) {
  return (
    <section className="space-y-5">
      <PageHeader title="Add Product" note="Create a catalog listing with photos, price, stock and storefront visibility.">
        <a href="/admin/products" className="admin-btn-ghost">Back to catalog</a>
      </PageHeader>
      <ProductForm mode="Add" onSaved={saved => { if (saved?.rentalOffers?.length) navigate?.(`/admin/rentals?tab=setup&listing=${encodeURIComponent(saved.rentalOffers[0]._id)}`); }} />
    </section>
  );
}
