import { getSizeChartColumns } from '../../utils/productSizing';

export default function SelectedSizeSummary({ product, size, onOpenSizeGuide }) {
  if (!size) return null;

  const unit = product?.sizeChart?.unit === 'cm' ? 'cm' : 'in';
  const row = (Array.isArray(product?.sizeChart?.rows) ? product.sizeChart.rows : [])
    .find((item) => String(item?.size || '').trim().toLowerCase() === String(size).trim().toLowerCase());
  const measurements = getSizeChartColumns(product)
    .map((column) => ({ ...column, value: Number(row?.[column.key]) }))
    .filter((item) => Number.isFinite(item.value) && item.value > 0);
  const visible = measurements.slice(0, 4);
  const fitNote = String(product?.sizeFitNotes || '').trim();

  return (
    <section className="mt-4 rounded-xl border border-theme-border bg-ivory px-4 py-3 shadow-[0_5px_16px_rgba(68,40,25,0.05)]" aria-label={`Selected size ${size}`} aria-live="polite">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[11px] text-slate-600 md:text-xs">
        <span className="font-black uppercase tracking-[.08em] text-wine">Selected size</span>
        <strong className="text-sm text-charcoal">{size}</strong>
      </div>
      {visible.length ? (
        <p className="mt-1.5 text-[11px] leading-5 text-slate-600 md:text-xs">
          <span className="font-bold text-charcoal">Garment measurements:</span>{' '}
          {visible.map((item) => `${item.shortLabel} ${formatMeasurement(item.value)} ${unit}`).join(' · ')}
          {measurements.length > visible.length ? ` · +${measurements.length - visible.length} more` : ''}
        </p>
      ) : (
        <p className="mt-1.5 text-[11px] leading-5 text-slate-500 md:text-xs">Size {size} is selected. Check the size guide for available fit information.</p>
      )}
      {fitNote ? <p className="mt-1 text-[10px] leading-4 text-slate-500 md:text-[11px]">{fitNote}</p> : null}
      {onOpenSizeGuide ? <button type="button" onClick={onOpenSizeGuide} className="mt-2 text-[10px] font-black uppercase tracking-[.05em] text-[#a40d40]">View complete size guide</button> : null}
    </section>
  );
}

function formatMeasurement(value) {
  return Number(value).toLocaleString('en-IN', { maximumFractionDigits: 1 });
}
