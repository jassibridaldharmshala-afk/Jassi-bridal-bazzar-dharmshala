const styles = {
  Active: 'bg-blush text-wine',
  Inactive: 'bg-[#f6efe8] text-slate-600',
  Pending: 'bg-[#fff4e8] text-[#9a5b20]',
  Confirmed: 'bg-[#eef5ff] text-[#355d9a]',
  Packed: 'bg-[#f4edff] text-[#6b4aa8]',
  Shipped: 'bg-[#eef5ff] text-[#355d9a]',
  Delivered: 'bg-[#eef8f1] text-[#2f6b4a]',
  'Out for Delivery': 'bg-[#eef5ff] text-[#355d9a]',
  Cancelled: 'bg-red-50 text-red-800',
  Paid: 'bg-[#eef8f1] text-[#2f6b4a]',
  Failed: 'bg-red-50 text-red-800',
  Refunded: 'bg-[#f4edff] text-[#6b4aa8]',
  Visible: 'bg-[#eef8f1] text-[#2f6b4a]',
  Hidden: 'bg-[#f6efe8] text-slate-600',
  Published: 'bg-[#eef8f1] text-[#2f6b4a]',
  Rejected: 'bg-red-50 text-red-800',
  Archived: 'bg-slate-100 text-slate-600',
  Blocked: 'bg-red-50 text-red-800',
  Requested: 'bg-[#fff4e8] text-[#9a5b20]',
  'Return Requested': 'bg-[#fff4e8] text-[#9a5b20]',
  'Exchange Requested': 'bg-[#fff4e8] text-[#9a5b20]',
  Returned: 'bg-[#f4edff] text-[#6b4aa8]',
  'Out of Stock': 'bg-red-50 text-red-800',
  Approved: 'bg-[#eef8f1] text-[#2f6b4a]',
};

export default function StatusBadge({ value }) {
  return <span className={`inline-flex rounded-full px-3 py-1 text-[12px] font-semibold ${styles[value] || 'bg-blush text-wine'}`}>{value}</span>;
}
