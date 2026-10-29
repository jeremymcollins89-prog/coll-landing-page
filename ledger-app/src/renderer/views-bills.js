'use strict';
/* =====================================================================
   Coll Ledger — Bills (money owed to vendors) and recurring documents
   ===================================================================== */
(() => {
  const { S, C, U, client, view, act, actions, go, render, commit, save, snapshot, guardLock } = App;
  const { $, $$, esc, money, fmtDate, ICON, plural } = U;
  const today = App.today;
  const catName = (c, id) => { const a = id && C.acct(c, id); return a ? a.name : ''; };
  const vendorName = (c, id) => (C.contact(c, id) || {}).name || '—';
  S.ui.bills = S.ui.bills || { filter: 'unpaid' };

  // ------------------------------------------------------------------
  // Bills screen
  // ------------------------------------------------------------------
  view('bills', {
    render(c) {
      const f = S.ui.bills.filter;
      const all = (c.bills || []).map(b => ({ b, s: C.billState(c, b) })).sort((x, y) => (x.b.dueDate || '').localeCompare(y.b.dueDate || ''));
      const pick = st => all.filter(x => st.includes(x.s.status));
      const unpaid = pick(['open', 'soon', 'overdue']), soon = pick(['soon']), overdue = pick(['overdue']);
      const since = C.addDays(today(), -30);
      const paid30 = -c.transactions.filter(t => t.billId && t.date >= since).reduce((s, t) => s + t.amount, 0);
      const list = f === 'all' ? [...all].reverse() : f === 'unpaid' ? unpaid : pick([f]);
      const stat = (label, value, sub, key, tone = '') => `<div class="card kpi ${f === key ? 'on' : ''}" data-action="bill-filter" data-v="${key}"><div class="label">${label}</div><div class="value ${tone}">${value}</div><div class="delta">${sub}</div></div>`;
      const rec = (c.recurring || []);
      return `
        <div class="page-head">
          <div><h1>Bills</h1><div class="sub">What ${esc(c.name)} owes vendors — enter bills when they arrive, pay them on time, and see what's coming up.</div></div>
          <div class="actions"><button class="btn primary" data-action="new-bill">${ICON.plus}New bill</button></div>
        </div>
        <div class="kpis">
          ${stat('Unpaid', money(unpaid.reduce((s, x) => s + x.s.due, 0)), plural(unpaid.length, 'bill'), 'unpaid')}
          ${stat('Due in the next 7 days', money(soon.reduce((s, x) => s + x.s.due, 0)), soon.length ? plural(soon.length, 'bill') : 'Nothing due soon', 'soon', soon.length ? 'gold-ink' : '')}
          ${stat('Overdue', money(overdue.reduce((s, x) => s + x.s.due, 0)), overdue.length ? `${plural(overdue.length, 'bill')} past due` : 'Nothing late', 'overdue', overdue.length ? 'neg' : '')}
          ${stat('Paid in the last 30 days', money(paid30), 'From the bank or card', 'paid')}
        </div>
        <div class="card">
          <div class="toolbar"><div class="seg">${[['unpaid', 'Unpaid'], ['soon', 'Due soon'], ['overdue', 'Overdue'], ['paid', 'Paid'], ['all', 'All']].map(([k, l]) => `<button class="${f === k ? 'on' : ''}" data-action="bill-filter" data-v="${k}">${l}</button>`).join('')}</div></div>
          <div class="table-wrap"><table class="tbl">
            <thead><tr><th>Vendor</th><th>Bill #</th><th>Bill date</th><th>Due</th><th>Status</th><th class="num">Total</th><th class="num">Still owed</th><th style="width:110px"></th></tr></thead>
            <tbody>${list.length ? list.map(({ b, s }) => `<tr class="clickable" data-action="edit-bill" data-id="${b.id}">
              <td><div class="desc-main">${esc(vendorName(c, b.vendorId))}</div>${b.memo ? `<div class="desc-sub ellip">${esc(b.memo)}</div>` : ''}</td>
              <td class="muted">${esc(b.ref || '')}${b.attachments && b.attachments.length ? ` <span class="clip-ic">${ICON.clip}</span>` : ''}</td>
              <td class="muted">${fmtDate(b.date)}</td><td class="muted">${fmtDate(b.dueDate)}</td>
              <td><span class="tag ${s.tone}"><span class="dot"></span>${s.label}</span>${b.recurringId ? ` <span class="tag" title="Made by a repeating bill">${ICON.refresh}</span>` : ''}</td>
              <td class="num">${money(s.total)}</td><td class="num" style="font-weight:600">${['paid', 'void'].includes(s.status) ? '<span class="muted">—</span>' : money(s.due)}</td>
              <td data-stop style="text-align:right">${['open', 'soon', 'overdue'].includes(s.status) ? `<button class="btn sm" data-action="pay-bill" data-id="${b.id}">Pay</button>` : ''}</td></tr>`).join('')
              : `<tr><td colspan="8"><div class="empty"><div class="big">${f === 'unpaid' ? 'No unpaid bills' : 'Nothing here'}</div>${f === 'unpaid' ? 'When a bill arrives in the mail or email, enter it here so nothing slips.' : 'Try another tab.'}<div style="margin-top:14px"><button class="btn primary" data-action="new-bill">${ICON.plus}New bill</button></div></div></td></tr>`}</tbody>
          </table></div>
        </div>
        <div class="card" style="margin-top:16px"><div class="card-head"><div><h3>Repeating invoices & bills</h3><div class="muted">Coll Ledger creates these for you on schedule. Make one from any invoice or bill with More → Repeat.</div></div></div>
          <div class="card-body list-rows">${rec.length ? rec.map(r => `<div class="row"><span class="tag ${r.kind === 'invoice' ? 'green' : 'blue'}">${r.kind === 'invoice' ? 'Invoice' : 'Bill'}</span><div class="grow"><b>${esc(r.kind === 'invoice' ? vendorName(c, r.template.contactId) : vendorName(c, r.template.vendorId))}</b> · ${money(r.kind === 'invoice' ? C.invoiceTotals(r.template).total : C.billTotal(r.template))} <span class="muted">${EVERY[r.every]}</span><div class="muted">${r.active ? `Next one ${fmtDate(r.next)}${r.kind === 'invoice' ? (r.autoSend ? ' · marked sent automatically' : ' · created as a draft for you to check') : ''}` : 'Paused'}</div></div>
            <button class="btn sm ghost" data-action="recur-toggle" data-id="${r.id}">${r.active ? 'Pause' : 'Resume'}</button><button class="btn sm ghost" data-action="recur-del" data-id="${r.id}">${ICON.trash}</button></div>`).join('') : '<div class="muted">None yet. Rent, subscriptions and monthly retainers are perfect for this.</div>'}</div></div>`;
    }
  });

  // ------------------------------------------------------------------
  // Bill window
  // ------------------------------------------------------------------
  function billModal(c, bill) {
    const isNew = !bill;
    const vendors = c.contacts.filter(x => x.kind === 'vendor').sort((a, b) => a.name.localeCompare(b.name));
    const cats = c.accounts.filter(a => (a.type === 'expense' || (a.type === 'asset' && a.sub !== 'bank' && a.sub !== 'clearing' && a.sub !== 'ar')) && !a.archived && !(a.key || '').startsWith('unc')).sort((a, b) => a.code.localeCompare(b.code));
    const draft = bill ? JSON.parse(JSON.stringify(bill)) : { id: C.uid(), vendorId: '', ref: '', date: today(), dueDate: C.addDays(today(), 30), status: 'open', memo: '', lines: [{ id: C.uid(), desc: '', accountId: '', amount: 0 }] };
    const real = isNew ? draft : c.bills.find(x => x.id === bill.id);
    const st = bill ? C.billState(c, bill) : null;
    const payments = bill ? c.transactions.filter(t => t.billId === bill.id) : [];
    const terms = C.daysBetween(draft.date, draft.dueDate);
    const m = U.openModal(`${U.modalHead(isNew ? 'New bill' : `Bill from ${vendorName(c, draft.vendorId)}`, st ? `<span class="tag ${st.tone}"><span class="dot"></span>${st.label}</span>${st.paid ? ` &nbsp;${money(st.paid)} paid · ${money(st.due)} still owed` : ''}` : 'Record it when it arrives — pay it later.')}
      <div class="modal-body">
        <div class="grid3">
          <div class="field" style="grid-column:span 2"><label for="b-vendor">Vendor</label><select class="input" id="b-vendor"><option value="">Who sent the bill?</option>${vendors.map(v => `<option value="${v.id}" ${v.id === draft.vendorId ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}<option value="__new">+ New vendor…</option></select>
            <div id="b-newv" class="inline-new" hidden><input class="input sm" id="b-newname" placeholder="Vendor name"><button class="btn sm primary" id="b-newadd">Add</button></div></div>
          <div class="field"><label for="b-ref">Bill or invoice #</label><input class="input" id="b-ref" value="${esc(draft.ref || '')}" placeholder="Optional"></div>
          <div class="field"><label for="b-date">Bill date</label><input type="date" class="input" id="b-date" value="${draft.date}"></div>
          <div class="field"><label for="b-terms">Due</label><select class="input" id="b-terms">${[[0, 'On receipt'], [10, 'In 10 days'], [15, 'In 15 days'], [30, 'In 30 days'], [45, 'In 45 days'], [60, 'In 60 days']].map(([d, l]) => `<option value="${d}" ${d === terms ? 'selected' : ''}>${l}</option>`).join('')}${[0, 10, 15, 30, 45, 60].includes(terms) ? '' : `<option value="${terms}" selected>In ${terms} days</option>`}</select></div>
          <div class="field"><label for="b-due">Due date</label><input type="date" class="input" id="b-due" value="${draft.dueDate}"></div>
        </div>
        <div class="table-wrap"><table class="lines"><thead><tr><th>What it's for</th><th style="width:230px">Category</th><th style="width:130px" class="num">Amount</th><th style="width:34px"></th></tr></thead><tbody id="b-lines"></tbody></table></div>
        <div style="display:flex;justify-content:space-between;align-items:center"><button class="btn sm" id="b-add">${ICON.plus}Add a line</button><div class="bill-total">Total <b id="b-total"></b></div></div>
        <div class="field"><label for="b-memo">Note</label><input class="input" id="b-memo" value="${esc(draft.memo || '')}" placeholder="Optional"></div>
        <div id="b-att"></div>
        ${payments.length ? `<div class="card flat"><div class="card-head"><h3>Payments</h3></div><div class="card-body list-rows">${payments.map(p => `<div class="row"><div class="grow">${fmtDate(p.date)} · ${esc(catName(c, p.accountId))}${p.memo ? ' · ' + esc(p.memo) : ''}</div><div class="num" style="font-weight:600">${money(-p.amount)}</div><button class="icon-btn" title="Remove this payment" data-pay="${p.id}">${ICON.trash}</button></div>`).join('')}</div></div>` : ''}
      </div>
      <div class="modal-foot">
        ${!isNew ? `<button class="btn ghost left" data-x="more" data-menu>${ICON.dots}More</button>` : '<span class="left"></span>'}
        <button class="btn ${st && st.due > 0 && draft.status !== 'void' ? '' : 'primary'}" data-x="save">${ICON.check}Save</button>
        ${draft.status !== 'void' && (!st || st.due > 0) ? `<button class="btn primary" data-x="pay">${ICON.check}${isNew ? 'Save & pay now' : 'Pay'}</button>` : ''}
      </div>`, { wide: true });
    const linesEl = $('#b-lines', m);
    const catOpts = sel => `<option value="">Choose…</option>` + cats.map(a => `<option value="${a.id}" ${a.id === sel ? 'selected' : ''}>${esc(a.name)}</option>`).join('');
    const totals = () => { $('#b-total', m).textContent = money(C.billTotal(draft)); };
    const draw = () => {
      linesEl.innerHTML = draft.lines.map(l => `<tr data-lid="${l.id}"><td><input class="input sm" data-l="desc" value="${esc(l.desc)}" placeholder="e.g. October flour order"></td><td><select class="input sm" data-l="accountId">${catOpts(l.accountId)}</select></td><td><div class="amt-wrap sm" style="width:auto"><span>$</span><input class="input sm num" data-l="amount" value="${l.amount ? (+l.amount).toFixed(2) : ''}" placeholder="0.00" inputmode="decimal"></div></td><td><button class="icon-btn" data-rm="${l.id}" aria-label="Remove line">${ICON.close}</button></td></tr>`).join('');
      totals();
    };
    draw();
    // a vendor's last bill fills in the category
    const lastCatFor = vid => { const prev = (c.bills || []).filter(b => b.vendorId === vid && b.id !== draft.id).sort((a, b) => b.date.localeCompare(a.date))[0]; return prev && prev.lines[0] && prev.lines[0].accountId; };
    linesEl.addEventListener('input', e => { const tr = e.target.closest('tr'); const l = draft.lines.find(x => x.id === tr.dataset.lid); const k = e.target.dataset.l; if (!l || !k) return; l[k] = k === 'amount' ? (C.parseAmount(e.target.value) || 0) : e.target.value; totals(); });
    linesEl.addEventListener('change', e => { if (e.target.dataset.l === 'accountId') draft.lines.find(x => x.id === e.target.closest('tr').dataset.lid).accountId = e.target.value; });
    linesEl.addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (!b) return; draft.lines = draft.lines.filter(x => x.id !== b.dataset.rm); if (!draft.lines.length) draft.lines.push({ id: C.uid(), desc: '', accountId: '', amount: 0 }); draw(); });
    $('#b-add', m).onclick = () => { draft.lines.push({ id: C.uid(), desc: '', accountId: draft.lines[draft.lines.length - 1].accountId || '', amount: 0 }); draw(); };
    const syncDue = () => { $('#b-due', m).value = C.addDays($('#b-date', m).value || today(), +$('#b-terms', m).value); };
    $('#b-terms', m).onchange = syncDue; $('#b-date', m).onchange = syncDue;
    $('#b-vendor', m).onchange = e => {
      $('#b-newv', m).hidden = e.target.value !== '__new';
      if (e.target.value === '__new') return $('#b-newname', m).focus();
      const cat = lastCatFor(e.target.value);
      if (cat && !draft.lines[0].accountId) { draft.lines[0].accountId = cat; draw(); }
      if (!cat && !draft.lines[0].accountId) { const g = C.suggest(c, { description: (C.contact(c, e.target.value) || {}).name || '', amount: -1, accountId: '' }); if (g && cats.some(a => a.id === g.categoryId)) { draft.lines[0].accountId = g.categoryId; draw(); } }
    };
    $('#b-newadd', m).onclick = () => {
      const name = $('#b-newname', m).value.trim(); if (!name) return;
      const v = { id: C.uid(), kind: 'vendor', name, email: '', phone: '', address: '', notes: '' }; c.contacts.push(v);
      const sel = $('#b-vendor', m); const o = document.createElement('option'); o.value = v.id; o.textContent = name; sel.insertBefore(o, sel.lastElementChild); sel.value = v.id; $('#b-newv', m).hidden = true; save();
      sel.dispatchEvent(new Event('change'));
    };
    const drawAtt = () => { const w = $('#b-att', m); w.innerHTML = App.attach.attachStrip(real); App.attach.wireStrip(w, real, drawAtt); };
    drawAtt();
    const collect = () => {
      draft.vendorId = $('#b-vendor', m).value === '__new' ? '' : $('#b-vendor', m).value;
      draft.ref = $('#b-ref', m).value.trim(); draft.date = $('#b-date', m).value || today(); draft.dueDate = $('#b-due', m).value || draft.date; draft.memo = $('#b-memo', m).value.trim();
      draft.lines = draft.lines.filter(l => l.desc || +l.amount);
      if (!draft.lines.length) draft.lines.push({ id: C.uid(), desc: '', accountId: '', amount: 0 });
      draft.attachments = real.attachments;
    };
    const valid = () => {
      if (!draft.vendorId) { $('#b-vendor', m).focus(); U.toast('Choose who sent the bill', null, 'warn'); return false; }
      if (!C.billTotal(draft)) { U.toast('Add the amount', null, 'warn'); return false; }
      if (draft.lines.some(l => +l.amount && !l.accountId)) { U.toast('Choose a category for each line', null, 'warn'); return false; }
      return true;
    };
    const persist = () => { c.bills = c.bills || []; const i = c.bills.findIndex(x => x.id === draft.id); if (i >= 0) c.bills[i] = draft; else c.bills.push(draft); };
    const on = (x, fn) => { const b = m.querySelector(`[data-x=${x}]`); if (b) b.onclick = fn; };
    on('save', async () => { collect(); if (draft.status !== 'void' && !valid()) return; if (!await guardLock(c, draft.date, bill && bill.date)) return; const undo = snapshot(c); persist(); U.closeModal(); commit(); U.toast('Bill saved', undo); });
    on('pay', async () => { collect(); if (!valid()) return; if (!await guardLock(c, draft.date, bill && bill.date)) return; persist(); save(); U.closeModal(); payModal(c, draft); });
    on('more', e => {
      const menu = U.openMenu(e.currentTarget, `<div class="mi" data-m="recur">${ICON.refresh}Repeat this bill…</div><div class="mi" data-m="dup">${ICON.copy}Duplicate</div>${draft.status !== 'void' ? `<div class="mi" data-m="void">${ICON.close}Void (keep a record, owe nothing)</div>` : `<div class="mi" data-m="unvoid">${ICON.refresh}Restore</div>`}<div class="sep"></div><div class="mi danger-mi" data-m="del">${ICON.trash}Delete</div>`);
      menu.onclick = async ev => {
        const it = ev.target.closest('[data-m]'); if (!it) return; U.closeMenus(); const k = it.dataset.m;
        if (k === 'recur') { collect(); if (!valid()) return; persist(); save(); U.closeModal(); recurModal(c, 'bill', draft); }
        if (k === 'dup') { collect(); U.closeModal(); const copy = JSON.parse(JSON.stringify(draft)); Object.assign(copy, { id: C.uid(), ref: '', date: today(), dueDate: C.addDays(today(), C.daysBetween(draft.date, draft.dueDate)), status: 'open', attachments: [], recurringId: null }); copy.lines.forEach(l => l.id = C.uid()); c.bills.push(copy); save(); render(); billModal(c, copy); }
        if (k === 'void' || k === 'unvoid') { if (k === 'void' && payments.length) return U.toast('Remove the payments first', null, 'warn'); if (!await guardLock(c, draft.date)) return; const undo = snapshot(c); draft.status = k === 'void' ? 'void' : 'open'; persist(); U.closeModal(); commit(); U.toast(k === 'void' ? 'Bill voided' : 'Bill restored', undo); }
        if (k === 'del') { if (payments.length) return U.toast('Remove its payments first', null, 'warn'); if (!await U.confirmBox({ title: 'Delete this bill?', body: 'It will be removed from the books.', ok: 'Delete', danger: true })) return; if (!await guardLock(c, draft.date)) return; const undo = snapshot(c); c.bills = c.bills.filter(x => x.id !== draft.id); U.closeModal(); commit(); U.toast('Bill deleted', undo); }
      };
    });
    $$('[data-pay]', m).forEach(b => b.onclick = async () => { const p = c.transactions.find(t => t.id === b.dataset.pay); if (!p || !await guardLock(c, p.date)) return; const undo = snapshot(c); c.transactions = c.transactions.filter(t => t.id !== p.id); save(); U.closeModal(); render(); billModal(c, c.bills.find(x => x.id === draft.id)); U.toast('Payment removed', undo); });
  }
  App.billModal = billModal;

  function payModal(c, bill) {
    const st = C.billState(c, bill);
    const from = App.moneyAccounts(c);
    const v = C.contact(c, bill.vendorId);
    const m = U.openModal(`${U.modalHead('Pay a bill', `${esc(v ? v.name : '')}${bill.ref ? ' · #' + esc(bill.ref) : ''} · ${money(st.due)} owed`)}
      <div class="modal-body"><div class="grid2">
        <div class="field"><label for="pb-amt">Amount paid</label><div class="amt-wrap"><span>$</span><input class="input" id="pb-amt" value="${st.due.toFixed(2)}" inputmode="decimal" autofocus></div></div>
        <div class="field"><label for="pb-date">Date paid</label><input type="date" class="input" id="pb-date" value="${today()}"></div>
        <div class="field span2"><label for="pb-acc">Paid from</label><select class="input" id="pb-acc">${App.accountOptions(from, from[0] && from[0].id)}</select></div>
        <div class="field span2"><label for="pb-ref">Check # or reference</label><input class="input" id="pb-ref" placeholder="Optional"></div>
      </div><div class="note">${ICON.spark}<span>If this payment also comes in on a bank import, exclude that line in To Review so it isn't counted twice.</span></div></div>
      <div class="modal-foot"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" id="pb-go">${ICON.check}Record payment</button></div>`);
    $('#pb-go', m).onclick = async () => {
      const amt = C.parseAmount($('#pb-amt', m).value);
      if (!(amt > 0)) return U.toast('Enter the amount paid', null, 'warn');
      const date = $('#pb-date', m).value || today();
      if (!await guardLock(c, date)) return;
      const ref = $('#pb-ref', m).value.trim();
      const undo = snapshot(c);
      c.transactions.push({ id: C.uid(), date, description: `Bill payment${bill.ref ? ' #' + bill.ref : ''}${ref ? ' · ' + ref : ''}`, payee: v ? v.name : 'Vendor', vendorId: bill.vendorId, amount: -C.round2(amt), accountId: $('#pb-acc', m).value, categoryId: C.ensureAP(c).id, billId: bill.id, memo: ref, status: 'posted', cleared: false, reconciled: false });
      c.transactions.sort((a, b) => a.date.localeCompare(b.date));
      U.closeModal(); commit(); U.toast(`Paid ${money(amt)} to ${v ? v.name : 'vendor'}`, undo);
    };
  }

  // ------------------------------------------------------------------
  // Repeating invoices & bills
  // ------------------------------------------------------------------
  const EVERY = { week: 'every week', twoweeks: 'every 2 weeks', month: 'every month', quarter: 'every 3 months', year: 'every year' };
  function recurModal(c, kind, doc) {
    const m = U.openModal(`${U.modalHead(kind === 'invoice' ? 'Repeat this invoice' : 'Repeat this bill', 'Coll Ledger makes the next one for you on schedule')}
      <div class="modal-body"><div class="grid2">
        <div class="field"><label for="r-every">How often</label><select class="input" id="r-every">${Object.entries(EVERY).map(([k, l]) => `<option value="${k}" ${k === 'month' ? 'selected' : ''}>${l[0].toUpperCase() + l.slice(1)}</option>`).join('')}</select></div>
        <div class="field"><label for="r-next">Next one on</label><input type="date" class="input" id="r-next" value="${C.nextDate(doc.date, 'month')}"></div>
      </div>
      ${kind === 'invoice' ? `<label class="check"><input type="checkbox" id="r-auto">Mark them sent automatically (otherwise each one waits as a draft for you to check)</label>` : ''}
      <div class="note">${ICON.spark}<span>Each new ${kind} copies the lines and amounts of this one. You can change any of them before or after they're made, and pause or stop repeating from the Bills screen.</span></div></div>
      <div class="modal-foot"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" id="r-go">${ICON.refresh}Start repeating</button></div>`);
    $('#r-every', m).onchange = () => { $('#r-next', m).value = C.nextDate(doc.date, $('#r-every', m).value); };
    $('#r-go', m).onclick = () => {
      const t = JSON.parse(JSON.stringify(doc));
      ['id', 'status', 'attachments', 'number', 'recurringId'].forEach(k => delete t[k]);
      t.terms = C.daysBetween(doc.date, doc.dueDate);
      const r = { id: C.uid(), kind, template: t, every: $('#r-every', m).value, next: $('#r-next', m).value, active: true, autoSend: kind === 'invoice' && $('#r-auto', m).checked };
      c.recurring = c.recurring || []; c.recurring.push(r);
      doc.recurringId = r.id;
      U.closeModal(); commit(); U.toast(`Repeating ${EVERY[r.every]} — next one ${fmtDate(r.next)}`);
      runRecurring(true);
    };
  }
  App.recurModal = recurModal;

  // Create everything that's due, for every client
  function runRecurring(quiet) {
    let made = 0;
    for (const c of S.data.clients) {
      for (const r of c.recurring || []) {
        let guard = 0;
        while (r.active && r.next <= today() && guard++ < 60) {
          const doc = JSON.parse(JSON.stringify(r.template));
          doc.id = C.uid(); doc.date = r.next; doc.dueDate = C.addDays(r.next, r.template.terms || 0); doc.recurringId = r.id; doc.lines = (doc.lines || []).map(l => ({ ...l, id: C.uid() }));
          if (r.kind === 'invoice') { doc.number = c.invoicePrefix + c.nextInvoice++; doc.status = r.autoSend ? 'sent' : 'draft'; c.invoices.push(doc); }
          else { doc.status = 'open'; c.bills = c.bills || []; c.bills.push(doc); }
          r.next = C.nextDate(r.next, r.every); made++;
        }
      }
    }
    if (made) { save(); if (!quiet) U.toast(`Created ${plural(made, 'repeating invoice or bill', 'repeating invoices and bills')} that came due`); }
    return made;
  }
  App.onLoad.push(() => runRecurring(false));
  setInterval(() => { if (S.data && !document.body.classList.contains('locked') && runRecurring(false)) render(); }, 60 * 60 * 1000);

  act({
    'bill-filter': el => { S.ui.bills.filter = el.dataset.v; if (S.route.page !== 'bills') go('bills'); else render(); },
    'new-bill': () => { const c = client(); if (c) billModal(c); },
    'edit-bill': (el, e) => { if (e && e.target.closest('[data-stop]')) return; const c = client(); const b = c.bills.find(x => x.id === el.dataset.id); if (b) billModal(c, b); },
    'pay-bill': (el, e) => { e.stopPropagation(); const c = client(); const b = c.bills.find(x => x.id === el.dataset.id); if (b) payModal(c, b); },
    'recur-toggle': el => { const c = client(); const r = c.recurring.find(x => x.id === el.dataset.id); if (!r) return; r.active = !r.active; if (r.active && r.next < today()) { while (r.next < today()) r.next = C.nextDate(r.next, r.every); } commit(); },
    'recur-del': async el => { const c = client(); if (!await U.confirmBox({ title: 'Stop repeating?', body: 'Invoices and bills already made stay. No new ones will be created.', ok: 'Stop repeating' })) return; c.recurring = c.recurring.filter(x => x.id !== el.dataset.id); commit(); }
  });
})();
