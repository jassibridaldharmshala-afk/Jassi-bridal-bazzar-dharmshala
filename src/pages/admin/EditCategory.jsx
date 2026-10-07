import CategoryForm from '../../components/admin/CategoryForm';
import PageHeader from '../../components/admin/PageHeader';

export default function EditCategory({ route = '' }) {
  const params = new URLSearchParams(route.split('?')[1] || '');
  const categoryId = params.get('id') || params.get('categoryId');

  return (
    <section className="space-y-5">
      <PageHeader title="Edit Category" note="Update the category name, image, visibility and ordering." />
      {categoryId ? (
        <CategoryForm mode="Update" categoryId={categoryId} />
      ) : (
        <div className="rounded-2xl bg-white p-5 text-sm font-semibold text-slate-600 shadow-sm">
          Category id is missing. Please open the edit screen from the categories list.
        </div>
      )}
    </section>
  );
}
