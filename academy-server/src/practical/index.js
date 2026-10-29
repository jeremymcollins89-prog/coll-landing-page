// Practical exams: the server builds each student's own practice client,
// keeps the expected answers, and grades the books the student sends back.
import * as juniper from './juniper.js';
import * as aspen from './aspen.js';
import { fail } from '../http.js';
import { randomInt, seededRandom, previousMonth, isoTime } from '../util.js';
import { newId } from '../students.js';
import { assertNotLocked, recordTry, triesStatus } from '../limits.js';
import { assertPrerequisite } from '../written.js';

export const PRACTICALS = {
  pro: { mod: juniper, title: 'Professional practical exam' },
  adv: { mod: aspen, title: 'Advanced practical exam' }
};
export const MAX_CLIENT_BODY = 1024 * 1024; // the books sent back for grading

// Generates a practical for `month` from a seed (null seed = the app's original numbers).
export function generate(exam, month, seed) {
  const { mod } = PRACTICALS[exam];
  const P = mod.params(seed == null ? null : seededRandom(seed));
  const { client, key } = mod.build(month, P);
  return { client, key, brief: mod.brief(key) };
}

const view = (row, client, key, extra) => ({
  practicalId: row.id, exam: row.exam, createdAt: isoTime(row.created_at),
  client, brief: PRACTICALS[row.exam].mod.brief(key), ...extra
});

// POST /api/practical/start {exam, fresh?}
// Returns the student's active practical (same numbers) unless `fresh` is true
// or there is none yet; then a new one is generated for last month.
export async function startPractical(env, student, exam, fresh, now) {
  await assertPrerequisite(env, student, exam);
  if (!fresh) {
    const row = await env.DB.prepare("SELECT * FROM practicals WHERE student_id = ?1 AND exam = ?2 AND status = 'active' ORDER BY created_at DESC LIMIT 1").bind(student.id, exam).first();
    if (row) return view(row, JSON.parse(row.client), JSON.parse(row.answer_key), { resumed: true });
  }
  const seed = randomInt(0xFFFFFFFF) + 1;
  const { client, key } = generate(exam, previousMonth(now), seed);
  const row = { id: newId('pr', 16), exam, created_at: now };
  client.academy = { practicalId: row.id, exam }; // lets the app tell this is a server-issued practical
  await env.DB.batch([
    env.DB.prepare("UPDATE practicals SET status = 'replaced' WHERE student_id = ?1 AND exam = ?2 AND status = 'active'").bind(student.id, exam),
    env.DB.prepare("INSERT INTO practicals (id, student_id, exam, seed, answer_key, client, status, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'active', ?7)")
      .bind(row.id, student.id, exam, seed, JSON.stringify(key), JSON.stringify(client), now)
  ]);
  return view(row, client, key, { resumed: false });
}

// The uploaded books, made safe for the engine: every list the grader walks is a list.
function sanitizeClient(raw, issuedId) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail(400, 'invalid_client', 'client must be the practice client\'s JSON object.');
  if (raw.id !== issuedId) fail(400, 'wrong_client', 'These books aren\'t the practice client issued for this practical. Send the Juniper Flower Co. / Aspen Trail client you were given (keep its id).');
  const c = { ...raw };
  for (const k of ['accounts', 'transactions', 'invoices', 'bills', 'journals', 'reconciliations', 'contacts', 'recurring', 'rules']) {
    c[k] = Array.isArray(raw[k]) ? raw[k].filter(x => x && typeof x === 'object' && !Array.isArray(x)) : [];
  }
  if (!c.accounts.length) fail(400, 'invalid_client', 'The client has no chart of accounts.');
  for (const t of c.transactions) if (typeof t.date !== 'string' || typeof t.amount !== 'number' || !isFinite(t.amount)) fail(400, 'invalid_client', 'A transaction is missing its date or amount.');
  for (const a of c.accounts) if (typeof a.id !== 'string' || typeof a.name !== 'string' || typeof a.type !== 'string' || typeof a.code !== 'string') fail(400, 'invalid_client', 'An account is malformed.');
  if (c.lockDate != null && typeof c.lockDate !== 'string') c.lockDate = null;
  return c;
}

// POST /api/practical/submit {practicalId, client}
export async function submitPractical(env, student, body, now) {
  const practicalId = String(body.practicalId || '');
  if (!/^pr_[a-z0-9]{16}$/.test(practicalId)) fail(400, 'invalid_practical', 'practicalId is missing or malformed.');
  const row = await env.DB.prepare('SELECT * FROM practicals WHERE id = ?1 AND student_id = ?2').bind(practicalId, student.id).first();
  if (!row) fail(404, 'not_found', 'No such practical exam.');
  if (row.status !== 'active') fail(409, 'practical_replaced', 'You started this practical over, so these books can\'t be graded. Grade the newer one.');
  const exam = row.exam, key = JSON.parse(row.answer_key), issued = JSON.parse(row.client);
  await assertPrerequisite(env, student, exam);
  await assertNotLocked(env, student, `${exam}-practical`, now, 'Grading');

  const c = sanitizeClient(body.client, issued.id);
  let r;
  try { r = PRACTICALS[exam].mod.grade(c, key); } catch (e) { fail(400, 'invalid_client', 'These books couldn\'t be read for grading. Send the client JSON exactly as the app stores it.'); }

  await env.DB.prepare("INSERT INTO results (student_id, exam, kind, ref_id, score, total, pct, passed, at) VALUES (?1, ?2, 'practical', ?3, ?4, 100, ?5, ?6, ?7)")
    .bind(student.id, exam, row.id, r.score, r.score / 100, r.passed ? 1 : 0, now).run();
  const tries = await recordTry(env, student, `${exam}-practical`, r.passed, now);
  const best = await bestPractical(env, student.id, exam);
  return {
    practicalId: row.id, exam, score: r.score, passed: r.passed, closed: r.closed,
    ...(exam === 'pro' ? { reconciled: r.reconciled } : {}),
    // Explanations only once the student has passed, as in the app.
    items: r.items.map(x => ({ label: x.label, pts: x.pts, got: x.got, ok: x.ok, ...(r.passed ? { why: x.why } : {}) })),
    required: r.required,
    best, tries: { left: tries.left, lockedUntil: tries.lockedUntil ? isoTime(tries.lockedUntil) : null }
  };
}

export async function bestPractical(env, studentId, exam) {
  const row = await env.DB.prepare("SELECT MAX(score) AS best, MAX(CASE WHEN passed = 1 THEN score END) AS bestPass FROM results WHERE student_id = ?1 AND exam = ?2 AND kind = 'practical'").bind(studentId, exam).first();
  return { score: row && row.best != null ? row.best : null, passed: !!(row && row.bestPass != null), passScore: row && row.bestPass != null ? row.bestPass : null };
}

export async function practicalTries(env, student, exam, now) { return triesStatus(env, student, `${exam}-practical`, now); }
