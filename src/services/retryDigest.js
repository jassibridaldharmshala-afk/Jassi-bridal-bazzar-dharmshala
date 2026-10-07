// Web Crypto on HTTPS/localhost, with an equivalent SHA-256 fallback for older
// browsers. Retry identities are not permission checks; the backend rehashes bytes.
export async function digestBytes(bytes) {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    return Array.from(new Uint8Array(await window.crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
  }
  const input = new Uint8Array(bytes), words = [], primes = [], constants = [], initial = [];
  for (let n = 2; primes.length < 64; n++) if (primes.every(p => n % p)) {
    primes.push(n); constants.push((Math.cbrt(n) % 1 * 0x100000000) | 0);
    if (initial.length < 8) initial.push((Math.sqrt(n) % 1 * 0x100000000) | 0);
  }
  const padded = Math.ceil((input.length + 9) / 64) * 64;
  for (let i = 0; i < padded / 4; i++) words[i] = 0;
  for (let i = 0; i < input.length; i++) words[i >>> 2] |= input[i] << (24 - (i % 4) * 8);
  words[input.length >>> 2] |= 0x80 << (24 - (input.length % 4) * 8);
  words[words.length - 2] = Math.floor(input.length / 0x20000000);
  words[words.length - 1] = input.length * 8;
  const rotate = (x, n) => (x >>> n) | (x << (32 - n));
  let hash = initial;
  for (let start = 0; start < words.length; start += 16) {
    const schedule = words.slice(start, start + 16), working = hash.slice();
    for (let i = 0; i < 64; i++) {
      if (i >= 16) {
        const x = schedule[i - 15], y = schedule[i - 2];
        schedule[i] = (schedule[i - 16] + (rotate(x, 7) ^ rotate(x, 18) ^ (x >>> 3)) + schedule[i - 7] + (rotate(y, 17) ^ rotate(y, 19) ^ (y >>> 10))) | 0;
      }
      const [a, b, c, d, e, f, g, h] = working;
      const t1 = (h + (rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)) + ((e & f) ^ (~e & g)) + constants[i] + schedule[i]) | 0;
      const t2 = ((rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      working.splice(0, 8, (t1 + t2) | 0, a, b, c, (d + t1) | 0, e, f, g);
    }
    hash = hash.map((value, i) => (value + working[i]) | 0);
  }
  return hash.map(value => (value >>> 0).toString(16).padStart(8, '0')).join('');
}
export function textBytes(text) { return Uint8Array.from(unescape(encodeURIComponent(text)), char => char.charCodeAt(0)); }
