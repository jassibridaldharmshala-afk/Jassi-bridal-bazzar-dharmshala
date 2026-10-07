import { getSelectableSizes, getSizeChartColumns, getSizeChartValidation, reconcileSizeChartRows, resolveSizingMode } from '../../utils/productSizing';
import { importSizingProduct } from '../../utils/socialImport';

export default function ImportSizeFields({ form, onUpdate, categories, structure }) {
  if (structure?.features?.sizing === false) return null;
  const product = importSizingProduct(form, categories, structure);
  const sized = resolveSizingMode(product) === 'sized';
  const columns = getSizeChartColumns(product);
  const rows = reconcileSizeChartRows(form.sizeChart?.rows, getSelectableSizes(product), columns);
  const complete = getSizeChartValidation(product).valid;
  const content = <>
    <label className="admin-field"><span>Sizing</span><select className="admin-field__control" value={form.sizingMode || 'auto'} onChange={(event) => onUpdate('sizingMode', event.target.value)}><option value="auto">Based on product type</option><option value="sized">Selectable sizes</option><option value="free-size">Free size / no size selection</option></select></label>
    {sized && <>
      <label className="admin-field"><span>Available sizes (comma separated)</span><input className="admin-field__control" value={Array.isArray(form.sizes) ? form.sizes.join(', ') : form.sizes || ''} placeholder="S, M, L" onChange={(event) => onUpdate('sizes', event.target.value)} /></label>
      {rows.length > 0 && <div className="social-import__measurements">
        <label className="admin-field"><span>Measurement unit</span><select className="admin-field__control" value={form.sizeChart?.unit || 'in'} onChange={(event) => onUpdate('sizeChart', { ...form.sizeChart, unit: event.target.value })}><option value="in">Inches</option><option value="cm">Centimetres</option></select></label>
        <p>Use the actual garment measurements. Measurements found in the source are filled in for review.</p>
        {rows.map((row) => <fieldset key={row.size}><legend>Size {row.size}</legend><div className="social-import__field-row">{columns.map(({ key, label }) => <label className="admin-field" key={key}><span>{label}</span><input aria-label={row.size + ' ' + label} className="admin-field__control" type="number" min="0.1" max="499" step="0.1" value={row[key] ?? ''} onChange={(event) => onUpdate('sizeChart', { unit: form.sizeChart?.unit || 'in', columns: columns.map((column) => column.key), rows: rows.map((item) => item.size === row.size ? { ...item, [key]: event.target.value } : item) })} /></label>)}</div></fieldset>)}
      </div>}
    </>}
  </>;
  return complete ? <details className="social-import__additional"><summary>{sized ? 'Sizes and measurements filled — review' : 'Free-size product — change sizing'}</summary>{content}</details> : <div className="social-import__size-required"><h3>Confirm sizes and measurements</h3>{content}</div>;
}
