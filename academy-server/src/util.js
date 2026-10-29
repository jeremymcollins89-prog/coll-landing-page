// Small shared helpers: randomness, hashing, money and date formatting.
// Everything here runs the same in a Cloudflare Worker and in Node 22 (tests).

const enc = new TextEncoder();

// ---------------------------------------------------------------- randomness
// Cryptographically strong random bytes.
export const randomBytes = n => crypto.getRandomValues(new Uint8Array(n));

// Uniform random integer in [0, max) without modulo bias.
export function randomInt(max) {
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  for (;;) { crypto.getRandomValues(buf); if (buf[0] < limit) return buf[0] % max; }
}

// A random string drawn from `alphabet`.
export const randomString = (len, alphabet) => Array.from({ length: len }, () => alphabet[randomInt(alphabet.length)]).join('');

export const b64url = bytes => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
export const fromB64 = s => { const b = atob(String(s).replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '')); const a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; };

// Hex SHA-256 of a string.
export async function sha256(text) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(String(text))));
  return Array.from(d, b => b.toString(16).padStart(2, '0')).join('');
}

// Constant-time comparison of two strings (for the admin token).
export function safeEqual(a, b) {
  a = String(a); b = String(b);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i % a.length) || 0) ^ (b.charCodeAt(i % b.length) || 0);
  return diff === 0 && a.length > 0;
}

// Seeded generator (mulberry32) for practical-exam numbers, so a stored seed
// always rebuilds the same client. The seed itself comes from crypto.
export function seededRandom(seed) {
  let s = seed >>> 0;
  const next = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const int = (a, b) => a + Math.floor(next() * (b - a + 1));          // integer in [a, b]
  const step = (a, b, st) => a + st * int(0, Math.floor((b - a) / st)); // a, a+st, … ≤ b
  const pick = list => list[Math.floor(next() * list.length)];
  return { next, int, step, pick };
}

// ---------------------------------------------------------------- money
// All practical-exam math is done in whole cents, then turned into dollars.
export const dollars = cents => Math.round(cents) / 100;
export const fmtMoney = v => {
  const neg = v < 0, n = Math.abs(Math.round(v * 100)) / 100;
  return (neg ? '−' : '') + '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// ---------------------------------------------------------------- dates (UTC)
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const pad2 = n => String(n).padStart(2, '0');
export const isoDate = ms => new Date(ms).toISOString().slice(0, 10);
export const isoTime = ms => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
// The month before the one containing `ms`: { from, to, label }.
export function previousMonth(ms) {
  const d = new Date(ms);
  const y = d.getUTCMonth() === 0 ? d.getUTCFullYear() - 1 : d.getUTCFullYear();
  const m = d.getUTCMonth() === 0 ? 12 : d.getUTCMonth(); // 1–12
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${y}-${pad2(m)}-01`, to: `${y}-${pad2(m)}-${pad2(last)}`, label: `${MONTHS[m - 1]} ${y}` };
}
export const fmtDateLong = iso => { const [y, m, d] = iso.split('-').map(Number); return `${MONTHS[m - 1]} ${d}, ${y}`; };
