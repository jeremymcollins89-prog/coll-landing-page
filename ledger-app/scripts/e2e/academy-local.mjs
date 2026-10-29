// A LOCAL Academy server for end-to-end tests of the app: the real Worker code
// (../../../academy-server/src) on Node's built-in SQLite (the server tests' D1
// stand-in), a throwaway signing key, plus TEST-ONLY routes under /__test/ that
// the real server does not have:
//   GET  /__test/answers?attemptId=wa_…   the right option positions for an attempt
//   POST /__test/solve {exam, client, brief}  a correctly finished practical client
//   GET  /__test/key                       the throwaway public key (for verify.html)
// Run: node scripts/e2e/academy-local.mjs   (PORT=8787 by default)
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SERVER = path.resolve(HERE, '../../../academy-server');
const { default: worker } = await import(path.join(SERVER, 'src/index.js'));
const { FakeD1 } = await import(path.join(SERVER, 'test/helpers/d1.js'));
const { testKey } = await import(path.join(SERVER, 'test/helpers/keys.js'));
const { solvePro, solveAdv, answerSheet } = await import(path.join(SERVER, 'test/helpers/solve.js'));
const W = await import(path.join(SERVER, 'src/written.js'));

const KEY = testKey();
const env = {
  DB: new FakeD1().migrate(path.join(SERVER, 'migrations')),
  CREDENTIAL_SIGNING_KEY: KEY.pem,
  ...(KEY.real ? {} : { EXPECTED_KEY_X: KEY.x }),
  ADMIN_TOKEN: 'local-admin-token-0123456789abcdef', ALLOWED_ORIGINS: ''
};
const PORT = +(process.env.PORT || 8787);
const log = [];

function answers(attemptId) {
  const row = env.DB.db.prepare('SELECT exam, questions FROM written_attempts WHERE id = ?').get(attemptId);
  if (!row) return null;
  const out = {};
  JSON.parse(row.questions).forEach((q, k) => {
    const e = W.entryOf ? W.entryOf(row.exam, q) : W.EXAMS[row.exam].bank[q.b];
    out['q' + (k + 1)] = q.o.indexOf(e[3]);
  });
  return out;
}
const send = (res, status, data, headers = {}) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', ...headers }); res.end(JSON.stringify(data)); };

http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks);
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  try {
    if (url.pathname.startsWith('/__test/')) {
      if (req.method === 'OPTIONS') return send(res, 204, {});
      if (url.pathname === '/__test/answers') { const a = answers(url.searchParams.get('attemptId')); return a ? send(res, 200, { answers: a }) : send(res, 404, { error: 'not_found' }); }
      if (url.pathname === '/__test/solve') {
        const { exam, client, brief } = JSON.parse(body.toString() || '{}');
        const r = exam === 'adv' ? solveAdv(client, brief) : solvePro(client, brief);
        return send(res, 200, { client: r.client });
      }
      if (url.pathname === '/__test/key') return send(res, 200, { x: KEY.x, real: KEY.real });
      if (url.pathname === '/__test/log') return send(res, 200, log);
      return send(res, 404, { error: 'not_found' });
    }
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (v != null && k !== 'host' && k !== 'connection') headers.set(k, Array.isArray(v) ? v.join(', ') : v);
    headers.set('CF-Connecting-IP', '203.0.113.' + (1 + (log.length % 200)));
    const r = await worker.fetch(new Request('https://academy.local' + url.pathname + url.search, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body }), env);
    log.push(`${req.method} ${url.pathname} ${r.status} origin=${req.headers.origin || '-'}${req.headers.authorization ? ' auth' : ''}`);
    const out = Buffer.from(await r.arrayBuffer());
    const h = {}; r.headers.forEach((v, k) => { h[k] = v; });
    res.writeHead(r.status, h); res.end(out);
  } catch (e) { console.error(e); send(res, 500, { error: 'local_server', message: String(e && e.message) }); }
}).listen(PORT, '127.0.0.1', () => console.log(`Local Academy server on http://127.0.0.1:${PORT} (test key ${KEY.real ? 'REAL' : 'throwaway'})`));
