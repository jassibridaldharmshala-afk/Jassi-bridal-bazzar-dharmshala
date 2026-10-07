// postMessage and API responses have fresh object identities. Reuse unchanged
// JSON branches so an appearance edit does not invalidate catalog/content memos.
export function reuseEqualBranches(previous, next) {
  if (Object.is(previous, next)) return previous;
  if (!previous || !next || typeof previous !== 'object' || typeof next !== 'object' ||
    Array.isArray(previous) !== Array.isArray(next)) return next;
  const keys = Object.keys(next);
  let equal = keys.length === Object.keys(previous).length;
  const result = Array.isArray(next) ? [] : {};
  for (const key of keys) {
    result[key] = reuseEqualBranches(previous[key], next[key]);
    if (!Object.prototype.hasOwnProperty.call(previous, key) || result[key] !== previous[key]) equal = false;
  }
  return equal ? previous : result;
}
