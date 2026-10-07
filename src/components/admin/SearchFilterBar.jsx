import { Search } from 'lucide-react';

export default function SearchFilterBar({ search, onSearch, children, placeholder = 'Search records' }) {
  return (
    <div className="admin-card admin-filter-bar">
      <label className="admin-filter-bar__search">
        <Search className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">Search</span>
        <input
          type="search"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
        />
      </label>
      {children ? <div className="admin-filter-bar__controls">{children}</div> : null}
    </div>
  );
}
