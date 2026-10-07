export const OTP_STORAGE_KEY = 'samira_login_otp_state';

export function clearOtpState() {
  try {
    localStorage.removeItem(OTP_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function readOtpState() {
  try {
    const raw = localStorage.getItem(OTP_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.phone || !parsed?.cooldownExpiresAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeOtpState(state) {
  try {
    localStorage.setItem(OTP_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage failures.
  }
}
