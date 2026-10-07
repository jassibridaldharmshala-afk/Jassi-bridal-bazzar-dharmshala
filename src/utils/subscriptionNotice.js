export const SUBSCRIPTION_STATUS_EVENT = 'samira:subscription-status';
export const SUBSCRIPTION_REQUIRED_EVENT = 'samira:subscription-required';
const STATUSES = ['ACTIVE', 'TRIAL', 'EXPIRED', 'SUSPENDED', 'REVOKED'];

export function subscriptionIdentity(user) {
  return String(user?._id || user?.id || user?.phone || '');
}

export function isRestrictedSubscription(status) {
  return ['EXPIRED', 'SUSPENDED', 'REVOKED'].includes(status);
}

export function normalizeSubscription(data, previousOffset = 0) {
  if (data?.managed === false) return { managed: false };
  if (data?.managed !== true || !data.installationId || !STATUSES.includes(data.status)) return null;
  const serverNow = Date.parse(data.serverNow);
  const clockOffset = Number.isFinite(serverNow) ? serverNow - Date.now() : previousOffset;
  const endsAt = Date.parse(data.endsAt);
  const expired = ['ACTIVE', 'TRIAL'].includes(data.status) && Number.isFinite(endsAt)
    && endsAt <= Date.now() + clockOffset;
  return { ...data, clockOffset, status: expired ? 'EXPIRED' : data.status };
}

export function subscriptionNoticeKey(data) {
  return data?.managed && isRestrictedSubscription(data.status)
    ? [data.installationId, data.status, data.billingCycle || '', data.endsAt || ''].join('|') : '';
}

export function subscriptionNoticeCopy(data) {
  const period = { TRIAL: 'Free trial', MONTHLY: 'Monthly subscription', YEARLY: 'Yearly subscription', LIFETIME: 'Lifetime access' }[data?.billingCycle] || 'Subscription';
  if (data?.status === 'SUSPENDED') return { period, title: 'Your subscription is suspended', description: 'Contact the platform owner to review and restore your access. Renewal alone may not remove this restriction.', action: 'Review access' };
  if (data?.status === 'REVOKED') return { period, title: 'Client access has been revoked', description: 'The platform owner must restore this installation before it can accept new orders or restricted changes.', action: 'Review access' };
  return {
    period, title: data?.billingCycle === 'TRIAL' ? 'Your free trial has ended' : `Your ${period.toLowerCase()} has expired`,
    description: 'Contact the platform owner to renew your access, or review the available renewal options.',
    action: 'View renewal options',
  };
}

export function publishSubscriptionStatus(data, user) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(SUBSCRIPTION_STATUS_EVENT, {
    detail: { data, userId: subscriptionIdentity(user) },
  }));
}
