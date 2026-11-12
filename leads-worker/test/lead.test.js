import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { checkLead, leadEmail, allowedOrigin } from '../src/index.js';

const good = { name: 'Sam Rivera', business: 'Rivera Fence', phone: '(303) 555-0142', email: 'Sam@Example.com', city: 'Aurora', needs: ['New website', 'Hacked'], message: 'Need a site', t: 9000 };
const SITE = 'https://collbusinesssolutions.com';

const post = (body, env, origin = SITE) => worker.fetch(new Request('https://w.dev/api/lead', {
  method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify(body)
}), env);

test('a good request passes, cleaned up', () => {
  const r = checkLead(good);
  assert.ok(r.lead);
  assert.equal(r.lead.email, 'sam@example.com');
  assert.deepEqual(r.lead.needs, ['New website']); // unknown choices dropped
});

test('required fields', () => {
  assert.match(checkLead({ ...good, name: '' }).error, /name/);
  assert.match(checkLead({ ...good, business: ' ' }).error, /business/);
  assert.match(checkLead({ ...good, phone: '', email: '' }).error, /phone number or an email/);
  assert.match(checkLead({ ...good, email: 'nope' }).error, /email/);
  assert.match(checkLead({ ...good, phone: '12' }).error, /phone/);
  assert.ok(checkLead({ ...good, email: '' }).lead, 'phone alone is enough');
});

test('spam traps', () => {
  assert.equal(checkLead({ ...good, hp: 'http://spam' }).spam, true);
  assert.equal(checkLead({ ...good, t: 800 }).spam, true);
  assert.equal(checkLead({ ...good, message: 'http://a http://b http://c' }).spam, true);
});

test('email text escapes what visitors type', () => {
  const m = leadEmail(checkLead({ ...good, message: '<script>x</script>' }).lead);
  assert.ok(!m.html.includes('<script>'));
  assert.match(m.subject, /Rivera Fence/);
  assert.match(m.text, /Phone: \(303\) 555-0142/);
});

test('origins', () => {
  assert.equal(allowedOrigin(SITE), SITE);
  assert.equal(allowedOrigin('http://localhost:5173'), 'http://localhost:5173');
  assert.equal(allowedOrigin('https://evil.example'), '');
  assert.equal(allowedOrigin('https://x.example', { ALLOWED_ORIGINS: 'https://x.example' }), 'https://x.example');
});

test('no email key: 503 so the page falls back to the visitor\'s email app', async () => {
  const r = await post(good, {});
  assert.equal(r.status, 503);
  assert.equal(r.headers.get('access-control-allow-origin'), SITE);
});

test('sends through Resend with reply-to set', async () => {
  const real = globalThis.fetch;
  let sent;
  globalThis.fetch = async (url, init) => { sent = { url, init }; return new Response('{"id":"1"}', { status: 200 }); };
  try {
    const r = await post(good, { RESEND_API_KEY: 'k', LEAD_TO: 'me@example.com' });
    assert.equal(r.status, 200);
    const p = JSON.parse(sent.init.body);
    assert.equal(sent.url, 'https://api.resend.com/emails');
    assert.deepEqual(p.to, ['me@example.com']);
    assert.equal(p.reply_to, 'sam@example.com');
  } finally { globalThis.fetch = real; }
});

test('Resend refusing gives 503', async () => {
  const real = globalThis.fetch;
  globalThis.fetch = async () => new Response('bad', { status: 422 });
  try { assert.equal((await post(good, { RESEND_API_KEY: 'k' })).status, 503); } finally { globalThis.fetch = real; }
});

test('other sites can\'t post', async () => {
  assert.equal((await post(good, { RESEND_API_KEY: 'k' }, 'https://evil.example')).status, 403);
});

test('spam looks accepted', async () => {
  const r = await post({ ...good, hp: 'x' }, {});
  assert.equal(r.status, 200);
});

test('health', async () => {
  const r = await worker.fetch(new Request('https://w.dev/api/health'), { RESEND_API_KEY: 'k' });
  assert.deepEqual(await r.json(), { ok: true, email: true });
});
