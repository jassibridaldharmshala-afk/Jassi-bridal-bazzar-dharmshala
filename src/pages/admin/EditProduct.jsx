import ProductForm from '../../components/admin/ProductForm';
import PageHeader from '../../components/admin/PageHeader';

export default function EditProduct({ route = '', navigate }) {
  const productId = new URLSearchParams(route.split('?')[1] || '').get('id');
  return (
    <section className="space-y-5">
      <PageHeader title="Edit Product" note="Update product details, images, pricing and catalog visibility.">
        <a href="/admin/products" className="admin-btn-ghost">Back to catalog</a>
      </PageHeader>
      <ProductForm mode="Update" productId={productId} onSaved={saved => { if (saved?.rentalOffers?.length) navigate?.(`/admin/rentals?tab=setup&listing=${encodeURIComponent(saved.rentalOffers[0]._id)}`); }} />
    </section>
  );
}
