const tasks = new Map();
const listeners = new Set();
const controls = new Map();
const forms = new Map();
const idle = Object.freeze({ active: false, count: 0, kind: 'loading', label: '', startedAt: 0 });
let snapshot = idle;
let lastAction = null;
let guardEnabled = false;

export const isAdminWorkspace = () => typeof window !== 'undefined' && /^\/(admin|seller|master)(?:\/|$)/.test(window.location.pathname);
export const getAdminActivitySnapshot = () => snapshot;
export const subscribeAdminActivity = listener => { listeners.add(listener); return () => listeners.delete(listener); };

function emit() {
  const entries = [...tasks.values()];
  const priority = { loading: 0, saving: 1, generating: 2, uploading: 3 };
  const current = entries.reduce((chosen, task) => !chosen || priority[task.kind] >= priority[chosen.kind] ? task : chosen, null);
  snapshot = current ? { active: true, count: entries.length, kind: current.kind, label: current.label, startedAt: Math.min(...entries.map(task => task.startedAt)) } : idle;
  listeners.forEach(listener => listener());
}

function lockAction(action) {
  if (!action?.control || !guardEnabled || !action.control.isConnected) return;
  const control = action.control;
  let record = controls.get(control);
  if (!record) {
    record = { count: 0, busy: control.getAttribute('aria-busy'), disabled: control.getAttribute('aria-disabled') };
    controls.set(control, record);
    control.setAttribute('data-admin-loading-action', 'true');
    control.setAttribute('aria-busy', 'true');
    control.setAttribute('aria-disabled', 'true');
  }
  record.count += 1;
  if (action.form) forms.set(action.form, (forms.get(action.form) || 0) + 1);
}

function restoreControl(control, record) {
  control.removeAttribute('data-admin-loading-action');
  for (const [name, value] of [['aria-busy', record.busy], ['aria-disabled', record.disabled]]) {
    if (value === null) control.removeAttribute(name); else control.setAttribute(name, value);
  }
}

function unlockAction(action) {
  if (!action?.control) return;
  const record = controls.get(action.control);
  if (record && --record.count === 0) { restoreControl(action.control, record); controls.delete(action.control); }
  if (action.form && forms.has(action.form)) {
    const count = forms.get(action.form) - 1;
    if (count > 0) forms.set(action.form, count); else forms.delete(action.form);
  }
}

// Each operation owns its cleanup; concurrent requests cannot hide one another.
export function beginAdminActivity({ kind = 'loading', label = 'Loading workspace', action = true } = {}) {
  const id = Symbol();
  const source = action && guardEnabled && lastAction && Date.now() - lastAction.at < 500 ? lastAction : null;
  tasks.set(id, { kind, label, startedAt: Date.now(), source });
  lockAction(source); emit();
  return {
    update(nextLabel) { const task = tasks.get(id); if (task && task.label !== nextLabel) { task.label = nextLabel; emit(); } },
    finish() { const task = tasks.get(id); if (task) { tasks.delete(id); unlockAction(task.source); emit(); } },
  };
}

export function beginAdminRequest(args, { cached = false } = {}) {
  const path = String(typeof args === 'string' ? args : args?.url || args?.path || '').split('?')[0];
  const method = String(typeof args === 'string' ? 'GET' : args?.method || 'GET').toUpperCase();
  const ignored = /^(?:\/auth\/(?:me|refresh)(?:\/|$)|\/notifications\/summary(?:\/|$)|\/analytics(?:\/|$)|\/cart(?:\/|$)|\/wishlist(?:\/|$)|\/stores\/resolve(?:\/|$)|\/website-config(?:\/|$))/.test(path);
  if ((!isAdminWorkspace() && !/^\/(admin|seller|system)(?:\/|$)/.test(path)) || ignored || (method === 'GET' && cached)) return { finish() {}, update() {} };
  const uploading = /(?:uploads?|bulk-upload|\/proofs|\/background)(?:\/|$)/.test(path);
  const generating = /(?:smart-fill|quick-analyze|generate)(?:\/|$)/.test(path);
  const kind = uploading && method !== 'GET' ? 'uploading' : generating && method !== 'GET' ? 'generating' : method === 'GET' ? 'loading' : 'saving';
  const label = kind === 'uploading' ? 'Uploading media' : kind === 'generating' ? 'Preparing Smart Fill' : kind === 'saving' ? 'Saving changes' : 'Loading workspace';
  return beginAdminActivity({ kind, label });
}

// Protect only the control/form that started a request. Navigation, editing,
// help and cancellation controls remain available while other work completes.
export function installAdminActionGuard() {
  guardEnabled = true;
  const block = event => { event.preventDefault(); event.stopImmediatePropagation(); };
  const click = event => {
    const control = event.target?.closest?.('button, input[type="submit"], input[type="button"]');
    if (!control) return;
    const form = control.type === 'submit' ? control.form : null;
    if (controls.has(control) || (form && forms.has(form))) { block(event); return; }
    lastAction = { control, form, at: Date.now() };
  };
  const submit = event => {
    if (forms.has(event.target)) { block(event); return; }
    const control = event.submitter || event.target.querySelector('button[type="submit"], input[type="submit"], button:not([type])');
    lastAction = { control, form: event.target, at: Date.now() };
  };
  document.addEventListener('click', click, true);
  document.addEventListener('submit', submit, true);
  return () => {
    guardEnabled = false; lastAction = null;
    document.removeEventListener('click', click, true); document.removeEventListener('submit', submit, true);
    controls.forEach((record, control) => restoreControl(control, record)); controls.clear(); forms.clear();
  };
}
