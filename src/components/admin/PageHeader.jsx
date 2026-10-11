import './AdminCompact.css';

export default function PageHeader({ title, note, actionLabel, actionHref, children, kicker = 'Admin', compact = false }) {
  if (compact) return <>
    <h1 className="sr-only">{title}</h1>
    {(children || actionLabel) && <div className="admin-compact-actions">
      {children}
      {actionLabel && <a href={actionHref} className="admin-btn">{actionLabel}</a>}
    </div>}
  </>;
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
