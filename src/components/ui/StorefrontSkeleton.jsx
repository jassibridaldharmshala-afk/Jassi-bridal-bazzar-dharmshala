export default function StorefrontSkeleton({ label = 'Loading the collection', hero = true }) {
  return (
    <section data-storefront-skeleton className="min-h-[70vh] bg-ivory px-3 py-4" role="status" aria-busy="true" aria-label={label}>
      <span className="sr-only">{label}</span>
      <div className="mx-auto max-w-6xl space-y-5 motion-safe:animate-pulse" aria-hidden="true">
        {hero && <div className="h-[190px] rounded-2xl skeleton-block md:h-[260px]" />}
        {hero && <div className="flex justify-between gap-3 overflow-hidden">
          {[0, 1, 2, 3, 4].map(item => <div key={item} className="h-16 w-16 shrink-0 rounded-full skeleton-block" />)}
        </div>}
        <div className="h-5 w-40 rounded skeleton-block" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map(item => <div key={item} className="space-y-3 rounded-xl bg-white p-2">
            <div className="aspect-[3/4] rounded-lg skeleton-block" />
            <div className="h-3 w-3/4 rounded skeleton-block" />
            <div className="h-3 w-1/3 rounded skeleton-block" />
          </div>)}
        </div>
      </div>
    </section>
  );
}
