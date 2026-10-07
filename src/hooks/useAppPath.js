import { useEffect, useState } from 'react';
import { ROUTE_CHANGE_EVENT } from '../utils/routing';

export default function useAppPath() {
  const [path, setPath] = useState(() => (typeof window !== 'undefined' ? window.location.pathname : '/'));

  useEffect(() => {
    const onChange = () => setPath(window.location.pathname || '/');
    window.addEventListener('popstate', onChange);
    window.addEventListener('hashchange', onChange);
    window.addEventListener(ROUTE_CHANGE_EVENT, onChange);
    return () => {
      window.removeEventListener('popstate', onChange);
      window.removeEventListener('hashchange', onChange);
      window.removeEventListener(ROUTE_CHANGE_EVENT, onChange);
    };
  }, []);

  return path;
}
