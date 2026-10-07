import { useEffect } from 'react';
import { BEFORE_ROUTE_CHANGE_EVENT } from '../utils/routing';

export default function useUnsavedChanges(dirty, busy = false) {
  useEffect(() => {
    if (!dirty && !busy) return undefined;
    const unload = (event) => { event.preventDefault(); event.returnValue = ''; };
    const leave = (event) => {
      if (busy || !window.confirm('Leave this page? Unsaved changes will be lost.')) event.preventDefault();
    };
    window.addEventListener('beforeunload', unload);
    window.addEventListener(BEFORE_ROUTE_CHANGE_EVENT, leave);
    return () => {
      window.removeEventListener('beforeunload', unload);
      window.removeEventListener(BEFORE_ROUTE_CHANGE_EVENT, leave);
    };
  }, [dirty, busy]);
}
