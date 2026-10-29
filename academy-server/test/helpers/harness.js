// Runs the Worker's fetch handler in-process against the D1 stand-in, with a
// clock the test controls. `call()` looks like a tiny HTTP client.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from '../../src/index.js';
import { FakeD1 } from './d1.js';
import { testKey } from './keys.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const REPO = path.resolve(ROOT, '..');
export const KEY = testKey();
export const ADMIN_TOKEN = 'test-admin-token-0123456789abcdef';

export function makeApp(start = Date.UTC(2026, 9, 28, 15, 0, 0)) {
  const clock = { now: start };
  const env = {
    DB: new FakeD1().migrate(path.join(ROOT, 'migrations')),
    CREDENTIAL_SIGNING_KEY: KEY.pem,
    ...(KEY.real ? {} : { EXPECTED_KEY_X: KEY.x }),
    ADMIN_TOKEN, ALLOWED_ORIGINS: '',
    __clock: () => clock.now
  };
  let ipCounter = 0;
  async function call(method, p, { body, token, origin = 'https://collbusinesssolutions.com', headers = {}, ip } = {}) {
    const h = { ...headers, 'CF-Connecting-IP': ip || `203.0.113.${(ipCounter++ % 200) + 1}` };
    if (origin !== undefined && origin !== null) h.Origin = origin;
    if (token) h.Authorization = `Bearer ${token}`;
    let payload;
    if (body !== undefined) { payload = typeof body === 'string' ? body : JSON.stringify(body); h['Content-Type'] = 'application/json'; }
    const res = await worker.fetch(new Request('https://academy.test' + p, { method, headers: h, body: payload }), env);
    const text = await res.text();
    let data = null; try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
    return { status: res.status, body: data, headers: res.headers };
  }
  return { env, clock, call, advance: ms => { clock.now += ms; } };
}

export const HOUR = 3600e3, DAY = 24 * HOUR;

// The attempt's questions as stored on the server (test-only: the API never sends this).
export const storedQuestions = (app, attemptId) => JSON.parse(app.env.DB.db.prepare('SELECT questions FROM written_attempts WHERE id = ?').get(attemptId).questions);
