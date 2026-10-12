export default function SortDropdown() {
  return (
    <select className="h-11 rounded-xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)] px-4 text-sm font-bold text-charcoal outline-none">
      {['Recommended', 'Popularity', 'Newest First', 'Price Low to High', 'Price High to Low', 'Discount', 'Customer Rating'].map((option) => (
        <option key={option}>{option}</option>
      ))}
    </select>
  );
}
