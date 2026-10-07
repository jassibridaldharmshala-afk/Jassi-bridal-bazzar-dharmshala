const LOGIN_PROMPT_KEY = 'samira_login_prompt_dismissed';

export function clearLoginPromptDismissed() {
  try { localStorage.removeItem(LOGIN_PROMPT_KEY); } catch { /* Storage may be disabled. */ }
}
export function markLoginPromptDismissed() {
  try { localStorage.setItem(LOGIN_PROMPT_KEY, '1'); } catch { /* Storage may be disabled. */ }
}
export function isLoginPromptDismissed() {
  try { return localStorage.getItem(LOGIN_PROMPT_KEY) === '1'; } catch { return false; }
}
