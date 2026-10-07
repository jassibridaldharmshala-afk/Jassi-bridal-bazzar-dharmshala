export default function DashboardCard({ title, value, note }) {
  return (
    <div className="admin-card p-5">
      <p className="admin-kicker">{title}</p>
      <p className="mt-3 text-[26px] font-semibold text-charcoal">{value}</p>
      <p className="mt-2 text-[13px] text-slate-500">{note}</p>
    </div>
  );
}
