// Runs /verify.html's own script (with a stand-in page) against the Academy
// server: a server-issued certificate shows "Verified · digitally signed",
// a revoked one shows "Revoked", and the page falls back to /credentials.json
// when the server doesn't have the ID or can't be reached.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeApp, REPO, ADMIN_TOKEN, KEY, storedQuestions } from './helpers/harness.js';
import { answerSheet, solvePro } from './helpers/solve.js';

const html = fs.readFileSync(path.join(REPO, 'verify.html'), 'utf8');
const script = /<script>\n([\s\S]*?)<\/script>/.exec(html)[1];
const API = 'https://academy.test';

assert.match(script, /^var ACADEMY_API = '[^']*';$/m, 'verify.html has a single ACADEMY_API constant');

// Loads the page for ?id=… and resolves with the result's HTML.
async function verifyPage(id, { app, apiDown = false, file = [] }) {
  const out = { innerHTML: '' }, q = { value: '', addEventListener() {} };
  const document = { title: '', getElementById: k => (k === 'out' ? out : k === 'q' ? q : { addEventListener() {} }) };
  const keysDoc = JSON.parse(fs.readFileSync(path.join(REPO, '.well-known/coll-credentials-keys.json'), 'utf8'));
  if (!KEY.real) keysDoc.keys[0].x = KEY.x; // the throwaway test key stands in for the published one
  const fetch = async (url) => {
    if (url === '/.well-known/coll-credentials-keys.json') return new Response(JSON.stringify(keysDoc));
    if (url.startsWith('/credentials.json')) return new Response(JSON.stringify(file));
    if (url.startsWith(API)) {
      if (apiDown) throw new TypeError('Failed to fetch');
      const r = await app.call('GET', url.slice(API.length), { origin: 'https://collbusinesssolutions.com' });
      return new Response(JSON.stringify(r.body), { status: r.status });
    }
    throw new Error('unexpected fetch ' + url);
  };
  const page = script.replace(/^var ACADEMY_API = '[^']*';$/m, `var ACADEMY_API = '${API}/';`);
  const window = { crypto: globalThis.crypto, TextEncoder };
  Function('window', 'document', 'location', 'history', 'fetch', page)(window, document, { search: '?id=' + id }, { replaceState() {} }, fetch);
  for (let i = 0; i < 200 && (out.innerHTML === '' || /Checking/.test(out.innerHTML)); i++) await new Promise(r => setTimeout(r, 5));
  return out.innerHTML;
}

test('verify.html checks server-issued certificates, with fallbacks', async () => {
  const app = makeApp();
  const s = (await app.call('POST', '/api/enroll', { body: { name: 'Riley Park', email: 'riley@example.com' } })).body;
  const st = (await app.call('POST', '/api/exam/start', { token: s.token, body: { exam: 'pro' } })).body;
  await app.call('POST', '/api/exam/submit', { token: s.token, body: { attemptId: st.attemptId, answers: answerSheet('pro', st.questions, 0, storedQuestions(app, st.attemptId)) } });
  const pr = (await app.call('POST', '/api/practical/start', { token: s.token, body: { exam: 'pro' } })).body;
  await app.call('POST', '/api/practical/submit', { token: s.token, body: { practicalId: pr.practicalId, client: solvePro(pr.client, pr.brief).client } });
  const e = (await app.call('POST', '/api/credential/claim', { token: s.token, body: { program: 'professional' } })).body;

  let page = await verifyPage(e.id, { app });
  assert.match(page, /Verified · digitally signed/);
  assert.match(page, /Riley Park/); assert.match(page, /with distinction/);

  // lower-case ID typed by a visitor
  assert.match(await verifyPage(e.id.toLowerCase(), { app }), /Verified · digitally signed/);

  // not on the server, but registered by hand in /credentials.json
  const manual = { id: 'CL-2026-ZZZZ-0001', name: 'Hand Registered', awarded: '2026-10-01', written: 90, practical: 95, distinction: false, program: 'professional' };
  assert.match(await verifyPage(manual.id, { app, file: [manual] }), /Registered/);
  // server unreachable: the file still works
  assert.match(await verifyPage(manual.id, { app, apiDown: true, file: [manual] }), /Hand Registered/);
  // nowhere
  assert.match(await verifyPage('CL-2026-NONE-0000', { app }), /No credential found/);

  // a tampered server answer fails the signature check
  const tampered = structuredClone(e); tampered.practical = 80;
  page = await verifyPage(e.id, { app, apiDown: true, file: [tampered] });
  assert.match(page, /Signature check failed/);

  // revoked on the server
  await app.call('POST', '/api/admin/revoke', { token: ADMIN_TOKEN, body: { id: e.id } });
  page = await verifyPage(e.id, { app });
  assert.match(page, /Revoked/); assert.doesNotMatch(page, /Signature check failed/);
});
