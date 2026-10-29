'use strict';
/* =====================================================================
   Coll Ledger Academy — online: the Academy server
   - Academy account: enroll (name + email), sign in on another device
     with a one-time code, fix the name, sign out, delete the account
   - Automatic progress sync (the same payload and merge as the
     file-based sync in views-sync.js, gzip-compressed)
   - Official written exams and practicals, graded on the server, with
     the server's tries rule
   - Signed certificates claimed from the server
   Desktop (Electron) and the phone app (window.COLL_ACADEMY) share this.
   Real client books are never sent — only Academy progress and the
   practice / exam / case-study clients.
   ===================================================================== */
(() => {
  const { S, U, act, go, render, save } = App;
  const { $, esc, fmtDate, ICON, plural } = U;
  const today = App.today;
  const API = String(window.COLL_ACADEMY_API || 'https://coll-academy-api.jeremymcollins89.workers.dev').replace(/\/+$/, '');
  const T = () => { S.data.training = S.data.training || {}; const t = S.data.training; t.done = t.done || {}; t.quiz = t.quiz || {}; t.flags = t.flags || {}; t.written = t.written || []; t.advWritten = t.advWritten || []; return t; };
  const acct = () => (S.data && S.data.training && S.data.training.account) || null;
  const signedIn = () => { const a = acct(); return !!(a && a.token); };
  const O = () => { S.ui.online = S.ui.online || { me: null, meAt: 0, grade: {}, busy: '' }; return S.ui.online; };
  const LOCK_ICON = ICON.lock;

  // ------------------------------------------------------------------
  // Talking to the server
  // ------------------------------------------------------------------
  class ApiError extends Error { constructor(status, code, message, data) { super(message); this.status = status; this.code = code; this.data = data || {}; } }
  const OFFLINE = 'You\'re offline — official exams need internet. Check your connection and try again; lessons keep working offline.';
  const FRIENDLY = {
    locked: 'Three tries in a row — there\'s a 24-hour break before the next one.',
    prerequisite: 'The Advanced exams open once you hold the Professional Bookkeeping Certificate.',
    not_eligible: 'Pass both official exams first.',
    rate_limited: 'Too many tries from this network — wait a few minutes and try again.',
    server_error: 'Something went wrong on the Academy server. Please try again.',
    signing_unavailable: 'Certificates can\'t be issued right now — please try again later.'
  };
  async function call(method, path, body, { timeout = 20000, auth = true } = {}) {
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth) {
      const a = acct();
      if (!a || !a.token) throw new ApiError(401, 'signed_out', 'Sign in to your Academy account first.');
      headers.Authorization = 'Bearer ' + a.token;
    }
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), timeout) : null;
    let res;
    try {
      res = await fetch(API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: ctl ? ctl.signal : undefined, cache: 'no-store', credentials: 'omit' });
    } catch (e) {
      if (e && e.name === 'AbortError') throw new ApiError(0, 'timeout', 'The Academy server is taking too long to answer. Check your connection and try again.');
      throw new ApiError(0, 'offline', OFFLINE);
    } finally { if (timer) clearTimeout(timer); }
    let data = null;
    try { data = await res.json(); } catch (e) { }
    if (!res.ok) {
      const code = (data && data.error) || 'http_' + res.status;
      const msg = (data && data.message) || FRIENDLY[code] || `The Academy server answered with an error (${res.status}). Try again in a minute.`;
      if (res.status === 401 && auth) dropToken();
      throw new ApiError(res.status, code, msg, data);
    }
    return data;
  }
  const warn = e => U.toast((e && e.message) || String(e), null, 'warn');
  // The token was refused (signed out elsewhere, or the account was deleted)
  function dropToken() {
    if (!acct()) return;
    delete S.data.training.account; O().me = null; pulledOnce = false; save();
    U.toast('Your Academy sign-in on this device has ended — sign in again', null, 'warn');
    setTimeout(() => { try { render(); } catch (e) { } }, 0);
  }

  // ------------------------------------------------------------------
  // Formatting
  // ------------------------------------------------------------------
  const ago = ms => { if (!ms) return ''; const s = (Date.now() - ms) / 1000; if (s < 60) return 'just now'; if (s < 3600) return `${Math.floor(s / 60)} min ago`; if (s < 86400) return `${Math.floor(s / 3600)} hr ago`; return fmtDate(new Date(ms).toISOString().slice(0, 10)); };
  const when = iso => { const d = new Date(iso); return d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); };
  const left = iso => { const ms = Date.parse(iso) - Date.now(); if (!(ms > 0)) return '0 min'; const m = Math.ceil(ms / 60000), h = Math.floor(m / 60); return h ? `${h} hr ${m % 60} min` : `${m} min`; };
  const triesLine = tr => !tr ? '' : tr.lockedUntil && Date.parse(tr.lockedUntil) > Date.now()
    ? `<b>Locked until ${esc(when(tr.lockedUntil))}</b> after three tries in a row — review, then come back.`
    : `${tr.left} of 3 tries left before a 24-hour break.`;
  const isLocked = tr => !!(tr && tr.lockedUntil && Date.parse(tr.lockedUntil) > Date.now());
  const fmtCode = c => String(c || '').replace(/^(.{4})(.{4})$/, '$1-$2');

  // ------------------------------------------------------------------
  // Progress sync (debounced PUT, GET on start-up and when the Academy opens)
  // ------------------------------------------------------------------
  const toB64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const fromB64 = b => { const s = atob(String(b).replace(/-/g, '+').replace(/_/g, '/')); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
  async function encode(text) {
    if (typeof CompressionStream === 'function') {
      try { const buf = await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer(); return { data: toB64(new Uint8Array(buf)), encoding: 'gzip-base64' }; } catch (e) { }
    }
    return { data: text, encoding: 'json' };
  }
  async function decode(data, encoding) {
    if (encoding === 'gzip-base64') return new Response(new Blob([fromB64(data)]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    return data;
  }
  // A key-sorted snapshot, so "nothing changed" is detected across devices
  const stable = v => JSON.stringify(v, (k, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, k2) => { o[k2] = x[k2]; return o; }, {}) : x);
  const canon = p => { const tr = Object.assign({}, (p && p.training) || {}); ['account', 'lastImport', 'lastExport'].forEach(k => delete tr[k]); return stable({ owner: (p && p.owner) || '', training: tr, clients: (p && p.clients) || [] }); };

  const SYNC_DELAY = 20000;
  let serverCanon = null, pulledOnce = false, running = null, again = null, timer = null, applying = false, lastPull = 0;
  function schedule(ms = SYNC_DELAY) {
    if (!signedIn() || applying) return;
    clearTimeout(timer); timer = setTimeout(() => { timer = null; syncNow(); }, ms);
  }
  async function pull() {
    const r = await call('GET', '/api/progress', undefined, { timeout: 30000 });
    if (!acct()) return false;
    let changed = false;
    if (r && r.data) {
      const p = JSON.parse(await decode(r.data, r.encoding));
      const before = canon(App.academySync.payload());
      const keep = T().lastImport;
      applying = true;
      try { App.academySync.mergeIn(p); } finally { applying = false; }
      if (keep == null) delete S.data.training.lastImport; else S.data.training.lastImport = keep;
      serverCanon = canon(p);
      changed = canon(App.academySync.payload()) !== before;
    } else serverCanon = null;
    const a = acct(); a.version = (r && r.version) || 0; a.syncedAt = Date.now();
    pulledOnce = true; lastPull = Date.now();
    return changed;
  }
  async function push() {
    const p = App.academySync.payload(), c = canon(p);
    if (c === serverCanon) return false;
    const { data, encoding } = await encode(JSON.stringify(p));
    if (data.length > 900 * 1024) throw new ApiError(413, 'too_large', 'Your Academy progress is too big to sync (over 900 KB). Use "Send progress" to move it with a file instead.');
    const a = acct();
    const r = await call('PUT', '/api/progress', { data, encoding, baseVersion: a.version || 0 }, { timeout: 30000 });
    const b = acct(); if (b) { b.version = r.version; b.syncedAt = Date.now(); }
    serverCanon = c;
    return true;
  }
  // Pull (when asked, or the first time), merge, then push what's new. A 409 means another
  // device saved first: download, merge, save again.
  function syncNow(opts = {}) {
    if (!signedIn()) return Promise.resolve(false);
    clearTimeout(timer); timer = null;
    if (running) { again = Object.assign(again || {}, opts); return running; }
    running = (async () => {
      let changed = false;
      try {
        if (opts.pull || !pulledOnce) changed = await pull();
        for (let i = 0; ; i++) {
          try { await push(); break; } catch (e) { if (e.code === 'conflict' && i < 3) { changed = (await pull()) || changed; continue; } throw e; }
        }
        O().syncError = null;
        applying = true; try { save(); } finally { applying = false; }
        if (changed && !O().busy) { try { render(); } catch (e) { } }
        if (!opts.quiet && opts.toast) U.toast('Progress synced');
        return true;
      } catch (e) {
        O().syncError = e.message;
        if (opts.toast) warn(e);
        return false;
      } finally {
        running = null; refreshSyncUi();
        if (again) { const o = again; again = null; syncNow(o); }
      }
    })();
    return running;
  }
  App.onSave.push(() => schedule());
  const syncStatus = () => { const a = acct(); if (!a) return ''; if (running) return 'Syncing…'; if (O().syncError) return 'Couldn\'t sync: ' + O().syncError; return a.syncedAt ? `Synced ${ago(a.syncedAt)}` : 'Not synced yet'; };
  function refreshSyncUi() {
    const el = $('#os-status'); if (el) el.textContent = syncStatus();
    const sb = $('#sync-btn'); if (sb && signedIn()) sb.innerHTML = `${ICON.refresh}${esc(acct().syncedAt && !O().syncError ? 'Synced ' + ago(acct().syncedAt) : 'Sync')}`;
  }

  // Exam status, tries and certificates from the server
  async function refreshMe(rerender = true) {
    if (!signedIn()) return null;
    O().meLoading = true;
    try {
      const me = await call('GET', '/api/me');
      O().me = me; O().meAt = Date.now(); O().meError = null;
      const a = acct();
      if (a && me && me.student) { a.name = me.student.name; a.email = me.student.email; }
      adoptCredentials((me && me.credentials) || []);
      return me;
    } catch (e) { O().meError = e.message; return null; }
    finally { O().meLoading = false; if (rerender && (S.route.page === 'training' || S.route.page === 'lab') && !O().busy) { try { render(); } catch (e) { } } }
  }
  const status = exam => { const me = O().me; return me && me.exams ? me.exams[exam] : null; };
  const toCert = e => ({ id: e.id, name: e.name, date: e.awarded, awarded: e.awarded, written: e.written, practical: e.practical, distinction: !!e.distinction, program: e.program, credential: e.credential, official: true, revoked: !!e.revoked });
  // A certificate issued to this account shows up on every device, even before progress syncs
  function adoptCredentials(list) {
    const t = T(); let changed = false;
    for (const e of list) {
      const key = e.program === 'advanced' ? 'certAdv' : e.program === 'professional' ? 'cert' : null;
      if (!key) continue;
      const cur = t[key];
      if (!cur || !cur.official || (cur.id === e.id && !!cur.revoked !== !!e.revoked)) { t[key] = toCert(e); changed = true; }
    }
    if (changed) save();
  }

  // ------------------------------------------------------------------
  // Academy account: enroll, codes, name, sign out, delete
  // ------------------------------------------------------------------
  function setAccount(r) {
    T().account = { token: r.token, studentId: r.studentId, name: r.name, email: r.email, since: Date.now() };
    serverCanon = null; pulledOnce = false; O().me = null; O().syncError = null;
    save();
  }
  async function afterSignIn(then) {
    U.toast(`Signed in as ${acct().name}`);
    await syncNow({ pull: true });
    await refreshMe(false);
    render();
    if (then) then();
  }
  const busyBtn = (b, on, text) => { if (!b) return; if (on) { b.dataset.label = b.innerHTML; b.disabled = true; b.textContent = text || 'One moment…'; } else { b.disabled = false; if (b.dataset.label) b.innerHTML = b.dataset.label; } };

  function openAccount(then, reason) { if (signedIn()) accountModal(); else enrollModal(then, reason); }

  function enrollModal(then, reason) {
    const t = T();
    const m = U.openModal(`${U.modalHead('Your Academy account', esc(reason || 'Official exams, certificates and automatic sync between your phone and computer'))}
      <div class="modal-body"><div class="oa-form">
        <div class="field"><label for="oa-name">Your full name — as it should appear on your certificates</label><input id="oa-name" class="input" autocomplete="name" value="${esc((t.cert && t.cert.name) || S.data.firm.owner || '')}" placeholder="First and last name"></div>
        <div class="field"><label for="oa-email">Email</label><input id="oa-email" class="input" type="email" autocomplete="email" value="${esc(S.data.firm.email || '')}" placeholder="you@example.com"><span class="hint">Used only for your Academy account. No newsletters.</span></div>
        <p class="muted" style="margin:0;font-size:12.5px;line-height:1.55">Your Academy progress — lessons, exams, certificates and the practice clients — is saved to the Academy server so your phone and computer stay in step. Real client books never leave this device.</p>
      </div>
      <div class="oa-alt"><span class="muted">Already signed in on another device?</span><button class="btn sm" id="oa-code">Sign in with a code</button></div></div>
      <div class="modal-foot"><button class="btn" data-action="close-modal">Not now</button><button class="btn primary" id="oa-go">Create my account</button></div>`);
    $('#oa-code', m).onclick = () => { U.closeModal(); redeemModal(then); };
    $('#oa-go', m).onclick = async () => {
      const name = $('#oa-name', m).value.trim(), email = $('#oa-email', m).value.trim();
      if (name.length < 2) return U.toast('Add your full name', null, 'warn');
      if (!/^\S+@\S+\.\S+$/.test(email)) return U.toast('Add a valid email address', null, 'warn');
      const b = $('#oa-go', m); busyBtn(b, true, 'Creating your account…');
      try { const r = await call('POST', '/api/enroll', { name, email }, { auth: false }); setAccount(r); U.closeModal(); await afterSignIn(then); }
      catch (e) { busyBtn(b, false); warn(e); }
    };
  }

  function redeemModal(then) {
    const m = U.openModal(`${U.modalHead('Sign in with a code', 'Use a code from a device that\'s already signed in')}
      <div class="modal-body">
        <ol class="t-list" style="margin:0 0 14px;padding-left:20px;line-height:1.7;font-size:13.5px"><li>On the device you already use, open the Academy and tap <b>your name</b> at the top of the Academy page → <b>Add another device</b>.</li><li>Type the 8-letter code it shows here. Codes work once, for 15 minutes.</li></ol>
        <div class="field"><label for="oa-c">Sign-in code</label><input id="oa-c" class="input oa-code-input" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false" maxlength="11" placeholder="XXXX-XXXX"></div>
      </div>
      <div class="modal-foot"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" id="oa-go">Sign in</button></div>`);
    const inp = $('#oa-c', m);
    inp.onkeydown = e => { if (e.key === 'Enter') $('#oa-go', m).click(); };
    $('#oa-go', m).onclick = async () => {
      const code = inp.value.replace(/[\s-]/g, '').toUpperCase();
      if (code.length !== 8) return U.toast('The code has 8 letters and numbers', null, 'warn');
      const b = $('#oa-go', m); busyBtn(b, true, 'Signing in…');
      try { const r = await call('POST', '/api/code/redeem', { code }, { auth: false }); setAccount(r); U.closeModal(); await afterSignIn(then); }
      catch (e) { busyBtn(b, false); warn(e); }
    };
  }

  function accountModal() {
    const a = acct(), me = O().me, locked = !!(me && me.nameLocked);
    const m = U.openModal(`${U.modalHead('Your Academy account', 'Signed in on this device')}
      <div class="modal-body">
        <div class="cred-rows"><div><span>Name</span><b>${esc(a.name || '')}</b></div><div><span>Email</span><b>${esc(a.email || '')}</b></div><div><span>Student ID</span><b class="mono">${esc(a.studentId || '')}</b></div></div>
        <div class="online-sync" style="margin-top:16px">${ICON.refresh}<div class="grow"><b>Progress sync</b><div class="muted" id="os-status">${esc(syncStatus())}</div></div><button class="btn sm" data-action="on-sync-now">Sync now</button></div>
        <div class="cred-steps">
          <div class="cred-step"><span class="n">1</span><div class="grow"><b>Add another device</b><div class="muted">Get a one-time code, then type it into the Academy on your phone or another computer.</div></div><button class="btn primary" data-x="code">Add another device</button></div>
          <div class="cred-step"><span class="n">2</span><div class="grow"><b>Name on your certificates</b><div class="muted">${locked ? 'Locked — it\'s on an issued certificate. For a correction, email collbusinesssolutions@gmail.com.' : 'Fix the spelling any time before a certificate is issued.'}</div></div><button class="btn" data-x="name" ${locked ? 'disabled' : ''}>${ICON.edit}Fix my name</button></div>
          <div class="cred-step"><span class="n">${ICON.lock}</span><div class="grow"><b>Sign out of this device</b><div class="muted">Your progress stays on this device and on the Academy server.</div></div><button class="btn" data-x="out">Sign out</button></div>
          <div class="cred-step"><span class="n">${ICON.trash}</span><div class="grow"><b>Delete my account</b><div class="muted">Removes your account, saved progress and exam results from the Academy server.</div></div><button class="btn danger" data-x="del">Delete account</button></div>
        </div>
      </div>
      <div class="modal-foot"><button class="btn primary" data-action="close-modal">Done</button></div>`, { wide: true });
    m.querySelector('[data-x=code]').onclick = () => codeModal();
    m.querySelector('[data-x=name]').onclick = () => nameModal();
    m.querySelector('[data-x=out]').onclick = () => signOut();
    m.querySelector('[data-x=del]').onclick = () => deleteModal();
  }

  async function codeModal() {
    let r;
    try { r = await call('POST', '/api/code'); } catch (e) { return warn(e); }
    const until = Date.now() + (r.expiresInSeconds || 900) * 1000;
    const m = U.openModal(`${U.modalHead('Add another device', 'Sign in on your phone or another computer')}
      <div class="modal-body">
        <div class="oa-code" id="oa-code-show">${esc(fmtCode(r.code))}</div>
        <p class="muted" style="text-align:center;margin:0 0 14px" id="oa-exp">Works once · expires in 15:00</p>
        <ol class="t-list" style="margin:0;padding-left:20px;line-height:1.7;font-size:13.5px"><li>On the other device, open the Coll Ledger Academy${window.COLL_ACADEMY ? ' in Coll Ledger (Practice / Training)' : ' phone app at collbusinesssolutions.com/academy-app'}.</li><li>Tap <b>Sign in</b> → <b>Sign in with a code</b> and type the code above.</li><li>Your lessons, exams and certificates come along. Both devices stay signed in.</li></ol>
      </div>
      <div class="modal-foot"><button class="btn" data-x="copy">${ICON.copy}Copy code</button><button class="btn primary" data-action="close-modal">Done</button></div>`);
    m.querySelector('[data-x=copy]').onclick = () => U.copyText(r.code);
    const tick = () => { const el = $('#oa-exp', m); if (!el || !document.body.contains(el)) return clearInterval(iv); const s = Math.max(0, Math.round((until - Date.now()) / 1000)); el.textContent = s ? `Works once · expires in ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : 'This code has expired — make a new one.'; if (!s) { $('#oa-code-show', m).style.opacity = '.35'; clearInterval(iv); } };
    const iv = setInterval(tick, 1000); tick();
  }

  function nameModal() {
    const a = acct();
    const m = U.openModal(`${U.modalHead('Name on your certificates', 'Spell it exactly as it should appear')}
      <div class="modal-body"><div class="field"><label for="oa-fix">Full name</label><input id="oa-fix" class="input" value="${esc(a.name || '')}"></div></div>
      <div class="modal-foot"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" id="oa-go">Save</button></div>`);
    $('#oa-go', m).onclick = async () => {
      const name = $('#oa-fix', m).value.trim(); if (name.length < 2) return U.toast('Add your full name', null, 'warn');
      try { const r = await call('POST', '/api/me', { name }); acct().name = r.name; save(); U.closeModal(); U.toast('Name saved'); refreshMe(); }
      catch (e) { warn(e); }
    };
  }

  async function signOut() {
    if (!await U.confirmBox({ title: 'Sign out of this device?', body: 'Your progress stays on this device and on the Academy server. To take official exams here again, sign in with a code from another device — or with a new code.', ok: 'Sign out' })) return;
    if (timer || !pulledOnce) await syncNow();
    try { await call('POST', '/api/logout'); } catch (e) { }
    delete S.data.training.account; O().me = null; serverCanon = null; pulledOnce = false; save();
    U.closeModal(); render(); U.toast('Signed out of your Academy account');
  }

  function deleteModal() {
    const creds = (O().me && O().me.credentials) || [];
    const m = U.openModal(`${U.modalHead('Delete your Academy account?', 'This can\'t be undone')}
      <div class="modal-body"><p style="margin:0 0 12px;line-height:1.6;color:var(--ink-2)">Your account, saved progress, exam attempts, practicals and results are deleted from the Academy server, and every device is signed out. What's on this device stays here.</p>
        ${creds.length ? `<label class="check"><input type="checkbox" id="oa-keep" checked> Keep my ${creds.length > 1 ? 'certificates' : 'certificate'} publicly verifiable (name and scores only)</label><p class="muted" style="font-size:12px;margin:6px 0 0">Untick to delete ${creds.length > 1 ? 'them' : 'it'} too — the verify link would then show "not found".</p>` : ''}
      </div>
      <div class="modal-foot"><button class="btn" data-action="close-modal">Cancel</button><button class="btn danger-fill" id="oa-go">Delete my account</button></div>`);
    $('#oa-go', m).onclick = async () => {
      const keep = !!($('#oa-keep', m) && $('#oa-keep', m).checked);
      try { await call('DELETE', '/api/me', { confirm: 'DELETE', keepCredentials: keep }); }
      catch (e) { return warn(e); }
      delete S.data.training.account; O().me = null; serverCanon = null; pulledOnce = false; save();
      U.closeModal(); U.closeModal(); render(); U.toast('Your Academy account was deleted');
    };
  }

  // ------------------------------------------------------------------
  // Official written exams
  // ------------------------------------------------------------------
  const EX = {
    pro: { title: 'Written exam', name: 'Professional written exam', tag: 'gold', part: 'Final exam · part 1 of 2', list: 'written', practiceList: 'writtenPractice', practiceAction: 'ex-start', next: 'exam-practical', q: 30, mins: '~1 hr', bar: '', certKey: 'cert',
      learn: 'questions drawn at random from the question bank, covering every level: bookkeeping basics, categorizing, invoices and bills, reconciling, month end, taxes, records and professional practice.' },
    adv: { title: 'Advanced written exam', name: 'Advanced written exam', tag: 'navy', part: 'Advanced final · part 1 of 2', list: 'advWritten', practiceList: 'advWrittenPractice', practiceAction: 'ax-start', next: 'adv-exam-practical', q: 35, mins: '~75 min', bar: 'navy', certKey: 'certAdv',
      learn: 'questions drawn from the question bank: accrual accounting, prepaids and accruals, fixed assets, inventory, loans, the close and cash flow, payroll and sales tax compliance, business and owner taxes, 1099s, internal controls, ethics and career paths. Several need a calculator.' }
  };
  const ANS = id => 'coll-academy-answers-' + id;
  const loadAnswers = id => { try { return JSON.parse(localStorage.getItem(ANS(id)) || '{}') || {}; } catch (e) { return {}; } };
  const keepAnswers = E => { try { localStorage.setItem(ANS(E.attemptId), JSON.stringify(E.answers)); } catch (e) { } };
  const dropAnswers = id => { try { localStorage.removeItem(ANS(id)); } catch (e) { } };
  const signInCta = what => `<div class="online-cta">${LOCK_ICON}<div class="grow"><b>Official ${what} are taken online</b><div class="muted">Sign in to your Academy account — or create one, it takes a minute. Your work is graded on the Academy server and counts toward your certificate.</div></div><button class="btn primary" data-action="on-account">Sign in</button></div>`;
  const loadingNote = () => {
    if (!O().me && !O().meLoading) setTimeout(() => refreshMe(), 0);
    return O().meError ? `<div class="online-cta warn">${ICON.alert}<div class="grow"><b>Couldn't reach the Academy server</b><div class="muted">${esc(O().meError)}</div></div><button class="btn" data-action="on-refresh">Try again</button></div>` : `<p class="muted">Checking your exam status…</p>`;
  };
  // Advanced needs the Professional certificate on the server
  const prereqNote = () => {
    const t = T();
    return `<div class="online-cta warn">${LOCK_ICON}<div class="grow"><b>Opens with the Professional certificate</b><div class="muted">${t.cert && !t.cert.official
      ? `Your Professional certificate (${esc(t.cert.id)}) was issued before Academy accounts, so the Academy server doesn't know about it yet. Email collbusinesssolutions@gmail.com with your certificate ID and student ID (${esc((acct() || {}).studentId || '')}) to have it added — or pass the official Professional exams.`
      : 'The Advanced exams open once you hold the Professional Bookkeeping Certificate from the Academy server.'}</div></div></div>`;
  };

  function writtenPage(exam) {
    const X = EX[exam], t = T(), E = S.ui.exam && S.ui.exam.kind === 'official' && S.ui.exam.exam === exam ? S.ui.exam : null;
    if (E) return E.done ? writtenResult(E) : writtenQuestion(E);
    const official = t[X.list].filter(w => w.official), legacy = t[X.list].filter(w => !w.official);
    const best = official.reduce((b, w) => (!b || w.pct > b.pct ? w : b), null);
    const passed = official.some(w => w.passed);
    const st = signedIn() ? status(exam) : null;
    const need = Math.ceil(X.q * 0.8);
    const prac = (t[X.practiceList] || []).slice(-1)[0];
    let body;
    if (!signedIn()) body = signInCta('exams');
    else if (!st) body = loadingNote();
    else if (exam === 'adv' && !st.available) body = prereqNote();
    else body = `<div class="honor-note">${LOCK_ICON}<div><b>Exam rules</b><div class="muted">Work on your own. A calculator and scratch paper are fine; notes, the Handbook, other people and AI tools are not. Once you start, you have 3 hours to submit. Three tries in a row, then a 24-hour break — a pass resets the count. ${triesLine(st.written.tries)}</div></div></div>`;
    const canStart = signedIn() && st && (exam === 'pro' || st.available) && !isLocked(st.written.tries);
    const resume = st && st.written.openAttempt;
    return `<div class="tm-head"><span class="tag ${X.tag}">${X.part}</span>${passed ? `<span class="tag green">${ICON.check}Passed · ${Math.round(best.pct * 100)}%</span>` : ''}<span class="tag">Official · graded online</span></div>
      <h2 class="tm-title">${X.title}</h2>
      <p class="tm-learn">${X.q} ${X.learn}</p>
      <div class="exam-rules"><div><b>${X.q}</b><span>questions</span></div><div><b>80%</b><span>to pass (${need} right)</span></div><div><b>${X.mins}</b><span>typical · 3 hrs to submit</span></div><div><b>New</b><span>questions each try</span></div></div>
      ${body}
      ${official.length || legacy.length ? `<div class="exam-history"><div class="cap-label">Your attempts</div>${official.concat(legacy).sort((a, b) => (a.at || 0) - (b.at || 0)).slice(-5).reverse().map(w => `<div><span>${fmtDate(w.date)}</span><b class="${w.pct >= 0.8 ? 'pos' : ''}">${w.score} / ${w.total} · ${Math.round(w.pct * 100)}%</b>${w.pct >= 0.8 ? '<span class="tag green">Passed</span>' : '<span class="tag">Not yet</span>'}${w.official ? '' : '<span class="tag">Before accounts</span>'}</div>`).join('')}</div>` : ''}
      <div class="practice-card"><div class="grow"><b>Practice exam</b><div class="muted">The same kind of questions, graded right here — <b>doesn't count toward the certificate</b>.${prac ? ` Last practice: ${prac.score} / ${prac.total}.` : ''}</div></div><button class="btn" data-action="${X.practiceAction}">Practice exam</button></div>
      <div class="tm-nav"><button class="btn ghost" data-nav="handbook">${ICON.help}Study the handbook</button>${!signedIn() ? `<button class="btn primary" data-action="on-account">Sign in to take the exam ${ICON.right}</button>` : `<button class="btn primary" data-action="on-start" data-exam="${exam}" ${canStart ? '' : 'disabled'}>${resume ? 'Resume the exam' : passed ? 'Take it again' : 'Start the official exam'} ${ICON.right}</button>`}</div>`;
  }
  function writtenQuestion(E) {
    const X = EX[E.exam], q = E.questions[E.at], answered = E.questions.filter(x => E.answers[x.id] != null).length, n = E.questions.length;
    return `<div class="tm-head"><span class="tag ${X.tag}">Official ${X.title.replace(/^Written/, 'written').replace(/^Advanced written/, 'advanced written')}</span><span class="muted">Question ${E.at + 1} of ${n} · ${answered} answered · ${left(E.expiresAt)} left</span></div>
      <div class="progress ${X.bar}" style="margin:6px 0 18px"><div style="width:${(answered / n * 100).toFixed(1)}%"></div></div>
      <div class="muted" style="font-size:11.5px;text-transform:uppercase;letter-spacing:.08em">${esc(q.topic)}</div>
      <h2 class="tm-title" style="font-size:22px;line-height:1.35">${esc(q.question)}</h2>
      <div class="exam-opts">${q.options.map((o, k) => `<button class="exam-opt ${E.answers[q.id] === k ? 'on' : ''}" data-action="on-pick" data-a="${k}"><span class="eo-k">${'ABC'[k]}</span><span>${esc(o)}</span></button>`).join('')}</div>
      <div class="exam-dots">${E.questions.map((x, k) => `<button class="${k === E.at ? 'cur' : ''} ${E.answers[x.id] != null ? 'ans' : ''}" data-action="on-jump" data-k="${k}" aria-label="Question ${k + 1}">${k + 1}</button>`).join('')}</div>
      <div class="tm-nav"><button class="btn ghost" data-action="on-move" data-d="-1" ${E.at === 0 ? 'disabled' : ''}>${ICON.back}Back</button>
        ${E.at < n - 1 ? `<button class="btn ${E.answers[q.id] != null ? 'primary' : ''}" data-action="on-move" data-d="1">Next ${ICON.right}</button>` : `<button class="btn primary" data-action="on-submit" ${answered < n ? 'disabled' : ''}>Submit for grading</button>`}</div>
      ${E.at === n - 1 && answered < n ? `<p class="muted" style="text-align:right">${plural(n - answered, 'question')} still unanswered — use the numbers above to jump back.</p>` : ''}
      <p class="muted" style="font-size:12px">Your answers are kept on this device as you go. If the connection drops, open the exam again to pick up where you left off — it doesn't cost a try.</p>`;
  }
  function writtenResult(E) {
    const X = EX[E.exam], r = E.result;
    return `<div class="exam-result ${r.passed ? 'pass' : ''}"><div class="er-score">${r.score}<span>/ ${r.total}</span></div><div><h2 class="tm-title" style="margin:0">${r.passed ? 'You passed!' : 'Not quite yet'}</h2><div class="muted">${r.percent}% · ${r.passed ? (r.distinctionLevel ? 'Distinction-level score.' : 'Nicely done.') : `You need ${r.needed} right to pass. Review what you missed, then try again — you'll get a fresh set of questions. ${r.tries ? triesLine(r.tries).replace(/<\/?b>/g, '') : ''}`}</div></div></div>
      ${r.review && r.review.length ? `<div class="cap-label" style="margin-top:18px">Review what you missed</div>${r.review.map(x => `<div class="qz"><div class="muted" style="font-size:11.5px;text-transform:uppercase;letter-spacing:.08em">${esc(x.topic)}</div><div class="qz-q">${esc(x.question)}</div><div class="qz-a">${x.yourAnswer != null ? `<div class="qa wrong">${esc(x.yourAnswer)}</div>` : '<div class="qa wrong">Not answered</div>'}<div class="qa right answer">${esc(x.correctAnswer)}</div></div><div class="qz-why right">${ICON.check}${esc(x.why || '')}</div></div>`).join('')}` : '<p class="pos"><b>Perfect score.</b></p>'}
      <div class="tm-nav"><button class="btn ghost" data-action="on-close">Back to the exam page</button>${r.passed ? `<button class="btn primary" data-action="t-go" data-id="${X.next}">On to the practical ${ICON.right}</button>` : `<button class="btn primary" data-action="on-start" data-exam="${E.exam}" ${r.tries && isLocked(r.tries) ? 'disabled' : ''}>Try again ${ICON.right}</button>`}</div>`;
  }

  async function startOfficial(exam) {
    const X = EX[exam];
    if (!signedIn()) return enrollModal(() => startOfficial(exam), 'Create your Academy account to take the official exam');
    const st = status(exam);
    const begin = async () => {
      O().busy = 'exam';
      try {
        const r = await call('POST', '/api/exam/start', { exam });
        S.ui.exam = { kind: 'official', exam, attemptId: r.attemptId, questions: r.questions, at: 0, answers: loadAnswers(r.attemptId), started: Date.parse(r.startedAt) || Date.now(), expiresAt: r.expiresAt, total: r.total, needed: r.needed, resumed: !!r.resumed };
        const first = r.questions.findIndex(q => S.ui.exam.answers[q.id] == null); if (first > 0) S.ui.exam.at = first;
        if (r.resumed) U.toast('Picking up your exam where you left off');
      } catch (e) { warn(e); refreshMe(); return; }
      finally { O().busy = ''; }
      render(); const v = $('#view'); if (v) v.scrollTop = 0;
    };
    if (st && st.written.openAttempt) return begin();
    App.examGate('official:' + exam + '-written', T()[X.list], X.name, begin);
  }
  async function submitOfficial() {
    const E = S.ui.exam; if (!E || E.kind !== 'official') return;
    if (!await U.confirmBox({ title: 'Submit your answers?', body: 'They\'re graded on the Academy server, and you can\'t change them after this.', ok: 'Submit' })) return;
    O().busy = 'exam';
    let r;
    try { r = await call('POST', '/api/exam/submit', { attemptId: E.attemptId, answers: E.answers }, { timeout: 30000 }); }
    catch (e) {
      O().busy = '';
      if (e.code === 'attempt_expired' || e.code === 'already_submitted' || e.code === 'not_found') { dropAnswers(E.attemptId); S.ui.exam = null; render(); refreshMe(); }
      return warn(e);
    }
    O().busy = '';
    const X = EX[E.exam], t = T();
    t[X.list].push({ date: today(), score: r.score, total: r.total, pct: r.pct, passed: r.passed, at: Date.now(), mins: Math.round((Date.now() - E.started) / 60000), official: true, attemptId: r.attemptId });
    save(); dropAnswers(E.attemptId);
    E.done = true; E.result = r; render(); const v = $('#view'); if (v) v.scrollTop = 0;
    U.toast(r.passed ? `Passed — ${r.score} of ${r.total}` : `${r.score} of ${r.total} — ${r.tries && isLocked(r.tries) ? 'that was your third try in a row; the next one opens in 24 hours' : `${plural(r.tries ? r.tries.left : 0, 'try', 'tries')} left before a 24-hour break`}`);
    refreshMe(false); syncNow();
  }

  // ------------------------------------------------------------------
  // Official practicals
  // ------------------------------------------------------------------
  const PX = {
    pro: { flag: 'exam', name: 'Juniper Flower Co.', title: 'Practical exam: a real month-end', tag: 'gold', part: 'Final exam · part 2 of 2', key: 'practical', open: 'review', docs: 'pro', certKey: 'cert',
      learn: 'Do a month-end for Juniper Flower Co., a new client with problems planted in the books — the way you would for a real client. The Academy server makes your own copy with your own numbers (bank statement, payroll report, invoice and the CPA\'s entry) and grades your finished books.',
      rules: [['12', 'checks · 100 points'], ['80+', 'balanced & closed'], ['~2 hrs', 'typical'], ['Yours', 'numbers for you only']] },
    adv: { flag: 'advExam', name: 'Aspen Trail Outfitters', title: 'Practical: an accrual month-end close', tag: 'navy', part: 'Advanced final · part 2 of 2', key: 'advPractical', open: 'journal', docs: '', certKey: 'certAdv',
      learn: 'Close the month for Aspen Trail Outfitters, a retail client on monthly accrual reporting: post the adjusting entries from the source documents, fix two miscoded transactions, split the loan payment and close the month. Your numbers are your own; grading looks at the month-end balances.',
      rules: [['8', 'checks · 100 points'], ['80+', 'and the month closed'], ['~2 hrs', 'typical'], ['Yours', 'numbers for you only']] }
  };
  const offClient = exam => S.data.clients.find(c => c[PX[exam].flag] && c.academy && c.academy.practicalId) || null;
  const localExamClient = exam => S.data.clients.find(c => c[PX[exam].flag] && !(c.academy && c.academy.practicalId)) || null;
  const docsHTML = (brief, exam) => `<div class="adv-docs ${PX[exam].docs}">${(brief.documents || []).map(d => `<div class="adv-doc"><b>${esc(d.title)}</b><span class="pre">${esc(d.text)}</span></div>`).join('')}</div>`;

  function practicalPage(exam) {
    const P = PX[exam], t = T(), c = offClient(exam), prev = t[P.key];
    const prevOk = prev && prev.passed && (prev.official || (exam === 'pro' ? App.academy.counts(prev) : App.advanced.counts(prev)));
    const st = signedIn() ? status(exam) : null;
    const brief = c && c.academy.brief;
    const head = `<div class="tm-head"><span class="tag ${P.tag}">${P.part}</span>${prevOk ? `<span class="tag green">${ICON.check}Passed · ${prev.score}/100</span>` : ''}<span class="tag">Official · graded online</span></div>
      <h2 class="tm-title">${exam === 'adv' && brief ? `Practical: close ${esc(brief.month.label)} for Aspen Trail Outfitters` : exam === 'pro' && brief ? `Practical exam: ${esc(brief.month.label)} month-end` : P.title}</h2>`;
    const rules = `<div class="exam-rules">${P.rules.map(([b, s]) => `<div><b>${b}</b><span>${s}</span></div>`).join('')}</div>`;
    if (!signedIn()) return `${head}<p class="tm-learn">${P.learn}</p>${rules}${signInCta('practicals')}<div class="tm-nav"><span></span><button class="btn primary" data-action="on-account">Sign in to start ${ICON.right}</button></div>`;
    if (!st) return `${head}<p class="tm-learn">${P.learn}</p>${rules}${loadingNote()}`;
    if (exam === 'adv' && !st.available) return `${head}<p class="tm-learn">${P.learn}</p>${rules}${prereqNote()}`;
    const tries = `<div class="honor-note">${LOCK_ICON}<div><b>Grading</b><div class="muted">Each grading counts as a try: three in a row without passing, then a 24-hour break. ${triesLine(st.practical.tries)}</div></div></div>`;
    if (!c) {
      const legacy = localExamClient(exam);
      return `${head}<p class="tm-learn">${P.learn}</p>${rules}${tries}
        ${legacy ? `<p class="muted" style="font-size:12.5px">Your earlier copy of ${esc(P.name)} (made before Academy accounts) will be replaced by your official one.</p>` : ''}
        <div class="tm-nav"><span></span><button class="btn primary" data-action="on-prac-start" data-exam="${exam}">Start the practical ${ICON.right}</button></div>`;
    }
    if (!brief) { if (!O().busy) setTimeout(() => loadBrief(exam), 0); return `${head}<p class="muted">Loading your brief…</p>`; }
    const res = O().grade[exam] && O().grade[exam].practicalId === c.academy.practicalId ? O().grade[exam] : null;
    const moved = st.practical.practicalId && st.practical.practicalId !== c.academy.practicalId;
    return `${head}
      ${moved ? `<div class="online-cta warn">${ICON.alert}<div class="grow"><b>You started this practical over on another device</b><div class="muted">This copy can no longer be graded. Load the current one to keep going.</div></div><button class="btn" data-action="on-prac-load" data-exam="${exam}">Load it</button></div>` : ''}
      <div class="exam-brief"><p><b>The job:</b> ${esc(brief.intro)}</p><ol class="t-list">${(brief.tasks || []).map(x => `<li>${esc(x)}</li>`).join('')}</ol></div>
      ${docsHTML(brief, exam)}
      <p class="muted">Plan on about 2 hours. ${esc(brief.grading || '')}</p>
      ${tries}
      ${res ? gradeHTML(res, brief) : ''}
      <div class="tm-nav"><button class="btn ghost" data-action="on-prac-reset" data-exam="${exam}">${ICON.refresh}Start over</button><span style="flex:1"></span><button class="btn" data-action="on-prac-open" data-exam="${exam}">Open ${esc(exam === 'pro' ? P.name : 'Aspen Trail')} ${ICON.right}</button><button class="btn primary" data-action="on-prac-grade" data-exam="${exam}" ${isLocked(st.practical.tries) ? 'disabled' : ''}>${ICON.check}Grade my work</button></div>`;
  }
  function gradeHTML(r, brief) {
    const labels = new Set(r.items.map(x => x.label));
    const extra = (r.required || []).filter(x => !labels.has(x.label));
    const ml = brief && brief.month ? brief.month.label : 'the month';
    const msg = r.passed ? (r.score === 100 ? 'A perfect month-end.' : 'Solid work.') : r.reconciled === false ? 'The reconciliation has to balance to pass.' : !r.closed ? `Close ${esc(ml)} once everything else is done.` : 'Fix the items marked below, then grade again.';
    return `<div class="exam-result ${r.passed ? 'pass' : ''}"><div class="er-score">${r.score}<span>/ 100</span></div><div><h2 class="tm-title" style="margin:0">${r.passed ? 'You passed the practical!' : 'Not passed yet'}</h2><div class="muted">${msg}${!r.passed && r.tries ? ' ' + triesLine(r.tries).replace(/<\/?b>/g, '') : ''}</div></div></div>
      <div class="grade-list">${r.items.map(x => `<div class="gl ${x.ok ? 'ok' : ''}"><span class="tick ${x.ok ? 'on' : ''}">${x.ok ? ICON.check : ICON.close}</span><div class="grow"><b>${esc(x.label)}</b>${x.ok ? '' : `<div class="muted">${x.why ? esc(x.why) : 'Not right yet. Recheck the source documents and the lesson on this topic — the full answer key appears once you pass.'}</div>`}</div><span class="num">${x.got}/${x.pts}</span></div>`).join('')}
        ${extra.map(x => `<div class="gl ${x.ok ? 'ok' : ''}"><span class="tick ${x.ok ? 'on' : ''}">${x.ok ? ICON.check : ICON.close}</span><div class="grow"><b>${esc(x.label)}</b>${x.ok ? '' : '<div class="muted">Required to pass.</div>'}</div><span class="num">required</span></div>`).join('')}</div>`;
  }
  function installClient(exam, r) {
    const P = PX[exam], c = r.client;
    c.practice = true; c[P.flag] = true;
    c.academy = Object.assign({}, c.academy || {}, { practicalId: r.practicalId, exam, brief: r.brief });
    c.touchedAt = Date.now();
    S.data.clients = S.data.clients.filter(x => !x[P.flag]);
    S.data.clients.push(c);
    delete O().grade[exam];
    return c;
  }
  async function startPractical(exam, fresh) {
    if (!signedIn()) return enrollModal(() => startPractical(exam, fresh), 'Create your Academy account to take the official practical');
    O().busy = 'practical';
    let r;
    try { r = await call('POST', '/api/practical/start', { exam, fresh: !!fresh }, { timeout: 30000 }); }
    catch (e) { O().busy = ''; warn(e); return null; }
    O().busy = '';
    const c = installClient(exam, r);
    save(); refreshMe(false);
    return c;
  }
  async function loadBrief(exam) {
    const c = offClient(exam); if (!c || c.academy.brief || O().busy) return;
    O().busy = 'brief';
    try {
      const r = await call('POST', '/api/practical/start', { exam, fresh: false }, { timeout: 30000 });
      if (r.practicalId === c.academy.practicalId) c.academy.brief = r.brief; else installClient(exam, r);
      save();
    } catch (e) { warn(e); }
    finally { O().busy = ''; }
    render();
  }
  const uploadCopy = c => JSON.parse(JSON.stringify(c, (k, v) => (k === 'brief' ? undefined : typeof v === 'string' && v.length > 2000 && v.startsWith('data:') ? undefined : v)));
  async function gradePractical(exam) {
    const P = PX[exam], c = offClient(exam); if (!c) return;
    const st = status(exam);
    if (st && isLocked(st.practical.tries)) return U.toast(`Grading opens again ${when(st.practical.tries.lockedUntil)} — a good time to review`, null, 'warn');
    if (!await U.confirmBox({ title: 'Grade your work?', body: `Your books are sent to the Academy server and graded there. Each grading counts as a try. ${st ? triesLine(st.practical.tries) : ''}`, ok: 'Grade it' })) return;
    O().busy = 'grade';
    let r;
    try { r = await call('POST', '/api/practical/submit', { practicalId: c.academy.practicalId, client: uploadCopy(c) }, { timeout: 45000 }); }
    catch (e) { O().busy = ''; warn(e); refreshMe(); return; }
    O().busy = '';
    O().grade[exam] = r;
    const t = T(), b = r.best || {};
    t[P.key] = { score: b.passed ? b.passScore : (b.score != null ? b.score : r.score), passed: !!b.passed, date: (t[P.key] && t[P.key].official && t[P.key].passed && b.passed && t[P.key].score === b.passScore) ? t[P.key].date : today(), official: true, practicalId: r.practicalId };
    save();
    if (exam === 'adv') { t.track = 'adv'; t.currentAdv = 'adv-exam-practical'; } else { t.track = 'pro'; t.current = 'exam-practical'; }
    if (S.route.page !== 'training') go('training'); else render();
    U.toast(r.passed ? `Practical passed — ${r.score}/100` : `${r.score}/100 — ${r.tries && isLocked(r.tries) ? 'that was your third try in a row; grading opens again in 24 hours' : `${plural(r.tries ? r.tries.left : 0, 'try', 'tries')} left before a 24-hour break`}`);
    refreshMe(false); syncNow();
  }

  // ------------------------------------------------------------------
  // Certificates
  // ------------------------------------------------------------------
  const NEEDS = { written: 'pass the official written exam', practical: 'pass the official practical', professional_certificate: 'earn the Professional Bookkeeping Certificate first' };
  async function claim(program) {
    const pro = program === 'professional', exam = pro ? 'pro' : 'adv', key = pro ? 'cert' : 'certAdv';
    if (!signedIn()) return enrollModal(() => claim(program), 'Certificates are issued by the Academy server — sign in first');
    const me = await refreshMe(false);
    if (!me) return U.toast(O().meError || OFFLINE, null, 'warn');
    const ex = me.exams[exam];
    if (!ex.certificate.eligible) { render(); return U.toast('To get this certificate, ' + ex.certificate.needs.map(n => NEEDS[n] || n).join(' and ') + '.', null, 'warn'); }
    const locked = !!me.nameLocked;
    const m = U.openModal(`${U.modalHead(pro ? 'Your certificate' : 'Advanced certificate', 'Check how your name should appear — it can\'t be changed once the certificate is issued')}
      <div class="modal-body"><div class="field"><label for="oc-name">Full name</label><input id="oc-name" class="input" value="${esc(me.student.name)}" ${locked ? 'readonly' : ''}></div>
      <div class="cert-sum"><div><span>Written exam</span><b>${ex.written.bestPercent}%</b></div><div><span>${pro ? 'Practical exam' : 'Practical close'}</span><b>${ex.practical.bestPassingScore}/100</b></div><div><span>Verified</span><b>Instantly</b></div></div>
      <p class="muted" style="font-size:12.5px;margin:12px 0 0">The Academy server issues a digitally signed certificate. Anyone can check it at collbusinesssolutions.com/verify right away — no registration email needed.</p></div>
      <div class="modal-foot"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" id="oc-go">${ICON.spark}Issue my certificate</button></div>`);
    $('#oc-go', m).onclick = async () => {
      const name = $('#oc-name', m).value.trim(); if (name.length < 2) return U.toast('Add your name', null, 'warn');
      const b = $('#oc-go', m); busyBtn(b, true, 'Issuing…');
      try {
        if (!locked && name !== me.student.name) { const r = await call('POST', '/api/me', { name }); acct().name = r.name; }
        const r = await call('POST', '/api/credential/claim', { program }, { timeout: 30000 });
        T()[key] = toCert(r); save();
      } catch (e) { busyBtn(b, false); return warn(e); }
      U.closeModal();
      U.toast(pro ? 'Certificate issued — it\'s verified and live' : 'Advanced certificate issued — it\'s verified and live');
      render(); syncNow(); refreshMe(false);
      if (pro) { App.academy.printCert(T().cert, App.practice.levelsWithLessons()); setTimeout(App.academy.credentialModal, 600); }
      else { App.advanced.printCert(T().certAdv); setTimeout(App.advanced.credentialModal, 600); }
    };
  }

  // ------------------------------------------------------------------
  // Sync window: automatic sync, with the file as a fallback
  // ------------------------------------------------------------------
  function syncModal() {
    const t = T(), ACADEMY = !!window.COLL_ACADEMY;
    U.openModal(`${U.modalHead('Sync your progress', 'Lessons, exams, certificates and practice clients — between your phone and your computer')}
      <div class="modal-body">
        ${signedIn() ? `<div class="online-sync">${ICON.refresh}<div class="grow"><b>Automatic sync is on</b><div class="muted" id="os-status">${esc(syncStatus())}</div><div class="muted" style="font-size:12px">Signed in as ${esc(acct().name || '')}. Changes sync a few seconds after you make them.</div></div><button class="btn primary" data-action="on-sync-now">Sync now</button></div>`
          : `<div class="online-cta">${ICON.refresh}<div class="grow"><b>Sync automatically</b><div class="muted">Sign in to your Academy account on both devices and your progress follows you — no files to move.</div></div><button class="btn primary" data-action="on-account">Sign in</button></div>`}
        <div class="cap-label" style="margin-top:18px">Or move it with a file</div>
        <div class="cred-steps" style="margin-top:6px">
          <div class="cred-step"><span class="n">1</span><div class="grow"><b>On the device you studied on: Send progress</b><div class="muted">${ACADEMY ? 'Your phone makes a small progress file. Share it to yourself by email, Google Drive, OneDrive or AirDrop.' : 'Coll Ledger saves a small progress file. Email it to yourself, or put it in Google Drive or OneDrive.'}</div></div><button class="btn" data-action="sync-export">${ICON.upload}Send progress</button></div>
          <div class="cred-step"><span class="n">2</span><div class="grow"><b>On the other device: Bring in progress</b><div class="muted">Open the file there. Progress merges — nothing is lost on either side, and the newer copy of each practice client wins.</div></div><button class="btn" data-action="sync-import">${ICON.download}Bring in progress</button></div>
        </div>
        <div class="sync-meta muted">${t.lastExport ? `Last sent ${fmtDate(new Date(t.lastExport).toISOString().slice(0, 10))}. ` : ''}${t.lastImport ? `Last brought in ${fmtDate(new Date(t.lastImport).toISOString().slice(0, 10))}.` : ''}</div>
        <p class="muted" style="font-size:12px;margin:10px 0 0">Only Academy progress is shared; real client books never leave the desktop app. Your sign-in stays on each device and is never put in a progress file.</p>
      </div>
      <div class="modal-foot"><button class="btn primary" data-action="close-modal">Done</button></div>`, { wide: true });
  }

  // ------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------
  const ex = el => (el && el.dataset && el.dataset.exam) || 'pro';
  act({
    'on-account': () => openAccount(() => render()),
    'on-refresh': () => { O().meError = null; refreshMe(); render(); },
    'on-sync-now': async () => { const ok = await syncNow({ pull: true, toast: true }); refreshSyncUi(); if (ok) refreshMe(); },
    'sync-open': () => syncModal(),
    'on-start': el => startOfficial(ex(el)),
    'on-close': () => { S.ui.exam = null; render(); },
    'on-pick': el => { const E = S.ui.exam; if (!E || E.kind !== 'official') return; E.answers[E.questions[E.at].id] = +el.dataset.a; keepAnswers(E); render(); },
    'on-move': el => { const E = S.ui.exam; E.at = Math.max(0, Math.min(E.questions.length - 1, E.at + +el.dataset.d)); render(); },
    'on-jump': el => { S.ui.exam.at = +el.dataset.k; render(); },
    'on-submit': () => submitOfficial(),
    'on-prac-start': async el => { const exam = ex(el); const c = await startPractical(exam, false); if (c) App.switchClient(c.id, PX[exam].open); },
    'on-prac-load': async el => { const exam = ex(el); const c = await startPractical(exam, false); if (c) render(); },
    'on-prac-open': el => { const exam = ex(el), c = offClient(exam); if (c) App.switchClient(c.id, PX[exam].open); },
    'on-prac-reset': async el => {
      const exam = ex(el), P = PX[exam];
      if (!await U.confirmBox({ title: 'Start the practical over?', body: `You'll get a new copy of ${esc(P.name)} with new numbers, and the work in this one can no longer be graded. Tries you've used still count.`, ok: 'Start over' })) return;
      const c = await startPractical(exam, true); if (c) { U.toast(`A fresh ${P.name} is ready`); render(); }
    },
    'on-prac-grade': el => gradePractical(ex(el)),
    't-cert': () => { const t = T(); if (t.cert) return App.academy.credentialModal(); claim('professional'); },
    'adv-cert': () => { const t = T(); if (t.certAdv) return App.advanced.credentialModal(); claim('advanced'); }
  });

  // ------------------------------------------------------------------
  // Sync triggers and the account button
  // ------------------------------------------------------------------
  let lastPage = null;
  App.hooks.push((c, page) => {
    const inA = page === 'training' || page === 'lab', wasA = lastPage === 'training' || lastPage === 'lab';
    lastPage = page;
    if (signedIn()) {
      if (inA && !wasA) { if (Date.now() - lastPull > 60000) syncNow({ pull: true }); if (Date.now() - (O().meAt || 0) > 60000 && !O().meLoading) refreshMe(); }
      else if (!inA && wasA && timer) syncNow();
    }
    if (!inA) return;
    const head = $('#view .page-head .actions') || $('#view .page-head');
    if (!head) return;
    let b = $('#acct-btn');
    if (!b) { b = document.createElement('button'); b.className = 'btn'; b.id = 'acct-btn'; b.dataset.action = 'on-account'; head.appendChild(b); }
    const a = acct();
    b.innerHTML = signedIn() ? `${ICON.people}${esc((a.name || 'Account').split(' ')[0])}` : `${ICON.lock}Sign in`;
    b.title = signedIn() ? `Academy account · ${a.email || ''}` : 'Sign in to your Academy account';
    refreshSyncUi();
  });
  document.addEventListener('visibilitychange', () => {
    if (!signedIn()) return;
    if (document.visibilityState === 'hidden') { if (timer) syncNow(); }
    else if (Date.now() - lastPull > 60000) syncNow({ pull: true });
  });
  window.addEventListener('online', () => { if (signedIn() && (timer || O().syncError)) syncNow({ pull: true }); });
  // Start-up: download and merge (unless opening on the Academy already did)
  App.onLoad.push(() => { if (signedIn()) setTimeout(() => { if (Date.now() - lastPull > 5000 && !running) syncNow({ pull: true }); if (!O().meAt && !O().meLoading) refreshMe(); }, 400); });

  App.online = { API, signedIn, account: acct, call, syncNow, refreshMe, writtenPage, practicalPage, claim, openAccount, enrollModal, redeemModal, accountModal, codeModal, startOfficial, startPractical, gradePractical, offClient, status, canon, encode, decode, ApiError, _state: () => ({ serverCanon, pulledOnce, running: !!running, timer: !!timer, lastPull }) };
})();
