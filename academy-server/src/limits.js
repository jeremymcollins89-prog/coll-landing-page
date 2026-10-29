// Rate limits and the exam tries rule, both kept in D1.
import { fail } from './http.js';
import { sha256, isoTime } from './util.js';

// ---------------------------------------------------------------- rate limits
// Fixed one-hour windows per IP. The IP is never stored: only a shortened hash.
export const LIMITS = {
  enroll: { max: 20, windowMs: 3600e3 },   // new enrollments per IP per hour
  redeem: { max: 10, windowMs: 3600e3 },   // one-time-code sign-in attempts per IP per hour
  code:   { max: 10, windowMs: 3600e3 }    // one-time codes created per student per hour
};

export async function rateLimit(env, now, what, who) {
  const { max, windowMs } = LIMITS[what];
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const bucket = `${what}:${(await sha256('rl|' + who)).slice(0, 24)}`;
  const row = await env.DB.prepare(
    'INSERT INTO rate_limits (bucket, window_start, count) VALUES (?1, ?2, 1) ' +
    'ON CONFLICT (bucket, window_start) DO UPDATE SET count = count + 1 RETURNING count'
  ).bind(bucket, windowStart).first();
  if (row && row.count > max) {
    const retry = Math.ceil((windowStart + windowMs - now) / 1000);
    fail(429, 'rate_limited', `Too many tries from here. Please wait ${Math.ceil(retry / 60)} minutes and try again.`, { retryAfter: retry });
  }
}
export const clientIp = request => request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';

// ---------------------------------------------------------------- tries rule
// Same rule as the app (views-lab.js): three failed tries in a row, then a
// 24-hour wait; a pass resets the count. Kept per student AND per email, so
// enrolling again with the same email doesn't reset it.
export const TRIES = 3, WAIT_MS = 24 * 60 * 60 * 1000;

export const subjectsFor = async student => [`student:${student.id}`, `email:${await sha256('email|' + student.email)}`];

async function readState(env, subject, key, now) {
  const row = await env.DB.prepare('SELECT fails, lock_until FROM tries WHERE subject = ?1 AND exam_key = ?2').bind(subject, key).first();
  let s = row ? { fails: row.fails, lockUntil: row.lock_until } : { fails: 0, lockUntil: 0 };
  if (s.lockUntil && s.lockUntil <= now) s = { fails: 0, lockUntil: 0 }; // the wait is over
  return s;
}

// { left, lockedUntil } for a student and exam key, combining both subjects.
export async function triesStatus(env, student, key, now) {
  const states = await Promise.all((await subjectsFor(student)).map(s => readState(env, s, key, now)));
  const lockedUntil = Math.max(0, ...states.map(s => s.lockUntil));
  const fails = Math.max(0, ...states.map(s => s.fails));
  return { left: lockedUntil ? 0 : TRIES - fails, lockedUntil: lockedUntil || null };
}

export async function assertNotLocked(env, student, key, now, what) {
  const st = await triesStatus(env, student, key, now);
  if (st.lockedUntil) {
    const mins = Math.ceil((st.lockedUntil - now) / 60000), h = Math.floor(mins / 60), m = mins % 60;
    fail(423, 'locked', `${what} opens again in ${h ? `${h} hr${m ? ` ${m} min` : ''}` : `${m} min`} — three tries in a row, then a 24-hour break. A good time to review.`, { lockedUntil: isoTime(st.lockedUntil) });
  }
  return st;
}

// Records one try for both subjects and returns the combined status after it.
export async function recordTry(env, student, key, passed, now) {
  const stmts = [];
  for (const subject of await subjectsFor(student)) {
    const s = await readState(env, subject, key, now);
    if (passed) { s.fails = 0; s.lockUntil = 0; }
    else { s.fails++; if (s.fails >= TRIES) { s.fails = 0; s.lockUntil = now + WAIT_MS; } }
    stmts.push(env.DB.prepare(
      'INSERT INTO tries (subject, exam_key, fails, lock_until, updated_at) VALUES (?1, ?2, ?3, ?4, ?5) ' +
      'ON CONFLICT (subject, exam_key) DO UPDATE SET fails = ?3, lock_until = ?4, updated_at = ?5'
    ).bind(subject, key, s.fails, s.lockUntil, now));
  }
  await env.DB.batch(stmts);
  return triesStatus(env, student, key, now);
}
