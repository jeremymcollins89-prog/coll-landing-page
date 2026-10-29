'use strict';
/* =====================================================================
   Coll Ledger — Import: bank statements, Square, QuickBooks
   Drop any file and Coll Ledger works out what it is, shows a preview,
   and imports it. Every import can be undone from the Import screen.
   ===================================================================== */
(() => {
  const { S, C, U, client, view, act, actions, go, render, commit, save, snapshot } = App;
  const { $, $$, esc, money, fmtDate, ICON, plural } = U;
  const I = Imports;
  const today = App.today;

  // ------------------------------------------------------------------
  // The Import screen
  // ------------------------------------------------------------------
  const howto = (key, open) => `<details class="howto" ${open ? 'open' : ''}><summary>How to get this file</summary><ol>${I.HOWTO[key].map(s => `<li>${esc(s)}</li>`).join('')}</ol></details>`;

  view('import', {
    render(c) {
      const hist = (c.imports || []).slice().reverse().slice(0, 8);
      return `
        <div class="page-head"><div><h1>Import</h1><div class="sub">Bring in bank activity, Square sales, or a whole client from QuickBooks. Drop a file anywhere — Coll Ledger works out what it is and shows you before anything changes.</div></div></div>
        <div class="drop big-drop" data-action="import-pick" tabindex="0" role="button" aria-label="Choose a file to import">
          <div class="drop-ic">${ICON.upload}</div>
          <div class="big">Drop a file here, or click to choose</div>
          <div>CSV or Excel from a bank or card, Square, or QuickBooks</div>
          <div class="drop-chips"><span>${ICON.bank}Bank & cards</span><span>${ICON.square}Square</span><span>${ICON.qb}QuickBooks Online & Desktop</span></div>
        </div>
        <div class="import-grid">
          <div class="card src-card">
            <div class="src-head"><span class="src-ic bank">${ICON.bank}</span><div><h3>Bank & credit cards</h3><div class="muted">Everyday activity from any bank</div></div></div>
            <div class="src-body">${howto('bank')}<button class="btn primary sm" data-action="import-pick">${ICON.upload}Choose a statement file</button></div>
          </div>
          <div class="card src-card">
            <div class="src-head"><span class="src-ic square">${ICON.square}</span><div><h3>Square</h3><div class="muted">Daily sales with tax, tips and fees split out</div></div></div>
            <div class="src-body">
              <div class="src-row"><div><b>Sales & fees</b><div class="muted">Transactions CSV</div></div><button class="btn sm" data-action="import-pick">Choose file</button></div>${howto('square-sales')}
              <div class="src-row"><div><b>Customers</b><div class="muted">Customer directory export</div></div><button class="btn sm" data-action="import-pick">Choose file</button></div>${howto('square-customers')}
            </div>
          </div>
          <div class="card src-card">
            <div class="src-head"><span class="src-ic qb">${ICON.qb}</span><div><h3>QuickBooks</h3><div class="muted">Move a client over in three steps</div></div></div>
            <div class="src-body">
              <div class="src-row"><span class="step-n">1</span><div><b>Chart of accounts</b><div class="muted">So every category matches</div></div><button class="btn sm" data-action="import-pick">Choose file</button></div>${howto('qb-accounts')}
              <div class="src-row"><span class="step-n">2</span><div><b>Customers & vendors</b><div class="muted">Contact lists</div></div><button class="btn sm" data-action="import-pick">Choose file</button></div>${howto('qb-contacts')}
              <div class="src-row"><span class="step-n">3</span><div><b>Transactions</b><div class="muted">Transaction Detail by Account</div></div><button class="btn sm" data-action="import-pick">Choose file</button></div>${howto('qb-transactions')}
              <details class="howto"><summary>Using QuickBooks Desktop?</summary><ol>${I.HOWTO['qb-desktop'].map(s => `<li>${esc(s)}</li>`).join('')}</ol></details>
            </div>
          </div>
        </div>
        <div class="card"><div class="card-head"><h3>Recent imports</h3><span class="muted">Undo removes exactly what that import added</span></div>
          <div class="card-body list-rows">${hist.length ? hist.map((h, i) => `<div class="row"><span class="tag ${h.kind.startsWith('square') ? 'green' : h.kind.startsWith('qb') ? 'blue' : ''}">${I.KINDS[h.kind] ? I.KINDS[h.kind].title : 'Import'}</span><div class="grow"><b>${esc(h.file)}</b><div class="muted">${fmtDate(h.date)} · ${esc(h.summary)}</div></div>${h.undone ? '<span class="muted">Undone</span>' : `<button class="btn sm ghost" data-action="import-undo" data-id="${h.id}">Undo</button>`}</div>`).join('') : '<div class="muted">Nothing imported yet for this client.</div>'}</div></div>`;
    },
    after() {
      const d = $('.big-drop');
      if (!d) return;
      d.addEventListener('dragover', e => { e.preventDefault(); d.classList.add('over'); });
      d.addEventListener('dragleave', () => d.classList.remove('over'));
      d.addEventListener('drop', async e => { e.preventDefault(); d.classList.remove('over'); const files = await Promise.all([...e.dataTransfer.files].map(U.readBrowserFile)); handleFiles(files); });
    }
  });

  function logImport(c, kind, file, summary, added) {
    c.imports = c.imports || [];
    c.imports.push({ id: C.uid(), date: today(), kind, file, summary, txns: added.txns || [], contacts: added.contacts || [], accounts: added.accounts || [] });
    if (c.imports.length > 40) c.imports.splice(0, c.imports.length - 40);
  }

  act({
    'import-pick': async () => { const files = await U.pickFiles('.csv,.xlsx,.xls,.txt,.iif', true); if (files.length) handleFiles(files); },
    'import-files': files => handleFiles(files),
    'import-undo': async el => {
      const c = client(); const h = (c.imports || []).find(x => x.id === el.dataset.id); if (!h) return;
      if (!await U.confirmBox({ title: 'Undo this import?', body: `Removes what <b>${esc(h.file)}</b> added: ${esc(h.summary)}. Anything you changed since stays changed.`, ok: 'Undo import' })) return;
      const doomed = c.transactions.filter(x => h.txns.includes(x.id));
      if (!await App.guardLock(c, ...doomed.map(x => x.date))) return;
      if (doomed.some(x => x.reconciled) && !await U.confirmBox({ title: 'Some of these are reconciled', body: `${plural(doomed.filter(x => x.reconciled).length, 'transaction')} from this import were already reconciled. Removing them will change those reconciled balances.`, ok: 'Remove anyway' })) return;
      const t = new Set(h.txns), p = new Set(h.contacts), a = new Set(h.accounts);
      c.transactions = c.transactions.filter(x => !t.has(x.id));
      c.contacts = c.contacts.filter(x => !p.has(x.id) || c.invoices.some(i => i.contactId === x.id));
      const stillUsed = id => c.transactions.some(x => x.accountId === id || x.categoryId === id || (x.splits || []).some(s => s.categoryId === id)) || c.invoices.some(i => i.lines.some(l => l.accountId === id)) || c.rules.some(r => r.categoryId === id);
      c.accounts = c.accounts.filter(x => !a.has(x.id) || stillUsed(x.id));
      h.undone = true;
      commit(); U.toast('Import undone');
    }
  });

  // ------------------------------------------------------------------
  // Recognize and route each file
  // ------------------------------------------------------------------
  async function handleFiles(files) {
    const c = client(); if (!c) return U.toast('Add a client first', null, 'warn');
    for (const f of files) {
      let rows;
      try { rows = await I.readRows(f); }
      catch (e) { await U.confirmBox({ title: `Couldn't read ${f.name}`, body: esc(e.message || 'The file could not be opened.'), ok: 'OK', cancel: 'Close' }); continue; }
      if (!rows || rows.length < 2) { U.toast(`${f.name} has no rows to import`, null, 'warn'); continue; }
      const det = I.detect(rows);
      await new Promise(resolve => {
        const done = () => resolve();
        if (det.kind === 'square-sales') squareSalesFlow(c, f.name, rows, det.at, done);
        else if (det.kind === 'square-customers') contactsFlow(c, f.name, det.kind, I.squareCustomers(rows, det.at), done);
        else if (det.kind === 'qb-customers') contactsFlow(c, f.name, det.kind, I.qbContacts(rows, det.at, 'customer'), done);
        else if (det.kind === 'qb-vendors') contactsFlow(c, f.name, det.kind, I.qbContacts(rows, det.at, 'vendor'), done);
        else if (det.kind === 'contacts') { const vend = /vendor|supplier/i.test(f.name); contactsFlow(c, f.name, vend ? 'qb-vendors' : 'qb-customers', I.qbContacts(rows, det.at, vend ? 'vendor' : 'customer'), done); }
        else if (det.kind === 'qb-accounts') accountsFlow(c, f.name, I.qbAccounts(rows, det.at), [], done);
        else if (det.kind === 'qb-iif') { const x = I.qbIif(rows); accountsFlow(c, f.name, x.accounts, [...x.customers, ...x.vendors], done); }
        else if (det.kind === 'qb-transactions') qbTxnFlow(c, f.name, rows, det.at, done);
        else bankFlow(c, f.name, rows, det.at, done);
      });
    }
  }

  const recognized = kind => `<div class="recognized">${ICON.spark}<span>Recognized as <b>${I.KINDS[kind].title}</b></span></div>`;
  const finish = (c, page, msg) => { commit(false); go(page); U.toast(msg); };

  // ------------------------------------------------------------------
  // Bank / card statements
  // ------------------------------------------------------------------
  function bankFlow(c, name, rows, at, done) {
    const header = rows[at];
    const body = rows.slice(at + 1);
    const g = C.guessColumns(header);
    const banks = App.moneyAccounts(c);
    if (!banks.length) { U.toast('Add a bank or card account first (Chart of Accounts)', null, 'warn'); return done(); }
    // guess the account from the file name ("chase-checking.csv", "amex.csv")
    const lname = name.toLowerCase();
    const guessAcc = banks.find(a => lname.includes(a.name.toLowerCase())) || (/(card|amex|visa|master|discover|credit)/.test(lname) && banks.find(a => a.sub === 'credit')) || banks.find(a => a.sub === 'bank') || banks[0];
    const colOpts = sel => `<option value="-1">—</option>` + header.map((h, i) => `<option value="${i}" ${i === sel ? 'selected' : ''}>${esc(h || 'Column ' + (i + 1))}</option>`).join('');
    const order = C.guessDateOrder(body.map(r => r[g.date]));
    let md = g.amount >= 0 ? 'single' : 'split';
    const picks = new Map(); // row key -> { categoryId, payee } chosen in the preview
    let current = [];
    const SRC = { rule: [ICON.bolt, 'Smart rule'], history: [ICON.spark, 'Same as last time'], guess: [ICON.spark, 'Best guess'], you: [ICON.check, 'You chose'] };
    const m = U.openModal(`${U.modalHead('Bank or card statement', `<b>${esc(name)}</b> · ${plural(body.length, 'row')}`)}
      <div class="modal-body">
        ${recognized('bank')}
        <div class="field"><label for="m-acc">Which account is this statement for?</label><select class="input" id="m-acc">${App.accountOptions(banks, guessAcc.id)}</select></div>
        <details class="more" id="m-cols"><summary>Columns <span class="muted" id="m-colsum"></span></summary>
          <div class="grid2" style="margin-top:12px">
            <div class="field"><label for="m-date">Date</label><select class="input" id="m-date">${colOpts(g.date)}</select></div>
            <div class="field"><label for="m-desc">Description</label><select class="input" id="m-desc">${colOpts(g.desc)}</select></div>
            <div class="field span2"><div class="seg" style="align-self:flex-start"><button data-mode="single" class="${md === 'single' ? 'on' : ''}">One amount column</button><button data-mode="split" class="${md === 'split' ? 'on' : ''}">Separate money in / money out</button></div></div>
            <div class="field" data-show="single"><label for="m-amt">Amount</label><select class="input" id="m-amt">${colOpts(g.amount)}</select></div>
            <div class="field" data-show="split"><label for="m-deb">Money out</label><select class="input" id="m-deb">${colOpts(g.debit)}</select></div>
            <div class="field" data-show="split"><label for="m-cred">Money in</label><select class="input" id="m-cred">${colOpts(g.credit)}</select></div>
            <div class="field"><label for="m-order">Dates look like</label><select class="input" id="m-order"><option value="mdy" ${order === 'mdy' ? 'selected' : ''}>Month/Day/Year (US)</option><option value="dmy" ${order === 'dmy' ? 'selected' : ''}>Day/Month/Year</option></select></div>
          </div>
        </details>
        <label class="check" id="flip-wrap"><input type="checkbox" id="m-flip">Purchases show as positive numbers in this file (common for credit cards) — flip them</label>
        <div class="fill-head"><div><b>Here's what Coll Ledger filled in.</b> <span class="muted">Check each category — click one to change it. You can still edit any transaction later.</span></div></div>
        <div class="preview-tbl tall" id="m-prev"></div>
      </div>
      <div class="modal-foot"><span class="muted left" id="m-count"></span><button class="btn" id="m-review">Import to To Review</button><button class="btn primary" id="m-go">${ICON.check}Looks right — import</button></div>`, { wide: true, onClose: done });
    const parse = () => {
      const di = +$('#m-date', m).value, de = +$('#m-desc', m).value, ai = +$('#m-amt', m).value, dbi = +$('#m-deb', m).value, cri = +$('#m-cred', m).value;
      const flip = $('#m-flip', m).checked, ord = $('#m-order', m).value, acc = $('#m-acc', m).value;
      const out = [];
      for (const r of body) {
        const date = C.parseDate(r[di], ord);
        let amt;
        if (md === 'single') amt = C.parseAmount(r[ai]);
        else { const d = C.parseAmount(r[dbi]), cr = C.parseAmount(r[cri]); amt = (isNaN(cr) ? 0 : Math.abs(cr)) - (isNaN(d) ? 0 : Math.abs(d)); }
        if (flip) amt = -amt;
        if (!date || !amt || isNaN(amt)) continue;
        const desc = String(r[de] ?? '').trim() || 'Bank transaction';
        out.push({ date, desc, amt: C.round2(amt) });
      }
      // already in: same account, date, amount and description (counted, so two identical coffees both import the first time),
      // or the other side of a transfer already recorded from another account's statement
      const pool = new Map();
      for (const t of c.transactions.filter(t => t.accountId === acc)) { const k = `${t.date}|${t.amount.toFixed(2)}|${C.keyOf(t.description)}`; pool.set(k, (pool.get(k) || 0) + 1); }
      const transfers = c.transactions.filter(t => t.accountId !== acc && t.status !== 'review' && t.categoryId === acc);
      const seenKey = new Map();
      for (const x of out) {
        const k = `${x.date}|${x.amt.toFixed(2)}|${C.keyOf(x.desc)}`; const n = pool.get(k) || 0;
        x.dup = n > 0; if (n) pool.set(k, n - 1);
        if (!x.dup) { const ti = transfers.findIndex(t => Math.abs(t.amount + x.amt) < 0.005 && Math.abs(C.daysBetween(t.date, x.date)) <= 4); if (ti >= 0) { x.dup = true; x.transfer = true; transfers.splice(ti, 1); } }
        const sk = k + '|' + (seenKey.get(k) || 0); seenKey.set(k, (seenKey.get(k) || 0) + 1); x.key = sk;
        if (!x.dup) {
          const tmp = { description: x.desc, payee: '', amount: x.amt, accountId: acc };
          const sg = C.suggest(c, tmp);
          const p = picks.get(sk);
          x.categoryId = p ? p.categoryId : (sg ? sg.categoryId : '');
          x.source = p ? 'you' : (sg ? sg.source : null);
          x.payee = (sg && sg.payee) || C.cleanPayee(x.desc);
          x.rule = sg && sg.rule;
        }
      }
      return out;
    };
    const refresh = () => {
      $$('[data-show]', m).forEach(el => el.hidden = el.dataset.show !== md);
      const acc = C.acct(c, $('#m-acc', m).value);
      const p = parse(); current = p;
      const fresh = p.filter(x => !x.dup), filled = fresh.filter(x => x.categoryId);
      const ok = $('#m-date', m).value !== '-1' && (md === 'single' ? $('#m-amt', m).value !== '-1' : ($('#m-deb', m).value !== '-1' || $('#m-cred', m).value !== '-1'));
      $('#m-colsum', m).textContent = ok ? '— matched automatically' : '— please pick the date and amount columns';
      if (!ok) $('#m-cols', m).open = true;
      $('#m-prev', m).innerHTML = `<table class="tbl"><thead><tr><th style="width:96px">Date</th><th>Payee</th><th style="width:240px">Category</th><th class="num">Amount</th></tr></thead><tbody>${p.map((x, i) => `<tr class="${x.dup ? 'dim' : ''}"><td class="muted">${U.fmtDateShort(x.date)}</td><td><div class="desc-main ellip">${esc(x.dup ? C.cleanPayee(x.desc) : x.payee)}</div><div class="desc-sub ellip">${esc(x.desc)}</div></td><td>${x.dup ? `<span class="tag">${x.transfer ? 'Transfer already recorded' : 'Already in'}</span>` : `<button class="cat-btn ${x.categoryId ? '' : 'empty'}" data-pi="${i}" data-menu>${x.categoryId ? esc((C.acct(c, x.categoryId) || {}).name) : 'Needs you'}${ICON.chev}</button>${x.source ? `<div class="suggest ${x.source === 'guess' ? 'soft' : ''}">${SRC[x.source][0]}${SRC[x.source][1]}</div>` : ''}`}</td><td class="num">${U.signed(x.amt)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Pick the columns above to see a preview.</td></tr>'}</tbody></table>`;
      $$('[data-pi]', m).forEach(b => b.onclick = e => { e.preventDefault(); const x = current[+b.dataset.pi]; U.categoryPicker(b, c, { selected: x.categoryId, excludeId: acc && acc.id, amount: x.amt, allowClear: true, onPick: id => { picks.set(x.key, { categoryId: id }); refresh(); } }); });
      const sus = acc && acc.sub === 'credit' && p.filter(x => x.amt > 0).length > p.filter(x => x.amt < 0).length * 2 && !$('#m-flip', m).checked;
      $('#flip-wrap', m).classList.toggle('attn', !!sus);
      $('#m-count', m).innerHTML = `${plural(fresh.length, 'new transaction')} · <b>${filled.length} filled in</b>${fresh.length - filled.length ? ` · ${fresh.length - filled.length} need you` : ''}${p.length - fresh.length ? ` · ${p.length - fresh.length} already in` : ''}${sus ? ' · <span class="neg">most rows look like money in — flip?</span>' : ''}`;
      $('#m-go', m).disabled = !fresh.length;
      $('#m-review', m).disabled = !fresh.length;
      $('#m-go', m).innerHTML = `${ICON.check}${filled.length === fresh.length ? `Looks right — import ${plural(fresh.length, 'transaction')}` : `Accept ${filled.length} filled in · ${fresh.length - filled.length} to To Review`}`;
    };
    $$('#m-acc, #m-date, #m-desc, #m-amt, #m-deb, #m-cred, #m-order, #m-flip', m).forEach(el => el.onchange = refresh);
    $$('[data-mode]', m).forEach(b => b.onclick = () => { md = b.dataset.mode; $$('[data-mode]', m).forEach(x => x.classList.toggle('on', x === b)); refresh(); });
    refresh();
    const run = async acceptFilled => {
      const acc = $('#m-acc', m).value;
      const fresh = current.filter(x => !x.dup);
      if (!await App.guardLock(c, ...fresh.map(x => x.date))) return;
      let posted = 0; const ids = [];
      for (const x of fresh) {
        const t = { id: C.uid(), date: x.date, description: x.desc, payee: x.payee, amount: x.amt, accountId: acc, categoryId: null, memo: '', status: 'review', cleared: true, reconciled: false, imported: true };
        const auto = x.rule && x.rule.autoAccept && x.source === 'rule';
        if (x.categoryId && C.acct(c, x.categoryId) && x.categoryId !== acc && (acceptFilled || auto)) { t.categoryId = x.categoryId; if (x.rule && x.rule.payee) t.payee = x.rule.payee; t.status = 'posted'; posted++; }
        else if (x.source === 'you' && x.categoryId) t.suggestedId = x.categoryId;
        c.transactions.push(t); ids.push(t.id);
      }
      c.transactions.sort((a, b) => a.date.localeCompare(b.date));
      logImport(c, 'bank', name, `${plural(fresh.length, 'transaction')} into ${(C.acct(c, acc) || {}).name}`, { txns: ids });
      U.closeModal();
      const waiting = fresh.length - posted;
      finish(c, waiting ? 'review' : 'transactions', posted ? `Imported ${plural(fresh.length, 'transaction')} · ${posted} accepted${waiting ? ` · ${waiting} waiting in To Review` : ''} — you can still edit any of them` : `Imported ${plural(fresh.length, 'transaction')} — check them in To Review`);
    };
    $('#m-go', m).onclick = () => run(true);
    $('#m-review', m).onclick = () => run(false);
  }

  // ------------------------------------------------------------------
  // Square sales
  // ------------------------------------------------------------------
  function squareSalesFlow(c, name, rows, at, done) {
    const { days, skipped } = I.squareSales(rows, at);
    const already = new Set(c.transactions.map(t => t.extId).filter(Boolean));
    const fresh = days.filter(d => !already.has('sq-day-' + d.date));
    const sum = k => C.round2(fresh.reduce((s, d) => s + d[k], 0));
    const sqAcc = c.accounts.find(a => a.sub === 'clearing' && /square/i.test(a.name));
    const hasDepositRule = c.rules.some(r => /square/i.test(r.text) && sqAcc && r.categoryId === sqAcc.id);
    const m = U.openModal(`${U.modalHead('Square sales', `<b>${esc(name)}</b>`)}
      <div class="modal-body">
        ${recognized('square-sales')}
        <div class="sq-sum">
          <div><span class="muted">Days</span><b>${fresh.length}</b></div>
          <div><span class="muted">Sales</span><b>${money(sum('sales'))}</b></div>
          <div><span class="muted">Sales tax</span><b>${money(sum('tax'))}</b></div>
          <div><span class="muted">Tips</span><b>${money(sum('tip'))}</b></div>
          <div><span class="muted">Square fees</span><b>${money(-sum('fees'))}</b></div>
          <div><span class="muted">Paid in cash</span><b>${money(sum('cashOut'))}</b></div>
        </div>
        <div class="note">${ICON.spark}<span>Each day becomes <b>one entry</b> in a <b>Square</b> account, split into sales, sales tax, tips and fees${sum('cashOut') ? ', with cash moved to Cash on Hand' : ''}. When Square deposits to the bank, that deposit just moves money from Square to checking — so sales are never counted twice.</span></div>
        <label class="check"><input type="checkbox" id="sq-rule" ${hasDepositRule ? 'disabled checked' : 'checked'}>Match Square deposits in the bank to this account automatically${hasDepositRule ? ' (already set up)' : ''}</label>
        <div class="preview-tbl"><table class="tbl"><thead><tr><th>Day</th><th class="num">Payments</th><th class="num">Sales</th><th class="num">Tax</th><th class="num">Tips</th><th class="num">Fees</th><th class="num">To deposit</th></tr></thead><tbody>
          ${fresh.slice(-10).reverse().map(d => `<tr><td>${fmtDate(d.date)}</td><td class="num">${d.count}</td><td class="num">${money(d.sales)}</td><td class="num">${money(d.tax)}</td><td class="num">${money(d.tip)}</td><td class="num">${money(d.fees)}</td><td class="num"><b>${money(d.nettotal - d.cashOut)}</b></td></tr>`).join('') || '<tr><td colspan="7" class="muted">Every day in this file is already imported.</td></tr>'}
        </tbody></table></div>
        ${days.length - fresh.length ? `<div class="muted">${plural(days.length - fresh.length, 'day')} already imported — skipped.</div>` : ''}${skipped ? `<div class="muted">${plural(skipped, 'row')} skipped (no date or a failed/cancelled payment).</div>` : ''}
      </div>
      <div class="modal-foot"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" id="sq-go" ${fresh.length ? '' : 'disabled'}>${ICON.upload}Import ${plural(fresh.length, 'day')}</button></div>`, { wide: true, onClose: done });
    $('#sq-go', m).onclick = async () => {
      if (!await App.guardLock(c, ...fresh.map(d => d.date))) return;
      const created = [];
      const ensure = (spec) => { const before = c.accounts.length; const a = C.ensureAccount(c, spec); if (c.accounts.length > before) created.push(a.id); return a; };
      const sq = sqAcc || ensure({ name: 'Square', type: 'asset', sub: 'clearing', code: '1050' });
      const sales = C.acctByKey(c, 'sales') || ensure({ name: 'Sales', type: 'income', sub: 'income' });
      const tax = C.acctByKey(c, 'tax') || ensure({ name: 'Sales Tax Payable', type: 'liability', sub: 'current' });
      const fees = C.findAccount(c, 'Bank & Merchant Fees') || ensure({ name: 'Merchant Fees', type: 'expense', sub: 'expense' });
      const need = k => fresh.some(d => Math.abs(d[k]) > 0.004);
      const tips = need('tip') ? (C.findAccount(c, 'Tips Payable') || ensure({ name: 'Tips Payable', type: 'liability', sub: 'current', code: '2210' })) : null;
      const gift = need('gift') ? (C.findAccount(c, 'Gift Cards Outstanding') || ensure({ name: 'Gift Cards Outstanding', type: 'liability', sub: 'current', code: '2220' })) : null;
      const cash = need('cashOut') ? (C.findAccount(c, 'Cash on Hand') || ensure({ name: 'Cash on Hand', type: 'asset', sub: 'bank', code: '1005' })) : null;
      const ids = [];
      for (const d of fresh) {
        const amount = C.round2(d.nettotal - d.cashOut);
        const parts = [];
        const add = (acc, v) => { v = C.round2(v); if (acc && Math.abs(v) > 0.004) parts.push({ id: C.uid(), categoryId: acc.id, amount: v }); };
        add(tax, d.tax); add(tips, d.tip); add(gift, d.gift); add(fees, d.fees); add(cash, -d.cashOut);
        const rest = C.round2(amount - parts.reduce((s, p) => s + p.amount, 0));
        parts.unshift({ id: C.uid(), categoryId: sales.id, amount: rest });
        const clean = parts.filter(p => Math.abs(p.amount) > 0.004);
        if (!clean.length || !amount && clean.length < 2) continue;
        const t = { id: C.uid(), date: d.date, description: `Square sales · ${plural(d.count, 'payment')}`, payee: 'Square sales', amount, accountId: sq.id, categoryId: clean[0].categoryId, splits: clean.length > 1 ? clean : undefined, memo: '', status: 'posted', cleared: true, reconciled: false, extId: 'sq-day-' + d.date, imported: true };
        if (!t.splits) delete t.splits;
        if (!amount) { t.amount = 0; }
        c.transactions.push(t); ids.push(t.id);
      }
      if ($('#sq-rule', m).checked && !hasDepositRule) {
        c.rules.unshift({ id: C.uid(), text: 'square', categoryId: sq.id, payee: 'Square deposit', direction: 'in', autoAccept: false });
        // re-point any older rule that sent Square deposits straight to sales
        c.rules.forEach(r => { if (r.categoryId === sales.id && /square/i.test(r.text)) r.categoryId = sq.id; });
      }
      c.transactions.sort((a, b) => a.date.localeCompare(b.date));
      logImport(c, 'square-sales', name, `${plural(ids.length, 'day')} of Square sales`, { txns: ids, accounts: created });
      U.closeModal();
      Object.assign(S.ui.txn, { account: sq.id, category: '', type: 'all', q: '', period: 'all' });
      finish(c, 'transactions', `Imported ${plural(ids.length, 'day')} of Square sales`);
    };
  }

  // ------------------------------------------------------------------
  // Contacts (Square customers, QuickBooks customers / vendors)
  // ------------------------------------------------------------------
  function contactsFlow(c, name, kind, list, done) {
    const existing = new Set(c.contacts.map(x => C.normName(x.name)));
    const seen = new Set();
    const fresh = list.filter(x => { const k = C.normName(x.name); if (!k || existing.has(k) || seen.has(k)) return false; seen.add(k); return true; });
    const isVendor = kind === 'qb-vendors';
    const m = U.openModal(`${U.modalHead(I.KINDS[kind].title, `<b>${esc(name)}</b>`)}
      <div class="modal-body">
        ${recognized(kind)}
        <div class="muted">${plural(fresh.length, isVendor ? 'new vendor' : 'new customer')}${list.length - fresh.length ? ` · ${list.length - fresh.length} already here (skipped)` : ''}</div>
        <div class="preview-tbl"><table class="tbl"><thead><tr><th>Name</th><th>Email</th><th>Phone</th></tr></thead><tbody>${fresh.slice(0, 12).map(x => `<tr><td>${esc(x.name)}</td><td class="muted">${esc(x.email)}</td><td class="muted">${esc(x.phone)}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">Everyone in this file is already here.</td></tr>'}</tbody></table></div>
        ${fresh.length > 12 ? `<div class="muted">…and ${fresh.length - 12} more</div>` : ''}
      </div>
      <div class="modal-foot"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" id="ct-go" ${fresh.length ? '' : 'disabled'}>${ICON.upload}Add ${plural(fresh.length, isVendor ? 'vendor' : 'customer')}</button></div>`, { wide: true, onClose: done });
    $('#ct-go', m).onclick = () => {
      const ids = [];
      for (const x of fresh) { const rec = { id: C.uid(), kind: x.kind, name: x.name, email: x.email || '', phone: x.phone || '', address: x.address || '', notes: x.notes || '' }; c.contacts.push(rec); ids.push(rec.id); }
      logImport(c, kind, name, plural(ids.length, isVendor ? 'vendor' : 'customer'), { contacts: ids });
      U.closeModal();
      S.ui.contacts.kind = isVendor ? 'vendor' : 'customer';
      finish(c, 'contacts', `Added ${plural(ids.length, isVendor ? 'vendor' : 'customer')}`);
    };
  }

  // ------------------------------------------------------------------
  // QuickBooks chart of accounts (and IIF lists)
  // ------------------------------------------------------------------
  function accountsFlow(c, name, accounts, contacts, done) {
    const plan = accounts.map(q => {
      const match = C.findAccount(c, q.full) && C.normName(C.findAccount(c, q.full).name) === C.normName(q.name) ? C.findAccount(c, q.full) : (C.findAccount(c, q.name) || null);
      const sameType = match && match.type === q.type;
      return { q, match: sameType ? match : null };
    });
    const creating = plan.filter(p => !p.match);
    const contactsNew = contacts.filter(x => !c.contacts.some(y => C.normName(y.name) === C.normName(x.name)));
    const m = U.openModal(`${U.modalHead(contacts.length ? I.KINDS['qb-iif'].title : I.KINDS['qb-accounts'].title, `<b>${esc(name)}</b>`)}
      <div class="modal-body">
        ${recognized(contacts.length ? 'qb-iif' : 'qb-accounts')}
        <div class="muted">${plural(plan.length - creating.length, 'account')} match ones already here · <b>${plural(creating.length, 'new account')}</b> will be added${contactsNew.length ? ` · ${plural(contactsNew.length, 'new contact')}` : ''}</div>
        <div class="preview-tbl tall"><table class="tbl"><thead><tr><th>QuickBooks account</th><th>QuickBooks type</th><th>In Coll Ledger</th></tr></thead><tbody>
          ${plan.map(p => `<tr><td>${esc(p.q.full)}</td><td class="muted">${esc(p.q.qbType)}</td><td>${p.match ? `<span class="tag green">${ICON.check}${esc(p.match.name)}</span>` : `<span class="tag blue">${ICON.plus}New · ${C.TYPES[p.q.type].label.replace(/s$/, '').replace('Liabilitie', 'Liability')}</span>`}</td></tr>`).join('')}
        </tbody></table></div>
        <div class="note">${ICON.spark}<span>Balances from QuickBooks aren't copied — set each bank and card's <b>opening balance</b> on the day this client's books start in Coll Ledger (Chart of Accounts), then import transactions from that day on.</span></div>
      </div>
      <div class="modal-foot"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" id="ac-go" ${creating.length || contactsNew.length ? '' : 'disabled'}>${ICON.upload}Import</button></div>`, { wide: true, onClose: done });
    $('#ac-go', m).onclick = () => {
      const ids = [], cids = [];
      c.qbNames = c.qbNames || {};
      for (const p of plan) {
        if (p.match) { c.qbNames[p.q.full] = p.match.id; continue; }
        const a = C.ensureAccount(c, { name: p.q.name, type: p.q.type, sub: p.q.sub, code: p.q.code });
        c.qbNames[p.q.full] = a.id; ids.push(a.id);
      }
      for (const x of contactsNew) { const rec = { id: C.uid(), kind: x.kind, name: x.name, email: x.email || '', phone: x.phone || '', address: x.address || '', notes: x.notes || '' }; c.contacts.push(rec); cids.push(rec.id); }
      logImport(c, contacts.length ? 'qb-iif' : 'qb-accounts', name, [plural(ids.length, 'account'), cids.length ? plural(cids.length, 'contact') : ''].filter(Boolean).join(', '), { accounts: ids, contacts: cids });
      U.closeModal();
      finish(c, 'accounts', `Added ${plural(ids.length, 'account')}${cids.length ? ` and ${plural(cids.length, 'contact')}` : ''}`);
    };
  }

  // ------------------------------------------------------------------
  // QuickBooks transactions
  // ------------------------------------------------------------------
  function qbTxnFlow(c, name, rows, at, done) {
    const lines = I.qbTransactions(rows, at);
    // a stable id per QuickBooks line: repeats of the same line get #2, #3 so none are lost
    const stampIds = list => { const n = new Map(); for (const t of list) { const base = 'qb:' + [t.date, t.accountId, t.amount.toFixed(2), t.description, t.payee].join('|'); const k = (n.get(base) || 0) + 1; n.set(base, k); t.extId = base + '#' + k; } };
    if (!lines.length) { U.toast('No transactions found in that report', null, 'warn'); return done(); }
    c.qbNames = c.qbNames || {};
    // every account name the report mentions, with how it's used
    const names = new Map();
    for (const L of lines) {
      for (const [n, role] of [[L.account, 'source'], [L.split, 'split']]) {
        if (!n || /^-?split-?$/i.test(n.trim())) continue;
        const e = names.get(n) || { name: n, source: 0, split: 0 };
        e[role]++; names.set(n, e);
      }
    }
    const typeChoices = [['asset:bank', 'Bank account'], ['liability:credit', 'Credit card'], ['asset:clearing', 'Payment processor'], ['income:income', 'Income'], ['expense:expense', 'Expense'], ['expense:cogs', 'Cost of goods sold'], ['asset:current', 'Other asset'], ['asset:fixed', 'Equipment / fixed asset'], ['liability:current', 'Other liability'], ['liability:loan', 'Loan'], ['equity:equity', 'Equity']];
    const plan = [...names.values()].sort((a, b) => b.source - a.source || a.name.localeCompare(b.name)).map(e => {
      const mapped = c.qbNames[e.name] && C.acct(c, c.qbNames[e.name]);
      const match = mapped || C.findAccount(c, e.name);
      const guess = I.mapQbType(e.name) || (e.source > e.split ? ['asset', 'bank'] : ['expense', 'expense']);
      return { ...e, choice: match ? match.id : 'new:' + guess.join(':') };
    });
    const dates = lines.map(l => l.date).sort();
    const accOptions = sel => `<optgroup label="Add as a new account">${typeChoices.map(([k, l]) => `<option value="new:${k}" ${sel === 'new:' + k ? 'selected' : ''}>New · ${l}</option>`).join('')}</optgroup><optgroup label="Use an existing account">${c.accounts.filter(a => !a.archived).sort((x, y) => x.code.localeCompare(y.code)).map(a => `<option value="${a.id}" ${sel === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</optgroup>`;
    const m = U.openModal(`${U.modalHead('QuickBooks transactions', `<b>${esc(name)}</b> · ${plural(lines.length, 'line')} · ${fmtDate(dates[0])} – ${fmtDate(dates[dates.length - 1])}`)}
      <div class="modal-body">
        ${recognized('qb-transactions')}
        <div class="muted">Check how each QuickBooks account lines up. Matches are filled in for you; anything new is added with the type shown.</div>
        <div class="preview-tbl tall"><table class="tbl"><thead><tr><th>QuickBooks account</th><th class="num">Lines</th><th style="width:300px">Coll Ledger account</th></tr></thead><tbody>
          ${plan.map((p, i) => `<tr><td>${esc(p.name)}</td><td class="num muted">${p.source + p.split}</td><td><select class="input sm" data-pi="${i}">${accOptions(p.choice)}</select></td></tr>`).join('')}
        </tbody></table></div>
        <div class="note" id="qb-sum"></div>
      </div>
      <div class="modal-foot"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" id="qb-go">${ICON.upload}Import</button></div>`, { wide: true, onClose: done });
    $$('[data-pi]', m).forEach(s => s.onchange = () => { plan[+s.dataset.pi].choice = s.value; summarize(); });
    // dry run on a copy so the preview numbers are exact
    const simulate = () => {
      const copy = JSON.parse(JSON.stringify(c));
      const map = {};
      for (const p of plan) {
        if (p.choice.startsWith('new:')) { const [, type, sub] = p.choice.split(':'); const a = { id: 'tmp-' + p.name, code: '', name: p.name, type, sub, opening: 0 }; copy.accounts.push(a); map[p.name] = a.id; }
        else map[p.name] = p.choice;
      }
      const res = I.buildQbTransactions(copy, lines, n => map[n] || null);
      const existing = new Set(c.transactions.map(t => t.extId).filter(Boolean));
      stampIds(res.txns);
      res.fresh = res.txns.filter(t => !existing.has(t.extId));
      return { res, map };
    };
    const summarize = () => {
      const { res } = simulate();
      const money_ = plan.filter(p => { const ch = p.choice; if (ch.startsWith('new:')) return /bank|credit|clearing/.test(ch); const a = C.acct(c, ch); return C.isMoneyAccount(a); }).map(p => p.name);
      $('#qb-sum', m).innerHTML = `${ICON.spark}<span><b>${plural(res.fresh.length, 'transaction')}</b> will be imported from ${money_.length ? money_.map(esc).join(', ') : '<span class="neg">no bank or card accounts — set at least one above</span>'}.${res.txns.length - res.fresh.length ? ` ${res.txns.length - res.fresh.length} already imported.` : ''}${res.splitCount ? ` ${plural(res.splitCount, 'split transaction')} will wait in To Review.` : ''} Invoices and bills inside QuickBooks don't move over — their payments do.</span>`;
      $('#qb-go', m).disabled = !res.fresh.length;
      return res;
    };
    summarize();
    $('#qb-go', m).onclick = async () => {
      const created = [];
      const map = {};
      for (const p of plan) {
        if (p.choice.startsWith('new:')) { const [, type, sub] = p.choice.split(':'); const before = c.accounts.length; const a = C.ensureAccount(c, { name: I.splitQbName(p.name).name, type, sub, code: I.splitQbName(p.name).code }); if (c.accounts.length > before) created.push(a.id); map[p.name] = a.id; }
        else map[p.name] = p.choice;
        c.qbNames[p.name] = map[p.name];
      }
      const res = I.buildQbTransactions(c, lines, n => map[n] || null);
      const existing = new Set(c.transactions.map(t => t.extId).filter(Boolean));
      const ids = [];
      let review = 0;
      stampIds(res.txns);
      if (!await App.guardLock(c, ...res.txns.filter(x => !existing.has(x.extId)).map(x => x.date))) return;
      for (const x of res.txns) {
        const extId = x.extId;
        if (existing.has(extId)) continue;
        existing.add(extId);
        const t = { id: C.uid(), date: x.date, description: x.description, payee: x.payee, amount: x.amount, accountId: x.accountId, categoryId: x.categoryId, memo: x.memo, status: x.review ? 'review' : 'posted', cleared: true, reconciled: false, extId, imported: true };
        if (x.review) review++;
        c.transactions.push(t); ids.push(t.id);
      }
      c.transactions.sort((a, b) => a.date.localeCompare(b.date));
      const first = c.transactions.reduce((m2, t) => !m2 || t.date < m2 ? t.date : m2, '');
      if (first && first < c.startDate) c.startDate = first;
      logImport(c, 'qb-transactions', name, `${plural(ids.length, 'transaction')} from QuickBooks`, { txns: ids, accounts: created });
      U.closeModal();
      finish(c, review ? 'review' : 'transactions', `Imported ${plural(ids.length, 'transaction')} from QuickBooks${review ? ` · ${review} to review` : ''}`);
    };
  }
  App.handleFiles = handleFiles;
})();
