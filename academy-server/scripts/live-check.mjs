// Live check of the deployed Academy server. Runs after every deploy (and by hand):
//   node scripts/live-check.mjs https://coll-academy-api.<subdomain>.workers.dev
// Uses throwaway students and deletes them at the end. Exits 1 on any failure.
const BASE = (process.argv[2] || process.env.ACADEMY_API || '').replace(/\/$/, '');
if (!BASE) { console.error('Usage: node scripts/live-check.mjs <api-base-url>'); process.exit(2); }
const SITE = 'https://collbusinesssolutions.com';
let failed = 0;
const ok = (cond, label, extra = '') => { console.log(`${cond ? '✓' : '✗'} ${label}${extra ? ' — ' + extra : ''}`); if (!cond) failed++; };
async function call(method, path, { body, token, origin = SITE } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (origin !== undefined && origin !== '') headers.Origin = origin;
  if (token) headers.Authorization = 'Bearer ' + token;
  const r = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let data = null; const text = await r.text(); try { data = JSON.parse(text); } catch (_) { data = text; }
  return { status: r.status, data, text, headers: r.headers };
}
const stamp = Date.now().toString(36);
const tokens = [];
try {
  const h = await call('GET', '/api/health');
  ok(h.status === 200 && h.data.ok, 'Health check');
  ok(h.data.signing === 'ok', 'Signing key is set and matches the published key', String(h.data.signing));
  ok(h.data.admin === true, 'Admin token is set');

  const pre = await fetch(BASE + '/api/enroll', { method: 'OPTIONS', headers: { Origin: SITE, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,authorization' } });
  ok(pre.status < 300 && pre.headers.get('access-control-allow-origin') === SITE, 'Website (phone app) is allowed', `status ${pre.status}`);

  const bad = await call('POST', '/api/enroll', { origin: 'https://example.com', body: { name: 'Live Check', email: `bad-${stamp}@example.com` } });
  ok(bad.status === 403, 'Other websites are refused');

  const site = await call('POST', '/api/enroll', { body: { name: 'Live Check Phone', email: `live-check-${stamp}@example.com` } });
  ok(site.status === 201 && site.data.token, 'Enroll from the phone app', `status ${site.status}`);
  if (site.data.token) tokens.push(site.data.token);

  for (const origin of ['null', 'file://']) {
    const d = await call('POST', '/api/enroll', { origin, body: { name: 'Live Check Desktop', email: `live-check-desk-${origin.length}-${stamp}@example.com` } });
    ok(d.status === 201 && d.data.token, `Enroll from the desktop app (Origin: ${origin})`, `status ${d.status}`);
    if (d.data.token) tokens.push(d.data.token);
  }
  const T = tokens[0];
  if (T) {
    const me = await call('GET', '/api/me', { token: T });
    ok(me.status === 200, 'Profile');
    const ex = await call('POST', '/api/exam/start', { token: T, body: { exam: 'pro' } });
    const qs = ex.data && ex.data.questions;
    ok(ex.status < 300 && Array.isArray(qs) && qs.length === 30, 'Professional written exam starts with 30 questions', `status ${ex.status}`);
    ok(!/"(answer|correct|correctIndex|why|explanation)"\s*:/.test(ex.text), 'No answers or explanations sent to the student');
    const pr = await call('POST', '/api/practical/start', { token: T, body: { exam: 'pro' } });
    ok(pr.status < 300 && pr.data.client && pr.data.brief, 'Practical starts with a personal client and brief', `status ${pr.status}`);
    ok(!/"expect"\s*:/.test(pr.text), 'No expected balances sent to the student');
    const put = await call('PUT', '/api/progress', { token: T, body: { data: JSON.stringify({ type: 'coll-academy-progress', version: 1, training: { done: {} }, clients: [] }), encoding: 'json' } });
    const get = await call('GET', '/api/progress', { token: T });
    ok(put.status < 300 && get.status === 200, 'Progress sync saves and loads', `put ${put.status} get ${get.status}`);
    const code = await call('POST', '/api/code', { token: T });
    const red = code.data && code.data.code ? await call('POST', '/api/code/redeem', { body: { code: code.data.code } }) : { status: 0, data: {} };
    ok(red.status < 300 && red.data.token, 'Second-device sign-in code works', `code ${code.status} redeem ${red.status}`);
    if (red.data.token) tokens.push(red.data.token);
  }
  const pub = await call('GET', '/api/credentials/CL-2000-0000-0000', { origin: 'https://anywhere.example' });
  ok(pub.status === 404 && pub.headers.get('access-control-allow-origin') === '*', 'Public certificate lookup answers any website');
} catch (e) {
  ok(false, 'Live check crashed', e.message);
} finally {
  for (const t of tokens) { try { await call('DELETE', '/api/me', { token: t, body: { confirm: 'DELETE', keepCredentials: false } }); } catch (_) { } }
  console.log(failed ? `\n${failed} check(s) failed.` : '\nAll live checks passed.');
  process.exit(failed ? 1 : 0);
}
