'use strict';
/* =====================================================================
   Coll Ledger — first-run setup, clients, settings, then start the app
   ===================================================================== */
(() => {
  const { S, C, U, client, view, act, actions, go, render, commit, save, snapshot } = App;
  const { $, $$, esc, ICON, plural } = U;
  const today = App.today;

  // ------------------------------------------------------------------
  // First run — two friendly steps
  // ------------------------------------------------------------------
  let setupStep = 1;
  view('setup', {
    render() {
      const f = S.data.firm;
      if (setupStep === 1) return `
        <div class="setup">
          <div class="setup-card card">
            <img src="icon.png" alt="" class="setup-logo">
            <div class="setup-steps"><span class="on"></span><span></span></div>
            <h1>Welcome to Coll Ledger</h1>
            <p>Your own bookkeeping studio — every client in one place. Let's get you set up. It takes about a minute.</p>
            <div class="field"><label for="su-owner">Your name</label><input class="input lg" id="su-owner" value="${esc(f.owner)}" placeholder="First and last name" autofocus></div>
            <div class="field"><label for="su-name">Your bookkeeping business name</label><input class="input lg" id="su-name" value="${esc(f.name)}" placeholder="e.g. Summit Bookkeeping"><div class="hint">It goes on the reports you send clients. You can change it any time.</div></div>
            <div class="field"><label for="su-email">Your email (optional)</label><input class="input lg" id="su-email" value="${esc(f.email)}" placeholder="you@example.com"></div>
            <button class="btn primary lg" data-action="setup-next">Continue ${ICON.right}</button>
          </div>
        </div>`;
      return `
        <div class="setup">
          <div class="setup-card card wide">
            <div class="setup-steps"><span class="on"></span><span class="on"></span></div>
            <h1>Nice to meet you${f.owner ? ', ' + esc(f.owner.split(' ')[0]) : ''}</h1>
            <p>How would you like to start?</p>
            <div class="choice-grid">
              <button class="choice" data-action="setup-client"><span class="choice-ic">${ICON.plus}</span><b>Add my first client</b><span class="muted">Set up a real business you keep books for.</span></button>
              <button class="choice" data-action="setup-demo"><span class="choice-ic gold">${ICON.spark}</span><b>Explore with sample clients</b><span class="muted">A café and a landscaping company with a year of activity. Delete them any time.</span></button>
            </div>
            <button class="btn ghost" data-action="setup-back">${ICON.back}Back</button>
          </div>
        </div>`;
    }
  });
  act({
    'setup-next': () => {
      const owner = $('#su-owner').value.trim(), name = $('#su-name').value.trim();
      if (!owner) { $('#su-owner').focus(); return U.toast('Add your name', null, 'warn'); }
      Object.assign(S.data.firm, { owner, name: name || owner.split(' ')[0] + "'s Bookkeeping", email: $('#su-email').value.trim() });
      setupStep = 2; save(); render();
    },
    'setup-back': () => { setupStep = 1; render(); },
    'setup-client': () => newClientModal(true),
    'setup-demo': () => {
      const demo = C.demoClients();
      S.data.clients.push(...demo);
      S.data.activeClientId = demo[0].id;
      S.data.setupDone = true;
      save(); go('clients');
      U.toast('Two sample clients added — click one to look around');
    }
  });

  // ------------------------------------------------------------------
  // Add a client
  // ------------------------------------------------------------------
  const INDUSTRY_STARTERS = {
    'Services & consulting': ['Service Revenue'],
    'Retail & e-commerce': ['Sales', 'Cost of Goods Sold'],
    'Restaurant & café': ['Sales', 'Cost of Goods Sold'],
    'Construction & trades': ['Service Revenue', 'Cost of Goods Sold'],
    'Health & wellness': ['Service Revenue'],
    'Nonprofit': ['Donations'],
    'Other': []
  };
  function newClientModal(fromSetup) {
    const y = new Date().getFullYear();
    const m = U.openModal(`${U.modalHead('Add a client', 'You can fill in more details later in Settings')}
      <div class="modal-body">
        <div class="grid2">
          <div class="field span2"><label for="n-name">Business name</label><input class="input lg" id="n-name" placeholder="e.g. Blue Spruce Bakery" autofocus></div>
          <div class="field"><label for="n-ind">Kind of business</label><select class="input" id="n-ind">${Object.keys(INDUSTRY_STARTERS).map(k => `<option>${k}</option>`).join('')}</select></div>
          <div class="field"><label for="n-start">Start the books on</label><input type="date" class="input" id="n-start" value="${y}-01-01"><div class="hint">Usually January 1, or the day you take over.</div></div>
        </div>
        <details class="more"><summary>Starting balances (optional — from the statements on that date)</summary>
          <div class="grid3" style="margin-top:12px">
            <div class="field"><label for="n-chk">Checking</label><div class="amt-wrap"><span>$</span><input class="input" id="n-chk" placeholder="0.00"></div></div>
            <div class="field"><label for="n-sav">Savings</label><div class="amt-wrap"><span>$</span><input class="input" id="n-sav" placeholder="0.00"></div></div>
            <div class="field"><label for="n-cc">Credit card owed</label><div class="amt-wrap"><span>$</span><input class="input" id="n-cc" placeholder="0.00"></div></div>
          </div>
        </details>
        <div class="field"><label>Color</label><div class="swatches" id="n-col">${C.CLIENT_COLORS.map((col, i) => `<button class="swatch ${i === S.data.clients.length % 8 ? 'on' : ''}" style="background:${col}" data-v="${col}" aria-label="Color ${i + 1}"></button>`).join('')}</div></div>
        <div class="note">${ICON.spark}<span>Coming from QuickBooks? Create the client, then use <b>Import</b> to bring over the chart of accounts, contacts and transactions.</span></div>
      </div>
      <div class="modal-foot"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" id="n-go">${ICON.check}Create client</button></div>`);
    $$('#n-col .swatch', m).forEach(s => s.onclick = e => { e.preventDefault(); $$('#n-col .swatch', m).forEach(x => x.classList.toggle('on', x === s)); });
    $('#n-go', m).onclick = () => {
      const name = $('#n-name', m).value.trim(); if (!name) { $('#n-name', m).focus(); return U.toast('Add the business name', null, 'warn'); }
      if (S.data.clients.some(c => C.normName(c.name) === C.normName(name))) return U.toast(`${name} is already a client`, null, 'warn');
      const ind = $('#n-ind', m).value;
      const c = C.newClient({ name, industry: ind === 'Other' ? '' : ind, startDate: $('#n-start', m).value || `${y}-01-01`, color: $('#n-col .swatch.on', m).dataset.v, invoicePrefix: (U.initials(name) || 'INV') + '-' });
      if (ind === 'Nonprofit') C.ensureAccount(c, { name: 'Donations', type: 'income', sub: 'income', code: '4050' });
      C.acctByName(c, 'Business Checking').opening = C.parseAmount($('#n-chk', m).value) || 0;
      C.acctByName(c, 'Business Savings').opening = C.parseAmount($('#n-sav', m).value) || 0;
      C.acctByName(c, 'Business Credit Card').opening = C.parseAmount($('#n-cc', m).value) || 0;
      S.data.clients.push(c); S.data.activeClientId = c.id;
      if (fromSetup) S.data.setupDone = true;
      U.closeModal(); save(); App.switchClient(c.id, 'dashboard'); U.toast(`${name} is ready`);
    };
  }
  App.newClientModal = newClientModal;

  function clientMenu(anchor) {
    const m = U.openMenu(anchor, `
      <div class="mi" data-switch="__all">${ICON.home}<span style="flex:1">All clients</span></div><div class="sep"></div>
      ${S.data.clients.map(c => { const n = App.reviewCount(c); return `<div class="mi" data-switch="${c.id}"><div class="avatar xs" style="background:${c.color}">${esc(U.initials(c.name))}</div><div style="flex:1;min-width:0"><div class="ellip" style="font-weight:600">${esc(c.name)}</div><div class="muted">${esc(c.industry || 'Client')}</div></div>${n ? `<span class="pill">${n}</span>` : ''}${c.id === S.data.activeClientId ? ICON.check : ''}</div>`; }).join('')}
      <div class="sep"></div><div class="mi" data-switch="__new">${ICON.plus}<span>Add a client</span></div>`, { width: Math.max(280, anchor.offsetWidth) });
    m.onclick = e => {
      const it = e.target.closest('[data-switch]'); if (!it) return;
      U.closeMenus();
      if (it.dataset.switch === '__new') return newClientModal();
      if (it.dataset.switch === '__all') return go('clients');
      App.switchClient(it.dataset.switch);
    };
  }
  act({
    'open-client-menu': el => { if (!S.data.clients.length) return newClientModal(); clientMenu(el); },
    'new-client': () => newClientModal(),
    'quick-add': el => {
      const c = client(); if (!c) return newClientModal();
      const m = U.openMenu(el, `
        <div class="mi" data-q="txn">${ICON.plus}<span style="flex:1">Transaction</span><span class="kbd">N</span></div>
        <div class="mi" data-q="inv">${ICON.file}<span style="flex:1">Invoice</span><span class="kbd">I</span></div>
        <div class="mi" data-q="contact">${ICON.people}<span style="flex:1">Customer or vendor</span></div>
        <div class="mi" data-q="import">${ICON.upload}<span style="flex:1">Import a file</span></div>
        <div class="sep"></div><div class="mi" data-q="client">${ICON.plus}<span style="flex:1">New client</span></div>`, { align: 'right', width: 250 });
      m.onclick = e => { const q = e.target.closest('[data-q]'); if (!q) return; U.closeMenus(); ({ txn: () => actions['new-txn'](), inv: () => actions['new-invoice'](), contact: () => actions['new-contact'](), import: () => go('import'), client: () => newClientModal() })[q.dataset.q](); };
    }
  });

  // ------------------------------------------------------------------
  // Settings
  // ------------------------------------------------------------------
  view('settings', {
    render(c) {
      const f = S.data.firm;
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      return `
        <div class="page-head"><div><h1>Settings</h1><div class="sub">Changes save as you type.</div></div></div>
        <div class="settings-grid">
          ${c ? `<div class="card"><div class="card-head"><h3>${esc(c.name)}</h3><span class="muted">Client profile</span></div><div class="card-body"><div class="grid2">
            <div class="field"><label for="cs-name">Name you use</label><input class="input" id="cs-name" data-cset="name" value="${esc(c.name)}"></div>
            <div class="field"><label for="cs-legal">Legal name (on invoices & reports)</label><input class="input" id="cs-legal" data-cset="legalName" value="${esc(c.legalName)}"></div>
            <div class="field"><label for="cs-ind">Kind of business</label><input class="input" id="cs-ind" data-cset="industry" value="${esc(c.industry)}"></div>
            <div class="field"><label for="cs-ein">EIN / tax ID</label><input class="input" id="cs-ein" data-cset="ein" value="${esc(c.ein || '')}"></div>
            <div class="field"><label for="cs-email">Email</label><input class="input" id="cs-email" data-cset="email" value="${esc(c.email)}"></div>
            <div class="field"><label for="cs-phone">Phone</label><input class="input" id="cs-phone" data-cset="phone" value="${esc(c.phone)}"></div>
            <div class="field span2"><label for="cs-addr">Address (shown on invoices)</label><textarea class="input" id="cs-addr" data-cset="address" rows="2">${esc(c.address)}</textarea></div>
            <div class="field"><label for="cs-fy">Business year starts in</label><select class="input" id="cs-fy" data-cset="fyStartMonth">${months.map((mn, i) => `<option value="${i + 1}" ${c.fyStartMonth === i + 1 ? 'selected' : ''}>${mn}</option>`).join('')}</select></div>
            <div class="field"><label for="cs-start">Books start on</label><input type="date" class="input" id="cs-start" data-cset="startDate" value="${c.startDate}"></div>
          </div></div></div>` : ''}
          <div class="stack">
            <div class="card"><div class="card-head"><h3>Your studio</h3><span class="muted">Shown on client packages</span></div><div class="card-body"><div class="grid2">
              <div class="field span2"><label for="fs-name">Business name</label><input class="input" id="fs-name" data-fset="name" value="${esc(f.name)}"></div>
              <div class="field"><label for="fs-owner">Your name</label><input class="input" id="fs-owner" data-fset="owner" value="${esc(f.owner)}"></div>
              <div class="field"><label for="fs-email">Email</label><input class="input" id="fs-email" data-fset="email" value="${esc(f.email)}"></div>
            </div></div></div>
            ${c ? `<div class="card"><div class="card-head"><h3>Invoices for ${esc(c.name)}</h3></div><div class="card-body"><div class="grid2">
              <div class="field"><label for="cs-pre">Number starts with</label><input class="input" id="cs-pre" data-cset="invoicePrefix" value="${esc(c.invoicePrefix)}"></div>
              <div class="field"><label for="cs-next">Next number</label><input class="input" id="cs-next" data-cset="nextInvoice" value="${c.nextInvoice}" inputmode="numeric"></div>
              <div class="field"><label for="cs-terms">Due in (days)</label><input class="input" id="cs-terms" data-cset="defaultTerms" value="${c.defaultTerms}" inputmode="numeric"></div>
              <div class="field"><label for="cs-tax">Sales tax %</label><input class="input" id="cs-tax" data-cset="defaultTaxRate" value="${c.defaultTaxRate || 0}" inputmode="decimal"></div>
              <div class="field span2"><label for="cs-note">Default message</label><input class="input" id="cs-note" data-cset="invoiceNote" value="${esc(c.invoiceNote || 'Thank you for your business!')}"></div>
              <div class="field span2"><label>Color</label><div class="swatches">${C.CLIENT_COLORS.map(col => `<button class="swatch ${c.color === col ? 'on' : ''}" style="background:${col}" data-action="client-color" data-v="${col}" aria-label="Use this color"></button>`).join('')}</div></div>
            </div></div></div>` : ''}
            ${App.securityCard ? App.securityCard() : ''}
            <div class="card"><div class="card-head"><h3>Look</h3></div><div class="card-body"><div class="seg">${[['system', 'Match my computer'], ['light', 'Light'], ['dark', 'Dark']].map(([k, l]) => `<button class="${(S.data.theme || 'system') === k ? 'on' : ''}" data-action="theme" data-v="${k}">${l}</button>`).join('')}</div></div></div>
            <div class="card"><div class="card-head"><h3>Your data</h3></div><div class="card-body stack-sm">
              <div class="muted" style="line-height:1.6">Everything is saved on this computer as you work${window.desktop ? ', and a backup is kept for each of the last 30 days' : ''}. Export a backup now and then to keep a copy somewhere safe, like a USB drive or cloud folder.</div>
              <div class="btn-row">
                <button class="btn" data-action="backup">${ICON.download}Export backup</button>
                <button class="btn" data-action="restore">${ICON.upload}Restore a backup</button>
                ${window.desktop ? `<button class="btn ghost" data-action="open-data">Open backups folder</button>` : ''}
              </div>
              <div class="btn-row divider">
                <button class="btn" data-action="new-client">${ICON.plus}Add client</button>
                <button class="btn ghost" data-action="load-demo">${ICON.spark}Add sample clients</button>
                ${c ? `<button class="btn danger ghost" data-action="delete-client">${ICON.trash}Delete ${esc(c.name)}</button>` : ''}
              </div>
              <div class="muted" id="app-ver"></div>
            </div></div>
          </div>
        </div>`;
    },
    after() { if (window.desktop) window.desktop.info().then(i => { const el = $('#app-ver'); if (el) el.textContent = `Coll Ledger ${i.version} · Coll Business Solutions LLC`; }); }
  });

  const setTimers = new Map();
  act({
    'theme': el => { S.data.theme = el.dataset.v; commit(); },
    'client-color': el => { client().color = el.dataset.v; commit(); },
    'backup': () => U.downloadText(`Coll Ledger backup ${today()}.json`, JSON.stringify(S.data, null, 1), 'application/json', 'json'),
    'restore': async () => {
      const [f] = await U.pickFiles('.json'); if (!f) return;
      let d; try { d = JSON.parse(f.text); } catch (e) { return U.toast("That file isn't a Coll Ledger backup", null, 'warn'); }
      if (!d || !Array.isArray(d.clients)) return U.toast("That file isn't a Coll Ledger backup", null, 'warn');
      if (!await U.confirmBox({ title: 'Restore this backup?', body: `This replaces everything in Coll Ledger with <b>${esc(f.name)}</b> (${plural(d.clients.length, 'client')}). Export a backup of what's here first if you might want it.`, ok: 'Restore', danger: true })) return;
      S.data = App.migrate(d); S.data.setupDone = true; commit(); go(d.clients.length > 1 ? 'clients' : 'dashboard'); U.toast('Backup restored');
    },
    'open-data': () => window.desktop && window.desktop.openDataFolder(),
    'load-demo': () => { const demo = C.demoClients(); S.data.clients.push(...demo); S.data.activeClientId = demo[0].id; S.data.setupDone = true; save(); go('clients'); U.toast('Two sample clients added'); },
    'delete-client': async () => {
      const c = client();
      const m = U.openModal(`${U.modalHead(`Delete ${c.name}?`)}<div class="modal-body"><p style="margin:0;line-height:1.6;color:var(--ink-2)">All of ${esc(c.name)}'s transactions, invoices and reports will be removed. Type the client's name to confirm.</p><input class="input" id="del-name" placeholder="${esc(c.name)}" autofocus></div><div class="modal-foot"><button class="btn" data-action="close-modal">Cancel</button><button class="btn danger-fill" id="del-go" disabled>Delete client</button></div>`);
      $('#del-name', m).oninput = e => { $('#del-go', m).disabled = C.normName(e.target.value) !== C.normName(c.name); };
      $('#del-go', m).onclick = () => {
        const snapshotAll = JSON.stringify(S.data.clients);
        S.data.clients = S.data.clients.filter(x => x.id !== c.id);
        S.data.activeClientId = S.data.clients[0] ? S.data.clients[0].id : null;
        U.closeModal(); commit(); go('clients');
        U.toast(`${c.name} deleted`, () => { S.data.clients = JSON.parse(snapshotAll); S.data.activeClientId = c.id; commit(); go('dashboard'); });
      };
    }
  });
  document.addEventListener('input', e => {
    const el = e.target;
    if (!el.dataset.cset && !el.dataset.fset) return;
    clearTimeout(setTimers.get(el));
    setTimers.set(el, setTimeout(() => {
      const c = client();
      if (el.dataset.fset) { S.data.firm[el.dataset.fset] = el.value; save(); App.renderChrome(); return; }
      if (!c) return;
      const key = el.dataset.cset; let v = el.value;
      if (['fyStartMonth', 'nextInvoice', 'defaultTerms'].includes(key)) { v = parseInt(v, 10); if (!(v >= 0)) return; }
      if (key === 'defaultTaxRate') v = Math.abs(parseFloat(v) || 0);
      if (key === 'name' && !v.trim()) return;
      if (key === 'startDate' && !v) return;
      c[key] = v; save(); App.renderChrome();
    }, 300));
  });
  document.addEventListener('change', e => { if (e.target.dataset.cset === 'fyStartMonth' || e.target.dataset.cset === 'startDate') e.target.dispatchEvent(new Event('input', { bubbles: true })); });

  App.boot();
})();
