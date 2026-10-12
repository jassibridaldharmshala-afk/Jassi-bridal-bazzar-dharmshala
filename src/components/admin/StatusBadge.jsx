const styles = {
  Active: 'bg-blush text-wine',
  Inactive: 'bg-[color:var(--site-accent-soft)] text-[color:var(--site-muted)]',
  Pending: 'bg-[color:var(--site-accent-soft)] text-[color:var(--site-accent)]',
  Confirmed: 'bg-[color:var(--site-info-soft)] text-[color:var(--site-info)]',
  Packed: 'bg-[color:var(--site-info-soft)] text-[color:var(--site-muted)]',
  Shipped: 'bg-[color:var(--site-info-soft)] text-[color:var(--site-info)]',
  Delivered: 'bg-[color:var(--site-success-soft)] text-[color:var(--site-success)]',
  'Out for Delivery': 'bg-[color:var(--site-info-soft)] text-[color:var(--site-info)]',
  Cancelled: 'bg-[color:var(--site-danger-soft)] text-[color:var(--site-danger)]',
  Paid: 'bg-[color:var(--site-success-soft)] text-[color:var(--site-success)]',
  Failed: 'bg-[color:var(--site-danger-soft)] text-[color:var(--site-danger)]',
  Refunded: 'bg-[color:var(--site-info-soft)] text-[color:var(--site-muted)]',
  Visible: 'bg-[color:var(--site-success-soft)] text-[color:var(--site-success)]',
  Hidden: 'bg-[color:var(--site-accent-soft)] text-[color:var(--site-muted)]',
  Published: 'bg-[color:var(--site-success-soft)] text-[color:var(--site-success)]',
  Rejected: 'bg-[color:var(--site-danger-soft)] text-[color:var(--site-danger)]',
  Archived: 'bg-[color:var(--site-surface-alt)] text-[color:var(--site-muted)]',
  Blocked: 'bg-[color:var(--site-danger-soft)] text-[color:var(--site-danger)]',
  Requested: 'bg-[color:var(--site-accent-soft)] text-[color:var(--site-accent)]',
  'Return Requested': 'bg-[color:var(--site-accent-soft)] text-[color:var(--site-accent)]',
  'Exchange Requested': 'bg-[color:var(--site-accent-soft)] text-[color:var(--site-accent)]',
  Returned: 'bg-[color:var(--site-info-soft)] text-[color:var(--site-muted)]',
  'Out of Stock': 'bg-[color:var(--site-danger-soft)] text-[color:var(--site-danger)]',
  Approved: 'bg-[color:var(--site-success-soft)] text-[color:var(--site-success)]',
};

export default function StatusBadge({ value }) {
  return <span className={`inline-flex rounded-full px-3 py-1 text-[12px] font-semibold ${styles[value] || 'bg-blush text-wine'}`}>{value}</span>;
}
