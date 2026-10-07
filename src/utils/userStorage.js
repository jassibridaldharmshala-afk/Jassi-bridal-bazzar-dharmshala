export function createStoragePlan(prefix, user) {
  const userId = getUserId(user);
  const phone = normalizePhone(user?.phone);
  const scope = userId ? `user_${userId}` : phone ? `phone_${phone}` : 'guest';
  const storageName = `${prefix}_${scope}`;
  const legacyStorageNames = new Set();

  if (userId && phone) {
    legacyStorageNames.add(`${prefix}_${phone}`);
  } else if (!userId && !phone) {
    legacyStorageNames.add(prefix);
  }

  legacyStorageNames.delete(storageName);
  return {
    storageName,
    legacyStorageNames: Array.from(legacyStorageNames),
  };
}

export function readScopedJson(storageName, legacyStorageNames = [], fallbackValue) {
  const readJson = (name) => {
    const raw = localStorage.getItem(name);
    if (!raw) return undefined;
    return JSON.parse(raw);
  };

  try {
    const current = readJson(storageName);
    if (current !== undefined) return current;

    for (const legacyName of legacyStorageNames) {
      const legacyValue = readJson(legacyName);
      if (legacyValue !== undefined) {
        localStorage.setItem(storageName, JSON.stringify(legacyValue));
        localStorage.removeItem(legacyName);
        return legacyValue;
      }
    }
    return fallbackValue;
  } catch {
    localStorage.removeItem(storageName);
    legacyStorageNames.forEach((name) => localStorage.removeItem(name));
    return fallbackValue;
  }
}

function getUserId(user = {}) {
  return user?._id || user?.id || '';
}

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits || '';
}
