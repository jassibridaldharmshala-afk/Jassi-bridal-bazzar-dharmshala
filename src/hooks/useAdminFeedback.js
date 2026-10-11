import { useCallback, useRef, useState } from 'react';

export const ADMIN_FEEDBACK_EVENT = 'jassi:admin-feedback';

export function adminFeedbackToast(value, type = 'info', title = '') {
  const message = typeof value === 'string' ? value : value?.text || value?.message || '';
  if (!message) return null;
  return {
    message,
    type: value?.type || value?.tone || (value?.error ? 'error' : type),
    title: value?.title || title,
  };
}

// Publish immediately so closing a saved editor cannot discard its confirmation.
export default function useAdminFeedback(initialValue = '', type = 'info', title = '') {
  const [value, setValue] = useState(initialValue);
  const latest = useRef(initialValue);
  const setFeedback = useCallback((nextValue, nextType = type) => {
    const next = typeof nextValue === 'function' ? nextValue(latest.current) : nextValue;
    latest.current = next;
    setValue(next);
    const toast = adminFeedbackToast(next, nextType, title);
    if (toast && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(ADMIN_FEEDBACK_EVENT, { detail: toast }));
    }
  }, [title, type]);
  return [value, setFeedback];
}
