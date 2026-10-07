import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function useDesktopFeedback() {
  const { setToast } = useAuth();
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const media = window.matchMedia('(min-width: 768px)');
    const onChange = (event) => setIsDesktop(event.matches);
    media.addEventListener('change', onChange);
    setIsDesktop(media.matches);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const notify = useCallback((message, type = 'info', title = '') => {
    if (!message) return false;
    if (isDesktop) {
      setToast({ message, type, title });
      return true;
    }
    return false;
  }, [isDesktop, setToast]);

  const notifyIfDesktop = useCallback((message, type = 'info', title = '') => notify(message, type, title), [notify]);

  return {
    isDesktop,
    notify: notifyIfDesktop,
  };
}
