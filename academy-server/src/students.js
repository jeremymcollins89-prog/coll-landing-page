// Students: enrollment, Bearer-token sign-in, one-time codes for a second
// device, profile and data deletion.
import { fail, cleanName, cleanEmail } from './http.js';
import { randomBytes, randomString, b64url, sha256, isoTime } from './util.js';
import { rateLimit, clientIp } from './limits.js';

const ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
// One-time codes avoid look-alike characters (no 0/O, 1/I/L) so they're easy to type.
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_TTL_MS = 15 * 60 * 1000;

export const newId = (prefix, n = 12) => `${prefix}_${randomString(n, ID_CHARS)}`;
const newToken = () => b64url(randomBytes(32)); // 43 characters, 256 bits

async function issueToken(env, studentId, now) {
  const token = newToken();
  await env.DB.prepare('INSERT INTO tokens (hash, student_id, created_at) VALUES (?1, ?2, ?3)').bind(await sha256(token), studentId, now).run();
  return token;
}

// POST /api/enroll {name, email} → {studentId, token}
export async function enroll(env, request, body, now) {
  await rateLimit(env, now, 'enroll', clientIp(request));
  const name = cleanName(body.name), email = cleanEmail(body.email);
  const id = newId('st');
  await env.DB.prepare('INSERT INTO students (id, name, email, created_at) VALUES (?1, ?2, ?3, ?4)').bind(id, name, email, now).run();
  const token = await issueToken(env, id, now);
  return { studentId: id, token, name, email };
}

// Resolves "Authorization: Bearer <token>" to the student, or fails with 401.
export async function authenticate(env, request) {
  const m = /^Bearer\s+([A-Za-z0-9_-]{20,100})\s*$/.exec(request.headers.get('Authorization') || '');
  if (!m) fail(401, 'unauthorized', 'Sign in first: send your student token as "Authorization: Bearer <token>".');
  const hash = await sha256(m[1]);
  const st = await env.DB.prepare('SELECT s.id, s.name, s.email, s.created_at FROM tokens t JOIN students s ON s.id = t.student_id WHERE t.hash = ?1').bind(hash).first();
  if (!st) fail(401, 'unauthorized', 'That student token isn\'t recognized. It may have been signed out or deleted.');
  return { id: st.id, name: st.name, email: st.email, createdAt: st.created_at, tokenHash: hash };
}

// POST /api/me {name} — fix the name, allowed until a certificate is issued.
export async function rename(env, student, body) {
  const name = cleanName(body.name);
  const issued = await env.DB.prepare('SELECT id FROM credentials WHERE student_id = ?1 LIMIT 1').bind(student.id).first();
  if (issued && name !== student.name) fail(409, 'name_locked', 'Your name is already on an issued certificate, so it can\'t be changed here. Write to collbusinesssolutions@gmail.com for a correction.');
  await env.DB.prepare('UPDATE students SET name = ?1 WHERE id = ?2').bind(name, student.id).run();
  return name;
}

// POST /api/code → {code, expiresAt}: a short one-time code to sign in on another device.
export async function createCode(env, student, now) {
  await rateLimit(env, now, 'code', student.id);
  const code = randomString(8, CODE_CHARS);
  const expiresAt = now + CODE_TTL_MS;
  await env.DB.batch([
    // one live code at a time: older unused codes stop working
    env.DB.prepare('DELETE FROM signin_codes WHERE student_id = ?1').bind(student.id),
    env.DB.prepare('INSERT INTO signin_codes (hash, student_id, expires_at) VALUES (?1, ?2, ?3)').bind(await sha256('code|' + code), student.id, expiresAt)
  ]);
  return { code, expiresAt: isoTime(expiresAt), expiresInSeconds: CODE_TTL_MS / 1000 };
}

// POST /api/code/redeem {code} → {studentId, token}: a new token for this device.
export async function redeemCode(env, request, body, now) {
  await rateLimit(env, now, 'redeem', clientIp(request));
  const code = String(body.code || '').toUpperCase().replace(/[\s-]/g, '');
  if (!/^[A-Z0-9]{8}$/.test(code)) fail(400, 'invalid_code', 'The code is 8 letters and numbers.');
  const hash = await sha256('code|' + code);
  // Mark it used in the same statement that checks it, so a code works exactly once.
  const row = await env.DB.prepare('UPDATE signin_codes SET used_at = ?2 WHERE hash = ?1 AND used_at IS NULL AND expires_at > ?2 RETURNING student_id').bind(hash, now).first();
  if (!row) fail(400, 'invalid_code', 'That code isn\'t valid — it may have expired or already been used. Make a new one on your other device.');
  const st = await env.DB.prepare('SELECT id, name, email FROM students WHERE id = ?1').bind(row.student_id).first();
  if (!st) fail(400, 'invalid_code', 'That code isn\'t valid.');
  const token = await issueToken(env, st.id, now);
  return { studentId: st.id, token, name: st.name, email: st.email };
}

// POST /api/logout — forget this device's token.
export async function logout(env, student) {
  await env.DB.prepare('DELETE FROM tokens WHERE hash = ?1').bind(student.tokenHash).run();
  return { ok: true };
}

// DELETE /api/me {confirm:'DELETE', keepCredentials?} — remove everything about the student.
// Issued certificates are deleted too unless keepCredentials is true, in which
// case they stay publicly verifiable (name and scores only, no link to the account).
export async function deleteStudent(env, student, body) {
  if (body.confirm !== 'DELETE') fail(400, 'confirm_required', 'Send {"confirm":"DELETE"} to delete your account and all its data.');
  const id = student.id;
  const creds = body.keepCredentials === true
    ? env.DB.prepare('UPDATE credentials SET student_id = NULL WHERE student_id = ?1').bind(id)
    : env.DB.prepare('DELETE FROM credentials WHERE student_id = ?1').bind(id);
  await env.DB.batch([
    creds,
    env.DB.prepare('DELETE FROM tokens WHERE student_id = ?1').bind(id),
    env.DB.prepare('DELETE FROM signin_codes WHERE student_id = ?1').bind(id),
    env.DB.prepare('DELETE FROM progress WHERE student_id = ?1').bind(id),
    env.DB.prepare('DELETE FROM written_attempts WHERE student_id = ?1').bind(id),
    env.DB.prepare('DELETE FROM practicals WHERE student_id = ?1').bind(id),
    env.DB.prepare('DELETE FROM results WHERE student_id = ?1').bind(id),
    env.DB.prepare('DELETE FROM tries WHERE subject = ?1').bind('student:' + id),
    env.DB.prepare('DELETE FROM students WHERE id = ?1').bind(id)
  ]);
  return { deleted: true, keptCredentials: body.keepCredentials === true };
}
