import { useEffect, useMemo, useState } from 'react';
import { Check, Ruler, X } from 'lucide-react';
import { getPrimaryImageUrl, normalizeImageUrl } from '../../services/normalize';
import {
  convertMeasurement,
  getSelectableSizes,
  getSizeChartColumns,
  inferSizeChartProfile,
  reconcileSizeChartRows,
  SIZE_CHART_PROFILES,
} from '../../utils/productSizing';
import './SizeChartModal.css';

export default function SizeChartModal({
  open,
  onClose,
  product = {},
  sizes = [],
  guideText = '',
  selectedSize = '',
  onSelectSize,
  isSizeAvailable = () => true,
}) {
  const storedUnit = product.sizeChart?.unit === 'cm' ? 'cm' : 'in';
  const [unit, setUnit] = useState(storedUnit);
  const [tab, setTab] = useState('chart');
  const sizedProduct = useMemo(() => ({ ...product, sizes: product.sizes?.length ? product.sizes : sizes }), [product, sizes]);
  const availableSizes = getSelectableSizes(sizedProduct);
  const columns = getSizeChartColumns(sizedProduct);
  const rows = reconcileSizeChartRows(product.sizeChart?.rows, availableSizes, columns);
  const hasMeasurements = rows.some((row) => columns.some(({ key }) => Number(row[key]) > 0));
  const profile = inferSizeChartProfile(sizedProduct);
  const image = normalizeImageUrl(getPrimaryImageUrl(product.images));

  useEffect(() => {
    if (!open) return undefined;
    setUnit(storedUnit);
    setTab('chart');
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose?.(); };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, open, storedUnit]);

  if (!open) return null;

  return (
    <div className="sc-size-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
      <section className="sc-size-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="product-size-chart-title">
        <button type="button" onClick={onClose} className="sc-size-modal__close" aria-label="Close size chart"><X aria-hidden="true" /></button>

        <header className="sc-size-modal__product">
          {image ? <img src={image} alt="" /> : <div className="sc-size-modal__image-placeholder"><Ruler aria-hidden="true" /></div>}
          <div>
            {product.brand ? <p>{product.brand}</p> : null}
            <h2 id="product-size-chart-title">{product.name || 'Product size guide'}</h2>
            {Number(product.price) > 0 ? <strong>₹{Number(product.price).toLocaleString('en-IN')}</strong> : null}
            <span>{SIZE_CHART_PROFILES[profile]?.label || 'Garment measurements'}</span>
          </div>
        </header>

        <div className="sc-size-modal__tabs" role="tablist" aria-label="Size information">
          <button type="button" role="tab" aria-selected={tab === 'chart'} className={tab === 'chart' ? 'is-active' : ''} onClick={() => setTab('chart')}>Size chart</button>
          <button type="button" role="tab" aria-selected={tab === 'measure'} className={tab === 'measure' ? 'is-active' : ''} onClick={() => setTab('measure')}>How to measure</button>
        </div>

        <div className="sc-size-modal__content">
          {tab === 'chart' ? (
            <>
              <div className="sc-size-modal__toolbar">
                <div>
                  <h3>Garment measurements</h3>
                  <p>Select the size whose measurements suit you best.</p>
                </div>
                <div className="sc-size-modal__unit" aria-label="Measurement unit">
                  {['in', 'cm'].map((item) => <button key={item} type="button" onClick={() => setUnit(item)} className={unit === item ? 'is-active' : ''} aria-pressed={unit === item}>{item}</button>)}
                </div>
              </div>

              {hasMeasurements ? (
                <div className="sc-size-modal__table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Size</th>
                        {columns.map((column) => <th key={column.key}>{column.label}<small>({unit})</small></th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => {
                        const available = isSizeAvailable(row.size);
                        const active = selectedSize === row.size;
                        return (
                          <tr key={row.size} className={`${active ? 'is-selected' : ''}${available ? '' : ' is-unavailable'}`}>
                            <th>
                              <button type="button" disabled={!available} onClick={() => onSelectSize?.(row.size)} aria-label={`Select size ${row.size}`}>
                                <span>{active ? <Check aria-hidden="true" /> : null}</span>{row.size}
                              </button>
                            </th>
                            {columns.map(({ key }) => <td key={key}>{Number(row[key]) > 0 ? convertMeasurement(row[key], storedUnit, unit) : '—'}</td>)}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="sc-size-modal__empty">
                  <Ruler aria-hidden="true" />
                  <h3>Measurements are being updated</h3>
                  <p>The available size labels are shown below, but this product does not yet have verified garment measurements.</p>
                  <div>{availableSizes.map((size) => <span key={size}>{size}</span>)}</div>
                </div>
              )}

              {product.sizeFitNotes || guideText ? <p className="sc-size-modal__note"><strong>Fit note:</strong> {product.sizeFitNotes || guideText}</p> : null}
            </>
          ) : (
            <div className="sc-size-modal__measure">
              <div className="sc-size-modal__measure-intro"><Ruler aria-hidden="true" /><div><h3>Measure over fitted clothing</h3><p>Keep the tape level and comfortably close to the body. Do not pull it tight.</p></div></div>
              <ol>
                {columns.map((column, index) => <li key={column.key}><span>{index + 1}</span><div><strong>{column.label}</strong><p>{column.help}</p></div></li>)}
              </ol>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
