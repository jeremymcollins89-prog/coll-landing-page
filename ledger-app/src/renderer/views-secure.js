'use strict';
/* =====================================================================
   Coll Ledger — lock screen, password settings and cloud backups
   ===================================================================== */
(() => {
  const { S, C, U, act, render, save } = App;
  const { $, esc, ICON } = U;

  // ------------------------------------------------------------------
  // Lock screen — at startup (decrypts the books) and after being idle
  // ------------------------------------------------------------------
  function showLock(atStart) {
    let el = $('#lock');
    if (!el) { el = document.createElement('div'); el.id = 'lock'; document.body.appendChild(el); }
    const header = atStart ? S.lockedFile.header : S.sec.header;
    const firm = (!atStart && S.data && S.data.firm && S.data.firm.name) || 'Coll Ledger';
    el.className = 'lock';
    el.innerHTML = `<form class="lock-card" id="lock-form" autocomplete="off">
      <img src="icon.png" alt="" class="setup-logo">
      <h1>${atStart ? 'Welcome back' : 'Locked'}</h1>
      <p class="muted">${atStart ? 'Your books are protected with a password.' : `${esc(firm)} was locked after a while without use.`}</p>
      <div class="field"><label for="lock-pw">Password</label><input type="password" class="input lg" id="lock-pw" autofocus></div>
      <div class="lock-err" id="lock-err" hidden></div>
      <button class="btn primary lg" type="submit" id="lock-go">${ICON.unlock}Unlock</button>
      <details class="more"><summary>Forgot it?</summary><div class="muted" style="margin-top:8px;line-height:1.55">${header.hint ? `Your hint: <b>${esc(header.hint)}</b><br>` : ''}You can also type your 24-character <b>recovery code</b> (it looks like ABCD-EFGH-…) in the password box.</div></details>
    </form>`;
    document.body.classList.add('locked');
    const form = $('#lock-form', el), inp = $('#lock-pw', el);
    setTimeout(() => inp.focus(), 50);
    form.onsubmit = async e => {
      e.preventDefault();
      const btn = $('#lock-go', el); btn.disabled = true; btn.textContent = 'Unlocking…';
      const res = await Secure.unlock(header, inp.value);
      if (!res) { btn.disabled = false; btn.innerHTML = ICON.unlock + 'Unlock'; const er = $('#lock-err', el); er.hidden = false; er.textContent = "That password doesn't match. Check Caps Lock and try again."; inp.select(); return; }
      if (atStart) {
        S.sec = { header, dek: res.dek, dekRaw: res.dekRaw };
        try { S.data = App.migrate(await Secure.decryptBooks(res.dek, S.lockedFile)); }
        catch (err) { const er = $('#lock-err', el); er.hidden = false; er.textContent = 'The books file could not be opened. Restore a backup from Settings.'; return; }
        S.lockedFile = null;
      }
      el.remove(); document.body.classList.remove('locked');
      lastActive = Date.now();
      if (atStart) App.afterLoad();
      if (res.byRecovery) setTimeout(() => newPasswordModal(true), 300);
    };
  }
  App.showLock = showLock;

  // idle lock
  let lastActive = Date.now();
  ['mousemove', 'keydown', 'mousedown', 'wheel', 'touchstart'].forEach(ev => window.addEventListener(ev, () => { lastActive = Date.now(); }, { passive: true }));
  setInterval(() => {
    if (!S.sec || !S.data || document.body.classList.contains('locked')) return;
    const mins = (S.data.security && S.data.security.idle) || 0;
    if (mins && Date.now() - lastActive > mins * 60000) { App.flush(); U.closeMenus(); showLock(false); }
  }, 20000);

  // ------------------------------------------------------------------
  // Turning the password on, changing it, turning it off
  // ------------------------------------------------------------------
  function codeModal(code) {
    const m = U.openModal(`${U.modalHead('Save your recovery code', 'If you ever forget the password, this code unlocks the books')}
      <div class="modal-body">
        <div class="code-box" id="rc">${esc(code)}</div>
        <div class="note">${ICON.alert}<span>Write it down or print it and keep it somewhere safe, away from the computer. <b>Without the password or this code, nobody — not even Coll Business Solutions — can open the books.</b></span></div>
        <label class="check"><input type="checkbox" id="rc-ok">I saved my recovery code</label>
      </div>
      <div class="modal-foot"><button class="btn" id="rc-copy">${ICON.copy}Copy</button><button class="btn" id="rc-print">${ICON.pdf}Save as PDF</button><button class="btn primary" id="rc-done" disabled>Done</button></div>`, { onClose: () => { } });
    $('#rc-ok', m).onchange = e => { $('#rc-done', m).disabled = !e.target.checked; };
    $('#rc-copy', m).onclick = () => U.copyText(code);
    $('#rc-print', m).onclick = () => U.printDoc(App.docShell('Recovery code', `<div style="padding-top:80px;text-align:center"><div class="serif" style="font-size:30px">Coll Ledger recovery code</div><div class="muted" style="margin:10px 0 40px">${esc(S.data.firm.name || '')} · created ${U.fmtDate(C.todayISO())}</div><div style="font-family:monospace;font-size:26px;letter-spacing:.08em;padding:24px;border:2px solid #16201C;border-radius:12px;display:inline-block">${esc(code)}</div><p class="muted" style="margin-top:40px;max-width:420px;margin-left:auto;margin-right:auto;line-height:1.6">Type this code in the password box on the Coll Ledger lock screen if you forget your password. Keep it somewhere safe.</p></div>`), 'Coll Ledger recovery code.pdf');
    $('#rc-done', m).onclick = () => U.closeModal();
  }
  function newPasswordModal(afterRecovery) {
    const turningOn = !S.sec;
    const m = U.openModal(`${U.modalHead(turningOn ? 'Protect the books with a password' : 'Choose a new password', afterRecovery ? 'You unlocked with the recovery code — pick a new password now.' : 'Everything — the books, backups and receipts — gets encrypted on this computer.')}
      <div class="modal-body">
        <div class="field"><label for="np1">New password</label><input type="password" class="input" id="np1" autofocus><div class="hint">At least 8 characters. A short sentence is easy to remember and hard to guess.</div></div>
        <div class="field"><label for="np2">Type it again</label><input type="password" class="input" id="np2"></div>
        <div class="field"><label for="nph">Hint (optional — shown on the lock screen)</label><input class="input" id="nph" value="${esc(S.sec ? S.sec.header.hint : '')}"></div>
      </div>
      <div class="modal-foot"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" id="np-go">${ICON.lock}${turningOn ? 'Turn on password' : 'Save new password'}</button></div>`);
    $('#np-go', m).onclick = async () => {
      const p1 = $('#np1', m).value, p2 = $('#np2', m).value, hint = $('#nph', m).value.trim();
      if (p1.length < 8) return U.toast('Use at least 8 characters', null, 'warn');
      if (p1 !== p2) return U.toast("The two passwords don't match", null, 'warn');
      if (hint && p1.toLowerCase().includes(hint.toLowerCase())) return U.toast("The hint can't contain the password", null, 'warn');
      $('#np-go', m).disabled = true;
      if (turningOn) {
        const { header, dek, dekRaw, code } = await Secure.create(p1, hint);
        S.sec = { header, dek, dekRaw };
        U.closeModal(); save(); await App.flush(); render();
        codeModal(code);
        U.toast('Password on — the books are encrypted');
      } else {
        S.sec.header = await Secure.rewrapPassword(S.sec.header, S.sec.dekRaw, p1, hint);
        U.closeModal(); save(); await App.flush(); render(); U.toast('Password changed');
      }
    };
  }
  async function confirmPassword(title) {
    return new Promise(resolve => {
      let ok = false;
      const m = U.openModal(`${U.modalHead(title)}<div class="modal-body"><div class="field"><label for="cp">Current password</label><input type="password" class="input" id="cp" autofocus></div></div><div class="modal-foot"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" id="cp-go">Continue</button></div>`, { onClose: () => { if (!ok) resolve(false); } });
      const go = async () => { const r = await Secure.unlock(S.sec.header, $('#cp', m).value); if (!r) return U.toast("That password doesn't match", null, 'warn'); ok = true; U.closeModal(); resolve(true); };
      $('#cp-go', m).onclick = go; $('#cp', m).onkeydown = e => { if (e.key === 'Enter') go(); };
    });
  }

  // ------------------------------------------------------------------
  // Settings card
  // ------------------------------------------------------------------
  App.securityCard = () => {
    const on = !!S.sec;
    const idle = (S.data.security && S.data.security.idle) || 0;
    return `<div class="card"><div class="card-head"><h3>Protection & backups</h3><span class="muted">${on ? `${ICON.lock} Password on` : 'No password'}</span></div><div class="card-body stack-sm">
      <div class="sec-row"><div class="sec-ic ${on ? 'on' : ''}">${ICON.lock}</div><div class="grow"><b>Password lock</b><div class="muted">${on ? 'The books, every backup and every receipt are encrypted. You need the password (or recovery code) to open them.' : 'Encrypt the books so nobody can read your clients\' finances without your password.'}</div></div>
        ${on ? `<button class="btn sm" data-action="sec-change">Change</button><button class="btn sm ghost" data-action="sec-off">Turn off</button>` : `<button class="btn sm primary" data-action="sec-on">Turn on</button>`}</div>
      ${on ? `<div class="sec-row"><div class="sec-ic">${ICON.calendar}</div><div class="grow"><b>Lock when I step away</b><div class="muted">Asks for the password after this long without use.</div></div><select class="input sm" style="width:140px" data-change="sec-idle">${[[5, '5 minutes'], [15, '15 minutes'], [30, '30 minutes'], [60, '1 hour'], [0, 'Never']].map(([v, l]) => `<option value="${v}" ${idle === v ? 'selected' : ''}>${l}</option>`).join('')}</select><button class="btn sm" data-action="sec-lock">Lock now</button></div>` : ''}
      ${window.desktop ? `<div class="sec-row" id="cloud-row"><div class="sec-ic">${ICON.upload}</div><div class="grow"><b>Automatic cloud backup</b><div class="muted" id="cloud-status">Checking…</div></div><span id="cloud-btns"></span></div>` : ''}
    </div></div>`;
  };
  App.hooks.push((c, page) => {
    if (page !== 'settings' || !window.desktop) return;
    window.desktop.backupStatus().then(st => {
      const s = $('#cloud-status'), b = $('#cloud-btns'); if (!s) return;
      if (st.folder) {
        s.innerHTML = `Every save is copied to <b>${esc(st.folder)}</b>${st.last ? ` · last copied ${new Date(st.last).toLocaleString()}` : ''}${st.error ? `<br><span class="neg">Last copy failed: ${esc(st.error)}</span>` : ''}${S.sec ? '' : '<br><span class="gold-ink">Tip: turn on the password so the cloud copies are encrypted too.</span>'}`;
        b.innerHTML = `<button class="btn sm" data-action="cloud-open">Open</button><button class="btn sm" data-action="cloud-choose">Change</button><button class="btn sm ghost" data-action="cloud-off">Stop</button>`;
      } else {
        s.innerHTML = 'Pick your OneDrive, Google Drive or Dropbox folder and every save is copied there automatically, with 30 days of history. If the computer dies, nothing is lost.';
        b.innerHTML = `<button class="btn sm primary" data-action="cloud-choose">Choose folder</button>`;
      }
    });
  });
  act({
    'sec-on': () => newPasswordModal(false),
    'sec-change': async () => { if (await confirmPassword('Change the password')) newPasswordModal(false); },
    'sec-off': async () => {
      if (!await confirmPassword('Turn off the password')) return;
      if (!await U.confirmBox({ title: 'Turn off encryption?', body: 'The books and future backups will be saved without encryption. Anyone with access to this computer or the backup folder could read them.', ok: 'Turn off', danger: true })) return;
      S.sec = null; save(); await App.flush(); render(); U.toast('Password turned off');
    },
    'sec-lock': () => { App.flush(); showLock(false); },
    'change:sec-idle': el => { S.data.security.idle = +el.value; save(); U.toast(+el.value ? 'Saved' : 'Auto-lock off'); },
    'cloud-choose': async () => { const f = await window.desktop.chooseBackupFolder(); if (f) { U.toast('Backups now go to ' + f.split(/[\\/]/).pop()); render(); } },
    'cloud-off': async () => { if (!await U.confirmBox({ title: 'Stop cloud backups?', body: 'Copies already in the folder stay there. New saves will only be backed up on this computer.', ok: 'Stop' })) return; await window.desktop.clearBackupFolder(); render(); },
    'cloud-open': () => window.desktop.openBackupFolder()
  });

  // Gentle reminder on the clients screen until a backup folder is chosen
  App.hooks.push((c, page) => {
    if (page !== 'clients' || !window.desktop || !S.data.clients.some(x => !x.practice)) return;
    window.desktop.backupStatus().then(st => {
      if (st.folder || S.data.security.backupNudgeOff) return;
      const inner = $('#view .view-inner'); if (!inner || $('#backup-nudge')) return;
      const n = document.createElement('div'); n.id = 'backup-nudge'; n.className = 'practice-banner';
      n.innerHTML = `${ICON.alert}<span><b>Your books are only on this computer.</b> Turn on automatic cloud backup so a broken laptop never costs a client's records.</span><button class="btn sm primary" data-action="cloud-choose">Set up backup</button><button class="btn sm ghost" data-action="nudge-off">Later</button>`;
      inner.querySelector('.page-head').after(n);
    });
  });
  act({ 'nudge-off': () => { S.data.security.backupNudgeOff = true; save(); const n = $('#backup-nudge'); if (n) n.remove(); } });

  // ------------------------------------------------------------------
  // Receipts and attachments (encrypted when the password is on)
  // ------------------------------------------------------------------
  const MAX = 15 * 1024 * 1024;
  async function addAttachments(target) {
    if (!window.desktop) return U.toast('Receipts can be attached in the desktop app', null, 'warn');
    const files = await U.pickFiles('.pdf,.png,.jpg,.jpeg,.heic,.webp,.gif,.csv,.xlsx,.docx,.txt', true);
    if (!files.length) return 0;
    target.attachments = target.attachments || [];
    for (const f of files) await storeFile(target, f.name, f.buffer, true);
    save();
    return files.length;
  }
  async function storeFile(target, name, buffer, quiet) {
    if (!window.desktop) return false;
    if (buffer.byteLength > MAX) { U.toast(`${name} is over 15 MB — skipped`, null, 'warn'); return false; }
    target.attachments = target.attachments || [];
    const id = C.uid();
    let bytes = new Uint8Array(buffer);
    if (S.sec) bytes = await Secure.encryptBytes(S.sec.dek, bytes);
    await window.desktop.saveAttachment(id, Secure.b64(bytes));
    target.attachments.push({ id, name, size: buffer.byteLength, enc: !!S.sec, added: C.todayISO() });
    if (!quiet) save();
    return true;
  }
  const mimeOf = n => ({ pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', txt: 'text/plain', csv: 'text/plain' })[String(n).split('.').pop().toLowerCase()] || 'application/octet-stream';
  async function readAttachment(a) {
    const b = await window.desktop.readAttachment(a.id);
    if (!b) return null;
    let bytes = Secure.unb64(b);
    if (a.enc) { if (!S.sec) return null; bytes = await Secure.decryptBytes(S.sec.dek, bytes); }
    return bytes;
  }
  async function viewAttachment(a) {
    const bytes = await readAttachment(a);
    if (!bytes) return U.toast("That file couldn't be opened", null, 'warn');
    const mime = mimeOf(a.name);
    const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
    const canShow = /^image\//.test(mime) || mime === 'application/pdf' || mime === 'text/plain';
    const m = U.openModal(`${U.modalHead(a.name, `Added ${U.fmtDate(a.added)}`)}<div class="modal-body">${canShow ? (/^image/.test(mime) ? `<img src="${url}" alt="" class="att-img">` : `<iframe src="${url}" class="att-frame" title="${esc(a.name)}"></iframe>`) : '<div class="muted">This kind of file can\'t be previewed here. Save a copy to open it.</div>'}</div>
      <div class="modal-foot"><button class="btn" id="att-save">${ICON.download}Save a copy</button><button class="btn primary" data-action="close-modal">Close</button></div>`, { wide: true, onClose: () => URL.revokeObjectURL(url) });
    $('#att-save', m).onclick = () => window.desktop.saveFile({ defaultName: a.name, base64: Secure.b64(bytes) }).then(p => p && U.toast('Saved'));
  }
  async function removeAttachment(target, id) {
    target.attachments = (target.attachments || []).filter(a => a.id !== id);
    if (window.desktop) await window.desktop.deleteAttachment(id);
    save();
  }
  // a small strip of attached files with add/remove, for use inside any window
  function attachStrip(target, rerender) {
    const list = target.attachments || [];
    return `<div class="att-strip"><div class="label-row"><label>Receipts & files</label>${window.desktop ? `<a href="#" class="link" data-att-add>${ICON.plus} Attach</a>` : ''}</div>
      <div class="att-list">${list.length ? list.map(a => `<span class="att-chip"><a href="#" data-att-view="${a.id}">${ICON.file}${esc(a.name)}</a><button data-att-rm="${a.id}" aria-label="Remove ${esc(a.name)}">${ICON.close}</button></span>`).join('') : `<span class="muted">${window.desktop ? 'Nothing attached yet — add a receipt photo or PDF.' : 'Receipts can be attached in the desktop app.'}</span>`}</div></div>`;
  }
  function wireStrip(root, target, redraw) {
    const add = root.querySelector('[data-att-add]');
    if (add) add.onclick = async e => { e.preventDefault(); if (await addAttachments(target)) redraw(); };
    root.querySelectorAll('[data-att-view]').forEach(a => a.onclick = e => { e.preventDefault(); const x = target.attachments.find(y => y.id === a.dataset.attView); if (x) viewAttachment(x); });
    root.querySelectorAll('[data-att-rm]').forEach(b => b.onclick = async e => { e.preventDefault(); if (!await U.confirmBox({ title: 'Remove this file?', body: 'The attached file will be deleted.', ok: 'Remove', danger: true })) return; await removeAttachment(target, b.dataset.attRm); redraw(); });
  }
  App.attach = { attachStrip, wireStrip, addAttachments, viewAttachment, storeFile };
})();
