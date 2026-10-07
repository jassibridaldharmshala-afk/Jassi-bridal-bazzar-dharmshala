import { useEffect, useRef, useState } from 'react';

// Reserved space avoids collapsing the page. Once mounted, keep the subtree
// alive so scrolling away never resets a form, preview or scroll position.
export default function DeferredMount({ children, minHeight = 480, label = 'preview', rootMargin = '300px' }) {
  const target = useRef(null);
  const [mounted, setMounted] = useState(() => typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    if (mounted) return undefined;
    let active = true;
    const observer = new IntersectionObserver((entries) => {
      if (active && entries.some((entry) => entry.isIntersecting)) {
        setMounted(true);
        observer.disconnect();
      }
    }, { rootMargin });
    if (target.current) observer.observe(target.current);
    return () => { active = false; observer.disconnect(); };
  }, [mounted, rootMargin]);
  return <div ref={target} style={mounted ? undefined : { minHeight }}>
    {mounted ? children : <div className="grid place-items-center p-6 text-center text-sm text-slate-500" style={{ minHeight }}>
      <div><p>The {label} loads when you reach this section.</p><button type="button" onClick={() => setMounted(true)} className="mt-3 rounded-lg border bg-white px-4 py-2 font-bold text-wine">Load {label} now</button></div>
    </div>}
  </div>;
}
