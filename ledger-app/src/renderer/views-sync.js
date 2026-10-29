'use strict';
/* =====================================================================
   Coll Ledger Academy — phone app mode and progress sync
   - window.COLL_ACADEMY: the phone app (Coll Ledger Academy) — only
     practice clients, its own storage, opens on the Academy
   - Sync: move Academy progress between the phone and the desktop app
     with a small file (share it by email, Drive, AirDrop or a cable).
     Lessons, quizzes, exams, tries, review cards, case studies,
     certificates and the practice clients all merge both ways.
   ===================================================================== */
(() => {
  const { S, C, U, act, go, render, save } = App;
  const { $, esc, ICON, fmtDate } = U;
  const ACADEMY = !!window.COLL_ACADEMY;
  const T = () => { S.data.training = S.data.training || {}; return S.data.training; };
  const role = c => c.caseStudy ? 'case:' + c.caseStudy : c.advExam ? 'advExam' : c.exam ? 'exam' : 'practice';

  // ------------------------------------------------------------------
  // Merge two training records — never loses progress, keeps the stricter tries
  // ------------------------------------------------------------------
  const better = (a, b) => !a ? b : !b ? a : (b.passed && !a.passed) || (!!b.passed === !!a.passed && (b.score || 0) > (a.score || 0)) ? b : a;
  function mergeTraining(L, R, takeRemoteClients) {
    L = L || {}; R = R || {};
    const out = Object.assign({}, R, L); // local wins for simple fields (track, current, plan…)
    out.done = Object.assign({}, R.done || {});
    for (const [k, v] of Object.entries(L.done || {})) out.done[k] = out.done[k] && out.done[k] < v ? out.done[k] : v;
    out.quiz = Object.assign({}, R.quiz || {}, L.quiz || {});
    out.flags = Object.assign({}, R.flags || {});
    for (const [k, v] of Object.entries(L.flags || {})) out.flags[k] = out.flags[k] || v;
    const attempts = key => { const seen = new Set(), all = []; for (const w of (L[key] || []).concat(R[key] || [])) { const id = (w.at || '') + '|' + w.date + '|' + w.score + '|' + w.total; if (!seen.has(id)) { seen.add(id); all.push(w); } } return all.sort((a, b) => (a.at || 0) - (b.at || 0) || String(a.date).localeCompare(String(b.date))); };
    out.written = attempts('written'); out.advWritten = attempts('advWritten');
    out.practical = better(L.practical, R.practical); out.advPractical = better(L.advPractical, R.advPractical);
    out.cert = L.cert || R.cert; out.certAdv = L.certAdv || R.certAdv;
    out.honor = attempts('honor');
    out.tries = Object.assign({}, R.tries || {});
    for (const [k, v] of Object.entries(L.tries || {})) { const r = out.tries[k]; out.tries[k] = !r ? v : { fails: Math.max(v.fails || 0, r.fails || 0), lockUntil: Math.max(v.lockUntil || 0, r.lockUntil || 0) }; }
    const lab = Object.assign({}, R.lab || {}, L.lab || {}), Ll = L.lab || {}, Rl = R.lab || {};
    lab.cards = Object.assign({}, Rl.cards || {});
    for (const [k, v] of Object.entries(Ll.cards || {})) { const r = lab.cards[k]; lab.cards[k] = !r || (v.due || '') >= (r.due || '') ? v : r; }
    lab.reviewDays = Object.assign({}, Rl.reviewDays || {});
    for (const [k, v] of Object.entries(Ll.reviewDays || {})) lab.reviewDays[k] = Math.max(v, lab.reviewDays[k] || 0);
    lab.cases = Object.assign({}, Rl.cases || {});
    for (const [k, v] of Object.entries(Ll.cases || {})) lab.cases[k] = better(v, lab.cases[k]);
    lab.emails = Object.assign({}, Rl.emails || {});
    for (const [k, v] of Object.entries(Ll.emails || {})) { const r = lab.emails[k]; lab.emails[k] = !r ? v : v.done || !r.done ? v : r; }
    out.lab = lab;
    // The practice client and the planted lesson data travel together
    out.planted = takeRemoteClients.practice ? (R.planted || L.planted) : (L.planted || R.planted);
    return out;
  }

  // ------------------------------------------------------------------
  // Export and import
  // ------------------------------------------------------------------
  function payload() {
    return { type: 'coll-academy-progress', version: 1, exportedAt: Date.now(), from: ACADEMY ? 'phone' : 'desktop', owner: S.data.firm.owner || '', training: T(), clients: S.data.clients.filter(c => c.practice) };
  }
  async function exportProgress() {
    const p = payload(), name = `Coll Academy progress ${C.todayISO()}.collacademy`;
    const text = JSON.stringify(p);
    T().lastExport = Date.now(); save();
    try {
      const file = new File([text], name, { type: 'application/json' });
      if (!window.desktop && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Coll Academy progress' }); U.toast('Shared — open it in the other app with "Bring in progress"'); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    if (window.desktop) return U.downloadText(name, text, 'application/json', 'collacademy');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    U.toast('Progress file saved — open it in the other app with "Bring in progress"');
  }
  function mergeIn(p) {
    if (!p || p.type !== 'coll-academy-progress') throw new Error('That file isn\'t a Coll Academy progress file.');
    const take = {};
    const mine = new Map(S.data.clients.filter(c => c.practice).map(c => [role(c), c]));
    let added = 0, updated = 0;
    for (const rc of p.clients || []) {
      const r = role(rc), lc = mine.get(r);
      if (!lc) { S.data.clients.push(rc); take[r === 'practice' ? 'practice' : r] = true; added++; continue; }
      if ((rc.touchedAt || 0) > (lc.touchedAt || 0)) {
        const i = S.data.clients.indexOf(lc); S.data.clients[i] = rc;
        if (S.data.activeClientId === lc.id) S.data.activeClientId = rc.id;
        take[r === 'practice' ? 'practice' : r] = true; updated++;
      }
    }
    S.data.training = mergeTraining(T(), p.training, take);
    if (!S.data.firm.owner && p.owner) S.data.firm.owner = p.owner;
    S.data.training.lastImport = Date.now();
    if (App.practice && App.practice.sweep) { try { App.practice.sweep(); } catch (e) { } }
    save();
    return { added, updated };
  }
  async function importProgress() {
    const files = await U.pickFiles('.collacademy,.json');
    if (!files.length) return;
    try {
      const p = JSON.parse(files[0].text);
      const r = mergeIn(p);
      render();
      U.toast(`Progress brought in from your ${p.from || 'other device'}${r.added + r.updated ? ` — ${r.added + r.updated} practice client${r.added + r.updated > 1 ? 's' : ''} updated` : ''}`);
    } catch (e) { U.toast(e.message || 'Couldn\'t read that file', null, 'warn'); }
  }
  function syncModal() {
    const t = T();
    U.openModal(`${U.modalHead(ACADEMY ? 'Sync with the desktop app' : 'Sync with the phone app', 'Your lessons, exams, certificates and practice clients — both ways')}
      <div class="modal-body">
        <div class="cred-steps">
          <div class="cred-step"><span class="n">1</span><div class="grow"><b>On the device you studied on: Send progress</b><div class="muted">${ACADEMY ? 'Your phone makes a small progress file. Share it to yourself by email, Google Drive, OneDrive or AirDrop.' : 'Coll Ledger saves a small progress file. Email it to yourself, or put it in Google Drive or OneDrive.'}</div></div><button class="btn primary" data-action="sync-export">${ICON.upload}Send progress</button></div>
          <div class="cred-step"><span class="n">2</span><div class="grow"><b>On the other device: Bring in progress</b><div class="muted">Open the file there. Progress merges — nothing is lost on either side, and the newer copy of each practice client wins.</div></div><button class="btn" data-action="sync-import">${ICON.download}Bring in progress</button></div>
        </div>
        <div class="sync-meta muted">${t.lastExport ? `Last sent ${fmtDate(new Date(t.lastExport).toISOString().slice(0, 10))}. ` : ''}${t.lastImport ? `Last brought in ${fmtDate(new Date(t.lastImport).toISOString().slice(0, 10))}.` : ''}</div>
        <p class="muted" style="font-size:12px;margin:10px 0 0">Tip: sync at the end of each study session. Certificates earned on either device carry over, and the three-tries rule carries over too — the stricter count wins. Only Academy progress is shared; real client books never leave the desktop app.</p>
      </div>
      <div class="modal-foot"><button class="btn primary" data-action="close-modal">Done</button></div>`, { wide: true });
  }

  act({ 'sync-open': () => syncModal(), 'sync-export': () => exportProgress(), 'sync-import': () => importProgress() });

  // Sync button on the Academy and Study center pages
  App.hooks.push((c, page) => {
    if (page !== 'training' && page !== 'lab') return;
    const head = $('#view .page-head .actions') || $('#view .page-head');
    if (!head || $('#sync-btn')) return;
    const b = document.createElement('button');
    b.className = 'btn'; b.id = 'sync-btn'; b.dataset.action = 'sync-open';
    b.innerHTML = `${ICON.refresh}${ACADEMY ? 'Sync with desktop' : 'Sync with phone'}`;
    head.appendChild(b);
  });

  // ------------------------------------------------------------------
  // Phone app mode
  // ------------------------------------------------------------------
  if (ACADEMY) {
    document.body.classList.add('academy-mode');
    App.onLoad.unshift(() => {
      if (!S.data.setupDone) { S.data.setupDone = true; save(); }
      S.data.clients = S.data.clients.filter(c => c.practice);
      if (!S.data.clients.find(c => c.id === S.data.activeClientId)) S.data.activeClientId = S.data.clients[0] ? S.data.clients[0].id : null;
      const bn = document.querySelector('.brand-name'); if (bn) bn.textContent = 'Coll Ledger Academy';
      const fs = document.querySelector('#firmName'); if (fs) fs.textContent = 'Bookkeeping training';
      document.title = 'Coll Ledger Academy';
      S.route.page = 'training';
      try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { }
    });
    // A practice client switches the work pages on; with none, keep her in the Academy
    App.hooks.push((c, page) => {
      if (!c && !['training', 'lab', 'handbook', 'settings', 'clients'].includes(page)) go('training');
    });
  }
  App.academySync = { mergeTraining, mergeIn, payload, exportProgress, importProgress, syncModal, ACADEMY };
})();
