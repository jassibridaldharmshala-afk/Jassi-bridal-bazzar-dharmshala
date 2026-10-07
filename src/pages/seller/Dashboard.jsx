import { useState } from 'react';
import { AlertTriangle, ArrowRight, BadgeIndianRupee, Boxes, CheckCircle2, PackageCheck, RefreshCw, ShoppingBag, Sparkles, Store, Users } from 'lucide-react';
import useSellerQuery from '../../hooks/useSellerQuery';
import PageState from '../../components/ui/PageState';

const ranges = [['7d', '7 days'], ['30d', '30 days'], ['90d', '90 days']];

export default function SellerDashboard({ navigate }) {
  const [range, setRange] = useState('30d');
  const statsQuery = useSellerQuery('/seller/dashboard/stats');
  const storeQuery = useSellerQuery('/stores/me/current');
  const businessQuery = useSellerQuery('/seller/business/overview');
  const salesQuery = useSellerQuery(`/seller/reports/sales?preset=${range}`);
  const queries = [statsQuery, storeQuery, businessQuery, salesQuery];
  const error = queries.find(query => query.error)?.error;
  const retry = () => queries.forEach(query => query.retry());
  if (error) return <PageState error={error} onRetry={retry} />;
  if (queries.some(query => query.loading)) return <PageState loading loadingLabel="Loading business dashboard..." />;

  const stats = statsQuery.data || {};
  const onboarding = storeQuery.data || {};
  const business = businessQuery.data || {};
  const sales = salesQuery.data || {};
  const storeData = business.store || onboarding.store || {};
  const health = business.health || { score: 0, grade: 'Setup required', checks: [], metrics: {} };
  const improvements = health.checks.filter(check => !check.passed).slice(0, 4);
  const series = sales.series || [];
  const maxRevenue = Math.max(1, ...series.map(item => Number(item.revenue || 0)));
  const cards = [
    ['Paid revenue', money(sales.totals?.revenue), BadgeIndianRupee, `${rangeLabel(range)} performance`],
    ['Orders', number(sales.totals?.orders), ShoppingBag, `${number(sales.totals?.paidOrders)} paid`],
    ['Customers', number(sales.totals?.customers), Users, `${number(stats.customers)} all time`],
    ['Live products', number(health.metrics?.activeProducts ?? stats.products), Boxes, `${number(health.metrics?.lowStock)} need stock review`],
  ];

  return (
    <section className="space-y-5 pb-8">
      <header className="overflow-hidden rounded-[24px] bg-gradient-to-br from-[#6f1731] via-[#8f123b] to-[#b02a55] p-6 text-white shadow-[0_18px_55px_rgba(91,21,47,.18)] sm:p-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div><p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/70">Business overview</p><h1 className="mt-2 font-serif text-3xl font-black sm:text-4xl">{storeData.name || 'Your store'}</h1><p className="mt-2 text-sm font-semibold text-white/75">#{storeData.slug || 'store'} · {storeData.industry || 'commerce'} · {storeData.status || 'ONBOARDING'}</p></div>
          <div className="flex flex-wrap gap-2"><Pill>{business.platform?.name || 'Store'} plan</Pill><Pill>{business.platform?.status || 'Active'} licence</Pill><button type="button" onClick={retry} className="grid h-10 w-10 place-items-center rounded-full border border-white/25 bg-white/10" aria-label="Refresh dashboard"><RefreshCw size={16} /></button></div>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black text-charcoal">Performance</h2><p className="text-sm font-semibold text-slate-500">Figures come from this store's orders and payments.</p></div><div className="flex rounded-xl border border-theme-border bg-white p-1">{ranges.map(([value, label]) => <button key={value} type="button" onClick={() => setRange(value)} className={`rounded-lg px-3 py-2 text-xs font-black ${range === value ? 'bg-wine text-white' : 'text-slate-500'}`}>{label}</button>)}</div></div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value, Icon, note]) => <article key={label} className="rounded-[20px] border border-theme-border bg-white p-5 shadow-[0_10px_30px_rgba(61,37,30,.06)]"><div className="flex items-center justify-between"><span className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">{label}</span><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#f9eef1] text-wine"><Icon size={19} /></span></div><strong className="mt-4 block text-2xl font-black text-charcoal">{value}</strong><p className="mt-1 text-xs font-semibold text-slate-500">{note}</p></article>)}</div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,.8fr)]">
        <article className="rounded-[22px] border border-theme-border bg-white p-5 shadow-sm sm:p-6">
          <div><h2 className="text-lg font-black">Revenue trend</h2><p className="text-xs font-semibold text-slate-500">Paid order value for the selected period</p></div>
          {series.length ? <div className="mt-7 flex h-48 items-end gap-2" aria-label="Revenue trend chart">{series.map((item, index) => <div key={`${item.label}-${index}`} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-2"><span className="invisible text-[9px] font-bold text-wine group-hover:visible">{money(item.revenue)}</span><div className="w-full min-w-[8px] rounded-t-lg bg-gradient-to-t from-wine to-[#d9869f] transition-all" style={{ height: `${Math.max(5, Math.round(Number(item.revenue || 0) / maxRevenue * 145))}px` }} title={`${item.label}: ${money(item.revenue)}`} /><span className="max-w-full truncate text-[9px] font-bold text-slate-400">{item.label}</span></div>)}</div> : <EmptyChart />}
        </article>

        <article className="rounded-[22px] border border-theme-border bg-white p-5 shadow-sm sm:p-6"><div className="flex items-start justify-between gap-5"><div><p className="text-[11px] font-black uppercase tracking-[0.16em] text-wine">Store health</p><h2 className="mt-1 text-xl font-black">{health.grade}</h2><p className="mt-1 text-xs font-semibold text-slate-500">Based on catalogue, setup and operations.</p></div><div className="grid h-24 w-24 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(#8f123b ${health.score * 3.6}deg,#f1e5e8 0)` }}><div className="grid h-[74px] w-[74px] place-items-center rounded-full bg-white"><strong className="text-xl text-wine">{health.score}<small className="text-xs">/100</small></strong></div></div></div><button type="button" onClick={() => navigate('/seller/business')} className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-wine text-sm font-black text-white">Improve store <ArrowRight size={16} /></button></article>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <article className="rounded-[22px] border border-theme-border bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-700"><AlertTriangle size={19} /></span><div><h2 className="font-black">Needs attention</h2><p className="text-xs font-semibold text-slate-500">Highest impact improvements first</p></div></div><div className="mt-5 grid gap-3">{improvements.length ? improvements.map(check => <button type="button" key={check.id} onClick={() => navigate(check.route)} className="flex items-center justify-between gap-3 rounded-xl border border-[#eee4dc] p-3 text-left"><span><strong className="block text-sm">{check.label}</strong><small className="mt-1 block text-slate-500">{check.recommendation}</small></span><ArrowRight className="shrink-0 text-wine" size={16} /></button>) : <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800"><CheckCircle2 size={19} />Your core store setup is healthy.</div>}</div></article>

        <article className="rounded-[22px] border border-theme-border bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#f9eef1] text-wine"><Sparkles size={19} /></span><div><h2 className="font-black">Quick actions</h2><p className="text-xs font-semibold text-slate-500">Continue common business tasks</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{[
          ['Add product', '/seller/products/add', Boxes], ['Orders', '/seller/orders', PackageCheck], ['Business centre', '/seller/business', Sparkles], ['Store designer', '/seller/design', Store],
        ].map(([label, path, Icon]) => <button type="button" key={path} onClick={() => navigate(path)} className="flex h-14 items-center gap-3 rounded-xl border border-[#eee4dc] px-4 text-left text-sm font-black hover:border-wine/40 hover:bg-[#fffaf8]"><Icon size={18} className="text-wine" />{label}</button>)}</div></article>
      </div>
    </section>
  );
}

function Pill({ children }) { return <span className="rounded-full border border-white/25 bg-white/10 px-3 py-2 text-xs font-black uppercase tracking-wide">{children}</span>; }
function EmptyChart() { return <div className="mt-6 grid h-48 place-items-center rounded-xl bg-[#fbf8f4] text-center"><div><ShoppingBag className="mx-auto text-wine/40" /><p className="mt-2 text-sm font-bold">No order revenue in this period</p><small className="text-slate-500">Paid sales will appear here automatically.</small></div></div>; }
function money(value) { return `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`; }
function number(value) { return Number(value || 0).toLocaleString('en-IN'); }
function rangeLabel(value) { return ranges.find(item => item[0] === value)?.[1] || 'Selected period'; }
