export default function PageHeader({ title, note, actionLabel, actionHref, children, kicker = 'Admin' }) {
  return (
    <div className="admin-card admin-page-header">
      <div className="admin-page-header__copy">
        <p className="admin-kicker">{kicker} / {title}</p>
        <h1 className="mt-2">{title}</h1>
        {note && <p className="admin-note">{note}</p>}
      </div>
      <div className="admin-page-header__actions">
        {children}
        {actionLabel && <a href={actionHref} className="admin-btn">{actionLabel}</a>}
      </div>
    </div>
  );
}
