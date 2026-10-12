import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, ArrowRight, BarChart3, Bot, Check, CheckCircle2, ChevronDown, CircleDollarSign,
  ExternalLink, Gift, IndianRupee, LockKeyhole, MessageCircle, PackageCheck, RefreshCw,
  RotateCcw, Send, ShoppingBag, TrendingDown, TrendingUp,
} from 'lucide-react';
import '../../components/admin/AdminCompact.css';
import api from '../../services/api';
import PageState from '../../components/ui/PageState';
import { useAuth } from '../../context/AuthContext';

const QUESTIONS = ['Why are sales changing?', 'Which products sell best?', 'What should I restock?', 'Which customers should I target?'];
const PERIODS = [['7d', '7 days'], ['30d', '30 days'], ['90d', '90 days']];

export default function BusinessCenter() {
  const { user, notify } = useAuth();
  const adminMode = user?.activeMode === 'admin';
  const base = adminMode ? '/admin/business' : '/seller/business';
  const [range, setRange] = useState('30d');
  const [overview, setOverview] = useState(null);
  const [carts, setCarts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [question, setQuestion] = useState(QUESTIONS[0]);
  const [answer, setAnswer] = useState(null);
  const [showAllChecks, setShowAllChecks] = useState(false);

  const hasIn = useCallback((data, feature) => data?.platform?.features?.includes(feature)
    && !['EXPIRED', 'SUSPENDED', 'REVOKED'].includes(data.platform.status), []);

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const next = await api.get(`${base}/overview?range=${range}`);
      setOverview(next);
      if (hasIn(next, 'abandonedCart')) {
        const abandoned = await api.get(`${base}/abandoned-carts?limit=12`);
        setCarts(abandoned.items || []);
      } else setCarts([]);
    } catch (requestError) {
      if (!quiet) setError(requestError.message);
      else notify(requestError.message, 'error', 'Business Center');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [base, hasIn, notify, range]);

  useEffect(() => { load(); }, [load]);

  const run = async (key, task) => {
    if (busy) return;
    setBusy(key);
    try { await task(); } catch (requestError) { notify(requestError.message, 'error', 'Business Center'); }
    finally { setBusy(''); }
  };

  const ask = () => run('assistant', async () => {
    const result = await api.post(`${base}/assistant`, { question });
    setAnswer(result);
    setOverview((current) => ({
      ...current,
      health: { ...current.health, assistantHistory: [result, ...(current.health.assistantHistory || [])].slice(0, 5) },
    }));
  });

  const remind = (cart, channel) => run(`${cart.id}:${channel}`, async () => {
    const result = await api.post(`${base}/abandoned-carts/${cart.id}/reminder`, { channel });
    if (result.url) window.open(result.url, '_blank', 'noopener,noreferrer');
    notify(result.url ? 'WhatsApp message is ready for your review.' : 'The customer received an in-app reminder.', 'success', 'Cart recovery');
    await load({ quiet: true });
  });

  if (loading) return <PageState loading loadingLabel="Preparing live business insights..." />;
  if (error) return <PageState error={error} onRetry={() => load()} />;

  const health = overview.health;
  const performance = health.performance;
  const routes = routeMap(adminMode);
  const has = (feature) => hasIn(overview, feature);
  const missingChecks = health.checks.filter((check) => !check.passed);
  const visibleChecks = showAllChecks ? health.checks : (missingChecks.length ? missingChecks.slice(0, 4) : health.checks.slice(0, 4));
  const locked = [
    !has('businessAssistant') && ['Business assistant', 'Answers from live orders, products and customer data.'],
    !has('abandonedCart') && ['Cart recovery', 'Review eligible bags and send controlled reminders.'],
    !has('festival') && ['Campaign studio', 'Schedule storefront campaigns and measure matching sales.'],
  ].filter(Boolean);

  return (
    <section className="business-compact admin-compact mx-auto max-w-[1460px] space-y-5 pb-8 text-[color:var(--site-text)]">
      <h1 className="sr-only">Business Center</h1>
      <header className="business-compact-heading">
        <div className="business-compact-period" aria-label="Business report period">{PERIODS.map(([value,label]) => <button key={value} type="button" aria-pressed={range === value} onClick={() => setRange(value)}>{label}</button>)}</div>
        <button type="button" disabled={refreshing} onClick={() => load({ quiet: true })} className="admin-btn-ghost inline-flex items-center gap-2" aria-label="Refresh business data"><RefreshCw size={17} className={refreshing ? 'animate-spin' : ''} /> Refresh</button>
        <p className="business-compact-context">{overview.store.name} · {health.period.label} · refreshed {formatDate(health.generatedAt)} · {overview.platform.name} {String(overview.platform.status || '').toLowerCase()}</p>
      </header>

      {overview.platform.renewalMessage && <div className="flex items-start gap-3 rounded-2xl border border-[color:var(--site-warning-border)] bg-[color:var(--site-warning-soft)] p-4 text-sm text-[color:var(--site-warning)]"><AlertTriangle className="mt-0.5 shrink-0" size={18} /><p>{overview.platform.renewalMessage}</p></div>}

      <div className="admin-compact-stats">
        <Kpi icon={CircleDollarSign} label="Order value" value={`Rs. ${money(performance.current.bookedRevenue)}`} change={performance.change.bookedRevenue} note="Excludes cancelled and returned orders" />
        <Kpi icon={IndianRupee} label="Paid revenue" value={`Rs. ${money(performance.current.paidRevenue)}`} change={performance.change.paidRevenue} note="Payments marked paid" />
        <Kpi icon={PackageCheck} label="Orders" value={number(performance.current.orders)} change={performance.change.orders} note={`${performance.current.delivered || 0} delivered · ${performance.current.cancelled || 0} cancelled`} />
        <Kpi icon={BarChart3} label="Average order" value={`Rs. ${money(performance.current.averageOrderValue)}`} change={performance.change.averageOrderValue} note={`${performance.current.conversionRate || 0}% tracked store-view conversion`} />
      </div>

      <article className="rounded-[26px] border border-[color:var(--site-accent-border)] bg-[color:var(--site-surface)] p-5 shadow-sm sm:p-6">
        <SectionTitle eyebrow="Daily action list" title="Today's priorities" note="Live operational work across all dates. Open a card to resolve it at the source." />
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {health.priorities.map((item) => <a key={item.id} href={priorityLink(item, routes)} className="group rounded-2xl border border-[color:var(--site-accent-border)] bg-ivory p-4 transition hover:-translate-y-0.5 hover:border-[color:var(--site-primary-border)] hover:shadow-md">
            <div className="flex items-center justify-between gap-3"><span className={`grid h-9 w-9 place-items-center rounded-xl ${priorityTone(item.severity)}`}>{item.severity === 'complete' ? <Check size={17} /> : <PriorityIcon id={item.id} />}</span><strong className="text-2xl text-wine">{number(item.count)}</strong></div>
            <h3 className="mt-4 text-sm font-black">{item.title}</h3><p className="mt-1 min-h-10 text-xs leading-5 text-[color:var(--site-muted)]">{item.detail}</p>
            <span className="mt-3 flex items-center gap-1 text-xs font-black text-wine">{item.count ? 'Review now' : 'Open'} <ArrowRight size={13} className="transition group-hover:translate-x-0.5" /></span>
          </a>)}
        </div>
      </article>

      <div className={`grid gap-5 ${has('businessAssistant') ? 'xl:grid-cols-[.92fr_1.08fr]' : ''}`}>
        <article className="rounded-[26px] border border-[color:var(--site-accent-border)] bg-[color:var(--site-surface)] p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <SectionTitle eyebrow="Store readiness" title={health.grade} note={`${health.checks.filter((check) => check.passed).length} of ${health.checks.length} checks complete`} />
            <div className="grid h-16 w-16 place-items-center rounded-full text-lg font-black text-wine" style={{ background: `conic-gradient(var(--site-primary) ${health.score * 3.6}deg,var(--site-tint) 0)` }}><span className="grid h-12 w-12 place-items-center rounded-full bg-[color:var(--site-surface)]">{health.score}</span></div>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            {visibleChecks.map((check) => <a key={check.id} href={routes[check.routeKey] || check.route || routes.settings} className="flex items-start gap-3 rounded-2xl border border-[color:var(--site-border)] p-3 hover:border-[color:var(--site-primary-border)] hover:bg-[color:var(--site-tint)]">
              <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${check.passed ? 'bg-[color:var(--site-success-soft)] text-[color:var(--site-success)]' : 'bg-[color:var(--site-warning-soft)] text-[color:var(--site-warning)]'}`}>{check.passed ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}</span>
              <span className="min-w-0 flex-1"><strong className="text-sm">{check.label}</strong><small className="block text-xs leading-5 text-[color:var(--site-muted)]">{check.passed ? 'Ready' : check.recommendation}</small></span>
              <span className="text-[10px] font-black text-[color:var(--site-faint)]">{check.earned}/{check.weight}</span>
            </a>)}
          </div>
          {health.checks.length > 4 && <button type="button" onClick={() => setShowAllChecks((value) => !value)} className="mt-4 flex items-center gap-2 text-xs font-black text-wine">{showAllChecks ? 'Show priority checks' : `View all ${health.checks.length} checks`} <ChevronDown size={14} className={showAllChecks ? 'rotate-180' : ''} /></button>}
        </article>

        {has('businessAssistant') && <article className="rounded-[26px] border border-[color:var(--site-accent-border)] bg-[color:var(--site-surface)] p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-wine text-[color:var(--site-on-fill)]"><Bot size={20} /></span><SectionTitle eyebrow="Store-data assistant" title="Ask a useful business question" note="Answers use this store's saved products, orders, customers and carts." /></div>
          <div className="mt-5 flex gap-2 overflow-x-auto pb-1">{QUESTIONS.map((item) => <button key={item} type="button" onClick={() => setQuestion(item)} className={`shrink-0 rounded-full border px-3 py-2 text-[11px] font-bold ${question === item ? 'border-wine bg-blush text-wine' : 'border-[color:var(--site-border)]'}`}>{item}</button>)}</div>
          <div className="mt-3 flex items-end gap-2 rounded-2xl border bg-ivory p-2 focus-within:border-[color:var(--site-primary-border)]"><textarea aria-label="Business question" value={question} maxLength={500} onChange={(event) => setQuestion(event.target.value)} className="min-h-16 flex-1 resize-none bg-transparent p-2 text-sm outline-none" /><button type="button" disabled={busy === 'assistant' || question.trim().length < 3} onClick={ask} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-wine text-[color:var(--site-on-fill)] disabled:opacity-50" aria-label="Analyse live data"><Send size={17} /></button></div>
          {busy === 'assistant' && <p className="mt-3 text-xs font-bold text-[color:var(--site-muted)]">Reading live store data...</p>}
          {answer && <AnswerCard answer={answer} />}
          {!answer && health.assistantHistory?.length > 0 && <div className="mt-4 border-t pt-4"><p className="text-[10px] font-black uppercase tracking-widest text-[color:var(--site-faint)]">Recent answers</p><div className="mt-2 grid gap-2">{health.assistantHistory.slice(0, 3).map((item) => <button key={item.id || item.generatedAt} type="button" onClick={() => { setQuestion(item.question); setAnswer(item); }} className="flex items-center justify-between gap-3 rounded-xl bg-[color:var(--site-accent-soft)] px-3 py-2 text-left text-xs font-bold hover:bg-[color:var(--site-tint)]"><span className="truncate">{item.question}</span><ArrowRight size={13} /></button>)}</div></div>}
        </article>}
      </div>

      {has('abandonedCart') && <article id="recovery" className="scroll-mt-24 rounded-[26px] border border-[color:var(--site-accent-border)] bg-[color:var(--site-surface)] p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4"><SectionTitle eyebrow="Checkout recovery" title="Bring shoppers back to their bags" note="Only signed-in carts idle for 30 minutes appear. Customers are limited to one reminder in 24 hours." /><span className="rounded-full bg-[color:var(--site-tint)] px-4 py-2 text-xs font-black text-wine">{health.metrics.abandonedCarts} eligible</span></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3"><MiniMetric label="Reminders sent" value={health.recovery.remindersSent} /><MiniMetric label="Orders after reminder" value={health.recovery.recoveredOrders} /><MiniMetric label="Order value after reminder" value={`Rs. ${money(health.recovery.recoveredRevenue)}`} /></div>
        {!carts.length ? <Empty icon={ShoppingBag} title="No eligible bags need attention" text="New eligible shopping bags will appear here automatically." /> : <div className="mt-5 grid gap-3">
          {carts.map((cart) => <div key={cart.id} className="grid gap-4 rounded-2xl border border-[color:var(--site-accent-border)] p-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-black">{cart.customer?.name || 'Signed-in customer'}</p><span className="rounded-full bg-[color:var(--site-tint)] px-2 py-1 text-[10px] font-black text-wine">Rs. {money(cart.value)}</span></div><p className="mt-1 truncate text-xs text-[color:var(--site-muted)]">{cart.items.map((item) => `${item.name} x ${item.quantity}`).join(', ')}</p><p className="mt-1 text-[11px] font-bold text-[color:var(--site-faint)]">Idle {age(cart.ageMinutes)} · {cart.itemCount} items{cart.lastReminderAt ? ` · last ${String(cart.lastReminderChannel || '').toLowerCase()} reminder ${formatDate(cart.lastReminderAt)}` : ''}</p></div>
            <div className="grid grid-cols-2 gap-2"><button type="button" disabled={Boolean(busy)} onClick={() => remind(cart, 'IN_APP')} className="flex h-10 items-center justify-center gap-2 rounded-xl border px-3 text-[11px] font-black disabled:opacity-50"><Send size={14} /> In-app</button><button type="button" disabled={Boolean(busy) || !cart.customer?.phone} onClick={() => remind(cart, 'WHATSAPP_LINK')} className="flex h-10 items-center justify-center gap-2 rounded-xl bg-[color:var(--site-success)] px-3 text-[11px] font-black text-[color:var(--site-on-fill)] disabled:opacity-50"><MessageCircle size={14} /> WhatsApp <ExternalLink size={11} /></button></div>
          </div>)}
        </div>}
      </article>}

      {has('festival') && <article className="overflow-hidden rounded-[26px] border border-[color:var(--site-accent-border)] bg-[color:var(--site-surface)] shadow-sm">
        <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[1fr_auto] xl:items-center">
          <div className="flex gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[color:var(--site-accent-soft)] text-[color:var(--site-accent)]"><Gift size={21} /></span><div><SectionTitle eyebrow="Campaign workspace" title="Plan and measure campaigns in one place" note="Use the guided builder for audience targeting, checkout-enforced offer limits, responsive banners, schedules and accurate performance." /><div className="mt-4 flex flex-wrap gap-2"><span className="rounded-full bg-[color:var(--site-tint)] px-3 py-2 text-[10px] font-black text-wine">Coupon + banner sync</span><span className="rounded-full bg-[color:var(--site-tint)] px-3 py-2 text-[10px] font-black text-wine">Mobile preview</span><span className="rounded-full bg-[color:var(--site-tint)] px-3 py-2 text-[10px] font-black text-wine">Repairable publishing</span></div></div></div>
          <a href={routes.campaigns} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-wine px-5 text-sm font-black text-[color:var(--site-on-fill)]">Open campaigns <ArrowRight size={15} /></a>
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-[color:var(--site-accent-border)] bg-[color:var(--site-accent-soft)] p-4 sm:grid-cols-4 sm:px-6"><MiniMetric label="Campaigns" value={number(health.campaign?.campaigns)} /><MiniMetric label="Live now" value={number(health.campaign?.liveCampaigns)} /><MiniMetric label={`${health.period.label} orders`} value={number(health.campaign?.orders)} /><MiniMetric label="Campaign revenue" value={`Rs. ${money(health.campaign?.revenue)}`} /></div>
      </article>}

      {locked.length > 0 && <article className="rounded-[26px] border border-[color:var(--site-accent-border)] bg-[color:var(--site-accent-soft)] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4"><div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[color:var(--site-surface)] text-wine shadow-sm"><LockKeyhole size={18} /></span><SectionTitle eyebrow="Available with another plan" title="More business tools" note={`This store currently uses ${overview.platform.name} · ${overview.platform.status}.`} /></div><a href={routes.access} className="flex h-10 items-center gap-2 rounded-xl border bg-[color:var(--site-surface)] px-4 text-xs font-black text-wine">View access <ArrowRight size={13} /></a></div>
        <div className="mt-4 grid gap-2 md:grid-cols-3">{locked.map(([title, note]) => <div key={title} className="rounded-2xl bg-[color:var(--site-surface)] p-4"><p className="text-sm font-black">{title}</p><p className="mt-1 text-xs leading-5 text-[color:var(--site-muted)]">{note}</p></div>)}</div>
      </article>}
    </section>
  );
}

function Kpi({ icon: Icon, label, value, change, note }) {
  const positive = change > 0; const negative = change < 0;
  return <article className="rounded-[22px] border border-[color:var(--site-accent-border)] bg-[color:var(--site-surface)] p-4 shadow-sm"><div className="flex items-center justify-between gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[color:var(--site-tint)] text-wine"><Icon size={18} /></span><Change value={change} positive={positive} negative={negative} /></div><p className="mt-4 text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--site-faint)]">{label}</p><p className="mt-1 text-2xl font-black tracking-tight">{value}</p><p className="mt-1 text-[11px] leading-4 text-[color:var(--site-muted)]">{note}</p></article>;
}
function Change({ value, positive, negative }) { if (value == null) return <span className="rounded-full bg-[color:var(--site-info-soft)] px-2 py-1 text-[10px] font-black text-[color:var(--site-info)]">New</span>; return <span className={`flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black ${positive ? 'bg-[color:var(--site-success-soft)] text-[color:var(--site-success)]' : negative ? 'bg-[color:var(--site-tint)] text-[color:var(--site-primary)]' : 'bg-[color:var(--site-background)] text-[color:var(--site-muted)]'}`}>{positive ? <TrendingUp size={12} /> : negative ? <TrendingDown size={12} /> : null}{Math.abs(value)}% vs prior</span>; }
function MiniMetric({ label, value }) { return <div className="min-w-0 rounded-2xl bg-[color:var(--site-accent-soft)] p-3"><p className="truncate text-[9px] font-black uppercase tracking-wider text-[color:var(--site-faint)]">{label}</p><p className="mt-1 truncate text-base font-black text-wine">{value}</p></div>; }
function SectionTitle({ eyebrow, title, note }) { return <div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-wine">{eyebrow}</p><h2 className="mt-1 font-display text-xl font-black sm:text-2xl">{title}</h2>{note && <p className="mt-1 text-xs leading-5 text-[color:var(--site-muted)]">{note}</p>}</div>; }
function PriorityIcon({ id }) { if (id === 'fulfilment') return <PackageCheck size={17} />; if (id === 'returns') return <RotateCcw size={17} />; if (id === 'recovery') return <ShoppingBag size={17} />; return <AlertTriangle size={17} />; }
function priorityTone(severity) { if (severity === 'complete') return 'bg-[color:var(--site-success-soft)] text-[color:var(--site-success)]'; if (severity === 'urgent') return 'bg-[color:var(--site-tint)] text-[color:var(--site-primary)]'; if (severity === 'opportunity') return 'bg-[color:var(--site-info-soft)] text-[color:var(--site-info)]'; return 'bg-[color:var(--site-warning-soft)] text-[color:var(--site-warning)]'; }
function priorityLink(item, routes) { if (item.id === 'fulfilment') return `${routes.orders}?attention=fulfilment`; if (item.id === 'returns') return routes.returns; if (item.id === 'inventory') return `${routes.inventory}?filter=attention`; return '#recovery'; }
function Empty({ icon: Icon, title, text }) { return <div className="mt-5 rounded-2xl border border-dashed border-[color:var(--site-accent-border)] bg-ivory p-8 text-center"><Icon className="mx-auto text-[color:var(--site-faint)]" /><p className="mt-3 text-sm font-black">{title}</p><p className="mt-1 text-xs text-[color:var(--site-muted)]">{text}</p></div>; }
function AnswerCard({ answer }) { return <div className="mt-4 rounded-2xl bg-[color:var(--site-accent-soft)] p-4"><p className="text-sm font-semibold leading-6">{answer.answer}</p>{answer.actions?.length > 0 && <ul className="mt-3 grid gap-2 text-xs text-[color:var(--site-muted)]">{answer.actions.map((item) => <li key={item} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--site-success)]" />{item}</li>)}</ul>}<p className="mt-3 text-[9px] font-black uppercase tracking-widest text-[color:var(--site-faint)]">Live store data · {formatDate(answer.generatedAt)}</p></div>; }
function routeMap(admin) { return admin ? { settings: '/admin/settings', products: '/admin/products', inventory: '/admin/inventory', social: '/admin/social', business: '/admin/business', campaigns: '/admin/campaigns', offers: '/admin/coupons', crm: '/admin/customers', orders: '/admin/orders', returns: '/admin/returns?status=Requested', access: '/admin/system', storefront: '/' } : { settings: '/seller/settings', products: '/seller/products', inventory: '/seller/inventory', social: '/seller/social', business: '/seller/business', campaigns: '/seller/campaigns', offers: '/seller/offers', crm: '/seller/crm', orders: '/seller/orders', returns: '/seller/returns?status=Requested', access: '/seller/settings', storefront: '/' }; }
function formatDate(value) { if (!value) return 'just now'; const date = new Date(value); return Number.isNaN(date.getTime()) ? 'just now' : date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }); }
function money(value) { return Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 }); }
function number(value) { return Number(value || 0).toLocaleString('en-IN'); }
function age(minutes) { if (minutes < 60) return `${minutes} min`; if (minutes < 1440) return `${Math.floor(minutes / 60)} hr`; return `${Math.floor(minutes / 1440)} days`; }
