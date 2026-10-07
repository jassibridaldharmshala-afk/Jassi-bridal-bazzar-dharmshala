import DataTable from '../../components/admin/DataTable';
import PageHeader from '../../components/admin/PageHeader';

export { default } from './ProductCatalogManager';

export function AdminPage({ title, action, href, children }) {
  return (
    <section className="space-y-5">
      <PageHeader title={title}>{action && <a href={href} className="admin-btn">{action}</a>}</PageHeader>
      {children}
    </section>
  );
}

export function AdminTable({ heads, rows, title = 'Records', emptyTitle = `No ${title.toLowerCase()} found` }) {
  const normalized = rows.map((row, rowIndex) => Array.isArray(row)
    ? <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex} className="px-4 py-4">{cell}</td>)}</tr>
    : row);
  return <DataTable title={title} heads={heads} rows={normalized} emptyTitle={emptyTitle} />;
}
