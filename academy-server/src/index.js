// Coll Ledger Academy server ("Academy server") — Cloudflare Worker entry point.
// Coll Business Solutions LLC.
//
// Routes (see API.md for request and response details):
//   POST   /api/enroll                 public   new student → token
//   GET    /api/me                     token    profile, exam status, certificates
//   POST   /api/me                     token    fix the name (until a certificate is issued)
//   DELETE /api/me                     token    delete the account and its data
//   POST   /api/logout                 token    forget this device's token
//   GET    /api/progress               token    download saved progress
//   PUT    /api/progress               token    save progress (≤ 900 KB)
//   POST   /api/code                   token    one-time 8-character sign-in code (15 min)
//   POST   /api/code/redeem            public   code → a token for this device
//   POST   /api/exam/start             token    written exam: questions, no answers
//   POST   /api/exam/submit            token    written exam: graded here
//   POST   /api/practical/start        token    practical exam: this student's own client
//   POST   /api/practical/submit       token    practical exam: books graded here
//   POST   /api/credential/claim       token    issue the signed certificate
//   GET    /api/credentials/:id        public   look up a certificate (any website may ask)
//   POST   /api/admin/revoke           admin    withdraw a certificate
import { signingStatus } from './credentials.js';
import { ApiError, json, errorResponse, corsHeaders, withHeaders, originAllowed, readJson, examParam, fail } from './http.js';
import { safeEqual, isoTime } from './util.js';
import * as students from './students.js';
import * as progress from './progress.js';
import { startWritten, submitWritten, EXAMS, hasCredential } from './written.js';
import { startPractical, submitPractical, bestPractical, MAX_CLIENT_BODY } from './practical/index.js';
import { claim, getPublic, revoke, listForStudent, eligibility } from './credentials.js';
import { triesStatus } from './limits.js';

// Tests pass a fake clock as env.__clock; in production it's always the real time.
const clock = env => (typeof env.__clock === 'function' ? env.__clock() : Date.now());

async function examStatus(env, student, exam, now) {
  const program = exam === 'pro' ? 'professional' : 'advanced';
  const available = exam === 'pro' || (await hasCredential(env, student.id, 'professional'));
  const w = await env.DB.prepare("SELECT COUNT(*) AS n, MAX(pct) AS best, MAX(passed) AS passed FROM results WHERE student_id = ?1 AND exam = ?2 AND kind = 'written'").bind(student.id, exam).first();
  const open = await env.DB.prepare("SELECT id, expires_at FROM written_attempts WHERE student_id = ?1 AND exam = ?2 AND status = 'open' AND expires_at > ?3 ORDER BY started_at DESC LIMIT 1").bind(student.id, exam, now).first();
  const pr = await env.DB.prepare("SELECT id FROM practicals WHERE student_id = ?1 AND exam = ?2 AND status = 'active' ORDER BY created_at DESC LIMIT 1").bind(student.id, exam).first();
  const best = await bestPractical(env, student.id, exam);
  const t = async k => { const s = await triesStatus(env, student, `${exam}-${k}`, now); return { left: s.left, lockedUntil: s.lockedUntil ? isoTime(s.lockedUntil) : null }; };
  const el = await eligibility(env, student, program);
  return {
    available,
    written: { passed: !!(w && w.passed), bestPercent: w && w.best != null ? Math.round(w.best * 100) : null, attempts: w ? w.n : 0, questions: EXAMS[exam].draw,
      openAttempt: open ? { attemptId: open.id, expiresAt: isoTime(open.expires_at) } : null, tries: await t('written') },
    practical: { passed: best.passed, bestScore: best.score, bestPassingScore: best.passScore, practicalId: pr ? pr.id : null, tries: await t('practical') },
    certificate: { program, eligible: el.needs.length === 0, needs: el.needs }
  };
}

async function me(env, student, now) {
  const prog = await env.DB.prepare('SELECT version, updated_at FROM progress WHERE student_id = ?1').bind(student.id).first();
  const credentials = await listForStudent(env, student.id);
  return {
    student: { id: student.id, name: student.name, email: student.email, createdAt: isoTime(student.createdAt) },
    nameLocked: credentials.length > 0,
    exams: { pro: await examStatus(env, student, 'pro', now), adv: await examStatus(env, student, 'adv', now) },
    credentials,
    progress: prog ? { version: prog.version, updatedAt: isoTime(prog.updated_at) } : { version: 0, updatedAt: null }
  };
}

function requireAdmin(env, request) {
  const m = /^Bearer\s+(\S+)\s*$/.exec(request.headers.get('Authorization') || '');
  if (!env.ADMIN_TOKEN || String(env.ADMIN_TOKEN).length < 16) fail(503, 'admin_unavailable', 'The admin token isn\'t set up on the server.');
  if (!m || !safeEqual(m[1], env.ADMIN_TOKEN)) fail(401, 'unauthorized', 'Admin token required.');
}

async function route(request, env, url, now) {
  const { pathname } = url, method = request.method;
  const auth = () => students.authenticate(env, request);

  if (pathname === '/' || pathname === '/api' || pathname === '/api/health') return json({ ok: true, service: 'Coll Ledger Academy API', by: 'Coll Business Solutions LLC', time: isoTime(now), ...(pathname === '/api/health' ? { signing: await signingStatus(env), admin: !!(env.ADMIN_TOKEN && String(env.ADMIN_TOKEN).length >= 16) } : {}) });

  // Public credential lookup
  const cred = /^\/api\/credentials\/([^/]+)$/.exec(pathname);
  if (cred && method === 'GET') return json(await getPublic(env, cred[1]), 200, { 'Cache-Control': 'public, max-age=60' });

  switch (`${method} ${pathname}`) {
    case 'POST /api/enroll': return json(await students.enroll(env, request, await readJson(request), now), 201);
    case 'POST /api/code/redeem': return json(await students.redeemCode(env, request, await readJson(request), now));
    case 'GET /api/me': return json(await me(env, await auth(), now));
    case 'POST /api/me': { const s = await auth(); const name = await students.rename(env, s, await readJson(request)); return json({ name }); }
    case 'DELETE /api/me': { const s = await auth(); return json(await students.deleteStudent(env, s, await readJson(request))); }
    case 'POST /api/logout': return json(await students.logout(env, await auth()));
    case 'POST /api/code': return json(await students.createCode(env, await auth(), now));
    case 'GET /api/progress': return json(await progress.getProgress(env, await auth()));
    case 'PUT /api/progress': { const s = await auth(); return json(await progress.putProgress(env, s, await readJson(request, progress.MAX_PROGRESS_BODY), now)); }
    case 'POST /api/exam/start': { const s = await auth(); const b = await readJson(request); return json(await startWritten(env, s, examParam(b.exam), now)); }
    case 'POST /api/exam/submit': { const s = await auth(); return json(await submitWritten(env, s, await readJson(request, 64 * 1024), now)); }
    case 'POST /api/practical/start': { const s = await auth(); const b = await readJson(request); return json(await startPractical(env, s, examParam(b.exam), b.fresh === true, now)); }
    case 'POST /api/practical/submit': { const s = await auth(); return json(await submitPractical(env, s, await readJson(request, MAX_CLIENT_BODY), now)); }
    case 'POST /api/credential/claim': { const s = await auth(); const b = await readJson(request); return json(await claim(env, s, String(b.program || ''), now)); }
    case 'POST /api/admin/revoke': { requireAdmin(env, request); return json(await revoke(env, await readJson(request), now)); }
  }
  fail(404, 'not_found', `No route for ${method} ${pathname}.`);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const isPublic = /^\/api\/credentials\/[^/]+$/.test(url.pathname) || url.pathname === '/' || url.pathname === '/api/health';

    if (!isPublic && !originAllowed(origin, env)) {
      return json({ error: 'origin_not_allowed', message: 'This website isn\'t allowed to use the Academy API.' }, 403, { Vary: 'Origin' });
    }
    const cors = corsHeaders(origin, isPublic);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    let res;
    try {
      res = await route(request, env, url, clock(env));
    } catch (e) {
      if (e instanceof ApiError) res = errorResponse(e);
      else { console.error('Unhandled error', e && e.stack || e); res = json({ error: 'server_error', message: 'Something went wrong on the Academy server. Please try again.' }, 500); }
    }
    return withHeaders(res, { ...cors, 'X-Content-Type-Options': 'nosniff' });
  },

  // Daily tidy-up (cron in wrangler.toml): expired codes, old rate-limit
  // windows, stale tries rows, and long-expired unsubmitted attempts' questions.
  async scheduled(event, env) {
    const now = clock(env), day = 86400e3;
    await env.DB.batch([
      env.DB.prepare('DELETE FROM signin_codes WHERE expires_at < ?1').bind(now - day),
      env.DB.prepare('DELETE FROM rate_limits WHERE window_start < ?1').bind(now - 2 * 3600e3),
      env.DB.prepare('DELETE FROM tries WHERE updated_at < ?1 AND lock_until < ?2').bind(now - 30 * day, now),
      env.DB.prepare("UPDATE written_attempts SET questions = '[]' WHERE status = 'expired' AND started_at < ?1").bind(now - 30 * day)
    ]);
  }
};
