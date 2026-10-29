// End-to-end tests of the Academy API, run in-process with a fake clock.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { makeApp, KEY, ADMIN_TOKEN, REPO, HOUR, DAY, storedQuestions } from './helpers/harness.js';
import { entryOf } from '../src/written.js';
import { answerSheet, solvePro, solveAdv } from './helpers/solve.js';
import { assertVerifies } from './helpers/verify.js';
import worker from '../src/index.js';
import PRO_BANK from '../src/banks/pro.js';
import ADV_BANK from '../src/banks/adv.js';

// Every property name anywhere inside a value.
const deepKeys = (v, out = []) => { if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { out.push(k); deepKeys(x, out); } return out; };
let emailN = 0;
async function enroll(app, opts = {}) {
  const r = await app.call('POST', '/api/enroll', { body: { name: opts.name || 'Avery Quinn', email: opts.email || `student${++emailN}@example.com` } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body;
}
async function passWritten(app, token, exam, wrong = 0) {
  const s = await app.call('POST', '/api/exam/start', { token, body: { exam } });
  assert.equal(s.status, 200, JSON.stringify(s.body));
  const r = await app.call('POST', '/api/exam/submit', { token, body: { attemptId: s.body.attemptId, answers: answerSheet(exam, s.body.questions, wrong, storedQuestions(app, s.body.attemptId)) } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body;
}
async function passPractical(app, token, exam) {
  const s = await app.call('POST', '/api/practical/start', { token, body: { exam } });
  assert.equal(s.status, 200, JSON.stringify(s.body));
  const solved = exam === 'pro' ? solvePro(s.body.client, s.body.brief) : solveAdv(s.body.client, s.body.brief);
  const r = await app.call('POST', '/api/practical/submit', { token, body: { practicalId: s.body.practicalId, client: solved.client } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return { start: s.body, result: r.body, solved };
}

// ======================================================================
describe('CORS and origins', () => {
  test('allowed origins get CORS headers; others are refused', async () => {
    const app = makeApp();
    for (const origin of ['https://collbusinesssolutions.com', 'https://www.collbusinesssolutions.com', 'http://localhost:5173', 'http://127.0.0.1:8080', 'null', 'file://']) {
      const pre = await app.call('OPTIONS', '/api/enroll', { origin, headers: { 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,authorization' } });
      assert.equal(pre.status, 204, origin);
      assert.equal(pre.headers.get('Access-Control-Allow-Origin'), origin);
      assert.match(pre.headers.get('Access-Control-Allow-Headers'), /Authorization/);
      assert.match(pre.headers.get('Access-Control-Allow-Methods'), /PUT/);
    }
    const noOrigin = await app.call('POST', '/api/enroll', { origin: null, body: { name: 'No Origin', email: 'noorigin@example.com' } });
    assert.equal(noOrigin.status, 201);
    assert.equal(noOrigin.headers.get('Access-Control-Allow-Origin'), null);
    for (const origin of ['https://evil.example', 'http://localhost.evil.example', 'https://collbusinesssolutions.com.evil.example']) {
      const bad = await app.call('POST', '/api/enroll', { origin, body: { name: 'X', email: 'x@example.com' } });
      assert.equal(bad.status, 403, origin);
      assert.equal(bad.body.error, 'origin_not_allowed');
    }
  });

  test('the public credential lookup answers any origin', async () => {
    const app = makeApp();
    const r = await app.call('GET', '/api/credentials/CL-2026-AAAA-BBBB', { origin: 'https://evil.example' });
    assert.equal(r.status, 404);
    assert.equal(r.headers.get('Access-Control-Allow-Origin'), '*');
    assert.equal(r.body.error, 'not_found');
  });

  test('extra origins can be allowed with ALLOWED_ORIGINS', async () => {
    const app = makeApp(); app.env.ALLOWED_ORIGINS = 'https://staging.example';
    const r = await app.call('POST', '/api/enroll', { origin: 'https://staging.example', body: { name: 'S', email: 's@example.com' } });
    assert.equal(r.status, 201);
  });
});

// ======================================================================
describe('students', () => {
  test('enroll validates, normalizes email and stores only a hash of the token', async () => {
    const app = makeApp();
    assert.equal((await app.call('POST', '/api/enroll', { body: { name: 'A', email: 'not-an-email' } })).body.error, 'invalid_email');
    assert.equal((await app.call('POST', '/api/enroll', { body: { name: '  ', email: 'a@example.com' } })).body.error, 'invalid_name');
    assert.equal((await app.call('POST', '/api/enroll', { body: { name: '<b>x</b>', email: 'a@example.com' } })).body.error, 'invalid_name');
    assert.equal((await app.call('POST', '/api/enroll', { body: '{nope' })).body.error, 'invalid_json');
    const r = await app.call('POST', '/api/enroll', { body: { name: '  Avery   Quinn ', email: ' Avery.Q@Example.COM ' } });
    assert.equal(r.status, 201);
    assert.match(r.body.studentId, /^st_[a-z0-9]{12}$/);
    assert.match(r.body.token, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(r.body.email, 'avery.q@example.com'); assert.equal(r.body.name, 'Avery Quinn');
    const rows = app.env.DB.db.prepare('SELECT hash FROM tokens').all();
    assert.equal(rows.length, 1);
    assert.notEqual(rows[0].hash, r.body.token);
    assert.equal(rows[0].hash, crypto.createHash('sha256').update(r.body.token).digest('hex'));
  });

  test('private routes need a valid token', async () => {
    const app = makeApp();
    assert.equal((await app.call('GET', '/api/me')).status, 401);
    assert.equal((await app.call('GET', '/api/me', { token: 'x'.repeat(43) })).body.error, 'unauthorized');
    const s = await enroll(app);
    const me = await app.call('GET', '/api/me', { token: s.token });
    assert.equal(me.status, 200);
    assert.equal(me.body.student.id, s.studentId);
    assert.equal(me.body.exams.pro.available, true);
    assert.equal(me.body.exams.adv.available, false);
    assert.deepEqual(me.body.exams.pro.certificate.needs, ['written', 'practical']);
    assert.equal(me.body.exams.pro.written.tries.left, 3);
  });

  test('name can be fixed before a certificate', async () => {
    const app = makeApp(); const s = await enroll(app);
    const r = await app.call('POST', '/api/me', { token: s.token, body: { name: 'Avery J. Quinn' } });
    assert.equal(r.body.name, 'Avery J. Quinn');
    assert.equal((await app.call('GET', '/api/me', { token: s.token })).body.student.name, 'Avery J. Quinn');
  });

  test('enroll is rate limited per IP (20 an hour)', async () => {
    const app = makeApp();
    for (let i = 0; i < 20; i++) assert.equal((await app.call('POST', '/api/enroll', { ip: '198.51.100.7', body: { name: 'R', email: `r${i}@example.com` } })).status, 201);
    const r = await app.call('POST', '/api/enroll', { ip: '198.51.100.7', body: { name: 'R', email: 'r21@example.com' } });
    assert.equal(r.status, 429); assert.equal(r.body.error, 'rate_limited');
    assert.equal((await app.call('POST', '/api/enroll', { ip: '198.51.100.8', body: { name: 'R', email: 'r22@example.com' } })).status, 201);
    app.advance(HOUR);
    assert.equal((await app.call('POST', '/api/enroll', { ip: '198.51.100.7', body: { name: 'R', email: 'r23@example.com' } })).status, 201);
    // the IP itself is never stored
    assert(!JSON.stringify(app.env.DB.db.prepare('SELECT * FROM rate_limits').all()).includes('198.51.100.7'));
  });

  test('one-time sign-in code gives a second device its own token', async () => {
    const app = makeApp(); const s = await enroll(app);
    const c = await app.call('POST', '/api/code', { token: s.token });
    assert.equal(c.status, 200); assert.match(c.body.code, /^[A-HJKMNP-Z2-9]{8}$/);
    const r = await app.call('POST', '/api/code/redeem', { body: { code: c.body.code.toLowerCase().slice(0, 4) + '-' + c.body.code.slice(4) } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.studentId, s.studentId); assert.notEqual(r.body.token, s.token);
    assert.equal((await app.call('GET', '/api/me', { token: r.body.token })).body.student.id, s.studentId);
    // once only
    assert.equal((await app.call('POST', '/api/code/redeem', { body: { code: c.body.code } })).body.error, 'invalid_code');
    // expires after 15 minutes
    const c2 = await app.call('POST', '/api/code', { token: s.token });
    app.advance(15 * 60e3 + 1000);
    assert.equal((await app.call('POST', '/api/code/redeem', { body: { code: c2.body.code } })).body.error, 'invalid_code');
    // a new code replaces the old one
    const c3 = await app.call('POST', '/api/code', { token: s.token });
    const c4 = await app.call('POST', '/api/code', { token: s.token });
    assert.equal((await app.call('POST', '/api/code/redeem', { body: { code: c3.body.code } })).status, 400);
    assert.equal((await app.call('POST', '/api/code/redeem', { body: { code: c4.body.code } })).status, 200);
  });

  test('code redeem is rate limited per IP (10 an hour)', async () => {
    const app = makeApp();
    for (let i = 0; i < 10; i++) assert.equal((await app.call('POST', '/api/code/redeem', { ip: '192.0.2.9', body: { code: 'AAAA2222' } })).status, 400);
    const r = await app.call('POST', '/api/code/redeem', { ip: '192.0.2.9', body: { code: 'AAAA2222' } });
    assert.equal(r.status, 429); assert(r.body.retryAfter > 0);
  });

  test('logout forgets only this device', async () => {
    const app = makeApp(); const s = await enroll(app);
    const c = await app.call('POST', '/api/code', { token: s.token });
    const second = (await app.call('POST', '/api/code/redeem', { body: { code: c.body.code } })).body.token;
    assert.equal((await app.call('POST', '/api/logout', { token: second })).status, 200);
    assert.equal((await app.call('GET', '/api/me', { token: second })).status, 401);
    assert.equal((await app.call('GET', '/api/me', { token: s.token })).status, 200);
  });
});

// ======================================================================
describe('progress sync', () => {
  test('PUT then GET, versions, conflicts and the size limit', async () => {
    const app = makeApp(); const s = await enroll(app);
    assert.deepEqual((await app.call('GET', '/api/progress', { token: s.token })).body, { data: null, encoding: null, version: 0, updatedAt: null });
    const data = JSON.stringify({ training: { done: { 'l-1': '2026-10-01' } } });
    const p1 = await app.call('PUT', '/api/progress', { token: s.token, body: { data } });
    assert.equal(p1.status, 200); assert.equal(p1.body.version, 1);
    const g = await app.call('GET', '/api/progress', { token: s.token });
    assert.equal(g.body.data, data); assert.equal(g.body.encoding, 'json'); assert.equal(g.body.version, 1);
    // a device that last saw version 1 can save; one still on version 0 gets a conflict
    assert.equal((await app.call('PUT', '/api/progress', { token: s.token, body: { data, baseVersion: 1 } })).body.version, 2);
    const conflict = await app.call('PUT', '/api/progress', { token: s.token, body: { data, baseVersion: 1 } });
    assert.equal(conflict.status, 409); assert.equal(conflict.body.error, 'conflict'); assert.equal(conflict.body.version, 2);
    // gzip + base64
    const gz = Buffer.from(await new Response(new Blob([data]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()).toString('base64');
    assert.equal((await app.call('PUT', '/api/progress', { token: s.token, body: { data: gz, encoding: 'gzip-base64' } })).status, 200);
    const g2 = (await app.call('GET', '/api/progress', { token: s.token })).body;
    assert.equal(g2.encoding, 'gzip-base64');
    const back = await new Response(new Blob([Buffer.from(g2.data, 'base64')]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    assert.equal(back, data);
    // limits and validation
    assert.equal((await app.call('PUT', '/api/progress', { token: s.token, body: { data: '{"x":"' + 'a'.repeat(900 * 1024) + '"}' } })).status, 413);
    assert.equal((await app.call('PUT', '/api/progress', { token: s.token, body: { data: 'not json' } })).body.error, 'invalid_progress');
    assert.equal((await app.call('PUT', '/api/progress', { token: s.token, body: { data: '{}', encoding: 'zip' } })).body.error, 'invalid_progress');
    // the second device sees the same progress
    const code = (await app.call('POST', '/api/code', { token: s.token })).body.code;
    const t2 = (await app.call('POST', '/api/code/redeem', { body: { code } })).body.token;
    assert.equal((await app.call('GET', '/api/progress', { token: t2 })).body.data, gz);
  });
});

// ======================================================================
describe('written exams', () => {
  test('start returns questions with no answers, covering every topic', async () => {
    const app = makeApp(); const s = await enroll(app);
    const r = await app.call('POST', '/api/exam/start', { token: s.token, body: { exam: 'pro' } });
    assert.equal(r.status, 200);
    const b = r.body;
    assert.match(b.attemptId, /^wa_[a-z0-9]{16}$/);
    assert.equal(b.total, 30); assert.equal(b.questions.length, 30); assert.equal(b.needed, 24); assert.equal(b.passPercent, 80);
    assert.equal(new Date(b.expiresAt) - new Date(b.startedAt), 3 * HOUR);
    const topics = new Set(PRO_BANK.map(q => q[0]));
    assert.deepEqual(new Set(b.questions.map(q => q.topic)), topics, 'every topic is drawn');
    assert.equal(new Set(b.questions.map(q => q.question)).size, 30, 'no repeats');
    const text = JSON.stringify(b);
    const stored = storedQuestions(app, b.attemptId);
    assert.equal(stored.filter(q => q.g).length, 12, '12 generated'); assert.equal(stored.filter(q => !q.g).length, 18, '18 from the bank');
    b.questions.forEach((q, k) => {
      assert.deepEqual(Object.keys(q).sort(), ['id', 'options', 'question', 'topic']);
      assert.equal(q.options.length, 3);
      const entry = entryOf('pro', stored[k]);
      assert.equal(q.question, entry[1]);
      assert.deepEqual([...q.options].sort(), [...entry[2]].sort());
      assert(!text.includes(entry[4]), 'explanation leaked');
      if (!stored[k].g) assert(PRO_BANK.some(x => x[1] === q.question));
    });
    assert.deepEqual(Object.keys(b).sort(), ['attemptId', 'exam', 'expiresAt', 'needed', 'passPercent', 'questions', 'resumed', 'startedAt', 'title', 'total', 'triesLeft']);
    assert(!/"(correct\w*|why|answer\w*)"\s*:/i.test(text), 'answer fields leaked');
    // asking again resumes the same attempt
    const again = await app.call('POST', '/api/exam/start', { token: s.token, body: { exam: 'pro' } });
    assert.equal(again.body.attemptId, b.attemptId); assert.equal(again.body.resumed, true);
    assert.deepEqual(again.body.questions, b.questions);
  });

  test('options are shuffled between attempts and students', async () => {
    const app = makeApp();
    const orders = new Set();
    for (let i = 0; i < 4; i++) {
      const s = await enroll(app);
      const q = (await app.call('POST', '/api/exam/start', { token: s.token, body: { exam: 'pro' } })).body.questions;
      orders.add(q.map(x => x.question.slice(0, 12) + x.options[0].slice(0, 6)).join('|'));
    }
    assert.equal(orders.size, 4);
  });

  test('grading is done on the server, once per attempt', async () => {
    const app = makeApp(); const s = await enroll(app);
    const perfect = await passWritten(app, s.token, 'pro');
    assert.deepEqual([perfect.score, perfect.total, perfect.percent, perfect.passed, perfect.review.length], [30, 30, 100, true, 0]);
    assert.equal(perfect.pct, 1);
    const dup = await app.call('POST', '/api/exam/submit', { token: s.token, body: { attemptId: perfect.attemptId, answers: {} } });
    assert.equal(dup.status, 409); assert.equal(dup.body.error, 'already_submitted');
    // 7 wrong → 23/30 = 76.7%: not a pass, and the review shows exactly the misses
    const s2 = await enroll(app);
    const st = (await app.call('POST', '/api/exam/start', { token: s2.token, body: { exam: 'pro' } })).body;
    const stored = storedQuestions(app, st.attemptId);
    const sheet = answerSheet('pro', st.questions, 7, stored);
    delete sheet.q30; // unanswered counts as wrong
    const r = (await app.call('POST', '/api/exam/submit', { token: s2.token, body: { attemptId: st.attemptId, answers: sheet } })).body;
    assert.deepEqual([r.score, r.passed, r.review.length, r.percent], [22, false, 8, 73]);
    for (const m of r.review) {
      const entry = entryOf('pro', stored[+m.id.slice(1) - 1]);
      assert.equal(m.correctAnswer, entry[2][entry[3]]); assert.equal(m.why, entry[4]);
      assert.notEqual(m.yourAnswer, m.correctAnswer);
    }
    assert.equal(r.review.find(x => x.id === 'q30').yourAnswer, null);
    assert.equal(r.tries.left, 2);
    // bad input
    assert.equal((await app.call('POST', '/api/exam/submit', { token: s2.token, body: { attemptId: 'wa_nope', answers: {} } })).body.error, 'invalid_attempt');
    const st3 = (await app.call('POST', '/api/exam/start', { token: s2.token, body: { exam: 'pro' } })).body;
    assert.equal((await app.call('POST', '/api/exam/submit', { token: s2.token, body: { attemptId: st3.attemptId, answers: { q1: 5 } } })).body.error, 'invalid_answers');
    assert.equal((await app.call('POST', '/api/exam/submit', { token: s2.token, body: { attemptId: st3.attemptId, answers: { q99: 1 } } })).body.error, 'invalid_answers');
    // someone else's attempt is invisible
    assert.equal((await app.call('POST', '/api/exam/submit', { token: s.token, body: { attemptId: st3.attemptId, answers: {} } })).status, 404);
    assert.equal((await app.call('POST', '/api/exam/start', { token: s.token, body: { exam: 'cpa' } })).body.error, 'invalid_exam');
  });

  test('tries rule: 3 misses in a row lock for 24 hours, per student and per email; a pass resets', async () => {
    const app = makeApp();
    const s = await enroll(app, { email: 'locked@example.com' });
    for (let i = 0; i < 2; i++) assert.equal((await passWritten(app, s.token, 'pro', 10)).passed, false);
    // a pass resets the count
    assert.equal((await passWritten(app, s.token, 'pro')).passed, true);
    let me = (await app.call('GET', '/api/me', { token: s.token })).body;
    assert.equal(me.exams.pro.written.tries.left, 3);
    for (let i = 0; i < 3; i++) await passWritten(app, s.token, 'pro', 10);
    me = (await app.call('GET', '/api/me', { token: s.token })).body;
    assert.equal(me.exams.pro.written.tries.left, 0);
    assert(me.exams.pro.written.tries.lockedUntil);
    const locked = await app.call('POST', '/api/exam/start', { token: s.token, body: { exam: 'pro' } });
    assert.equal(locked.status, 423); assert.equal(locked.body.error, 'locked');
    assert.equal(locked.body.lockedUntil, new Date(app.clock.now + DAY).toISOString().replace('.000Z', 'Z'));
    // enrolling again with the same email doesn't dodge it (any letter case)
    const twin = await enroll(app, { email: 'LOCKED@example.com' });
    assert.equal((await app.call('POST', '/api/exam/start', { token: twin.token, body: { exam: 'pro' } })).status, 423);
    // the practical has its own count
    assert.equal((await app.call('POST', '/api/practical/start', { token: s.token, body: { exam: 'pro' } })).status, 200);
    // still locked one minute before the 24 hours are up, open after
    app.advance(DAY - 60e3);
    assert.equal((await app.call('POST', '/api/exam/start', { token: s.token, body: { exam: 'pro' } })).status, 423);
    app.advance(2 * 60e3);
    const open = await app.call('POST', '/api/exam/start', { token: s.token, body: { exam: 'pro' } });
    assert.equal(open.status, 200); assert.equal(open.body.triesLeft, 3);
  });

  test('an attempt left past its 3 hours counts as a miss', async () => {
    const app = makeApp(); const s = await enroll(app);
    const st = (await app.call('POST', '/api/exam/start', { token: s.token, body: { exam: 'pro' } })).body;
    app.advance(3 * HOUR + 1000);
    const late = await app.call('POST', '/api/exam/submit', { token: s.token, body: { attemptId: st.attemptId, answers: answerSheet('pro', st.questions, 0, storedQuestions(app, st.attemptId)) } });
    assert.equal(late.status, 410); assert.equal(late.body.error, 'attempt_expired');
    assert.equal((await app.call('GET', '/api/me', { token: s.token })).body.exams.pro.written.tries.left, 2);
    // abandoning one (never submitting) also counts, once, when the next is started
    const st2 = (await app.call('POST', '/api/exam/start', { token: s.token, body: { exam: 'pro' } })).body;
    assert.notEqual(st2.attemptId, st.attemptId);
    app.advance(4 * HOUR);
    const st3 = (await app.call('POST', '/api/exam/start', { token: s.token, body: { exam: 'pro' } })).body;
    assert.notEqual(st3.attemptId, st2.attemptId);
    assert.equal(st3.triesLeft, 1);
  });

  test('the Advanced exams need the Professional certificate', async () => {
    const app = makeApp(); const s = await enroll(app);
    const w = await app.call('POST', '/api/exam/start', { token: s.token, body: { exam: 'adv' } });
    assert.equal(w.status, 403); assert.equal(w.body.error, 'prerequisite');
    const p = await app.call('POST', '/api/practical/start', { token: s.token, body: { exam: 'adv' } });
    assert.equal(p.status, 403); assert.equal(p.body.error, 'prerequisite');
    const c = await app.call('POST', '/api/credential/claim', { token: s.token, body: { program: 'advanced' } });
    assert.equal(c.status, 403); assert.deepEqual(c.body.needs, ['professional_certificate', 'written', 'practical']);
  });
});

// ======================================================================
describe('practical exams', () => {
  test('each student gets their own numbers, and no expected values', async () => {
    const app = makeApp();
    const a = await enroll(app), b = await enroll(app);
    const pa = (await app.call('POST', '/api/practical/start', { token: a.token, body: { exam: 'pro' } })).body;
    const pb = (await app.call('POST', '/api/practical/start', { token: b.token, body: { exam: 'pro' } })).body;
    assert.match(pa.practicalId, /^pr_[a-z0-9]{16}$/);
    assert.notEqual(pa.client.examKey.statement, pb.client.examKey.statement);
    const amounts = p => p.client.transactions.map(t => t.amount).sort().join(',');
    assert.notEqual(amounts(pa), amounts(pb));
    assert.notDeepEqual(pa.brief.documents, pb.brief.documents);
    // last month, as in the app
    assert.deepEqual(pa.brief.month, { from: '2026-09-01', to: '2026-09-30', label: 'September 2026' });
    assert.deepEqual(pa.client.examKey.month, { from: '2026-09-01', to: '2026-09-30' });
    assert.equal(pa.client.academy.practicalId, pa.practicalId);
    for (const p of [pa, pb]) {
      assert(!deepKeys(p).some(k => /^(expect|work|amounts|answer_?key)$/i.test(k)), 'answer key leaked');
      assert.deepEqual(Object.keys(p.client.examKey).sort(), ['begin', 'card', 'check', 'checkNo', 'dep', 'draw', 'flor', 'gas', 'goog', 'ins', 'inv', 'month', 'payroll', 'sav', 'statement', 'tax', 'teatro', 'xcel1', 'xcel2']);
      assert.equal(p.client.exam, true);
      assert.equal(p.client.transactions.filter(t => t.status === 'review').length, 10);
      assert.equal(p.brief.documents.length, 4); assert.equal(p.brief.tasks.length, 7);
    }
    // the hidden key never reaches the client
    const key = JSON.parse(app.env.DB.db.prepare('SELECT answer_key FROM practicals WHERE id = ?').get(pa.practicalId).answer_key);
    assert(key.amounts && key.ids && key.statement);
    // resume vs. start over
    const again = (await app.call('POST', '/api/practical/start', { token: a.token, body: { exam: 'pro' } })).body;
    assert.equal(again.practicalId, pa.practicalId); assert.equal(again.resumed, true);
    assert.deepEqual(again.client, pa.client);
    const fresh = (await app.call('POST', '/api/practical/start', { token: a.token, body: { exam: 'pro', fresh: true } })).body;
    assert.notEqual(fresh.practicalId, pa.practicalId);
    const old = await app.call('POST', '/api/practical/submit', { token: a.token, body: { practicalId: pa.practicalId, client: pa.client } });
    assert.equal(old.status, 409); assert.equal(old.body.error, 'practical_replaced');
  });

  test('Juniper: solved from the documents → 100 and a pass; wrong books stay under 80', async () => {
    const app = makeApp(); const s = await enroll(app);
    const st = (await app.call('POST', '/api/practical/start', { token: s.token, body: { exam: 'pro' } })).body;
    // untouched books
    const raw = (await app.call('POST', '/api/practical/submit', { token: s.token, body: { practicalId: st.practicalId, client: st.client } })).body;
    assert(raw.score < 80); assert.equal(raw.passed, false);
    assert.equal(raw.items.length, 12); assert(raw.items.every(x => !('why' in x)), 'no explanations before a pass');
    // everything right but the month left open: not a pass
    const solved = solvePro(st.client, st.brief);
    assert.equal(solved.book, solved.ending, 'the statement in the brief matches the corrected books');
    const open = structuredClone(solved.client); open.lockDate = null;
    const r1 = (await app.call('POST', '/api/practical/submit', { token: s.token, body: { practicalId: st.practicalId, client: open } })).body;
    assert.deepEqual([r1.score, r1.passed, r1.closed, r1.reconciled], [100, false, false, true]);
    // no payroll split, no AJE and the duplicate left in: 100 − 8 − 8 − 8, and the reconciliation (10) fails too
    const sloppy = structuredClone(solved.client);
    sloppy.transactions.push(structuredClone(st.client.transactions.filter(t => /XCEL/.test(t.description))[1]));
    sloppy.transactions.find(t => /GUSTO/.test(t.description)).splits = null; sloppy.journals = [];
    const r2 = (await app.call('POST', '/api/practical/submit', { token: s.token, body: { practicalId: st.practicalId, client: sloppy } })).body;
    assert.equal(r2.score, 66);
    assert.deepEqual([r2.passed, r2.reconciled], [false, false]);
    assert.deepEqual(r2.items.filter(x => !x.ok).map(x => x.label.split(' ')[0]), ['Duplicate', 'Payroll', 'CPA\'s', 'Checking']);
    assert.equal((await app.call('GET', '/api/me', { token: s.token })).body.exams.pro.practical.tries.lockedUntil !== null, true, 'three misses lock grading');
    // grading is locked now — 24 hours later the right books pass
    assert.equal((await app.call('POST', '/api/practical/submit', { token: s.token, body: { practicalId: st.practicalId, client: solved.client } })).status, 423);
    app.advance(DAY + 1000);
    const r = (await app.call('POST', '/api/practical/submit', { token: s.token, body: { practicalId: st.practicalId, client: solved.client } })).body;
    assert.deepEqual([r.score, r.passed, r.closed, r.reconciled], [100, true, true, true]);
    assert(r.items.every(x => x.ok && x.got === x.pts && typeof x.why === 'string'));
    assert.deepEqual(r.best, { score: 100, passed: true, passScore: 100 });
    // books for a different client are refused
    const other = structuredClone(solved.client); other.id = 'someone-else';
    assert.equal((await app.call('POST', '/api/practical/submit', { token: s.token, body: { practicalId: st.practicalId, client: other } })).body.error, 'wrong_client');
    assert.equal((await app.call('POST', '/api/practical/submit', { token: s.token, body: { practicalId: st.practicalId, client: 'x' } })).body.error, 'invalid_client');
  });

  test('Juniper: many random students all solve to exactly 100', async () => {
    const app = makeApp();
    for (let i = 0; i < 25; i++) {
      const s = await enroll(app);
      const { result, solved } = await passPractical(app, s.token, 'pro');
      assert.equal(solved.book, solved.ending);
      assert.equal(result.score, 100, JSON.stringify(result.items.filter(x => !x.ok)));
      assert.equal(result.passed, true);
    }
  });

  test('Aspen Trail: random numbers, solved from the documents → 100', async () => {
    const app = makeApp(); const s = await enroll(app);
    await passWritten(app, s.token, 'pro'); await passPractical(app, s.token, 'pro');
    assert.equal((await app.call('POST', '/api/credential/claim', { token: s.token, body: { program: 'professional' } })).status, 200);
    const seen = new Set();
    for (let i = 0; i < 20; i++) {
      const st = (await app.call('POST', '/api/practical/start', { token: s.token, body: { exam: 'adv', fresh: true } })).body;
      assert(!('expect' in st.client.advKey)); assert.deepEqual(Object.keys(st.client.advKey.month), ['from', 'to']);
      assert.deepEqual(Object.keys(st.client.advKey).sort(), ['deposit', 'loan', 'month', 'tax'], 'advKey holds only transaction ids and the month');
      assert(!deepKeys(st).some(k => /^(expect|work|amounts|answer_?key)$/i.test(k)), 'answer key leaked');
      seen.add(st.brief.documents.map(d => d.text).join('|'));
      const solved = solveAdv(st.client, st.brief);
      if (i === 0) {
        const raw = (await app.call('POST', '/api/practical/submit', { token: s.token, body: { practicalId: st.practicalId, client: st.client } })).body;
        assert.equal(raw.score, 0);
        const open = structuredClone(solved.client); open.lockDate = null;
        const r88 = (await app.call('POST', '/api/practical/submit', { token: s.token, body: { practicalId: st.practicalId, client: open } })).body;
        assert.deepEqual([r88.score, r88.passed], [88, false]);
      }
      const r = (await app.call('POST', '/api/practical/submit', { token: s.token, body: { practicalId: st.practicalId, client: solved.client } })).body;
      assert.equal(r.score, 100, JSON.stringify(r.items.filter(x => !x.ok)) + '\n' + st.brief.documents.map(d => d.text).join('\n'));
      assert.equal(r.items.length, 8); assert.equal(r.passed, true);
    }
    assert.equal(seen.size, 20);
  });
});

// ======================================================================
describe('certificates', () => {
  test('Professional: claim after passing both exams; signed exactly like sign.js', async () => {
    const app = makeApp(); const s = await enroll(app, { name: 'Avery Quinn' });
    const early = await app.call('POST', '/api/credential/claim', { token: s.token, body: { program: 'professional' } });
    assert.equal(early.status, 403); assert.deepEqual(early.body.needs, ['written', 'practical']);
    await passWritten(app, s.token, 'pro', 2);            // 28/30 = 93%
    await passPractical(app, s.token, 'pro');
    const c = await app.call('POST', '/api/credential/claim', { token: s.token, body: { program: 'professional' } });
    assert.equal(c.status, 200, JSON.stringify(c.body));
    const e = c.body;
    assert.match(e.id, /^CL-2026-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    assert.deepEqual([e.name, e.awarded, e.written, e.practical, e.distinction, e.program, e.existing], ['Avery Quinn', '2026-10-28', 93, 100, true, 'professional', false]);
    await assertVerifies(e);
    // public lookup: the credentials.json shape
    const pub = await app.call('GET', '/api/credentials/' + e.id.toLowerCase(), { origin: undefined });
    assert.equal(pub.status, 200);
    assert.deepEqual(Object.keys(pub.body), ['id', 'name', 'awarded', 'written', 'practical', 'distinction', 'program', 'credential']);
    assert.deepEqual(pub.body.credential, e.credential);
    await assertVerifies(pub.body);
    // claiming again returns the same one; the name is now locked
    const again = (await app.call('POST', '/api/credential/claim', { token: s.token, body: { program: 'professional' } })).body;
    assert.equal(again.id, e.id); assert.equal(again.existing, true);
    assert.equal((await app.call('POST', '/api/me', { token: s.token, body: { name: 'Someone Else' } })).body.error, 'name_locked');
    const me = (await app.call('GET', '/api/me', { token: s.token })).body;
    assert.equal(me.nameLocked, true); assert.equal(me.credentials.length, 1); assert.equal(me.exams.adv.available, true);
  });

  test('the credential matches what scripts/credentials/sign.js builds (real key only)', { skip: !KEY.real && 'set CREDENTIAL_SIGNING_KEY or CREDENTIAL_SIGNING_KEY_FILE to compare with sign.js' }, async () => {
    const app = makeApp(); const s = await enroll(app, { name: 'Jordan Lee' });
    await passWritten(app, s.token, 'pro', 5); await passPractical(app, s.token, 'pro');
    const e = (await app.call('POST', '/api/credential/claim', { token: s.token, body: { program: 'professional' } })).body;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'academy-'));
    const file = path.join(dir, 'credentials.json');
    const flat = { id: e.id, name: e.name, awarded: e.awarded, written: e.written, practical: e.practical, distinction: e.distinction, program: e.program };
    execFileSync(process.execPath, [path.join(REPO, 'scripts/credentials/sign.js'), '--file', file, JSON.stringify(flat)], { env: { ...process.env, CREDENTIAL_SIGNING_KEY: KEY.pem } });
    const fromScript = JSON.parse(fs.readFileSync(file, 'utf8'))[0];
    fs.rmSync(dir, { recursive: true, force: true });
    const strip = x => { const y = structuredClone(x); delete y.credential.proof.created; delete y.credential.proof.proofValue; delete y.existing; return y; };
    assert.deepEqual(strip({ ...e }), strip(fromScript));
  });

  test('Advanced: after Professional, the same flow issues a CA- credential', async () => {
    const app = makeApp(); const s = await enroll(app);
    await passWritten(app, s.token, 'pro'); await passPractical(app, s.token, 'pro');
    await app.call('POST', '/api/credential/claim', { token: s.token, body: { program: 'professional' } });
    const w = await passWritten(app, s.token, 'adv', 6); // 29/35 = 83%
    assert.deepEqual([w.total, w.score, w.passed], [35, 29, true]);
    await passPractical(app, s.token, 'adv');
    const e = (await app.call('POST', '/api/credential/claim', { token: s.token, body: { program: 'advanced' } })).body;
    assert.match(e.id, /^CA-2026-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    assert.deepEqual([e.written, e.practical, e.distinction, e.program], [83, 100, false, 'advanced']);
    assert.equal(e.credential.credentialSubject.achievement.name, 'Advanced Accounting & Tax Certificate');
    await assertVerifies(e);
    assert.equal(ADV_BANK.length, 60);
  });

  test('revocation: admin only, re-signed, and verify.html sees it', async () => {
    const app = makeApp(); const s = await enroll(app);
    await passWritten(app, s.token, 'pro'); await passPractical(app, s.token, 'pro');
    const e = (await app.call('POST', '/api/credential/claim', { token: s.token, body: { program: 'professional' } })).body;
    assert.equal((await app.call('POST', '/api/admin/revoke', { body: { id: e.id } })).status, 401);
    assert.equal((await app.call('POST', '/api/admin/revoke', { token: s.token, body: { id: e.id } })).status, 401);
    const r = await app.call('POST', '/api/admin/revoke', { token: ADMIN_TOKEN, origin: null, body: { id: e.id } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.revoked, true); assert.equal(r.body.credential.revoked, true); assert.equal(r.body.credential.revokedOn, '2026-10-28');
    const pub = (await app.call('GET', '/api/credentials/' + e.id)).body;
    assert.equal(pub.revoked, true);
    await assertVerifies(pub);
    assert.equal((await app.call('POST', '/api/admin/revoke', { token: ADMIN_TOKEN, body: { id: e.id } })).body.alreadyRevoked, true);
    // no fresh certificate after a withdrawal
    assert.equal((await app.call('POST', '/api/credential/claim', { token: s.token, body: { program: 'professional' } })).body.error, 'revoked');
    // and the server refuses admin calls when no admin token is configured
    delete app.env.ADMIN_TOKEN;
    assert.equal((await app.call('POST', '/api/admin/revoke', { token: ADMIN_TOKEN, body: { id: e.id } })).status, 503);
  });

  test('no signing key, or a key that doesn\'t match the published one → 503', async () => {
    const app = makeApp(); const s = await enroll(app);
    await passWritten(app, s.token, 'pro'); await passPractical(app, s.token, 'pro');
    const pem = app.env.CREDENTIAL_SIGNING_KEY;
    app.env.CREDENTIAL_SIGNING_KEY = '';
    assert.equal((await app.call('POST', '/api/credential/claim', { token: s.token, body: { program: 'professional' } })).body.error, 'signing_unavailable');
    app.env.CREDENTIAL_SIGNING_KEY = crypto.generateKeyPairSync('ed25519').privateKey.export({ type: 'pkcs8', format: 'pem' });
    assert.equal((await app.call('POST', '/api/credential/claim', { token: s.token, body: { program: 'professional' } })).body.error, 'signing_unavailable');
    app.env.CREDENTIAL_SIGNING_KEY = pem.replace(/\n/g, '\\n'); // pasted with literal \n is fine
    assert.equal((await app.call('POST', '/api/credential/claim', { token: s.token, body: { program: 'professional' } })).status, 200);
  });
});

// ======================================================================
describe('data deletion', () => {
  test('DELETE /api/me removes the student and everything linked to them', async () => {
    const app = makeApp(); const s = await enroll(app);
    await passWritten(app, s.token, 'pro'); await passPractical(app, s.token, 'pro');
    const e = (await app.call('POST', '/api/credential/claim', { token: s.token, body: { program: 'professional' } })).body;
    await app.call('PUT', '/api/progress', { token: s.token, body: { data: '{}' } });
    assert.equal((await app.call('DELETE', '/api/me', { token: s.token, body: {} })).body.error, 'confirm_required');
    const d = await app.call('DELETE', '/api/me', { token: s.token, body: { confirm: 'DELETE' } });
    assert.deepEqual(d.body, { deleted: true, keptCredentials: false });
    assert.equal((await app.call('GET', '/api/me', { token: s.token })).status, 401);
    assert.equal((await app.call('GET', '/api/credentials/' + e.id)).status, 404);
    const db = app.env.DB.db;
    for (const t of ['students', 'tokens', 'progress', 'written_attempts', 'practicals', 'results', 'credentials']) {
      assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n, 0, t);
    }
    assert(!JSON.stringify(db.prepare('SELECT * FROM tries').all()).includes('@'), 'no email kept in clear');
  });

  test('keepCredentials leaves the certificate verifiable', async () => {
    const app = makeApp(); const s = await enroll(app);
    await passWritten(app, s.token, 'pro'); await passPractical(app, s.token, 'pro');
    const e = (await app.call('POST', '/api/credential/claim', { token: s.token, body: { program: 'professional' } })).body;
    await app.call('DELETE', '/api/me', { token: s.token, body: { confirm: 'DELETE', keepCredentials: true } });
    const pub = await app.call('GET', '/api/credentials/' + e.id);
    assert.equal(pub.status, 200); assert.equal(pub.body.name, e.name);
  });
});

// ======================================================================
describe('daily clean-up', () => {
  test('removes expired codes, old rate-limit windows and stale tries; keeps live data', async () => {
    const app = makeApp(); const s = await enroll(app);
    await app.call('POST', '/api/code', { token: s.token });
    await passWritten(app, s.token, 'pro', 10); // one failed try on record
    const count = t => app.env.DB.db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;
    assert.equal(count('signin_codes'), 1); assert(count('rate_limits') >= 1); assert.equal(count('tries'), 2);
    await worker.scheduled({}, app.env);
    assert.equal(count('signin_codes'), 1, 'a live code stays');
    app.advance(31 * DAY);
    await worker.scheduled({}, app.env);
    assert.deepEqual([count('signin_codes'), count('rate_limits'), count('tries'), count('students')], [0, 0, 0, 1]);
  });
});
