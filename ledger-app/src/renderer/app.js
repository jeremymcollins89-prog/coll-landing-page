'use strict';
/* =====================================================================
   Coll Ledger — app shell
   State, saving, navigation, sidebar, keyboard shortcuts, command
   palette, help, drag-and-drop, updates. Screens live in views-*.js
   and register themselves with App.view() and App.act().
   ===================================================================== */
const App = (() => {
  const C = Core, U = UI;
  const { $, $$, esc, ICON } = U;
  const today = () => C.todayISO();

  const S = {
    data: null,
    route: { page: 'dashboard', params: {} },
    ui: {
      txn: { account: 'all', period: 'last-12', type: 'all', q: '', category: '', selected: new Set() },
      inv: { filter: 'all' },
      contacts: { kind: 'customer' },
      report: { type: 'pl', period: 'ytd', asOf: C.todayISO() },
      recon: null,
      close: { month: null },
      reviewFocus: 0
    },
    update: null
  };
  const client = () => (S.data && S.data.clients.find(c => c.id === S.data.activeClientId)) || null;
  const views = {}, actions = {}, hooks = [], onLoad = [];
  const view = (name, def) => { views[name] = def; };
  const act = obj => Object.assign(actions, obj);

  // ---------------- saving ----------------
  const LS_KEY = 'coll-ledger-data-v1';
  async function load() {
    let d = null;
    try {
      if (window.desktop) d = await window.desktop.load();
      else { const raw = localStorage.getItem(LS_KEY); if (raw) d = JSON.parse(raw); }
    } catch (e) { console.warn('load failed', e); }
    if (Secure.isEncrypted(d)) { S.lockedFile = d; return false; }
    S.data = migrate(d || C.newData());
    return true;
  }
  // Older books get any fields newer versions expect
  function migrate(d) {
    d.version = 2;
    d.firm = Object.assign({ name: '', owner: '', email: '', phone: '' }, d.firm || {});
    if (d.setupDone == null) d.setupDone = !!(d.clients && d.clients.length);
    for (const c of d.clients || []) {
      c.contacts = c.contacts || []; c.rules = c.rules || []; c.reconciliations = c.reconciliations || []; c.invoices = c.invoices || [];
      c.closes = c.closes || []; c.imports = c.imports || []; c.lockDate = c.lockDate || null; c.checklistDismissed = !!c.checklistDismissed;
      for (const a of c.accounts) if (a.sub === 'clearing' && a.type !== 'asset') a.type = 'asset';
      c.bills = c.bills || []; c.recurring = c.recurring || [];
      c.budgets = c.budgets || {}; c.trips = c.trips || []; c.todos = c.todos || []; c.notes = c.notes || ''; c.cleanupOk = c.cleanupOk || [];
      c.estTax = Object.assign({ pct: 25, paid: {} }, c.estTax || {});
      if (!C.acctByKey(c, 'ap')) C.ensureAP(c);
    }
    d.studio = d.studio || { customers: [], time: [], invoices: [], nextInvoice: 1001, prefix: 'S-', rate: 50 };
    d.security = d.security || { idle: 15 };
    return d;
  }
  let saveTimer = null, dirty = false;
  function save() {
    dirty = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 300);
  }
  async function flush() {
    if (!dirty || !S.data) return;
    dirty = false;
    const raw = S.sec ? await Secure.encryptBooks(S.sec.header, S.sec.dek, S.data) : JSON.stringify(S.data);
    try {
      if (window.desktop) await window.desktop.save(raw);
      else localStorage.setItem(LS_KEY, raw);
    } catch (e) { console.warn('save failed', e); U.toast('Could not save — check that the disk has space', null, 'warn'); }
  }
  window.addEventListener('beforeunload', () => {
    if (!dirty || S.sec || !S.data) return;
    const raw = JSON.stringify(S.data);
    try { if (window.desktop) window.desktop.saveSync(raw); else localStorage.setItem(LS_KEY, raw); } catch (e) { }
  });
  function commit(rerender = true) { save(); if (rerender) render(); }

  // Undo for anything: snapshot the client before a change, restore on Undo
  function snapshot(c = client()) {
    const id = c.id, json = JSON.stringify(c);
    return () => {
      const i = S.data.clients.findIndex(x => x.id === id);
      if (i >= 0) S.data.clients[i] = JSON.parse(json);
      commit();
    };
  }

  // Closed months: changes on or before the lock date ask first
  async function guardLock(c, ...dates) {
    const hit = dates.filter(Boolean).some(d => C.isLocked(c, d));
    if (!hit) return true;
    return U.confirmBox({
      title: 'That month is closed',
      body: `${esc(c.name)}'s books are closed through <b>${U.fmtDate(c.lockDate)}</b>, so reports you already sent stay the same. Change it anyway?`,
      ok: 'Change anyway'
    });
  }

  // ---------------- navigation ----------------
  const NAV = [
    { label: null, items: [['clients', 'All clients', 'home'], ['studio', 'My studio', 'studio']] },
    { label: 'Overview', items: [['dashboard', 'Dashboard', 'dash'], ['planning', 'Planning', 'plan']] },
    { label: 'Daily work', items: [['review', 'To Review', 'inbox'], ['transactions', 'Transactions', 'swap'], ['invoices', 'Invoices', 'file'], ['bills', 'Bills', 'bill'], ['mileage', 'Mileage', 'car'], ['contacts', 'Customers & Vendors', 'people'], ['import', 'Import', 'upload']] },
    { label: 'Month end', items: [['reconcile', 'Reconcile', 'check'], ['cleanup', 'Clean up', 'broom'], ['close', 'Close the month', 'lock'], ['reports', 'Reports', 'report']] },
    { label: 'Setup', items: [['accounts', 'Chart of Accounts', 'list'], ['rules', 'Smart Rules', 'bolt']] }
  ];
  const NAV_ICON = {
    plan: '<svg viewBox="0 0 24 24"><path d="m3.5 18.5 6-6 4 4L22 6.9 20.6 5.5l-7.1 8-4-4L2 17z"/></svg>',
    car: '<svg viewBox="0 0 24 24"><path d="M18.9 6a1.5 1.5 0 0 0-1.4-1h-11a1.5 1.5 0 0 0-1.4 1L3 12v8a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1h12v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-8zM6.5 16A1.5 1.5 0 1 1 8 14.5 1.5 1.5 0 0 1 6.5 16m11 0a1.5 1.5 0 1 1 1.5-1.5 1.5 1.5 0 0 1-1.5 1.5M5 11l1.5-4.5h11L19 11z"/></svg>',
    broom: '<svg viewBox="0 0 24 24"><path d="m19.4 3-6.3 6.3-1.4-1.4-1.4 1.4 1.4 1.4L4 18.4V21h2.6l7.7-7.7 1.4 1.4 1.4-1.4-1.4-1.4L22 5.6zM9 21l1-3 3 1z"/><path d="M3 13h4v2H3zm2-4h4v2H5z"/></svg>',
    home: ICON.home, dash: '<svg viewBox="0 0 24 24"><path d="M3 13h8V3H3zm10 8h8V11h-8zM3 21h8v-6H3zm10-18v6h8V3z"/></svg>',
    inbox: '<svg viewBox="0 0 24 24"><path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2m0 12h-4a3 3 0 0 1-6 0H5V5h14z"/></svg>',
    swap: '<svg viewBox="0 0 24 24"><path d="M7 7h11l-3-3 1.4-1.4L22.8 9l-6.4 6.4L15 14l3-3H7zm10 10H6l3 3-1.4 1.4L1.2 15l6.4-6.4L9 10l-3 3h11z"/></svg>',
    file: ICON.file, people: ICON.people, upload: ICON.upload, check: ICON.check, lock: ICON.lock, report: ICON.report,
    list: '<svg viewBox="0 0 24 24"><path d="M3 5h18v2H3zm0 6h18v2H3zm0 6h12v2H3z"/></svg>', bolt: ICON.bolt,
    bill: '<svg viewBox="0 0 24 24"><path d="M18 2H6a2 2 0 0 0-2 2v18l3-2 3 2 2-1.5L14 22l3-2 3 2V4a2 2 0 0 0-2-2m-2 13H8v-2h8zm0-4H8V9h8zm0-4H8V5h8z"/></svg>',
    studio: '<svg viewBox="0 0 24 24"><path d="M20 6h-4V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2m-6 0h-4V4h4z"/></svg>'
  };
  const TITLES = { planning: 'Planning', mileage: 'Mileage', cleanup: 'Clean up', handbook: "Bookkeeper's Handbook", bills: 'Bills', studio: 'My studio', training: 'Practice / Training', clients: 'All clients', dashboard: 'Dashboard', review: 'To Review', transactions: 'Transactions', invoices: 'Invoices', contacts: 'Customers & Vendors', import: 'Import', reconcile: 'Reconcile', close: 'Close the month', accounts: 'Chart of Accounts', rules: 'Smart Rules', reports: 'Reports', settings: 'Settings' };

  function go(page, params = {}) {
    if (page !== 'reconcile' && S.ui.recon) { S.ui.parkedRecon = S.ui.recon; S.ui.recon = null; }
    S.route = { page, params };
    document.body.classList.remove('nav-open');
    U.closeMenus();
    render();
    const v = $('#view'); if (v) v.scrollTop = 0;
  }
  function switchClient(id, page) {
    S.data.activeClientId = id;
    S.ui.recon = null;
    Object.assign(S.ui.txn, { account: 'all', category: '', q: '', type: 'all' });
    S.ui.txn.selected = new Set();
    S.ui.close.month = null;
    S.ui.reviewFocus = 0;
    save();
    go(page || (S.route.page === 'clients' || S.route.page === 'settings' ? 'dashboard' : S.route.page));
  }
  const reviewCount = c => c ? c.transactions.filter(t => t.status === 'review').length : 0;

  function renderNav() {
    const c = client();
    const n = reviewCount(c);
    $('#nav').innerHTML = NAV.map(g => `${g.label ? `<div class="nav-label">${g.label}</div>` : ''}${g.items.map(([k, label, ic]) =>
      `<a data-nav="${k}" class="${S.route.page === k ? 'active' : ''} ${!c && k !== 'clients' && k !== 'studio' ? 'disabled' : ''}" href="#">${NAV_ICON[ic]}<span>${label}</span>${k === 'review' && n ? `<span class="pill">${n}</span>` : ''}${k === 'clients' && S.data.clients.length ? `<span class="count">${S.data.clients.length}</span>` : ''}</a>`).join('')}`).join('');
  }

  function renderChrome() {
    const c = client();
    $('#firmName').textContent = S.data.firm.name || 'Bookkeeping Studio';
    const cs = $('#clientSwitch');
    cs.innerHTML = c
      ? `<div class="avatar" style="background:${c.color}">${esc(U.initials(c.name))}</div><div style="min-width:0;flex:1"><div class="cs-label">Working on</div><div class="cs-name">${esc(c.name)}</div></div><span class="chev">${ICON.chev}</span>`
      : `<div class="avatar" style="background:#3A4A44">+</div><div style="flex:1"><div class="cs-label">No client yet</div><div class="cs-name">Add a client</div></div>`;
    renderNav();
    $$('.sidebar-foot [data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === S.route.page));
    const page = S.route.page;
    $('#crumbs').innerHTML = page === 'clients' || !c ? `<b>${esc(S.data.firm.name || 'Your studio')}</b>` : `<a data-nav="clients" href="#">Clients</a> <span class="sep">/</span> ${esc(c.name)} <span class="sep">/</span> <b>${TITLES[page] || ''}</b>`;
    const th = S.data.theme;
    if (th === 'light' || th === 'dark') document.documentElement.dataset.theme = th; else delete document.documentElement.dataset.theme;
    renderUpdate();
  }

  function renderUpdate() {
    const el = $('#updateBar');
    if (!el) return;
    const u = S.update;
    el.hidden = !u;
    if (!u) return;
    el.innerHTML = u.state === 'ready'
      ? `${ICON.spark}<div><b>Update ready</b><div>Version ${esc(u.version || '')}</div></div><button class="btn sm gold" data-action="install-update">Restart</button>`
      : `${ICON.download}<div><b>Downloading update</b><div>${u.percent || 0}%</div></div>`;
  }

  function render() {
    if (!S.data.setupDone && views.setup) { $('#app').classList.add('setup-mode'); $('#view').innerHTML = `<div class="view-inner">${views.setup.render()}</div>`; renderChrome(); return; }
    $('#app').classList.remove('setup-mode');
    let c = client();
    if (!c && S.data.clients.length) { S.data.activeClientId = S.data.clients[0].id; c = client(); }
    let page = S.route.page;
    if (!c && !['clients', 'settings', 'training', 'studio', 'handbook'].includes(page)) page = S.route.page = 'clients';
    renderChrome();
    const v = views[page] || views.dashboard;
    try {
      $('#view').innerHTML = `<div class="view-inner" data-page="${page}">${v.render(c, S.route.params)}</div>`;
      if (v.after) v.after(c);
      for (const fn of hooks) { try { fn(c, page); } catch (err) { console.error(err); } }
    } catch (e) {
      console.error(e);
      $('#view').innerHTML = `<div class="view-inner"><div class="card"><div class="empty"><div class="big">Something went wrong on this screen</div>Your books are safe. Try another screen, or restart the app.<div class="muted" style="margin-top:10px">${esc(e.message)}</div></div></div></div>`;
    }
  }

  // ---------------- command palette ----------------
  function palette(initial = '') {
    const c = client();
    if (S.data.training) { S.data.training.flags = S.data.training.flags || {}; S.data.training.flags.palette = true; }
    const m = U.openModal(`<div class="palette"><div class="palette-search">${ICON.search}<input id="pal-q" placeholder="Search or jump to anything — clients, payees, amounts, invoices, screens…" value="${esc(initial)}" autocomplete="off" autofocus><span class="kbd">Esc</span></div><div class="palette-list" id="pal-list"></div></div>`, { size: 'palette-modal' });
    const inp = $('#pal-q', m), list = $('#pal-list', m);
    let items = [], hi = 0;
    const run = it => { U.closeModal(); setTimeout(() => it.run(), 10); };
    const draw = () => {
      const q = inp.value.trim().toLowerCase();
      const match = s => !q || String(s).toLowerCase().includes(q);
      const out = [];
      const add = (group, label, sub, icon, fn) => out.push({ group, label, sub, icon, run: fn });
      const cmds = [
        ['New transaction', 'Record money in or out', ICON.plus, () => actions['new-txn']()],
        ['New invoice', 'Bill a customer', ICON.file, () => actions['new-invoice']()],
        ['New bill', 'Record a bill from a vendor', ICON.file, () => actions['new-bill']()],
        ['Log time', 'Track hours for one of your clients', ICON.calendar, () => go('studio')],
        ['Import a file', 'Bank statement, Square or QuickBooks', ICON.upload, () => go('import')],
        ['Review transactions', 'Categorize new bank activity', ICON.check, () => go('review')],
        ['Reconcile an account', 'Match the books to a statement', ICON.bank, () => go('reconcile')],
        ['Close the month', 'Checklist and lock the books', ICON.lock, () => go('close')],
        ['Profit & Loss', 'Income, expenses and profit', ICON.report, () => { S.ui.report.type = 'pl'; go('reports'); }],
        ['Balance Sheet', 'What the business owns and owes', ICON.report, () => { S.ui.report.type = 'bs'; go('reports'); }],
        ['Client package PDF', 'Monthly report pack for the client', ICON.pdf, () => actions['client-package']()],
        ['Read a receipt', 'Photo or PDF — fills in vendor, date and total', ICON.spark, () => actions['read-receipt']()],
        ['Log a trip', 'Business mileage', ICON.calendar, () => go('mileage')],
        ['Cash flow forecast', 'What cash will do over the next 90 days', ICON.report, () => { S.ui.plan.tab = 'cash'; go('planning'); }],
        ['Budget', 'Budget vs. actual', ICON.report, () => { S.ui.plan.tab = 'budget'; go('planning'); }],
        ['Owner pay & quarterly taxes', 'What to set aside and what\'s safe to take', ICON.bank, () => { S.ui.plan.tab = 'owner'; go('planning'); }],
        ['Send payment reminders', 'Polite emails for overdue invoices', ICON.mail, () => actions['remind-all']()],
        ['Month-end email', 'A short summary for the client', ICON.mail, () => actions['month-email']()],
        ['Clean up', 'Duplicates, loose ends, missing receipts', ICON.check, () => go('cleanup')],
        ["Bookkeeper's Handbook", 'Tips, rules, deadlines, FAQs, glossary', ICON.help, () => go('handbook')],
        ['Dark mode', 'Switch light and dark', ICON.spark, () => actions['toggle-dark']()],
        ['Add a client', 'Set up a new business', ICON.plus, () => actions['new-client']()],
        ['Help', 'How-to guides and shortcuts', ICON.help, () => help()],
        ['Practice / Training', 'The Academy: lessons, exams and a certificate', ICON.spark, () => go('training')],
        ['Settings', 'Studio, client profile, backups', ICON.dots, () => go('settings')]
      ];
      for (const [l, s, i, f] of cmds) if ((c || /client|help|settings|training|time|handbook|dark/i.test(l)) && (match(l) || match(s))) add('Actions', l, s, i, f);
      if (c) for (const [k, t] of Object.entries(TITLES)) if (q && match(t) && !cmds.some(x => x[0] === t)) add('Go to', t, '', NAV_ICON.dash, () => go(k));
      for (const x of S.data.clients) if (q && match(x.name) && x !== c) add('Switch client', x.name, x.industry || '', `<span class="avatar xs" style="background:${x.color}">${esc(U.initials(x.name))}</span>`, () => switchClient(x.id, 'dashboard'));
      if (c && q) {
        for (const p of c.contacts.filter(p => match(p.name) || match(p.email)).slice(0, 5)) add('People', p.name, p.kind === 'vendor' ? 'Vendor' : 'Customer', ICON.people, () => actions['edit-contact']({ dataset: { id: p.id } }));
        for (const i of c.invoices.filter(i => { const cu = C.contact(c, i.contactId); return match(i.number) || (cu && match(cu.name)); }).slice(0, 5)) { const st = C.invoiceState(c, i); add('Invoices', `${i.number} · ${(C.contact(c, i.contactId) || {}).name || ''}`, `${st.label} · ${U.money(st.total)}`, ICON.file, () => actions['edit-invoice']({ dataset: { id: i.id } })); }
        const qn = q.replace(/[$,]/g, '');
        const tx = c.transactions.filter(t => match(t.payee) || match(t.description) || match(t.memo) || (qn && /^[\d.]+$/.test(qn) && Math.abs(t.amount).toFixed(2).includes(qn))).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
        for (const t of tx) add('Transactions', `${t.payee || t.description}`, `${U.fmtDate(t.date)} · ${U.money(t.amount)}${t.status === 'review' ? ' · needs review' : ''}`, NAV_ICON.swap, () => actions['edit-txn']({ dataset: { id: t.id } }));
      }
      items = out; hi = 0;
      let last = '';
      list.innerHTML = out.length ? out.map((it, i) => { const head = it.group !== last ? `<div class="pg">${it.group}</div>` : ''; last = it.group; return `${head}<div class="pi" data-i="${i}"><span class="pal-ic">${it.icon}</span><div style="min-width:0;flex:1"><div class="pal-l">${esc(it.label)}</div>${it.sub ? `<div class="muted">${esc(it.sub)}</div>` : ''}</div>${ICON.right}</div>`; }).join('') : `<div class="empty" style="padding:30px"><div class="big" style="font-size:18px">Nothing matches “${esc(inp.value)}”</div>Try a payee, an amount like 189.99, or an invoice number.</div>`;
      mark();
    };
    const mark = () => { $$('.pi', list).forEach(el => el.classList.toggle('hi', +el.dataset.i === hi)); const el = list.querySelector('.pi.hi'); if (el) el.scrollIntoView({ block: 'nearest' }); };
    inp.oninput = draw;
    inp.onkeydown = e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); hi = Math.min(items.length - 1, hi + 1); mark(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); hi = Math.max(0, hi - 1); mark(); }
      else if (e.key === 'Enter' && items[hi]) { e.preventDefault(); run(items[hi]); }
    };
    list.onmousemove = e => { const el = e.target.closest('.pi'); if (el && +el.dataset.i !== hi) { hi = +el.dataset.i; mark(); } };
    list.onclick = e => { const el = e.target.closest('.pi'); if (el) run(items[+el.dataset.i]); };
    draw();
  }

  // ---------------- help ----------------
  const GUIDES = [
    ['Get bank activity in', 'Download a CSV or Excel file from the bank website, then drop it anywhere in Coll Ledger. It lands in To Review.', 'import'],
    ['Sort transactions', 'Open To Review. Most rows already have a category. Check it, press Enter (or click Accept). Tick "Always" to teach a rule.', 'review'],
    ['Split one payment', 'Open the transaction and click "Split" to spread it across several categories, like a Costco run that was part supplies, part inventory.', 'transactions'],
    ['Bill a customer', 'Invoices → New invoice. Pick the customer, add lines, then "Save & mark sent". Export the PDF or email it.', 'invoices'],
    ['Record a payment', 'Open the invoice and click "Record payment". It shows as a deposit and the invoice turns Paid.', 'invoices'],
    ['Reconcile a statement', 'Reconcile → pick the account → type the statement ending balance → tick what is on the statement until the difference is $0.00.', 'reconcile'],
    ['Close the month', 'Close the month walks you through the checklist, then locks the month so sent reports never change by accident.', 'close'],
    ['Send the client their numbers', 'Reports → Client package makes one polished PDF with a summary, Profit & Loss and Balance Sheet.', 'reports'],
    ['Bring in Square', 'Square Dashboard → Transactions → Export → Transactions CSV. Drop the file in Import. Each day becomes one entry with sales, tax, tips and fees.', 'import'],
    ['Move a client from QuickBooks', 'Import the chart of accounts, then customers and vendors, then "Transaction Detail by Account". Import shows exactly how.', 'import']
  ];
  function help() {
    const mod = window.desktop && window.desktop.platform === 'darwin' ? '⌘' : 'Ctrl';
    const m = U.openModal(`${U.modalHead('Help', 'Short answers to the everyday questions')}
      <div class="modal-body">
        <div class="train-cta"><div class="train-cta-ic">${ICON.spark}</div><div><b>Practice account / Training</b><div class="muted">The Coll Ledger Academy: hands-on lessons on a pretend bakery, a written and a practical exam, and a certificate you can add to LinkedIn.</div></div><button class="btn primary" data-g="train">Start training</button></div>
        <div class="train-cta hb-cta"><div class="train-cta-ic">${ICON.help}</div><div><b>Bookkeeper's Handbook</b><div class="muted">Quick tips, rules of the road, tax rules and deadlines, month-end and year-end checklists, FAQs and a glossary.</div></div><button class="btn primary" data-g="book">Open the handbook</button></div>
        <div class="guides">${GUIDES.map(([t, d, page], i) => `<div class="guide"><div><b>${t}</b><div class="muted">${d}</div></div><button class="btn sm" data-g="${i}">Show me</button></div>`).join('')}</div>
        <div class="card" style="box-shadow:none"><div class="card-head"><h3>Keyboard shortcuts</h3></div><div class="card-body shortcuts">
          <div><span class="kbd">${mod}</span> <span class="kbd">K</span> Search & jump anywhere</div>
          <div><span class="kbd">N</span> New transaction</div>
          <div><span class="kbd">I</span> New invoice</div>
          <div><span class="kbd">↑</span> <span class="kbd">↓</span> Move through To Review</div>
          <div><span class="kbd">Enter</span> Accept the highlighted transaction</div>
          <div><span class="kbd">C</span> Change its category</div>
          <div><span class="kbd">Esc</span> Close any window</div>
        </div></div>
        <div class="muted">Coll Ledger by Coll Business Solutions LLC · collbusinesssolutions@gmail.com</div>
      </div>`, { wide: true });
    $$('[data-g]', m).forEach(b => b.onclick = () => { U.closeModal(); if (b.dataset.g === 'train') return go('training'); if (b.dataset.g === 'book') return go('handbook'); const g = GUIDES[+b.dataset.g]; if (client()) go(g[2]); });
  }

  // ---------------- events ----------------
  document.addEventListener('click', e => {
    if (!e.target.closest('.menu') && !e.target.closest('[data-menu]')) U.closeMenus();
    const nav = e.target.closest('[data-nav]');
    if (nav) {
      e.preventDefault();
      if (nav.classList.contains('disabled')) return U.toast('Add a client first');
      return go(nav.dataset.nav);
    }
    const a = e.target.closest('[data-action]');
    if (a && actions[a.dataset.action]) {
      if (a.tagName === 'A' || a.tagName === 'BUTTON') e.preventDefault();
      if (e.target.closest('input, select, textarea') && a.tagName === 'TR') return;
      actions[a.dataset.action](a, e);
    }
  });
  document.addEventListener('change', e => {
    const el = e.target, k = el.dataset.change;
    if (k && actions['change:' + k]) actions['change:' + k](el, e);
  });
  document.addEventListener('input', e => {
    const k = e.target.dataset.input;
    if (k && actions['input:' + k]) actions['input:' + k](e.target, e);
  });
  document.addEventListener('keydown', e => {
    const tag = document.activeElement && document.activeElement.tagName;
    const typing = /INPUT|TEXTAREA|SELECT/.test(tag) || (document.activeElement && document.activeElement.isContentEditable);
    const menuOpen = !!$('.menu');
    if (e.key === 'Escape') {
      if (menuOpen) { U.closeMenus(); return; }
      if (U.modalOpen()) { U.closeModal(); return; }
      if (document.body.classList.contains('nav-open')) document.body.classList.remove('nav-open');
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); if (!U.modalOpen()) palette(); return; }
    if (typing || U.modalOpen() || menuOpen || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!S.data.setupDone) return;
    const c = client();
    if (e.key === '/') { e.preventDefault(); palette(); return; }
    if (!c) return;
    if (e.key === 'n' || e.key === 'N') { e.preventDefault(); actions['new-txn'](); return; }
    if (e.key === 'i' || e.key === 'I') { e.preventDefault(); actions['new-invoice'](); return; }
    if (e.key === '?') { e.preventDefault(); help(); return; }
    const v = views[S.route.page];
    if (v && v.key) v.key(e, c);
  });

  // drop a file anywhere to import it
  let dragDepth = 0;
  const hasFiles = e => e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
  window.addEventListener('dragenter', e => { if (!hasFiles(e) || !client() || U.modalOpen()) return; e.preventDefault(); dragDepth++; document.body.classList.add('dropping'); });
  window.addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
  window.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) document.body.classList.remove('dropping'); });
  window.addEventListener('drop', async e => {
    if (!hasFiles(e)) return;
    e.preventDefault(); dragDepth = 0; document.body.classList.remove('dropping');
    if (!client() || U.modalOpen() && !e.target.closest('.drop')) return;
    if (e.target.closest('.drop')) return; // the import screen's own drop box handles it
    const files = await Promise.all([...e.dataTransfer.files].map(U.readBrowserFile));
    if (files.length && actions['import-files']) actions['import-files'](files);
  });

  act({
    'close-modal': () => U.closeModal(),
    'palette': () => palette(),
    'help': () => help(),
    'menu-toggle': () => document.body.classList.toggle('nav-open'),
    'install-update': () => window.desktop && window.desktop.installUpdate()
  });

  // ---------------- boot ----------------
  async function boot() {
    if (window.desktop && window.desktop.platform !== 'darwin') document.body.classList.add('win');
    if (window.desktop && window.desktop.platform === 'darwin') document.body.classList.add('mac');
    const mod = window.desktop && window.desktop.platform === 'darwin' ? '⌘K' : 'Ctrl K';
    $('#searchHint').textContent = mod;
    if (window.desktop && window.desktop.onClosing) window.desktop.onClosing(async () => { clearTimeout(saveTimer); try { await flush(); } catch (e) { } window.desktop.readyToClose(); });
    if (!await load()) { App.showLock(true); return; }
    afterLoad();
  }
  function afterLoad() {
    if (window.COLL_PREVIEW && !S.data.clients.length) {
      const demo = C.demoClients();
      S.data.clients.push(...demo);
      S.data.activeClientId = demo[0].id;
      S.data.setupDone = true;
      S.data.firm.name = 'Your Bookkeeping Studio';
    }
    if (S.data.clients.length && !client()) S.data.activeClientId = S.data.clients[0].id;
    if (S.data.clients.length > 1) S.route.page = 'clients';
    for (const fn of onLoad) { try { fn(); } catch (e) { console.error(e); } }
    if (window.desktop && window.desktop.onUpdate) window.desktop.onUpdate(info => { S.update = Object.assign(S.update || {}, info); renderUpdate(); if (info.state === 'ready') U.toast('A new version is ready — restart when convenient'); });
    render();
  }

  return { onLoad, afterLoad, LS_KEY, hooks, migrate, S, C, U, client, view, act, actions, views, go, render, renderChrome, commit, save, flush, snapshot, guardLock, switchClient, reviewCount, palette, help, today, boot, TITLES };
})();
