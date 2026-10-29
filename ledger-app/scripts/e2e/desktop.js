// End-to-end test of the desktop app against a LOCAL Academy server.
// Electron runs the real renderer and preload with the main-process file/PDF
// handlers stubbed. Requests to the live API address are routed to the local
// server (scripts/e2e/academy-local.mjs), so the app's CSP stays exactly as shipped.
//   OUT=dir LOCAL=http://127.0.0.1:8787 xvfb-run -a ./node_modules/.bin/electron --no-sandbox scripts/e2e/desktop.js
const { app, BrowserWindow, ipcMain, protocol, net, session } = require('electron');
const path = require('path'); const fs = require('fs'); const zlib = require('zlib');
const OUT = process.env.OUT || path.join(__dirname, 'out-desktop');
const LOCAL = process.env.LOCAL || 'http://127.0.0.1:8787';
const API_HOST = 'coll-academy-api.jeremymcollins89.workers.dev';
const SRC = path.join(__dirname, '..', '..', 'src');
fs.mkdirSync(OUT, { recursive: true });
app.setPath('userData', path.join(OUT, 'ud-' + Date.now()));
let books = null; const att = new Map(); const ext = [];
ipcMain.handle('ledger:load', () => books);
ipcMain.handle('ledger:save', (_e, raw) => { books = raw; return true; });
ipcMain.on('ledger:saveSync', (e, raw) => { books = raw; e.returnValue = true; });
ipcMain.handle('file:open', () => null);
ipcMain.handle('att:save', (_e, { id, base64 }) => { att.set(id, base64); return true; });
ipcMain.handle('att:read', (_e, id) => att.get(id) || null);
ipcMain.handle('att:delete', (_e, id) => att.delete(id));
ipcMain.handle('app:info', () => ({ version: 'test', platform: 'win32', dataPath: OUT }));
ipcMain.handle('backup:status', () => ({ folder: null }));
ipcMain.handle('app:openExternal', (_e, url) => { ext.push(url); });
ipcMain.handle('pdf:save', (_e, { html, defaultName }) => { fs.writeFileSync(path.join(OUT, defaultName.replace(/[^\w.-]+/g, '_') + '.html'), html); return 'ok'; });
ipcMain.handle('file:save', () => 'ok');

const results = []; let failed = 0;
const ok = (cond, name, extra) => { results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); if (!cond) failed++; console.log(results[results.length - 1]); };
const local = async (p, opts = {}) => { const r = await fetch(LOCAL + p, opts); return r.json(); };
const api = async (p, token, opts = {}) => { const r = await fetch(LOCAL + p, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, ...(opts.headers || {}) } }); return { status: r.status, body: await r.json() }; };

app.whenReady().then(async () => {
  // Route the live API host to the local server (renderer CSP and URLs unchanged)
  session.defaultSession.protocol.handle('https', async req => {
    const u = new URL(req.url);
    if (u.host !== API_HOST) return net.fetch(req, { bypassCustomProtocolHandlers: true });
    const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await req.arrayBuffer();
    return net.fetch(LOCAL + u.pathname + u.search, { method: req.method, headers: req.headers, body, bypassCustomProtocolHandlers: true });
  });
  const win = new BrowserWindow({ width: 1440, height: 920, show: true, webPreferences: { preload: path.join(SRC, 'preload.js'), contextIsolation: true, sandbox: true } });
  const errors = [];
  win.webContents.on('console-message', (_e, level, msg, line) => { if (level >= 2) errors.push(msg + ' @' + line); });
  await win.loadFile(path.join(SRC, 'renderer/index.html'));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const js = code => win.webContents.executeJavaScript(`(async()=>{${code}})()`);
  // screenshots: drop toasts, let fades finish, optionally scroll something into view
  const shot = async (name, sel) => {
    await js(`document.querySelectorAll('.toast').forEach(t=>t.remove()); ${sel ? `const el=document.querySelector(${JSON.stringify(sel)}); if(el) el.scrollIntoView({block:'start'});` : ''}`);
    await wait(800);
    fs.writeFileSync(path.join(OUT, name + '.png'), (await win.webContents.capturePage()).toPNG());
  };
  const waitFor = async (expr, ms = 8000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await js(`return !!(${expr})`)) return true; await wait(100); } return false; };
  const click = sel => js(`const el=document.querySelector(${JSON.stringify(sel)}); if(!el) return 'missing'; el.click(); return 'ok'`);
  const yes = async () => { await waitFor(`document.querySelector('[data-x=yes]')`); await click('[data-x=yes]'); };
  await wait(900);
  try {
    // ---------------------------------------------------------------- set up a studio with real sample clients
    await js(`document.querySelector('#su-owner').value='Noel Collins'; document.querySelector('[data-action=setup-next]').click()`); await wait(300);
    await click('[data-action=setup-demo]'); await wait(600);
    const realClients = await js(`return App.S.data.clients.filter(c=>!c.practice).map(c=>c.name)`);
    ok(realClients.length >= 2, 'real sample clients exist on the desktop', realClients.join(', '));
    await js(`const t=App.S.data.training=App.S.data.training||{done:{},quiz:{},flags:{}}; t.done=t.done||{}; App.practice.CORE.forEach(l=>t.done[l.id]='2026-10-20'); App.practice.ensurePractice(false); App.save(); App.go('training'); App.actions['t-go']({dataset:{id:'exam-written'}});`); await wait(500);
    ok(await js(`return !!document.querySelector('.online-cta [data-action=on-account]') && !!document.querySelector('[data-action=ex-start]')`), 'signed out: exam page asks to sign in and offers the practice exam');
    ok(await js(`return /Practice exam/.test(document.querySelector('.practice-card').textContent) && /doesn't count toward the certificate/.test(document.querySelector('.practice-card').textContent)`), 'practice exam is labeled as not counting');
    await shot('d01_exam_signed_out');

    // ---------------------------------------------------------------- practice exam does not count
    await click('[data-action=ex-start]'); await wait(200);
    ok(await js(`return App.S.ui.exam && App.S.ui.exam.practice===true`), 'practice exam starts locally');
    await js(`const E=App.S.ui.exam; E.qs.forEach(q=>E.answers[q.i]=App.academy.BANK[q.i][3]); E.at=E.qs.length-1; App.render();`);
    await click('[data-action=ex-submit]'); await yes(); await wait(300);
    ok(await js(`const t=App.S.data.training; return (t.writtenPractice||[]).length===1 && t.written.length===0 && !App.academy.writtenPassed()`), 'a perfect practice exam is stored apart and does not count');
    await shot('d02_practice_result');
    await click('[data-action=ex-close]'); await wait(200);

    // ---------------------------------------------------------------- enroll
    await click('#acct-btn'); await waitFor(`document.querySelector('#oa-name')`);
    await shot('d03_enroll_modal');
    await js(`document.querySelector('#oa-name').value='Avery Quinn'; document.querySelector('#oa-email').value='avery.desktop@example.com'; document.querySelector('#oa-go').click()`);
    ok(await waitFor(`App.online.signedIn() && App.S.data.training.account.syncedAt`, 10000), 'enrolled and first sync done');
    const acct = await js(`return App.S.data.training.account`);
    ok(/^st_/.test(acct.studentId) && acct.token.length === 43, 'account stored in training.account', acct.studentId);
    await waitFor(`App.S.ui.online.me`); await wait(300);
    await shot('d04_signed_in');

    // ---------------------------------------------------------------- what was uploaded
    let prog = await api('/api/progress', acct.token);
    ok(prog.body.version >= 1 && prog.body.encoding === 'gzip-base64', 'progress uploaded gzip-compressed', `v${prog.body.version}`);
    let p = JSON.parse(zlib.gunzipSync(Buffer.from(prog.body.data, 'base64')).toString());
    ok(p.clients.every(c => c.practice) && !p.clients.some(c => realClients.includes(c.name)), 'only practice clients uploaded — no real client books', p.clients.map(c => c.name).join(', '));
    ok(!p.training.account && !JSON.stringify(p).includes(acct.token), 'the sign-in token is never uploaded');
    ok(Object.keys(p.training.done).length >= 20, 'lesson progress uploaded', Object.keys(p.training.done).length + ' lessons');

    // ---------------------------------------------------------------- official written exam
    await click('[data-action=on-start]'); await waitFor(`document.querySelector('#hn-ok')`);
    await js(`document.querySelector('#hn-ok').click(); const n=document.querySelector('#hn-name'); n.value='Avery Quinn'; n.dispatchEvent(new Event('input')); document.querySelector('#hn-go').click()`);
    ok(await waitFor(`App.S.ui.exam && App.S.ui.exam.kind==='official'`), 'official exam started from the server');
    const att = await js(`return {id:App.S.ui.exam.attemptId, n:App.S.ui.exam.questions.length, hasKey: JSON.stringify(App.S.ui.exam.questions).includes('"why"')}`);
    ok(att.n === 30 && !att.hasKey, 'server questions (30, no answer key in the client)');
    await shot('d05_official_question');
    const key = await local('/__test/answers?attemptId=' + att.id);
    // answer by clicking for the first question, the rest straight in (same state the clicks build)
    const first = key.answers.q1; await click(`.exam-opt[data-a="${first}"]`); await wait(100);
    ok(await js(`return App.S.ui.exam.answers.q1===${first}`), 'clicking an option records its position');
    await js(`const E=App.S.ui.exam; Object.assign(E.answers, ${JSON.stringify(key.answers)}); delete E.answers.q2; E.answers.q2 = (${key.answers.q2}+1)%3; E.at=E.questions.length-1; App.render();`);
    await click('[data-action=on-submit]'); await yes();
    ok(await waitFor(`App.S.ui.exam && App.S.ui.exam.done`, 10000), 'submitted and graded on the server');
    const wr = await js(`return {r:App.S.ui.exam.result, rec:App.S.data.training.written.slice(-1)[0], passed: App.academy.writtenPassed()}`);
    ok(wr.r.score === 29 && wr.r.passed && wr.r.review.length === 1 && wr.r.review[0].why, 'score 29/30 with the one missed question reviewed', JSON.stringify({ s: wr.r.score, review: wr.r.review.length }));
    ok(wr.rec.official === true && wr.passed, 'result recorded in training.written as official and counts');
    await shot('d06_official_result', '.exam-result');

    // ---------------------------------------------------------------- official practical
    await js(`App.actions['t-go']({dataset:{id:'exam-practical'}})`); await waitFor(`App.S.ui.online.me`); await wait(200);
    await shot('d07_practical_start_page');
    await click('[data-action=on-prac-start]');
    ok(await waitFor(`App.online.offClient('pro') && App.S.route.page==='review'`, 10000), 'practical client issued by the server and opened');
    const pc = await js(`const c=App.online.offClient('pro'); return {id:c.id, practice:c.practice, exam:c.exam, pid:c.academy.practicalId, docs:c.academy.brief.documents.length, stmt:c.examKey.statement, key: !!(c.examKey.expect)}`);
    ok(pc.practice && pc.exam && /^pr_/.test(pc.pid) && pc.docs === 4 && pc.stmt > 0 && !pc.key, 'client has practice/exam flags, practicalId, brief documents, statement — no answers', pc.pid);
    ok(await js(`return !!document.querySelector('#coach') && /reconcile to \\$/.test(document.querySelector('#coach').textContent) && !!document.querySelector('.practice-banner')`), 'coach and practice banner work for the server-issued client');
    await shot('d08_practical_client_review');
    // grade unfinished work first: counts as a try, no answer key shown
    await js(`App.go('training')`); await wait(300);
    ok(await js(`return [...document.querySelectorAll('.adv-doc b')].some(b=>/Bank statement/.test(b.textContent))`), 'the server brief\'s documents are shown on the practical page');
    await click('[data-action=on-prac-grade]'); await yes();
    ok(await waitFor(`App.S.ui.online.grade.pro`, 10000), 'first grading returned');
    const g1 = await js(`return App.S.ui.online.grade.pro`);
    ok(!g1.passed && g1.items.every(x => !x.why) && g1.tries.left === 2, 'not passed: no explanations, a try used', `score ${g1.score}, ${g1.tries.left} left`);
    await shot('d09_practical_not_passed', '.exam-result');
    // solve it (the test server works the answers from the brief, like a careful student)
    const cur = await js(`const c=App.online.offClient('pro'); const x=JSON.parse(JSON.stringify(c)); const brief=x.academy.brief; delete x.academy.brief; return {client:x, brief}`);
    const solved = await local('/__test/solve', { method: 'POST', body: JSON.stringify({ exam: 'pro', client: cur.client, brief: cur.brief }) });
    await js(`const s=${JSON.stringify(solved.client)}; const i=App.S.data.clients.findIndex(c=>c.id===s.id); s.academy=App.S.data.clients[i].academy; s.touchedAt=Date.now(); App.S.data.clients[i]=s; App.save(); App.render();`);
    await click('[data-action=on-prac-grade]'); await yes();
    ok(await waitFor(`App.S.ui.online.grade.pro && App.S.ui.online.grade.pro.passed`, 10000), 'practical passed on the server');
    const g2 = await js(`return {g:App.S.ui.online.grade.pro, p:App.S.data.training.practical}`);
    ok(g2.g.score === 100 && g2.p.official && g2.p.passed && g2.p.score === 100, 'best result stored in training.practical (official)', JSON.stringify(g2.p));
    await shot('d10_practical_passed', '.exam-result');

    // ---------------------------------------------------------------- certificate
    await waitFor(`document.querySelector('[data-action=t-cert]')`);
    await click('[data-action=t-cert]'); await waitFor(`document.querySelector('#oc-go')`, 10000);
    await shot('d11_claim_modal');
    await click('#oc-go');
    ok(await waitFor(`App.S.data.training.cert && App.S.data.training.cert.official`, 10000), 'certificate claimed from the server');
    await waitFor(`document.querySelector('[data-c=open]')`, 3000);
    const cert = await js(`return App.S.data.training.cert`);
    ok(/^CL-\d{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(cert.id) && cert.credential && cert.credential.proof && cert.name === 'Avery Quinn', 'signed credential stored as training.cert', cert.id);
    ok(await js(`return /Already verified/.test(document.querySelector('.modal').textContent) && !document.querySelector('[data-c=reg]')`), 'credential modal: "Already verified", no registration email step');
    ok(fs.readdirSync(OUT).some(f => /Professional_Bookkeeping_Certificate/.test(f) && fs.readFileSync(path.join(OUT, f), 'utf8').includes(cert.id)), 'certificate PDF made with the server ID');
    const li = await js(`return App.academy.linkedInUrl(App.S.data.training.cert)`);
    ok(li.includes(encodeURIComponent(cert.id)) && li.includes('verify.html'), 'LinkedIn link carries the credential ID and verify URL');
    await shot('d12_credential_modal');
    await click('[data-c=open]'); await wait(200);
    ok(ext.some(u => u.includes('verify.html?id=' + encodeURIComponent(cert.id))), 'opens the verify page for the credential');
    await js(`App.U.closeModal()`);
    const pub = await local('/api/credentials/' + cert.id);
    ok(pub.id === cert.id && pub.name === 'Avery Quinn' && pub.written === 97 && pub.practical === 100, 'credential is public on the server', `${pub.written}% / ${pub.practical}`);
    fs.writeFileSync(path.join(OUT, 'credential.json'), JSON.stringify(pub));

    // ---------------------------------------------------------------- advanced: written + practical + certificate
    await js(`const t=App.S.data.training; App.practice.ADV.forEach(l=>t.done[l.id]='2026-10-21'); App.save(); App.actions['t-go']({dataset:{id:'adv-exam-written'}});`);
    await waitFor(`App.S.ui.online.me && App.S.ui.online.me.exams.adv.available`, 8000); await js(`App.render()`); await wait(200);
    await click('[data-action=on-start]'); await waitFor(`document.querySelector('#hn-ok')`);
    await js(`document.querySelector('#hn-ok').click(); const n=document.querySelector('#hn-name'); n.value='Avery Quinn'; n.dispatchEvent(new Event('input')); document.querySelector('#hn-go').click()`);
    await waitFor(`App.S.ui.exam && App.S.ui.exam.kind==='official' && App.S.ui.exam.exam==='adv'`);
    const aatt = await js(`return App.S.ui.exam.attemptId`);
    const akey = await local('/__test/answers?attemptId=' + aatt);
    await js(`const E=App.S.ui.exam; Object.assign(E.answers, ${JSON.stringify(akey.answers)}); E.at=E.questions.length-1; App.render();`);
    await click('[data-action=on-submit]'); await yes(); await waitFor(`App.S.ui.exam && App.S.ui.exam.done`, 10000);
    ok(await js(`return App.S.ui.exam.result.score===35 && App.advanced.writtenPassed()`), 'advanced written exam passed 35/35 on the server');
    await js(`App.actions['t-go']({dataset:{id:'adv-exam-practical'}})`); await wait(300);
    await click('[data-action=on-prac-start]'); await waitFor(`App.online.offClient('adv') && App.S.route.page==='journal'`, 10000);
    ok(await js(`return /Advanced practical/.test(document.querySelector('#coach').textContent)`), 'coach shows for the Aspen Trail practical');
    await shot('d13_aspen_journal');
    const acur = await js(`const c=App.online.offClient('adv'); const x=JSON.parse(JSON.stringify(c)); const brief=x.academy.brief; delete x.academy.brief; return {client:x, brief}`);
    const asolved = await local('/__test/solve', { method: 'POST', body: JSON.stringify({ exam: 'adv', client: acur.client, brief: acur.brief }) });
    await js(`const s=${JSON.stringify(asolved.client)}; const i=App.S.data.clients.findIndex(c=>c.id===s.id); s.academy=App.S.data.clients[i].academy; s.touchedAt=Date.now(); App.S.data.clients[i]=s; App.save(); App.go('training')`); await wait(300);
    await shot('d14_aspen_brief', '.adv-docs');
    await click('[data-action=on-prac-grade]'); await yes(); await waitFor(`App.S.ui.online.grade.adv`, 10000);
    ok(await js(`const g=App.S.ui.online.grade.adv; return g.passed && g.score===100 && g.items.every(x=>x.why) && App.S.data.training.advPractical.official`), 'advanced practical passed 100 with explanations shown');
    await shot('d15_aspen_passed', '.exam-result');
    await waitFor(`document.querySelector('[data-action=adv-cert]')`); await click('[data-action=adv-cert]'); await waitFor(`document.querySelector('#oc-go')`, 10000); await click('#oc-go');
    ok(await waitFor(`App.S.data.training.certAdv && App.S.data.training.certAdv.official`, 10000), 'advanced certificate claimed', await js(`return (App.S.data.training.certAdv||{}).id`));
    await waitFor(`document.querySelector('.modal [data-c=open]')`, 3000); await shot('d16_adv_credential'); await js(`App.U.closeModal()`);

    // ---------------------------------------------------------------- sync status, Sync modal with file fallback
    await js(`App.go('training')`); await wait(300);
    await click('#sync-btn'); await waitFor(`document.querySelector('[data-action=on-sync-now]')`);
    ok(await js(`return !!document.querySelector('[data-action=sync-export]') && !!document.querySelector('[data-action=sync-import]')`), 'Sync window keeps "Send / Bring in progress" as a fallback');
    await click('[data-action=on-sync-now]'); await wait(1500);
    ok(await js(`return /Synced/.test(document.querySelector('#os-status').textContent)`), 'Sync now → "Synced …" status', await js(`return document.querySelector('#os-status').textContent`));
    await shot('d17_sync_modal'); await js(`App.U.closeModal()`);
    prog = await api('/api/progress', acct.token);
    p = JSON.parse(zlib.gunzipSync(Buffer.from(prog.body.data, 'base64')).toString());
    ok(p.training.cert && p.training.cert.id === cert.id && p.training.certAdv && p.clients.some(c => c.exam && c.academy), 'certificates and exam clients are in the synced progress');

    // ---------------------------------------------------------------- a code for the second device (used by the phone test)
    await click('#acct-btn'); await waitFor(`document.querySelector('[data-x=code]')`); await click('[data-x=code]');
    ok(await waitFor(`document.querySelector('#oa-code-show')`, 8000), 'one-time code shown');
    const code = await js(`return document.querySelector('#oa-code-show').textContent`);
    ok(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code), 'code is 8 characters', code);
    await shot('d18_code');
    fs.writeFileSync(path.join(OUT, 'code.txt'), code);
    fs.writeFileSync(path.join(OUT, 'student.json'), JSON.stringify({ studentId: acct.studentId, cert: cert.id }));
    await js(`App.U.closeModal(); App.U.closeModal();`);
  } catch (e) { ok(false, 'scenario threw', e.stack); }
  const noise = errors.filter(e => !/Autofill|DevTools|Electron Security Warning/.test(e));
  ok(noise.length === 0, 'no renderer errors', noise.join(' | '));
  fs.writeFileSync(path.join(OUT, 'results.txt'), results.join('\n') + `\n${failed ? failed + ' FAILED' : 'ALL PASSED'}\n`);
  console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
  app.exit(failed ? 1 : 0);
});
