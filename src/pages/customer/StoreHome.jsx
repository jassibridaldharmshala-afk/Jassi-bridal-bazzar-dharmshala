import { useEffect, useState } from 'react';
import Home from './Home';
import PageState from '../../components/ui/PageState';
import StorefrontSkeleton from '../../components/ui/StorefrontSkeleton';
import { useStorefront } from '../../context/StorefrontContext';
import { storefrontPath } from '../../utils/routing';

export default function StoreHome(props) {
  const { store, storeSlug, loading, error, retry } = useStorefront();
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    const end = store?.festivalCampaign?.countdownEndsAt;
    if (!end) { setRemaining(''); return undefined; }
    const update = () => setRemaining(formatRemaining(end));
    update();
    const timer = window.setInterval(update, 60000);
    return () => window.clearInterval(timer);
  }, [store?.festivalCampaign?.countdownEndsAt]);

  if (loading) return <StorefrontSkeleton label="Opening boutique" />;
  if (error) return <PageState error={error} onRetry={retry} />;
  if (!store) return <PageState error="This boutique is not published yet." />;

  return (
    <div>
      {campaignIsLive(store.festivalCampaign) && <section className={`border-b border-[#e6c58a] bg-gradient-to-r ${campaignGradient(store.festivalCampaign.preset)} px-3 py-2 text-charcoal sm:px-4 sm:py-3`}>
        <div className="container-page flex items-center justify-between gap-2">
          <div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[0.16em] opacity-65 sm:text-[10px]">{store.festivalCampaign.badgeText || 'Limited-time edit'}</p><h2 className="truncate text-sm font-black sm:mt-0.5 sm:text-lg">{store.festivalCampaign.title}</h2></div>
          <div className="flex shrink-0 items-center gap-1.5 text-[10px] font-black sm:gap-2 sm:text-xs">{store.festivalCampaign.couponCode && <span className="rounded-full border border-current/20 bg-white/60 px-2 py-1 sm:px-3 sm:py-1.5">Use {store.festivalCampaign.couponCode}</span>}{remaining && <span className="rounded-full bg-wine px-2 py-1 text-white sm:px-3 sm:py-1.5">{remaining}</span>}</div>
        </div>
           </section>}
      <div className="bg-wine px-3 py-3 text-white sm:px-4 sm:py-5 lg:py-6">
        <div className="container-page flex items-center gap-3 sm:block">
          {store.logo && <img src={store.logo} alt="" className="h-10 w-10 shrink-0 rounded-full border border-white/20 bg-white object-cover sm:hidden" />}
          <div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/65 sm:text-xs sm:tracking-[0.24em]">Boutique</p>
          <h1 className="truncate font-display text-lg font-black sm:mt-2 sm:text-3xl">{store.name}</h1>
          {store.bio && <p className="mt-0.5 line-clamp-1 max-w-2xl text-[11px] text-white/75 sm:mt-2 sm:line-clamp-none sm:text-sm sm:text-white/80">{store.bio}</p>}</div>
        </div>
      </div>
      <Home
        {...props}
        storeSlug={storeSlug}
        industry={store.industry || 'fashion'}
        industrySections={store.catalog?.homepageSections || []}
        navigate={path => props.navigate(storefrontPath(path, storeSlug))}
      />
    </div>
  );
}

function formatRemaining(value) {
  const milliseconds = new Date(value).getTime() - Date.now();
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return 'Offer ended';
  const days = Math.floor(milliseconds / 86400000);
  const hours = Math.floor((milliseconds % 86400000) / 3600000);
  return days > 0 ? `${days}d ${hours}h left` : `${Math.max(1, hours)}h left`;
}

function campaignGradient(preset) {
  if (preset === 'diwali') return 'from-[#fff2c8] via-[#ffd9a8] to-[#f7b58f]';
  if (preset === 'eid') return 'from-[#dcfce7] via-[#ecfccb] to-[#fef3c7]';
  if (preset === 'christmas') return 'from-[#fee2e2] via-[#dcfce7] to-[#fef3c7]';
  if (preset === 'black-friday') return 'from-[#e5e7eb] via-[#f3f4f6] to-[#fecdd3]';
  return 'from-[#fde7ef] via-[#fff2e8] to-[#fce7c7]';
}

function campaignIsLive(campaign) {
  if (!campaign?.enabled) return false;
  const now = Date.now();
  const startsAt = campaign.startsAt ? new Date(campaign.startsAt).getTime() : null;
  const endsAt = campaign.countdownEndsAt ? new Date(campaign.countdownEndsAt).getTime() : null;
  return (!startsAt || startsAt <= now) && (!endsAt || endsAt > now);
}
