export default function EmptyState({ title = 'No records found', note = 'Try changing filters or add a new record.' }) {
  return (
    <div className="admin-card p-8 text-center">
      <h2>{title}</h2>
      <p className="admin-note mx-auto">{note}</p>
    </div>
  );
}
