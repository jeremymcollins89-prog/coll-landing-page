// Runs the real Worker in workerd (Cloudflare's runtime) through Wrangler, with
// a local D1 database built by `wrangler d1 migrations apply --local` — the same
// bundle and migrations the deploy uses. Checks the pieces that differ between
// Node and Workers: bundling the app's engine, Web Crypto Ed25519 signing, D1 SQL.
// Skip with SKIP_WORKERD=1 (e.g. on a machine that can't run workerd).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { unstable_dev } from 'wrangler';
import { ROOT, KEY, ADMIN_TOKEN } from './helpers/harness.js';
import { answerSheet, solvePro } from './helpers/solve.js';
import { assertVerifies } from './helpers/verify.js';

const skip = process.env.SKIP_WORKERD === '1' && 'SKIP_WORKERD=1';
let worker, dir;

before(async () => {
  if (skip) return;
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-d1-'));
  execFileSync(process.execPath, [path.join(ROOT, 'node_modules/wrangler/bin/wrangler.js'), 'd1', 'migrations', 'apply', 'coll-academy', '--local', '--persist-to', dir],
    { cwd: ROOT, stdio: 'pipe', env: { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' } });
  worker = await unstable_dev(path.join(ROOT, 'src/index.js'), {
    config: path.join(ROOT, 'wrangler.toml'), local: true, persistTo: dir, logLevel: 'error', ip: '127.0.0.1',
    vars: { CREDENTIAL_SIGNING_KEY: KEY.pem, ADMIN_TOKEN, ...(KEY.real ? {} : { EXPECTED_KEY_X: KEY.x }) },
    experimental: { disableExperimentalWarning: true, testMode: true }
  });
}, { timeout: 120e3 });

after(async () => { if (worker) await worker.stop(); if (dir) fs.rmSync(dir, { recursive: true, force: true }); });

async function call(method, p, { body, token, origin = 'https://collbusinesssolutions.com', headers = {} } = {}) {
  const h = { ...headers };
  if (origin) h.Origin = origin;
  if (token) h.Authorization = `Bearer ${token}`;
  if (body !== undefined) h['Content-Type'] = 'application/json';
  const res = await worker.fetch(p, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
}

test('in workerd: enroll → exams → certificate, signed and verifiable', { skip, timeout: 120e3 }, async () => {
  assert.equal((await call('GET', '/api/health')).body.ok, true);
  const pre = await call('OPTIONS', '/api/me', { origin: 'null', headers: { 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization' } });
  assert.equal(pre.status, 204); assert.equal(pre.headers.get('access-control-allow-origin'), 'null');
  assert.equal((await call('POST', '/api/enroll', { origin: 'https://evil.example', body: { name: 'X', email: 'x@example.com' } })).status, 403);

  const s = (await call('POST', '/api/enroll', { body: { name: 'Morgan Diaz', email: 'Morgan@Example.com' } })).body;
  assert.match(s.token, /^[A-Za-z0-9_-]{43}$/);
  const t = s.token;

  // progress, gzip+base64 through the real runtime
  const put = await call('PUT', '/api/progress', { token: t, body: { data: '{"training":{}}' } });
  assert.equal(put.body.version, 1);
  assert.equal((await call('GET', '/api/progress', { token: t })).body.data, '{"training":{}}');

  // one-time code
  const code = (await call('POST', '/api/code', { token: t })).body.code;
  const t2 = (await call('POST', '/api/code/redeem', { body: { code } })).body.token;
  assert.equal((await call('GET', '/api/me', { token: t2 })).body.student.email, 'morgan@example.com');

  // written exam
  const st = (await call('POST', '/api/exam/start', { token: t, body: { exam: 'pro' } })).body;
  assert.equal(st.questions.length, 30);
  assert(st.questions.every(q => Object.keys(q).sort().join() === 'id,options,question,topic'), 'only question fields are sent');
  // generated questions' answers exist only in D1 — read them the way an operator could
  const out = execFileSync(process.execPath, [path.join(ROOT, 'node_modules/wrangler/bin/wrangler.js'), 'd1', 'execute', 'coll-academy', '--local', '--persist-to', dir, '--json',
    '--command', `SELECT questions FROM written_attempts WHERE id = '${st.attemptId}'`], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' } });
  const stored = JSON.parse(JSON.parse(out.slice(out.indexOf('[')))[0].results[0].questions);
  assert.equal(stored.filter(q => q.g).length, 12);
  const w = (await call('POST', '/api/exam/submit', { token: t, body: { attemptId: st.attemptId, answers: answerSheet('pro', st.questions, 1, stored) } })).body;
  assert.deepEqual([w.score, w.passed, w.review.length], [29, true, 1]);

  // practical exam: built by the app's engine inside workerd
  const pr = (await call('POST', '/api/practical/start', { token: t, body: { exam: 'pro' } })).body;
  assert.equal(pr.client.transactions.length, 23);
  const solved = solvePro(pr.client, pr.brief);
  assert.equal(solved.book, solved.ending);
  const g = (await call('POST', '/api/practical/submit', { token: t2, body: { practicalId: pr.practicalId, client: solved.client } })).body;
  assert.deepEqual([g.score, g.passed], [100, true]);

  // certificate: Ed25519 signing with Web Crypto in workerd
  const c = await call('POST', '/api/credential/claim', { token: t, body: { program: 'professional' } });
  assert.equal(c.status, 200, JSON.stringify(c.body));
  assert.equal(c.body.distinction, true); // 97% and 100
  await assertVerifies(c.body);
  const pub = await call('GET', '/api/credentials/' + c.body.id, { origin: 'https://anyone.example' });
  assert.equal(pub.headers.get('access-control-allow-origin'), '*');
  await assertVerifies(pub.body);
  const rv = await call('POST', '/api/admin/revoke', { token: ADMIN_TOKEN, origin: null, body: { id: c.body.id } });
  assert.equal(rv.body.revoked, true);
  await assertVerifies(rv.body);

  // the Advanced practical can be built there too
  const adv = await call('POST', '/api/practical/start', { token: t, body: { exam: 'adv' } });
  assert.equal(adv.status, 403, 'the Professional certificate was revoked, so Advanced is closed again');

  assert.deepEqual((await call('DELETE', '/api/me', { token: t, body: { confirm: 'DELETE' } })).body, { deleted: true, keptCredentials: false });
});
