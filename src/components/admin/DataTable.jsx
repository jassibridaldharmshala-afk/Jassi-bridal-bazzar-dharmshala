import { Children, cloneElement, isValidElement } from 'react';
import EmptyState from './EmptyState';
import Loader from './Loader';

export default function DataTable({ heads, rows, loading, error, onRetry, emptyTitle, emptyNote, minWidth = 860, title, note }) {
  if (loading) return <Loader />;
  if (error) return <div role="alert" className="admin-card space-y-3 p-5"><p className="text-sm font-semibold text-rose">{error}</p>{onRetry && <button type="button" className="admin-btn-secondary" onClick={() => onRetry()}>Try again</button>}</div>;
  if (!rows.length) return <EmptyState title={emptyTitle} note={emptyNote} />;

  const tableTitle = title || deriveTitle(emptyTitle);

  const labelledRows = Children.toArray(rows).map((row) => {
    if (!isValidElement(row)) return row;
    const cells = Children.map(row.props.children, (cell, index) => (
      isValidElement(cell)
        ? cloneElement(cell, { 'data-label': cell.props['data-label'] || heads[index] || '' })
        : cell
    ));
    return cloneElement(row, undefined, cells);
  });

  return (
    <div className="admin-table admin-data-table">
      <div className="admin-data-table__head">
        <div>
          <h2>{tableTitle}</h2>
          {note ? <p>{note}</p> : null}
        </div>
        <span>{rows.length} {rows.length === 1 ? 'record' : 'records'}</span>
      </div>
      <div className="admin-data-table__scroll">
        <table className="admin-catalog-table admin-data-table__table" style={{ '--admin-table-min-width': `${minWidth}px` }}>
          <thead>
            <tr>{heads.map((head) => <th key={head}>{head}</th>)}</tr>
          </thead>
          <tbody>{labelledRows}</tbody>
        </table>
      </div>
    </div>
  );
}

function deriveTitle(emptyTitle) {
  const value = String(emptyTitle || 'Records')
    .replace(/^No\s+/i, '')
    .replace(/\s+found$/i, '')
    .trim();
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Records';
}
