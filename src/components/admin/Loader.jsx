import MobileOverlayLoader from '../ui/MobileOverlayLoader';

export default function Loader({ label = 'Loading...' }) {
  return (
    <>
      <MobileOverlayLoader label={label} overlay={false} />
      <div className="hidden min-h-36 place-items-center admin-card p-6 md:grid" role="status" aria-busy="true">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="relative block h-10 w-10" aria-hidden="true">
            <span className="absolute inset-0 rounded-full border-[3px]" style={{ borderColor: 'var(--site-loader-track)' }} />
            <span
              className="absolute inset-0 rounded-full border-[3px] border-transparent border-r-wine border-t-wine"
              style={{ animation: 'samira-loader-spin 0.85s linear infinite', willChange: 'transform' }}
            />
          </span>
          <p className="text-sm text-slate-500">{label}</p>
        </div>
      </div>
    </>
  );
}
