import { digestBytes, textBytes } from './retryDigest';
const fileIds = new WeakMap();
const originals = new WeakMap();
const operations = new Map();
let sequence = 0;
const lifetime = 24 * 60 * 60 * 1000;
const pendingStorage = 'samira_pending_operations_v2';
const fingerprints = new WeakMap();
let fallbackPending = [];
function pendingOperations() {
  let entries = [];
  try {
    const stored = JSON.parse(localStorage.getItem(pendingStorage) || '[]');
    if (Array.isArray(stored)) entries = stored;
  } catch { /* In-memory fallback in browsers that block persistent storage. */ }
  const unique = new Map([...entries, ...fallbackPending].map(item => [item?.signature, item]));
  return Array.from(unique.values()).filter(item => item && /^[a-f0-9]{64}$/.test(item.signature) && /^[a-zA-Z0-9_-]{16,100}$/.test(item.key) && Date.now() - item.at < lifetime).slice(-128);
}
function savePending(entries) {
  try { localStorage.setItem(pendingStorage, JSON.stringify(entries.slice(-128))); fallbackPending = []; }
  catch { fallbackPending = entries.slice(-128); }
}
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  return value;
}
async function pendingKey(identity, fallbackKey) {
  const signature = await digestBytes(textBytes(JSON.stringify(stable(identity))));
  const entries = pendingOperations();
  const existing = entries.find(item => item.signature === signature);
  if (existing) return existing.key;
  const key = fallbackKey();
  entries.push({ signature, key, at: Date.now(), attempted: false });
  savePending(entries);
  return key;
}
function workflowScope() {
  try {
    let session = sessionStorage.getItem('samira_retry_workflow');
    if (!session) { session = newUploadKey(); sessionStorage.setItem('samira_retry_workflow', session); }
    return [session, window.location.pathname];
  } catch { return ['memory', typeof window !== 'undefined' ? window.location.pathname : '']; }
}
export async function getDurableUploadRetryKey(options) {
  const files = Array.from(options.files || []).map(file => originals.get(file) || file);
  const selection = await selectionFingerprint(files);
  return pendingKey(['media', workflowScope(), options.scope || '', options.path, options.fieldName || 'images', options.fields || {}, selection], () => options.idempotencyKey || getUploadRetryKey(options));
}
export async function getRecordRetryKey({ path, body, scope }) {
  return pendingKey(['record', workflowScope(), scope, path, body], newUploadKey);
}
export async function retainUploadedReceipt(key, files) {
  const assets = [];
  for (const file of files || []) {
    const url = file.url || file.fileUrl;
    if (url) assets.push(await digestBytes(textBytes(url)));
  }
  const entries = pendingOperations();
  const entry = entries.find(item => item.key === key);
  if (entry) { entry.complete = true; entry.assets = assets; entry.attempted = true; savePending(entries); }
}
// An uploaded photo is not committed until a successful business save references
// it. Keep its receipt through a failed form save/refresh; only hashes are stored.
export async function confirmUploadedReferences(body) {
  const urls = new Set();
  function visit(value, depth = 0) {
    if (depth > 20 || urls.size >= 256) return;
    if (typeof value === 'string' && (/^https?:\/\//i.test(value) || value.startsWith('/uploads/'))) {
      urls.add(value);
      try { const url = new URL(value); if (url.pathname.startsWith('/uploads/')) urls.add(url.pathname); } catch { /* relative URL */ }
    } else if (value && typeof value === 'object') Object.values(value).forEach(item => visit(item, depth + 1));
  }
  visit(body);
  if (!urls.size) return;
  const hashes = new Set(await Promise.all(Array.from(urls, url => digestBytes(textBytes(url)))));
  const entries = pendingOperations();
  savePending(entries.filter(item => !item.complete || !item.assets?.length || !item.assets.every(hash => hashes.has(hash))));
}
export function isRetrySafeCreation(path) {
  return /^\/(?:admin|seller)\/(?:product-drafts|banners)(?:\?|$)/.test(path) || /^\/social\/posts(?:\?|$)/.test(path);
}
export function finishUploadRetryKey(key) {
  savePending(pendingOperations().filter(item => item.key !== key));
  for (const value of operations.values()) if (value.key === key) value.attempted = false;
}

export function newUploadKey() {
  const browserCrypto = typeof window !== 'undefined' ? window.crypto : null;
  if (browserCrypto?.randomUUID) return browserCrypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (browserCrypto?.getRandomValues) browserCrypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}
export function rememberOriginalUpload(prepared, original) {
  if (prepared !== original) originals.set(prepared, originals.get(original) || original);
}
function fileId(file) {
  const source = originals.get(file) || file;
  if (!fileIds.has(source)) fileIds.set(source, ++sequence);
  return fileIds.get(source);
}
export function uploadScope(auth = {}) {
  let store = '';
  try { store = `${sessionStorage.getItem('samira_store_slug') || ''}:${sessionStorage.getItem('samira_seller_store_id') || ''}`; } catch { /* unavailable storage */ }
  return JSON.stringify([auth.user?._id || auth.user?.id || auth.token || '', auth.user?.activeMode || auth.activeMode || '', store]);
}
export function getUploadRetryKey({ path, files, fields = {}, scope = '', fieldName = 'images' }) {
  const signature = JSON.stringify([scope, path, fieldName, Object.entries(fields).sort(([a], [b]) => a.localeCompare(b)), Array.from(files || []).map(fileId)]);
  const now = Date.now();
  for (const [key, value] of operations) if (now - value.at > lifetime) operations.delete(key);
  if (!operations.has(signature)) {
    if (operations.size >= 128) operations.delete(operations.keys().next().value);
    operations.set(signature, { key: newUploadKey(), at: now });
  }
  return operations.get(signature).key;
}
export function forgetUploadRetryKey(key) {
  for (const [signature, value] of operations) if (value.key === key) operations.delete(signature);
  finishUploadRetryKey(key);
}
export function hasUploadAttempt(key) {
  return pendingOperations().some(value => value.key === key && value.attempted) || Array.from(operations.values()).some(value => value.key === key && value.attempted);
}
export function markUploadAttempt(key) {
  for (const value of operations.values()) if (value.key === key) value.attempted = true;
  const entries = pendingOperations();
  for (const value of entries) if (value.key === key) value.attempted = true;
  savePending(entries);
}
export function isMediaUpload(path) {
  return (/\/(?:uploads(?:\/videos)?|evidence\/uploads)(?:\?|$)/.test(path) && !/\/background(?:\?|$)/.test(path)) || /^\/admin\/reel-imports(?:\?|$)/.test(path);
}
// Used only to recognise a failed selection in the same uploader. The server
// independently checks SHA-256; this is never an authorisation/storage key.
export async function selectionFingerprint(files) {
  const parts = [];
  for (const file of Array.from(files || [])) {
    if (!fingerprints.has(file)) fingerprints.set(file, (async () => {
      const buffer = typeof file.arrayBuffer === 'function' ? await file.arrayBuffer() : await new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('Unable to read this file.')); reader.readAsArrayBuffer(file);
      });
      return [file.name, file.type, file.size, await digestBytes(buffer)];
    })().catch(error => { fingerprints.delete(file); throw error; }));
    parts.push(await fingerprints.get(file));
  }
  return JSON.stringify(parts);
}
