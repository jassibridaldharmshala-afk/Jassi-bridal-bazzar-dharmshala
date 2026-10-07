import Login from '../customer/Login';

/**
 * Backward-compatible entry point for old /admin/login links.
 * Admin identity is established by the shared mobile + OTP flow; the backend
 * decides whether the verified number owns the admin role.
 */
export default function AdminLogin({ route = '/admin/login' }) {
  const queryIndex = route.indexOf('?');
  const params = new URLSearchParams(queryIndex >= 0 ? route.slice(queryIndex + 1) : '');
  const redirect = safeAdminRedirect(params.get('redirect'));
  params.set('redirect', redirect);

  return <Login route={`/login?${params.toString()}`} />;
}

function safeAdminRedirect(target = '') {
  const nextTarget = String(target || '');
  if (
    !nextTarget.startsWith('/admin')
    || nextTarget.startsWith('//')
    || nextTarget.startsWith('/admin/login')
  ) {
    return '/admin';
  }
  return nextTarget;
}
