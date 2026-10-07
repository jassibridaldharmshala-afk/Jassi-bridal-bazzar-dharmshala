import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';

export default function useSellerQuery(path, { list = false } = {}) {
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  useEffect(() => {
    let active = true;
    setState({ data: null, loading: true, error: '' });
    api.get(path).then(response => {
      const data = list ? (Array.isArray(response) ? response : response?.items) : response;
      if (!data || typeof data !== 'object' || (list && (!Array.isArray(data) || data.some(item => !item || typeof item !== 'object')))) {
        throw new Error('The store returned incomplete data. Please try again.');
      }
      if (active) setState({ data, loading: false, error: '' });
    }).catch(error => {
      if (active) setState({ data: null, loading: false, error: error.message || 'Unable to load this screen. Please try again.' });
    });
    return () => { active = false; };
  }, [path, list, attempt]);
  return { ...state, retry };
}
