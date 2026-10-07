const LOCAL_API_PORT = '5000';
const PRODUCTION_API_URL = 'https://samira-collection-backend-1.onrender.com/api';

function isLocalHostname(hostname = '') {
  if (['localhost', '127.0.0.1', '::1'].includes(hostname)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  return false;
}

function withApiSuffix(url = '') {
  const trimmed = String(url || '').trim().replace(/\/$/, '');
  if (!trimmed) return '';
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
}

export function resolveApiBaseUrl(hostname, configuredUrl = '') {
  if (isLocalHostname(hostname)) {
    const host = hostname === '::1' ? '127.0.0.1' : hostname;
    try {
      const configured = new URL(withApiSuffix(configuredUrl));
      if (isLocalHostname(configured.hostname)) {
        // Honour an explicitly configured local backend port. A phone opening
        // the dev machine over LAN must not call the phone's own localhost.
        if (['localhost', '127.0.0.1', '[::1]', '::1'].includes(configured.hostname)) configured.hostname = host;
        return configured.toString().replace(/\/$/, '');
      }
    } catch { /* Missing/malformed local configuration uses the usual backend. */ }
    return `http://${host}:${LOCAL_API_PORT}/api`;
  }
  return withApiSuffix(configuredUrl) || PRODUCTION_API_URL;
}

export function getApiBaseUrl() {
  return resolveApiBaseUrl(typeof window !== 'undefined' ? window.location.hostname : '', process.env.REACT_APP_API_URL);
}
