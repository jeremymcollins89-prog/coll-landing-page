// HTTP plumbing: JSON responses, errors, CORS and size-limited body reading.

export class ApiError extends Error {
  // status: HTTP status; code: short machine-readable error code; extra: more fields for the client
  constructor(status, code, message, extra = {}) { super(message); this.status = status; this.code = code; this.extra = extra; }
}
export const fail = (status, code, message, extra) => { throw new ApiError(status, code, message, extra); };

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });

export const errorResponse = e => json({ error: e.code, message: e.message, ...e.extra }, e.status);

// ---------------------------------------------------------------- CORS
// Who may call the private API from a browser:
//   - the website (and its www. twin)
//   - http://localhost:<any port> and http://127.0.0.1:<any port> for development
//   - the Electron desktop app: its pages load from file://, and Chromium sends
//     "Origin: null" for those (older builds sent "file://"), so both are allowed
//   - requests with no Origin at all (curl, server-to-server, some webviews)
// CORS is not the security boundary here — every private route needs a Bearer
// token — it only stops other websites from scripting the API in a visitor's browser.
const SITE_ORIGINS = ['https://collbusinesssolutions.com', 'https://www.collbusinesssolutions.com'];
export function originAllowed(origin, env) {
  if (origin == null || origin === '') return true;
  if (origin === 'null' || origin === 'file://') return true;
  if (SITE_ORIGINS.includes(origin)) return true;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(origin)) return true;
  const extra = String((env && env.ALLOWED_ORIGINS) || '').split(',').map(s => s.trim()).filter(Boolean);
  return extra.includes(origin);
}

const ALLOW_HEADERS = 'Authorization, Content-Type';
const ALLOW_METHODS = 'GET, POST, PUT, DELETE, OPTIONS';

// Headers added to every response. Public routes answer any origin with "*".
export function corsHeaders(origin, isPublic) {
  if (isPublic) return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' };
  const h = { Vary: 'Origin' };
  if (origin) Object.assign(h, { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': ALLOW_METHODS, 'Access-Control-Allow-Headers': ALLOW_HEADERS, 'Access-Control-Max-Age': '86400' });
  return h;
}

export function withHeaders(res, headers) {
  const r = new Response(res.body, res);
  for (const [k, v] of Object.entries(headers)) r.headers.set(k, v);
  return r;
}

// ---------------------------------------------------------------- bodies
// Reads a JSON body, refusing anything over `limit` bytes before parsing it.
export async function readJson(request, limit = 16 * 1024) {
  const declared = Number(request.headers.get('Content-Length') || 0);
  if (declared > limit) fail(413, 'too_large', `The request body is larger than ${Math.round(limit / 1024)} KB.`);
  let text;
  if (!request.body) text = '';
  else {
    // stream it so a missing/false Content-Length can't sneak a huge body in
    const reader = request.body.getReader(), chunks = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { try { await reader.cancel(); } catch (_) { /* ignore */ } fail(413, 'too_large', `The request body is larger than ${Math.round(limit / 1024)} KB.`); }
      chunks.push(value);
    }
    const all = new Uint8Array(size); let at = 0;
    for (const c of chunks) { all.set(c, at); at += c.byteLength; }
    text = new TextDecoder().decode(all);
  }
  if (!text.trim()) return {};
  let data;
  try { data = JSON.parse(text); } catch (_) { fail(400, 'invalid_json', 'The request body is not valid JSON.'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) fail(400, 'invalid_json', 'The request body must be a JSON object.');
  return data;
}

// ---------------------------------------------------------------- validation
export function cleanName(raw) {
  const name = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim();
  if (!name) fail(400, 'invalid_name', 'Add your full name.');
  if (name.length > 120) fail(400, 'invalid_name', 'The name is longer than 120 characters.');
  if (/[\u0000-\u001F\u007F<>]/.test(name)) fail(400, 'invalid_name', 'The name contains characters that aren\'t allowed.');
  return name;
}
export function cleanEmail(raw) {
  const email = String(raw == null ? '' : raw).trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@<>()",;]+@[^\s@<>()",;]+\.[a-z0-9-]{2,}$/i.test(email)) fail(400, 'invalid_email', 'Enter a valid email address.');
  return email;
}
export const examParam = v => { if (v !== 'pro' && v !== 'adv') fail(400, 'invalid_exam', 'exam must be "pro" or "adv".'); return v; };
