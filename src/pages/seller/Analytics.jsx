import { useState } from 'react';
import useSellerQuery from '../../hooks/useSellerQuery';
import PageState from '../../components/ui/PageState';

export default function SellerAnalytics() {
  const [range, setRange] = useState('30d');
  const { data, loading, error, retry } = useSellerQuery(`/seller/analytics/funnel?range=${range}`);
  if (error) return <PageState error={error} onRetry={retry} />;
  if (loading) return <PageState loading loadingLabel="Loading store analytics..." />;

  const events = Object.entries(data.events || {});

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Sales analytics</h1>
          <p className="text-sm font-semibold text-slate-500">{data.note}</p>
        </div>
        <select aria-label="Analytics period" className="h-11 rounded-xl border px-3 text-sm font-bold" value={range} onChange={(event) => setRange(event.target.value)}>
          <option value="today">Today</option>
          <option value="7d">7 days</option>
          <option value="30d">30 days</option>
          <option value="90d">90 days</option>
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {events.map(([name, count]) => (
          <div key={name} className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">{name.replace(/_/g, ' ')}</p>
            <p className="mt-2 text-2xl font-black">{count}</p>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black">Attributed sales</h2>
        {!data.attributedSales?.length ? <p className="mt-2 text-sm font-semibold text-slate-500">No attributed orders yet. Share links with source, campaign or reel parameters.</p> : (
          <table className="mt-3 min-w-full text-left text-sm">
            <thead className="text-xs font-black uppercase tracking-wider text-slate-500">
              <tr>
                {['Source', 'Campaign', 'Reel', 'Orders', 'Revenue'].map((head) => <th key={head} className="py-2">{head}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.attributedSales.map((row) => (
                <tr key={`${row.source}-${row.campaign}-${row.reelId}`} className="border-t">
                  <td className="py-2 font-bold">{row.source || '—'}</td>
                  <td className="py-2">{row.campaign || '—'}</td>
                  <td className="py-2">{row.reelId || '—'}</td>
                  <td className="py-2">{row.orders}</td>
                  <td className="py-2">Rs. {row.revenue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
