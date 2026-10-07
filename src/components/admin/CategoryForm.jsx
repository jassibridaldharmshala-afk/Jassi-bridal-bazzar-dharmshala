import { useEffect, useMemo, useState } from 'react';
import { Eye, Link2, Search, Sparkles } from 'lucide-react';
import api from '../../services/api';
import { normalizeImageUrl } from '../../services/normalize';
import ImageUploader from './ImageUploader';
import WorkflowSmartFill from './WorkflowSmartFill';

const emptyCategory = {
  name: '', slug: '', parent: '', definitionKey: '', description: '', image: '', metaTitle: '', metaDescription: '', socialImage: '', displayOrder: 0, isActive: true,
};

function mediaUrl(value) {
  if (typeof value === 'string') return value;
  return value?.url || '';
}

function normalizedForm(category = {}) {
  return {
    ...emptyCategory,
    name: category.name || '',
    slug: category.slug || '',
    parent: category.parent?._id || category.parent || '',
    definitionKey: category.definitionKey || '',
    description: category.description || '',
    image: mediaUrl(category.image),
    metaTitle: category.metaTitle || '',
    metaDescription: category.metaDescription || '',
    socialImage: mediaUrl(category.socialImage),
    displayOrder: Number(category.displayOrder || 0),
    isActive: category.isActive !== false,
  };
}

function makeSlug(value) {
  return String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function CategoryForm({ mode = 'Add', categoryId, onSaved, onCancel, onDirtyChange, availableCategories }) {
  const [form, setForm] = useState(emptyCategory);
  const [initialSnapshot, setInitialSnapshot] = useState(JSON.stringify(emptyCategory));
  const [categories, setCategories] = useState(Array.isArray(availableCategories) ? availableCategories : []);
  const [definitions, setDefinitions] = useState([]);
  const [loading, setLoading] = useState(Boolean(categoryId));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [autoSlug, setAutoSlug] = useState(!categoryId);
  const [readyForOptions, setReadyForOptions] = useState(!categoryId);
  const [removedMedia, setRemovedMedia] = useState({ image: false, socialImage: false });

  useEffect(() => {
    if (!categoryId) {
      const next = normalizedForm();
      setForm(next);
      setInitialSnapshot(JSON.stringify(next));
      setAutoSlug(true);
      setRemovedMedia({ image: false, socialImage: false });
      setLoading(false);
      setReadyForOptions(true);
      if (mode === 'Update') setMessage({ type: 'error', text: 'Category id is missing.' });
      return;
    }

    let cancelled = false;
    setLoading(true);
    setReadyForOptions(false);
    setLoadError('');
    setMessage({ type: '', text: '' });
    api.get(`/admin/categories/${categoryId}`)
      .then((category) => {
        if (cancelled) return;
        const next = normalizedForm(category);
        setForm(next);
        setInitialSnapshot(JSON.stringify(next));
        setAutoSlug(false);
        setRemovedMedia({ image: false, socialImage: false });
        setReadyForOptions(true);
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [categoryId, mode, reload]);

  useEffect(() => {
    if (Array.isArray(availableCategories)) setCategories(availableCategories);
  }, [availableCategories]);

  useEffect(() => {
    if (!readyForOptions) return undefined;
    let active = true;
    const requests = [api.get('/catalog-configuration', { silent: true })];
    if (!Array.isArray(availableCategories)) requests.push(api.get('/admin/categories?admin=true', { silent: true }));
    Promise.allSettled(requests).then(([configuration, categoryResult]) => {
      if (!active) return;
      if (configuration.status === 'fulfilled' && Array.isArray(configuration.value?.categoryDefinitions)) setDefinitions(configuration.value.categoryDefinitions);
      if (categoryResult?.status === 'fulfilled') {
        const result = categoryResult.value;
        const items = Array.isArray(result) ? result : Array.isArray(result?.data) ? result.data : Array.isArray(result?.items) ? result.items : null;
        if (items) setCategories(items);
      }
    });
    return () => { active = false; };
  }, [availableCategories, readyForOptions]);

  const dirty = JSON.stringify(form) !== initialSnapshot;
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const parentOptions = useMemo(() => categories
    .filter((category) => String(category._id) !== String(categoryId) && !category.isArchived)
    .sort((left, right) => Number(left.level || 0) - Number(right.level || 0) || Number(left.displayOrder || 0) - Number(right.displayOrder || 0) || String(left.name).localeCompare(String(right.name))), [categories, categoryId]);

  const update = (field, value) => setForm((current) => {
    if (field === 'name' && autoSlug) return { ...current, name: value, slug: makeSlug(value) };
    return { ...current, [field]: value };
  });

  const updateMedia = (field, images) => {
    const value = mediaUrl(images?.[0]);
    update(field, value);
    setRemovedMedia((current) => ({ ...current, [field]: !value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (saving || loading || loadError || (mode === 'Update' && !categoryId)) return;
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        slug: makeSlug(form.slug || form.name),
        parent: form.parent || null,
        definitionKey: form.definitionKey || '',
        description: form.description.trim(),
        metaTitle: form.metaTitle.trim(),
        metaDescription: form.metaDescription.trim(),
        socialImage: form.socialImage || '',
        image: form.image || '',
        displayOrder: Number(form.displayOrder || 0),
        ...(categoryId && removedMedia.image ? { removeImage: true } : {}),
        ...(categoryId && removedMedia.socialImage ? { removeSocialImage: true } : {}),
      };
      const saved = categoryId
        ? await api.put(`/admin/categories/${categoryId}`, payload)
        : await api.post('/admin/categories', payload);
      const next = categoryId ? normalizedForm({ ...form, ...saved }) : normalizedForm();
      setForm(next);
      setInitialSnapshot(JSON.stringify(next));
      setAutoSlug(!categoryId);
      setRemovedMedia({ image: false, socialImage: false });
      setMessage({ type: 'success', text: categoryId ? 'Category changes saved.' : 'Category added successfully.' });
      onSaved?.(saved);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    if (dirty && !window.confirm('Discard the unsaved category changes?')) return;
    onCancel?.();
  };

  if (mode === 'Update' && !categoryId) return <p role="alert">Choose a category from the categories list before editing.</p>;
  if (loadError) return <div role="alert" className="admin-card p-5">{loadError} <button type="button" onClick={() => setReload(value => value + 1)} className="admin-btn-ghost">Retry loading category</button></div>;
  if (loading) return <p role="status" className="p-5 text-sm font-bold text-slate-500">Loading category...</p>;

  const previewImage = form.image || form.socialImage;
  const selectedParent = parentOptions.find((category) => String(category._id) === String(form.parent));

  return (
    <form onSubmit={submit} className="category-form">
      <div className="category-form__main">
        <WorkflowSmartFill key={categoryId || "new"} workflow="category" form={form} disabled={saving} onChange={(next, rows, undoing) => { setForm(next); if (rows.some(row => row.path === 'slug')) setAutoSlug(undoing && !categoryId && !next.slug); }} />
        <section className="category-form__section">
          <div className="category-form__section-head">
            <div><span>01</span><h3>Category essentials</h3><p>Name it, place it in the catalogue and choose where it appears.</p></div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Name" value={form.name} onChange={(value) => update('name', value)} required maxLength={80} />
            <Select label="Parent category" value={form.parent} onChange={(value) => update('parent', value)}>
              <option value="">Top-level category</option>
              {parentOptions.map((category) => <option key={category._id} value={category._id}>{`${'— '.repeat(Math.min(Number(category.level || 0), 4))}${category.name}`}</option>)}
            </Select>
            <label className="grid gap-2 text-sm font-black md:col-span-2">
              <span className="flex items-center justify-between gap-3">Slug <button type="button" className="text-xs font-bold text-wine underline" onClick={() => { setAutoSlug(true); update('slug', makeSlug(form.name)); }}>Use automatic</button></span>
              <div className="category-form__slug"><Link2 size={16} /><input aria-label="Slug" required maxLength={120} value={form.slug} onChange={(event) => { setAutoSlug(false); update('slug', makeSlug(event.target.value)); }} placeholder="category-url" /></div>
              <small>/products?category={form.slug || 'category-url'} {autoSlug ? '· updates with the name' : '· custom URL'}</small>
            </label>
            <Select label="Product field template" value={form.definitionKey} onChange={(value) => update('definitionKey', value)}>
              <option value="">Match automatically</option>
              {definitions.filter((item) => item.active !== false).map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}
            </Select>
            <Input label="Display Order" type="number" min="0" max="9999" step="1" value={form.displayOrder} onChange={(value) => update('displayOrder', value)} />
            <label className="category-form__toggle md:col-span-2">
              <input type="checkbox" checked={form.isActive} onChange={(event) => update('isActive', event.target.checked)} />
              <span><strong>Visible on storefront</strong><small>Customers can discover this category in menus and filters.</small></span>
            </label>
          </div>
        </section>

        <section className="category-form__section">
          <div className="category-form__section-head">
            <div><span>02</span><h3>Storefront content</h3><p>Add the image and copy customers will see.</p></div>
          </div>
          <TextArea label="Description" value={form.description} onChange={(value) => update('description', value)} maxLength={1200} rows={4} />
          <CharacterCount value={form.description} max={1200} />
          <div className="mt-5">
            <ImageUploader label="Choose Category Image" helpText="JPG, PNG or WEBP. A portrait or square image around 1200px works best; large files are compressed before upload." uploadContext="categories" value={form.image ? [{ url: form.image }] : []} onChange={(images) => updateMedia('image', images)} compressAboveMb={2} maxUploadMb={20} targetSizeMb={0.5} showPrimaryControl={false} />
          </div>
        </section>

        <section className="category-form__section">
          <div className="category-form__section-head">
            <div><span>03</span><h3>Search and sharing</h3><p>Optional fields for search results and links shared on social apps.</p></div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="SEO title" value={form.metaTitle} onChange={(value) => update('metaTitle', value)} placeholder="Uses category name when empty" maxLength={100} />
            <div><TextArea label="SEO description" value={form.metaDescription} onChange={(value) => update('metaDescription', value)} placeholder="Short description for search results" maxLength={300} rows={3} /><CharacterCount value={form.metaDescription} max={300} /></div>
          </div>
          <div className="mt-5">
            <ImageUploader label="Choose Social Image" helpText="Optional landscape image for shared category links. The category image is used when empty." uploadContext="categories" value={form.socialImage ? [{ url: form.socialImage }] : []} onChange={(images) => updateMedia('socialImage', images)} compressAboveMb={2} maxUploadMb={20} targetSizeMb={0.5} showPrimaryControl={false} />
          </div>
        </section>
      </div>

      <aside className="category-form__aside">
        <div className="category-preview">
          <div className="category-preview__label"><Eye size={15} /> Storefront preview</div>
          <div className="category-preview__image">
            {previewImage ? <img src={normalizeImageUrl(previewImage)} alt="Category preview" /> : <div>{String(form.name || 'SC').slice(0, 2).toUpperCase()}</div>}
          </div>
          <p className="category-preview__parent">{selectedParent ? `${selectedParent.name} /` : 'Shop by category'}</p>
          <h3>{form.name || 'Category name'}</h3>
          <p>{form.description || 'Add a short description to help customers understand this collection.'}</p>
          <span className={form.isActive ? 'is-live' : 'is-hidden'}>{form.isActive ? 'Visible' : 'Hidden'}</span>
        </div>
        <div className="category-search-preview">
          <div><Search size={15} /> Search preview</div>
          <strong>{form.metaTitle || form.name || 'Category title'}</strong>
          <span>/products?category={form.slug || 'category-url'}</span>
          <p>{form.metaDescription || form.description || 'Add an SEO description for a clearer search result.'}</p>
        </div>
        <div className="category-form__tip"><Sparkles size={17} /><p><strong>Catalog tip</strong> Use a parent category for navigation and a product field template to keep specifications consistent.</p></div>
      </aside>

      {message.text && <p role={message.type === 'error' ? 'alert' : 'status'} className={`category-form__message is-${message.type}`}>{message.text}</p>}
      <div className="category-form__actions">
        {onCancel ? <button type="button" onClick={cancel} className="admin-btn-ghost">Cancel</button> : categoryId ? <a href="/admin/categories" className="admin-btn-ghost">Back</a> : <button type="button" onClick={() => { const next = normalizedForm(); setForm(next); setAutoSlug(true); setRemovedMedia({ image: false, socialImage: false }); }} className="admin-btn-ghost">Reset</button>}
        <button disabled={saving || !form.name.trim()} className="admin-btn disabled:opacity-60">{saving ? 'Saving...' : `${mode} Category`}</button>
      </div>
    </form>
  );
}

function Input({ label, value, onChange, placeholder = label, type = 'text', required = false, ...props }) {
  return <label className="grid gap-2 text-sm font-black">{label}<input {...props} required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} className="h-12 rounded-xl border border-slate-200 px-4 text-sm font-semibold" placeholder={placeholder} /></label>;
}

function TextArea({ label, value, onChange, placeholder = label, ...props }) {
  return <label className="grid gap-2 text-sm font-black">{label}<textarea {...props} value={value} onChange={(event) => onChange(event.target.value)} className="min-h-24 rounded-xl border border-slate-200 p-4 text-sm font-semibold leading-6" placeholder={placeholder} /></label>;
}

function Select({ label, value, onChange, children }) {
  return <label className="grid gap-2 text-sm font-black">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold">{children}</select></label>;
}

function CharacterCount({ value, max }) {
  return <p className="mt-1 text-right text-[11px] font-bold text-slate-400">{String(value || '').length}/{max}</p>;
}
