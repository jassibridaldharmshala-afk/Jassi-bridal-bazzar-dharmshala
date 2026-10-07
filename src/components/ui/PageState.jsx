import MobileOverlayLoader from './MobileOverlayLoader';

export default function PageState({
  loading = false,
  error = '',
  empty = false,
  loadingLabel = 'Loading...',
  emptyTitle = 'Nothing to show yet',
  emptyNote = 'Try again in a moment or browse another page.',
  onRetry,
  children,
}) {
  if (loading) {
    return (
      <>
        <MobileOverlayLoader label={loadingLabel} overlay={false} />
        <div className="hidden rounded-2xl bg-white p-8 text-center shadow-sm md:block" role="status" aria-busy="true">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-[3px] border-wine border-t-transparent" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-slate-500">{loadingLabel}</p>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-bold text-rose">{error}</p>
        {onRetry ? (
          <button type="button" onClick={onRetry} className="mt-4 h-11 rounded-xl bg-wine px-5 text-sm font-black text-white">
            Try again
          </button>
        ) : null}
      </div>
    );
  }

  if (empty) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
        <h2 className="text-xl font-black text-charcoal">{emptyTitle}</h2>
        <p className="mt-2 text-sm font-semibold text-slate-500">{emptyNote}</p>
        {onRetry ? (
          <button type="button" onClick={onRetry} className="mt-4 h-11 rounded-xl border border-slate-200 px-5 text-sm font-black">
            Refresh
          </button>
        ) : null}
      </div>
    );
  }

  return children;
}
