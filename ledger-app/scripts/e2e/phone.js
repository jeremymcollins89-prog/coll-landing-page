// End-to-end test of the phone app (the academy-app bundle) against a LOCAL
// Academy server, in Playwright with a phone-sized browser.
//  - the bundle is served by a static server (SITE, e.g. python3 -m http.server)
//  - window.COLL_ACADEMY_API points the app at the local server (addInitScript)
//  - verify.html is checked with the API routed to the local server and the
//    test server's throwaway public key in place of the published one
//   SITE=http://127.0.0.1:8765 LOCAL=http://127.0.0.1:8787 OUT=dir DESK=desktop-out-dir node scripts/e2e/phone.js
const { chromium, devices } = require('playwright');
const fs = require('fs'); const path = require('path'); const zlib = require('zlib');
const SITE = process.env.SITE || 'http://127.0.0.1:8765';
const LOCAL = process.env.LOCAL || 'http://127.0.0.1:8787';
const OUT = process.env.OUT || path.join(__dirname, 'out-phone');
const DESK = process.env.DESK || '';
const API = 'https://coll-academy-api.jeremymcollins89.workers.dev';
fs.mkdirSync(OUT, { recursive: true });

const results = []; let failed = 0;
const ok = (cond, name, extra) => { results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); if (!cond) failed++; console.log(results[results.length - 1]); };
const local = async (p, opts = {}) => (await fetch(LOCAL + p, opts)).json();
const apiCall = async (p, token, body, method = 'POST') => { const r = await fetch(LOCAL + p, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json() }; };

(async () => {
  const browser = await chromium.launch();
  const pages = [];
  async function device(name) {
    const ctx = await browser.newContext({ ...devices['Pixel 7'], serviceWorkers: 'block' });
    await ctx.addInitScript(l => { window.COLL_ACADEMY_API = l; }, LOCAL);
    const p = await ctx.newPage();
    p.errs = [];
    p.on('pageerror', e => p.errs.push('PAGEERR ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) p.errs.push(m.text()); });
    await p.goto(SITE + '/academy-app/'); await p.waitForFunction(() => typeof App !== 'undefined' && App.S.data);
    p.name = name; pages.push(p);
    return p;
  }
  const ev = (p, fn, arg) => p.evaluate(fn, arg);
  const until = (p, fn, arg, timeout = 10000) => p.waitForFunction(fn, arg, { timeout }).then(() => true, () => false);
  const shot = async (p, n, sel) => { await p.evaluate(s => { document.querySelectorAll('.toast').forEach(t => t.remove()); if (s) { const el = document.querySelector(s); if (el) el.scrollIntoView({ block: 'start' }); } }, sel || null); await p.waitForTimeout(700); await p.screenshot({ path: path.join(OUT, n + '.png') }); };
  const yes = async p => { await p.waitForSelector('[data-x=yes]'); await p.click('[data-x=yes]'); };
  const lessonsDone = (p, adv) => ev(p, a => { const t = App.S.data.training = App.S.data.training || {}; t.done = t.done || {}; App.practice.CORE.forEach(l => t.done[l.id] = '2026-10-20'); if (a) App.practice.ADV.forEach(l => t.done[l.id] = '2026-10-21'); App.save(); App.go('training'); }, adv);
  const enroll = async (p, name, email) => {
    await p.click('#acct-btn'); await p.waitForSelector('#oa-name');
    await p.fill('#oa-name', name); await p.fill('#oa-email', email); await p.click('#oa-go');
    return until(p, () => App.online.signedIn() && App.S.data.training.account.syncedAt);
  };
  const honor = async (p, name) => { await p.waitForSelector('#hn-ok'); await p.check('#hn-ok'); await p.fill('#hn-name', name); await p.click('#hn-go'); };
  const takeWritten = async (p, exam, name, wrongAll) => {
    await ev(p, id => App.actions['t-go']({ dataset: { id } }), exam === 'pro' ? 'exam-written' : 'adv-exam-written');
    await until(p, () => App.S.ui.online && App.S.ui.online.me); await ev(p, () => App.render());
    await p.click('[data-action=on-start]');
    if (await p.waitForSelector('#hn-ok', { timeout: 2500 }).then(() => true, () => false)) await honor(p, name);
    await until(p, () => App.S.ui.exam && App.S.ui.exam.kind === 'official');
    const id = await ev(p, () => App.S.ui.exam.attemptId);
    const key = (await local('/__test/answers?attemptId=' + id)).answers;
    const ans = {}; for (const [k, v] of Object.entries(key)) ans[k] = wrongAll ? (v + 1) % 3 : v;
    // the first answer by tapping, the rest filled in
    await p.click(`.exam-opt[data-a="${ans.q1}"]`);
    await ev(p, a => { const E = App.S.ui.exam; Object.assign(E.answers, a); E.at = E.questions.length - 1; App.render(); }, ans);
    await p.click('[data-action=on-submit]'); await yes(p);
    await until(p, () => App.S.ui.exam && App.S.ui.exam.done);
    return ev(p, () => App.S.ui.exam.result);
  };
  const doPractical = async (p, exam) => {
    await ev(p, id => App.actions['t-go']({ dataset: { id } }), exam === 'pro' ? 'exam-practical' : 'adv-exam-practical');
    await until(p, () => App.S.ui.online.me); await ev(p, () => App.render());
    await p.click('[data-action=on-prac-start]');
    await until(p, e => !!App.online.offClient(e), exam);
    const cur = await ev(p, e => { const x = JSON.parse(JSON.stringify(App.online.offClient(e))); const brief = x.academy.brief; delete x.academy.brief; return { client: x, brief }; }, exam);
    const solved = await local('/__test/solve', { method: 'POST', body: JSON.stringify({ exam, client: cur.client, brief: cur.brief }) });
    await ev(p, s => { const i = App.S.data.clients.findIndex(c => c.id === s.id); s.academy = App.S.data.clients[i].academy; s.touchedAt = Date.now(); App.S.data.clients[i] = s; App.save(); App.go('training'); }, solved.client);
    await p.click('[data-action=on-prac-grade]'); await yes(p);
    await until(p, e => App.S.ui.online.grade[e], exam);
    return ev(p, e => App.S.ui.online.grade[e], exam);
  };

  try {
    // ================================================================ C: a new student on the phone, start to finish
    const c = await device('C');
    ok(await ev(c, () => document.title === 'Coll Ledger Academy' && App.online && App.online.API), 'phone app loads with the local API', await ev(c, () => App.online.API));
    await lessonsDone(c);
    await ev(c, () => App.actions['t-go']({ dataset: { id: 'exam-written' } }));
    await shot(c, 'p01_exam_signed_out', '.online-cta');
    ok(await enroll(c, 'Riley Park', 'riley.phone@example.com'), 'enrolled on the phone');
    const cTok = await ev(c, () => App.S.data.training.account.token);
    await shot(c, 'p02_signed_in');
    const w = await takeWritten(c, 'pro', 'Riley Park');
    ok(w.passed && w.score === w.total, 'official written exam passed on the phone', `${w.score}/${w.total}`);
    await shot(c, 'p03_written_result', '.exam-result');
    const g = await doPractical(c, 'pro');
    ok(g.passed && g.score === 100, 'official practical passed on the phone', `${g.score}/100`);
    await shot(c, 'p04_practical_passed', '.exam-result');
    await c.waitForSelector('[data-action=t-cert]'); await c.click('[data-action=t-cert]');
    await c.waitForSelector('#oc-go'); await shot(c, 'p05_claim'); await c.click('#oc-go');
    ok(await until(c, () => App.S.data.training.cert && App.S.data.training.cert.official), 'certificate claimed on the phone');
    await c.waitForSelector('.modal [data-c=open]', { timeout: 4000 }).catch(() => {});
    await shot(c, 'p06_credential');
    const certC = await ev(c, () => App.S.data.training.cert);
    await ev(c, () => { while (App.U.modalOpen()) App.U.closeModal(); });
    // progress on the server
    await ev(c, () => App.online.syncNow());
    const prog = await apiCall('/api/progress', cTok, null, 'GET');
    const pd = JSON.parse(zlib.gunzipSync(Buffer.from(prog.body.data, 'base64')).toString());
    ok(pd.training.cert && pd.training.cert.id === certC.id && !pd.training.account, 'phone progress synced (certificate in, token out)');

    // ---------------------------------------------------------------- verify.html
    const keyX = (await local('/__test/key')).x;
    const v = await (await browser.newContext()).newPage();
    await v.route(API + '/**', async r => { const u = new URL(r.request().url()); const res = await fetch(LOCAL + u.pathname + u.search, { headers: { Origin: SITE } }); r.fulfill({ status: res.status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: await res.text() }); });
    await v.route('**/.well-known/coll-credentials-keys.json', async r => { const res = await r.fetch(); const doc = JSON.parse(await res.text()); doc.keys[0].x = keyX; r.fulfill({ response: res, body: JSON.stringify(doc) }); });
    await v.goto(SITE + '/verify.html?id=' + encodeURIComponent(certC.id));
    await v.waitForFunction(() => !/Checking/.test(document.getElementById('out').textContent), null, { timeout: 10000 }).catch(() => {});
    const vt = await v.textContent('#out');
    ok(/Verified · digitally signed/.test(vt) && vt.includes('Riley Park'), 'verify.html shows the server-issued certificate as verified', vt.replace(/\s+/g, ' ').slice(0, 120));
    await v.screenshot({ path: path.join(OUT, 'p07_verify_page.png'), fullPage: true });

    // ================================================================ D: wrong answers count as tries; locked after 3
    const d = await device('D');
    await lessonsDone(d);
    await enroll(d, 'Sam Wrong', 'sam.wrong@example.com');
    let last;
    for (let i = 1; i <= 3; i++) {
      last = await takeWritten(d, 'pro', 'Sam Wrong', true);
      ok(!last.passed && last.score === 0 && last.tries.left === (i < 3 ? 3 - i : 0), `wrong-answers attempt ${i} counts as a try`, `left ${last.tries.left}${last.tries.lockedUntil ? ', locked until ' + last.tries.lockedUntil : ''}`);
      await ev(d, () => App.actions['on-close']());
    }
    await ev(d, () => App.online.refreshMe(false)); await ev(d, () => App.render()); await d.waitForTimeout(300);
    ok(await ev(d, () => { const b = document.querySelector('[data-action=on-start]'); return b && b.disabled && /Locked until/.test(document.querySelector('.honor-note').textContent); }), 'exam page shows the lock and the start button is off');
    await shot(d, 'p08_locked', '.honor-note');
    const dTok = await ev(d, () => App.S.data.training.account.token);
    const fourth = await apiCall('/api/exam/start', dTok, { exam: 'pro' });
    ok(fourth.status === 423 && fourth.body.error === 'locked', 'the server refuses a 4th try (423 locked)', fourth.body.message);
    ok(await ev(d, () => App.S.data.training.written.filter(w => w.official).length === 3 && !App.academy.writtenPassed()), 'three official failed attempts recorded, none counts as a pass');

    // ================================================================ B: second device signs in with the desktop's code
    if (DESK && fs.existsSync(path.join(DESK, 'code.txt'))) {
      const code = fs.readFileSync(path.join(DESK, 'code.txt'), 'utf8').trim();
      const desk = JSON.parse(fs.readFileSync(path.join(DESK, 'student.json'), 'utf8'));
      const b = await device('B');
      await b.click('#acct-btn'); await b.waitForSelector('#oa-code'); await b.click('#oa-code');
      await b.waitForSelector('#oa-c'); await b.fill('#oa-c', code.toLowerCase()); await shot(b, 'p09_code_entry'); await b.click('#oa-go');
      ok(await until(b, () => App.online.signedIn() && App.S.data.training.account.syncedAt), 'phone signed in with the desktop\'s one-time code', code);
      await b.waitForTimeout(500);
      const got = await ev(b, () => { const t = App.S.data.training; return { id: t.account.studentId, done: Object.keys(t.done).length, cert: t.cert && t.cert.id, adv: t.certAdv && t.certAdv.id, official: t.cert && t.cert.official, clients: App.S.data.clients.map(c => c.name) }; });
      ok(got.id === desk.studentId && got.cert === desk.cert && got.adv && got.official, 'the phone got the desktop\'s progress and certificates', JSON.stringify(got));
      ok(got.done >= 40 && got.clients.includes('Juniper Flower Co.') && !got.clients.some(n => /Harbor|Summit/.test(n)), 'lessons and practice clients came over; real clients did not', got.clients.join(', '));
      await ev(b, () => App.go('training')); await shot(b, 'p10_second_device');
      const reuse = await fetch(LOCAL + '/api/code/redeem', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
      ok(reuse.status === 400, 'the code works only once', String(reuse.status));

      // ---------------------------------------------------------------- B2: two devices change progress at once → merged
      await b.click('#acct-btn'); await b.waitForSelector('[data-x=code]'); await b.click('[data-x=code]'); await b.waitForSelector('#oa-code-show');
      const code2 = await b.textContent('#oa-code-show'); await ev(b, () => { while (App.U.modalOpen()) App.U.closeModal(); });
      const b2 = await device('B2');
      await b2.click('#acct-btn'); await b2.waitForSelector('#oa-code'); await b2.click('#oa-code'); await b2.fill('#oa-c', code2); await b2.click('#oa-go');
      await until(b2, () => App.online.signedIn() && App.S.data.training.account.syncedAt);
      await ev(b, () => { App.S.data.training.flags.fromPhoneB = true; App.S.data.training.quiz['x:1'] = 1; App.save(); return App.online.syncNow(); });
      await ev(b2, () => { App.S.data.training.flags.fromPhoneB2 = true; App.S.data.training.quiz['y:2'] = 2; App.save(); return App.online.syncNow(); });
      await ev(b, () => App.online.syncNow({ pull: true }));
      const both = await ev(b, () => { const t = App.S.data.training; return !!(t.flags.fromPhoneB && t.flags.fromPhoneB2 && t.quiz['x:1'] === 1 && t.quiz['y:2'] === 2); });
      const bTok = await ev(b, () => App.S.data.training.account.token);
      const sp = await apiCall('/api/progress', bTok, null, 'GET');
      const sd = JSON.parse(zlib.gunzipSync(Buffer.from(sp.body.data, 'base64')).toString());
      ok(both && sd.training.flags.fromPhoneB && sd.training.flags.fromPhoneB2, 'conflicting saves from two devices merge (version check → download, merge, save)', `server v${sp.body.version}`);
    } else ok(true, 'second-device test skipped (no desktop code)');

    // ================================================================ E: a certificate earned before accounts stays valid
    const e = await device('E');
    await ev(e, () => { const t = App.S.data.training = { done: {}, quiz: {}, flags: {} }; App.practice.CORE.forEach(l => t.done[l.id] = '2026-09-01'); t.written = [{ date: '2026-09-01', score: 27, total: 30, pct: 0.9, passed: true, at: 1 }]; t.practical = { score: 96, passed: true, date: '2026-09-02' }; t.cert = { name: 'Jo Legacy', date: '2026-09-02', id: 'CL-2026-LEGA-CY01', written: 90, practical: 96, distinction: false }; App.save(); App.flush(); });
    await e.reload(); await e.waitForFunction(() => typeof App !== 'undefined' && App.S.data);
    await ev(e, () => App.go('training'));
    await enroll(e, 'Jo Legacy', 'jo.legacy@example.com');
    await e.waitForTimeout(400);
    const leg = await ev(e, () => ({ earned: /Certificate earned/.test(document.querySelector('.cert-cta') ? document.querySelector('.cert-cta').textContent : ''), w: App.academy.writtenPassed(), p: App.academy.practicalPassed(), cert: App.S.data.training.cert.id }));
    ok(leg.earned && leg.w && leg.p && leg.cert === 'CL-2026-LEGA-CY01', 'signed in: the earlier certificate still shows as earned', JSON.stringify(leg));
    await shot(e, 'p11_legacy_cert', '.cert-cta');
    await e.click('.cert-cta [data-action=t-cert]'); await e.waitForSelector('.modal [data-c]');
    ok(await ev(e, () => !!document.querySelector('[data-c=reg]') && !document.querySelector('[data-c=open]')), 'its credential window keeps the registration-email step');
    await ev(e, () => { while (App.U.modalOpen()) App.U.closeModal(); App.S.data.training.track = 'adv'; App.S.data.training.currentAdv = 'adv-exam-written'; App.practice.ADV.forEach(l => App.S.data.training.done[l.id] = '2026-09-03'); App.save(); App.render(); });
    await until(e, () => App.S.ui.online.me); await ev(e, () => App.render()); await e.waitForTimeout(200);
    ok(await ev(e, () => /issued before Academy accounts/.test(document.querySelector('.train-main').textContent)), 'Advanced exam page explains the earlier certificate isn\'t on the server yet');
    await shot(e, 'p12_legacy_adv_prereq', '.online-cta');

    // ================================================================ sign out and delete
    await c.click('#acct-btn'); await c.waitForSelector('[data-x=out]'); await shot(c, 'p13_account'); await c.click('[data-x=out]'); await yes(c);
    ok(await until(c, () => !App.online.signedIn()), 'signed out');
    const after = await apiCall('/api/me', cTok, null, 'GET');
    ok(after.status === 401, 'the old token no longer works after signing out');
    await d.click('#acct-btn'); await d.waitForSelector('[data-x=del]'); await d.click('[data-x=del]'); await d.waitForSelector('#oa-go'); await d.click('#oa-go');
    ok(await until(d, () => !App.online.signedIn()), 'account deleted');
    ok((await apiCall('/api/me', dTok, null, 'GET')).status === 401, 'the deleted account is gone from the server');
  } catch (err) { ok(false, 'scenario threw', err.stack); }
  for (const p of pages) ok(p.errs.length === 0, `no page errors on device ${p.name}`, p.errs.join(' | '));
  fs.writeFileSync(path.join(OUT, 'results.txt'), results.join('\n') + `\n${failed ? failed + ' FAILED' : 'ALL PASSED'}\n`);
  console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
