import { useMemo, useState } from 'react';

const TYPES = [['text', 'Text'], ['number', 'Number'], ['dropdown', 'Dropdown'], ['multi_select', 'Multi select'], ['boolean', 'Yes / No'], ['color', 'Colour'], ['date', 'Date'], ['textarea', 'Long text'], ['measurement', 'Measurement'], ['range', 'Range'], ['image', 'Image']];
const SYSTEM_FILTERS = ['category', 'subcategory', 'price', 'availability', 'rating', 'discount', 'delivery_availability'];
const copy = (value) => JSON.parse(JSON.stringify(value));

function Field({ label, value, onChange, max = 100 }) {
  return <label className="grid min-w-0 gap-2 text-xs font-bold"><span>{label}</span><input value={value ?? ''} maxLength={max} onChange={(event) => onChange(event.target.value)} className="h-10 min-w-0 rounded-lg border bg-white px-3 text-sm font-normal" /></label>;
}

function Toggle({ label, checked, onChange }) {
  return <label className="flex min-h-9 items-center gap-2 rounded-lg border bg-white px-3 text-xs font-bold"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />{label}</label>;
}

function Tokens({ label, values = [], suggestions = [], limit = 30, onChange }) {
  const [entry, setEntry] = useState('');
  const id = `category-${label.replace(/\W/g, '-').toLowerCase()}`;
  const add = () => {
    const value = entry.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '');
    if (value && !values.includes(value) && values.length < limit) onChange([...values, value]);
    setEntry('');
  };
  return <label className="grid gap-2 text-xs font-bold"><span>{label} <span className="font-normal text-slate-400">({values.length}/{limit})</span></span><span className="rounded-xl border bg-white p-2"><span className="flex flex-wrap gap-1.5">{values.map((value) => <span key={value} className="inline-flex items-center gap-1 rounded-full bg-[#f7edf0] px-2.5 py-1 text-[11px] text-wine">{value}<button type="button" aria-label={`Remove ${value}`} onClick={() => onChange(values.filter((item) => item !== value))}>×</button></span>)}</span><input list={id} value={entry} disabled={values.length >= limit} onChange={(event) => setEntry(event.target.value)} onBlur={add} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); add(); } }} placeholder="Type and press Enter" className="mt-2 h-9 w-full border-0 bg-transparent px-1 text-sm font-normal outline-none" /><datalist id={id}>{suggestions.filter((item) => !values.includes(item)).map((item) => <option key={item} value={item} />)}</datalist></span></label>;
}

function LocalField({ attribute, onChange, onRemove }) {
  const enabled = (key) => attribute[key] === true || (['searchable', 'showOnDetail', 'showInSpecifications'].includes(key) && attribute[key] !== false);
  return <div className="rounded-xl border bg-white p-3"><div className="grid gap-3 sm:grid-cols-2"><Field label="Field key" value={attribute.key} onChange={(value) => onChange('key', value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))} max={40} /><Field label="Customer label" value={attribute.label} onChange={(value) => onChange('label', value)} max={80} /><label className="grid gap-2 text-xs font-bold"><span>Type</span><select value={attribute.type || 'text'} onChange={(event) => onChange('type', event.target.value)} className="h-10 rounded-lg border bg-white px-3 text-sm font-normal">{TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><Field label="Unit" value={attribute.unit || ''} onChange={(value) => onChange('unit', value)} max={20} /><Field label="Default value" value={attribute.defaultValue || ''} onChange={(value) => onChange('defaultValue', value)} max={500} />{['dropdown', 'multi_select'].includes(attribute.type) && <Tokens label="Options" values={attribute.options || []} onChange={(values) => onChange('options', values)} limit={100} />}</div><div className="mt-3 flex flex-wrap gap-2">{[['required', 'Required'], ['filterable', 'Filter'], ['searchable', 'Search'], ['variant', 'Variant'], ['showOnCard', 'Product card'], ['showOnDetail', 'Product detail'], ['showInSpecifications', 'Specifications']].map(([key, label]) => <Toggle key={key} label={label} checked={enabled(key)} onChange={(value) => onChange(key, value)} />)}<button type="button" className="ml-auto text-xs font-bold text-red-600 underline" onClick={onRemove}>Remove field</button></div></div>;
}

export default function MasterCategoryStructureEditor({ draft, setDraft, edit }) {
  const [query, setQuery] = useState('');
  const definitions = draft.categoryDefinitions || [];
  const globalKeys = useMemo(() => (draft.attributes || []).map((item) => item.key).filter(Boolean), [draft.attributes]);
  const visible = definitions.map((item, index) => ({ item, index })).filter(({ item }) => !query.trim() || `${item.name} ${item.key} ${item.parentKey}`.toLowerCase().includes(query.trim().toLowerCase()));
  const changeCategory = (categoryIndex, updater) => setDraft((current) => ({ ...current, categoryDefinitions: current.categoryDefinitions.map((category, index) => index === categoryIndex ? updater(category) : category) }));
  const changeLocal = (categoryIndex, fieldIndex, key, value) => changeCategory(categoryIndex, (category) => ({ ...category, attributes: (category.attributes || []).map((field, index) => index === fieldIndex ? { ...field, [key]: value } : field) }));
  const removeLocal = (categoryIndex, fieldIndex) => changeCategory(categoryIndex, (category) => ({ ...category, attributes: (category.attributes || []).filter((_, index) => index !== fieldIndex) }));
  const move = (index, direction) => setDraft((current) => {
    const target = index + direction;
    if (target < 0 || target >= current.categoryDefinitions.length) return current;
    const categoryDefinitions = [...current.categoryDefinitions];
    [categoryDefinitions[index], categoryDefinitions[target]] = [categoryDefinitions[target], categoryDefinitions[index]];
    return { ...current, categoryDefinitions };
  });
  const duplicate = (index) => setDraft((current) => {
    const source = copy(current.categoryDefinitions[index]);
    const used = new Set(current.categoryDefinitions.map((item) => item.key));
    let key = `${source.key || 'category'}_copy`; let counter = 2;
    while (used.has(key)) { key = `${source.key || 'category'}_copy_${counter}`; counter += 1; }
    const categoryDefinitions = [...current.categoryDefinitions];
    categoryDefinitions.splice(index + 1, 0, { ...source, key, name: `${source.name || 'Category'} copy`, parentKey: '' });
    return { ...current, categoryDefinitions };
  });
  const addLocal = (index) => changeCategory(index, (category) => ({ ...category, attributes: [...(category.attributes || []), { key: '', label: '', type: 'text', unit: '', required: false, filterable: false, searchable: true, showOnCard: false, showOnDetail: true, showInSpecifications: true, variant: false, options: [], defaultValue: '', group: 'Specifications', validation: {} }] }));
  const inheritNext = (index) => changeCategory(index, (category) => {
    const present = new Set((category.attributes || []).map((field) => typeof field === 'string' ? field : field.key));
    const next = globalKeys.find((key) => !present.has(key));
    return next ? { ...category, attributes: [...(category.attributes || []), next] } : category;
  });
  return <section className="rounded-2xl border bg-[#fbf8f4] p-4 sm:p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-bold">Categories and inheritance ({definitions.length}/150)</h2><p className="mt-1 text-xs text-slate-500">Create parent and child categories, then choose their fields, variants and filters.</p></div><div className="flex w-full gap-2 sm:w-auto"><input aria-label="Search categories" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search categories…" className="h-10 min-w-0 flex-1 rounded-xl border bg-white px-3 text-sm sm:w-56" /><button type="button" className="admin-btn-ghost" disabled={definitions.length >= 150} onClick={() => setDraft((current) => ({ ...current, categoryDefinitions: [...(current.categoryDefinitions || []), { key: '', name: '', parentKey: '', active: true, attributes: [], variantAttributes: [], filters: [] }] }))}>Add category</button></div></div>{!visible.length && <p className="mt-4 rounded-xl border border-dashed bg-white p-6 text-center text-sm text-slate-500">No categories match this search.</p>}<div className="mt-4 grid gap-3 xl:grid-cols-2">{visible.map(({ item, index }) => {
    const localKeys = (item.attributes || []).map((field) => typeof field === 'string' ? field : field.key).filter(Boolean);
    const allowed = [...new Set([...globalKeys, ...localKeys])];
    const invalidKey = item.key && (!/^[a-z][a-z0-9_]{0,49}$/.test(item.key) || definitions.some((other, position) => position !== index && other.key === item.key));
    return <article key={`${item.key || 'category'}-${index}`} className="rounded-2xl border bg-white p-4"><div className="grid gap-3 sm:grid-cols-2"><Field label="Category name" value={item.name} onChange={(value) => edit(index, 'name', value)} max={80} /><div><Field label="Category key" value={item.key} onChange={(value) => edit(index, 'key', value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))} max={50} />{invalidKey && <p className="mt-1 text-[11px] font-bold text-red-600">Use a unique key beginning with a letter.</p>}</div><label className="grid gap-2 text-xs font-bold"><span>Parent category</span><select value={item.parentKey || ''} onChange={(event) => edit(index, 'parentKey', event.target.value)} className="h-10 rounded-lg border bg-white px-3 text-sm font-normal"><option value="">Top level</option>{definitions.filter((_, position) => position !== index).map((parent) => <option key={parent.key} value={parent.key}>{parent.name || parent.key}</option>)}</select></label><Toggle label="Active for storefront" checked={item.active !== false} onChange={(value) => edit(index, 'active', value)} /></div><div className="mt-4 grid gap-4 sm:grid-cols-2"><Tokens label="Variant keys" values={item.variantAttributes || []} suggestions={allowed} limit={6} onChange={(values) => edit(index, 'variantAttributes', values)} /><Tokens label="Filter keys" values={item.filters || []} suggestions={[...SYSTEM_FILTERS, ...allowed]} onChange={(values) => edit(index, 'filters', values)} /></div><details className="mt-4 rounded-xl border bg-[#fffaf6]"><summary className="cursor-pointer p-3 text-xs font-bold">Category fields ({(item.attributes || []).length})</summary><div className="space-y-3 border-t p-3">{(item.attributes || []).map((field, fieldIndex) => typeof field === 'string' ? <div key={`${field}-${fieldIndex}`} className="flex items-center justify-between rounded-lg border bg-white p-3 text-xs"><span>Inherited field: <strong>{field}</strong></span><button type="button" className="font-bold text-red-600 underline" onClick={() => removeLocal(index, fieldIndex)}>Remove</button></div> : <LocalField key={`${field.key || 'field'}-${fieldIndex}`} attribute={field} onChange={(key, value) => changeLocal(index, fieldIndex, key, value)} onRemove={() => removeLocal(index, fieldIndex)} />)}<div className="flex flex-wrap gap-2"><button type="button" className="admin-btn-ghost" onClick={() => addLocal(index)}>Add local field</button><button type="button" className="admin-btn-ghost" disabled={!globalKeys.some((key) => !localKeys.includes(key))} onClick={() => inheritNext(index)}>Inherit next global field</button></div></div></details><div className="mt-4 flex flex-wrap gap-2"><button type="button" className="admin-btn-ghost" disabled={index === 0} onClick={() => move(index, -1)}>Move up</button><button type="button" className="admin-btn-ghost" disabled={index === definitions.length - 1} onClick={() => move(index, 1)}>Move down</button><button type="button" className="admin-btn-ghost" onClick={() => duplicate(index)}>Duplicate</button><button type="button" className="admin-btn-ghost text-red-700" onClick={() => setDraft((current) => ({ ...current, categoryDefinitions: current.categoryDefinitions.filter((_, position) => position !== index) }))}>Remove from draft</button></div></article>;
  })}</div></section>;
}
