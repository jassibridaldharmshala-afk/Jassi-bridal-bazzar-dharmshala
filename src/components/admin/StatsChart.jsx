export default function StatsChart({ title = 'Revenue Overview', points = [], labels = [] } = {}) {
  const values = points.length ? points.map((point) => Number(point || 0)) : [];
  const max = Math.max(...values, 1);
  const bars = values.length ? values : [0];

  return (
    <div className="admin-card p-4 md:p-5">
      <h2>{title}</h2>
      {values.length ? (
        <div className="mt-5 flex h-40 items-end gap-2 md:mt-6 md:h-52 md:gap-3">
          {bars.map((point, index) => (
            <div key={`${title}-${index}`} className="flex flex-1 flex-col items-center gap-2">
              <div className="w-full rounded-t-xl bg-gradient-to-t from-wine to-rose" style={{ height: `${Math.max(6, (point / max) * 100)}%` }} />
              <span className="text-[10px] font-black text-slate-400">{labels[index] || `${index + 1}`}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-6 text-sm font-semibold text-slate-500">No data for this range yet.</p>
      )}
    </div>
  );
}
