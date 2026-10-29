// Written exams, graded on the server. The answer key never leaves the server:
// the client gets questions and options in a shuffled order only.
// Each official exam is about 60% bank questions (the banks are public, so they can
// be studied) and about 40% calculation questions generated for that attempt from
// fresh random numbers (src/banks/generated.js), so answers can't be memorized.
import PRO_BANK from './banks/pro.js';
import ADV_BANK from './banks/adv.js';
import { generateSet } from './banks/generated.js';
import { fail } from './http.js';
import { randomInt, isoTime } from './util.js';
import { newId } from './students.js';
import { assertNotLocked, recordTry } from './limits.js';

// Same sizes and pass mark as the app (views-exam.js / views-advanced.js).
// draw = fromBank + generated.
export const EXAMS = {
  pro: { bank: PRO_BANK, draw: 30, fromBank: 18, generated: 12, pass: 0.8, title: 'Professional written exam' },
  adv: { bank: ADV_BANK, draw: 35, fromBank: 21, generated: 14, pass: 0.8, title: 'Advanced written exam' }
};
export const ATTEMPT_MS = 3 * 60 * 60 * 1000; // an attempt must be submitted within 3 hours

function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// The app's draw: at least one question from every topic, then fill at random
// up to the draw size; each question's three options in a random order.
export function drawQuestions(bank, draw) {
  const idx = bank.map((_, i) => i);
  const topics = [...new Set(bank.map(q => q[0]))];
  const picked = new Set(topics.map(tp => shuffle(idx.filter(i => bank[i][0] === tp))[0]));
  for (const i of shuffle(idx)) { if (picked.size >= draw) break; picked.add(i); }
  return shuffle([...picked]).map(b => ({ b, o: shuffle([0, 1, 2]) }));
}

// The full entry [topic, question, options, correct, why] for a stored question:
// { b, o } is a bank question (b = bank index, o = option order shown);
// { g, o } is a generated one, stored whole with the attempt (g.options already shuffled).
export const entryOf = (exam, q) => (q.g ? [q.g.topic, q.g.question, q.g.options, q.g.correct, q.g.why] : EXAMS[exam].bank[q.b]);

// A new attempt's questions: bank questions (every topic covered) plus generated
// calculation questions, mixed together in a random order.
export function buildAttempt(exam, seed = randomInt(0xFFFFFFFF) + 1) {
  const E = EXAMS[exam];
  const bank = drawQuestions(E.bank, E.fromBank);
  const gen = generateSet(exam, E.generated, seed).map(g => ({ g, o: [0, 1, 2] }));
  return shuffle([...bank, ...gen]);
}

// What the student sees: no correct index, no explanation, no inputs.
const publicQuestions = (exam, qs) => qs.map((q, k) => { const [topic, question, options] = entryOf(exam, q); return { id: `q${k + 1}`, topic, question, options: q.o.map(i => options[i]) }; });

const attemptView = (exam, row, qs, extra = {}) => ({
  attemptId: row.id, exam, title: EXAMS[exam].title,
  startedAt: isoTime(row.started_at), expiresAt: isoTime(row.expires_at),
  total: qs.length, passPercent: Math.round(EXAMS[exam].pass * 100), needed: Math.ceil(qs.length * EXAMS[exam].pass),
  questions: publicQuestions(exam, qs), ...extra
});

export async function hasCredential(env, studentId, program) {
  return !!(await env.DB.prepare('SELECT id FROM credentials WHERE student_id = ?1 AND program = ?2 AND revoked = 0 LIMIT 1').bind(studentId, program).first());
}
export async function assertPrerequisite(env, student, exam) {
  if (exam === 'adv' && !(await hasCredential(env, student.id, 'professional')))
    fail(403, 'prerequisite', 'The Advanced exams open once you hold the Professional Bookkeeping Certificate.');
}

// Marks an open attempt as expired and counts it as a failed try. Returns true if it did.
async function expireAttempt(env, student, exam, id, now) {
  const row = await env.DB.prepare("UPDATE written_attempts SET status = 'expired' WHERE id = ?1 AND status = 'open' RETURNING id").bind(id).first();
  if (row) await recordTry(env, student, `${exam}-written`, false, now);
  return !!row;
}

// POST /api/exam/start {exam}
export async function startWritten(env, student, exam, now) {
  const E = EXAMS[exam], key = `${exam}-written`;
  await assertPrerequisite(env, student, exam);
  await assertNotLocked(env, student, key, now, E.title);

  // An open attempt is resumed (same questions), so a dropped connection or a
  // second device doesn't burn a try or draw a fresh set.
  const open = await env.DB.prepare("SELECT * FROM written_attempts WHERE student_id = ?1 AND exam = ?2 AND status = 'open' ORDER BY started_at DESC").bind(student.id, exam).all();
  for (const row of open.results || []) {
    if (row.expires_at > now) return attemptView(exam, row, JSON.parse(row.questions), { resumed: true });
    await expireAttempt(env, student, exam, row.id, now); // left unfinished: counts as a miss
  }
  const tries = await assertNotLocked(env, student, key, now, E.title);

  const qs = buildAttempt(exam);
  const row = { id: newId('wa', 16), started_at: now, expires_at: now + ATTEMPT_MS };
  await env.DB.prepare("INSERT INTO written_attempts (id, student_id, exam, questions, status, started_at, expires_at) VALUES (?1, ?2, ?3, ?4, 'open', ?5, ?6)")
    .bind(row.id, student.id, exam, JSON.stringify(qs), row.started_at, row.expires_at).run();
  return attemptView(exam, row, qs, { resumed: false, triesLeft: tries.left });
}

// POST /api/exam/submit {attemptId, answers: {qid: optionIndex}}
export async function submitWritten(env, student, body, now) {
  const attemptId = String(body.attemptId || '');
  if (!/^wa_[a-z0-9]{16}$/.test(attemptId)) fail(400, 'invalid_attempt', 'attemptId is missing or malformed.');
  const answers = body.answers;
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) fail(400, 'invalid_answers', 'answers must be an object like {"q1": 0, "q2": 2}.');

  const row = await env.DB.prepare('SELECT * FROM written_attempts WHERE id = ?1 AND student_id = ?2').bind(attemptId, student.id).first();
  if (!row) fail(404, 'not_found', 'No such exam attempt.');
  const exam = row.exam, E = EXAMS[exam];
  if (row.status === 'submitted') fail(409, 'already_submitted', 'This attempt was already submitted. Start a new attempt to try again.');
  if (row.status === 'expired' || row.expires_at <= now) {
    await expireAttempt(env, student, exam, row.id, now);
    fail(410, 'attempt_expired', 'The time for this attempt ran out, so it counts as a try. Start a new attempt.');
  }

  const qs = JSON.parse(row.questions);
  for (const [k, v] of Object.entries(answers)) {
    const n = /^q(\d+)$/.exec(k);
    if (!n || +n[1] < 1 || +n[1] > qs.length) fail(400, 'invalid_answers', `Unknown question id "${k}".`);
    if (v != null && !(Number.isInteger(v) && v >= 0 && v <= 2)) fail(400, 'invalid_answers', `The answer to ${k} must be 0, 1 or 2 (the position of the option as shown).`);
  }

  // Close the attempt first; only one submission can win this update.
  const won = await env.DB.prepare("UPDATE written_attempts SET status = 'submitted', submitted_at = ?2 WHERE id = ?1 AND status = 'open' RETURNING id").bind(row.id, now).first();
  if (!won) fail(409, 'already_submitted', 'This attempt was already submitted.');

  const review = [];
  let score = 0;
  qs.forEach((q, k) => {
    const [topic, question, options, correct, why] = entryOf(exam, q);
    const shown = answers[`q${k + 1}`];
    const chosen = Number.isInteger(shown) ? q.o[shown] : null; // back to the bank's option index
    if (chosen === correct) score++;
    else review.push({ id: `q${k + 1}`, topic, question, yourAnswer: chosen == null ? null : options[chosen], correctAnswer: options[correct], why });
  });
  const total = qs.length, pct = score / total, passed = pct >= E.pass;
  await env.DB.batch([
    env.DB.prepare('UPDATE written_attempts SET score = ?2, total = ?3 WHERE id = ?1').bind(row.id, score, total),
    env.DB.prepare("INSERT INTO results (student_id, exam, kind, ref_id, score, total, pct, passed, at) VALUES (?1, ?2, 'written', ?3, ?4, ?5, ?6, ?7, ?8)")
      .bind(student.id, exam, row.id, score, total, pct, passed ? 1 : 0, now)
  ]);
  const tries = await recordTry(env, student, `${exam}-written`, passed, now);
  return {
    attemptId: row.id, exam, score, total, pct, percent: Math.round(pct * 100), passed,
    needed: Math.ceil(total * E.pass), distinctionLevel: pct >= 0.92,
    review, tries: { left: tries.left, lockedUntil: tries.lockedUntil ? isoTime(tries.lockedUntil) : null }
  };
}
