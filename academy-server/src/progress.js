// Progress sync: one saved copy of the app's Academy progress per student, so
// the phone and the desktop stay in step under the same student account.
import { fail } from './http.js';
import { isoTime } from './util.js';

export const MAX_PROGRESS = 900 * 1024;             // characters of `data`
export const MAX_PROGRESS_BODY = MAX_PROGRESS + 8 * 1024; // the JSON wrapper around it

// PUT /api/progress {data, encoding?, baseVersion?}
//   data:        the progress as a string — plain JSON text, or gzip compressed then base64
//   encoding:    'json' (default) or 'gzip-base64'
//   baseVersion: optional; the version this device last saw. If the server has a
//                newer one, nothing is saved and 409 'conflict' is returned.
export async function putProgress(env, student, body, now) {
  const data = body.data;
  if (typeof data !== 'string' || !data.length) fail(400, 'invalid_progress', 'data must be a non-empty string (JSON text, or gzip+base64).');
  if (data.length > MAX_PROGRESS) fail(413, 'too_large', 'Progress is larger than 900 KB.');
  const encoding = body.encoding == null ? 'json' : String(body.encoding);
  if (encoding !== 'json' && encoding !== 'gzip-base64') fail(400, 'invalid_progress', 'encoding must be "json" or "gzip-base64".');
  if (encoding === 'gzip-base64' && !/^[A-Za-z0-9+/_-]+={0,2}$/.test(data)) fail(400, 'invalid_progress', 'data isn\'t valid base64.');
  if (encoding === 'json' && !/^\s*[[{]/.test(data)) fail(400, 'invalid_progress', 'data should be JSON text (an object or array).');

  const cur = await env.DB.prepare('SELECT version, updated_at FROM progress WHERE student_id = ?1').bind(student.id).first();
  const curVersion = cur ? cur.version : 0;
  if (body.baseVersion != null) {
    const base = Number(body.baseVersion);
    if (!Number.isInteger(base) || base < 0) fail(400, 'invalid_progress', 'baseVersion must be a whole number.');
    if (base !== curVersion) fail(409, 'conflict', 'Newer progress was saved from another device. Download it first (GET /api/progress), merge, then save again.', { version: curVersion, updatedAt: cur ? isoTime(cur.updated_at) : null });
  }
  const version = curVersion + 1;
  // The WHERE on the update keeps two devices saving at the same instant from both "winning".
  const res = await env.DB.prepare(
    'INSERT INTO progress (student_id, data, encoding, size, version, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6) ' +
    'ON CONFLICT (student_id) DO UPDATE SET data = ?2, encoding = ?3, size = ?4, version = ?5, updated_at = ?6 WHERE progress.version = ?7'
  ).bind(student.id, data, encoding, data.length, version, now, curVersion).run();
  if (!res.meta || !res.meta.changes) fail(409, 'conflict', 'Progress was saved from another device at the same moment. Download it and try again.');
  return { version, updatedAt: isoTime(now), size: data.length };
}

// GET /api/progress → {data, encoding, version, updatedAt} (data null when nothing saved yet)
export async function getProgress(env, student) {
  const row = await env.DB.prepare('SELECT data, encoding, version, updated_at FROM progress WHERE student_id = ?1').bind(student.id).first();
  if (!row) return { data: null, encoding: null, version: 0, updatedAt: null };
  return { data: row.data, encoding: row.encoding, version: row.version, updatedAt: isoTime(row.updated_at) };
}
